import { EventEmitter } from 'events';
import { CircuitBreaker, CircuitBreakerConfig } from './CircuitBreaker';
import { RetryStrategy, RetryConfig } from './RetryStrategy';
import { FallbackHandler, FallbackConfig } from './FallbackHandler';

export interface ErrorRecoveryConfig {
  enableCircuitBreakers: boolean;
  enableRetries: boolean;
  enableFallbacks: boolean;
  enableGracefulDegradation: boolean;
  enableNotifications: boolean;
  maxConcurrentRecoveries: number;
  recoveryTimeout: number;
  errorThreshold: number;
  healthCheckInterval: number;
}

export interface RecoveryAction {
  id: string;
  type: 'retry' | 'fallback' | 'circuit_break' | 'degrade' | 'notification';
  operation: string;
  error: Error;
  timestamp: Date;
  success: boolean;
  duration: number;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  consecutiveFailures: number;
  uptime: number;
  metadata?: Record<string, any>;
}

export interface ErrorPattern {
  pattern: string | RegExp;
  type: 'network' | 'timeout' | 'auth' | 'validation' | 'system' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoveryStrategy: 'retry' | 'fallback' | 'circuit_break' | 'none';
  maxRetries?: number;
  retryDelay?: number;
  fallbackFunction?: string;
}

export interface DegradationLevel {
  level: number;
  name: string;
  description: string;
  disabledFeatures: string[];
  enabledFeatures: string[];
  triggers: string[];
}

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig?: any;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
}

export class ErrorRecovery extends EventEmitter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryStrategies: Map<string, RetryStrategy> = new Map();
  private fallbackHandlers: Map<string, FallbackHandler> = new Map();
  private recoveryActions: RecoveryAction[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private degradationLevels: DegradationLevel[] = [];
  private currentDegradationLevel: number = 0;
  private config: ErrorRecoveryConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    super();

    this.config = {
      enableCircuitBreakers: true,
      enableRetries: true,
      enableFallbacks: true,
      enableGracefulDegradation: true,
      enableNotifications: true,
      maxConcurrentRecoveries: 10,
      recoveryTimeout: 30000,
      errorThreshold: 5,
      healthCheckInterval: 60000,
      ...config
    };

    this.initializeDefaultPatterns();
    this.initializeDegradationLevels();
  }

  start(): void {
    if (this.isActive) return;

    this.isActive = true;

    if (this.config.healthCheckInterval > 0) {
      this.startHealthChecks();
    }

    this.emit('recovery:started');
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all circuit breakers
    this.circuitBreakers.forEach(cb => cb.reset());

    this.emit('recovery:stopped');
  }

  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      retryConfig?: Partial<RetryConfig>;
      circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
      fallbackConfig?: Partial<FallbackConfig>;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    try {
      // Get or create circuit breaker
      let circuitBreaker: CircuitBreaker | undefined;
      if (this.config.enableCircuitBreakers) {
        circuitBreaker = this.getOrCreateCircuitBreaker(operationName, options.circuitBreakerConfig);

        if (circuitBreaker.isOpen()) {
          throw new Error(`Circuit breaker is open for operation: ${operationName}`);
        }
      }

      // Get or create retry strategy
      let retryStrategy: RetryStrategy | undefined;
      if (this.config.enableRetries) {
        retryStrategy = this.getOrCreateRetryStrategy(operationName, options.retryConfig);
      }

      // Execute with timeout
      const timeoutPromise = options.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), options.timeout)
          )
        : null;

      const execute = async (): Promise<T> => {
        const promises = [operation()];
        if (timeoutPromise) promises.push(timeoutPromise);

        const result = await Promise.race(promises);
        return result as T;
      };

      let result: T;

      if (retryStrategy) {
        result = await retryStrategy.execute(execute);
      } else {
        result = await execute();
      }

      // Record success
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      this.recordRecoveryAction({
        id: this.generateId(),
        type: 'retry',
        operation: operationName,
        error: lastError || new Error('Success'),
        timestamp: new Date(),
        success: true,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      lastError = error as Error;

      // Record failure in circuit breaker
      if (this.config.enableCircuitBreakers) {
        const circuitBreaker = this.circuitBreakers.get(operationName);
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
        }
      }

      // Try fallback if enabled
      if (this.config.enableFallbacks) {
        const fallbackResult = await this.tryFallback(operationName, error as Error, options.fallbackConfig);
        if (fallbackResult.success) {
          this.recordRecoveryAction({
            id: this.generateId(),
            type: 'fallback',
            operation: operationName,
            error: error as Error,
            timestamp: new Date(),
            success: true,
            duration: Date.now() - startTime,
            metadata: { fallbackUsed: true }
          });

          return fallbackResult.result;
        }
      }

      // Check if we should degrade
      if (this.config.enableGracefulDegradation) {
        await this.evaluateDegradation(error as Error, operationName);
      }

      // Send notifications if enabled
      if (this.config.enableNotifications) {
        await this.sendErrorNotification(error as Error, operationName);
      }

      this.recordRecoveryAction({
        id: this.generateId(),
        type: 'retry',
        operation: operationName,
        error: error as Error,
        timestamp: new Date(),
        success: false,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  registerErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
  }

  registerHealthCheck(
    serviceName: string,
    healthCheckFunction: () => Promise<{ status: boolean; responseTime: number; metadata?: any }>
  ): void {
    this.healthChecks.set(serviceName, {
      service: serviceName,
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 0,
      consecutiveFailures: 0,
      uptime: 0
    });

    // Store the health check function for execution
    (this.healthChecks.get(serviceName) as any).checkFunction = healthCheckFunction;
  }

  async checkHealth(serviceName?: string): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    const servicesToCheck = serviceName
      ? [serviceName]
      : Array.from(this.healthChecks.keys());

    for (const service of servicesToCheck) {
      const healthCheck = this.healthChecks.get(service);
      if (!healthCheck || !(healthCheck as any).checkFunction) continue;

      const startTime = Date.now();

      try {
        const result = await (healthCheck as any).checkFunction();
        const responseTime = Date.now() - startTime;

        healthCheck.status = result.status ? 'healthy' : 'unhealthy';
        healthCheck.lastCheck = new Date();
        healthCheck.responseTime = responseTime;
        healthCheck.metadata = result.metadata;

        if (result.status) {
          healthCheck.consecutiveFailures = 0;
          healthCheck.uptime += this.config.healthCheckInterval;
        } else {
          healthCheck.consecutiveFailures++;
          if (healthCheck.consecutiveFailures >= this.config.errorThreshold) {
            healthCheck.status = 'unhealthy';
          } else {
            healthCheck.status = 'degraded';
          }
        }

        checks.push(healthCheck);

      } catch (error) {
        healthCheck.status = 'unhealthy';
        healthCheck.lastCheck = new Date();
        healthCheck.responseTime = Date.now() - startTime;
        healthCheck.consecutiveFailures++;

        checks.push(healthCheck);
      }
    }

    return checks;
  }

  async degradeService(level: number, reason: string): Promise<void> {
    if (level < 0 || level >= this.degradationLevels.length) {
      throw new Error(`Invalid degradation level: ${level}`);
    }

    const previousLevel = this.currentDegradationLevel;
    this.currentDegradationLevel = level;

    const degradationLevel = this.degradationLevels[level];

    this.emit('service:degraded', {
      previousLevel,
      currentLevel: level,
      degradationLevel,
      reason,
      timestamp: new Date()
    });

    // Disable features based on degradation level
    for (const feature of degradationLevel.disabledFeatures) {
      this.emit('feature:disabled', { feature, level, reason });
    }

    // Send notification about degradation
    if (this.config.enableNotifications && level > 0) {
      await this.sendDegradationNotification(degradationLevel, reason);
    }
  }

  async recoverService(): Promise<void> {
    const previousLevel = this.currentDegradationLevel;

    if (previousLevel === 0) {
      return; // Already at normal level
    }

    this.currentDegradationLevel = 0;
    const normalLevel = this.degradationLevels[0];

    this.emit('service:recovered', {
      previousLevel,
      currentLevel: 0,
      degradationLevel: normalLevel,
      timestamp: new Date()
    });

    // Re-enable all features
    for (const feature of normalLevel.enabledFeatures) {
      this.emit('feature:enabled', { feature, reason: 'service_recovery' });
    }
  }

  getRecoveryStats(): {
    totalActions: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    currentDegradationLevel: number;
    circuitBreakerStates: Record<string, string>;
  } {
    const actions = this.recoveryActions;
    const successful = actions.filter(a => a.success).length;
    const failed = actions.filter(a => !a.success).length;
    const avgTime = actions.length > 0
      ? actions.reduce((sum, a) => sum + a.duration, 0) / actions.length
      : 0;

    const circuitStates: Record<string, string> = {};
    this.circuitBreakers.forEach((cb, name) => {
      circuitStates[name] = cb.getState();
    });

    return {
      totalActions: actions.length,
      successfulRecoveries: successful,
      failedRecoveries: failed,
      averageRecoveryTime: avgTime,
      currentDegradationLevel: this.currentDegradationLevel,
      circuitBreakerStates: circuitStates
    };
  }

  private getOrCreateCircuitBreaker(
    operationName: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      const circuitBreaker = new CircuitBreaker(operationName, config);
      this.circuitBreakers.set(operationName, circuitBreaker);

      circuitBreaker.on('state:changed', (state) => {
        this.emit('circuit_breaker:state_changed', { operation: operationName, state });
      });
    }

    return this.circuitBreakers.get(operationName)!;
  }

  private getOrCreateRetryStrategy(
    operationName: string,
    config: Partial<RetryConfig> = {}
  ): RetryStrategy {
    if (!this.retryStrategies.has(operationName)) {
      const retryStrategy = new RetryStrategy(config);
      this.retryStrategies.set(operationName, retryStrategy);
    }

    return this.retryStrategies.get(operationName)!;
  }

  private async tryFallback(
    operationName: string,
    error: Error,
    config: Partial<FallbackConfig> = {}
  ): Promise<{ success: boolean; result?: any }> {
    if (!this.fallbackHandlers.has(operationName)) {
      const fallbackHandler = new FallbackHandler(config);
      this.fallbackHandlers.set(operationName, fallbackHandler);
    }

    const fallbackHandler = this.fallbackHandlers.get(operationName)!;
    return await fallbackHandler.execute(error);
  }

  private async evaluateDegradation(error: Error, operationName: string): Promise<void> {
    const pattern = this.findErrorPattern(error);

    if (pattern && pattern.severity === 'critical') {
      await this.degradeService(2, `Critical error in ${operationName}: ${error.message}`);
    } else if (pattern && pattern.severity === 'high') {
      // Check if we have multiple high severity errors recently
      const recentHighSeverityErrors = this.recoveryActions
        .filter(a => !a.success && a.timestamp > new Date(Date.now() - 300000)) // Last 5 minutes
        .length;

      if (recentHighSeverityErrors >= this.config.errorThreshold) {
        await this.degradeService(1, `Multiple high severity errors detected`);
      }
    }
  }

  private findErrorPattern(error: Error): ErrorPattern | undefined {
    return this.errorPatterns.find(pattern => {
      if (typeof pattern.pattern === 'string') {
        return error.message.includes(pattern.pattern);
      } else {
        return pattern.pattern.test(error.message);
      }
    });
  }

  private recordRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.push(action);

    // Keep only recent actions (last 1000)
    if (this.recoveryActions.length > 1000) {
      this.recoveryActions = this.recoveryActions.slice(-1000);
    }

    this.emit('recovery:action', action);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, this.config.healthCheckInterval);
  }

  private async sendErrorNotification(error: Error, operationName: string): Promise<void> {
    const notification = {
      type: 'error',
      operation: operationName,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    this.emit('notification:error', notification);
  }

  private async sendDegradationNotification(level: DegradationLevel, reason: string): Promise<void> {
    const notification = {
      type: 'degradation',
      level: level.level,
      name: level.name,
      description: level.description,
      reason,
      timestamp: new Date().toISOString(),
      disabledFeatures: level.disabledFeatures
    };

    this.emit('notification:degradation', notification);
  }

  private initializeDefaultPatterns(): void {
    this.errorPatterns = [
      {
        pattern: /timeout|TIMEOUT/i,
        type: 'timeout',
        severity: 'medium',
        recoveryStrategy: 'retry',
        maxRetries: 3,
        retryDelay: 1000
      },
      {
        pattern: /network|ECONNREFUSED|ENOTFOUND/i,
        type: 'network',
        severity: 'high',
        recoveryStrategy: 'circuit_break',
        maxRetries: 2,
        retryDelay: 2000
      },
      {
        pattern: /authentication|unauthorized|403|401/i,
        type: 'auth',
        severity: 'medium',
        recoveryStrategy: 'fallback'
      },
      {
        pattern: /validation|invalid|400/i,
        type: 'validation',
        severity: 'low',
        recoveryStrategy: 'none'
      },
      {
        pattern: /database|sql|mongo|redis/i,
        type: 'system',
        severity: 'critical',
        recoveryStrategy: 'circuit_break',
        maxRetries: 1,
        retryDelay: 5000
      }
    ];
  }

  private initializeDegradationLevels(): void {
    this.degradationLevels = [
      {
        level: 0,
        name: 'Normal',
        description: 'All systems operational',
        disabledFeatures: [],
        enabledFeatures: ['*'],
        triggers: []
      },
      {
        level: 1,
        name: 'Degraded',
        description: 'Some non-critical features disabled',
        disabledFeatures: ['semantic_search', 'pattern_learning', 'background_processing'],
        enabledFeatures: ['graph_analysis', 'code_generation', 'basic_operations'],
        triggers: ['high_error_rate', 'resource_exhaustion']
      },
      {
        level: 2,
        name: 'Critical',
        description: 'Only essential features available',
        disabledFeatures: ['semantic_search', 'pattern_learning', 'background_processing', 'code_generation'],
        enabledFeatures: ['basic_operations', 'health_check'],
        triggers: ['critical_error', 'system_failure', 'database_unavailable']
      }
    ];
  }

  private generateId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}