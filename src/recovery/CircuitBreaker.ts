import { EventEmitter } from 'events';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  volumeThreshold: number;
  errorPercentageThreshold: number;
  slowCallThreshold: number;
  slowCallDurationThreshold: number;
  enableSlowCallDetection: boolean;
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  rejectedCalls: number;
  successPercentage: number;
  failurePercentage: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export interface CallResult {
  success: boolean;
  duration: number;
  timestamp: Date;
  error?: Error;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private callHistory: CallResult[] = [];
  private lastFailureTime?: Date;
  private lastStateChange: Date = new Date();
  private halfOpenStartTime?: Date;
  private halfOpenAttempts: number = 0;
  private resetTimer?: NodeJS.Timeout;

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super();

    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      volumeThreshold: 10,
      errorPercentageThreshold: 50,
      slowCallThreshold: 5,
      slowCallDurationThreshold: 5000, // 5 seconds
      enableSlowCallDetection: true,
      ...config
    };

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      rejectedCalls: 0,
      successPercentage: 100,
      failurePercentage: 0,
      averageResponseTime: 0
    };

    this.startMonitoring();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      this.metrics.rejectedCalls++;
      const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
      this.emit('call:rejected', { name: this.name, reason: 'circuit_open' });
      throw error;
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordSuccess(duration);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(duration, error as Error);
      throw error;
    }
  }

  recordSuccess(duration?: number): void {
    const actualDuration = duration || 0;
    const isSlowCall = this.config.enableSlowCallDetection &&
      actualDuration > this.config.slowCallDurationThreshold;

    const callResult: CallResult = {
      success: true,
      duration: actualDuration,
      timestamp: new Date()
    };

    this.addCallToHistory(callResult);

    this.metrics.totalCalls++;
    this.metrics.successfulCalls++;
    this.metrics.lastSuccessTime = new Date();

    if (isSlowCall) {
      this.metrics.slowCalls++;
      this.emit('call:slow', {
        name: this.name,
        duration: actualDuration,
        threshold: this.config.slowCallDurationThreshold
      });
    }

    this.updateMetrics();

    // Handle state transitions
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenAttempts++;

      // If we've had enough successful calls in half-open state, close the circuit
      if (this.halfOpenAttempts >= 3) {
        this.transitionTo(CircuitBreakerState.CLOSED);
      }
    }

    this.emit('call:success', {
      name: this.name,
      duration: actualDuration,
      state: this.state
    });
  }

  recordFailure(duration?: number, error?: Error): void {
    const actualDuration = duration || 0;

    const callResult: CallResult = {
      success: false,
      duration: actualDuration,
      timestamp: new Date(),
      error
    };

    this.addCallToHistory(callResult);

    this.metrics.totalCalls++;
    this.metrics.failedCalls++;
    this.lastFailureTime = new Date();
    this.metrics.lastFailureTime = this.lastFailureTime;

    this.updateMetrics();

    // Check if we should open the circuit
    if (this.shouldOpen()) {
      this.transitionTo(CircuitBreakerState.OPEN);
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.transitionTo(CircuitBreakerState.OPEN);
    }

    this.emit('call:failure', {
      name: this.name,
      duration: actualDuration,
      error: error?.message,
      state: this.state
    });
  }

  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  getState(): string {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  getName(): string {
    return this.name;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.callHistory = [];
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    this.halfOpenStartTime = undefined;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    // Reset metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      slowCalls: 0,
      rejectedCalls: 0,
      successPercentage: 100,
      failurePercentage: 0,
      averageResponseTime: 0
    };

    this.emit('circuit:reset', { name: this.name });
  }

  forceOpen(): void {
    this.transitionTo(CircuitBreakerState.OPEN);
    this.emit('circuit:forced_open', { name: this.name });
  }

  forceClose(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    this.emit('circuit:forced_closed', { name: this.name });
  }

  private shouldOpen(): boolean {
    // Check if we have enough calls to evaluate
    if (this.metrics.totalCalls < this.config.volumeThreshold) {
      return false;
    }

    // Check failure threshold
    if (this.metrics.failedCalls >= this.config.failureThreshold) {
      return true;
    }

    // Check error percentage threshold
    if (this.metrics.failurePercentage >= this.config.errorPercentageThreshold) {
      return true;
    }

    // Check slow call threshold
    if (this.config.enableSlowCallDetection &&
        this.metrics.slowCalls >= this.config.slowCallThreshold) {
      return true;
    }

    return false;
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    switch (newState) {
      case CircuitBreakerState.OPEN:
        this.scheduleReset();
        break;

      case CircuitBreakerState.HALF_OPEN:
        this.halfOpenStartTime = new Date();
        this.halfOpenAttempts = 0;
        break;

      case CircuitBreakerState.CLOSED:
        if (this.resetTimer) {
          clearTimeout(this.resetTimer);
          this.resetTimer = undefined;
        }
        this.halfOpenStartTime = undefined;
        this.halfOpenAttempts = 0;
        break;
    }

    this.emit('state:changed', {
      name: this.name,
      oldState,
      newState,
      timestamp: this.lastStateChange
    });
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      }
    }, this.config.resetTimeout);
  }

  private addCallToHistory(callResult: CallResult): void {
    this.callHistory.push(callResult);

    // Keep only calls within the monitoring period
    const cutoffTime = new Date(Date.now() - this.config.monitoringPeriod);
    this.callHistory = this.callHistory.filter(call => call.timestamp >= cutoffTime);
  }

  private updateMetrics(): void {
    if (this.callHistory.length === 0) {
      return;
    }

    const successfulCalls = this.callHistory.filter(call => call.success).length;
    const totalCalls = this.callHistory.length;
    const totalDuration = this.callHistory.reduce((sum, call) => sum + call.duration, 0);

    this.metrics.successfulCalls = successfulCalls;
    this.metrics.failedCalls = totalCalls - successfulCalls;
    this.metrics.totalCalls = totalCalls;
    this.metrics.successPercentage = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 100;
    this.metrics.failurePercentage = 100 - this.metrics.successPercentage;
    this.metrics.averageResponseTime = totalCalls > 0 ? totalDuration / totalCalls : 0;

    if (this.config.enableSlowCallDetection) {
      this.metrics.slowCalls = this.callHistory.filter(
        call => call.duration > this.config.slowCallDurationThreshold
      ).length;
    }
  }

  private startMonitoring(): void {
    // Clean up old call history every minute
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.config.monitoringPeriod);
      this.callHistory = this.callHistory.filter(call => call.timestamp >= cutoffTime);
      this.updateMetrics();
    }, 60000);
  }

  // Health check methods
  getHealthStatus(): {
    healthy: boolean;
    state: string;
    metrics: CircuitBreakerMetrics;
    lastStateChange: Date;
  } {
    const healthy = this.state === CircuitBreakerState.CLOSED ||
      (this.state === CircuitBreakerState.HALF_OPEN && this.metrics.successPercentage > 50);

    return {
      healthy,
      state: this.state,
      metrics: this.getMetrics(),
      lastStateChange: this.lastStateChange
    };
  }

  // Configuration update methods
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config:updated', { name: this.name, config: this.config });
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // Utility methods for testing and debugging
  getCallHistory(): CallResult[] {
    return [...this.callHistory];
  }

  getRecentFailures(minutes: number = 5): CallResult[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.callHistory.filter(
      call => !call.success && call.timestamp >= cutoffTime
    );
  }

  getAverageFailureRate(minutes: number = 5): number {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentCalls = this.callHistory.filter(call => call.timestamp >= cutoffTime);

    if (recentCalls.length === 0) return 0;

    const failures = recentCalls.filter(call => !call.success).length;
    return (failures / recentCalls.length) * 100;
  }

  toString(): string {
    return `CircuitBreaker(${this.name}): ${this.state} - Success: ${this.metrics.successPercentage.toFixed(1)}% (${this.metrics.successfulCalls}/${this.metrics.totalCalls})`;
  }
}