export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  default?: any;
  required?: boolean;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  additionalProperties?: boolean | SchemaProperty;
  examples?: any[];
  format?: string;
  deprecated?: boolean;
  sensitive?: boolean; // Mark as sensitive data (will be encrypted/masked)
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedConfig?: Record<string, any>;
}

export class ConfigSchema {
  private schema: Record<string, SchemaProperty> = {};

  constructor() {
    this.defineDefaultSchema();
  }

  defineProperty(path: string, property: SchemaProperty): void {
    this.schema[path] = property;
  }

  getProperty(path: string): SchemaProperty | undefined {
    return this.schema[path];
  }

  getAllProperties(): Record<string, SchemaProperty> {
    return { ...this.schema };
  }

  removeProperty(path: string): boolean {
    return delete this.schema[path];
  }

  hasProperty(path: string): boolean {
    return path in this.schema;
  }

  private defineDefaultSchema(): void {
    // Server Configuration
    this.defineProperty('server.port', {
      type: 'number',
      description: 'Server port number',
      default: 3000,
      minimum: 1,
      maximum: 65535,
      examples: [3000, 8080, 8443]
    });

    this.defineProperty('server.host', {
      type: 'string',
      description: 'Server host address',
      default: 'localhost',
      examples: ['localhost', '0.0.0.0', '127.0.0.1']
    });

    this.defineProperty('server.cors.enabled', {
      type: 'boolean',
      description: 'Enable CORS support',
      default: true
    });

    this.defineProperty('server.cors.origins', {
      type: 'array',
      description: 'Allowed CORS origins',
      default: ['*'],
      items: {
        type: 'string'
      },
      examples: [['*'], ['http://localhost:3000', 'https://app.example.com']]
    });

    // Database Configuration
    this.defineProperty('database.type', {
      type: 'string',
      description: 'Database type',
      default: 'sqlite',
      enum: ['sqlite', 'postgresql', 'mysql', 'mongodb', 'redis'],
      required: true
    });

    this.defineProperty('database.url', {
      type: 'string',
      description: 'Database connection URL',
      sensitive: true,
      examples: [
        'sqlite://./data.db',
        'postgresql://user:pass@localhost:5432/dbname',
        'mongodb://localhost:27017/dbname'
      ]
    });

    this.defineProperty('database.pool.min', {
      type: 'number',
      description: 'Minimum pool size',
      default: 2,
      minimum: 1
    });

    this.defineProperty('database.pool.max', {
      type: 'number',
      description: 'Maximum pool size',
      default: 10,
      minimum: 1
    });

    this.defineProperty('database.ssl', {
      type: 'boolean',
      description: 'Use SSL for database connection',
      default: false
    });

    // Authentication Configuration
    this.defineProperty('auth.provider', {
      type: 'string',
      description: 'Authentication provider',
      default: 'local',
      enum: ['local', 'oauth', 'ldap', 'saml']
    });

    this.defineProperty('auth.jwt.secret', {
      type: 'string',
      description: 'JWT signing secret',
      sensitive: true,
      minLength: 32,
      required: true
    });

    this.defineProperty('auth.jwt.expiresIn', {
      type: 'string',
      description: 'JWT expiration time',
      default: '1h',
      pattern: '^\\d+[smhd]$',
      examples: ['15m', '1h', '24h', '7d']
    });

    this.defineProperty('auth.mfa.enabled', {
      type: 'boolean',
      description: 'Enable multi-factor authentication',
      default: false
    });

    this.defineProperty('auth.mfa.provider', {
      type: 'string',
      description: 'MFA provider type',
      default: 'totp',
      enum: ['totp', 'sms', 'email']
    });

    // OAuth Configuration
    this.defineProperty('auth.oauth.clientId', {
      type: 'string',
      description: 'OAuth client ID',
      sensitive: true
    });

    this.defineProperty('auth.oauth.clientSecret', {
      type: 'string',
      description: 'OAuth client secret',
      sensitive: true
    });

    this.defineProperty('auth.oauth.callbackUrl', {
      type: 'string',
      description: 'OAuth callback URL',
      format: 'uri'
    });

    // Logging Configuration
    this.defineProperty('logging.level', {
      type: 'string',
      description: 'Log level',
      default: 'info',
      enum: ['error', 'warn', 'info', 'debug', 'trace']
    });

    this.defineProperty('logging.format', {
      type: 'string',
      description: 'Log format',
      default: 'json',
      enum: ['json', 'text', 'structured']
    });

    this.defineProperty('logging.transports', {
      type: 'array',
      description: 'Log transport configurations',
      default: [{ type: 'console' }],
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['console', 'file', 'http', 'database']
          },
          filename: { type: 'string' },
          level: { type: 'string' },
          maxSize: { type: 'string' },
          maxFiles: { type: 'number' }
        }
      }
    });

    // Cache Configuration
    this.defineProperty('cache.provider', {
      type: 'string',
      description: 'Cache provider',
      default: 'memory',
      enum: ['memory', 'redis', 'memcached']
    });

    this.defineProperty('cache.ttl', {
      type: 'number',
      description: 'Default cache TTL in seconds',
      default: 3600,
      minimum: 1
    });

    this.defineProperty('cache.redis.url', {
      type: 'string',
      description: 'Redis connection URL',
      sensitive: true,
      examples: ['redis://localhost:6379', 'redis://user:pass@host:port/db']
    });

    this.defineProperty('cache.redis.keyPrefix', {
      type: 'string',
      description: 'Redis key prefix',
      default: 'grafity:'
    });

    // Performance Configuration
    this.defineProperty('performance.monitoring.enabled', {
      type: 'boolean',
      description: 'Enable performance monitoring',
      default: true
    });

    this.defineProperty('performance.monitoring.interval', {
      type: 'number',
      description: 'Monitoring interval in milliseconds',
      default: 5000,
      minimum: 1000
    });

    this.defineProperty('performance.maxConcurrency', {
      type: 'number',
      description: 'Maximum concurrent operations',
      default: 100,
      minimum: 1
    });

    this.defineProperty('performance.timeout', {
      type: 'number',
      description: 'Default operation timeout in milliseconds',
      default: 30000,
      minimum: 1000
    });

    // Plugin Configuration
    this.defineProperty('plugins.enabled', {
      type: 'boolean',
      description: 'Enable plugin system',
      default: true
    });

    this.defineProperty('plugins.directory', {
      type: 'string',
      description: 'Plugin directory path',
      default: './plugins'
    });

    this.defineProperty('plugins.autoload', {
      type: 'boolean',
      description: 'Automatically load plugins on startup',
      default: true
    });

    this.defineProperty('plugins.sandbox.enabled', {
      type: 'boolean',
      description: 'Enable plugin sandboxing',
      default: true
    });

    this.defineProperty('plugins.sandbox.timeout', {
      type: 'number',
      description: 'Plugin execution timeout in milliseconds',
      default: 30000,
      minimum: 1000
    });

    // Security Configuration
    this.defineProperty('security.encryption.enabled', {
      type: 'boolean',
      description: 'Enable data encryption',
      default: true
    });

    this.defineProperty('security.encryption.algorithm', {
      type: 'string',
      description: 'Encryption algorithm',
      default: 'aes-256-gcm',
      enum: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305']
    });

    this.defineProperty('security.rateLimit.enabled', {
      type: 'boolean',
      description: 'Enable rate limiting',
      default: true
    });

    this.defineProperty('security.rateLimit.windowMs', {
      type: 'number',
      description: 'Rate limit window in milliseconds',
      default: 900000, // 15 minutes
      minimum: 1000
    });

    this.defineProperty('security.rateLimit.max', {
      type: 'number',
      description: 'Maximum requests per window',
      default: 100,
      minimum: 1
    });

    // API Configuration
    this.defineProperty('api.version', {
      type: 'string',
      description: 'API version',
      default: 'v1',
      pattern: '^v\\d+$'
    });

    this.defineProperty('api.prefix', {
      type: 'string',
      description: 'API path prefix',
      default: '/api',
      pattern: '^/.*'
    });

    this.defineProperty('api.documentation.enabled', {
      type: 'boolean',
      description: 'Enable API documentation',
      default: true
    });

    this.defineProperty('api.documentation.path', {
      type: 'string',
      description: 'API documentation path',
      default: '/docs'
    });

    // External Services Configuration
    this.defineProperty('services.openai.apiKey', {
      type: 'string',
      description: 'OpenAI API key',
      sensitive: true
    });

    this.defineProperty('services.openai.model', {
      type: 'string',
      description: 'OpenAI model to use',
      default: 'gpt-3.5-turbo',
      examples: ['gpt-3.5-turbo', 'gpt-4', 'text-embedding-ada-002']
    });

    this.defineProperty('services.github.token', {
      type: 'string',
      description: 'GitHub API token',
      sensitive: true
    });

    this.defineProperty('services.confluence.baseUrl', {
      type: 'string',
      description: 'Confluence base URL',
      format: 'uri'
    });

    this.defineProperty('services.confluence.username', {
      type: 'string',
      description: 'Confluence username'
    });

    this.defineProperty('services.confluence.token', {
      type: 'string',
      description: 'Confluence API token',
      sensitive: true
    });

    // Feature Flags
    this.defineProperty('features.graphDiffing', {
      type: 'boolean',
      description: 'Enable graph diffing features',
      default: true
    });

    this.defineProperty('features.semanticSearch', {
      type: 'boolean',
      description: 'Enable semantic search',
      default: true
    });

    this.defineProperty('features.patternLearning', {
      type: 'boolean',
      description: 'Enable pattern learning',
      default: true
    });

    this.defineProperty('features.codeGeneration', {
      type: 'boolean',
      description: 'Enable code generation',
      default: true
    });

    this.defineProperty('features.backgroundProcessing', {
      type: 'boolean',
      description: 'Enable background processing',
      default: true
    });

    // Development Configuration
    this.defineProperty('development.hotReload', {
      type: 'boolean',
      description: 'Enable hot reload in development',
      default: true
    });

    this.defineProperty('development.debugMode', {
      type: 'boolean',
      description: 'Enable debug mode',
      default: false
    });

    this.defineProperty('development.mockServices', {
      type: 'boolean',
      description: 'Use mock external services',
      default: false
    });

    // Environment-specific defaults
    this.defineProperty('environment', {
      type: 'string',
      description: 'Application environment',
      default: 'development',
      enum: ['development', 'staging', 'production', 'test']
    });
  }

  generateJsonSchema(): any {
    const jsonSchema: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {},
      required: []
    };

    for (const [path, property] of Object.entries(this.schema)) {
      this.addPropertyToJsonSchema(jsonSchema, path, property);

      if (property.required) {
        const topLevelKey = path.split('.')[0];
        if (!jsonSchema.required.includes(topLevelKey)) {
          jsonSchema.required.push(topLevelKey);
        }
      }
    }

    return jsonSchema;
  }

  private addPropertyToJsonSchema(schema: any, path: string, property: SchemaProperty): void {
    const parts = path.split('.');
    let current = schema.properties;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {
          type: 'object',
          properties: {}
        };
      }
      current = current[part].properties;
    }

    const finalKey = parts[parts.length - 1];
    current[finalKey] = this.convertToJsonSchemaProperty(property);
  }

  private convertToJsonSchemaProperty(property: SchemaProperty): any {
    const jsonProperty: any = {
      type: property.type
    };

    if (property.description) jsonProperty.description = property.description;
    if (property.default !== undefined) jsonProperty.default = property.default;
    if (property.enum) jsonProperty.enum = property.enum;
    if (property.minimum !== undefined) jsonProperty.minimum = property.minimum;
    if (property.maximum !== undefined) jsonProperty.maximum = property.maximum;
    if (property.minLength !== undefined) jsonProperty.minLength = property.minLength;
    if (property.maxLength !== undefined) jsonProperty.maxLength = property.maxLength;
    if (property.pattern) jsonProperty.pattern = property.pattern;
    if (property.format) jsonProperty.format = property.format;
    if (property.examples) jsonProperty.examples = property.examples;

    if (property.type === 'array' && property.items) {
      jsonProperty.items = this.convertToJsonSchemaProperty(property.items);
    }

    if (property.type === 'object') {
      if (property.properties) {
        jsonProperty.properties = {};
        for (const [key, prop] of Object.entries(property.properties)) {
          jsonProperty.properties[key] = this.convertToJsonSchemaProperty(prop);
        }
      }
      if (property.additionalProperties !== undefined) {
        if (typeof property.additionalProperties === 'boolean') {
          jsonProperty.additionalProperties = property.additionalProperties;
        } else {
          jsonProperty.additionalProperties = this.convertToJsonSchemaProperty(property.additionalProperties);
        }
      }
    }

    return jsonProperty;
  }

  exportSchema(format: 'json' | 'typescript' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.generateJsonSchema(), null, 2);

      case 'typescript':
        return this.generateTypeScriptInterface();

      default:
        throw new Error(`Unsupported schema format: ${format}`);
    }
  }

  private generateTypeScriptInterface(): string {
    const lines: string[] = [];
    lines.push('export interface GrafityConfig {');

    const processedPaths = new Set<string>();

    for (const path of Object.keys(this.schema).sort()) {
      const parts = path.split('.');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}.${part}` : part;

        if (processedPaths.has(currentPath)) continue;
        processedPaths.add(currentPath);

        const property = this.schema[currentPath];
        const indent = '  '.repeat(i + 1);

        if (i === parts.length - 1 && property) {
          // Leaf property
          const tsType = this.convertToTypeScriptType(property);
          const optional = !property.required ? '?' : '';
          const comment = property.description ? ` // ${property.description}` : '';
          lines.push(`${indent}${part}${optional}: ${tsType};${comment}`);
        } else if (i < parts.length - 1) {
          // Nested object
          const optional = this.isOptionalParent(currentPath) ? '?' : '';
          lines.push(`${indent}${part}${optional}: {`);

          // Find the closing brace position
          let j = i + 1;
          while (j < parts.length - 1) {
            j++;
          }
          // We'll close this in the next iteration or at the end
        }
      }
    }

    // Close any remaining braces
    const maxDepth = Math.max(...Object.keys(this.schema).map(path => path.split('.').length));
    for (let i = maxDepth; i > 0; i--) {
      const indent = '  '.repeat(i);
      if (i > 1) lines.push(`${indent}}`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private convertToTypeScriptType(property: SchemaProperty): string {
    switch (property.type) {
      case 'string':
        if (property.enum) {
          return property.enum.map(v => `'${v}'`).join(' | ');
        }
        return 'string';

      case 'number':
        return 'number';

      case 'boolean':
        return 'boolean';

      case 'array':
        if (property.items) {
          return `${this.convertToTypeScriptType(property.items)}[]`;
        }
        return 'any[]';

      case 'object':
        if (property.properties) {
          const props = Object.entries(property.properties)
            .map(([key, prop]) => {
              const optional = !prop.required ? '?' : '';
              return `${key}${optional}: ${this.convertToTypeScriptType(prop)}`;
            });
          return `{ ${props.join('; ')} }`;
        }
        return 'Record<string, any>';

      case 'null':
        return 'null';

      default:
        return 'any';
    }
  }

  private isOptionalParent(path: string): boolean {
    // Check if any property under this path is required
    return !Object.keys(this.schema).some(key =>
      key.startsWith(path + '.') && this.schema[key].required
    );
  }
}