import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SecurityManager } from '../../security/SecurityManager';
import { AuthContext } from '../../security/types';

export interface AuthenticatedRequest extends Request {
  user?: AuthContext;
  authToken?: string;
}

export interface AuthMiddlewareOptions {
  required?: boolean;
  permissions?: string[];
  roles?: string[];
  skipPaths?: string[];
}

export function authMiddleware(
  securityManager: SecurityManager,
  options: AuthMiddlewareOptions = {}
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        required = false,
        permissions = [],
        roles = [],
        skipPaths = ['/health', '/docs']
      } = options;

      // Skip authentication for certain paths
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      let token: string | null = null;

      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        } else if (authHeader.startsWith('Token ')) {
          token = authHeader.substring(6);
        }
      }

      // Check for token in cookie as fallback
      if (!token && req.cookies?.authToken) {
        token = req.cookies.authToken;
      }

      // Check for token in query parameter (for WebSocket upgrades)
      if (!token && req.query?.token) {
        token = req.query.token as string;
      }

      if (!token) {
        if (required) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'MISSING_TOKEN'
          });
        }
        return next();
      }

      try {
        // Validate token with security manager
        const authContext = await securityManager.validateToken(token);

        if (!authContext) {
          if (required) {
            return res.status(401).json({
              error: 'Invalid or expired token',
              code: 'INVALID_TOKEN'
            });
          }
          return next();
        }

        // Check if user is active
        if (!authContext.user.isActive) {
          return res.status(401).json({
            error: 'Account is inactive',
            code: 'INACTIVE_ACCOUNT'
          });
        }

        // Check required roles
        if (roles.length > 0) {
          const hasRequiredRole = roles.some(role =>
            authContext.user.roles.includes(role)
          );

          if (!hasRequiredRole) {
            return res.status(403).json({
              error: 'Insufficient role permissions',
              code: 'INSUFFICIENT_ROLE',
              required: roles,
              current: authContext.user.roles
            });
          }
        }

        // Check required permissions
        if (permissions.length > 0) {
          const hasAllPermissions = await Promise.all(
            permissions.map(permission =>
              securityManager.checkPermission(
                authContext,
                'api',
                permission
              )
            )
          );

          if (!hasAllPermissions.every(Boolean)) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              code: 'INSUFFICIENT_PERMISSIONS',
              required: permissions
            });
          }
        }

        // Attach user context to request
        req.user = authContext;
        req.authToken = token;

        // Update last activity
        await securityManager.updateLastActivity(authContext.user.id);

        next();

      } catch (tokenError) {
        console.error('Token validation error:', tokenError);

        if (required) {
          return res.status(401).json({
            error: 'Token validation failed',
            code: 'TOKEN_VALIDATION_ERROR'
          });
        }

        next();
      }

    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };
}

// Middleware factory for different protection levels
export const authMiddlewares = {
  // Public endpoints - no authentication required
  public: () => authMiddleware(undefined as any, { required: false }),

  // Optional authentication - user info available if token provided
  optional: (securityManager: SecurityManager) =>
    authMiddleware(securityManager, { required: false }),

  // Required authentication
  required: (securityManager: SecurityManager) =>
    authMiddleware(securityManager, { required: true }),

  // Admin only
  admin: (securityManager: SecurityManager) =>
    authMiddleware(securityManager, {
      required: true,
      roles: ['admin']
    }),

  // Specific roles
  roles: (securityManager: SecurityManager, roles: string[]) =>
    authMiddleware(securityManager, {
      required: true,
      roles
    }),

  // Specific permissions
  permissions: (securityManager: SecurityManager, permissions: string[]) =>
    authMiddleware(securityManager, {
      required: true,
      permissions
    }),

  // Combined roles and permissions
  rolesAndPermissions: (
    securityManager: SecurityManager,
    roles: string[],
    permissions: string[]
  ) => authMiddleware(securityManager, {
    required: true,
    roles,
    permissions
  })
};

// Utility function to extract user from request
export function getAuthenticatedUser(req: AuthenticatedRequest): AuthContext | null {
  return req.user || null;
}

// Utility function to check if user has specific permission
export async function requirePermission(
  req: AuthenticatedRequest,
  res: Response,
  securityManager: SecurityManager,
  resource: string,
  action: string
): Promise<boolean> {
  const user = getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_AUTH'
    });
    return false;
  }

  const hasPermission = await securityManager.checkPermission(
    user,
    resource,
    action
  );

  if (!hasPermission) {
    res.status(403).json({
      error: 'Permission denied',
      code: 'PERMISSION_DENIED',
      resource,
      action
    });
    return false;
  }

  return true;
}

// Utility function to check if user has specific role
export function requireRole(
  req: AuthenticatedRequest,
  res: Response,
  role: string
): boolean {
  const user = getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_AUTH'
    });
    return false;
  }

  if (!user.user.roles.includes(role)) {
    res.status(403).json({
      error: 'Role required',
      code: 'ROLE_REQUIRED',
      required: role,
      current: user.user.roles
    });
    return false;
  }

  return true;
}

// WebSocket authentication helper
export async function authenticateSocket(
  socket: any,
  securityManager: SecurityManager
): Promise<AuthContext | null> {
  try {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.query?.token ||
                  socket.request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    const authContext = await securityManager.validateToken(token);
    return authContext;

  } catch (error) {
    console.error('Socket authentication error:', error);
    return null;
  }
}

// Rate limiting by user
export function createUserRateLimiter(
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
) {
  const userLimits = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.user.id || req.ip;
    const now = Date.now();

    let userLimit = userLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userLimit = {
        count: 0,
        resetTime: now + windowMs
      };
      userLimits.set(userId, userLimit);
    }

    userLimit.count++;

    if (userLimit.count > maxRequests) {
      const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000);

      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: remainingTime
      });
      return;
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - userLimit.count).toString(),
      'X-RateLimit-Reset': new Date(userLimit.resetTime).toISOString()
    });

    next();
  };
}

export default authMiddleware;