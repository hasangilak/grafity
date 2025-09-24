import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { ProjectGraph, VisualChange, CodeModification, AIResponse } from '../../types';

export interface ChangeEvent {
  id: string;
  timestamp: Date;
  source: 'human' | 'ai' | 'system';
  type: 'visual_change' | 'code_change' | 'ai_suggestion' | 'sync_complete' | 'conflict_detected';
  data: VisualChange | CodeModification[] | AIResponse | ConflictData;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface ConflictData {
  conflictId: string;
  description: string;
  humanChange: VisualChange | CodeModification[];
  aiChange: VisualChange | CodeModification[];
  affectedComponents: string[];
  resolutionOptions: ConflictResolution[];
}

export interface ConflictResolution {
  id: string;
  strategy: 'accept_human' | 'accept_ai' | 'merge' | 'manual_resolve';
  description: string;
  mergedResult?: VisualChange | CodeModification[];
}

export interface ClientConnection {
  id: string;
  websocket: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

export interface EventSubscription {
  id: string;
  eventTypes: string[];
  filter?: (event: ChangeEvent) => boolean;
  callback: (event: ChangeEvent) => void | Promise<void>;
}

export class ChangeEventSystem extends EventEmitter {
  private connections: Map<string, ClientConnection> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: ChangeEvent[] = [];
  private maxHistorySize: number = 1000;
  private conflictQueue: Map<string, ConflictData> = new Map();

  constructor(maxHistorySize: number = 1000) {
    super();
    this.maxHistorySize = maxHistorySize;
  }

  public addConnection(websocket: WebSocket, userId?: string, metadata: Record<string, any> = {}): string {
    const connectionId = this.generateConnectionId();
    const connection: ClientConnection = {
      id: connectionId,
      websocket,
      userId,
      subscriptions: new Set(),
      metadata
    };

    this.connections.set(connectionId, connection);

    websocket.on('message', (data) => {
      this.handleWebSocketMessage(connectionId, data);
    });

    websocket.on('close', () => {
      this.removeConnection(connectionId);
    });

    websocket.on('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
    });

    this.emit('connection_added', { connectionId, userId, metadata });
    console.log(`Client connected: ${connectionId} (User: ${userId || 'anonymous'})`);

    return connectionId;
  }

  public removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.forEach(subId => {
      this.subscriptions.delete(subId);
    });

    this.connections.delete(connectionId);
    this.emit('connection_removed', { connectionId });
    console.log(`Client disconnected: ${connectionId}`);
  }

  public publishEvent(event: Omit<ChangeEvent, 'id' | 'timestamp'>): string {
    const fullEvent: ChangeEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    this.eventHistory.push(fullEvent);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    this.broadcastToSubscribers(fullEvent);
    this.emit('event_published', fullEvent);

    console.log(`Event published: ${fullEvent.type} (${fullEvent.source}) - ${fullEvent.id}`);
    return fullEvent.id;
  }

  public subscribe(
    eventTypes: string[],
    callback: (event: ChangeEvent) => void | Promise<void>,
    filter?: (event: ChangeEvent) => boolean
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes,
      callback,
      filter
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  public subscribeConnection(connectionId: string, eventTypes: string[], filter?: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const subscriptionId = this.subscribe(
      eventTypes,
      (event) => this.sendToConnection(connectionId, event),
      filter ? this.parseFilter(filter) : undefined
    );

    connection.subscriptions.add(subscriptionId);
    return true;
  }

  public publishVisualChange(change: VisualChange, source: 'human' | 'ai' = 'human', userId?: string): string {
    return this.publishEvent({
      source,
      type: 'visual_change',
      data: change,
      userId,
      metadata: { changeType: change.type, component: change.sourceComponent }
    });
  }

  public publishCodeChange(modifications: CodeModification[], source: 'human' | 'ai' = 'human', userId?: string): string {
    return this.publishEvent({
      source,
      type: 'code_change',
      data: modifications,
      userId,
      metadata: {
        filesAffected: modifications.length,
        modificationTypes: [...new Set(modifications.map(m => m.type))]
      }
    });
  }

  public publishAIResponse(response: AIResponse, userId?: string): string {
    return this.publishEvent({
      source: 'ai',
      type: 'ai_suggestion',
      data: response,
      userId,
      metadata: { confidence: response.confidence, trigger: response.trigger }
    });
  }

  public detectConflict(humanChange: VisualChange | CodeModification[], aiChange: VisualChange | CodeModification[]): string | null {
    const conflictId = this.generateConflictId();

    const affectedComponents = this.getAffectedComponents(humanChange, aiChange);

    if (affectedComponents.length === 0) {
      return null;
    }

    const conflict: ConflictData = {
      conflictId,
      description: `Simultaneous changes detected on components: ${affectedComponents.join(', ')}`,
      humanChange,
      aiChange,
      affectedComponents,
      resolutionOptions: this.generateResolutionOptions(humanChange, aiChange)
    };

    this.conflictQueue.set(conflictId, conflict);

    this.publishEvent({
      source: 'system',
      type: 'conflict_detected',
      data: conflict,
      metadata: { affectedComponents, resolutionOptions: conflict.resolutionOptions.length }
    });

    return conflictId;
  }

  public resolveConflict(conflictId: string, resolutionId: string, customResolution?: VisualChange | CodeModification[]): boolean {
    const conflict = this.conflictQueue.get(conflictId);
    if (!conflict) return false;

    const resolution = conflict.resolutionOptions.find(r => r.id === resolutionId);
    if (!resolution) return false;

    let finalResolution: VisualChange | CodeModification[];

    switch (resolution.strategy) {
      case 'accept_human':
        finalResolution = conflict.humanChange;
        break;
      case 'accept_ai':
        finalResolution = conflict.aiChange;
        break;
      case 'merge':
        finalResolution = resolution.mergedResult || conflict.humanChange;
        break;
      case 'manual_resolve':
        finalResolution = customResolution || conflict.humanChange;
        break;
      default:
        finalResolution = conflict.humanChange;
    }

    this.conflictQueue.delete(conflictId);

    this.publishEvent({
      source: 'system',
      type: 'sync_complete',
      data: Array.isArray(finalResolution) ? finalResolution : [finalResolution] as any,
      metadata: {
        conflictId,
        resolution: resolution.strategy,
        description: resolution.description
      }
    });

    return true;
  }

  public getEventHistory(limit?: number, filter?: (event: ChangeEvent) => boolean): ChangeEvent[] {
    let history = this.eventHistory;

    if (filter) {
      history = history.filter(filter);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  public getActiveConflicts(): ConflictData[] {
    return Array.from(this.conflictQueue.values());
  }

  public getConnectionStats(): { total: number; byUser: Record<string, number> } {
    const stats = { total: this.connections.size, byUser: {} as Record<string, number> };

    this.connections.forEach(conn => {
      const userId = conn.userId || 'anonymous';
      stats.byUser[userId] = (stats.byUser[userId] || 0) + 1;
    });

    return stats;
  }

  private handleWebSocketMessage(connectionId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.subscribeConnection(connectionId, message.eventTypes, message.filter);
          break;
        case 'visual_change':
          this.publishVisualChange(message.data, 'human', message.userId);
          break;
        case 'resolve_conflict':
          this.resolveConflict(message.conflictId, message.resolutionId, message.customResolution);
          break;
        default:
          console.warn(`Unknown message type from connection ${connectionId}:`, message.type);
      }
    } catch (error) {
      console.error(`Error parsing WebSocket message from ${connectionId}:`, error);
    }
  }

  private broadcastToSubscribers(event: ChangeEvent): void {
    this.subscriptions.forEach(subscription => {
      if (!subscription.eventTypes.includes(event.type)) return;
      if (subscription.filter && !subscription.filter(event)) return;

      try {
        const result = subscription.callback(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Subscription callback error for ${subscription.id}:`, error);
          });
        }
      } catch (error) {
        console.error(`Subscription callback error for ${subscription.id}:`, error);
      }
    });
  }

  private sendToConnection(connectionId: string, event: ChangeEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.websocket.readyState !== 1) return;

    try {
      connection.websocket.send(JSON.stringify({
        type: 'event',
        event
      }));
    } catch (error) {
      console.error(`Error sending event to connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  private getAffectedComponents(change1: VisualChange | CodeModification[], change2: VisualChange | CodeModification[]): string[] {
    const components1 = this.extractComponentNames(change1);
    const components2 = this.extractComponentNames(change2);

    return components1.filter(comp => components2.includes(comp));
  }

  private extractComponentNames(change: VisualChange | CodeModification[]): string[] {
    if (Array.isArray(change)) {
      const codeChanges = change as CodeModification[];
      return codeChanges.flatMap(mod =>
        mod.file.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || []
      ).filter(Boolean);
    } else {
      const visualChange = change as VisualChange;
      return [visualChange.sourceComponent, visualChange.targetComponent].filter(Boolean) as string[];
    }
  }

  private generateResolutionOptions(humanChange: VisualChange | CodeModification[], aiChange: VisualChange | CodeModification[]): ConflictResolution[] {
    return [
      {
        id: 'accept_human',
        strategy: 'accept_human',
        description: 'Accept human changes and discard AI changes'
      },
      {
        id: 'accept_ai',
        strategy: 'accept_ai',
        description: 'Accept AI changes and discard human changes'
      },
      {
        id: 'manual_resolve',
        strategy: 'manual_resolve',
        description: 'Manually resolve the conflict by choosing specific changes'
      }
    ];
  }

  private parseFilter(filterString: string): (event: ChangeEvent) => boolean {
    return (event: ChangeEvent) => {
      try {
        return new Function('event', `return ${filterString}`)(event);
      } catch {
        return true;
      }
    };
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public cleanup(): void {
    this.connections.forEach(conn => {
      if (conn.websocket.readyState === 1) {
        conn.websocket.close();
      }
    });

    this.connections.clear();
    this.subscriptions.clear();
    this.eventHistory = [];
    this.conflictQueue.clear();

    this.emit('system_cleanup');
  }
}