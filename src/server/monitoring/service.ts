import { EventEmitter } from 'events';
import { PerformanceMonitor } from '../../monitoring/PerformanceMonitor';

export interface HttpRequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  timestamp: Date;
}

export interface SlowRequestMetrics {
  id: string;
  method: string;
  path: string;
  duration: number;
  threshold: number;
  user?: {
    id: string;
    username: string;
  };
}

export interface ApiUsageMetrics {
  endpoint: string;
  userId?: string;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface ErrorMetrics {
  error: Error;
  context?: any;
  userId?: string;
  requestId?: string;
  timestamp: Date;
}

export interface SystemMetrics {
  timestamp: Date;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  uptime: number;
  connections: {
    active: number;
    total: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
  };
  database: {
    connections: number;
    queries: number;
    slowQueries: number;
  };
}

export interface MonitoringStats {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    slowRequests: number;
  };
  errors: {
    total: number;
    recent: number; // Last hour
    categories: Record<string, number>;
  };
  users: {
    activeUsers: number;
    totalSessions: number;
    averageSessionDuration: number;
  };
  system: SystemMetrics;
  uptime: number;
  version: string;
}

export class MonitoringService extends EventEmitter {
  private performanceMonitor: PerformanceMonitor;
  private httpRequests: HttpRequestMetrics[] = [];
  private slowRequests: SlowRequestMetrics[] = [];
  private apiUsage: ApiUsageMetrics[] = [];
  private errors: ErrorMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private activeSessions: Map<string, { startTime: Date; lastActivity: Date }> = new Map();
  private startTime: Date = new Date();

  // Configuration
  private maxStoredMetrics = 10000;
  private slowRequestThreshold = 5000; // 5 seconds
  private metricsRetentionTime = 24 * 60 * 60 * 1000; // 24 hours
  private systemMetricsInterval = 60000; // 1 minute
  private cleanupInterval = 60 * 60 * 1000; // 1 hour

  private systemMetricsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing monitoring service...');

    // Initialize performance monitor
    this.performanceMonitor.initialize();

    // Start system metrics collection
    this.startSystemMetricsCollection();

    // Start cleanup process
    this.startCleanupProcess();

    console.log('✅ Monitoring service initialized');
  }

  private startSystemMetricsCollection(): void {
    this.systemMetricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.systemMetricsInterval);

    // Collect initial metrics
    this.collectSystemMetrics();
  }

  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.cleanupInterval);
  }

  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memory: {
        used: memoryUsage.rss,
        total: require('os').totalmem(),
        percentage: (memoryUsage.rss / require('os').totalmem()) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: require('os').loadavg()
      },
      uptime: process.uptime(),
      connections: {
        active: this.activeSessions.size,
        total: this.httpRequests.length
      },
      cache: {
        hitRate: this.calculateCacheHitRate(),
        missRate: this.calculateCacheMissRate(),
        size: 0 // Would be provided by cache service
      },
      database: {
        connections: 0, // Would be provided by database service
        queries: 0,
        slowQueries: 0
      }
    };

    this.systemMetrics.push(metrics);

    // Emit system metrics event
    this.emit('system_metrics', metrics);

    // Keep only recent system metrics
    if (this.systemMetrics.length > 1440) { // 24 hours worth of minutes
      this.systemMetrics = this.systemMetrics.slice(-1440);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionTime);

    // Clean up old HTTP requests
    this.httpRequests = this.httpRequests.filter(req => req.timestamp > cutoffTime);

    // Clean up old slow requests
    this.slowRequests = this.slowRequests.filter(req => req.id.includes(cutoffTime.getTime().toString()) === false);

    // Clean up old API usage
    this.apiUsage = this.apiUsage.filter(usage => usage.timestamp > cutoffTime);

    // Clean up old errors
    this.errors = this.errors.filter(error => error.timestamp > cutoffTime);

    // Clean up inactive sessions
    const sessionCutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
    for (const [sessionId, session] of this.activeSessions) {
      if (session.lastActivity < sessionCutoff) {
        this.activeSessions.delete(sessionId);
      }
    }

    console.log(`🧹 Cleaned up old metrics (retention: ${this.metricsRetentionTime / 1000 / 60 / 60}h)`);
  }

  // Recording methods

  recordHttpRequest(metrics: HttpRequestMetrics): void {
    this.httpRequests.push(metrics);

    // Record in performance monitor
    this.performanceMonitor.recordHttpRequest(metrics);

    // Check if it's a slow request
    if (metrics.duration > this.slowRequestThreshold) {
      this.recordSlowRequest({
        id: `slow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method: metrics.method,
        path: metrics.path,
        duration: metrics.duration,
        threshold: this.slowRequestThreshold
      });
    }

    // Update session activity
    if (metrics.userId) {
      this.updateSessionActivity(metrics.userId);
    }

    // Keep only recent requests
    if (this.httpRequests.length > this.maxStoredMetrics) {
      this.httpRequests = this.httpRequests.slice(-this.maxStoredMetrics);
    }

    // Emit event
    this.emit('http_request', metrics);
  }

  recordSlowRequest(metrics: SlowRequestMetrics): void {
    this.slowRequests.push(metrics);

    console.warn(`🐌 Slow request detected: ${metrics.method} ${metrics.path} (${metrics.duration}ms)`);

    // Keep only recent slow requests
    if (this.slowRequests.length > 1000) {
      this.slowRequests = this.slowRequests.slice(-1000);
    }

    // Emit event
    this.emit('slow_request', metrics);
  }

  recordApiUsage(metrics: ApiUsageMetrics): void {
    this.apiUsage.push(metrics);

    // Keep only recent API usage
    if (this.apiUsage.length > this.maxStoredMetrics) {
      this.apiUsage = this.apiUsage.slice(-this.maxStoredMetrics);
    }

    // Emit event
    this.emit('api_usage', metrics);
  }

  recordError(error: Error, context?: any): void {
    const errorMetrics: ErrorMetrics = {
      error,
      context,
      userId: context?.userId,
      requestId: context?.requestId,
      timestamp: new Date()
    };

    this.errors.push(errorMetrics);

    console.error('📊 Error recorded:', {
      message: error.message,
      stack: error.stack,
      context
    });

    // Keep only recent errors
    if (this.errors.length > 5000) {
      this.errors = this.errors.slice(-5000);
    }

    // Emit event
    this.emit('error', errorMetrics);
  }

  recordEvent(eventName: string, data: any): void {
    this.emit('custom_event', {
      event: eventName,
      data,
      timestamp: new Date()
    });
  }

  // Session management

  private updateSessionActivity(userId: string): void {
    const session = this.activeSessions.get(userId);
    if (session) {
      session.lastActivity = new Date();
    } else {
      this.activeSessions.set(userId, {
        startTime: new Date(),
        lastActivity: new Date()
      });
    }
  }

  startSession(userId: string): void {
    this.activeSessions.set(userId, {
      startTime: new Date(),
      lastActivity: new Date()
    });

    this.emit('session_start', { userId, timestamp: new Date() });
  }

  endSession(userId: string): void {
    const session = this.activeSessions.get(userId);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      this.activeSessions.delete(userId);

      this.emit('session_end', {
        userId,
        duration,
        timestamp: new Date()
      });
    }
  }

  // Statistics and analytics

  getStats(): MonitoringStats {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Calculate request statistics
    const totalRequests = this.httpRequests.length;
    const successfulRequests = this.httpRequests.filter(req => req.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = totalRequests > 0
      ? this.httpRequests.reduce((sum, req) => sum + req.duration, 0) / totalRequests
      : 0;

    // Calculate error statistics
    const totalErrors = this.errors.length;
    const recentErrors = this.errors.filter(error => error.timestamp > oneHourAgo).length;

    // Error categories
    const errorCategories: Record<string, number> = {};
    this.errors.forEach(error => {
      const category = this.categorizeError(error.error);
      errorCategories[category] = (errorCategories[category] || 0) + 1;
    });

    // User statistics
    const activeUsers = this.activeSessions.size;
    const totalSessions = this.activeSessions.size; // Simplified
    const averageSessionDuration = this.calculateAverageSessionDuration();

    // System metrics (latest)
    const latestSystemMetrics = this.systemMetrics[this.systemMetrics.length - 1] || {
      timestamp: now,
      memory: { used: 0, total: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
      cpu: { usage: 0, loadAverage: [0, 0, 0] },
      uptime: 0,
      connections: { active: 0, total: 0 },
      cache: { hitRate: 0, missRate: 0, size: 0 },
      database: { connections: 0, queries: 0, slowQueries: 0 }
    };

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        averageResponseTime,
        slowRequests: this.slowRequests.length
      },
      errors: {
        total: totalErrors,
        recent: recentErrors,
        categories: errorCategories
      },
      users: {
        activeUsers,
        totalSessions,
        averageSessionDuration
      },
      system: latestSystemMetrics,
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  getHttpRequestStats(timeRange?: { start: Date; end: Date }) {
    let requests = this.httpRequests;

    if (timeRange) {
      requests = requests.filter(req =>
        req.timestamp >= timeRange.start && req.timestamp <= timeRange.end
      );
    }

    const statusCodes: Record<number, number> = {};
    const methods: Record<string, number> = {};
    const paths: Record<string, number> = {};

    requests.forEach(req => {
      statusCodes[req.statusCode] = (statusCodes[req.statusCode] || 0) + 1;
      methods[req.method] = (methods[req.method] || 0) + 1;
      paths[req.path] = (paths[req.path] || 0) + 1;
    });

    return {
      total: requests.length,
      statusCodes,
      methods,
      paths,
      averageResponseTime: requests.length > 0
        ? requests.reduce((sum, req) => sum + req.duration, 0) / requests.length
        : 0
    };
  }

  getErrorStats(timeRange?: { start: Date; end: Date }) {
    let errors = this.errors;

    if (timeRange) {
      errors = errors.filter(error =>
        error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      );
    }

    const categories: Record<string, number> = {};
    const messages: Record<string, number> = {};

    errors.forEach(error => {
      const category = this.categorizeError(error.error);
      categories[category] = (categories[category] || 0) + 1;

      const message = error.error.message;
      messages[message] = (messages[message] || 0) + 1;
    });

    return {
      total: errors.length,
      categories,
      messages,
      recent: errors.filter(error =>
        error.timestamp > new Date(Date.now() - 60 * 60 * 1000)
      ).length
    };
  }

  getSystemMetricsHistory(timeRange?: { start: Date; end: Date }) {
    let metrics = this.systemMetrics;

    if (timeRange) {
      metrics = metrics.filter(metric =>
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    return metrics;
  }

  // Health check

  async getHealthStatus() {
    const stats = this.getStats();
    const recentErrors = stats.errors.recent;
    const errorRate = stats.requests.total > 0
      ? (stats.requests.failed / stats.requests.total) * 100
      : 0;
    const avgResponseTime = stats.requests.averageResponseTime;

    const isHealthy = recentErrors < 10 && errorRate < 5 && avgResponseTime < 2000;

    return {
      healthy: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        errors: {
          status: recentErrors < 10 ? 'pass' : 'fail',
          value: recentErrors,
          threshold: 10
        },
        errorRate: {
          status: errorRate < 5 ? 'pass' : 'fail',
          value: errorRate,
          threshold: 5
        },
        responseTime: {
          status: avgResponseTime < 2000 ? 'pass' : 'fail',
          value: avgResponseTime,
          threshold: 2000
        }
      },
      timestamp: new Date()
    };
  }

  // Utility methods

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('validation')) return 'validation';
    if (message.includes('auth')) return 'authentication';
    if (message.includes('permission') || message.includes('forbidden')) return 'authorization';
    if (message.includes('network') || message.includes('timeout')) return 'network';
    if (message.includes('database') || message.includes('connection')) return 'database';
    if (message.includes('not found')) return 'not_found';
    if (message.includes('rate limit')) return 'rate_limit';

    return 'unknown';
  }

  private calculateCacheHitRate(): number {
    // This would be provided by the cache service
    return 85; // Placeholder
  }

  private calculateCacheMissRate(): number {
    return 100 - this.calculateCacheHitRate();
  }

  private calculateAverageSessionDuration(): number {
    if (this.activeSessions.size === 0) return 0;

    const durations = Array.from(this.activeSessions.values()).map(session =>
      Date.now() - session.startTime.getTime()
    );

    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  // Export methods

  exportMetrics(format: 'json' | 'csv' = 'json', timeRange?: { start: Date; end: Date }) {
    const data = {
      httpRequests: timeRange
        ? this.httpRequests.filter(req => req.timestamp >= timeRange.start && req.timestamp <= timeRange.end)
        : this.httpRequests,
      errors: timeRange
        ? this.errors.filter(error => error.timestamp >= timeRange.start && error.timestamp <= timeRange.end)
        : this.errors,
      systemMetrics: timeRange
        ? this.systemMetrics.filter(metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end)
        : this.systemMetrics,
      generatedAt: new Date()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV export would be implemented here
    return 'CSV export not implemented';
  }

  // Shutdown

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down monitoring service...');

    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.removeAllListeners();

    console.log('✅ Monitoring service shutdown complete');
  }
}