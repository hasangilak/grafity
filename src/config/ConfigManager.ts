import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { ConfigSchema, ConfigValidationResult } from './ConfigSchema';
import { ConfigValidator } from './ConfigValidator';
import { ConfigMigrations } from './ConfigMigrations';

export interface ConfigSource {
  type: 'file' | 'env' | 'remote' | 'database';
  path?: string;
  url?: string;
  priority: number;
  watch?: boolean;
  format?: 'json' | 'yaml' | 'toml' | 'ini';
}

export interface ConfigValue {
  value: any;
  source: string;
  lastUpdated: Date;
  metadata?: Record<string, any>;
}

export interface ConfigChange {
  key: string;
  oldValue: any;
  newValue: any;
  source: string;
  timestamp: Date;
  reason: 'reload' | 'update' | 'migration' | 'fallback';
}

export interface ConfigSnapshot {
  id: string;
  timestamp: Date;
  version: string;
  config: Record<string, any>;
  checksum: string;
}

export interface ConfigManagerOptions {
  baseDir: string;
  environment: string;
  enableHotReload: boolean;
  enableValidation: boolean;
  enableMigrations: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  enableRemoteConfig: boolean;
  remoteConfigUrl?: string;
  watchDebounceMs: number;
  maxSnapshots: number;
  enableFallback: boolean;
  fallbackConfig?: Record<string, any>;
}

export class ConfigManager extends EventEmitter {
  private config: Map<string, ConfigValue> = new Map();
  private sources: ConfigSource[] = [];
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private schema: ConfigSchema;
  private validator: ConfigValidator;
  private migrations: ConfigMigrations;
  private options: ConfigManagerOptions;
  private snapshots: ConfigSnapshot[] = [];
  private configVersion: string = '1.0.0';
  private isLoaded: boolean = false;
  private loadPromise?: Promise<void>;

  constructor(options: Partial<ConfigManagerOptions> = {}) {
    super();

    this.options = {
      baseDir: options.baseDir || './config',
      environment: options.environment || process.env.NODE_ENV || 'development',
      enableHotReload: options.enableHotReload ?? true,
      enableValidation: options.enableValidation ?? true,
      enableMigrations: options.enableMigrations ?? true,
      enableEncryption: options.enableEncryption ?? false,
      encryptionKey: options.encryptionKey,
      enableRemoteConfig: options.enableRemoteConfig ?? false,
      remoteConfigUrl: options.remoteConfigUrl,
      watchDebounceMs: options.watchDebounceMs || 1000,
      maxSnapshots: options.maxSnapshots || 10,
      enableFallback: options.enableFallback ?? true,
      fallbackConfig: options.fallbackConfig || {},
      ...options
    };

    this.schema = new ConfigSchema();
    this.validator = new ConfigValidator(this.schema);
    this.migrations = new ConfigMigrations();

    this.setupDefaultSources();
  }

  async initialize(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.performInitialization();
    return this.loadPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      // Load configuration from all sources
      await this.loadAllSources();

      // Run migrations if enabled
      if (this.options.enableMigrations) {
        await this.runMigrations();
      }

      // Validate configuration if enabled
      if (this.options.enableValidation) {
        await this.validateConfiguration();
      }

      // Setup hot reload if enabled
      if (this.options.enableHotReload) {
        this.setupHotReload();
      }

      // Create initial snapshot
      await this.createSnapshot('initial');

      this.isLoaded = true;
      this.emit('config:loaded', this.getAllConfig());

    } catch (error) {
      if (this.options.enableFallback) {
        await this.loadFallbackConfig();
        this.emit('config:fallback', error);
      } else {
        throw error;
      }
    }
  }

  addSource(source: ConfigSource): void {
    // Insert source in priority order (higher priority first)
    const insertIndex = this.sources.findIndex(s => s.priority < source.priority);
    if (insertIndex === -1) {
      this.sources.push(source);
    } else {
      this.sources.splice(insertIndex, 0, source);
    }

    if (this.isLoaded) {
      this.loadSource(source);
    }
  }

  removeSource(sourcePath: string): void {
    this.sources = this.sources.filter(source =>
      source.path !== sourcePath && source.url !== sourcePath
    );

    // Stop watching if applicable
    const watcher = this.watchers.get(sourcePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sourcePath);
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const configValue = this.config.get(key);

    if (configValue !== undefined) {
      return configValue.value as T;
    }

    // Check for nested keys
    const parts = key.split('.');
    let current: any = this.getAllConfig();

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue as T;
      }
    }

    return current as T;
  }

  async set(key: string, value: any, source: string = 'runtime'): Promise<void> {
    const oldValue = this.config.get(key)?.value;

    this.config.set(key, {
      value,
      source,
      lastUpdated: new Date(),
      metadata: {}
    });

    const change: ConfigChange = {
      key,
      oldValue,
      newValue: value,
      source,
      timestamp: new Date(),
      reason: 'update'
    };

    // Validate the change if validation is enabled
    if (this.options.enableValidation) {
      const validation = await this.validator.validateValue(key, value);
      if (!validation.isValid) {
        // Revert the change
        if (oldValue !== undefined) {
          this.config.set(key, {
            value: oldValue,
            source: this.config.get(key)?.source || 'unknown',
            lastUpdated: new Date(),
            metadata: {}
          });
        } else {
          this.config.delete(key);
        }
        throw new Error(`Configuration validation failed for ${key}: ${validation.errors.join(', ')}`);
      }
    }

    this.emit('config:changed', change);
    this.emit(`config:changed:${key}`, change);

    // Create snapshot for significant changes
    if (this.isSignificantChange(key)) {
      await this.createSnapshot('update');
    }
  }

  has(key: string): boolean {
    return this.config.has(key) || this.hasNestedKey(key);
  }

  delete(key: string): boolean {
    const existed = this.config.has(key);
    if (existed) {
      const oldValue = this.config.get(key)?.value;
      this.config.delete(key);

      const change: ConfigChange = {
        key,
        oldValue,
        newValue: undefined,
        source: 'runtime',
        timestamp: new Date(),
        reason: 'update'
      };

      this.emit('config:changed', change);
      this.emit(`config:changed:${key}`, change);
    }
    return existed;
  }

  getAllConfig(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, configValue] of this.config.entries()) {
      this.setNestedValue(result, key, configValue.value);
    }

    return result;
  }

  getConfigInfo(key: string): ConfigValue | undefined {
    return this.config.get(key);
  }

  async reload(): Promise<void> {
    this.emit('config:reloading');

    try {
      await this.loadAllSources();

      if (this.options.enableValidation) {
        await this.validateConfiguration();
      }

      await this.createSnapshot('reload');
      this.emit('config:reloaded', this.getAllConfig());

    } catch (error) {
      this.emit('config:reload:error', error);
      throw error;
    }
  }

  async validateConfiguration(): Promise<ConfigValidationResult> {
    const config = this.getAllConfig();
    const result = await this.validator.validate(config);

    if (!result.isValid) {
      this.emit('config:validation:failed', result);
      if (this.options.enableValidation) {
        throw new Error(`Configuration validation failed: ${result.errors.join(', ')}`);
      }
    }

    return result;
  }

  async createSnapshot(reason: string): Promise<ConfigSnapshot> {
    const config = this.getAllConfig();
    const checksum = this.calculateChecksum(config);

    const snapshot: ConfigSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      version: this.configVersion,
      config,
      checksum
    };

    this.snapshots.push(snapshot);

    // Maintain max snapshots limit
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.options.maxSnapshots);
    }

    this.emit('config:snapshot:created', { snapshot, reason });
    return snapshot;
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Clear current config
    this.config.clear();

    // Restore from snapshot
    for (const [key, value] of Object.entries(snapshot.config)) {
      this.config.set(key, {
        value,
        source: 'snapshot',
        lastUpdated: snapshot.timestamp,
        metadata: { snapshotId }
      });
    }

    this.emit('config:restored', { snapshot });
  }

  getSnapshots(): ConfigSnapshot[] {
    return [...this.snapshots];
  }

  async exportConfig(format: 'json' | 'yaml' | 'env' = 'json'): Promise<string> {
    const config = this.getAllConfig();

    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);

      case 'yaml':
        const yaml = require('yaml');
        return yaml.stringify(config);

      case 'env':
        return this.toEnvFormat(config);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async importConfig(configData: string, format: 'json' | 'yaml' | 'env' = 'json'): Promise<void> {
    let parsedConfig: Record<string, any>;

    switch (format) {
      case 'json':
        parsedConfig = JSON.parse(configData);
        break;

      case 'yaml':
        const yaml = require('yaml');
        parsedConfig = yaml.parse(configData);
        break;

      case 'env':
        parsedConfig = this.fromEnvFormat(configData);
        break;

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    // Validate before importing
    if (this.options.enableValidation) {
      const validation = await this.validator.validate(parsedConfig);
      if (!validation.isValid) {
        throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Import configuration
    for (const [key, value] of Object.entries(parsedConfig)) {
      await this.set(key, value, 'import');
    }

    await this.createSnapshot('import');
  }

  private async loadAllSources(): Promise<void> {
    const loadPromises = this.sources.map(source => this.loadSource(source));
    await Promise.allSettled(loadPromises);
  }

  private async loadSource(source: ConfigSource): Promise<void> {
    try {
      let data: Record<string, any> = {};

      switch (source.type) {
        case 'file':
          data = await this.loadFileSource(source);
          break;
        case 'env':
          data = this.loadEnvSource();
          break;
        case 'remote':
          data = await this.loadRemoteSource(source);
          break;
        case 'database':
          data = await this.loadDatabaseSource(source);
          break;
      }

      // Merge data into config with source priority
      this.mergeConfig(data, source);

      this.emit('config:source:loaded', { source, data });

    } catch (error) {
      this.emit('config:source:error', { source, error });

      if (!this.options.enableFallback) {
        throw error;
      }
    }
  }

  private async loadFileSource(source: ConfigSource): Promise<Record<string, any>> {
    if (!source.path) {
      throw new Error('File source requires path');
    }

    const filePath = path.resolve(source.path);
    const content = await fs.readFile(filePath, 'utf8');
    const format = source.format || this.detectFormat(filePath);

    return this.parseContent(content, format);
  }

  private loadEnvSource(): Record<string, any> {
    const config: Record<string, any> = {};

    // Load environment variables with common prefixes
    const prefixes = ['GRAFITY_', 'APP_', 'CONFIG_'];

    for (const [key, value] of Object.entries(process.env)) {
      for (const prefix of prefixes) {
        if (key.startsWith(prefix)) {
          const configKey = key.substring(prefix.length).toLowerCase().replace(/_/g, '.');
          config[configKey] = this.parseEnvValue(value);
        }
      }
    }

    return config;
  }

  private async loadRemoteSource(source: ConfigSource): Promise<Record<string, any>> {
    if (!source.url) {
      throw new Error('Remote source requires URL');
    }

    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to load remote config: ${response.statusText}`);
    }

    const content = await response.text();
    const format = source.format || 'json';

    return this.parseContent(content, format);
  }

  private async loadDatabaseSource(source: ConfigSource): Promise<Record<string, any>> {
    // Database source implementation would depend on your database setup
    // This is a placeholder for the interface
    return {};
  }

  private parseContent(content: string, format: string): Record<string, any> {
    switch (format) {
      case 'json':
        return JSON.parse(content);

      case 'yaml':
        const yaml = require('yaml');
        return yaml.parse(content);

      case 'toml':
        const toml = require('toml');
        return toml.parse(content);

      case 'ini':
        const ini = require('ini');
        return ini.parse(content);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private detectFormat(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.json': return 'json';
      case '.yaml': case '.yml': return 'yaml';
      case '.toml': return 'toml';
      case '.ini': return 'ini';
      default: return 'json';
    }
  }

  private parseEnvValue(value: string | undefined): any {
    if (!value) return undefined;

    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, return as string
      return value;
    }
  }

  private mergeConfig(data: Record<string, any>, source: ConfigSource): void {
    for (const [key, value] of Object.entries(data)) {
      const existing = this.config.get(key);

      // Only update if this source has higher priority or no existing value
      if (!existing || source.priority >= (existing.metadata?.priority || 0)) {
        this.config.set(key, {
          value,
          source: source.path || source.url || source.type,
          lastUpdated: new Date(),
          metadata: { priority: source.priority }
        });
      }
    }
  }

  private setupDefaultSources(): void {
    const baseDir = this.options.baseDir;
    const env = this.options.environment;

    // Default configuration files in priority order
    this.addSource({
      type: 'file',
      path: path.join(baseDir, 'default.json'),
      priority: 0,
      watch: this.options.enableHotReload
    });

    this.addSource({
      type: 'file',
      path: path.join(baseDir, `${env}.json`),
      priority: 100,
      watch: this.options.enableHotReload
    });

    this.addSource({
      type: 'file',
      path: path.join(baseDir, 'local.json'),
      priority: 200,
      watch: this.options.enableHotReload
    });

    // Environment variables have highest priority
    this.addSource({
      type: 'env',
      priority: 1000
    });

    // Remote config if enabled
    if (this.options.enableRemoteConfig && this.options.remoteConfigUrl) {
      this.addSource({
        type: 'remote',
        url: this.options.remoteConfigUrl,
        priority: 500,
        watch: false
      });
    }
  }

  private setupHotReload(): void {
    const fileSources = this.sources.filter(s => s.type === 'file' && s.watch && s.path);

    for (const source of fileSources) {
      if (!source.path) continue;

      const watcher = chokidar.watch(source.path, {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: this.options.watchDebounceMs,
          pollInterval: 100
        }
      });

      watcher.on('change', async () => {
        try {
          await this.loadSource(source);
          this.emit('config:hot:reload', { source });
        } catch (error) {
          this.emit('config:hot:reload:error', { source, error });
        }
      });

      this.watchers.set(source.path, watcher);
    }
  }

  private async loadFallbackConfig(): Promise<void> {
    if (this.options.fallbackConfig) {
      for (const [key, value] of Object.entries(this.options.fallbackConfig)) {
        this.config.set(key, {
          value,
          source: 'fallback',
          lastUpdated: new Date(),
          metadata: {}
        });
      }
    }
  }

  private async runMigrations(): Promise<void> {
    const currentConfig = this.getAllConfig();
    const migratedConfig = await this.migrations.migrate(currentConfig, this.configVersion);

    if (migratedConfig !== currentConfig) {
      // Apply migrated configuration
      this.config.clear();
      for (const [key, value] of Object.entries(migratedConfig)) {
        this.config.set(key, {
          value,
          source: 'migration',
          lastUpdated: new Date(),
          metadata: {}
        });
      }

      this.emit('config:migrated', { from: currentConfig, to: migratedConfig });
    }
  }

  private hasNestedKey(key: string): boolean {
    const parts = key.split('.');
    let current: any = this.getAllConfig();

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return true;
  }

  private setNestedValue(obj: Record<string, any>, key: string, value: any): void {
    const parts = key.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  private isSignificantChange(key: string): boolean {
    const significantKeys = [
      'database', 'security', 'logging', 'performance',
      'cache', 'redis', 'mongodb', 'auth'
    ];

    return significantKeys.some(sig => key.includes(sig));
  }

  private calculateChecksum(config: Record<string, any>): string {
    const crypto = require('crypto');
    const configString = JSON.stringify(config, Object.keys(config).sort());
    return crypto.createHash('sha256').update(configString).digest('hex');
  }

  private toEnvFormat(config: Record<string, any>, prefix: string = ''): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      const envKey = (prefix + key).toUpperCase().replace(/\./g, '_');

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(...this.toEnvFormat(value, `${prefix}${key}.`).split('\n'));
      } else {
        const envValue = typeof value === 'string' ? value : JSON.stringify(value);
        lines.push(`${envKey}=${envValue}`);
      }
    }

    return lines.join('\n');
  }

  private fromEnvFormat(envData: string): Record<string, any> {
    const config: Record<string, any> = {};
    const lines = envData.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      const configKey = key.toLowerCase().replace(/_/g, '.');

      try {
        config[configKey] = JSON.parse(value);
      } catch {
        config[configKey] = value;
      }
    }

    return config;
  }

  async destroy(): Promise<void> {
    // Close all watchers
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();

    // Clear config
    this.config.clear();
    this.snapshots = [];
    this.isLoaded = false;

    this.emit('config:destroyed');
  }
}