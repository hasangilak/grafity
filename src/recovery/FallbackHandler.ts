export interface FallbackConfig {
  enableFallback: boolean;
  fallbackTimeout: number;
  fallbackStrategies: FallbackStrategy[];
  gracefulDegradation: boolean;
  cacheEnabled: boolean;
  cacheTtl: number;
  maxFallbackAttempts: number;
}

export interface FallbackStrategy {
  name: string;
  priority: number;
  condition: (error: Error) => boolean;
  handler: (error: Error, context?: any) => Promise<any>;
  timeout?: number;
  enabled: boolean;
}

export interface FallbackResult {
  success: boolean;
  result?: any;
  strategy?: string;
  error?: Error;
  fromCache?: boolean;
  degraded?: boolean;
  executionTime: number;
}

export interface FallbackContext {
  operation: string;
  originalParams?: any[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface CachedResult {
  value: any;
  timestamp: Date;
  expiresAt: Date;
  strategy: string;
}

export class FallbackHandler {
  private config: FallbackConfig;
  private strategies: FallbackStrategy[] = [];
  private cache: Map<string, CachedResult> = new Map();
  private fallbackAttempts: Map<string, number> = new Map();

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enableFallback: true,
      fallbackTimeout: 5000,
      fallbackStrategies: [],
      gracefulDegradation: true,
      cacheEnabled: true,
      cacheTtl: 300000, // 5 minutes
      maxFallbackAttempts: 3,
      ...config
    };

    this.strategies = [...this.config.fallbackStrategies];
    this.initializeDefaultStrategies();
    this.startCacheCleanup();
  }

  async execute(error: Error, context?: FallbackContext): Promise<FallbackResult> {
    const startTime = Date.now();

    if (!this.config.enableFallback) {
      return {
        success: false,
        error,
        executionTime: Date.now() - startTime
      };
    }

    const cacheKey = this.generateCacheKey(error, context);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return {
          success: true,
          result: cachedResult.value,
          strategy: cachedResult.strategy,
          fromCache: true,
          executionTime: Date.now() - startTime
        };
      }
    }

    // Check fallback attempt limits
    const attemptCount = this.fallbackAttempts.get(cacheKey) || 0;
    if (attemptCount >= this.config.maxFallbackAttempts) {
      return {
        success: false,
        error: new Error('Maximum fallback attempts exceeded'),
        executionTime: Date.now() - startTime
      };
    }

    // Find applicable strategies
    const applicableStrategies = this.strategies
      .filter(strategy => strategy.enabled && strategy.condition(error))
      .sort((a, b) => b.priority - a.priority);

    if (applicableStrategies.length === 0) {
      return {
        success: false,
        error: new Error('No applicable fallback strategies found'),
        executionTime: Date.now() - startTime
      };
    }

    // Try strategies in order of priority
    for (const strategy of applicableStrategies) {
      try {
        this.fallbackAttempts.set(cacheKey, attemptCount + 1);

        const strategyTimeout = strategy.timeout || this.config.fallbackTimeout;
        const result = await this.executeWithTimeout(
          () => strategy.handler(error, context),
          strategyTimeout
        );

        // Cache the successful result
        if (this.config.cacheEnabled) {
          this.setCache(cacheKey, result, strategy.name);
        }

        return {
          success: true,
          result,
          strategy: strategy.name,
          executionTime: Date.now() - startTime
        };

      } catch (strategyError) {
        // Continue to next strategy
        continue;
      }
    }

    // All strategies failed, try graceful degradation
    if (this.config.gracefulDegradation) {
      const degradedResult = this.gracefulDegrade(error, context);
      if (degradedResult) {
        return {
          success: true,
          result: degradedResult,
          strategy: 'graceful_degradation',
          degraded: true,
          executionTime: Date.now() - startTime
        };
      }
    }

    return {
      success: false,
      error: new Error('All fallback strategies failed'),
      executionTime: Date.now() - startTime
    };
  }

  addStrategy(strategy: FallbackStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex(s => s.name === name);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }

  enableStrategy(name: string): boolean {
    const strategy = this.strategies.find(s => s.name === name);
    if (strategy) {
      strategy.enabled = true;
      return true;
    }
    return false;
  }

  disableStrategy(name: string): boolean {
    const strategy = this.strategies.find(s => s.name === name);
    if (strategy) {
      strategy.enabled = false;
      return true;
    }
    return false;
  }

  clearCache(): void {
    this.cache.clear();
    this.fallbackAttempts.clear();
  }

  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ key: string; strategy: string; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      strategy: cached.strategy,
      age: Date.now() - cached.timestamp.getTime()
    }));

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses to calculate
      entries
    };
  }

  private initializeDefaultStrategies(): void {
    // Empty response strategy
    this.addStrategy({
      name: 'empty_response',
      priority: 1,
      condition: (error: Error) => true, // Applies to all errors
      handler: async (error: Error) => {
        if (error.message.includes('list') || error.message.includes('array')) {
          return [];
        }
        if (error.message.includes('object') || error.message.includes('data')) {
          return {};
        }
        return null;
      },
      enabled: true
    });

    // Default value strategy
    this.addStrategy({
      name: 'default_value',
      priority: 2,
      condition: (error: Error) => !error.message.includes('auth'),
      handler: async (error: Error, context?: FallbackContext) => {
        // Return appropriate defaults based on context
        if (context?.operation.includes('search')) {
          return { results: [], total: 0, hasMore: false };
        }
        if (context?.operation.includes('count')) {
          return 0;
        }
        if (context?.operation.includes('list')) {
          return [];
        }
        return { success: false, message: 'Service temporarily unavailable' };
      },
      enabled: true
    });

    // Cached data strategy
    this.addStrategy({
      name: 'stale_cache',
      priority: 5,
      condition: (error: Error) => this.config.cacheEnabled,
      handler: async (error: Error, context?: FallbackContext) => {
        // Try to find any cached data, even if expired
        const staleData = this.findStaleCache(error, context);
        if (staleData) {
          return {
            ...staleData,
            _stale: true,
            _warning: 'Data may be outdated due to service unavailability'
          };
        }
        throw new Error('No stale cache available');
      },
      enabled: true
    });

    // Reduced functionality strategy
    this.addStrategy({
      name: 'reduced_functionality',
      priority: 3,
      condition: (error: Error) => error.message.includes('network') || error.message.includes('timeout'),
      handler: async (error: Error, context?: FallbackContext) => {
        return {
          success: true,
          data: null,
          message: 'Limited functionality available - please try again later',
          reduced: true
        };
      },
      enabled: true
    });

    // Mock data strategy (for development/testing)
    this.addStrategy({
      name: 'mock_data',
      priority: 0, // Lowest priority
      condition: (error: Error) => process.env.NODE_ENV === 'development',
      handler: async (error: Error, context?: FallbackContext) => {
        return this.generateMockData(context);
      },
      enabled: process.env.NODE_ENV === 'development'
    });

    // Health check strategy
    this.addStrategy({
      name: 'health_check',
      priority: 10,
      condition: (error: Error) => error.message.includes('health'),
      handler: async (error: Error) => {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          message: 'Service is experiencing issues'
        };
      },
      enabled: true
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Fallback strategy timeout'));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private gracefulDegrade(error: Error, context?: FallbackContext): any {
    // Provide minimal functionality based on the type of operation
    if (context?.operation.includes('search')) {
      return {
        results: [],
        total: 0,
        hasMore: false,
        message: 'Search temporarily unavailable'
      };
    }

    if (context?.operation.includes('analysis')) {
      return {
        status: 'incomplete',
        message: 'Analysis service temporarily unavailable',
        timestamp: new Date().toISOString()
      };
    }

    if (context?.operation.includes('generation')) {
      return {
        generated: false,
        message: 'Code generation service temporarily unavailable'
      };
    }

    // Generic degraded response
    return {
      available: false,
      message: 'Service temporarily unavailable - operating in degraded mode',
      timestamp: new Date().toISOString(),
      retryAfter: '300' // 5 minutes
    };
  }

  private generateMockData(context?: FallbackContext): any {
    if (!context) {
      return { mock: true, data: 'Mock response' };
    }

    switch (context.operation) {
      case 'search':
        return {
          results: [
            { id: 'mock-1', title: 'Mock Result 1', type: 'component' },
            { id: 'mock-2', title: 'Mock Result 2', type: 'function' }
          ],
          total: 2,
          hasMore: false,
          mock: true
        };

      case 'analysis':
        return {
          components: 5,
          functions: 12,
          complexity: 'medium',
          patterns: ['Observer', 'Factory'],
          mock: true
        };

      case 'generation':
        return {
          code: '// Mock generated code\nfunction mockFunction() {\n  return "Hello World";\n}',
          language: 'javascript',
          mock: true
        };

      default:
        return {
          mock: true,
          operation: context.operation,
          timestamp: new Date().toISOString()
        };
    }
  }

  private generateCacheKey(error: Error, context?: FallbackContext): string {
    const parts = [
      error.constructor.name,
      context?.operation || 'unknown',
      JSON.stringify(context?.originalParams || [])
    ];
    return parts.join(':');
  }

  private getFromCache(key: string): CachedResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private findStaleCache(error: Error, context?: FallbackContext): any {
    // Look for any cache entry that might be related, even if expired
    for (const [key, cached] of this.cache.entries()) {
      if (key.includes(context?.operation || '')) {
        return cached.value;
      }
    }
    return null;
  }

  private setCache(key: string, value: any, strategy: string): void {
    const expiresAt = new Date(Date.now() + this.config.cacheTtl);

    this.cache.set(key, {
      value,
      timestamp: new Date(),
      expiresAt,
      strategy
    });
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [key, cached] of this.cache.entries()) {
        if (cached.expiresAt < now) {
          this.cache.delete(key);
        }
      }

      // Clean up old fallback attempt counters
      const cutoff = Date.now() - 3600000; // 1 hour
      for (const [key] of this.fallbackAttempts.entries()) {
        // Reset counters older than 1 hour
        this.fallbackAttempts.delete(key);
      }
    }, 300000);
  }

  // Utility methods
  getStrategies(): FallbackStrategy[] {
    return [...this.strategies];
  }

  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Test utilities
  async testStrategy(strategyName: string, error: Error, context?: FallbackContext): Promise<FallbackResult> {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }

    const startTime = Date.now();

    try {
      const result = await strategy.handler(error, context);
      return {
        success: true,
        result,
        strategy: strategyName,
        executionTime: Date.now() - startTime
      };
    } catch (strategyError) {
      return {
        success: false,
        error: strategyError as Error,
        strategy: strategyName,
        executionTime: Date.now() - startTime
      };
    }
  }

  getAttemptStats(): Array<{ key: string; attempts: number }> {
    return Array.from(this.fallbackAttempts.entries()).map(([key, attempts]) => ({
      key,
      attempts
    }));
  }

  resetAttempts(key?: string): void {
    if (key) {
      this.fallbackAttempts.delete(key);
    } else {
      this.fallbackAttempts.clear();
    }
  }
}