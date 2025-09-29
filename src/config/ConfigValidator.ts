import { ConfigSchema, SchemaProperty, ConfigValidationResult } from './ConfigSchema';

export interface ValidationOptions {
  allowUnknownProperties: boolean;
  coerceTypes: boolean;
  removeAdditional: boolean;
  strict: boolean;
  validateDefaults: boolean;
}

export interface ValidationContext {
  path: string[];
  config: Record<string, any>;
  rootConfig: Record<string, any>;
}

export class ConfigValidator {
  private options: ValidationOptions;

  constructor(
    private schema: ConfigSchema,
    options: Partial<ValidationOptions> = {}
  ) {
    this.options = {
      allowUnknownProperties: false,
      coerceTypes: true,
      removeAdditional: false,
      strict: false,
      validateDefaults: true,
      ...options
    };
  }

  async validate(config: Record<string, any>): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedConfig = this.options.coerceTypes ? { ...config } : config;

    const context: ValidationContext = {
      path: [],
      config: validatedConfig,
      rootConfig: validatedConfig
    };

    // Validate all schema properties
    for (const [path, property] of Object.entries(this.schema.getAllProperties())) {
      const result = await this.validateProperty(path, property, context);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    // Check for unknown properties if not allowed
    if (!this.options.allowUnknownProperties) {
      const unknownErrors = this.findUnknownProperties(validatedConfig);
      errors.push(...unknownErrors);
    }

    // Apply defaults for missing required properties
    if (this.options.validateDefaults) {
      this.applyDefaults(validatedConfig);
    }

    // Validate cross-property dependencies
    const dependencyErrors = await this.validateDependencies(validatedConfig);
    errors.push(...dependencyErrors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedConfig: errors.length === 0 ? validatedConfig : undefined
    };
  }

  async validateValue(path: string, value: any): Promise<ConfigValidationResult> {
    const property = this.schema.getProperty(path);
    if (!property) {
      return {
        isValid: !this.options.strict,
        errors: this.options.strict ? [`Unknown property: ${path}`] : [],
        warnings: this.options.strict ? [] : [`Unknown property: ${path}`]
      };
    }

    const context: ValidationContext = {
      path: path.split('.'),
      config: { [path]: value },
      rootConfig: { [path]: value }
    };

    return await this.validateProperty(path, property, context);
  }

  private async validateProperty(
    path: string,
    property: SchemaProperty,
    context: ValidationContext
  ): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const value = this.getNestedValue(context.config, path);
    const exists = this.hasNestedValue(context.config, path);

    // Check required properties
    if (property.required && !exists) {
      if (property.default !== undefined) {
        this.setNestedValue(context.config, path, property.default);
      } else {
        errors.push(`Required property missing: ${path}`);
        return { isValid: false, errors, warnings };
      }
    }

    // Skip validation if property doesn't exist and is not required
    if (!exists && !property.required) {
      return { isValid: true, errors: [], warnings: [] };
    }

    const actualValue = exists ? value : property.default;

    // Type validation
    const typeResult = this.validateType(actualValue, property, path);
    errors.push(...typeResult.errors);
    warnings.push(...typeResult.warnings);

    if (typeResult.coercedValue !== undefined && this.options.coerceTypes) {
      this.setNestedValue(context.config, path, typeResult.coercedValue);
    }

    // Value constraints validation
    if (errors.length === 0) {
      const constraintResult = this.validateConstraints(
        typeResult.coercedValue ?? actualValue,
        property,
        path
      );
      errors.push(...constraintResult.errors);
      warnings.push(...constraintResult.warnings);
    }

    // Custom validation
    const customResult = await this.validateCustomRules(actualValue, property, path, context);
    errors.push(...customResult.errors);
    warnings.push(...customResult.warnings);

    // Deprecation warning
    if (property.deprecated) {
      warnings.push(`Property '${path}' is deprecated`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateType(value: any, property: SchemaProperty, path: string): {
    errors: string[];
    warnings: string[];
    coercedValue?: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let coercedValue: any;

    if (value === null) {
      if (property.type !== 'null') {
        errors.push(`Expected ${property.type} but got null for ${path}`);
      }
      return { errors, warnings };
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType === property.type) {
      return { errors, warnings };
    }

    // Type coercion
    if (this.options.coerceTypes) {
      coercedValue = this.coerceType(value, property.type);

      if (coercedValue !== undefined) {
        const coercedType = Array.isArray(coercedValue) ? 'array' : typeof coercedValue;
        if (coercedType === property.type) {
          warnings.push(`Coerced ${path} from ${actualType} to ${property.type}`);
          return { errors, warnings, coercedValue };
        }
      }
    }

    errors.push(`Expected ${property.type} but got ${actualType} for ${path}`);
    return { errors, warnings };
  }

  private validateConstraints(value: any, property: SchemaProperty, path: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Enum validation
    if (property.enum && !property.enum.includes(value)) {
      errors.push(`Value '${value}' is not one of allowed values [${property.enum.join(', ')}] for ${path}`);
    }

    // Number constraints
    if (property.type === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        errors.push(`Value ${value} is below minimum ${property.minimum} for ${path}`);
      }
      if (property.maximum !== undefined && value > property.maximum) {
        errors.push(`Value ${value} is above maximum ${property.maximum} for ${path}`);
      }
    }

    // String constraints
    if (property.type === 'string') {
      if (property.minLength !== undefined && value.length < property.minLength) {
        errors.push(`String length ${value.length} is below minimum ${property.minLength} for ${path}`);
      }
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        errors.push(`String length ${value.length} is above maximum ${property.maxLength} for ${path}`);
      }
      if (property.pattern && !new RegExp(property.pattern).test(value)) {
        errors.push(`String '${value}' does not match pattern ${property.pattern} for ${path}`);
      }
    }

    // Format validation
    if (property.format) {
      const formatResult = this.validateFormat(value, property.format, path);
      errors.push(...formatResult.errors);
      warnings.push(...formatResult.warnings);
    }

    // Array validation
    if (property.type === 'array' && Array.isArray(value)) {
      if (property.items) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = this.validateType(value[i], property.items, `${path}[${i}]`);
          errors.push(...itemResult.errors);
          warnings.push(...itemResult.warnings);
        }
      }
    }

    return { errors, warnings };
  }

  private validateFormat(value: string, format: string, path: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (format) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`Invalid email format for ${path}: ${value}`);
        }
        break;

      case 'uri':
        try {
          new URL(value);
        } catch {
          errors.push(`Invalid URI format for ${path}: ${value}`);
        }
        break;

      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push(`Invalid date format for ${path}: ${value}`);
        }
        break;

      case 'ipv4':
        if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)) {
          errors.push(`Invalid IPv4 format for ${path}: ${value}`);
        }
        break;

      case 'ipv6':
        if (!/^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value)) {
          errors.push(`Invalid IPv6 format for ${path}: ${value}`);
        }
        break;

      default:
        warnings.push(`Unknown format '${format}' for ${path}`);
    }

    return { errors, warnings };
  }

  private async validateCustomRules(
    value: any,
    property: SchemaProperty,
    path: string,
    context: ValidationContext
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Custom validation rules based on path and context
    switch (path) {
      case 'database.url':
        if (typeof value === 'string' && !this.isValidDatabaseUrl(value)) {
          errors.push(`Invalid database URL format for ${path}`);
        }
        break;

      case 'auth.jwt.secret':
        if (typeof value === 'string' && value.length < 32) {
          warnings.push(`JWT secret should be at least 32 characters long for security`);
        }
        break;

      case 'server.port':
        if (typeof value === 'number') {
          if (value < 1024 && process.getuid && process.getuid() !== 0) {
            warnings.push(`Port ${value} requires root privileges on Unix systems`);
          }
        }
        break;

      case 'cache.redis.url':
        if (typeof value === 'string' && context.rootConfig['cache.provider'] === 'redis') {
          if (!this.isValidRedisUrl(value)) {
            errors.push(`Invalid Redis URL format when cache provider is redis`);
          }
        }
        break;
    }

    // Environment-specific validations
    const environment = context.rootConfig.environment || 'development';

    if (environment === 'production') {
      if (path === 'development.debugMode' && value === true) {
        warnings.push(`Debug mode should be disabled in production`);
      }

      if (property.sensitive && typeof value === 'string' && value.includes('default')) {
        warnings.push(`Sensitive property '${path}' appears to use default value in production`);
      }
    }

    return { errors, warnings };
  }

  private async validateDependencies(config: Record<string, any>): Promise<string[]> {
    const errors: string[] = [];

    // Database dependencies
    const dbType = this.getNestedValue(config, 'database.type');
    const dbUrl = this.getNestedValue(config, 'database.url');

    if (dbType && dbType !== 'sqlite' && !dbUrl) {
      errors.push(`Database URL is required when database type is '${dbType}'`);
    }

    // Cache dependencies
    const cacheProvider = this.getNestedValue(config, 'cache.provider');
    const redisUrl = this.getNestedValue(config, 'cache.redis.url');

    if (cacheProvider === 'redis' && !redisUrl) {
      errors.push(`Redis URL is required when cache provider is 'redis'`);
    }

    // Auth dependencies
    const authProvider = this.getNestedValue(config, 'auth.provider');
    const jwtSecret = this.getNestedValue(config, 'auth.jwt.secret');

    if (authProvider && !jwtSecret) {
      errors.push(`JWT secret is required when authentication is enabled`);
    }

    // OAuth dependencies
    if (authProvider === 'oauth') {
      const clientId = this.getNestedValue(config, 'auth.oauth.clientId');
      const clientSecret = this.getNestedValue(config, 'auth.oauth.clientSecret');

      if (!clientId || !clientSecret) {
        errors.push(`OAuth client ID and secret are required when auth provider is 'oauth'`);
      }
    }

    // MFA dependencies
    const mfaEnabled = this.getNestedValue(config, 'auth.mfa.enabled');
    const mfaProvider = this.getNestedValue(config, 'auth.mfa.provider');

    if (mfaEnabled && !mfaProvider) {
      errors.push(`MFA provider is required when MFA is enabled`);
    }

    return errors;
  }

  private coerceType(value: any, targetType: string): any {
    try {
      switch (targetType) {
        case 'string':
          return String(value);

        case 'number':
          const num = Number(value);
          return isNaN(num) ? undefined : num;

        case 'boolean':
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') return true;
            if (lower === 'false' || lower === '0' || lower === 'no') return false;
          }
          return Boolean(value);

        case 'array':
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return value.split(',').map(s => s.trim());
            }
          }
          return Array.isArray(value) ? value : [value];

        case 'object':
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return undefined;
            }
          }
          return typeof value === 'object' ? value : undefined;

        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }

  private findUnknownProperties(config: Record<string, any>, prefix: string = ''): string[] {
    const errors: string[] = [];
    const knownPaths = new Set(Object.keys(this.schema.getAllProperties()));

    const traverse = (obj: any, currentPath: string) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const [key, value] of Object.entries(obj)) {
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        if (!knownPaths.has(fullPath)) {
          // Check if this is a parent path of any known property
          const isParentPath = Array.from(knownPaths).some(path => path.startsWith(fullPath + '.'));

          if (!isParentPath) {
            errors.push(`Unknown property: ${fullPath}`);
          }
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value, fullPath);
        }
      }
    };

    traverse(config, prefix);
    return errors;
  }

  private applyDefaults(config: Record<string, any>): void {
    for (const [path, property] of Object.entries(this.schema.getAllProperties())) {
      if (property.default !== undefined && !this.hasNestedValue(config, path)) {
        this.setNestedValue(config, path, property.default);
      }
    }
  }

  private isValidDatabaseUrl(url: string): boolean {
    const validPrefixes = [
      'sqlite://', 'postgresql://', 'postgres://', 'mysql://',
      'mongodb://', 'redis://', 'file:'
    ];
    return validPrefixes.some(prefix => url.startsWith(prefix));
  }

  private isValidRedisUrl(url: string): boolean {
    return url.startsWith('redis://') || url.startsWith('rediss://');
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private hasNestedValue(obj: Record<string, any>, path: string): boolean {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return true;
  }

  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
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
}