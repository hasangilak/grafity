import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createUserRateLimiter } from '../middleware/auth';

// Import route modules
import { projectRoutes } from './projects';
import { analysisRoutes } from './analysis';
import { patternRoutes } from './patterns';
import { componentRoutes } from './components';
import { metricsRoutes } from './metrics';
import { searchRoutes } from './search';
import { userRoutes } from './users';
import { systemRoutes } from './system';

export function apiRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  // Apply rate limiting to all API routes
  const apiRateLimit = createUserRateLimiter(
    15 * 60 * 1000, // 15 minutes
    1000 // 1000 requests per window
  );
  router.use(apiRateLimit);

  // API version endpoint (public)
  router.get('/version', (req, res) => {
    res.json({
      version: process.env.npm_package_version || '1.0.0',
      api: 'v1',
      build: process.env.BUILD_NUMBER || 'dev',
      timestamp: new Date().toISOString()
    });
  });

  // Current user info (requires authentication)
  router.get('/me',
    authMiddlewares.required(securityManager),
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        res.json({
          user: {
            id: user.user.id,
            username: user.user.username,
            email: user.user.email,
            roles: user.user.roles,
            permissions: user.permissions,
            lastActivity: user.user.lastActivity,
            preferences: user.user.preferences || {}
          },
          session: {
            issuedAt: user.issuedAt,
            expiresAt: user.expiresAt,
            tokenType: user.tokenType
          }
        });
      } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user information' });
      }
    }
  );

  // Authentication routes (public, but some require current auth)
  router.post('/auth/login',
    validateRequest({
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          provider: { type: 'string', enum: ['local', 'oauth', 'ldap'] },
          rememberMe: { type: 'boolean' }
        }
      }
    }),
    async (req, res) => {
      try {
        const { username, password, provider = 'local', rememberMe = false } = req.body;

        const authResult = await securityManager.authenticate({
          username,
          password,
          provider,
          rememberMe
        });

        if (!authResult.success) {
          return res.status(401).json({
            error: 'Authentication failed',
            code: authResult.error?.code || 'AUTH_FAILED'
          });
        }

        // Set HTTP-only cookie for web clients
        if (authResult.refreshToken) {
          res.cookie('refreshToken', authResult.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }

        res.json({
          accessToken: authResult.accessToken,
          user: authResult.user,
          expiresAt: authResult.expiresAt
        });

      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Authentication service error' });
      }
    }
  );

  router.post('/auth/refresh',
    async (req, res) => {
      try {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
          return res.status(401).json({
            error: 'Refresh token required',
            code: 'MISSING_REFRESH_TOKEN'
          });
        }

        const authResult = await securityManager.refreshToken(refreshToken);

        if (!authResult.success) {
          return res.status(401).json({
            error: 'Token refresh failed',
            code: authResult.error?.code || 'REFRESH_FAILED'
          });
        }

        // Update refresh token cookie
        if (authResult.refreshToken) {
          res.cookie('refreshToken', authResult.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
          });
        }

        res.json({
          accessToken: authResult.accessToken,
          expiresAt: authResult.expiresAt
        });

      } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Token refresh service error' });
      }
    }
  );

  router.post('/auth/logout',
    authMiddlewares.required(securityManager),
    async (req: AuthenticatedRequest, res) => {
      try {
        const token = req.authToken;
        if (token) {
          await securityManager.revokeToken(token);
        }

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        res.json({ message: 'Logged out successfully' });

      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout service error' });
      }
    }
  );

  // Mount feature-specific route modules
  router.use('/projects', projectRoutes(configManager, securityManager, cacheService));
  router.use('/analysis', analysisRoutes(configManager, securityManager, cacheService));
  router.use('/patterns', patternRoutes(configManager, securityManager, cacheService));
  router.use('/components', componentRoutes(configManager, securityManager, cacheService));
  router.use('/metrics', metricsRoutes(configManager, securityManager, cacheService));
  router.use('/search', searchRoutes(configManager, securityManager, cacheService));
  router.use('/users', userRoutes(configManager, securityManager, cacheService));
  router.use('/system', systemRoutes(configManager, securityManager, cacheService));

  // Configuration endpoints (admin only)
  router.get('/config',
    authMiddlewares.admin(securityManager),
    async (req: AuthenticatedRequest, res) => {
      try {
        const publicConfig = configManager.getPublicConfig();
        res.json(publicConfig);
      } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
      }
    }
  );

  router.put('/config',
    authMiddlewares.admin(securityManager),
    validateRequest({
      body: {
        type: 'object',
        properties: {
          key: { type: 'string', minLength: 1 },
          value: {}, // Any type
          source: { type: 'string', enum: ['runtime', 'api'] }
        },
        required: ['key', 'value']
      }
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { key, value, source = 'api' } = req.body;

        await configManager.set(key, value, source);

        res.json({
          message: 'Configuration updated successfully',
          key,
          value
        });

      } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
      }
    }
  );

  // Cache management endpoints (admin only)
  router.get('/cache/stats',
    authMiddlewares.admin(securityManager),
    async (req: AuthenticatedRequest, res) => {
      try {
        const stats = await cacheService.getStats();
        res.json(stats);
      } catch (error) {
        console.error('Get cache stats error:', error);
        res.status(500).json({ error: 'Failed to get cache statistics' });
      }
    }
  );

  router.delete('/cache/clear',
    authMiddlewares.admin(securityManager),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { pattern } = req.query;

        if (pattern) {
          await cacheService.clearPattern(pattern as string);
        } else {
          await cacheService.clear();
        }

        res.json({
          message: pattern ? `Cache cleared for pattern: ${pattern}` : 'Cache cleared successfully'
        });

      } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
      }
    }
  );

  // Generic error handler for API routes
  router.use((error: any, req: any, res: any, next: any) => {
    console.error('API route error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    if (error.name === 'ForbiddenError') {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'FORBIDDEN'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  });

  return router;
}

// Helper function to create paginated response
export function createPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    data: items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage,
      hasPreviousPage
    }
  };
}

// Helper function to extract pagination parameters
export function extractPagination(query: any) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

// Helper function to extract sort parameters
export function extractSort(query: any, allowedFields: string[] = []) {
  const sortBy = query.sortBy;
  const sortOrder = query.sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  if (!sortBy || !allowedFields.includes(sortBy)) {
    return null;
  }

  return { field: sortBy, order: sortOrder };
}