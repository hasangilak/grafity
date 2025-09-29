import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { extractPagination, createPaginatedResponse } from './api';
import { asyncHandler } from '../middleware/errorHandler';

export function patternRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  // All pattern routes require authentication
  router.use(authMiddlewares.required(securityManager));

  // GET /api/patterns - List all patterns with filtering
  router.get('/',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          type: {
            type: 'string',
            enum: ['good_pattern', 'anti_pattern', 'design_pattern', 'architectural_pattern']
          },
          category: {
            type: 'string',
            enum: ['component', 'hook', 'state', 'performance', 'security', 'testing']
          },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          projectId: { type: 'string' },
          search: { type: 'string', minLength: 1, maxLength: 100 }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { page, limit, offset } = extractPagination(req.query);
      const { type, category, severity, projectId, search } = req.query as any;

      const cacheKey = `patterns:list:${JSON.stringify({ page, limit, type, category, severity, projectId, search })}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual pattern fetching from pattern analyzer
      const mockPatterns = [
        {
          id: 'pattern_1',
          name: 'Custom Hook Pattern',
          type: 'good_pattern',
          category: 'hook',
          description: 'Well-structured custom hook for state management',
          confidence: 95,
          severity: null,
          examples: [
            {
              file: 'src/hooks/useUserData.ts',
              line: 5,
              code: 'export const useUserData = () => { ... }'
            }
          ],
          metrics: {
            occurrences: 8,
            complexity: 'low',
            maintainability: 'high'
          },
          recommendations: [
            'Good separation of concerns',
            'Follows React hooks best practices'
          ],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'pattern_2',
          name: 'Prop Drilling',
          type: 'anti_pattern',
          category: 'component',
          description: 'Props are being passed through multiple component layers unnecessarily',
          confidence: 87,
          severity: 'medium',
          examples: [
            {
              file: 'src/components/UserProfile.tsx',
              line: 25,
              code: '<UserDetails user={user} theme={theme} />'
            }
          ],
          metrics: {
            occurrences: 3,
            depth: 4,
            affectedComponents: 7
          },
          recommendations: [
            'Consider using Context API',
            'Implement state management library',
            'Use component composition'
          ],
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-12')
        }
      ];

      // Apply filters
      let filteredPatterns = mockPatterns.filter(pattern => {
        if (type && pattern.type !== type) return false;
        if (category && pattern.category !== category) return false;
        if (severity && pattern.severity !== severity) return false;
        if (search && !pattern.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      const totalCount = filteredPatterns.length;
      const paginatedPatterns = filteredPatterns.slice(offset, offset + limit);

      const result = createPaginatedResponse(paginatedPatterns, totalCount, page, limit);

      await cacheService.set(cacheKey, result, 600);

      res.json(result);
    })
  );

  // POST /api/patterns/detect - Detect patterns in code
  router.post('/detect',
    authMiddlewares.permissions(securityManager, ['pattern:detect']),
    validateRequest({
      body: {
        type: 'object',
        required: ['target'],
        properties: {
          target: {
            type: 'object',
            oneOf: [
              {
                required: ['code', 'language'],
                properties: {
                  code: { type: 'string', minLength: 1 },
                  language: { type: 'string', enum: ['typescript', 'javascript', 'tsx', 'jsx'] }
                }
              },
              {
                required: ['projectId'],
                properties: {
                  projectId: { type: 'string', minLength: 1 }
                }
              },
              {
                required: ['filePath'],
                properties: {
                  filePath: { type: 'string', minLength: 1 },
                  projectId: { type: 'string' }
                }
              }
            ]
          },
          options: {
            type: 'object',
            properties: {
              includeGoodPatterns: { type: 'boolean', default: true },
              includeAntiPatterns: { type: 'boolean', default: true },
              minConfidence: { type: 'number', minimum: 0, maximum: 100, default: 70 },
              categories: {
                type: 'array',
                items: { type: 'string', enum: ['component', 'hook', 'state', 'performance', 'security', 'testing'] }
              }
            }
          }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { target, options = {} } = req.body;

      // Generate cache key based on target
      const targetHash = require('crypto').createHash('md5').update(JSON.stringify(target)).digest('hex');
      const cacheKey = `patterns:detect:${targetHash}:${JSON.stringify(options)}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual pattern detection using pattern analyzer
      const detectionResult = {
        id: `detection_${Date.now()}`,
        target,
        timestamp: new Date(),
        options,
        summary: {
          totalPatterns: 5,
          goodPatterns: 3,
          antiPatterns: 2,
          highConfidence: 4,
          mediumConfidence: 1
        },
        patterns: [
          {
            id: 'detected_1',
            name: 'React.memo Usage',
            type: 'good_pattern',
            category: 'performance',
            confidence: 92,
            location: {
              file: target.filePath || 'inline',
              line: 15,
              column: 5,
              length: 45
            },
            description: 'Component is properly memoized to prevent unnecessary re-renders',
            impact: 'positive',
            severity: null
          },
          {
            id: 'detected_2',
            name: 'Inline Object Creation',
            type: 'anti_pattern',
            category: 'performance',
            confidence: 85,
            severity: 'medium',
            location: {
              file: target.filePath || 'inline',
              line: 32,
              column: 12,
              length: 23
            },
            description: 'Objects created inline in JSX can cause unnecessary re-renders',
            impact: 'negative',
            suggestion: 'Move object creation outside render or use useMemo'
          }
        ],
        recommendations: [
          {
            type: 'optimization',
            priority: 'high',
            message: 'Address inline object creation to improve performance',
            estimatedImpact: 'medium'
          }
        ],
        metrics: {
          analysisTime: 1250,
          codeComplexity: 'medium',
          maintainabilityScore: 78
        }
      };

      await cacheService.set(cacheKey, detectionResult, 1800);

      res.json(detectionResult);
    })
  );

  // GET /api/patterns/:id - Get specific pattern details
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

      const cacheKey = `pattern:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual pattern fetching
      if (id === 'pattern_1') {
        const pattern = {
          id: 'pattern_1',
          name: 'Custom Hook Pattern',
          type: 'good_pattern',
          category: 'hook',
          description: 'A well-structured custom hook that encapsulates stateful logic',
          confidence: 95,
          documentation: {
            overview: 'Custom hooks allow you to extract component logic into reusable functions...',
            benefits: [
              'Reusable stateful logic',
              'Separation of concerns',
              'Easier testing'
            ],
            bestPractices: [
              'Start hook names with "use"',
              'Keep hooks focused on single responsibility',
              'Return consistent data structures'
            ],
            examples: [
              {
                title: 'Basic Custom Hook',
                code: `function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);

  return { count, increment, decrement, reset };
}`
              }
            ]
          },
          detection: {
            rules: [
              'Function name starts with "use"',
              'Uses React hooks internally',
              'Returns state and state modifiers'
            ],
            complexity: 'medium',
            accuracy: 95
          },
          occurrences: [
            {
              project: 'sample-react-app',
              file: 'src/hooks/useUserData.ts',
              line: 5,
              confidence: 98
            },
            {
              project: 'sample-react-app',
              file: 'src/hooks/useTheme.ts',
              line: 8,
              confidence: 92
            }
          ],
          relatedPatterns: [
            {
              id: 'pattern_3',
              name: 'Hook Composition',
              relationship: 'extends'
            }
          ],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        };

        await cacheService.set(cacheKey, pattern, 3600);
        res.json(pattern);
      } else {
        res.status(404).json({ error: 'Pattern not found' });
      }
    })
  );

  // POST /api/patterns/custom - Create custom pattern definition
  router.post('/custom',
    authMiddlewares.permissions(securityManager, ['pattern:create']),
    validateRequest({
      body: {
        type: 'object',
        required: ['name', 'type', 'category', 'rules'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          type: { type: 'string', enum: ['good_pattern', 'anti_pattern', 'design_pattern'] },
          category: { type: 'string', enum: ['component', 'hook', 'state', 'performance', 'security', 'testing'] },
          description: { type: 'string', maxLength: 500 },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['condition', 'weight'],
              properties: {
                condition: { type: 'string', minLength: 1 },
                weight: { type: 'number', minimum: 0, maximum: 1 },
                description: { type: 'string' }
              }
            },
            minItems: 1
          },
          examples: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', minLength: 1 },
                description: { type: 'string' },
                language: { type: 'string', default: 'typescript' }
              }
            }
          }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { name, type, category, description, rules, examples } = req.body;
      const userId = req.user?.user.id;

      // TODO: Implement custom pattern creation
      const customPattern = {
        id: `custom_pattern_${Date.now()}`,
        name,
        type,
        category,
        description,
        rules,
        examples: examples || [],
        isCustom: true,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };

      res.status(201).json({
        message: 'Custom pattern created successfully',
        pattern: customPattern
      });
    })
  );

  // GET /api/patterns/statistics - Get pattern statistics
  router.get('/statistics',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          timeRange: {
            type: 'string',
            enum: ['day', 'week', 'month', 'quarter', 'year'],
            default: 'month'
          },
          groupBy: {
            type: 'string',
            enum: ['type', 'category', 'severity', 'date'],
            default: 'type'
          }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { projectId, timeRange, groupBy } = req.query as any;

      const cacheKey = `patterns:stats:${projectId}:${timeRange}:${groupBy}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement actual statistics calculation
      const statistics = {
        timeRange,
        projectId,
        summary: {
          totalPatterns: 47,
          goodPatterns: 32,
          antiPatterns: 15,
          averageConfidence: 84.2,
          trendsUp: 5,
          trendsDown: 2
        },
        breakdown: {
          byType: {
            good_pattern: 32,
            anti_pattern: 15
          },
          byCategory: {
            component: 18,
            hook: 12,
            state: 8,
            performance: 6,
            security: 2,
            testing: 1
          },
          bySeverity: {
            low: 5,
            medium: 8,
            high: 2,
            critical: 0
          }
        },
        trends: [
          {
            date: '2024-01-01',
            goodPatterns: 28,
            antiPatterns: 12
          },
          {
            date: '2024-01-08',
            goodPatterns: 30,
            antiPatterns: 14
          },
          {
            date: '2024-01-15',
            goodPatterns: 32,
            antiPatterns: 15
          }
        ],
        topPatterns: [
          {
            name: 'Custom Hook Pattern',
            occurrences: 8,
            trend: 'up'
          },
          {
            name: 'React.memo Usage',
            occurrences: 6,
            trend: 'stable'
          },
          {
            name: 'Prop Drilling',
            occurrences: 3,
            trend: 'down'
          }
        ]
      };

      await cacheService.set(cacheKey, statistics, 1800);

      res.json(statistics);
    })
  );

  // POST /api/patterns/:id/validate - Validate pattern against code
  router.post('/:id/validate',
    authMiddlewares.permissions(securityManager, ['pattern:validate']),
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
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 1 },
          language: { type: 'string', enum: ['typescript', 'javascript', 'tsx', 'jsx'], default: 'typescript' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const { code, language } = req.body;

      const codeHash = require('crypto').createHash('md5').update(code).digest('hex');
      const cacheKey = `pattern:validate:${id}:${codeHash}`;

      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // TODO: Implement pattern validation against code
      const validation = {
        patternId: id,
        code: code.substring(0, 200) + '...', // Truncate for response
        language,
        result: {
          matches: true,
          confidence: 87,
          score: 8.7,
          matchedRules: [
            {
              rule: 'Function name starts with "use"',
              weight: 0.3,
              matched: true
            },
            {
              rule: 'Uses React hooks internally',
              weight: 0.4,
              matched: true
            },
            {
              rule: 'Returns state and state modifiers',
              weight: 0.3,
              matched: true
            }
          ],
          suggestions: [
            'Consider adding TypeScript types for better type safety',
            'Add JSDoc comments for better documentation'
          ]
        },
        timestamp: new Date()
      };

      await cacheService.set(cacheKey, validation, 1800);

      res.json(validation);
    })
  );

  return router;
}