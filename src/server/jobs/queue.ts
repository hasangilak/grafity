import Bull, { Queue, Job, JobOptions } from 'bull';
import { BackgroundProcessor } from '../../processing/BackgroundProcessor';
import Redis from 'ioredis';

export interface JobQueueConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  redisUrl?: string;
  defaultJobOptions?: JobOptions;
  concurrency?: {
    [queueName: string]: number;
  };
}

export interface JobData {
  id: string;
  type: string;
  payload: any;
  userId?: string;
  priority?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  completedAt: Date;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export class JobQueue {
  private queues: Map<string, Queue> = new Map();
  private backgroundProcessor: BackgroundProcessor;
  private config: JobQueueConfig;
  private redisConnection?: Redis;

  constructor(config: JobQueueConfig = {}) {
    this.config = {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      },
      concurrency: {
        analysis: 2,
        generation: 1,
        notification: 5,
        cleanup: 1,
        default: 3
      },
      ...config
    };

    this.backgroundProcessor = new BackgroundProcessor();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing job queue system...');

    // Initialize background processor
    this.backgroundProcessor.initialize();

    // Set up Redis connection
    await this.setupRedisConnection();

    // Initialize default queues
    await this.initializeQueues();

    // Set up job processors
    this.setupJobProcessors();

    console.log('✅ Job queue system initialized');
  }

  private async setupRedisConnection(): Promise<void> {
    try {
      if (this.config.redisUrl) {
        this.redisConnection = new Redis(this.config.redisUrl);
      } else if (this.config.redis) {
        this.redisConnection = new Redis(this.config.redis);
      } else if (process.env.REDIS_URL || process.env.REDIS_URI) {
        this.redisConnection = new Redis(process.env.REDIS_URL || process.env.REDIS_URI!);
      } else {
        // Use default Redis connection
        this.redisConnection = new Redis({
          host: 'localhost',
          port: 6379,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100
        });
      }

      // Test connection
      await this.redisConnection.ping();
      console.log('✅ Redis connection established for job queue');

    } catch (error) {
      console.error('❌ Failed to connect to Redis for job queue:', error);
      throw error;
    }
  }

  private async initializeQueues(): Promise<void> {
    const queueNames = [
      'analysis',      // Code analysis jobs
      'generation',    // Documentation/code generation
      'pattern',       // Pattern detection
      'notification',  // Email/webhook notifications
      'cleanup',       // Cleanup and maintenance
      'export',        // Data export jobs
      'import',        // Data import jobs
      'default'        // Default queue for misc jobs
    ];

    for (const queueName of queueNames) {
      await this.createQueue(queueName);
    }
  }

  private async createQueue(name: string): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const redisConfig = this.getRedisConfig();
    const queue = new Bull(name, { redis: redisConfig });

    // Set up event listeners
    queue.on('ready', () => {
      console.log(`📋 Queue ${name} is ready`);
    });

    queue.on('error', (error) => {
      console.error(`❌ Queue ${name} error:`, error);
    });

    queue.on('waiting', (jobId) => {
      console.log(`⏳ Job ${jobId} is waiting in queue ${name}`);
    });

    queue.on('active', (job) => {
      console.log(`🔄 Job ${job.id} started in queue ${name}: ${job.data.type}`);
    });

    queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed in queue ${name}: ${job.data.type}`);
    });

    queue.on('failed', (job, error) => {
      console.error(`❌ Job ${job.id} failed in queue ${name}: ${error.message}`);
    });

    queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} stalled in queue ${name}`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  private getRedisConfig(): any {
    if (this.config.redisUrl) {
      return this.config.redisUrl;
    }

    if (this.config.redis) {
      return this.config.redis;
    }

    if (process.env.REDIS_URL || process.env.REDIS_URI) {
      return process.env.REDIS_URL || process.env.REDIS_URI;
    }

    return {
      host: 'localhost',
      port: 6379
    };
  }

  private setupJobProcessors(): void {
    // Analysis jobs
    this.getQueue('analysis').process(
      this.config.concurrency?.analysis || 2,
      this.processAnalysisJob.bind(this)
    );

    // Generation jobs
    this.getQueue('generation').process(
      this.config.concurrency?.generation || 1,
      this.processGenerationJob.bind(this)
    );

    // Pattern detection jobs
    this.getQueue('pattern').process(
      this.config.concurrency?.pattern || 2,
      this.processPatternJob.bind(this)
    );

    // Notification jobs
    this.getQueue('notification').process(
      this.config.concurrency?.notification || 5,
      this.processNotificationJob.bind(this)
    );

    // Cleanup jobs
    this.getQueue('cleanup').process(
      this.config.concurrency?.cleanup || 1,
      this.processCleanupJob.bind(this)
    );

    // Export jobs
    this.getQueue('export').process(
      this.config.concurrency?.export || 2,
      this.processExportJob.bind(this)
    );

    // Import jobs
    this.getQueue('import').process(
      this.config.concurrency?.import || 1,
      this.processImportJob.bind(this)
    );

    // Default queue
    this.getQueue('default').process(
      this.config.concurrency?.default || 3,
      this.processDefaultJob.bind(this)
    );
  }

  // Job processing methods

  private async processAnalysisJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload, userId } = job.data;

      // Update progress
      await job.progress(10);

      let result: any;

      switch (type) {
        case 'analyze_project':
          result = await this.analyzeProject(payload, job);
          break;

        case 'analyze_component':
          result = await this.analyzeComponent(payload, job);
          break;

        case 'calculate_metrics':
          result = await this.calculateMetrics(payload, job);
          break;

        default:
          throw new Error(`Unknown analysis job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processGenerationJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      await job.progress(10);

      let result: any;

      switch (type) {
        case 'generate_documentation':
          result = await this.generateDocumentation(payload, job);
          break;

        case 'generate_code':
          result = await this.generateCode(payload, job);
          break;

        case 'generate_report':
          result = await this.generateReport(payload, job);
          break;

        default:
          throw new Error(`Unknown generation job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processPatternJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      await job.progress(10);

      let result: any;

      switch (type) {
        case 'detect_patterns':
          result = await this.detectPatterns(payload, job);
          break;

        case 'analyze_anti_patterns':
          result = await this.analyzeAntiPatterns(payload, job);
          break;

        default:
          throw new Error(`Unknown pattern job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processNotificationJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      let result: any;

      switch (type) {
        case 'send_email':
          result = await this.sendEmail(payload);
          break;

        case 'send_webhook':
          result = await this.sendWebhook(payload);
          break;

        case 'send_slack_notification':
          result = await this.sendSlackNotification(payload);
          break;

        default:
          throw new Error(`Unknown notification job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processCleanupJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      let result: any;

      switch (type) {
        case 'cleanup_old_files':
          result = await this.cleanupOldFiles(payload);
          break;

        case 'cleanup_cache':
          result = await this.cleanupCache(payload);
          break;

        case 'cleanup_logs':
          result = await this.cleanupLogs(payload);
          break;

        default:
          throw new Error(`Unknown cleanup job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processExportJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      await job.progress(10);

      let result: any;

      switch (type) {
        case 'export_project_data':
          result = await this.exportProjectData(payload, job);
          break;

        case 'export_analysis_results':
          result = await this.exportAnalysisResults(payload, job);
          break;

        default:
          throw new Error(`Unknown export job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processImportJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      await job.progress(10);

      let result: any;

      switch (type) {
        case 'import_project':
          result = await this.importProject(payload, job);
          break;

        case 'import_analysis_data':
          result = await this.importAnalysisData(payload, job);
          break;

        default:
          throw new Error(`Unknown import job type: ${type}`);
      }

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  private async processDefaultJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      const { type, payload } = job.data;

      // Use background processor for generic jobs
      const operation = this.backgroundProcessor.createOperation(type, payload);
      await this.backgroundProcessor.execute(operation);

      return {
        success: true,
        result: { message: `Job ${type} completed` },
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };
    }
  }

  // Job implementation placeholders (these would be implemented with actual business logic)

  private async analyzeProject(payload: any, job: Job): Promise<any> {
    // Implementation would use actual analysis services
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    await job.progress(100);
    return { status: 'analyzed', projectId: payload.projectId };
  }

  private async analyzeComponent(payload: any, job: Job): Promise<any> {
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 500));
    await job.progress(100);
    return { status: 'analyzed', componentId: payload.componentId };
  }

  private async calculateMetrics(payload: any, job: Job): Promise<any> {
    await job.progress(30);
    await new Promise(resolve => setTimeout(resolve, 800));
    await job.progress(70);
    await new Promise(resolve => setTimeout(resolve, 400));
    await job.progress(100);
    return { metrics: { complexity: 42, coverage: 85 } };
  }

  private async generateDocumentation(payload: any, job: Job): Promise<any> {
    await job.progress(25);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await job.progress(75);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await job.progress(100);
    return { documentationPath: '/docs/generated.md' };
  }

  private async generateCode(payload: any, job: Job): Promise<any> {
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await job.progress(100);
    return { generatedFiles: ['component.tsx', 'types.ts'] };
  }

  private async generateReport(payload: any, job: Job): Promise<any> {
    await job.progress(40);
    await new Promise(resolve => setTimeout(resolve, 1200));
    await job.progress(100);
    return { reportPath: '/reports/analysis.pdf' };
  }

  private async detectPatterns(payload: any, job: Job): Promise<any> {
    await job.progress(60);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await job.progress(100);
    return { patterns: ['Observer', 'Factory'], antiPatterns: ['God Object'] };
  }

  private async analyzeAntiPatterns(payload: any, job: Job): Promise<any> {
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 800));
    await job.progress(100);
    return { antiPatterns: ['Tight Coupling', 'Long Method'] };
  }

  private async sendEmail(payload: any): Promise<any> {
    // Email sending implementation
    return { sent: true, messageId: 'email_123' };
  }

  private async sendWebhook(payload: any): Promise<any> {
    // Webhook sending implementation
    return { sent: true, status: 200 };
  }

  private async sendSlackNotification(payload: any): Promise<any> {
    // Slack notification implementation
    return { sent: true, channel: payload.channel };
  }

  private async cleanupOldFiles(payload: any): Promise<any> {
    return { cleaned: 42, size: '1.2MB' };
  }

  private async cleanupCache(payload: any): Promise<any> {
    return { cleared: true, entries: 156 };
  }

  private async cleanupLogs(payload: any): Promise<any> {
    return { cleaned: 12, size: '250MB' };
  }

  private async exportProjectData(payload: any, job: Job): Promise<any> {
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await job.progress(100);
    return { exportPath: '/exports/project_data.json' };
  }

  private async exportAnalysisResults(payload: any, job: Job): Promise<any> {
    await job.progress(40);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await job.progress(100);
    return { exportPath: '/exports/analysis.csv' };
  }

  private async importProject(payload: any, job: Job): Promise<any> {
    await job.progress(30);
    await new Promise(resolve => setTimeout(resolve, 3000));
    await job.progress(80);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await job.progress(100);
    return { imported: true, projectId: 'proj_123' };
  }

  private async importAnalysisData(payload: any, job: Job): Promise<any> {
    await job.progress(50);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await job.progress(100);
    return { imported: true, records: 1250 };
  }

  // Public API methods

  async addJob(
    queueName: string,
    type: string,
    payload: any,
    options: JobOptions = {},
    userId?: string
  ): Promise<Job<JobData>> {
    const queue = this.getQueue(queueName);

    const jobData: JobData = {
      id: this.generateJobId(),
      type,
      payload,
      userId,
      priority: options.priority,
      metadata: options as any,
      createdAt: new Date()
    };

    const jobOptions = {
      ...this.config.defaultJobOptions,
      ...options
    };

    const job = await queue.add(jobData, jobOptions);

    console.log(`📝 Job added to queue ${queueName}: ${type} (${job.id})`);

    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job<JobData> | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused()
    };
  }

  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};

    for (const [name] of this.queues) {
      stats[name] = await this.getQueueStats(name);
    }

    return stats;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`⏸️ Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`▶️ Queue ${queueName} resumed`);
  }

  async cleanQueue(queueName: string, grace: number = 0, limit: number = 100): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, 'completed', limit);
    await queue.clean(grace, 'failed', limit);
    console.log(`🧹 Queue ${queueName} cleaned`);
  }

  private getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down job queue system...');

    const shutdownPromises: Promise<void>[] = [];

    // Close all queues
    for (const [name, queue] of this.queues) {
      console.log(`🛑 Closing queue: ${name}`);
      shutdownPromises.push(queue.close());
    }

    // Close Redis connection
    if (this.redisConnection) {
      shutdownPromises.push(this.redisConnection.quit());
    }

    // Shutdown background processor
    shutdownPromises.push(this.backgroundProcessor.shutdown());

    await Promise.all(shutdownPromises);

    console.log('✅ Job queue system shutdown complete');
  }
}