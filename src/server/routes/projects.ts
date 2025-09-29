import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { extractPagination, extractSort, createPaginatedResponse } from './api';
import { asyncHandler } from '../middleware/errorHandler';

export function projectRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  // All project routes require authentication
  router.use(authMiddlewares.required(securityManager));

  // GET /api/projects - List projects with pagination and filtering
  router.get('/',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt', 'lastAnalyzed'], default: 'updatedAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          type: { type: 'string', enum: ['react', 'vue', 'angular', 'node', 'typescript', 'javascript'] },
          status: { type: 'string', enum: ['active', 'analyzing', 'completed', 'error', 'archived'] },
          search: { type: 'string', minLength: 1, maxLength: 100 }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { page, limit, offset } = extractPagination(req.query);
      const sort = extractSort(req.query, ['name', 'createdAt', 'updatedAt', 'lastAnalyzed']);
      const { type, status, search } = req.query as any;

      // Build cache key
      const cacheKey = `projects:${req.user?.user.id}:${JSON.stringify({ page, limit, sort, type, status, search })}`;

      // Try cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual project fetching logic
      // For now, return mock data
      const mockProjects = [
        {
          id: 'proj_1',
          name: 'Sample React App',
          description: 'A sample React application for testing',
          path: '/path/to/sample-react-app',
          type: 'react',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
          lastAnalyzed: new Date('2024-01-10'),
          owner: req.user?.user.id,
          metrics: {
            totalComponents: 13,
            totalLines: 1245,
            complexity: 'medium',
            coverage: 85.5
          }
        }
      ];

      // Apply filters
      let filteredProjects = mockProjects.filter(project => {
        if (type && project.type !== type) return false;
        if (status && project.status !== status) return false;
        if (search && !project.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      // Apply sorting
      if (sort) {
        filteredProjects.sort((a, b) => {
          const aValue = (a as any)[sort.field];
          const bValue = (b as any)[sort.field];
          const order = sort.order === 'desc' ? -1 : 1;
          return aValue > bValue ? order : -order;
        });
      }

      // Apply pagination
      const totalCount = filteredProjects.length;
      const paginatedProjects = filteredProjects.slice(offset, offset + limit);

      const result = createPaginatedResponse(paginatedProjects, totalCount, page, limit);

      // Cache result for 5 minutes
      await cacheService.set(cacheKey, result, 300);

      res.json(result);
    })
  );

  // POST /api/projects - Create new project
  router.post('/',
    authMiddlewares.permissions(securityManager, ['project:create']),
    validateRequest({
      body: {
        type: 'object',
        required: ['name', 'path', 'type'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          path: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['react', 'vue', 'angular', 'node', 'typescript', 'javascript'] },
          settings: { type: 'object' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { name, description, path, type, settings } = req.body;
      const userId = req.user?.user.id;

      // TODO: Implement actual project creation logic
      const newProject = {
        id: `proj_${Date.now()}`,
        name,
        description,
        path,
        type,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: userId,
        settings: settings || {},
        metrics: {
          totalComponents: 0,
          totalLines: 0,
          complexity: 'unknown',
          coverage: 0
        }
      };

      // Invalidate projects cache
      await cacheService.clearPattern(`projects:${userId}:*`);

      res.status(201).json({
        message: 'Project created successfully',
        project: newProject
      });
    })
  );

  // GET /api/projects/:id - Get specific project
  router.get('/:id',
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const userId = req.user?.user.id;

      // Try cache first
      const cacheKey = `project:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        // Check if user has access
        if (cached.owner !== userId && !req.user?.user.roles.includes('admin')) {
          return res.status(403).json({ error: 'Access denied' });
        }
        return res.json(cached);
      }

      // TODO: Implement actual project fetching logic
      if (id === 'proj_1') {
        const project = {
          id: 'proj_1',
          name: 'Sample React App',
          description: 'A sample React application for testing',
          path: '/path/to/sample-react-app',
          type: 'react',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
          lastAnalyzed: new Date('2024-01-10'),
          owner: userId,
          settings: {
            includeTests: true,
            analyzeHooks: true,
            detectPatterns: true
          },
          metrics: {
            totalComponents: 13,
            totalLines: 1245,
            complexity: 'medium',
            coverage: 85.5,
            patterns: ['Custom Hooks', 'Context Provider'],
            antiPatterns: ['Prop Drilling']
          }
        };

        // Cache for 10 minutes
        await cacheService.set(cacheKey, project, 600);

        res.json(project);
      } else {
        res.status(404).json({ error: 'Project not found' });
      }
    })
  );

  // PUT /api/projects/:id - Update project
  router.put('/:id',
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          path: { type: 'string', minLength: 1 },
          settings: { type: 'object' },
          status: { type: 'string', enum: ['active', 'archived'] }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const userId = req.user?.user.id;

      // Check if user has permission to update this project
      if (!await requirePermission(req, res, securityManager, 'project', 'update')) {
        return;
      }

      // TODO: Implement actual project update logic
      const updatedProject = {
        id,
        ...req.body,
        updatedAt: new Date(),
        owner: userId
      };

      // Invalidate caches
      await cacheService.delete(`project:${id}`);
      await cacheService.clearPattern(`projects:${userId}:*`);

      res.json({
        message: 'Project updated successfully',
        project: updatedProject
      });
    })
  );

  // DELETE /api/projects/:id - Delete project
  router.delete('/:id',
    authMiddlewares.permissions(securityManager, ['project:delete']),
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const userId = req.user?.user.id;

      // TODO: Implement actual project deletion logic
      // This should also clean up associated analysis data, files, etc.

      // Invalidate caches
      await cacheService.delete(`project:${id}`);
      await cacheService.clearPattern(`projects:${userId}:*`);
      await cacheService.clearPattern(`analysis:project:${id}:*`);

      res.json({
        message: 'Project deleted successfully',
        projectId: id
      });
    })
  );

  // POST /api/projects/:id/analyze - Trigger project analysis
  router.post('/:id/analyze',
    authMiddlewares.permissions(securityManager, ['project:analyze']),
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        properties: {
          includePatterns: { type: 'boolean', default: true },
          includeMetrics: { type: 'boolean', default: true },
          includeDependencies: { type: 'boolean', default: true },
          depth: { type: 'string', enum: ['shallow', 'medium', 'full', 'deep'], default: 'full' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const options = req.body;
      const userId = req.user?.user.id;

      // TODO: Implement actual analysis triggering logic
      // This should queue an analysis job
      const analysisId = `analysis_${id}_${Date.now()}`;

      res.json({
        message: 'Analysis started successfully',
        analysisId,
        projectId: id,
        options,
        status: 'queued',
        estimatedDuration: '2-5 minutes'
      });
    })
  );

  // GET /api/projects/:id/analysis - Get analysis results
  router.get('/:id/analysis',
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      query: {
        type: 'object',
        properties: {
          includeComponents: { type: 'boolean', default: true },
          includePatterns: { type: 'boolean', default: true },
          includeMetrics: { type: 'boolean', default: true }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const { includeComponents, includePatterns, includeMetrics } = req.query as any;

      // Try cache first
      const cacheKey = `analysis:project:${id}:${JSON.stringify({ includeComponents, includePatterns, includeMetrics })}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual analysis results fetching
      const analysisResult = {
        projectId: id,
        lastAnalyzed: new Date(),
        status: 'completed',
        duration: 145000, // 2m 25s
        summary: {
          totalComponents: 13,
          totalFiles: 25,
          totalLines: 1245,
          complexity: 'medium',
          maintainabilityScore: 82.5
        },
        components: includeComponents ? [
          {
            id: 'comp_1',
            name: 'App',
            type: 'function_component',
            path: 'src/App.tsx',
            complexity: 5,
            props: ['theme', 'user'],
            hooks: ['useState', 'useContext'],
            dependencies: ['UserContext', 'ThemeProvider']
          }
        ] : undefined,
        patterns: includePatterns ? [
          {
            id: 'pattern_1',
            name: 'Custom Hook Pattern',
            type: 'good_pattern',
            confidence: 95,
            components: ['useUserData', 'useTheme'],
            description: 'Well-structured custom hooks for state management'
          }
        ] : undefined,
        metrics: includeMetrics ? {
          codeQuality: 85,
          testCoverage: 75,
          performance: 90,
          security: 88,
          maintainability: 82
        } : undefined
      };

      // Cache for 30 minutes
      await cacheService.set(cacheKey, analysisResult, 1800);

      res.json(analysisResult);
    })
  );

  // GET /api/projects/:id/graph - Get project graph data
  router.get('/:id/graph',
    validateRequest({
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 }
        }
      },
      query: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'cytoscape', 'd3'], default: 'json' },
          includeEdges: { type: 'boolean', default: true },
          maxDepth: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const { format, includeEdges, maxDepth } = req.query as any;

      // Try cache first
      const cacheKey = `graph:project:${id}:${format}:${includeEdges}:${maxDepth}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual graph data generation
      const graphData = {
        nodes: [
          {
            id: 'App',
            label: 'App Component',
            type: 'component',
            data: {
              path: 'src/App.tsx',
              complexity: 5,
              lines: 124
            }
          },
          {
            id: 'UserContext',
            label: 'User Context',
            type: 'context',
            data: {
              path: 'src/contexts/UserContext.tsx',
              provides: ['user', 'setUser']
            }
          }
        ],
        edges: includeEdges ? [
          {
            id: 'App-UserContext',
            source: 'App',
            target: 'UserContext',
            type: 'uses',
            data: {
              relationship: 'consumes'
            }
          }
        ] : []
      };

      // Cache for 20 minutes
      await cacheService.set(cacheKey, graphData, 1200);

      res.json(graphData);
    })
  );

  return router;
}