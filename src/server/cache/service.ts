import Redis from 'ioredis';
import { CacheManager } from '../../caching/CacheManager';

export interface CacheServiceConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryDelayOnFailover?: number;
    maxRetriesPerRequest?: number;
    lazyConnect?: boolean;
  };
  fallbackToMemory?: boolean;
  defaultTTL?: number;
  compressionThreshold?: number;
}

export interface CacheStats {
  redis?: {
    connected: boolean;
    memory: string;
    keyspace: string;
    commandsProcessed: string;
    connections: string;
    uptime: string;
  };
  memory?: {
    size: number;
    keys: number;
  };
  hitRate?: number;
  missRate?: number;
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    hits: number;
    misses: number;
  };
}

export class CacheService {
  private redis?: Redis;
  private cacheManager: CacheManager;
  private config: CacheServiceConfig;
  private stats = {
    gets: 0,
    sets: 0,
    deletes: 0,
    hits: 0,
    misses: 0
  };

  constructor(config: CacheServiceConfig = {}) {
    this.config = {
      fallbackToMemory: true,
      defaultTTL: 3600, // 1 hour
      compressionThreshold: 1024, // 1KB
      ...config
    };

    this.cacheManager = new CacheManager();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing cache service...');

    // Initialize memory cache manager
    await this.cacheManager.initialize();

    // Initialize Redis if configured
    if (this.config.redis) {
      await this.initializeRedis();
    } else if (process.env.REDIS_URL || process.env.REDIS_URI) {
      await this.initializeRedisFromEnv();
    }

    console.log('✅ Cache service initialized');
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis({
        ...this.config.redis,
        retryDelayOnFailover: this.config.redis?.retryDelayOnFailover || 100,
        maxRetriesPerRequest: this.config.redis?.maxRetriesPerRequest || 3,
        lazyConnect: true
      });

      // Set up event handlers
      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis ready');
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis error:', error);
        if (!this.config.fallbackToMemory) {
          throw error;
        }
      });

      this.redis.on('close', () => {
        console.warn('⚠️ Redis connection closed');
      });

      this.redis.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      // Test connection
      await this.redis.connect();
      await this.redis.ping();

      console.log('✅ Redis cache initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);

      if (this.config.fallbackToMemory) {
        console.log('⚠️ Falling back to memory cache');
        this.redis = undefined;
      } else {
        throw error;
      }
    }
  }

  private async initializeRedisFromEnv(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
    if (!redisUrl) return;

    try {
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      // Set up event handlers (same as above)
      this.redis.on('connect', () => console.log('✅ Redis connected'));
      this.redis.on('ready', () => console.log('✅ Redis ready'));
      this.redis.on('error', (error) => {
        console.error('❌ Redis error:', error);
        if (!this.config.fallbackToMemory) {
          throw error;
        }
      });
      this.redis.on('close', () => console.warn('⚠️ Redis connection closed'));
      this.redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));

      await this.redis.connect();
      await this.redis.ping();

      console.log('✅ Redis cache initialized from environment');

    } catch (error) {
      console.error('❌ Failed to initialize Redis from environment:', error);

      if (this.config.fallbackToMemory) {
        console.log('⚠️ Falling back to memory cache');
        this.redis = undefined;
      } else {
        throw error;
      }
    }
  }

  // Core cache operations

  async get<T = any>(key: string): Promise<T | null> {
    this.stats.gets++;

    try {
      // Try Redis first
      if (this.redis) {
        const value = await this.redis.get(key);
        if (value !== null) {
          this.stats.hits++;
          return this.deserialize(value);
        }
      }

      // Fallback to memory cache
      const memoryValue = await this.cacheManager.get(key);
      if (memoryValue !== null) {
        this.stats.hits++;
        return memoryValue;
      }

      this.stats.misses++;
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    this.stats.sets++;

    const actualTTL = ttl || this.config.defaultTTL || 3600;

    try {
      // Set in Redis
      if (this.redis) {
        const serialized = this.serialize(value);
        await this.redis.setex(key, actualTTL, serialized);
      }

      // Set in memory cache
      await this.cacheManager.set(key, value, actualTTL * 1000); // Convert to milliseconds

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    this.stats.deletes++;

    try {
      let deleted = false;

      // Delete from Redis
      if (this.redis) {
        const result = await this.redis.del(key);
        deleted = result > 0;
      }

      // Delete from memory cache
      const memoryDeleted = await this.cacheManager.delete(key);

      return deleted || memoryDeleted;

    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      // Check Redis first
      if (this.redis) {
        const exists = await this.redis.exists(key);
        if (exists) return true;
      }

      // Check memory cache
      return await this.cacheManager.has(key);

    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      // Set expiration in Redis
      if (this.redis) {
        await this.redis.expire(key, ttl);
      }

      // Update TTL in memory cache
      const value = await this.cacheManager.get(key);
      if (value !== null) {
        await this.cacheManager.set(key, value, ttl * 1000);
      }

      return true;

    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      // Get TTL from Redis
      if (this.redis) {
        return await this.redis.ttl(key);
      }

      // Get TTL from memory cache (approximate)
      const metadata = await this.cacheManager.getMetadata(key);
      if (metadata?.expiresAt) {
        return Math.floor((metadata.expiresAt - Date.now()) / 1000);
      }

      return -1;

    } catch (error) {
      console.error('Cache getTTL error:', error);
      return -1;
    }
  }

  // Bulk operations

  async multiGet<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    try {
      // Get from Redis using pipeline
      if (this.redis && keys.length > 0) {
        const pipeline = this.redis.pipeline();
        keys.forEach(key => pipeline.get(key));
        const results = await pipeline.exec();

        if (results) {
          keys.forEach((key, index) => {
            const [err, value] = results[index];
            if (!err && value !== null) {
              result.set(key, this.deserialize(value as string));
              this.stats.hits++;
            } else {
              this.stats.misses++;
            }
          });
        }
      }

      // Get missing keys from memory cache
      for (const key of keys) {
        if (!result.has(key)) {
          const value = await this.cacheManager.get(key);
          if (value !== null) {
            result.set(key, value);
            this.stats.hits++;
          } else {
            result.set(key, null);
            this.stats.misses++;
          }
        }
      }

      this.stats.gets += keys.length;
      return result;

    } catch (error) {
      console.error('Cache multiGet error:', error);

      // Return empty results for all keys
      keys.forEach(key => result.set(key, null));
      this.stats.gets += keys.length;
      this.stats.misses += keys.length;

      return result;
    }
  }

  async multiSet(entries: Map<string, { value: any; ttl?: number }>): Promise<boolean> {
    const actualTTL = this.config.defaultTTL || 3600;

    try {
      // Set in Redis using pipeline
      if (this.redis && entries.size > 0) {
        const pipeline = this.redis.pipeline();

        for (const [key, { value, ttl }] of entries) {
          const serialized = this.serialize(value);
          pipeline.setex(key, ttl || actualTTL, serialized);
        }

        await pipeline.exec();
      }

      // Set in memory cache
      for (const [key, { value, ttl }] of entries) {
        await this.cacheManager.set(key, value, (ttl || actualTTL) * 1000);
      }

      this.stats.sets += entries.size;
      return true;

    } catch (error) {
      console.error('Cache multiSet error:', error);
      this.stats.sets += entries.size;
      return false;
    }
  }

  async multiDelete(keys: string[]): Promise<number> {
    let deletedCount = 0;

    try {
      // Delete from Redis
      if (this.redis && keys.length > 0) {
        deletedCount += await this.redis.del(...keys);
      }

      // Delete from memory cache
      for (const key of keys) {
        const deleted = await this.cacheManager.delete(key);
        if (deleted && !this.redis) {
          deletedCount++;
        }
      }

      this.stats.deletes += keys.length;
      return deletedCount;

    } catch (error) {
      console.error('Cache multiDelete error:', error);
      this.stats.deletes += keys.length;
      return 0;
    }
  }

  // Pattern operations

  async getKeys(pattern: string): Promise<string[]> {
    try {
      const keys = new Set<string>();

      // Get keys from Redis
      if (this.redis) {
        const redisKeys = await this.redis.keys(pattern);
        redisKeys.forEach(key => keys.add(key));
      }

      // Get keys from memory cache
      const memoryKeys = await this.cacheManager.getKeys();
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));

      memoryKeys.forEach(key => {
        if (regex.test(key)) {
          keys.add(key);
        }
      });

      return Array.from(keys);

    } catch (error) {
      console.error('Cache getKeys error:', error);
      return [];
    }
  }

  async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.getKeys(pattern);
      if (keys.length === 0) return 0;

      return await this.multiDelete(keys);

    } catch (error) {
      console.error('Cache clearPattern error:', error);
      return 0;
    }
  }

  async clear(): Promise<boolean> {
    try {
      // Clear Redis
      if (this.redis) {
        await this.redis.flushdb();
      }

      // Clear memory cache
      await this.cacheManager.clear();

      return true;

    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  // Utility methods

  private serialize(value: any): string {
    try {
      const json = JSON.stringify(value);

      // Compress if above threshold
      if (this.config.compressionThreshold && json.length > this.config.compressionThreshold) {
        // In a real implementation, you might use gzip compression here
        return json;
      }

      return json;
    } catch (error) {
      console.error('Serialization error:', error);
      return JSON.stringify(null);
    }
  }

  private deserialize<T = any>(value: string): T {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Deserialization error:', error);
      return null as T;
    }
  }

  // Statistics and monitoring

  async getStats(): Promise<CacheStats> {
    const stats: CacheStats = {
      operations: { ...this.stats }
    };

    // Calculate hit/miss rates
    const totalRequests = this.stats.gets;
    if (totalRequests > 0) {
      stats.hitRate = (this.stats.hits / totalRequests) * 100;
      stats.missRate = (this.stats.misses / totalRequests) * 100;
    }

    // Get Redis stats
    if (this.redis) {
      try {
        const info = await this.redis.info();
        const infoLines = info.split('\r\n');
        const infoObj: any = {};

        infoLines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            infoObj[key] = value;
          }
        });

        stats.redis = {
          connected: this.redis.status === 'ready',
          memory: infoObj.used_memory_human || 'unknown',
          keyspace: infoObj.db0 || 'empty',
          commandsProcessed: infoObj.total_commands_processed || '0',
          connections: infoObj.connected_clients || '0',
          uptime: infoObj.uptime_in_seconds || '0'
        };
      } catch (error) {
        console.error('Redis stats error:', error);
        stats.redis = {
          connected: false,
          memory: 'unknown',
          keyspace: 'unknown',
          commandsProcessed: 'unknown',
          connections: 'unknown',
          uptime: 'unknown'
        };
      }
    }

    // Get memory cache stats
    const memoryStats = await this.cacheManager.getStats();
    stats.memory = {
      size: memoryStats.totalSize,
      keys: memoryStats.totalEntries
    };

    return stats;
  }

  resetStats(): void {
    this.stats = {
      gets: 0,
      sets: 0,
      deletes: 0,
      hits: 0,
      misses: 0
    };
  }

  // Health check

  async isHealthy(): Promise<boolean> {
    try {
      // Test Redis connection
      if (this.redis) {
        await this.redis.ping();
      }

      // Test memory cache
      const testKey = '_health_check_';
      const testValue = Date.now();

      await this.set(testKey, testValue, 60); // 1 minute TTL
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      return retrieved === testValue;

    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  // Shutdown

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down cache service...');

    try {
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }

      // Shutdown memory cache
      await this.cacheManager.shutdown();

      console.log('✅ Cache service shutdown complete');

    } catch (error) {
      console.error('❌ Cache service shutdown error:', error);
      throw error;
    }
  }

  // Getters

  isRedisConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  getRedisClient(): Redis | undefined {
    return this.redis;
  }

  getCacheManager(): CacheManager {
    return this.cacheManager;
  }
}