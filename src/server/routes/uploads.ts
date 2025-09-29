import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { authMiddlewares, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  uploadPath?: string;
  preserveFilename?: boolean;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  uploadedBy?: string;
  uploadedAt: Date;
  metadata?: any;
}

export function uploadRoutes(config: UploadConfig): Router {
  const router = Router();

  const uploadPath = config.uploadPath || path.join(process.cwd(), 'uploads');
  const maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
  const allowedMimeTypes = config.allowedMimeTypes || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/json',
    'text/csv'
  ];

  // Ensure upload directory exists
  fs.mkdir(uploadPath, { recursive: true }).catch(console.error);

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const userPath = path.join(uploadPath, 'temp');
        await fs.mkdir(userPath, { recursive: true });
        cb(null, userPath);
      } catch (error) {
        cb(error, '');
      }
    },
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = path.extname(file.originalname);
      const filename = config.preserveFilename
        ? `${uniqueId}_${file.originalname}`
        : `${uniqueId}${ext}`;
      cb(null, filename);
    }
  });

  // File filter
  const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`File type ${file.mimetype} not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  };

  // Configure multer
  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize,
      files: 10 // Maximum 10 files per request
    }
  });

  // Upload single file
  router.post('/single',
    authMiddlewares.required,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            code: 'NO_FILE'
          });
        }

        const uploadedFile = await processUploadedFile(req.file, req.user?.user.id, req.body.metadata);

        res.json({
          message: 'File uploaded successfully',
          file: uploadedFile
        });

      } catch (error) {
        console.error('Single file upload error:', error);

        // Clean up file on error
        if (req.file?.path) {
          fs.unlink(req.file.path).catch(console.error);
        }

        res.status(500).json({
          error: 'File upload failed',
          code: 'UPLOAD_ERROR'
        });
      }
    }
  );

  // Upload multiple files
  router.post('/multiple',
    authMiddlewares.required,
    upload.array('files', 10),
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
          return res.status(400).json({
            error: 'No files uploaded',
            code: 'NO_FILES'
          });
        }

        const files = req.files as Express.Multer.File[];
        const uploadedFiles: UploadedFile[] = [];
        const errors: any[] = [];

        for (let i = 0; i < files.length; i++) {
          try {
            const uploadedFile = await processUploadedFile(
              files[i],
              req.user?.user.id,
              req.body.metadata ? JSON.parse(req.body.metadata) : undefined
            );
            uploadedFiles.push(uploadedFile);
          } catch (error) {
            errors.push({
              file: files[i].originalname,
              error: (error as Error).message
            });

            // Clean up failed file
            fs.unlink(files[i].path).catch(console.error);
          }
        }

        res.json({
          message: `${uploadedFiles.length} files uploaded successfully`,
          files: uploadedFiles,
          errors: errors.length > 0 ? errors : undefined
        });

      } catch (error) {
        console.error('Multiple file upload error:', error);

        // Clean up all files on error
        if (req.files) {
          (req.files as Express.Multer.File[]).forEach(file => {
            fs.unlink(file.path).catch(console.error);
          });
        }

        res.status(500).json({
          error: 'File upload failed',
          code: 'UPLOAD_ERROR'
        });
      }
    }
  );

  // Get file metadata
  router.get('/:fileId',
    authMiddlewares.optional,
    validateRequest({
      params: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string', format: 'uuid' }
        }
      }
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { fileId } = req.params;
        const fileMetadata = await getFileMetadata(fileId);

        if (!fileMetadata) {
          throw new NotFoundError('File not found');
        }

        // Check if file exists on disk
        try {
          await fs.access(fileMetadata.path);
        } catch {
          throw new NotFoundError('File not found on disk');
        }

        res.json(fileMetadata);

      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({
            error: error.message,
            code: 'FILE_NOT_FOUND'
          });
        } else {
          console.error('Get file metadata error:', error);
          res.status(500).json({
            error: 'Failed to get file metadata',
            code: 'METADATA_ERROR'
          });
        }
      }
    }
  );

  // Download/serve file
  router.get('/:fileId/download',
    authMiddlewares.optional,
    validateRequest({
      params: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string', format: 'uuid' }
        }
      },
      query: {
        type: 'object',
        properties: {
          inline: { type: 'boolean' },
          thumbnail: { type: 'boolean' }
        }
      }
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { fileId } = req.params;
        const { inline = false, thumbnail = false } = req.query;

        const fileMetadata = await getFileMetadata(fileId);
        if (!fileMetadata) {
          throw new NotFoundError('File not found');
        }

        let filePath = fileMetadata.path;

        // Handle thumbnail request for images
        if (thumbnail && fileMetadata.mimetype.startsWith('image/')) {
          filePath = await getThumbnailPath(fileMetadata);
        }

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          throw new NotFoundError('File not found on disk');
        }

        // Set appropriate headers
        res.setHeader('Content-Type', fileMetadata.mimetype);
        res.setHeader('Content-Length', fileMetadata.size);

        if (inline) {
          res.setHeader('Content-Disposition', `inline; filename="${fileMetadata.originalName}"`);
        } else {
          res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.originalName}"`);
        }

        // Cache headers for static files
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        res.setHeader('ETag', `"${fileMetadata.id}"`);

        // Stream file
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (error: Error) => {
          console.error('File stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'File streaming error',
              code: 'STREAM_ERROR'
            });
          }
        });

      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({
            error: error.message,
            code: 'FILE_NOT_FOUND'
          });
        } else {
          console.error('File download error:', error);
          res.status(500).json({
            error: 'File download failed',
            code: 'DOWNLOAD_ERROR'
          });
        }
      }
    }
  );

  // Delete file
  router.delete('/:fileId',
    authMiddlewares.required,
    validateRequest({
      params: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string', format: 'uuid' }
        }
      }
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { fileId } = req.params;
        const userId = req.user?.user.id;

        const fileMetadata = await getFileMetadata(fileId);
        if (!fileMetadata) {
          throw new NotFoundError('File not found');
        }

        // Check if user owns the file or is admin
        if (fileMetadata.uploadedBy !== userId && !req.user?.user.roles.includes('admin')) {
          return res.status(403).json({
            error: 'Access denied',
            code: 'ACCESS_DENIED'
          });
        }

        // Delete file from disk
        try {
          await fs.unlink(fileMetadata.path);
        } catch (error) {
          console.warn('File deletion warning - file may not exist:', error);
        }

        // Delete thumbnail if exists
        try {
          const thumbnailPath = await getThumbnailPath(fileMetadata);
          await fs.unlink(thumbnailPath);
        } catch {
          // Thumbnail may not exist, ignore error
        }

        // Remove from metadata storage
        await removeFileMetadata(fileId);

        res.json({
          message: 'File deleted successfully',
          fileId
        });

      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({
            error: error.message,
            code: 'FILE_NOT_FOUND'
          });
        } else {
          console.error('File deletion error:', error);
          res.status(500).json({
            error: 'File deletion failed',
            code: 'DELETE_ERROR'
          });
        }
      }
    }
  );

  // List user's files
  router.get('/',
    authMiddlewares.required,
    validateRequest({
      query: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          mimetype: { type: 'string' },
          sortBy: { type: 'string', enum: ['name', 'size', 'uploadedAt'], default: 'uploadedAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.user.id;
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const {
          page = 1,
          limit = 20,
          mimetype,
          sortBy = 'uploadedAt',
          sortOrder = 'desc'
        } = req.query as any;

        const files = await listUserFiles(userId, {
          page,
          limit,
          mimetype,
          sortBy,
          sortOrder
        });

        res.json(files);

      } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({
          error: 'Failed to list files',
          code: 'LIST_ERROR'
        });
      }
    }
  );

  return router;
}

// Helper functions (these would typically use a database)
// For now, we'll use file-based storage as placeholders

async function processUploadedFile(
  file: Express.Multer.File,
  userId?: string,
  metadata?: any
): Promise<UploadedFile> {
  const fileId = uuidv4();
  const finalPath = path.join(path.dirname(file.path), '..', 'files', file.filename);

  // Move file from temp to final location
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.rename(file.path, finalPath);

  const uploadedFile: UploadedFile = {
    id: fileId,
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    path: finalPath,
    url: `/uploads/${fileId}/download`,
    uploadedBy: userId,
    uploadedAt: new Date(),
    metadata
  };

  // Save metadata (in a real app, this would go to a database)
  await saveFileMetadata(uploadedFile);

  return uploadedFile;
}

async function saveFileMetadata(file: UploadedFile): Promise<void> {
  const metadataPath = path.join(path.dirname(file.path), '..', 'metadata', `${file.id}.json`);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify(file, null, 2));
}

async function getFileMetadata(fileId: string): Promise<UploadedFile | null> {
  try {
    const uploadPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
    const metadataPath = path.join(uploadPath, 'metadata', `${fileId}.json`);
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function removeFileMetadata(fileId: string): Promise<void> {
  try {
    const uploadPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
    const metadataPath = path.join(uploadPath, 'metadata', `${fileId}.json`);
    await fs.unlink(metadataPath);
  } catch {
    // Ignore errors if metadata doesn't exist
  }
}

async function getThumbnailPath(file: UploadedFile): Promise<string> {
  const thumbnailPath = path.join(path.dirname(file.path), '..', 'thumbnails', file.filename);

  // Generate thumbnail if it doesn't exist (placeholder)
  try {
    await fs.access(thumbnailPath);
  } catch {
    // In a real app, you would generate a thumbnail here
    // For now, just return the original file path
    return file.path;
  }

  return thumbnailPath;
}

async function listUserFiles(userId: string, options: {
  page: number;
  limit: number;
  mimetype?: string;
  sortBy: string;
  sortOrder: string;
}): Promise<{
  files: UploadedFile[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  try {
    const uploadPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
    const metadataDir = path.join(uploadPath, 'metadata');

    // Read all metadata files (in a real app, this would be a database query)
    const metadataFiles = await fs.readdir(metadataDir);
    const allFiles: UploadedFile[] = [];

    for (const filename of metadataFiles) {
      if (!filename.endsWith('.json')) continue;

      try {
        const data = await fs.readFile(path.join(metadataDir, filename), 'utf8');
        const file = JSON.parse(data);

        // Filter by user and mimetype
        if (file.uploadedBy === userId) {
          if (!options.mimetype || file.mimetype === options.mimetype) {
            allFiles.push(file);
          }
        }
      } catch {
        // Skip invalid metadata files
      }
    }

    // Sort files
    allFiles.sort((a, b) => {
      const aValue = (a as any)[options.sortBy];
      const bValue = (b as any)[options.sortBy];

      if (options.sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Paginate
    const startIndex = (options.page - 1) * options.limit;
    const endIndex = startIndex + options.limit;
    const paginatedFiles = allFiles.slice(startIndex, endIndex);

    return {
      files: paginatedFiles,
      totalCount: allFiles.length,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(allFiles.length / options.limit)
    };

  } catch (error) {
    console.error('List user files error:', error);
    return {
      files: [],
      totalCount: 0,
      page: options.page,
      limit: options.limit,
      totalPages: 0
    };
  }
}