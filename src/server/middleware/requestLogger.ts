import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MonitoringService } from '../monitoring/service';

export interface RequestContext {
  id: string;
  startTime: number;
  user?: {
    id: string;
    username: string;
  };
}

export interface ExtendedRequest extends Request {
  id: string;
  startTime: number;
  context: RequestContext;
}

export function requestLogger(monitoringService: MonitoringService) {
  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    // Generate unique request ID
    const requestId = uuidv4();
    const startTime = Date.now();

    // Attach context to request
    req.id = requestId;
    req.startTime = startTime;
    req.context = {
      id: requestId,
      startTime,
      user: (req as any).user?.user ? {
        id: (req as any).user.user.id,
        username: (req as any).user.user.username
      } : undefined
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);

    // Log request start
    const requestInfo = {
      id: requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      timestamp: new Date().toISOString(),
      user: req.context.user
    };

    console.log(`→ ${req.method} ${req.path}`, {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      user: req.context.user?.username || 'anonymous'
    });

    // Capture response finish event
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;
    let responseSize = 0;

    // Override res.send to capture response
    res.send = function(body: any) {
      responseBody = body;
      responseSize = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body || '', 'utf8');
      return originalSend.call(this, body);
    };

    // Override res.json to capture response
    res.json = function(obj: any) {
      responseBody = obj;
      const jsonString = JSON.stringify(obj);
      responseSize = Buffer.byteLength(jsonString, 'utf8');
      return originalJson.call(this, obj);
    };

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      const responseInfo = {
        id: requestId,
        statusCode,
        duration,
        responseSize,
        timestamp: new Date().toISOString()
      };

      // Determine log level based on status code and duration
      const isError = statusCode >= 400;
      const isSlow = duration > 5000; // 5 seconds
      const isVeryLarge = responseSize > 1024 * 1024; // 1MB

      let logLevel = 'info';
      if (isError) {
        logLevel = statusCode >= 500 ? 'error' : 'warn';
      } else if (isSlow || isVeryLarge) {
        logLevel = 'warn';
      }

      const logMessage = `← ${req.method} ${req.path} ${statusCode} ${duration}ms`;
      const logData = {
        request: requestInfo,
        response: responseInfo,
        performance: {
          duration,
          slow: isSlow,
          large: isVeryLarge
        }
      };

      // Console log with appropriate level
      const logEmoji = getLogEmoji(statusCode);
      const durationColor = duration > 1000 ? '🐌' : duration > 500 ? '⚠️' : '⚡';

      console.log(`${logEmoji} ${req.method} ${req.path} ${statusCode} ${durationColor}${duration}ms`, {
        requestId,
        user: req.context.user?.username || 'anonymous',
        size: formatBytes(responseSize)
      });

      // Record metrics in monitoring service
      monitoringService.recordHttpRequest({
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        requestSize: parseInt(req.get('Content-Length') || '0'),
        responseSize,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.context.user?.id,
        timestamp: new Date(startTime)
      });

      // Record slow requests
      if (isSlow) {
        monitoringService.recordSlowRequest({
          id: requestId,
          method: req.method,
          path: req.path,
          duration,
          threshold: 5000,
          user: req.context.user
        });
      }

      // Record errors
      if (isError) {
        const errorDetails = {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          responseBody: statusCode >= 500 ? responseBody : undefined,
          user: req.context.user
        };

        if (statusCode >= 500) {
          monitoringService.recordError(new Error(`HTTP ${statusCode}: ${req.method} ${req.path}`), errorDetails);
        }
      }
    });

    // Handle connection errors
    res.on('error', (error) => {
      console.error(`✘ ${req.method} ${req.path} connection error:`, error);

      monitoringService.recordError(error, {
        requestId,
        method: req.method,
        path: req.path,
        type: 'connection_error',
        user: req.context.user
      });
    });

    // Handle client disconnect
    req.on('close', () => {
      if (!res.finished) {
        const duration = Date.now() - startTime;
        console.warn(`🔌 ${req.method} ${req.path} client disconnected after ${duration}ms`);

        monitoringService.recordEvent('client_disconnect', {
          requestId,
          method: req.method,
          path: req.path,
          duration,
          user: req.context.user
        });
      }
    });

    next();
  };
}

// Helper function to get appropriate emoji for status code
function getLogEmoji(statusCode: number): string {
  if (statusCode >= 500) return '💥'; // Server error
  if (statusCode >= 400) return '❌'; // Client error
  if (statusCode >= 300) return '↩️'; // Redirect
  if (statusCode >= 200) return '✅'; // Success
  return '❓'; // Unknown
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Middleware to log request body (for debugging)
export function requestBodyLogger(options: {
  maxSize?: number;
  excludePaths?: string[];
  excludeMethods?: string[];
} = {}) {
  const {
    maxSize = 1024, // 1KB
    excludePaths = ['/auth/login', '/auth/register'], // Don't log sensitive endpoints
    excludeMethods = ['GET', 'HEAD', 'OPTIONS']
  } = options;

  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    // Skip logging for excluded paths or methods
    if (excludePaths.some(path => req.path.includes(path)) ||
        excludeMethods.includes(req.method)) {
      return next();
    }

    // Only log if body exists and is not too large
    if (req.body && typeof req.body === 'object') {
      try {
        const bodyString = JSON.stringify(req.body);
        if (bodyString.length <= maxSize) {
          console.log(`📦 Request body for ${req.id}:`, req.body);
        } else {
          console.log(`📦 Request body for ${req.id}: [${formatBytes(bodyString.length)} - truncated]`);
        }
      } catch (error) {
        console.log(`📦 Request body for ${req.id}: [serialization error]`);
      }
    }

    next();
  };
}

// Middleware to add correlation ID from header
export function correlationId(headerName: string = 'X-Correlation-ID') {
  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const correlationId = req.get(headerName);

    if (correlationId) {
      req.context = req.context || {} as RequestContext;
      (req.context as any).correlationId = correlationId;
      res.setHeader(headerName, correlationId);
    }

    next();
  };
}

// Middleware to track API usage
export function apiUsageTracker(monitoringService: MonitoringService) {
  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    // Track API endpoint usage
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const userId = req.context?.user?.id;

    res.on('finish', () => {
      monitoringService.recordApiUsage({
        endpoint,
        userId,
        statusCode: res.statusCode,
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    });

    next();
  };
}

export default requestLogger;