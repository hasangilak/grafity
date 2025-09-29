import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { graphqlSchema } from './graphql/schema';

// Import configuration and services
import { ConfigManager } from '../config/ConfigManager';
import { SecurityManager } from '../security/SecurityManager';
import { CacheService } from './cache/service';
import { JobQueue } from './jobs/queue';

// Import services
import { ProjectService } from './services/ProjectService';
import { AnalysisService } from './services/AnalysisService';
import { PatternService } from './services/PatternService';
import { ComponentService } from './services/ComponentService';

// Import route modules
import { projectRoutes } from './routes/projects';
import { analysisRoutes } from './routes/analysis';
import { patternRoutes } from './routes/patterns';
import { componentRoutes } from './routes/components';
import { metricRoutes } from './routes/metrics';
import { searchRoutes } from './routes/search';
import { userRoutes } from './routes/users';
import { systemRoutes } from './routes/system';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authMiddlewares } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';

export class GrafityServer {
  private app: express.Application;
  private server: ApolloServer;
  private httpServer: any;
  private configManager: ConfigManager;
  private securityManager: SecurityManager;
  private cacheService: CacheService;
  private jobQueue: JobQueue;

  // Services
  private projectService: ProjectService;
  private analysisService: AnalysisService;
  private patternService: PatternService;
  private componentService: ComponentService;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGraphQL();
    this.setupErrorHandling();
  }

  private initializeServices(): void {
    // Initialize core services
    this.configManager = new ConfigManager();
    this.securityManager = new SecurityManager(this.configManager);
    this.cacheService = new CacheService(this.configManager);
    this.jobQueue = new JobQueue(this.configManager);

    // Initialize business logic services
    this.analysisService = new AnalysisService(
      this.configManager,
      this.cacheService,
      this.jobQueue
    );

    this.projectService = new ProjectService(
      this.configManager,
      this.cacheService,
      this.jobQueue,
      this.analysisService
    );

    this.patternService = new PatternService(
      this.configManager,
      this.cacheService
    );

    this.componentService = new ComponentService(
      this.configManager,
      this.cacheService
    );
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? ['https://grafity.dev', 'https://www.grafity.dev']
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000, // requests per window
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(loggingMiddleware);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });
  }

  private setupRoutes(): void {
    // API route prefix
    const apiRouter = express.Router();

    // Mount route modules
    apiRouter.use('/projects', projectRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService,
      this.projectService
    ));

    apiRouter.use('/analysis', analysisRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService,
      this.analysisService
    ));

    apiRouter.use('/patterns', patternRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService,
      this.patternService
    ));

    apiRouter.use('/components', componentRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService,
      this.componentService
    ));

    apiRouter.use('/metrics', metricRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService
    ));

    apiRouter.use('/search', searchRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService
    ));

    apiRouter.use('/users', userRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService
    ));

    apiRouter.use('/system', systemRoutes(
      this.configManager,
      this.securityManager,
      this.cacheService
    ));

    // Mount API router
    this.app.use('/api', apiRouter);

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('client/build'));

      // Catch-all handler for React router
      this.app.get('*', (req, res) => {
        res.sendFile('index.html', { root: 'client/build' });
      });
    }
  }

  private setupGraphQL(): void {
    // Create Apollo Server
    this.server = new ApolloServer({
      typeDefs: graphqlSchema.typeDefs,
      resolvers: graphqlSchema.resolvers,
      context: ({ req }) => {
        // Provide services to GraphQL context
        return {
          user: req.user, // Will be set by auth middleware if authenticated
          services: {
            projectService: this.projectService,
            analysisService: this.analysisService,
            patternService: this.patternService,
            componentService: this.componentService,
            cacheService: this.cacheService,
            jobQueue: this.jobQueue
          },
          configManager: this.configManager,
          securityManager: this.securityManager
        };
      },
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
      formatError: (error) => {
        console.error('GraphQL Error:', error);

        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production') {
          return new Error('Internal server error');
        }

        return error;
      }
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use(errorHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });

    // Handle termination signals
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, starting graceful shutdown...');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, starting graceful shutdown...');
      this.gracefulShutdown('SIGINT');
    });
  }

  async start(port: number = 4000): Promise<void> {
    try {
      // Start services
      await this.cacheService.connect();
      await this.jobQueue.connect();

      // Apply GraphQL middleware to Express app
      await this.server.start();
      this.server.applyMiddleware({
        app: this.app,
        path: '/graphql',
        cors: false // We handle CORS above
      });

      // Create HTTP server
      this.httpServer = createServer(this.app);

      // Start listening
      this.httpServer.listen(port, () => {
        console.log(`🚀 Grafity Server ready at http://localhost:${port}`);
        console.log(`📊 GraphQL Playground at http://localhost:${port}${this.server.graphqlPath}`);
        console.log(`🔗 REST API at http://localhost:${port}/api`);
        console.log(`💻 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      this.httpServer.on('error', (error: any) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

        switch (error.code) {
          case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    if (this.httpServer) {
      this.httpServer.close(() => {
        console.log('HTTP server closed');
      });
    }

    // Stop GraphQL server
    if (this.server) {
      await this.server.stop();
      console.log('GraphQL server stopped');
    }

    // Close service connections
    try {
      await this.cacheService.disconnect();
      console.log('Cache service disconnected');
    } catch (error) {
      console.error('Error disconnecting cache service:', error);
    }

    try {
      await this.jobQueue.disconnect();
      console.log('Job queue disconnected');
    } catch (error) {
      console.error('Error disconnecting job queue:', error);
    }

    console.log('Graceful shutdown completed');
    process.exit(0);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new GrafityServer();
  const port = parseInt(process.env.PORT || '4000', 10);

  server.start(port).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default GrafityServer;