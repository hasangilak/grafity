import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

export function metricsRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  router.use(authMiddlewares.required(securityManager));

  // GET /api/metrics/overview - Get metrics overview
  router.get('/overview',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          timeRange: { type: 'string', enum: ['day', 'week', 'month', 'quarter'], default: 'week' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { projectId, timeRange } = req.query as any;

      const cacheKey = `metrics:overview:${projectId}:${timeRange}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const metrics = {
        projectId,
        timeRange,
        codeQuality: {
          overall: 82.5,
          complexity: 4.2,
          maintainability: 78.3,
          testability: 85.7,
          trends: { week: +2.1, month: +5.3 }
        },
        performance: {
          overall: 88.2,
          bundleSize: 245.8, // KB
          loadTime: 1.2, // seconds
          renderTime: 0.8, // seconds
          trends: { week: +1.5, month: -0.3 }
        },
        technical_debt: {
          score: 15.2, // hours
          issues: 23,
          critical: 2,
          high: 5,
          trends: { week: -1.2, month: -3.8 }
        },
        test_coverage: {
          overall: 78.5,
          unit: 82.3,
          integration: 65.7,
          e2e: 45.2,
          trends: { week: +0.8, month: +4.2 }
        }
      };

      await cacheService.set(cacheKey, metrics, 600);
      res.json(metrics);
    })
  );

  // GET /api/metrics/complexity - Get complexity metrics
  router.get('/complexity',
    validateRequest({
      query: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          type: { type: 'string', enum: ['cyclomatic', 'cognitive', 'maintainability'] }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { projectId, type } = req.query as any;

      const complexity = {
        projectId,
        type: type || 'all',
        cyclomatic: {
          average: 4.2,
          max: 15,
          distribution: { low: 65, medium: 28, high: 7 }
        },
        cognitive: {
          average: 6.8,
          max: 22,
          distribution: { low: 58, medium: 32, high: 10 }
        },
        maintainability: {
          average: 78.3,
          min: 45,
          distribution: { good: 72, acceptable: 23, poor: 5 }
        },
        hotspots: [
          { file: 'src/utils/complex-helper.ts', score: 15, type: 'cyclomatic' },
          { file: 'src/components/DataTable.tsx', score: 22, type: 'cognitive' }
        ]
      };

      res.json(complexity);
    })
  );

  return router;
}