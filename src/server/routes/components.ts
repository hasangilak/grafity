import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { extractPagination, extractSort, createPaginatedResponse } from './api';
import { asyncHandler } from '../middleware/errorHandler';

export function componentRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  // All component routes require authentication
  router.use(authMiddlewares.required(securityManager));

  // GET /api/components - List components with filtering
  router.get('/',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          projectId: { type: 'string' },
          type: {
            type: 'string',
            enum: ['function_component', 'class_component', 'hook', 'utility', 'service']
          },
          complexity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical']
          },
          hasTests: { type: 'boolean' },
          search: { type: 'string', minLength: 1, maxLength: 100 },
          sortBy: {
            type: 'string',
            enum: ['name', 'complexity', 'lines', 'dependencies', 'createdAt'],
            default: 'name'
          },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { page, limit, offset } = extractPagination(req.query);
      const sort = extractSort(req.query, ['name', 'complexity', 'lines', 'dependencies', 'createdAt']);
      const { projectId, type, complexity, hasTests, search } = req.query as any;

      const cacheKey = `components:list:${JSON.stringify({ page, limit, projectId, type, complexity, hasTests, search, sort })}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual component fetching from analysis results
      const mockComponents = [
        {
          id: 'comp_1',
          name: 'App',
          type: 'function_component',
          path: 'src/App.tsx',
          projectId: 'proj_1',
          complexity: 'medium',
          lines: 124,
          props: [
            { name: 'theme', type: 'Theme', required: false, defaultValue: 'light' },
            { name: 'user', type: 'User', required: true }
          ],
          hooks: [
            { name: 'useState', type: 'state', dependencies: [] },
            { name: 'useContext', type: 'context', dependencies: ['ThemeContext'] }
          ],
          methods: [
            { name: 'handleThemeChange', parameters: ['theme'], returnType: 'void' }
          ],
          dependencies: [
            { target: 'ThemeContext', type: 'context_usage' },
            { target: 'UserProfile', type: 'component_usage' }
          ],
          exports: [
            { name: 'App', type: 'default' }
          ],
          imports: [
            { source: 'react', imports: ['useState', 'useContext'], type: 'named' },
            { source: './contexts/ThemeContext', imports: ['ThemeContext'], type: 'named' }
          ],
          hasTests: true,
          testCoverage: 85,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'comp_2',
          name: 'useUserData',
          type: 'hook',
          path: 'src/hooks/useUserData.ts',
          projectId: 'proj_1',
          complexity: 'low',
          lines: 45,
          hooks: [
            { name: 'useState', type: 'state', dependencies: [] },
            { name: 'useEffect', type: 'effect', dependencies: ['userId'] }
          ],
          dependencies: [
            { target: 'userService', type: 'service_usage' }
          ],
          exports: [
            { name: 'useUserData', type: 'default' }
          ],
          hasTests: true,
          testCoverage: 92,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-10')
        }
      ];

      // Apply filters
      let filteredComponents = mockComponents.filter(component => {
        if (projectId && component.projectId !== projectId) return false;
        if (type && component.type !== type) return false;
        if (complexity && component.complexity !== complexity) return false;
        if (hasTests !== undefined && component.hasTests !== hasTests) return false;
        if (search && !component.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      // Apply sorting
      if (sort) {
        filteredComponents.sort((a, b) => {
          const aValue = (a as any)[sort.field];
          const bValue = (b as any)[sort.field];
          const order = sort.order === 'desc' ? -1 : 1;
          return aValue > bValue ? order : -order;
        });
      }

      const totalCount = filteredComponents.length;
      const paginatedComponents = filteredComponents.slice(offset, offset + limit);

      const result = createPaginatedResponse(paginatedComponents, totalCount, page, limit);

      await cacheService.set(cacheKey, result, 600);

      res.json(result);
    })
  );

  // GET /api/components/:id - Get specific component details
  router.get('/:id',
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
          includeSource: { type: 'boolean', default: false },
          includeTests: { type: 'boolean', default: false },
          includeUsage: { type: 'boolean', default: true }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const { includeSource, includeTests, includeUsage } = req.query as any;

      const cacheKey = `component:${id}:${JSON.stringify({ includeSource, includeTests, includeUsage })}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual component fetching
      if (id === 'comp_1') {
        const component = {
          id: 'comp_1',
          name: 'App',
          type: 'function_component',
          path: 'src/App.tsx',
          projectId: 'proj_1',
          description: 'Main application component that provides theme and user context',
          complexity: {
            cyclomatic: 5,
            cognitive: 8,
            lines: 124,
            rating: 'medium'
          },
          props: [
            {
              name: 'theme',
              type: 'Theme',
              required: false,
              defaultValue: 'light',
              description: 'Application theme configuration'
            },
            {
              name: 'user',
              type: 'User',
              required: true,
              description: 'Current authenticated user'
            }
          ],
          hooks: [
            {
              name: 'useState',
              type: 'state',
              line: 15,
              state: 'isLoading',
              dependencies: []
            },
            {
              name: 'useContext',
              type: 'context',
              line: 16,
              context: 'ThemeContext',
              dependencies: ['ThemeContext']
            }
          ],
          methods: [
            {
              name: 'handleThemeChange',
              parameters: [{ name: 'theme', type: 'Theme' }],
              returnType: 'void',
              line: 25,
              complexity: 2
            }
          ],
          dependencies: [
            {
              id: 'dep_1',
              target: 'ThemeContext',
              type: 'context_usage',
              strength: 'strong',
              line: 16
            },
            {
              id: 'dep_2',
              target: 'UserProfile',
              type: 'component_usage',
              strength: 'medium',
              line: 45
            }
          ],
          usedBy: includeUsage ? [
            {
              component: 'index.tsx',
              usage: 'import',
              line: 5
            }
          ] : undefined,
          source: includeSource ? `import React, { useState, useContext } from 'react';
import { ThemeContext } from './contexts/ThemeContext';
import { UserProfile } from './components/UserProfile';

export const App: React.FC<AppProps> = ({ theme = 'light', user }) => {
  const [isLoading, setIsLoading] = useState(false);
  const themeContext = useContext(ThemeContext);

  const handleThemeChange = (theme: Theme) => {
    themeContext.setTheme(theme);
  };

  return (
    <div className="app">
      <UserProfile user={user} onThemeChange={handleThemeChange} />
    </div>
  );
};` : undefined,
          tests: includeTests ? {
            file: 'src/App.test.tsx',
            coverage: 85,
            testCases: [
              { name: 'renders without crashing', status: 'passing' },
              { name: 'handles theme changes', status: 'passing' },
              { name: 'displays user profile', status: 'passing' }
            ]
          } : undefined,
          metrics: {
            maintainabilityIndex: 78,
            testability: 85,
            reusability: 45,
            performance: 88
          },
          issues: [
            {
              type: 'suggestion',
              severity: 'low',
              message: 'Consider memoizing the component for better performance',
              line: 8
            }
          ],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15')
        };

        await cacheService.set(cacheKey, component, 1800);
        res.json(component);
      } else {
        res.status(404).json({ error: 'Component not found' });
      }
    })
  );

  // GET /api/components/:id/dependencies - Get component dependency graph
  router.get('/:id/dependencies',
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
          depth: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
          includeExternal: { type: 'boolean', default: false },
          direction: { type: 'string', enum: ['incoming', 'outgoing', 'both'], default: 'both' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const { depth, includeExternal, direction } = req.query as any;

      const cacheKey = `component:dependencies:${id}:${depth}:${includeExternal}:${direction}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual dependency graph generation
      const dependencyGraph = {
        componentId: id,
        depth,
        direction,
        nodes: [
          {
            id: 'comp_1',
            name: 'App',
            type: 'component',
            level: 0
          },
          {
            id: 'context_1',
            name: 'ThemeContext',
            type: 'context',
            level: 1
          },
          {
            id: 'comp_2',
            name: 'UserProfile',
            type: 'component',
            level: 1
          }
        ],
        edges: [
          {
            source: 'comp_1',
            target: 'context_1',
            type: 'uses',
            strength: 'strong'
          },
          {
            source: 'comp_1',
            target: 'comp_2',
            type: 'renders',
            strength: 'medium'
          }
        ],
        statistics: {
          totalDependencies: 2,
          circularDependencies: 0,
          maxDepth: 1,
          complexity: 'low'
        }
      };

      await cacheService.set(cacheKey, dependencyGraph, 1800);

      res.json(dependencyGraph);
    })
  );

  // GET /api/components/:id/usage - Get component usage analysis
  router.get('/:id/usage',
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

      const cacheKey = `component:usage:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual usage analysis
      const usageAnalysis = {
        componentId: id,
        summary: {
          totalUsages: 5,
          directUsages: 3,
          indirectUsages: 2,
          testUsages: 2
        },
        usages: [
          {
            file: 'src/index.tsx',
            line: 12,
            type: 'import',
            context: 'ReactDOM.render(<App />, document.getElementById("root"));'
          },
          {
            file: 'src/App.test.tsx',
            line: 8,
            type: 'test',
            context: 'render(<App user={mockUser} />);'
          }
        ],
        impact: {
          changeRisk: 'medium',
          affectedFiles: 5,
          testCoverage: 85,
          breakingChangeRisk: 'low'
        },
        recommendations: [
          'Component is well-tested and has good coverage',
          'Consider adding prop validation for better type safety'
        ]
      };

      await cacheService.set(cacheKey, usageAnalysis, 1800);

      res.json(usageAnalysis);
    })
  );

  // POST /api/components/analyze - Analyze component from source code
  router.post('/analyze',
    authMiddlewares.permissions(securityManager, ['component:analyze']),
    validateRequest({
      body: {
        type: 'object',
        required: ['source'],
        properties: {
          source: { type: 'string', minLength: 1 },
          language: { type: 'string', enum: ['typescript', 'javascript', 'tsx', 'jsx'], default: 'tsx' },
          filename: { type: 'string' },
          projectId: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              includeComplexity: { type: 'boolean', default: true },
              includePatterns: { type: 'boolean', default: true },
              includeTestability: { type: 'boolean', default: true }
            }
          }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { source, language, filename, projectId, options = {} } = req.body;

      const sourceHash = require('crypto').createHash('md5').update(source).digest('hex');
      const cacheKey = `component:analyze:${sourceHash}:${JSON.stringify(options)}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual component analysis using AST parser
      const analysis = {
        id: `analysis_${Date.now()}`,
        filename,
        language,
        projectId,
        timestamp: new Date(),
        components: [
          {
            name: 'AnalyzedComponent',
            type: 'function_component',
            startLine: 5,
            endLine: 25,
            props: [
              { name: 'title', type: 'string', required: true },
              { name: 'onClick', type: 'function', required: false }
            ],
            hooks: [
              { name: 'useState', line: 7, state: 'isVisible' },
              { name: 'useCallback', line: 9, dependencies: ['onClick'] }
            ],
            complexity: options.includeComplexity ? {
              cyclomatic: 3,
              cognitive: 5,
              maintainability: 82
            } : undefined,
            patterns: options.includePatterns ? [
              {
                name: 'Event Handler Pattern',
                type: 'good_pattern',
                confidence: 88
              }
            ] : undefined,
            testability: options.includeTestability ? {
              score: 85,
              factors: [
                { factor: 'Pure function', impact: 'positive' },
                { factor: 'Clear props interface', impact: 'positive' },
                { factor: 'No side effects', impact: 'positive' }
              ]
            } : undefined
          }
        ],
        metrics: {
          totalLines: source.split('\n').length,
          codeLines: source.split('\n').filter(line => line.trim()).length,
          complexity: 3,
          maintainability: 82
        },
        suggestions: [
          {
            type: 'improvement',
            message: 'Add PropTypes or TypeScript interface for better type safety',
            priority: 'medium'
          }
        ]
      };

      await cacheService.set(cacheKey, analysis, 1800);

      res.json(analysis);
    })
  );

  // GET /api/components/statistics - Get component statistics
  router.get('/statistics',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          groupBy: {
            type: 'string',
            enum: ['type', 'complexity', 'size', 'date'],
            default: 'type'
          },
          timeRange: {
            type: 'string',
            enum: ['day', 'week', 'month', 'quarter', 'year'],
            default: 'month'
          }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { projectId, groupBy, timeRange } = req.query as any;

      const cacheKey = `components:statistics:${projectId}:${groupBy}:${timeRange}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual statistics calculation
      const statistics = {
        projectId,
        timeRange,
        groupBy,
        summary: {
          totalComponents: 47,
          functionComponents: 35,
          classComponents: 5,
          hooks: 12,
          utilities: 8,
          averageComplexity: 4.2,
          testCoverage: 78.5
        },
        distribution: {
          byType: {
            function_component: 35,
            class_component: 5,
            hook: 12,
            utility: 8
          },
          byComplexity: {
            low: 25,
            medium: 18,
            high: 4,
            critical: 0
          },
          bySize: {
            small: 30,    // < 50 lines
            medium: 15,   // 50-200 lines
            large: 2      // > 200 lines
          }
        },
        trends: [
          {
            date: '2024-01-01',
            total: 40,
            added: 2,
            modified: 5,
            deleted: 0
          },
          {
            date: '2024-01-08',
            total: 45,
            added: 5,
            modified: 8,
            deleted: 0
          },
          {
            date: '2024-01-15',
            total: 47,
            added: 2,
            modified: 3,
            deleted: 0
          }
        ],
        topComponents: [
          {
            name: 'App',
            usageCount: 15,
            complexity: 5,
            trend: 'stable'
          },
          {
            name: 'UserProfile',
            usageCount: 8,
            complexity: 3,
            trend: 'up'
          }
        ]
      };

      await cacheService.set(cacheKey, statistics, 1800);

      res.json(statistics);
    })
  );

  return router;
}