/**
 * Production configuration for Grafity in Docker container
 */

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 4000,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || false,
      credentials: true
    }
  },

  // Database configuration
  databases: {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://neo4j:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
      database: process.env.NEO4J_DATABASE || 'neo4j',
      maxConnectionLifetime: 30000,
      maxConnectionPoolSize: 100,
      connectionAcquisitionTimeout: 60000,
      disableLosslessIntegers: true
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://redis:6379',
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnClusterDown: 300,
      db: process.env.REDIS_DB || 0
    }
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    file: {
      enabled: true,
      filename: '/app/logs/grafity.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    },
    console: {
      enabled: true,
      colorize: false
    }
  },

  // Analysis configuration
  analysis: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 5,
    jobTimeout: parseInt(process.env.JOB_TIMEOUT) || 300000, // 5 minutes
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    supportedLanguages: ['typescript', 'tsx', 'javascript', 'jsx'],
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.CACHE_TTL) || 3600 // 1 hour
  },

  // Rate limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false
  },

  // File upload
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-tar',
      'application/gzip'
    ],
    destination: process.env.UPLOAD_DESTINATION || '/app/tmp/uploads'
  },

  // Graph visualization
  visualization: {
    maxNodes: parseInt(process.env.MAX_GRAPH_NODES) || 1000,
    maxEdges: parseInt(process.env.MAX_GRAPH_EDGES) || 5000,
    defaultLayout: process.env.DEFAULT_LAYOUT || 'force',
    enableClustering: process.env.ENABLE_CLUSTERING !== 'false'
  },

  // Health check
  health: {
    checks: {
      neo4j: true,
      redis: true,
      memory: true,
      disk: true
    },
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
  },

  // Metrics and monitoring
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED !== 'false',
      endpoint: '/metrics',
      defaultLabels: {
        app: 'grafity',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production'
      }
    }
  },

  // Security
  security: {
    helmet: {
      enabled: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    },
    trustProxy: process.env.TRUST_PROXY === 'true'
  }
};