import { workspaceRoot, readJsonFile, writeJsonFile } from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl?: number;
  hash?: string;
}

export interface CacheMetadata {
  version: string;
  lastUpdated: number;
  entries: number;
  size: number;
}

export class NxCacheManager {
  private cacheDir: string;
  private memoryCache: Map<string, CacheEntry>;
  private cacheMetadataPath: string;
  private maxCacheSize: number;
  private defaultTTL: number;

  constructor(
    cacheDir?: string,
    maxCacheSize: number = 100 * 1024 * 1024, // 100MB
    defaultTTL: number = 3600000 // 1 hour
  ) {
    this.cacheDir = cacheDir || path.join(workspaceRoot, '.nx', 'cache', 'grafity');
    this.cacheMetadataPath = path.join(this.cacheDir, 'metadata.json');
    this.memoryCache = new Map();
    this.maxCacheSize = maxCacheSize;
    this.defaultTTL = defaultTTL;

    this.ensureCacheDirectory();
  }

  /**
   * Get cached value
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (this.isValidEntry(memoryEntry)) {
        return memoryEntry.value as T;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    const diskEntry = await this.readFromDisk(key);
    if (diskEntry && this.isValidEntry(diskEntry)) {
      // Add to memory cache
      this.memoryCache.set(key, diskEntry);
      return diskEntry.value as T;
    }

    return null;
  }

  /**
   * Set cache value
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hash: this.generateHash(value)
    };

    // Add to memory cache
    this.memoryCache.set(key, entry);

    // Write to disk
    await this.writeToDisk(entry);

    // Clean up if cache is too large
    await this.evictIfNeeded();
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromDisk(key);
  }

  /**
   * Invalidate entries matching pattern
   */
  async invalidatePattern(pattern: string | RegExp): Promise<void> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    // Clear from memory
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from disk
    const files = await this.listCacheFiles();
    for (const file of files) {
      if (regex.test(file)) {
        await this.deleteFromDisk(file);
      }
    }
  }

  /**
   * Track file changes for cache invalidation
   */
  trackFileChanges(files: string[]): Set<string> {
    const invalidatedKeys = new Set<string>();

    for (const file of files) {
      // Invalidate cache entries related to changed files
      const relatedKeys = this.findRelatedCacheKeys(file);
      for (const key of relatedKeys) {
        this.invalidate(key);
        invalidatedKeys.add(key);
      }
    }

    return invalidatedKeys;
  }

  /**
   * Optimize incremental updates
   */
  async optimizeIncremental<T>(
    key: string,
    updateFn: (prev: T | null) => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    const updated = await updateFn(cached);

    // Only update if changed
    if (this.hasChanged(cached, updated)) {
      await this.set(key, updated, ttl);
    }

    return updated;
  }

  /**
   * Handle cache miss with loader function
   */
  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }

    this.ensureCacheDirectory();
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<{
    memoryEntries: number;
    diskEntries: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    const diskFiles = await this.listCacheFiles();
    const totalSize = await this.calculateCacheSize();

    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of this.memoryCache.values()) {
      if (entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    return {
      memoryEntries: this.memoryCache.size,
      diskEntries: diskFiles.length,
      totalSize,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Warm up cache with preloaded data
   */
  async warmUp(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.readFromDisk(key));
    const entries = await Promise.all(promises);

    for (const entry of entries) {
      if (entry && this.isValidEntry(entry)) {
        this.memoryCache.set(entry.key, entry);
      }
    }
  }

  /**
   * Check if entry is valid (not expired)
   */
  private isValidEntry(entry: CacheEntry): boolean {
    if (!entry.ttl) {
      return true;
    }

    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Generate hash for cache validation
   */
  private generateHash(value: any): string {
    const str = JSON.stringify(value);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Check if value has changed
   */
  private hasChanged(prev: any, current: any): boolean {
    if (prev === null || prev === undefined) {
      return true;
    }

    const prevHash = this.generateHash(prev);
    const currentHash = this.generateHash(current);

    return prevHash !== currentHash;
  }

  /**
   * Find cache keys related to a file
   */
  private findRelatedCacheKeys(filePath: string): string[] {
    const keys: string[] = [];
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);

    for (const [key, entry] of this.memoryCache) {
      // Check if cache key contains file reference
      if (key.includes(fileName) || key.includes(dirName)) {
        keys.push(key);
      }

      // Check if cached value references the file
      if (typeof entry.value === 'object' && entry.value !== null) {
        const valueStr = JSON.stringify(entry.value);
        if (valueStr.includes(filePath)) {
          keys.push(key);
        }
      }
    }

    return keys;
  }

  /**
   * Read cache entry from disk
   */
  private async readFromDisk(key: string): Promise<CacheEntry | null> {
    const filePath = this.getCacheFilePath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read cache file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write cache entry to disk
   */
  private async writeToDisk(entry: CacheEntry): Promise<void> {
    const filePath = this.getCacheFilePath(entry.key);

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(entry), 'utf8');
    } catch (error) {
      console.error(`Failed to write cache file ${filePath}:`, error);
    }
  }

  /**
   * Delete cache entry from disk
   */
  private async deleteFromDisk(key: string): Promise<void> {
    const filePath = this.getCacheFilePath(key);

    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete cache file ${filePath}:`, error);
      }
    }
  }

  /**
   * List all cache files
   */
  private async listCacheFiles(): Promise<string[]> {
    if (!fs.existsSync(this.cacheDir)) {
      return [];
    }

    try {
      const files = await fs.promises.readdir(this.cacheDir);
      return files.filter(f => f.endsWith('.json') && f !== 'metadata.json');
    } catch (error) {
      console.error('Failed to list cache files:', error);
      return [];
    }
  }

  /**
   * Calculate total cache size
   */
  private async calculateCacheSize(): Promise<number> {
    let totalSize = 0;

    const files = await this.listCacheFiles();
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        totalSize += stats.size;
      } catch (error) {
        // Ignore errors for individual files
      }
    }

    return totalSize;
  }

  /**
   * Evict old entries if cache is too large
   */
  private async evictIfNeeded(): Promise<void> {
    const size = await this.calculateCacheSize();

    if (size > this.maxCacheSize) {
      // Get all entries with timestamps
      const entries: { key: string; timestamp: number }[] = [];

      for (const [key, entry] of this.memoryCache) {
        entries.push({ key, timestamp: entry.timestamp });
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        await this.invalidate(entries[i].key);
      }
    }
  }

  /**
   * Get cache file path for a key
   */
  private getCacheFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.cacheDir, `${safeKey}_${hash}.json`);
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}