export interface MigrationStep {
  id: string;
  version: string;
  description: string;
  up: (config: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>;
  down?: (config: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>;
  validate?: (config: Record<string, any>) => boolean | Promise<boolean>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  appliedMigrations: string[];
  errors: string[];
  warnings: string[];
  config: Record<string, any>;
}

export interface MigrationHistory {
  version: string;
  appliedAt: Date;
  migrationId: string;
  description: string;
  checksum: string;
}

export class ConfigMigrations {
  private migrations: Map<string, MigrationStep> = new Map();
  private migrationHistory: MigrationHistory[] = [];

  constructor() {
    this.registerDefaultMigrations();
  }

  registerMigration(migration: MigrationStep): void {
    this.migrations.set(migration.id, migration);
  }

  async migrate(config: Record<string, any>, targetVersion: string): Promise<Record<string, any>> {
    const currentVersion = this.getCurrentVersion(config);

    if (currentVersion === targetVersion) {
      return config;
    }

    const result = await this.performMigration(config, currentVersion, targetVersion);

    if (!result.success) {
      throw new Error(`Migration failed: ${result.errors.join(', ')}`);
    }

    return result.config;
  }

  async performMigration(
    config: Record<string, any>,
    fromVersion: string,
    toVersion: string
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      fromVersion,
      toVersion,
      appliedMigrations: [],
      errors: [],
      warnings: [],
      config: { ...config }
    };

    try {
      const migrationChain = this.getMigrationChain(fromVersion, toVersion);

      for (const migrationId of migrationChain) {
        const migration = this.migrations.get(migrationId);
        if (!migration) {
          result.errors.push(`Migration not found: ${migrationId}`);
          result.success = false;
          continue;
        }

        // Validate before migration if validator exists
        if (migration.validate) {
          const isValid = await migration.validate(result.config);
          if (!isValid) {
            result.errors.push(`Pre-migration validation failed for ${migrationId}`);
            result.success = false;
            break;
          }
        }

        // Apply migration
        try {
          result.config = await migration.up(result.config);
          result.appliedMigrations.push(migrationId);

          // Record migration in history
          this.recordMigration(migration, result.config);

        } catch (error) {
          result.errors.push(`Migration ${migrationId} failed: ${error.message}`);
          result.success = false;
          break;
        }
      }

      // Set the target version in config
      if (result.success) {
        result.config._version = toVersion;
      }

    } catch (error) {
      result.errors.push(`Migration process failed: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  async rollback(config: Record<string, any>, targetVersion: string): Promise<Record<string, any>> {
    const currentVersion = this.getCurrentVersion(config);
    const migrationChain = this.getMigrationChain(targetVersion, currentVersion).reverse();

    let rolledBackConfig = { ...config };

    for (const migrationId of migrationChain) {
      const migration = this.migrations.get(migrationId);
      if (!migration || !migration.down) {
        throw new Error(`Rollback not supported for migration: ${migrationId}`);
      }

      rolledBackConfig = await migration.down(rolledBackConfig);
    }

    rolledBackConfig._version = targetVersion;
    return rolledBackConfig;
  }

  private getMigrationChain(fromVersion: string, toVersion: string): string[] {
    // This is a simplified implementation
    // In a real scenario, you'd have a proper version comparison and chain building
    const versionMigrations: Record<string, string[]> = {
      '1.0.0': [],
      '1.1.0': ['migrate_1_0_to_1_1'],
      '1.2.0': ['migrate_1_0_to_1_1', 'migrate_1_1_to_1_2'],
      '2.0.0': ['migrate_1_0_to_1_1', 'migrate_1_1_to_1_2', 'migrate_1_2_to_2_0']
    };

    const fromMigrations = versionMigrations[fromVersion] || [];
    const toMigrations = versionMigrations[toVersion] || [];

    // Return migrations needed to go from fromVersion to toVersion
    return toMigrations.slice(fromMigrations.length);
  }

  private getCurrentVersion(config: Record<string, any>): string {
    return config._version || '1.0.0';
  }

  private recordMigration(migration: MigrationStep, config: Record<string, any>): void {
    const crypto = require('crypto');
    const configString = JSON.stringify(config, Object.keys(config).sort());
    const checksum = crypto.createHash('sha256').update(configString).digest('hex');

    this.migrationHistory.push({
      version: migration.version,
      appliedAt: new Date(),
      migrationId: migration.id,
      description: migration.description,
      checksum
    });
  }

  private registerDefaultMigrations(): void {
    // Migration from 1.0 to 1.1: Restructure authentication config
    this.registerMigration({
      id: 'migrate_1_0_to_1_1',
      version: '1.1.0',
      description: 'Restructure authentication configuration',
      up: (config) => {
        const newConfig = { ...config };

        // Move auth.secret to auth.jwt.secret
        if (newConfig.auth?.secret) {
          if (!newConfig.auth.jwt) {
            newConfig.auth.jwt = {};
          }
          newConfig.auth.jwt.secret = newConfig.auth.secret;
          delete newConfig.auth.secret;
        }

        // Add default JWT expiration if not present
        if (newConfig.auth?.jwt && !newConfig.auth.jwt.expiresIn) {
          newConfig.auth.jwt.expiresIn = '1h';
        }

        return newConfig;
      },
      down: (config) => {
        const newConfig = { ...config };

        // Move auth.jwt.secret back to auth.secret
        if (newConfig.auth?.jwt?.secret) {
          newConfig.auth.secret = newConfig.auth.jwt.secret;
          delete newConfig.auth.jwt.secret;

          // Remove jwt object if it's empty
          if (Object.keys(newConfig.auth.jwt).length === 0) {
            delete newConfig.auth.jwt;
          }
        }

        return newConfig;
      }
    });

    // Migration from 1.1 to 1.2: Add cache configuration
    this.registerMigration({
      id: 'migrate_1_1_to_1_2',
      version: '1.2.0',
      description: 'Add cache configuration structure',
      up: (config) => {
        const newConfig = { ...config };

        // Add default cache configuration if not present
        if (!newConfig.cache) {
          newConfig.cache = {
            provider: 'memory',
            ttl: 3600
          };
        }

        // Migrate old redis config if it exists
        if (newConfig.redis) {
          newConfig.cache = {
            provider: 'redis',
            ttl: newConfig.cache?.ttl || 3600,
            redis: {
              url: newConfig.redis.url || 'redis://localhost:6379',
              keyPrefix: newConfig.redis.keyPrefix || 'grafity:'
            }
          };
          delete newConfig.redis;
        }

        return newConfig;
      },
      down: (config) => {
        const newConfig = { ...config };

        // Move redis config back to top level
        if (newConfig.cache?.provider === 'redis' && newConfig.cache.redis) {
          newConfig.redis = newConfig.cache.redis;
        }

        delete newConfig.cache;
        return newConfig;
      }
    });

    // Migration from 1.2 to 2.0: Major restructuring
    this.registerMigration({
      id: 'migrate_1_2_to_2_0',
      version: '2.0.0',
      description: 'Major configuration restructuring for v2.0',
      up: (config) => {
        const newConfig = { ...config };

        // Restructure logging configuration
        if (newConfig.logging) {
          const oldLogging = newConfig.logging;
          newConfig.logging = {
            level: oldLogging.level || 'info',
            format: oldLogging.format || 'json',
            transports: []
          };

          // Convert old file logging config
          if (oldLogging.file) {
            newConfig.logging.transports.push({
              type: 'file',
              filename: oldLogging.file.filename || 'app.log',
              level: oldLogging.file.level || newConfig.logging.level,
              maxSize: oldLogging.file.maxSize || '10m',
              maxFiles: oldLogging.file.maxFiles || 5
            });
          }

          // Add console transport if not disabled
          if (oldLogging.console !== false) {
            newConfig.logging.transports.push({
              type: 'console',
              level: oldLogging.console?.level || newConfig.logging.level
            });
          }
        }

        // Add new feature flags section
        if (!newConfig.features) {
          newConfig.features = {
            graphDiffing: true,
            semanticSearch: true,
            patternLearning: true,
            codeGeneration: true,
            backgroundProcessing: true
          };
        }

        // Add new security configuration
        if (!newConfig.security) {
          newConfig.security = {
            encryption: {
              enabled: true,
              algorithm: 'aes-256-gcm'
            },
            rateLimit: {
              enabled: true,
              windowMs: 900000,
              max: 100
            }
          };
        }

        // Add performance monitoring configuration
        if (!newConfig.performance) {
          newConfig.performance = {
            monitoring: {
              enabled: true,
              interval: 5000
            },
            maxConcurrency: 100,
            timeout: 30000
          };
        }

        return newConfig;
      },
      down: (config) => {
        const newConfig = { ...config };

        // Revert logging structure
        if (newConfig.logging?.transports) {
          const fileTransport = newConfig.logging.transports.find(t => t.type === 'file');
          const consoleTransport = newConfig.logging.transports.find(t => t.type === 'console');

          newConfig.logging = {
            level: newConfig.logging.level,
            format: newConfig.logging.format
          };

          if (fileTransport) {
            newConfig.logging.file = {
              filename: fileTransport.filename,
              level: fileTransport.level,
              maxSize: fileTransport.maxSize,
              maxFiles: fileTransport.maxFiles
            };
          }

          if (consoleTransport) {
            newConfig.logging.console = {
              level: consoleTransport.level
            };
          }
        }

        // Remove v2.0 specific sections
        delete newConfig.features;
        delete newConfig.security;
        delete newConfig.performance;

        return newConfig;
      },
      validate: (config) => {
        // Ensure required fields exist before migration
        return config && typeof config === 'object';
      }
    });

    // Migration for environment-specific changes
    this.registerMigration({
      id: 'migrate_env_specific',
      version: '2.1.0',
      description: 'Add environment-specific configuration overrides',
      up: (config) => {
        const newConfig = { ...config };

        // Add environment detection if not present
        if (!newConfig.environment) {
          newConfig.environment = process.env.NODE_ENV || 'development';
        }

        // Add development-specific defaults
        if (!newConfig.development && newConfig.environment === 'development') {
          newConfig.development = {
            hotReload: true,
            debugMode: false,
            mockServices: false
          };
        }

        // Ensure production settings are secure
        if (newConfig.environment === 'production') {
          if (newConfig.development) {
            newConfig.development.debugMode = false;
            newConfig.development.mockServices = false;
          }

          // Ensure secure defaults for production
          if (newConfig.security) {
            newConfig.security.encryption.enabled = true;
            newConfig.security.rateLimit.enabled = true;
          }
        }

        return newConfig;
      }
    });

    // Migration for API configuration updates
    this.registerMigration({
      id: 'migrate_api_config',
      version: '2.2.0',
      description: 'Update API configuration structure',
      up: (config) => {
        const newConfig = { ...config };

        // Add API configuration if not present
        if (!newConfig.api) {
          newConfig.api = {
            version: 'v1',
            prefix: '/api',
            documentation: {
              enabled: true,
              path: '/docs'
            }
          };
        }

        // Move old server.apiPrefix to api.prefix
        if (newConfig.server?.apiPrefix) {
          newConfig.api.prefix = newConfig.server.apiPrefix;
          delete newConfig.server.apiPrefix;
        }

        return newConfig;
      }
    });

    // Migration for plugin system configuration
    this.registerMigration({
      id: 'migrate_plugins_config',
      version: '2.3.0',
      description: 'Add plugin system configuration',
      up: (config) => {
        const newConfig = { ...config };

        // Add plugins configuration
        if (!newConfig.plugins) {
          newConfig.plugins = {
            enabled: true,
            directory: './plugins',
            autoload: true,
            sandbox: {
              enabled: true,
              timeout: 30000
            }
          };
        }

        return newConfig;
      }
    });

    // Migration for external services configuration
    this.registerMigration({
      id: 'migrate_services_config',
      version: '2.4.0',
      description: 'Add external services configuration',
      up: (config) => {
        const newConfig = { ...config };

        // Add services configuration
        if (!newConfig.services) {
          newConfig.services = {};
        }

        // Move old OpenAI config
        if (newConfig.openai) {
          newConfig.services.openai = newConfig.openai;
          delete newConfig.openai;
        }

        // Move old GitHub config
        if (newConfig.github) {
          newConfig.services.github = newConfig.github;
          delete newConfig.github;
        }

        // Move old Confluence config
        if (newConfig.confluence) {
          newConfig.services.confluence = newConfig.confluence;
          delete newConfig.confluence;
        }

        return newConfig;
      }
    });
  }

  getAvailableMigrations(): MigrationStep[] {
    return Array.from(this.migrations.values());
  }

  getMigrationHistory(): MigrationHistory[] {
    return [...this.migrationHistory];
  }

  validateMigrationChain(fromVersion: string, toVersion: string): boolean {
    try {
      const chain = this.getMigrationChain(fromVersion, toVersion);
      return chain.every(migrationId => this.migrations.has(migrationId));
    } catch {
      return false;
    }
  }

  async dryRun(config: Record<string, any>, targetVersion: string): Promise<MigrationResult> {
    const currentVersion = this.getCurrentVersion(config);

    // Perform migration on a copy without recording history
    const originalHistory = [...this.migrationHistory];

    try {
      const result = await this.performMigration(config, currentVersion, targetVersion);
      return result;
    } finally {
      // Restore original history
      this.migrationHistory = originalHistory;
    }
  }

  exportMigrationScript(fromVersion: string, toVersion: string): string {
    const migrationChain = this.getMigrationChain(fromVersion, toVersion);
    const migrations = migrationChain.map(id => this.migrations.get(id)).filter(Boolean);

    const script = `
// Configuration Migration Script
// From version: ${fromVersion}
// To version: ${toVersion}
// Generated: ${new Date().toISOString()}

const migrations = [
${migrations.map(m => `
  {
    id: '${m.id}',
    version: '${m.version}',
    description: '${m.description}',
    up: ${m.up.toString()}
  }`).join(',\n')}
];

async function migrateConfig(config) {
  let result = { ...config };

  for (const migration of migrations) {
    console.log(\`Applying migration: \${migration.description}\`);
    result = await migration.up(result);
  }

  result._version = '${toVersion}';
  return result;
}

module.exports = { migrateConfig };
`;

    return script;
  }
}