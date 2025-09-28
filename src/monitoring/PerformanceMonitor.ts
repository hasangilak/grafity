import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    free: number;
    usage: number;
    heapUsed: number;
    heapTotal: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

export interface OperationMetrics {
  operationName: string;
  duration: number;
  success: boolean;
  errorCount: number;
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
}

export interface TimingResult {
  duration: number;
  success: boolean;
  error?: Error;
  result?: any;
}

export interface MetricsFilter {
  name?: string;
  startTime?: Date;
  endTime?: Date;
  tags?: Record<string, string>;
  limit?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metric: PerformanceMetric) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: PerformanceMetric;
  timestamp: Date;
  acknowledged: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private operationTimings: Map<string, number[]> = new Map();
  private operationErrors: Map<string, number> = new Map();
  private systemMetricsInterval?: NodeJS.Timeout;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private isMonitoring: boolean = false;
  private config: MonitoringConfig;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = {
      systemMetricsInterval: 5000,
      maxMetricsHistory: 10000,
      enableSystemMetrics: true,
      enableOperationMetrics: true,
      enableAlerts: true,
      metricsRetentionDays: 7,
      ...config
    };

    this.setupDefaultAlerts();
  }

  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    if (this.config.enableSystemMetrics) {
      this.startSystemMetricsCollection();
    }

    this.emit('monitor:started');
  }

  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = undefined;
    }

    this.emit('monitor:stopped');
  }

  recordMetric(name: string, value: number, unit: string = '', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    this.addMetric(metric);
  }

  recordCounter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    this.recordMetric(name, increment, 'count', tags);
  }

  recordGauge(name: string, value: number, unit: string = '', tags?: Record<string, string>): void {
    this.recordMetric(name, value, unit, tags);
  }

  recordHistogram(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>): void {
    this.recordMetric(name, value, unit, tags);
  }

  async timeOperation<T>(operationName: string, operation: () => Promise<T>): Promise<TimingResult> {
    const startTime = process.hrtime.bigint();
    let success = true;
    let error: Error | undefined;
    let result: T | undefined;

    try {
      result = await operation();
    } catch (err) {
      success = false;
      error = err as Error;
      this.incrementErrorCount(operationName);
    } finally {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      this.recordOperationTiming(operationName, duration);
      this.recordMetric(`operation.${operationName}.duration`, duration, 'ms', { success: success.toString() });

      if (!success && error) {
        this.recordMetric(`operation.${operationName}.error`, 1, 'count', { error: error.message });
      }
    }

    return { duration: Number(process.hrtime.bigint() - startTime) / 1000000, success, error, result };
  }

  getSystemMetrics(): SystemMetrics {
    const cpus = os.cpus();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: {
        usage: this.getCPUUsage(),
        loadAverage: os.loadavg(),
        cores: cpus.length
      },
      memory: {
        used: usedMem,
        total: totalMem,
        free: freeMem,
        usage: (usedMem / totalMem) * 100,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: memUsage.rss,
        cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
      }
    };
  }

  getOperationMetrics(operationName: string): OperationMetrics | null {
    const timings = this.operationTimings.get(operationName);
    const errorCount = this.operationErrors.get(operationName) || 0;

    if (!timings || timings.length === 0) {
      return null;
    }

    const sortedTimings = [...timings].sort((a, b) => a - b);
    const totalOperations = timings.length;
    const successCount = totalOperations - errorCount;

    return {
      operationName,
      duration: sortedTimings[sortedTimings.length - 1],
      success: errorCount === 0,
      errorCount,
      throughput: totalOperations / (Date.now() / 1000), // Operations per second
      latency: {
        p50: this.getPercentile(sortedTimings, 50),
        p95: this.getPercentile(sortedTimings, 95),
        p99: this.getPercentile(sortedTimings, 99),
        avg: sortedTimings.reduce((sum, time) => sum + time, 0) / sortedTimings.length
      }
    };
  }

  getMetrics(filter?: MetricsFilter): PerformanceMetric[] {
    let filtered = [...this.metrics];

    if (filter) {
      if (filter.name) {
        filtered = filtered.filter(m => m.name.includes(filter.name!));
      }

      if (filter.startTime) {
        filtered = filtered.filter(m => m.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter(m => m.timestamp <= filter.endTime!);
      }

      if (filter.tags) {
        filtered = filtered.filter(m => {
          if (!m.tags) return false;
          return Object.entries(filter.tags!).every(([key, value]) => m.tags![key] === value);
        });
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', alert);
      return true;
    }
    return false;
  }

  clearAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      this.activeAlerts.delete(alertId);
      this.emit('alert:cleared', alert);
      return true;
    }
    return false;
  }

  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();

      this.recordGauge('system.cpu.usage', metrics.cpu.usage, '%');
      this.recordGauge('system.memory.usage', metrics.memory.usage, '%');
      this.recordGauge('system.memory.used', metrics.memory.used, 'bytes');
      this.recordGauge('system.memory.free', metrics.memory.free, 'bytes');
      this.recordGauge('system.process.memory', metrics.process.memoryUsage, 'bytes');
      this.recordGauge('system.process.uptime', metrics.process.uptime, 'seconds');

      metrics.cpu.loadAverage.forEach((load, index) => {
        this.recordGauge(`system.cpu.load.${index + 1}min`, load, '');
      });

    }, this.config.systemMetricsInterval);
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    if (this.metrics.length > this.config.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsHistory);
    }

    if (this.config.enableAlerts) {
      this.checkAlerts(metric);
    }

    this.emit('metric:recorded', metric);
  }

  private checkAlerts(metric: PerformanceMetric): void {
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      const now = new Date();
      if (rule.lastTriggered && (now.getTime() - rule.lastTriggered.getTime()) < rule.cooldownMs) {
        return;
      }

      if (rule.condition(metric)) {
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: `Alert: ${rule.name} - ${metric.name} = ${metric.value}${metric.unit}`,
          metric,
          timestamp: now,
          acknowledged: false
        };

        this.activeAlerts.set(alert.id, alert);
        rule.lastTriggered = now;

        this.emit('alert:triggered', alert);
      }
    });
  }

  private recordOperationTiming(operationName: string, duration: number): void {
    if (!this.operationTimings.has(operationName)) {
      this.operationTimings.set(operationName, []);
    }

    const timings = this.operationTimings.get(operationName)!;
    timings.push(duration);

    if (timings.length > 1000) {
      timings.splice(0, timings.length - 1000);
    }
  }

  private incrementErrorCount(operationName: string): void {
    const current = this.operationErrors.get(operationName) || 0;
    this.operationErrors.set(operationName, current + 1);
  }

  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return ((totalTick - totalIdle) / totalTick) * 100;
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private setupDefaultAlerts(): void {
    this.addAlertRule({
      id: 'high_cpu_usage',
      name: 'High CPU Usage',
      condition: (metric: PerformanceMetric) =>
        metric.name === 'system.cpu.usage' && metric.value > 80,
      severity: 'high',
      threshold: 80,
      enabled: true,
      cooldownMs: 60000 // 1 minute
    });

    this.addAlertRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: (metric: PerformanceMetric) =>
        metric.name === 'system.memory.usage' && metric.value > 85,
      severity: 'high',
      threshold: 85,
      enabled: true,
      cooldownMs: 60000
    });

    this.addAlertRule({
      id: 'operation_error_rate',
      name: 'High Operation Error Rate',
      condition: (metric: PerformanceMetric) =>
        metric.name.includes('.error') && metric.value > 10,
      severity: 'medium',
      threshold: 10,
      enabled: true,
      cooldownMs: 30000
    });
  }

  getDashboardData(): any {
    const systemMetrics = this.getSystemMetrics();
    const recentMetrics = this.getMetrics({ limit: 100 });
    const alerts = this.getActiveAlerts();

    return {
      system: systemMetrics,
      recentMetrics,
      alerts,
      operations: Array.from(this.operationTimings.keys()).map(op => this.getOperationMetrics(op)),
      summary: {
        totalMetrics: this.metrics.length,
        activeAlerts: alerts.filter(a => !a.acknowledged).length,
        operationsTracked: this.operationTimings.size
      }
    };
  }

  exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.metrics, null, 2);

      case 'csv':
        const headers = 'timestamp,name,value,unit,tags';
        const rows = this.metrics.map(m =>
          `${m.timestamp.toISOString()},${m.name},${m.value},${m.unit},"${JSON.stringify(m.tags || {})}"`
        );
        return [headers, ...rows].join('\n');

      case 'prometheus':
        return this.toPrometheusFormat();

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private toPrometheusFormat(): string {
    const lines: string[] = [];
    const metricGroups = new Map<string, PerformanceMetric[]>();

    this.metrics.forEach(metric => {
      const key = metric.name.replace(/[^a-zA-Z0-9_:]/g, '_');
      if (!metricGroups.has(key)) {
        metricGroups.set(key, []);
      }
      metricGroups.get(key)!.push(metric);
    });

    metricGroups.forEach((metrics, name) => {
      const latest = metrics[metrics.length - 1];
      const tags = latest.tags
        ? Object.entries(latest.tags).map(([k, v]) => `${k}="${v}"`).join(',')
        : '';

      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${tags ? `{${tags}}` : ''} ${latest.value} ${latest.timestamp.getTime()}`);
    });

    return lines.join('\n');
  }
}

export interface MonitoringConfig {
  systemMetricsInterval: number;
  maxMetricsHistory: number;
  enableSystemMetrics: boolean;
  enableOperationMetrics: boolean;
  enableAlerts: boolean;
  metricsRetentionDays: number;
}