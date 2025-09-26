import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { FileInfo, AnalysisOptions } from '../../types';

export class FileScanner {
  private options: AnalysisOptions;

  constructor(options: Partial<AnalysisOptions> = {}) {
    this.options = {
      includeNodeModules: false,
      maxDepth: 10,
      followSymlinks: false,
      includeTests: false,
      patterns: {
        include: ['**/*.{ts,tsx,js,jsx}'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
      },
      ...options
    };

    // Add test exclusions if not including tests
    if (!this.options.includeTests) {
      this.options.patterns.exclude.push(
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**',
        '**/__mocks__/**'
      );
    }

    // Add node_modules exclusion if not including them
    if (!this.options.includeNodeModules) {
      this.options.patterns.exclude.push('**/node_modules/**');
    }
  }

  public async scanDirectory(rootPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      const normalizedRoot = path.resolve(rootPath);

      // Use glob to find files matching our patterns
      const allFilePaths: string[] = [];

      for (const pattern of this.options.patterns.include) {
        const matchedPaths = await glob(pattern, {
          cwd: normalizedRoot,
          ignore: this.options.patterns.exclude,
          absolute: true,
          followSymbolicLinks: this.options.followSymlinks,
          maxDepth: this.options.maxDepth
        });
        allFilePaths.push(...matchedPaths);
      }

      // Remove duplicates
      const filePaths = [...new Set(allFilePaths)];

      // Process each file
      for (const filePath of filePaths) {
        try {
          const fileInfo = await this.getFileInfo(filePath);
          if (fileInfo) {
            files.push(fileInfo);
          }
        } catch (error) {
          console.warn(`Failed to process file ${filePath}:`, error);
        }
      }

      return files.sort((a, b) => a.path.localeCompare(b.path));
    } catch (error) {
      throw new Error(`Failed to scan directory ${rootPath}: ${error}`);
    }
  }

  public async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      // Check if file extension is supported
      const extension = path.extname(filePath);
      const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

      if (!supportedExtensions.includes(extension)) {
        return null;
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');

      return {
        path: filePath,
        name: path.basename(filePath),
        extension,
        content,
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  public isReactFile(content: string): boolean {
    // Check for React imports and JSX usage
    const reactPatterns = [
      /import\s+.*\s+from\s+['"]react['"]/,
      /import\s+React\s+from/,
      /import\s*{\s*.*\s*}\s*from\s*['"]react['"]/,
      /<\w+.*>/,  // JSX elements
      /React\.createElement/
    ];

    return reactPatterns.some(pattern => pattern.test(content));
  }

  public isComponentFile(content: string): boolean {
    // Check for component patterns
    const componentPatterns = [
      /export\s+(default\s+)?(?:function|const)\s+\w+.*=.*=>.*</, // Arrow function component
      /export\s+(default\s+)?function\s+\w+.*{[\s\S]*return[\s\S]*</, // Function component
      /class\s+\w+\s+extends\s+(React\.)?Component/, // Class component
      /const\s+\w+\s*=\s*React\.forwardRef/, // forwardRef component
      /const\s+\w+\s*=\s*React\.memo/, // memo component
    ];

    return componentPatterns.some(pattern => pattern.test(content));
  }

  public isHookFile(content: string): boolean {
    // Check for custom hook patterns
    const hookPatterns = [
      /export\s+(default\s+)?(function|const)\s+use\w+/,
      /function\s+use\w+/,
      /const\s+use\w+\s*=/
    ];

    return hookPatterns.some(pattern => pattern.test(content));
  }

  public getFileCategory(fileInfo: FileInfo): string {
    const { content, name } = fileInfo;

    if (name.includes('.test.') || name.includes('.spec.')) {
      return 'test';
    }

    if (name.includes('.d.ts')) {
      return 'types';
    }

    if (this.isComponentFile(content)) {
      return 'component';
    }

    if (this.isHookFile(content)) {
      return 'hook';
    }

    if (this.isReactFile(content)) {
      return 'react-util';
    }

    if (fileInfo.extension === '.ts' || fileInfo.extension === '.tsx') {
      return 'typescript';
    }

    return 'javascript';
  }

  public filterFilesByCategory(files: FileInfo[], categories: string[]): FileInfo[] {
    return files.filter(file => categories.includes(this.getFileCategory(file)));
  }

  public async watchDirectory(
    rootPath: string,
    callback: (event: 'add' | 'change' | 'unlink', filePath: string) => void
  ): Promise<() => void> {
    const chokidar = await import('chokidar');

    const watcher = chokidar.watch(this.options.patterns.include, {
      cwd: rootPath,
      ignored: this.options.patterns.exclude,
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', (filePath: string) => callback('add', path.resolve(rootPath, filePath)))
      .on('change', (filePath: string) => callback('change', path.resolve(rootPath, filePath)))
      .on('unlink', (filePath: string) => callback('unlink', path.resolve(rootPath, filePath)));

    // Return cleanup function
    return () => {
      watcher.close();
    };
  }
}