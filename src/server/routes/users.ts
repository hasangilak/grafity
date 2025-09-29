import { Router } from 'express';
import { ConfigManager } from '../../config/ConfigManager';
import { SecurityManager } from '../../security/SecurityManager';
import { CacheService } from '../cache/service';
import { authMiddlewares, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

export function userRoutes(
  configManager: ConfigManager,
  securityManager: SecurityManager,
  cacheService: CacheService
): Router {
  const router = Router();

  router.use(authMiddlewares.required(securityManager));

  // GET /api/users/profile - Get current user profile
  router.get('/profile',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const profile = {
        id: user.user.id,
        username: user.user.username,
        email: user.user.email,
        roles: user.user.roles,
        preferences: user.user.preferences || {},
        stats: {
          projectsCreated: 5,
          analysesRun: 23,
          patternsDetected: 156
        }
      };

      res.json(profile);
    })
  );

  // PUT /api/users/profile - Update user profile
  router.put('/profile',
    validateRequest({
      body: {
        type: 'object',
        properties: {
          preferences: { type: 'object' },
          settings: { type: 'object' }
        }
      }
    }),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { preferences, settings } = req.body;
      const userId = req.user?.user.id;

      // TODO: Implement actual profile update
      res.json({ message: 'Profile updated successfully' });
    })
  );

  // GET /api/users - List users (admin only)
  router.get('/',
    authMiddlewares.roles(securityManager, ['admin']),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      // TODO: Implement user listing for admins
      res.json({ users: [], totalCount: 0 });
    })
  );

  return router;
}