import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from './errorHandler';

export interface ValidationSchema {
  body?: Joi.Schema | object;
  query?: Joi.Schema | object;
  params?: Joi.Schema | object;
  headers?: Joi.Schema | object;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  skipOnError?: boolean;
}

// Convert JSON schema to Joi schema
function jsonSchemaToJoi(schema: any): Joi.Schema {
  if (Joi.isSchema(schema)) {
    return schema;
  }

  try {
    return convertJsonSchemaToJoi(schema);
  } catch (error) {
    console.warn('Failed to convert JSON schema to Joi, using any():', error);
    return Joi.any();
  }
}

function convertJsonSchemaToJoi(schema: any): Joi.Schema {
  if (schema.type === 'object') {
    let objSchema = Joi.object();

    if (schema.properties) {
      const keys: any = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        keys[key] = convertJsonSchemaToJoi(value);
      }
      objSchema = objSchema.keys(keys);
    }

    if (schema.required && Array.isArray(schema.required)) {
      const requiredKeys: any = {};
      schema.required.forEach((key: string) => {
        if (objSchema.describe().keys?.[key]) {
          requiredKeys[key] = objSchema.describe().keys[key].flags?.presence !== 'optional'
            ? Joi.any().required()
            : objSchema.describe().keys[key];
        }
      });
      objSchema = objSchema.keys(requiredKeys);
    }

    if (schema.additionalProperties === false) {
      objSchema = objSchema.unknown(false);
    }

    return objSchema;
  }

  if (schema.type === 'array') {
    let arraySchema = Joi.array();

    if (schema.items) {
      arraySchema = arraySchema.items(convertJsonSchemaToJoi(schema.items));
    }

    if (schema.minItems !== undefined) {
      arraySchema = arraySchema.min(schema.minItems);
    }

    if (schema.maxItems !== undefined) {
      arraySchema = arraySchema.max(schema.maxItems);
    }

    return arraySchema;
  }

  if (schema.type === 'string') {
    let stringSchema = Joi.string();

    if (schema.minLength !== undefined) {
      stringSchema = stringSchema.min(schema.minLength);
    }

    if (schema.maxLength !== undefined) {
      stringSchema = stringSchema.max(schema.maxLength);
    }

    if (schema.pattern) {
      stringSchema = stringSchema.pattern(new RegExp(schema.pattern));
    }

    if (schema.format) {
      switch (schema.format) {
        case 'email':
          stringSchema = stringSchema.email();
          break;
        case 'uri':
        case 'url':
          stringSchema = stringSchema.uri();
          break;
        case 'date':
          stringSchema = stringSchema.isoDate();
          break;
        case 'uuid':
          stringSchema = stringSchema.uuid();
          break;
      }
    }

    if (schema.enum) {
      stringSchema = stringSchema.valid(...schema.enum);
    }

    return stringSchema;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    let numberSchema = schema.type === 'integer' ? Joi.number().integer() : Joi.number();

    if (schema.minimum !== undefined) {
      numberSchema = numberSchema.min(schema.minimum);
    }

    if (schema.maximum !== undefined) {
      numberSchema = numberSchema.max(schema.maximum);
    }

    if (schema.multipleOf !== undefined) {
      numberSchema = numberSchema.multiple(schema.multipleOf);
    }

    return numberSchema;
  }

  if (schema.type === 'boolean') {
    return Joi.boolean();
  }

  if (schema.oneOf) {
    return Joi.alternatives().try(...schema.oneOf.map(convertJsonSchemaToJoi));
  }

  if (schema.anyOf) {
    return Joi.alternatives().try(...schema.anyOf.map(convertJsonSchemaToJoi));
  }

  // Default to any if type is unknown
  return Joi.any();
}

export function validateRequest(
  schema: ValidationSchema,
  options: ValidationOptions = {}
) {
  const validationOptions = {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
    ...options
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any[] = [];

    // Validate body
    if (schema.body) {
      const bodySchema = jsonSchemaToJoi(schema.body);
      const { error, value } = bodySchema.validate(req.body, validationOptions);

      if (error) {
        errors.push({
          field: 'body',
          details: error.details.map(detail => ({
            path: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      } else if (validationOptions.stripUnknown) {
        req.body = value;
      }
    }

    // Validate query parameters
    if (schema.query) {
      const querySchema = jsonSchemaToJoi(schema.query);
      const { error, value } = querySchema.validate(req.query, validationOptions);

      if (error) {
        errors.push({
          field: 'query',
          details: error.details.map(detail => ({
            path: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      } else if (validationOptions.stripUnknown) {
        req.query = value;
      }
    }

    // Validate path parameters
    if (schema.params) {
      const paramsSchema = jsonSchemaToJoi(schema.params);
      const { error, value } = paramsSchema.validate(req.params, validationOptions);

      if (error) {
        errors.push({
          field: 'params',
          details: error.details.map(detail => ({
            path: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      } else if (validationOptions.stripUnknown) {
        req.params = value;
      }
    }

    // Validate headers
    if (schema.headers) {
      const headersSchema = jsonSchemaToJoi(schema.headers);
      const { error } = headersSchema.validate(req.headers, {
        ...validationOptions,
        allowUnknown: true // Always allow unknown headers
      });

      if (error) {
        errors.push({
          field: 'headers',
          details: error.details.map(detail => ({
            path: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      const validationError = new ValidationError('Request validation failed', errors);
      return next(validationError);
    }

    next();
  };
}

// Predefined common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: {
    query: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sortBy: { type: 'string' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
      }
    }
  },

  // ID parameter
  idParam: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', pattern: '^[a-fA-F0-9]{24}$|^[0-9]+$' } // MongoDB ObjectId or integer
      }
    }
  },

  // UUID parameter
  uuidParam: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    }
  },

  // Search query
  search: {
    query: {
      type: 'object',
      properties: {
        q: { type: 'string', minLength: 1, maxLength: 200 },
        filters: { type: 'object' },
        fields: { type: 'string' }, // comma-separated list
        include: { type: 'string' }, // comma-separated list
        exclude: { type: 'string' }  // comma-separated list
      }
    }
  },

  // Date range
  dateRange: {
    query: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        dateField: { type: 'string', default: 'createdAt' }
      }
    }
  }
};

// Middleware factory for common validations
export const validation = () => {
  return {
    // Validate pagination parameters
    pagination: validateRequest(commonSchemas.pagination),

    // Validate ID parameter
    idParam: validateRequest(commonSchemas.idParam),

    // Validate UUID parameter
    uuidParam: validateRequest(commonSchemas.uuidParam),

    // Validate search query
    search: validateRequest(commonSchemas.search),

    // Validate date range
    dateRange: validateRequest(commonSchemas.dateRange),

    // Custom validation
    custom: (schema: ValidationSchema, options?: ValidationOptions) =>
      validateRequest(schema, options)
  };
};

// Utility functions for common validations
export const validators = {
  // MongoDB ObjectId
  objectId: () => Joi.string().pattern(/^[a-fA-F0-9]{24}$/),

  // UUID
  uuid: () => Joi.string().uuid(),

  // Email
  email: () => Joi.string().email(),

  // URL
  url: () => Joi.string().uri(),

  // Password (at least 8 chars, 1 uppercase, 1 lowercase, 1 number)
  password: () => Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number'),

  // Username (alphanumeric, underscore, hyphen, 3-20 chars)
  username: () => Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .pattern(/^[a-zA-Z0-9_-]+$/),

  // File path
  filePath: () => Joi.string()
    .pattern(/^[a-zA-Z0-9._/-]+$/)
    .message('Invalid file path format'),

  // Component name
  componentName: () => Joi.string()
    .pattern(/^[A-Z][a-zA-Z0-9]*$/)
    .message('Component name must start with uppercase letter and contain only alphanumeric characters'),

  // Semantic version
  semver: () => Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/)
    .message('Invalid semantic version format')
};

// Helper to create validation middleware with error handling
export function createValidator(schema: ValidationSchema, options?: ValidationOptions) {
  return [
    validateRequest(schema, options),
    (error: any, req: Request, res: Response, next: NextFunction) => {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details,
          timestamp: new Date().toISOString()
        });
      }
      next(error);
    }
  ];
}

export default validation;