import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  event: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'user' | 'api' | 'system' | 'security' | 'data';
  success: boolean;
  errorMessage?: string;
}

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  event?: string;
  category?: string;
  severity?: string;
  success?: boolean;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topIpAddresses: Array<{ ipAddress: string; count: number }>;
  failureRate: number;
  timeRange: { start: Date; end: Date };
}

export interface AuditLoggerConfig {
  logDirectory: string;
  maxFileSize: number;
  maxFiles: number;
  retentionDays: number;
  enableConsoleOutput: boolean;
  enableFileOutput: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

export class AuditLogger extends EventEmitter {
  private events: AuditEvent[] = [];
  private config: AuditLoggerConfig;
  private buffer: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private fileWriteStream?: any;
  private currentLogFile?: string;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    super();

    this.config = {
      logDirectory: config.logDirectory || './logs/audit',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 10,
      retentionDays: config.retentionDays || 90,
      enableConsoleOutput: config.enableConsoleOutput ?? true,
      enableFileOutput: config.enableFileOutput ?? true,
      enableRemoteLogging: config.enableRemoteLogging ?? false,
      remoteEndpoint: config.remoteEndpoint,
      bufferSize: config.bufferSize || 100,
      flushInterval: config.flushInterval || 5000, // 5 seconds
      ...config
    };

    this.initialize();
  }

  async log(event: string, details: Record<string, any> = {}, options: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: 'auth' | 'user' | 'api' | 'system' | 'security' | 'data';
    success?: boolean;
    errorMessage?: string;
  } = {}): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      event,
      userId: options.userId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      resource: options.resource,
      action: options.action,
      details,
      severity: options.severity || this.inferSeverity(event),
      category: options.category || this.inferCategory(event),
      success: options.success ?? true,
      errorMessage: options.errorMessage
    };

    await this.writeAuditEvent(auditEvent);
    this.emit('audit:logged', auditEvent);
  }

  async logAuthEvent(event: string, details: Record<string, any>, success: boolean = true): Promise<void> {
    await this.log(event, details, {
      category: 'auth',
      severity: success ? 'low' : 'medium',
      success
    });
  }

  async logSecurityEvent(event: string, details: Record<string, any>, severity: 'low' | 'medium' | 'high' | 'critical' = 'high'): Promise<void> {
    await this.log(event, details, {
      category: 'security',
      severity,
      success: severity === 'low'
    });
  }

  async logDataAccess(resource: string, action: string, details: Record<string, any>): Promise<void> {
    await this.log(`data.${action}`, details, {
      category: 'data',
      resource,
      action,
      severity: 'low'
    });
  }

  async logApiCall(endpoint: string, method: string, details: Record<string, any>, success: boolean = true): Promise<void> {
    await this.log(`api.${method.toLowerCase()}`, details, {
      category: 'api',
      resource: endpoint,
      action: method.toLowerCase(),
      severity: success ? 'low' : 'medium',
      success
    });
  }

  async search(query: AuditQuery): Promise<AuditEvent[]> {
    let filteredEvents = [...this.events];

    if (query.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= query.endTime!);
    }

    if (query.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === query.userId);
    }

    if (query.event) {
      filteredEvents = filteredEvents.filter(e => e.event.includes(query.event!));
    }

    if (query.category) {
      filteredEvents = filteredEvents.filter(e => e.category === query.category);
    }

    if (query.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === query.severity);
    }

    if (query.success !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.success === query.success);
    }

    if (query.ipAddress) {
      filteredEvents = filteredEvents.filter(e => e.ipAddress === query.ipAddress);
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return filteredEvents.slice(offset, offset + limit);
  }

  async getStatistics(timeRange?: { start: Date; end: Date }): Promise<AuditStatistics> {
    let events = this.events;

    if (timeRange) {
      events = events.filter(e =>
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    const eventsByCategory: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    let failures = 0;

    events.forEach(event => {
      // Category counts
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;

      // Severity counts
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      // User counts
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }

      // IP counts
      if (event.ipAddress) {
        ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      }

      // Failure count
      if (!event.success) {
        failures++;
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topIpAddresses = Object.entries(ipCounts)
      .map(([ipAddress, count]) => ({ ipAddress, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const defaultTimeRange = {
      start: events.length > 0 ? events[events.length - 1].timestamp : new Date(),
      end: events.length > 0 ? events[0].timestamp : new Date()
    };

    return {
      totalEvents: events.length,
      eventsByCategory,
      eventsBySeverity,
      topUsers,
      topIpAddresses,
      failureRate: events.length > 0 ? failures / events.length : 0,
      timeRange: timeRange || defaultTimeRange
    };
  }

  async exportLogs(format: 'json' | 'csv' | 'xml' = 'json', query?: AuditQuery): Promise<string> {
    const events = query ? await this.search(query) : this.events;

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv':
        return this.exportToCsv(events);

      case 'xml':
        return this.exportToXml(events);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async purgeOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const originalLength = this.events.length;
    this.events = this.events.filter(event => event.timestamp >= cutoffDate);

    const purgedCount = originalLength - this.events.length;

    if (purgedCount > 0) {
      await this.log('audit.purge', {
        purgedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays: this.config.retentionDays
      }, {
        category: 'system',
        severity: 'low'
      });
    }

    return purgedCount;
  }

  private async initialize(): Promise<void> {
    if (this.config.enableFileOutput) {
      await this.ensureLogDirectory();
      await this.setupFileLogging();
    }

    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);

    // Start periodic cleanup
    setInterval(() => {
      this.purgeOldLogs();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private async writeAuditEvent(event: AuditEvent): Promise<void> {
    this.events.push(event);

    // Keep only recent events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    this.buffer.push(event);

    if (this.config.enableConsoleOutput) {
      this.logToConsole(event);
    }

    if (this.buffer.length >= this.config.bufferSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    if (this.config.enableFileOutput) {
      await this.writeToFile(eventsToFlush);
    }

    if (this.config.enableRemoteLogging) {
      await this.sendToRemote(eventsToFlush);
    }
  }

  private logToConsole(event: AuditEvent): void {
    const timestamp = event.timestamp.toISOString();
    const level = event.success ? 'INFO' : 'WARN';
    const message = `[${timestamp}] [${level}] [${event.category.toUpperCase()}] ${event.event}`;

    if (event.success) {
      console.log(message, event.details);
    } else {
      console.warn(message, event.details, event.errorMessage);
    }
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    try {
      const logData = events.map(event => JSON.stringify(event)).join('\n') + '\n';

      if (!this.currentLogFile || await this.shouldRotateLogFile()) {
        await this.rotateLogFile();
      }

      await fs.appendFile(this.currentLogFile!, logData, 'utf8');
    } catch (error) {
      console.error('Failed to write audit events to file:', error);
    }
  }

  private async sendToRemote(events: AuditEvent[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send audit events to remote endpoint:', error);
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private async setupFileLogging(): Promise<void> {
    const logFileName = `audit-${new Date().toISOString().split('T')[0]}.log`;
    this.currentLogFile = path.join(this.config.logDirectory, logFileName);
  }

  private async shouldRotateLogFile(): Promise<boolean> {
    if (!this.currentLogFile) return true;

    try {
      const stats = await fs.stat(this.currentLogFile);
      return stats.size >= this.config.maxFileSize;
    } catch (error) {
      return true; // File doesn't exist, should create new
    }
  }

  private async rotateLogFile(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `audit-${timestamp}.log`;
    this.currentLogFile = path.join(this.config.logDirectory, logFileName);

    // Clean up old log files
    await this.cleanupOldLogFiles();
  }

  private async cleanupOldLogFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file)
        }));

      if (logFiles.length <= this.config.maxFiles) return;

      // Sort by name (which includes timestamp) and remove oldest
      logFiles.sort((a, b) => a.name.localeCompare(b.name));
      const filesToRemove = logFiles.slice(0, logFiles.length - this.config.maxFiles);

      for (const file of filesToRemove) {
        await fs.unlink(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private exportToCsv(events: AuditEvent[]): string {
    const headers = [
      'timestamp', 'event', 'userId', 'ipAddress', 'category',
      'severity', 'success', 'resource', 'action', 'details'
    ];

    const csvLines = [headers.join(',')];

    events.forEach(event => {
      const row = [
        event.timestamp.toISOString(),
        event.event,
        event.userId || '',
        event.ipAddress || '',
        event.category,
        event.severity,
        event.success.toString(),
        event.resource || '',
        event.action || '',
        `"${JSON.stringify(event.details).replace(/"/g, '""')}"`
      ];
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  private exportToXml(events: AuditEvent[]): string {
    const xmlEvents = events.map(event => `
    <event>
      <id>${event.id}</id>
      <timestamp>${event.timestamp.toISOString()}</timestamp>
      <event>${event.event}</event>
      <userId>${event.userId || ''}</userId>
      <ipAddress>${event.ipAddress || ''}</ipAddress>
      <category>${event.category}</category>
      <severity>${event.severity}</severity>
      <success>${event.success}</success>
      <resource>${event.resource || ''}</resource>
      <action>${event.action || ''}</action>
      <details><![CDATA[${JSON.stringify(event.details)}]]></details>
    </event>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<auditLog>
  <events>${xmlEvents}
  </events>
</auditLog>`;
  }

  private inferSeverity(event: string): 'low' | 'medium' | 'high' | 'critical' {
    if (event.includes('error') || event.includes('failed') || event.includes('breach')) {
      return 'high';
    }
    if (event.includes('warning') || event.includes('suspicious')) {
      return 'medium';
    }
    return 'low';
  }

  private inferCategory(event: string): 'auth' | 'user' | 'api' | 'system' | 'security' | 'data' {
    if (event.startsWith('auth.')) return 'auth';
    if (event.startsWith('user.')) return 'user';
    if (event.startsWith('api.')) return 'api';
    if (event.startsWith('security.')) return 'security';
    if (event.startsWith('data.')) return 'data';
    return 'system';
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushBuffer();
  }
}