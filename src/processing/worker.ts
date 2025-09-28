import { parentPort, workerData } from 'worker_threads';

interface TaskMessage {
  type: 'execute' | 'cancel';
  task?: {
    id: string;
    type: string;
    data: any;
    timeout: number;
  };
  taskId?: string;
}

interface TaskProcessor {
  type: string;
  handler: (data: any) => Promise<any>;
  concurrency?: number;
  timeout?: number;
}

class WorkerManager {
  private processors: Map<string, TaskProcessor> = new Map();
  private currentTask: string | null = null;
  private taskTimeout: NodeJS.Timeout | null = null;
  private workerId: string;

  constructor() {
    this.workerId = workerData.workerId || 'unknown';

    // Register processors from worker data
    if (workerData.processors) {
      workerData.processors.forEach(([type, processor]: [string, TaskProcessor]) => {
        this.registerProcessor(type, processor);
      });
    }

    this.setupMessageHandler();
    this.notifyReady();
  }

  private setupMessageHandler(): void {
    if (!parentPort) {
      throw new Error('Worker must be run in worker thread');
    }

    parentPort.on('message', async (message: TaskMessage) => {
      try {
        switch (message.type) {
          case 'execute':
            if (message.task) {
              await this.executeTask(message.task);
            }
            break;

          case 'cancel':
            if (message.taskId) {
              this.cancelTask(message.taskId);
            }
            break;

          default:
            this.sendError('Unknown message type', message.type);
        }
      } catch (error) {
        this.sendError('Message handling error', error);
      }
    });

    parentPort.on('error', (error) => {
      console.error(`Worker ${this.workerId} error:`, error);
    });
  }

  private registerProcessor(type: string, processor: TaskProcessor): void {
    // Recreate the handler function from the serialized data
    // Note: In a real implementation, you might need a more sophisticated
    // way to serialize/deserialize functions
    this.processors.set(type, {
      ...processor,
      handler: this.createHandler(type)
    });
  }

  private createHandler(type: string): (data: any) => Promise<any> {
    // Built-in handlers for common task types
    switch (type) {
      case 'graph:analyze':
        return this.handleGraphAnalysis.bind(this);

      case 'data:transform':
        return this.handleDataTransformation.bind(this);

      case 'file:process':
        return this.handleFileProcessing.bind(this);

      case 'image:resize':
        return this.handleImageResize.bind(this);

      case 'email:send':
        return this.handleEmailSend.bind(this);

      case 'report:generate':
        return this.handleReportGeneration.bind(this);

      default:
        return this.handleGenericTask.bind(this);
    }
  }

  private async executeTask(task: { id: string; type: string; data: any; timeout: number }): Promise<void> {
    const processor = this.processors.get(task.type);
    if (!processor) {
      this.sendError(`No processor found for task type: ${task.type}`, task.id);
      return;
    }

    this.currentTask = task.id;
    const startTime = Date.now();

    // Set timeout for the task
    this.taskTimeout = setTimeout(() => {
      this.sendError('Task timeout', task.id);
      this.currentTask = null;
    }, task.timeout);

    try {
      this.sendProgress(task.id, 0, 'Starting task');

      const result = await processor.handler(task.data);
      const duration = Date.now() - startTime;

      if (this.taskTimeout) {
        clearTimeout(this.taskTimeout);
        this.taskTimeout = null;
      }

      this.sendProgress(task.id, 100, 'Task completed');
      this.sendTaskCompleted(task.id, result, duration);

    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.taskTimeout) {
        clearTimeout(this.taskTimeout);
        this.taskTimeout = null;
      }

      this.sendTaskError(task.id, error, duration);
    }

    this.currentTask = null;
    this.notifyReady();
  }

  private cancelTask(taskId: string): void {
    if (this.currentTask === taskId) {
      if (this.taskTimeout) {
        clearTimeout(this.taskTimeout);
        this.taskTimeout = null;
      }

      this.sendTaskError(taskId, new Error('Task cancelled'), 0);
      this.currentTask = null;
      this.notifyReady();
    }
  }

  // Built-in task handlers

  private async handleGraphAnalysis(data: any): Promise<any> {
    this.sendProgress(this.currentTask!, 10, 'Parsing graph data');

    const { nodes, edges, options } = data;

    if (!nodes || !Array.isArray(nodes)) {
      throw new Error('Invalid graph data: nodes must be an array');
    }

    this.sendProgress(this.currentTask!, 30, 'Analyzing nodes');

    // Simulate analysis work
    await this.sleep(500);

    const nodeAnalysis = {
      totalNodes: nodes.length,
      nodeTypes: this.countNodeTypes(nodes),
      avgConnections: this.calculateAverageConnections(nodes, edges || [])
    };

    this.sendProgress(this.currentTask!, 60, 'Analyzing edges');

    const edgeAnalysis = edges ? {
      totalEdges: edges.length,
      edgeTypes: this.countEdgeTypes(edges),
      stronglyConnected: this.analyzeConnectivity(nodes, edges)
    } : null;

    this.sendProgress(this.currentTask!, 90, 'Generating report');

    await this.sleep(200);

    return {
      nodes: nodeAnalysis,
      edges: edgeAnalysis,
      metrics: {
        density: edgeAnalysis ? (edgeAnalysis.totalEdges / (nodeAnalysis.totalNodes * (nodeAnalysis.totalNodes - 1))) : 0,
        complexity: nodeAnalysis.totalNodes + (edgeAnalysis?.totalEdges || 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleDataTransformation(data: any): Promise<any> {
    this.sendProgress(this.currentTask!, 20, 'Validating input data');

    const { input, transformationType, options } = data;

    this.sendProgress(this.currentTask!, 40, 'Applying transformations');

    await this.sleep(300);

    let transformed;
    switch (transformationType) {
      case 'normalize':
        transformed = this.normalizeData(input);
        break;
      case 'aggregate':
        transformed = this.aggregateData(input, options);
        break;
      case 'filter':
        transformed = this.filterData(input, options);
        break;
      default:
        transformed = input;
    }

    this.sendProgress(this.currentTask!, 80, 'Finalizing transformation');

    await this.sleep(100);

    return {
      original: input,
      transformed,
      transformationType,
      metadata: {
        originalSize: JSON.stringify(input).length,
        transformedSize: JSON.stringify(transformed).length,
        timestamp: new Date().toISOString()
      }
    };
  }

  private async handleFileProcessing(data: any): Promise<any> {
    const { filePath, operation, options } = data;

    this.sendProgress(this.currentTask!, 10, 'Reading file');

    // Simulate file operations
    await this.sleep(200);

    this.sendProgress(this.currentTask!, 50, `Performing ${operation}`);

    await this.sleep(800);

    this.sendProgress(this.currentTask!, 90, 'Finalizing');

    await this.sleep(100);

    return {
      filePath,
      operation,
      success: true,
      processedAt: new Date().toISOString(),
      size: Math.floor(Math.random() * 10000) + 1000
    };
  }

  private async handleImageResize(data: any): Promise<any> {
    const { imagePath, width, height, quality } = data;

    this.sendProgress(this.currentTask!, 15, 'Loading image');
    await this.sleep(300);

    this.sendProgress(this.currentTask!, 45, 'Resizing image');
    await this.sleep(1000);

    this.sendProgress(this.currentTask!, 75, 'Optimizing quality');
    await this.sleep(400);

    this.sendProgress(this.currentTask!, 95, 'Saving image');
    await this.sleep(200);

    return {
      originalPath: imagePath,
      newDimensions: { width, height },
      quality,
      outputPath: imagePath.replace(/\.([^.]+)$/, `_${width}x${height}.$1`),
      success: true,
      processedAt: new Date().toISOString()
    };
  }

  private async handleEmailSend(data: any): Promise<any> {
    const { to, subject, body, attachments } = data;

    this.sendProgress(this.currentTask!, 20, 'Validating email data');
    await this.sleep(100);

    this.sendProgress(this.currentTask!, 40, 'Preparing message');
    await this.sleep(200);

    this.sendProgress(this.currentTask!, 70, 'Sending email');
    await this.sleep(500);

    this.sendProgress(this.currentTask!, 90, 'Confirming delivery');
    await this.sleep(100);

    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to,
      subject,
      sentAt: new Date().toISOString(),
      success: true,
      deliveryStatus: 'delivered'
    };
  }

  private async handleReportGeneration(data: any): Promise<any> {
    const { reportType, data: reportData, options } = data;

    this.sendProgress(this.currentTask!, 10, 'Gathering data');
    await this.sleep(300);

    this.sendProgress(this.currentTask!, 30, 'Processing analytics');
    await this.sleep(600);

    this.sendProgress(this.currentTask!, 60, 'Generating charts');
    await this.sleep(400);

    this.sendProgress(this.currentTask!, 85, 'Formatting report');
    await this.sleep(300);

    return {
      reportType,
      generatedAt: new Date().toISOString(),
      pageCount: Math.floor(Math.random() * 20) + 5,
      sections: ['Executive Summary', 'Data Analysis', 'Recommendations', 'Appendix'],
      format: options?.format || 'pdf',
      success: true
    };
  }

  private async handleGenericTask(data: any): Promise<any> {
    this.sendProgress(this.currentTask!, 25, 'Processing data');
    await this.sleep(500);

    this.sendProgress(this.currentTask!, 75, 'Finalizing');
    await this.sleep(200);

    return {
      input: data,
      processed: true,
      timestamp: new Date().toISOString()
    };
  }

  // Utility methods

  private countNodeTypes(nodes: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    nodes.forEach(node => {
      const type = node.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  private countEdgeTypes(edges: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    edges.forEach(edge => {
      const type = edge.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  private calculateAverageConnections(nodes: any[], edges: any[]): number {
    if (nodes.length === 0) return 0;

    const connectionCounts = new Map();
    nodes.forEach(node => connectionCounts.set(node.id, 0));

    edges.forEach(edge => {
      if (connectionCounts.has(edge.source)) {
        connectionCounts.set(edge.source, connectionCounts.get(edge.source) + 1);
      }
      if (connectionCounts.has(edge.target)) {
        connectionCounts.set(edge.target, connectionCounts.get(edge.target) + 1);
      }
    });

    const totalConnections = Array.from(connectionCounts.values()).reduce((sum, count) => sum + count, 0);
    return totalConnections / nodes.length;
  }

  private analyzeConnectivity(nodes: any[], edges: any[]): boolean {
    // Simplified connectivity check
    if (nodes.length <= 1) return true;

    const visited = new Set();
    const adjacency = new Map();

    // Build adjacency list
    nodes.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
      if (adjacency.has(edge.source)) {
        adjacency.get(edge.source).push(edge.target);
      }
      if (adjacency.has(edge.target)) {
        adjacency.get(edge.target).push(edge.source);
      }
    });

    // DFS from first node
    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      const neighbors = adjacency.get(nodeId) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      });
    };

    dfs(nodes[0].id);
    return visited.size === nodes.length;
  }

  private normalizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeItem(item));
    }
    return this.normalizeItem(data);
  }

  private normalizeItem(item: any): any {
    if (typeof item === 'string') {
      return item.toLowerCase().trim();
    }
    if (typeof item === 'number') {
      return Math.round(item * 100) / 100;
    }
    if (typeof item === 'object' && item !== null) {
      const normalized: any = {};
      Object.keys(item).forEach(key => {
        normalized[key.toLowerCase()] = this.normalizeItem(item[key]);
      });
      return normalized;
    }
    return item;
  }

  private aggregateData(data: any[], options: any): any {
    if (!Array.isArray(data)) {
      throw new Error('Aggregate operation requires array input');
    }

    const { groupBy, operation = 'count' } = options || {};

    if (!groupBy) {
      switch (operation) {
        case 'sum':
          return data.reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0);
        case 'avg':
          const numbers = data.filter(item => typeof item === 'number');
          return numbers.length > 0 ? numbers.reduce((sum, num) => sum + num, 0) / numbers.length : 0;
        case 'count':
        default:
          return data.length;
      }
    }

    const groups: Record<string, any[]> = {};
    data.forEach(item => {
      const key = item[groupBy] || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const result: Record<string, any> = {};
    Object.keys(groups).forEach(key => {
      result[key] = this.aggregateData(groups[key], { operation });
    });

    return result;
  }

  private filterData(data: any[], options: any): any[] {
    if (!Array.isArray(data)) {
      throw new Error('Filter operation requires array input');
    }

    const { field, operator = 'equals', value } = options || {};

    if (!field || value === undefined) {
      return data;
    }

    return data.filter(item => {
      const itemValue = item[field];

      switch (operator) {
        case 'equals':
          return itemValue === value;
        case 'not_equals':
          return itemValue !== value;
        case 'greater_than':
          return itemValue > value;
        case 'less_than':
          return itemValue < value;
        case 'contains':
          return typeof itemValue === 'string' && itemValue.includes(value);
        case 'starts_with':
          return typeof itemValue === 'string' && itemValue.startsWith(value);
        default:
          return true;
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Communication methods

  private sendTaskCompleted(taskId: string, result: any, duration: number): void {
    this.sendMessage({
      type: 'task:completed',
      taskId,
      result,
      duration
    });
  }

  private sendTaskError(taskId: string, error: any, duration: number): void {
    this.sendMessage({
      type: 'task:error',
      taskId,
      error: error.message || String(error),
      duration
    });
  }

  private sendProgress(taskId: string, progress: number, message?: string): void {
    this.sendMessage({
      type: 'task:progress',
      taskId,
      progress,
      message
    });
  }

  private sendError(message: string, details?: any): void {
    this.sendMessage({
      type: 'error',
      message,
      details
    });
  }

  private notifyReady(): void {
    this.sendMessage({
      type: 'worker:ready',
      workerId: this.workerId
    });
  }

  private sendMessage(message: any): void {
    if (parentPort) {
      parentPort.postMessage(message);
    }
  }
}

// Initialize worker
new WorkerManager();