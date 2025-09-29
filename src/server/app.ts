import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

import { ConfigManager } from '../config/ConfigManager';
import { SecurityManager } from '../security/SecurityManager';
import { ErrorRecovery } from '../recovery/ErrorRecovery';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { CacheManager } from '../caching/CacheManager';
import { BackgroundProcessor } from '../processing/BackgroundProcessor';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { validation } from './middleware/validation';

import { graphqlSchema } from './graphql/schema';
import { apiRoutes } from './routes/api';
import { uploadRoutes } from './routes/uploads';
import { healthRoutes } from './routes/health';

import { DatabaseConnection } from './database/connection';
import { CacheService } from './cache/service';
import { JobQueue } from './jobs/queue';
import { WebSocketHandler } from './sockets/handler';
import { MonitoringService } from './monitoring/service';

config(); // Load environment variables

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origins: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  uploads: {
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
  security: {
    helmet: boolean;
    compression: boolean;
  };
}

export class GrafityServer {
  private app: express.Application;
  private httpServer: any;
  private apolloServer?: ApolloServer;
  private io?: SocketIOServer;
  private configManager: ConfigManager;
  private securityManager: SecurityManager;
  private errorRecovery: ErrorRecovery;
  private performanceMonitor: PerformanceMonitor;
  private cacheManager: CacheManager;
  private backgroundProcessor: BackgroundProcessor;
  private databaseConnection: DatabaseConnection;
  private cacheService: CacheService;
  private jobQueue: JobQueue;
  private websocketHandler: WebSocketHandler;
  private monitoringService: MonitoringService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize core services
    this.configManager = new ConfigManager();
    this.securityManager = new SecurityManager();
    this.errorRecovery = new ErrorRecovery();
    this.performanceMonitor = new PerformanceMonitor();
    this.cacheManager = new CacheManager();
    this.backgroundProcessor = new BackgroundProcessor();

    // Initialize server services
    this.databaseConnection = new DatabaseConnection();
    this.cacheService = new CacheService();
    this.jobQueue = new JobQueue();
    this.websocketHandler = new WebSocketHandler();
    this.monitoringService = new MonitoringService();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize core services
      await this.configManager.initialize();
      await this.securityManager.initialize();
      await this.errorRecovery.initialize();
      this.performanceMonitor.initialize();
      await this.cacheManager.initialize();
      this.backgroundProcessor.initialize();

      // Initialize server services
      await this.databaseConnection.initialize();
      await this.cacheService.initialize();
      await this.jobQueue.initialize();
      await this.monitoringService.initialize();

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup GraphQL
      await this.setupGraphQL();

      // Setup WebSockets
      this.setupWebSockets();

      // Setup error handling
      this.setupErrorHandling();

      console.log('✅ Grafity server initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Grafity server:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    const serverConfig = this.getServerConfig();

    // Security middleware
    if (serverConfig.security.helmet) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        crossOriginEmbedderPolicy: false
      }));
    }

    // CORS configuration
    this.app.use(cors({
      origin: serverConfig.cors.origins,
      credentials: serverConfig.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    if (serverConfig.security.compression) {
      this.app.use(compression());
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: serverConfig.rateLimit.windowMs,
      max: serverConfig.rateLimit.max,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined'));
    this.app.use(requestLogger(this.monitoringService));

    // Custom middleware
    this.app.use(authMiddleware(this.securityManager));
    this.app.use(validation());

    // Performance monitoring
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.performanceMonitor.recordHttpRequest({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check routes (no auth required)
    this.app.use('/health', healthRoutes(this.monitoringService, this.databaseConnection));

    // API routes
    this.app.use('/api', apiRoutes(this.configManager, this.securityManager, this.cacheService));

    // Upload routes
    this.app.use('/uploads', uploadRoutes(this.getServerConfig().uploads));

    // Static file serving for generated documentation
    this.app.use('/docs', express.static('dist/docs'));

    // Catch-all route for SPA
    this.app.get('*', (req, res) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/graphql')) {
        res.status(404).json({ error: 'API endpoint not found' });
      } else {
        res.status(404).json({ error: 'Page not found' });
      }
    });
  }

  private async setupGraphQL(): Promise<void> {
    try {
      this.apolloServer = new ApolloServer({
        typeDefs: graphqlSchema.typeDefs,
        resolvers: graphqlSchema.resolvers,
        context: ({ req, res }) => ({
          req,
          res,
          configManager: this.configManager,
          securityManager: this.securityManager,
          cacheService: this.cacheService,
          jobQueue: this.jobQueue,
          performanceMonitor: this.performanceMonitor
        }),
        plugins: [
          {
            requestDidStart() {
              return {
                didResolveOperation(requestContext) {
                  console.log(`GraphQL Operation: ${requestContext.request.operationName}`);
                },
                didEncounterErrors(requestContext) {
                  console.error('GraphQL errors:', requestContext.errors);
                }
              };
            }
          }
        ],
        introspection: process.env.NODE_ENV !== 'production',
        playground: process.env.NODE_ENV !== 'production'
      });

      await this.apolloServer.start();
      this.apolloServer.applyMiddleware({
        app: this.app,
        path: '/graphql',
        cors: false // We handle CORS globally
      });

      console.log('✅ GraphQL server setup complete');

    } catch (error) {
      console.error('❌ Failed to setup GraphQL server:', error);
      throw error;
    }
  }

  private setupWebSockets(): void {
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: this.getServerConfig().cors.origins,
        credentials: this.getServerConfig().cors.credentials
      },
      transports: ['websocket', 'polling']
    });

    this.websocketHandler.initialize(this.io, this.securityManager);

    console.log('✅ WebSocket server setup complete');
  }

  private setupErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(errorHandler(this.errorRecovery, this.monitoringService));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.monitoringService.recordError(new Error(`Unhandled Rejection: ${reason}`));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.monitoringService.recordError(error);

      // Graceful shutdown
      this.shutdown().then(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.shutdown().then(() => {
        process.exit(0);
      });
    });

    // Graceful shutdown on SIGINT
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.shutdown().then(() => {
        process.exit(0);
      });
    });
  }

  async start(): Promise<void> {
    const serverConfig = this.getServerConfig();

    return new Promise((resolve, reject) => {
      this.httpServer.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`🚀 Grafity server running on http://${serverConfig.host}:${serverConfig.port}`);
        console.log(`📊 GraphQL Playground: http://${serverConfig.host}:${serverConfig.port}/graphql`);
        console.log(`🏥 Health Check: http://${serverConfig.host}:${serverConfig.port}/health`);
        resolve();
      }).on('error', reject);
    });
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Grafity server...');

    try {
      // Stop accepting new connections
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer.close(() => resolve());
        });
      }

      // Stop Apollo Server
      if (this.apolloServer) {
        await this.apolloServer.stop();
      }

      // Close WebSocket connections
      if (this.io) {
        this.io.close();
      }

      // Shutdown background services
      await this.jobQueue.shutdown();
      await this.backgroundProcessor.shutdown();
      await this.cacheService.shutdown();
      await this.databaseConnection.shutdown();

      console.log('✅ Grafity server shutdown complete');

    } catch (error) {
      console.error('❌ Error during server shutdown:', error);
      throw error;
    }
  }

  private getServerConfig(): ServerConfig {
    return {
      port: this.configManager.get('server.port', 3000),
      host: this.configManager.get('server.host', '0.0.0.0'),
      cors: {
        origins: this.configManager.get('server.cors.origins', ['http://localhost:3000']),
        credentials: this.configManager.get('server.cors.credentials', true)
      },
      rateLimit: {
        windowMs: this.configManager.get('server.rateLimit.windowMs', 15 * 60 * 1000), // 15 minutes
        max: this.configManager.get('server.rateLimit.max', 100) // requests per window
      },
      uploads: {
        maxFileSize: this.configManager.get('server.uploads.maxFileSize', 10 * 1024 * 1024), // 10MB
        allowedMimeTypes: this.configManager.get('server.uploads.allowedMimeTypes', [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
          'application/json'
        ])
      },
      security: {
        helmet: this.configManager.get('server.security.helmet', true),
        compression: this.configManager.get('server.security.compression', true)
      }
    };
  }

  // Getter methods for testing and external access
  getApp(): express.Application {
    return this.app;
  }

  getHttpServer() {
    return this.httpServer;
  }

  getSocketIO(): SocketIOServer | undefined {
    return this.io;
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }

  getCacheService(): CacheService {
    return this.cacheService;
  }

  getJobQueue(): JobQueue {
    return this.jobQueue;
  }

  getMonitoringService(): MonitoringService {
    return this.monitoringService;
  }
}

// Create and export server instance
export const server = new GrafityServer();

// Start server if this file is run directly
if (require.main === module) {
  server.initialize()
    .then(() => server.start())
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}