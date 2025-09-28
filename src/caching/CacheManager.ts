import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  size: number;
}

export interface CacheMetadata {
  ttl?: number;
  tags?: string[];
  namespace?: string;
  priority?: number;
  dependencies?: string[];
  version?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  evictions: number;
  errors: number;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  defaultTtl: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compressionEnabled: boolean;
  compressionThreshold: number;
  persistEnabled: boolean;
  persistPath?: string;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, metadata?: CacheMetadata): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  size(): Promise<number>;
  stats(): Promise<CacheStats>;
}

export class MemoryCacheProvider implements CacheProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    evictions: 0,
    errors: 0
  };
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      defaultTtl: 3600000, // 1 hour
      evictionPolicy: 'lru',
      compressionEnabled: false,
      compressionThreshold: 1024,
      persistEnabled: false,
      ...config
    };

    this.startCleanupTask();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateHitRate();
      return null;
    }

    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    this.stats.hits++;
    this.updateHitRate();

    return entry.value as T;
  }

  async set<T>(key: string, value: T, metadata: CacheMetadata = {}): Promise<boolean> {
    try {
      const size = this.calculateSize(value);
      const entry: CacheEntry<T> = {
        key,
        value,
        metadata: {
          ttl: metadata.ttl || this.config.defaultTtl,
          ...metadata
        },
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        size
      };

      if (this.shouldEvict(size)) {
        this.evictEntries(size);
      }

      this.cache.set(key, entry);
      this.updateStats();
      return true;

    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const success = this.cache.delete(key);
    if (success) {
      this.updateStats();
    }
    return success;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async stats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.metadata.ttl) {
      return false;
    }

    const now = Date.now();
    const created = entry.createdAt.getTime();
    return (now - created) > entry.metadata.ttl;
  }

  private shouldEvict(newEntrySize: number): boolean {
    return (
      this.cache.size >= this.config.maxEntries ||
      this.stats.totalSize + newEntrySize > this.config.maxSize
    );
  }

  private evictEntries(requiredSpace: number): void {
    const entries = Array.from(this.cache.values());

    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime());
        break;
      case 'lfu':
        entries.sort((a, b) => a.accessCount - b.accessCount);
        break;
      case 'fifo':
        entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'ttl':
        entries.sort((a, b) => {
          const aTtl = a.metadata.ttl || Infinity;
          const bTtl = b.metadata.ttl || Infinity;
          return aTtl - bTtl;
        });
        break;
    }

    let freedSpace = 0;
    let evictedCount = 0;

    for (const entry of entries) {
      if (freedSpace >= requiredSpace && evictedCount >= Math.ceil(this.cache.size * 0.1)) {
        break;
      }

      this.cache.delete(entry.key);
      freedSpace += entry.size;
      evictedCount++;
      this.stats.evictions++;
    }
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate for UTF-16
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      evictions: 0,
      errors: 0
    };
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean up every minute
  }

  private cleanupExpiredEntries(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    if (expiredKeys.length > 0) {
      this.updateStats();
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

export class MultiTierCacheManager extends EventEmitter {
  private providers: Map<string, CacheProvider> = new Map();
  private tierOrder: string[] = [];
  private config: MultiTierConfig;
  private keyHasher = crypto.createHash;

  constructor(config: Partial<MultiTierConfig> = {}) {
    super();

    this.config = {
      enableDistribution: false,
      enableCompression: false,
      enableMetrics: true,
      keyPrefix: 'grafity',
      namespaceEnabled: true,
      taggedInvalidation: true,
      ...config
    };

    this.setupDefaultTiers();
  }

  addCacheTier(name: string, provider: CacheProvider, priority: number = 0): void {
    this.providers.set(name, provider);

    // Insert in priority order (higher priority first)
    const insertIndex = this.tierOrder.findIndex(tierName => {
      const existingPriority = this.getTierPriority(tierName);
      return priority > existingPriority;
    });

    if (insertIndex === -1) {
      this.tierOrder.push(name);
    } else {
      this.tierOrder.splice(insertIndex, 0, name);
    }

    this.emit('tier:added', { name, priority });
  }

  removeCacheTier(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      this.tierOrder = this.tierOrder.filter(tier => tier !== name);
      this.emit('tier:removed', { name });
    }
    return removed;
  }

  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = this.buildKey(key, namespace);
    let value: T | null = null;
    let foundTier: string | null = null;

    // Search through tiers in order
    for (const tierName of this.tierOrder) {
      const provider = this.providers.get(tierName);
      if (!provider) continue;

      try {
        value = await provider.get<T>(fullKey);
        if (value !== null) {
          foundTier = tierName;
          break;
        }
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'get', key: fullKey, error });
      }
    }

    // Backfill higher-priority tiers
    if (value !== null && foundTier) {
      await this.backfillTiers(fullKey, value, foundTier);
    }

    this.emit('get', { key: fullKey, found: value !== null, tier: foundTier });
    return value;
  }

  async set<T>(key: string, value: T, metadata?: CacheMetadata, namespace?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, namespace);
    let success = true;

    // Set in all tiers
    const setPromises = this.tierOrder.map(async tierName => {
      const provider = this.providers.get(tierName);
      if (!provider) return false;

      try {
        return await provider.set(fullKey, value, metadata);
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'set', key: fullKey, error });
        return false;
      }
    });

    const results = await Promise.allSettled(setPromises);
    success = results.some(result => result.status === 'fulfilled' && result.value === true);

    this.emit('set', { key: fullKey, success, tiers: this.tierOrder.length });
    return success;
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, namespace);
    let anySuccess = false;

    // Delete from all tiers
    const deletePromises = this.tierOrder.map(async tierName => {
      const provider = this.providers.get(tierName);
      if (!provider) return false;

      try {
        return await provider.delete(fullKey);
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'delete', key: fullKey, error });
        return false;
      }
    });

    const results = await Promise.allSettled(deletePromises);
    anySuccess = results.some(result => result.status === 'fulfilled' && result.value === true);

    this.emit('delete', { key: fullKey, success: anySuccess });
    return anySuccess;
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.config.taggedInvalidation) {
      return 0;
    }

    let totalInvalidated = 0;

    for (const tierName of this.tierOrder) {
      const provider = this.providers.get(tierName);
      if (!provider) continue;

      try {
        const keys = await provider.keys();
        let invalidatedInTier = 0;

        for (const key of keys) {
          const entry = await provider.get(key);
          if (entry && this.hasTag(entry, tag)) {
            await provider.delete(key);
            invalidatedInTier++;
          }
        }

        totalInvalidated += invalidatedInTier;
        this.emit('tag:invalidated', { tier: tierName, tag, count: invalidatedInTier });

      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'invalidateByTag', tag, error });
      }
    }

    return totalInvalidated;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    if (!this.config.namespaceEnabled) {
      return 0;
    }

    const pattern = `${this.config.keyPrefix}:${namespace}:*`;
    let totalInvalidated = 0;

    for (const tierName of this.tierOrder) {
      const provider = this.providers.get(tierName);
      if (!provider) continue;

      try {
        const keys = await provider.keys(pattern);
        let invalidatedInTier = 0;

        for (const key of keys) {
          await provider.delete(key);
          invalidatedInTier++;
        }

        totalInvalidated += invalidatedInTier;
        this.emit('namespace:invalidated', { tier: tierName, namespace, count: invalidatedInTier });

      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'invalidateNamespace', namespace, error });
      }
    }

    return totalInvalidated;
  }

  async clear(): Promise<void> {
    const clearPromises = this.tierOrder.map(async tierName => {
      const provider = this.providers.get(tierName);
      if (!provider) return;

      try {
        await provider.clear();
        this.emit('tier:cleared', { tier: tierName });
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'clear', error });
      }
    });

    await Promise.allSettled(clearPromises);
    this.emit('cleared');
  }

  async getStats(): Promise<Record<string, CacheStats>> {
    const stats: Record<string, CacheStats> = {};

    const statPromises = this.tierOrder.map(async tierName => {
      const provider = this.providers.get(tierName);
      if (!provider) return;

      try {
        stats[tierName] = await provider.stats();
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'stats', error });
      }
    });

    await Promise.allSettled(statPromises);
    return stats;
  }

  private setupDefaultTiers(): void {
    // L1 Cache: Small, fast memory cache
    const l1Cache = new MemoryCacheProvider({
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 1000,
      defaultTtl: 300000, // 5 minutes
      evictionPolicy: 'lru'
    });

    // L2 Cache: Larger memory cache
    const l2Cache = new MemoryCacheProvider({
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      defaultTtl: 3600000, // 1 hour
      evictionPolicy: 'lru'
    });

    this.addCacheTier('l1', l1Cache, 100);
    this.addCacheTier('l2', l2Cache, 50);
  }

  private buildKey(key: string, namespace?: string): string {
    let fullKey = `${this.config.keyPrefix}:`;

    if (this.config.namespaceEnabled && namespace) {
      fullKey += `${namespace}:`;
    }

    // Hash long keys to avoid size limits
    if (key.length > 250) {
      const hash = crypto.createHash('sha256').update(key).digest('hex');
      fullKey += `hash:${hash}`;
    } else {
      fullKey += key;
    }

    return fullKey;
  }

  private async backfillTiers(key: string, value: any, foundTier: string): Promise<void> {
    const foundIndex = this.tierOrder.indexOf(foundTier);

    if (foundIndex <= 0) {
      return; // Already in highest tier
    }

    // Backfill higher priority tiers
    const backfillPromises = this.tierOrder.slice(0, foundIndex).map(async tierName => {
      const provider = this.providers.get(tierName);
      if (!provider) return;

      try {
        await provider.set(key, value);
        this.emit('backfill', { tier: tierName, key });
      } catch (error) {
        this.emit('error', { tier: tierName, operation: 'backfill', key, error });
      }
    });

    await Promise.allSettled(backfillPromises);
  }

  private getTierPriority(tierName: string): number {
    // Default priorities based on tier order
    const index = this.tierOrder.indexOf(tierName);
    return index === -1 ? 0 : 100 - index * 10;
  }

  private hasTag(entry: any, tag: string): boolean {
    if (!entry || typeof entry !== 'object' || !entry.metadata || !entry.metadata.tags) {
      return false;
    }
    return entry.metadata.tags.includes(tag);
  }

  getCacheTiers(): string[] {
    return [...this.tierOrder];
  }

  getCacheProvider(tierName: string): CacheProvider | undefined {
    return this.providers.get(tierName);
  }
}

export interface MultiTierConfig {
  enableDistribution: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;
  keyPrefix: string;
  namespaceEnabled: boolean;
  taggedInvalidation: boolean;
}