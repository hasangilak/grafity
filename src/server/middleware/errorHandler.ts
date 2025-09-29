import { Request, Response, NextFunction } from 'express';
import { ErrorRecovery } from '../../recovery/ErrorRecovery';
import { MonitoringService } from '../monitoring/service';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export function errorHandler(
  errorRecovery: ErrorRecovery,
  monitoringService: MonitoringService
) {
  return async (error: ApiError, req: Request, res: Response, next: NextFunction) => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    // Record error in monitoring service
    monitoringService.recordError(error, {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.user?.id
    });

    // Determine if error is operational (expected) or programming error
    const isOperational = error.isOperational ||
                         error.statusCode ||
                         error.name === 'ValidationError' ||
                         error.name === 'UnauthorizedError' ||
                         error.name === 'ForbiddenError';

    // Try error recovery for non-operational errors
    if (!isOperational) {
      try {
        const recoveryResult = await errorRecovery.executeWithRecovery(
          async () => {
            throw error; // Re-throw to trigger recovery
          },
          `api_${req.method}_${req.path}`,
          {
            maxAttempts: 1, // Don't retry API requests
            enableFallback: true,
            enableCircuitBreaker: false
          }
        );

        if (recoveryResult) {
          console.log('Error recovery successful for API request');
        }
      } catch (recoveryError) {
        console.error('Error recovery failed:', recoveryError);
      }
    }

    // Determine response status code
    const statusCode = error.statusCode || 500;

    // Create error response based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    const errorResponse: any = {
      error: error.message || 'An error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    };

    // Add error details in development
    if (isDevelopment) {
      errorResponse.stack = error.stack;
      errorResponse.details = error.details;
    }

    // Add request ID if available
    if ((req as any).id) {
      errorResponse.requestId = (req as any).id;
    }

    // Handle specific error types
    switch (error.name) {
      case 'ValidationError':
        errorResponse.error = 'Validation failed';
        errorResponse.details = error.details || error.message;
        break;

      case 'UnauthorizedError':
        errorResponse.error = 'Authentication required';
        break;

      case 'ForbiddenError':
        errorResponse.error = 'Access denied';
        break;

      case 'NotFoundError':
        errorResponse.error = 'Resource not found';
        break;

      case 'ConflictError':
        errorResponse.error = 'Resource conflict';
        break;

      case 'RateLimitError':
        errorResponse.error = 'Rate limit exceeded';
        if (error.details?.retryAfter) {
          res.set('Retry-After', error.details.retryAfter.toString());
        }
        break;

      case 'ServiceUnavailableError':
        errorResponse.error = 'Service temporarily unavailable';
        break;

      default:
        if (isProduction && statusCode >= 500) {
          errorResponse.error = 'Internal server error';
          errorResponse.code = 'INTERNAL_ERROR';
          // Don't expose internal error details in production
          delete errorResponse.details;
          delete errorResponse.stack;
        }
    }

    // Set appropriate headers
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json');

    // Add security headers for error responses
    if (statusCode >= 400) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Send error response
    res.json(errorResponse);

    // Log error (different levels based on severity)
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode,
        stack: error.stack
      },
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      },
      user: (req as any).user?.user?.id || 'anonymous'
    };

    if (statusCode >= 500) {
      console.error('Server error:', logData);
    } else if (statusCode >= 400) {
      console.warn('Client error:', logData);
    }

    // Don't call next() as we've handled the error
  };
}

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  isOperational = true;

  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  isOperational = true;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';
  isOperational = true;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  isOperational = true;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  isOperational = true;

  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  isOperational = true;

  constructor(message: string = 'Rate limit exceeded', public details?: { retryAfter?: number }) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  code = 'SERVICE_UNAVAILABLE';
  isOperational = true;

  constructor(message: string = 'Service temporarily unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class InternalServerError extends Error {
  statusCode = 500;
  code = 'INTERNAL_ERROR';
  isOperational = false;

  constructor(message: string = 'Internal server error', public details?: any) {
    super(message);
    this.name = 'InternalServerError';
  }
}

// Helper function to create API errors
export function createApiError(
  statusCode: number,
  message: string,
  code?: string,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code || `HTTP_${statusCode}`;
  error.details = details;
  error.isOperational = statusCode < 500;

  return error;
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}