import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';

export interface Task {
  id: string;
  type: string;
  data: any;
  priority: number;
  retries: number;
  maxRetries: number;
  delay: number;
  timeout: number;
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dependencies?: string[];
  tags?: string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
  worker?: string;
}

export interface WorkerInfo {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask?: string;
  tasksCompleted: number;
  tasksErrored: number;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface ProcessorConfig {
  maxWorkers: number;
  maxConcurrentTasks: number;
  workerScript?: string;
  taskTimeout: number;
  retryDelay: number;
  maxRetries: number;
  enableScheduling: boolean;
  enablePriority: boolean;
  enableDependencies: boolean;
  queueMaxSize: number;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  activeWorkers: number;
  totalWorkers: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TaskProcessor {
  type: string;
  handler: (data: any) => Promise<any>;
  concurrency?: number;
  timeout?: number;
}

export class BackgroundProcessor extends EventEmitter {
  private workers: Map<string, WorkerInfo> = new Map();
  private taskQueue: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private taskProcessors: Map<string, TaskProcessor> = new Map();
  private config: ProcessorConfig;
  private isRunning: boolean = false;
  private scheduleInterval?: NodeJS.Timeout;
  private stats: QueueStats = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
    averageProcessingTime: 0,
    activeWorkers: 0,
    totalWorkers: 0
  };

  constructor(config: Partial<ProcessorConfig> = {}) {
    super();

    this.config = {
      maxWorkers: Math.max(1, os.cpus().length - 1),
      maxConcurrentTasks: os.cpus().length * 2,
      taskTimeout: 300000, // 5 minutes
      retryDelay: 5000,
      maxRetries: 3,
      enableScheduling: true,
      enablePriority: true,
      enableDependencies: true,
      queueMaxSize: 10000,
      ...config
    };

    this.setupDefaultProcessors();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Create worker pool
    await this.createWorkerPool();

    // Start task scheduler
    if (this.config.enableScheduling) {
      this.startScheduler();
    }

    // Start queue processor
    this.startQueueProcessor();

    this.emit('processor:started', { workers: this.workers.size });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop scheduler
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    // Cancel all pending tasks
    this.taskQueue.forEach(task => {
      this.emit('task:cancelled', { taskId: task.id });
    });
    this.taskQueue = [];

    // Terminate workers
    await this.terminateWorkers();

    this.emit('processor:stopped');
  }

  registerProcessor(processor: TaskProcessor): void {
    this.taskProcessors.set(processor.type, processor);
    this.emit('processor:registered', { type: processor.type });
  }

  unregisterProcessor(type: string): boolean {
    const removed = this.taskProcessors.delete(type);
    if (removed) {
      this.emit('processor:unregistered', { type });
    }
    return removed;
  }

  async addTask(
    type: string,
    data: any,
    options: Partial<{
      priority: number;
      delay: number;
      timeout: number;
      maxRetries: number;
      scheduledAt: Date;
      dependencies: string[];
      tags: string[];
    }> = {}
  ): Promise<string> {
    if (this.taskQueue.length >= this.config.queueMaxSize) {
      throw new Error('Task queue is full');
    }

    if (!this.taskProcessors.has(type)) {
      throw new Error(`No processor registered for task type: ${type}`);
    }

    const task: Task = {
      id: this.generateTaskId(),
      type,
      data,
      priority: options.priority || 0,
      retries: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      delay: options.delay || 0,
      timeout: options.timeout || this.config.taskTimeout,
      createdAt: new Date(),
      scheduledAt: options.scheduledAt,
      dependencies: options.dependencies || [],
      tags: options.tags || []
    };

    if (task.delay > 0) {
      task.scheduledAt = new Date(Date.now() + task.delay);
    }

    this.taskQueue.push(task);
    this.sortTaskQueue();
    this.updateStats();

    this.emit('task:added', { taskId: task.id, type: task.type });

    // Try to process immediately if possible
    if (this.isRunning) {
      setImmediate(() => this.processQueue());
    }

    return task.id;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      this.updateStats();
      this.emit('task:cancelled', { taskId });
      return true;
    }

    // Cancel running task
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // Find worker and terminate task
      for (const workerInfo of this.workers.values()) {
        if (workerInfo.currentTask === taskId) {
          workerInfo.worker.postMessage({ type: 'cancel', taskId });
          break;
        }
      }

      this.runningTasks.delete(taskId);
      this.updateStats();
      this.emit('task:cancelled', { taskId });
      return true;
    }

    return false;
  }

  getTask(taskId: string): Task | TaskResult | null {
    // Check running tasks
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      return runningTask;
    }

    // Check completed tasks
    const completedTask = this.completedTasks.get(taskId);
    if (completedTask) {
      return completedTask;
    }

    // Check queue
    const queuedTask = this.taskQueue.find(task => task.id === taskId);
    if (queuedTask) {
      return queuedTask;
    }

    return null;
  }

  getTasksByStatus(status: TaskStatus): Task[] | TaskResult[] {
    switch (status) {
      case TaskStatus.PENDING:
      case TaskStatus.SCHEDULED:
        return this.taskQueue.filter(task => {
          if (status === TaskStatus.SCHEDULED) {
            return task.scheduledAt && task.scheduledAt > new Date();
          }
          return !task.scheduledAt || task.scheduledAt <= new Date();
        });

      case TaskStatus.RUNNING:
        return Array.from(this.runningTasks.values());

      case TaskStatus.COMPLETED:
        return Array.from(this.completedTasks.values()).filter(result => result.success);

      case TaskStatus.FAILED:
        return Array.from(this.completedTasks.values()).filter(result => !result.success);

      default:
        return [];
    }
  }

  getTasksByTag(tag: string): (Task | TaskResult)[] {
    const results: (Task | TaskResult)[] = [];

    // Search queue
    results.push(...this.taskQueue.filter(task => task.tags?.includes(tag)));

    // Search running tasks
    results.push(...Array.from(this.runningTasks.values()).filter(task => task.tags?.includes(tag)));

    // Search completed tasks (need to check original task data)
    // This would require storing task metadata in results

    return results;
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  getWorkerStats(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(worker => ({
      ...worker,
      worker: undefined as any // Don't expose the actual worker instance
    }));
  }

  private async createWorkerPool(): Promise<void> {
    const workerScript = this.config.workerScript || path.join(__dirname, 'worker.js');

    for (let i = 0; i < this.config.maxWorkers; i++) {
      await this.createWorker(workerScript);
    }
  }

  private async createWorker(workerScript: string): Promise<string> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const worker = new Worker(workerScript, {
      workerData: {
        workerId,
        processors: Array.from(this.taskProcessors.entries())
      }
    });

    const workerInfo: WorkerInfo = {
      id: workerId,
      worker,
      busy: false,
      tasksCompleted: 0,
      tasksErrored: 0,
      createdAt: new Date(),
      lastActiveAt: new Date()
    };

    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workers.set(workerId, workerInfo);
    this.updateStats();

    return workerId;
  }

  private async terminateWorkers(): Promise<void> {
    const terminatePromises = Array.from(this.workers.values()).map(async (workerInfo) => {
      try {
        await workerInfo.worker.terminate();
      } catch (error) {
        console.error(`Error terminating worker ${workerInfo.id}:`, error);
      }
    });

    await Promise.allSettled(terminatePromises);
    this.workers.clear();
    this.updateStats();
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'task:completed':
        this.handleTaskCompleted(workerId, message);
        break;

      case 'task:error':
        this.handleTaskError(workerId, message);
        break;

      case 'task:progress':
        this.emit('task:progress', {
          taskId: message.taskId,
          progress: message.progress,
          worker: workerId
        });
        break;

      case 'worker:ready':
        workerInfo.busy = false;
        workerInfo.currentTask = undefined;
        this.processQueue();
        break;
    }

    workerInfo.lastActiveAt = new Date();
  }

  private handleWorkerError(workerId: string, error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    this.emit('worker:error', { workerId, error });

    if (workerInfo.currentTask) {
      this.handleTaskError(workerId, {
        taskId: workerInfo.currentTask,
        error: error.message
      });
    }

    // Restart worker
    this.restartWorker(workerId);
  }

  private handleWorkerExit(workerId: string, code: number): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    this.emit('worker:exit', { workerId, code });

    if (workerInfo.currentTask) {
      this.handleTaskError(workerId, {
        taskId: workerInfo.currentTask,
        error: `Worker exited with code ${code}`
      });
    }

    // Remove worker and potentially restart if processor is running
    this.workers.delete(workerId);
    if (this.isRunning) {
      this.restartWorker(workerId);
    }
  }

  private async restartWorker(workerId: string): Promise<void> {
    try {
      await this.createWorker(this.config.workerScript || path.join(__dirname, 'worker.js'));
      this.emit('worker:restarted', { workerId });
    } catch (error) {
      this.emit('worker:restart:failed', { workerId, error });
    }
  }

  private handleTaskCompleted(workerId: string, message: any): void {
    const task = this.runningTasks.get(message.taskId);
    if (!task) return;

    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.currentTask = undefined;
      workerInfo.tasksCompleted++;
    }

    const result: TaskResult = {
      taskId: message.taskId,
      success: true,
      result: message.result,
      duration: message.duration,
      worker: workerId
    };

    this.runningTasks.delete(message.taskId);
    this.completedTasks.set(message.taskId, result);
    this.updateStats();

    this.emit('task:completed', result);

    // Check for dependent tasks
    this.checkDependentTasks(message.taskId);

    // Continue processing queue
    this.processQueue();
  }

  private handleTaskError(workerId: string, message: any): void {
    const task = this.runningTasks.get(message.taskId);
    if (!task) return;

    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.currentTask = undefined;
      workerInfo.tasksErrored++;
    }

    task.retries++;

    if (task.retries < task.maxRetries) {
      // Retry task
      task.scheduledAt = new Date(Date.now() + this.config.retryDelay);
      this.runningTasks.delete(message.taskId);
      this.taskQueue.push(task);
      this.sortTaskQueue();
      this.emit('task:retry', { taskId: message.taskId, retries: task.retries });
    } else {
      // Task failed
      const result: TaskResult = {
        taskId: message.taskId,
        success: false,
        error: new Error(message.error),
        duration: message.duration || 0,
        worker: workerId
      };

      this.runningTasks.delete(message.taskId);
      this.completedTasks.set(message.taskId, result);
      this.emit('task:failed', result);
    }

    this.updateStats();
    this.processQueue();
  }

  private processQueue(): void {
    if (!this.isRunning || this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      return;
    }

    const nextTask = this.getNextTask();
    if (!nextTask) {
      return;
    }

    this.executeTask(nextTask, availableWorker);
  }

  private getAvailableWorker(): WorkerInfo | null {
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        return worker;
      }
    }
    return null;
  }

  private getNextTask(): Task | null {
    const now = new Date();

    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];

      // Check if task is scheduled for the future
      if (task.scheduledAt && task.scheduledAt > now) {
        continue;
      }

      // Check dependencies
      if (this.config.enableDependencies && !this.areDependenciesMet(task)) {
        continue;
      }

      // Found a task that can be executed
      this.taskQueue.splice(i, 1);
      return task;
    }

    return null;
  }

  private areDependenciesMet(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const result = this.completedTasks.get(depId);
      return result && result.success;
    });
  }

  private executeTask(task: Task, worker: WorkerInfo): void {
    worker.busy = true;
    worker.currentTask = task.id;
    task.startedAt = new Date();

    this.runningTasks.set(task.id, task);
    this.updateStats();

    worker.worker.postMessage({
      type: 'execute',
      task: {
        id: task.id,
        type: task.type,
        data: task.data,
        timeout: task.timeout
      }
    });

    this.emit('task:started', {
      taskId: task.id,
      type: task.type,
      worker: worker.id
    });

    // Continue processing if there are more tasks and workers
    if (this.taskQueue.length > 0 && this.getAvailableWorker()) {
      setImmediate(() => this.processQueue());
    }
  }

  private checkDependentTasks(completedTaskId: string): void {
    // Find tasks that depend on the completed task
    const dependentTasks = this.taskQueue.filter(task =>
      task.dependencies?.includes(completedTaskId)
    );

    if (dependentTasks.length > 0) {
      this.sortTaskQueue();
      setImmediate(() => this.processQueue());
    }
  }

  private sortTaskQueue(): void {
    if (!this.config.enablePriority) {
      return;
    }

    this.taskQueue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Earlier scheduled time first
      if (a.scheduledAt && b.scheduledAt) {
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      }

      // Tasks without schedule time come first
      if (a.scheduledAt && !b.scheduledAt) return 1;
      if (!a.scheduledAt && b.scheduledAt) return -1;

      // Earlier creation time first
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private startScheduler(): void {
    this.scheduleInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Check every second
  }

  private startQueueProcessor(): void {
    // Initial queue processing
    setImmediate(() => this.processQueue());
  }

  private updateStats(): void {
    this.stats.pending = this.taskQueue.length;
    this.stats.running = this.runningTasks.size;
    this.stats.totalWorkers = this.workers.size;
    this.stats.activeWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;

    const completed = Array.from(this.completedTasks.values());
    this.stats.completed = completed.filter(r => r.success).length;
    this.stats.failed = completed.filter(r => !r.success).length;
    this.stats.totalProcessed = completed.length;

    if (completed.length > 0) {
      const totalDuration = completed.reduce((sum, result) => sum + result.duration, 0);
      this.stats.averageProcessingTime = totalDuration / completed.length;
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupDefaultProcessors(): void {
    // Example processor for graph analysis
    this.registerProcessor({
      type: 'graph:analyze',
      handler: async (data: any) => {
        // Simulate analysis work
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { analyzed: true, nodeCount: data.nodes?.length || 0 };
      }
    });

    // Example processor for data transformation
    this.registerProcessor({
      type: 'data:transform',
      handler: async (data: any) => {
        // Simulate transformation work
        await new Promise(resolve => setTimeout(resolve, 500));
        return { transformed: true, data: data.input };
      }
    });
  }
}