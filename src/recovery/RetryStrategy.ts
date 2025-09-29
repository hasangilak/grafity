export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear' | 'random';
  jitter: boolean;
  jitterFactor: number;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  abortSignal?: AbortSignal;
}

export interface RetryAttempt {
  attempt: number;
  error: Error;
  delay: number;
  timestamp: Date;
  totalElapsed: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  finalError?: Error;
  attempts: RetryAttempt[];
  totalDuration: number;
  totalAttempts: number;
}

export class RetryStrategy {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffStrategy: 'exponential',
      jitter: true,
      jitterFactor: 0.1,
      retryCondition: this.defaultRetryCondition,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      // Check if operation was aborted
      if (this.config.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }

      try {
        const result = await operation();
        return result;

      } catch (error) {
        lastError = error as Error;
        const currentTime = Date.now();

        const attemptInfo: RetryAttempt = {
          attempt,
          error: lastError,
          delay: 0,
          timestamp: new Date(),
          totalElapsed: currentTime - startTime
        };

        attempts.push(attemptInfo);

        // Check if we should retry
        if (attempt === this.config.maxAttempts ||
            !this.shouldRetry(lastError, attempt)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        attemptInfo.delay = delay;

        // Call retry callback if provided
        if (this.config.onRetry) {
          this.config.onRetry(lastError, attempt, delay);
        }

        // Wait before next attempt
        await this.delay(delay);
      }
    }

    // All attempts failed
    throw lastError!;
  }

  async executeWithResult<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      if (this.config.abortSignal?.aborted) {
        return {
          success: false,
          finalError: new Error('Operation aborted'),
          attempts,
          totalDuration: Date.now() - startTime,
          totalAttempts: attempt - 1
        };
      }

      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts,
          totalDuration: Date.now() - startTime,
          totalAttempts: attempt
        };

      } catch (error) {
        lastError = error as Error;
        const currentTime = Date.now();

        const attemptInfo: RetryAttempt = {
          attempt,
          error: lastError,
          delay: 0,
          timestamp: new Date(),
          totalElapsed: currentTime - startTime
        };

        attempts.push(attemptInfo);

        if (attempt === this.config.maxAttempts ||
            !this.shouldRetry(lastError, attempt)) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        attemptInfo.delay = delay;

        if (this.config.onRetry) {
          this.config.onRetry(lastError, attempt, delay);
        }

        await this.delay(delay);
      }
    }

    return {
      success: false,
      finalError: lastError!,
      attempts,
      totalDuration: Date.now() - startTime,
      totalAttempts: attempts.length
    };
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    if (this.config.retryCondition) {
      return this.config.retryCondition(error, attempt);
    }
    return true;
  }

  private defaultRetryCondition(error: Error, attempt: number): boolean {
    // Don't retry validation errors or client errors (4xx)
    if (error.message.includes('400') ||
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('404') ||
        error.message.toLowerCase().includes('validation')) {
      return false;
    }

    // Retry network errors, timeouts, and server errors (5xx)
    if (error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      return true;
    }

    // Default to retry
    return true;
  }

  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.backoffStrategy) {
      case 'fixed':
        delay = this.config.baseDelay;
        break;

      case 'linear':
        delay = this.config.baseDelay * attempt;
        break;

      case 'exponential':
        delay = this.config.baseDelay * Math.pow(2, attempt - 1);
        break;

      case 'random':
        delay = Math.random() * this.config.baseDelay * attempt;
        break;

      default:
        delay = this.config.baseDelay * Math.pow(2, attempt - 1);
    }

    // Apply jitter if enabled
    if (this.config.jitter) {
      const jitterAmount = delay * this.config.jitterFactor;
      const jitterOffset = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += jitterOffset;
    }

    // Ensure delay doesn't exceed maximum
    delay = Math.min(delay, this.config.maxDelay);

    // Ensure delay is not negative
    delay = Math.max(delay, 0);

    return Math.round(delay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      // Handle abort signal
      if (this.config.abortSignal) {
        const abortHandler = () => {
          clearTimeout(timeoutId);
          reject(new Error('Delay aborted'));
        };

        this.config.abortSignal.addEventListener('abort', abortHandler, { once: true });

        // Clean up event listener when delay completes
        setTimeout(() => {
          this.config.abortSignal?.removeEventListener('abort', abortHandler);
        }, ms);
      }
    });
  }

  // Utility methods
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Static factory methods for common strategies
  static exponentialBackoff(maxAttempts: number = 3, baseDelay: number = 1000): RetryStrategy {
    return new RetryStrategy({
      maxAttempts,
      baseDelay,
      backoffStrategy: 'exponential',
      jitter: true
    });
  }

  static fixedDelay(maxAttempts: number = 3, delay: number = 1000): RetryStrategy {
    return new RetryStrategy({
      maxAttempts,
      baseDelay: delay,
      backoffStrategy: 'fixed',
      jitter: false
    });
  }

  static linearBackoff(maxAttempts: number = 3, baseDelay: number = 1000): RetryStrategy {
    return new RetryStrategy({
      maxAttempts,
      baseDelay,
      backoffStrategy: 'linear',
      jitter: true
    });
  }

  static randomDelay(maxAttempts: number = 3, baseDelay: number = 1000): RetryStrategy {
    return new RetryStrategy({
      maxAttempts,
      baseDelay,
      backoffStrategy: 'random',
      jitter: false
    });
  }

  static networkRetry(): RetryStrategy {
    return new RetryStrategy({
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffStrategy: 'exponential',
      jitter: true,
      retryCondition: (error: Error, attempt: number) => {
        // Retry network-related errors
        const networkErrors = [
          'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
          'timeout', '500', '502', '503', '504'
        ];

        return networkErrors.some(errorType =>
          error.message.toLowerCase().includes(errorType.toLowerCase())
        );
      }
    });
  }

  static databaseRetry(): RetryStrategy {
    return new RetryStrategy({
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffStrategy: 'exponential',
      jitter: true,
      retryCondition: (error: Error, attempt: number) => {
        // Retry database connection errors
        const dbErrors = [
          'connection', 'timeout', 'lock', 'deadlock',
          'temporary', 'unavailable'
        ];

        return dbErrors.some(errorType =>
          error.message.toLowerCase().includes(errorType)
        );
      }
    });
  }

  static apiRetry(): RetryStrategy {
    return new RetryStrategy({
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffStrategy: 'exponential',
      jitter: true,
      retryCondition: (error: Error, attempt: number) => {
        // Don't retry client errors (4xx), but retry server errors (5xx)
        if (error.message.includes('4')) {
          return false;
        }

        return error.message.includes('5') ||
               error.message.includes('timeout') ||
               error.message.includes('network');
      }
    });
  }

  // Utility method to test retry logic
  static async testRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy
  ): Promise<RetryResult<T>> {
    return await strategy.executeWithResult(operation);
  }

  // Helper method to create abort signal
  static createAbortSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  // Method to predict total retry time
  predictTotalTime(): number {
    let totalTime = 0;

    for (let attempt = 1; attempt < this.config.maxAttempts; attempt++) {
      totalTime += this.calculateDelay(attempt);
    }

    return totalTime;
  }

  // Method to get retry statistics
  getRetryStats(attempts: RetryAttempt[]): {
    totalAttempts: number;
    totalTime: number;
    averageDelay: number;
    maxDelay: number;
    minDelay: number;
    errorTypes: Record<string, number>;
  } {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        totalTime: 0,
        averageDelay: 0,
        maxDelay: 0,
        minDelay: 0,
        errorTypes: {}
      };
    }

    const delays = attempts.map(a => a.delay).filter(d => d > 0);
    const totalTime = attempts[attempts.length - 1]?.totalElapsed || 0;

    // Count error types
    const errorTypes: Record<string, number> = {};
    attempts.forEach(attempt => {
      const errorType = this.categorizeError(attempt.error);
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    return {
      totalAttempts: attempts.length,
      totalTime,
      averageDelay: delays.length > 0 ? delays.reduce((sum, d) => sum + d, 0) / delays.length : 0,
      maxDelay: delays.length > 0 ? Math.max(...delays) : 0,
      minDelay: delays.length > 0 ? Math.min(...delays) : 0,
      errorTypes
    };
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('econnrefused')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('auth') || message.includes('401')) return 'authentication';
    if (message.includes('404')) return 'not_found';
    if (message.includes('5')) return 'server_error';
    if (message.includes('4')) return 'client_error';

    return 'unknown';
  }
}