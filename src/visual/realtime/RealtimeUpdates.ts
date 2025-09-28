/**
 * Real-time Updates Handler for Graph Visualization
 * Manages live updates, animations, and synchronization with the graph engine
 */

import { EventEmitter } from 'events';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';

export type UpdateType = 'node-added' | 'node-updated' | 'node-removed' | 'edge-added' | 'edge-updated' | 'edge-removed' | 'graph-reset';

export interface GraphUpdate {
  id: string;
  type: UpdateType;
  timestamp: Date;
  data: any;
  metadata?: {
    source?: string;
    userId?: string;
    batchId?: string;
    animation?: AnimationConfig;
  };
}

export interface NodeUpdate extends GraphUpdate {
  type: 'node-added' | 'node-updated' | 'node-removed';
  data: {
    node: AnyGraphNode;
    previousNode?: AnyGraphNode;
    position?: { x: number; y: number };
  };
}

export interface EdgeUpdate extends GraphUpdate {
  type: 'edge-added' | 'edge-updated' | 'edge-removed';
  data: {
    edge: {
      id: string;
      sourceId: string;
      targetId: string;
      type: string;
      label?: string;
      metadata?: any;
    };
    previousEdge?: any;
  };
}

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  type: 'fade' | 'scale' | 'slide' | 'bounce' | 'glow' | 'pulse';
  intensity?: number;
}

export interface RealtimeOptions {
  enableAnimations: boolean;
  batchUpdates: boolean;
  batchDelay: number;
  maxUpdateQueue: number;
  animationDuration: number;
  enableDiffVisualization: boolean;
  enableUpdateHistory: boolean;
  maxHistorySize: number;
}

/**
 * Real-time Updates Manager
 */
export class RealtimeUpdatesManager extends EventEmitter {
  private updateQueue: GraphUpdate[] = [];
  private updateHistory: GraphUpdate[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private animationQueue: Map<string, AnimationConfig> = new Map();

  constructor(private options: RealtimeOptions) {
    super();
    this.setMaxListeners(100); // Increase listener limit for complex graphs
  }

  /**
   * Add an update to the queue
   */
  public addUpdate(update: Omit<GraphUpdate, 'id' | 'timestamp'>): void {
    const fullUpdate: GraphUpdate = {
      ...update,
      id: this.generateUpdateId(),
      timestamp: new Date()
    };

    // Add to queue
    this.updateQueue.push(fullUpdate);

    // Trim queue if too large
    if (this.updateQueue.length > this.options.maxUpdateQueue) {
      this.updateQueue.shift();
    }

    // Process immediately or batch
    if (this.options.batchUpdates) {
      this.scheduleBatchProcessing();
    } else {
      this.processUpdate(fullUpdate);
    }

    // Add to history
    if (this.options.enableUpdateHistory) {
      this.addToHistory(fullUpdate);
    }
  }

  /**
   * Process a single update
   */
  private async processUpdate(update: GraphUpdate): Promise<void> {
    try {
      // Apply animation if enabled
      if (this.options.enableAnimations && update.metadata?.animation) {
        await this.animateUpdate(update);
      }

      // Emit specific update event
      this.emit(`update:${update.type}`, update);
      this.emit('update', update);

      // Handle different update types
      switch (update.type) {
        case 'node-added':
          await this.handleNodeAdded(update as NodeUpdate);
          break;
        case 'node-updated':
          await this.handleNodeUpdated(update as NodeUpdate);
          break;
        case 'node-removed':
          await this.handleNodeRemoved(update as NodeUpdate);
          break;
        case 'edge-added':
          await this.handleEdgeAdded(update as EdgeUpdate);
          break;
        case 'edge-updated':
          await this.handleEdgeUpdated(update as EdgeUpdate);
          break;
        case 'edge-removed':
          await this.handleEdgeRemoved(update as EdgeUpdate);
          break;
        case 'graph-reset':
          await this.handleGraphReset(update);
          break;
      }

      this.emit('update:processed', update);
    } catch (error) {
      this.emit('update:error', { update, error });
      console.error('Failed to process update:', error);
    }
  }

  /**
   * Handle node addition
   */
  private async handleNodeAdded(update: NodeUpdate): Promise<void> {
    const { node, position } = update.data;

    // Default animation for new nodes
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // bounce
      type: 'scale',
      intensity: 0
    };

    // Store animation for the node
    this.animationQueue.set(node.id, animation);

    // Emit specific node events
    this.emit('node:added', { node, position, animation });

    // Trigger layout update if needed
    this.emit('layout:update-needed', { reason: 'node-added', nodeId: node.id });
  }

  /**
   * Handle node update
   */
  private async handleNodeUpdated(update: NodeUpdate): Promise<void> {
    const { node, previousNode } = update.data;

    // Generate diff if enabled
    if (this.options.enableDiffVisualization && previousNode) {
      const diff = this.generateNodeDiff(previousNode, node);
      this.emit('node:diff', { nodeId: node.id, diff });
    }

    // Subtle pulse animation for updates
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration / 2,
      easing: 'ease-in-out',
      type: 'pulse',
      intensity: 0.3
    };

    this.animationQueue.set(node.id, animation);
    this.emit('node:updated', { node, previousNode, animation });
  }

  /**
   * Handle node removal
   */
  private async handleNodeRemoved(update: NodeUpdate): Promise<void> {
    const { node } = update.data;

    // Fade out animation for removed nodes
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration,
      easing: 'ease-in',
      type: 'fade',
      intensity: 1
    };

    this.animationQueue.set(node.id, animation);
    this.emit('node:removed', { node, animation });

    // Clean up animations after removal
    setTimeout(() => {
      this.animationQueue.delete(node.id);
    }, animation.duration + 100);
  }

  /**
   * Handle edge addition
   */
  private async handleEdgeAdded(update: EdgeUpdate): Promise<void> {
    const { edge } = update.data;

    // Animated edge draw-in
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration,
      easing: 'ease-out',
      type: 'slide',
      intensity: 1
    };

    this.emit('edge:added', { edge, animation });
  }

  /**
   * Handle edge update
   */
  private async handleEdgeUpdated(update: EdgeUpdate): Promise<void> {
    const { edge, previousEdge } = update.data;

    // Glow animation for edge updates
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration / 2,
      easing: 'ease-in-out',
      type: 'glow',
      intensity: 0.5
    };

    this.emit('edge:updated', { edge, previousEdge, animation });
  }

  /**
   * Handle edge removal
   */
  private async handleEdgeRemoved(update: EdgeUpdate): Promise<void> {
    const { edge } = update.data;

    // Fade out animation
    const animation: AnimationConfig = update.metadata?.animation || {
      duration: this.options.animationDuration,
      easing: 'ease-in',
      type: 'fade',
      intensity: 1
    };

    this.emit('edge:removed', { edge, animation });
  }

  /**
   * Handle graph reset
   */
  private async handleGraphReset(update: GraphUpdate): Promise<void> {
    // Clear all queues and animations
    this.updateQueue = [];
    this.animationQueue.clear();

    this.emit('graph:reset', update.data);
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.options.batchDelay);
  }

  /**
   * Process queued updates in batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = [...this.updateQueue];
    this.updateQueue = [];

    try {
      // Group updates by type for efficient processing
      const groupedUpdates = this.groupUpdatesByType(batch);

      // Emit batch start event
      this.emit('batch:start', { updates: batch, groups: groupedUpdates });

      // Process each group
      for (const [type, updates] of Object.entries(groupedUpdates)) {
        await this.processBatchGroup(type as UpdateType, updates);
      }

      // Emit batch completion
      this.emit('batch:complete', { processedCount: batch.length });

    } catch (error) {
      this.emit('batch:error', { batch, error });
      console.error('Failed to process batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a group of updates of the same type
   */
  private async processBatchGroup(type: UpdateType, updates: GraphUpdate[]): Promise<void> {
    switch (type) {
      case 'node-added':
        await this.processBatchNodeAdditions(updates as NodeUpdate[]);
        break;
      case 'node-updated':
        await this.processBatchNodeUpdates(updates as NodeUpdate[]);
        break;
      case 'node-removed':
        await this.processBatchNodeRemovals(updates as NodeUpdate[]);
        break;
      default:
        // Process individually for other types
        for (const update of updates) {
          await this.processUpdate(update);
        }
    }
  }

  /**
   * Process multiple node additions efficiently
   */
  private async processBatchNodeAdditions(updates: NodeUpdate[]): Promise<void> {
    const nodes = updates.map(u => u.data.node);
    const positions = updates.map(u => u.data.position).filter(Boolean);

    // Stagger animations for visual appeal
    updates.forEach((update, index) => {
      const animation: AnimationConfig = {
        ...update.metadata?.animation || {
          duration: this.options.animationDuration,
          easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          type: 'scale',
          intensity: 0
        },
        delay: index * 50 // Stagger by 50ms
      };

      this.animationQueue.set(update.data.node.id, animation);
    });

    this.emit('nodes:batch-added', { nodes, positions, animations: this.animationQueue });
    this.emit('layout:update-needed', { reason: 'batch-node-added', nodeIds: nodes.map(n => n.id) });
  }

  /**
   * Process multiple node updates efficiently
   */
  private async processBatchNodeUpdates(updates: NodeUpdate[]): Promise<void> {
    const nodeChanges = updates.map(update => ({
      node: update.data.node,
      previousNode: update.data.previousNode,
      diff: this.options.enableDiffVisualization && update.data.previousNode
        ? this.generateNodeDiff(update.data.previousNode, update.data.node)
        : null
    }));

    this.emit('nodes:batch-updated', { changes: nodeChanges });
  }

  /**
   * Process multiple node removals efficiently
   */
  private async processBatchNodeRemovals(updates: NodeUpdate[]): Promise<void> {
    const nodes = updates.map(u => u.data.node);

    // Stagger removal animations
    updates.forEach((update, index) => {
      const animation: AnimationConfig = {
        duration: this.options.animationDuration,
        easing: 'ease-in',
        type: 'fade',
        intensity: 1,
        delay: index * 30
      };

      this.animationQueue.set(update.data.node.id, animation);
    });

    this.emit('nodes:batch-removed', { nodes, animations: this.animationQueue });

    // Clean up animations
    setTimeout(() => {
      nodes.forEach(node => this.animationQueue.delete(node.id));
    }, this.options.animationDuration + (updates.length * 30) + 100);
  }

  /**
   * Animate an update
   */
  private async animateUpdate(update: GraphUpdate): Promise<void> {
    if (!update.metadata?.animation) return;

    const animation = update.metadata.animation;

    return new Promise(resolve => {
      // Apply delay if specified
      const delay = animation.delay || 0;

      setTimeout(() => {
        this.emit('animation:start', { update, animation });

        setTimeout(() => {
          this.emit('animation:complete', { update, animation });
          resolve();
        }, animation.duration);

      }, delay);
    });
  }

  /**
   * Generate node diff for visualization
   */
  private generateNodeDiff(previousNode: AnyGraphNode, currentNode: AnyGraphNode): any {
    const diff: any = {
      changed: [],
      added: [],
      removed: []
    };

    // Compare basic properties
    const basicProps = ['label', 'description', 'type'];
    basicProps.forEach(prop => {
      if (previousNode[prop as keyof AnyGraphNode] !== currentNode[prop as keyof AnyGraphNode]) {
        diff.changed.push({
          property: prop,
          oldValue: previousNode[prop as keyof AnyGraphNode],
          newValue: currentNode[prop as keyof AnyGraphNode]
        });
      }
    });

    // Compare metadata
    const oldMetadata = previousNode.metadata || {};
    const newMetadata = currentNode.metadata || {};

    Object.keys({ ...oldMetadata, ...newMetadata }).forEach(key => {
      if (oldMetadata[key] !== newMetadata[key]) {
        if (!(key in oldMetadata)) {
          diff.added.push({ property: `metadata.${key}`, value: newMetadata[key] });
        } else if (!(key in newMetadata)) {
          diff.removed.push({ property: `metadata.${key}`, value: oldMetadata[key] });
        } else {
          diff.changed.push({
            property: `metadata.${key}`,
            oldValue: oldMetadata[key],
            newValue: newMetadata[key]
          });
        }
      }
    });

    return diff;
  }

  /**
   * Group updates by type
   */
  private groupUpdatesByType(updates: GraphUpdate[]): Record<UpdateType, GraphUpdate[]> {
    return updates.reduce((groups, update) => {
      if (!groups[update.type]) {
        groups[update.type] = [];
      }
      groups[update.type].push(update);
      return groups;
    }, {} as Record<UpdateType, GraphUpdate[]>);
  }

  /**
   * Add update to history
   */
  private addToHistory(update: GraphUpdate): void {
    this.updateHistory.push(update);

    // Trim history if too large
    if (this.updateHistory.length > this.options.maxHistorySize) {
      this.updateHistory.shift();
    }
  }

  /**
   * Generate unique update ID
   */
  private generateUpdateId(): string {
    return `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get update history
   */
  public getUpdateHistory(limit?: number): GraphUpdate[] {
    if (limit) {
      return this.updateHistory.slice(-limit);
    }
    return [...this.updateHistory];
  }

  /**
   * Get pending animations
   */
  public getPendingAnimations(): Map<string, AnimationConfig> {
    return new Map(this.animationQueue);
  }

  /**
   * Clear all queues and history
   */
  public clear(): void {
    this.updateQueue = [];
    this.updateHistory = [];
    this.animationQueue.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.isProcessing = false;
    this.emit('cleared');
  }

  /**
   * Update options
   */
  public updateOptions(options: Partial<RealtimeOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('options:updated', this.options);
  }

  /**
   * Get current options
   */
  public getOptions(): RealtimeOptions {
    return { ...this.options };
  }

  /**
   * Get queue statistics
   */
  public getStatistics(): {
    queueSize: number;
    historySize: number;
    pendingAnimations: number;
    isProcessing: boolean;
    hasBatchTimer: boolean;
  } {
    return {
      queueSize: this.updateQueue.length,
      historySize: this.updateHistory.length,
      pendingAnimations: this.animationQueue.size,
      isProcessing: this.isProcessing,
      hasBatchTimer: this.batchTimer !== null
    };
  }
}

/**
 * React Hook for using real-time updates
 */
import { useEffect, useRef, useState } from 'react';

export interface UseRealtimeUpdatesOptions extends Partial<RealtimeOptions> {
  onUpdate?: (update: GraphUpdate) => void;
  onBatchComplete?: (updates: GraphUpdate[]) => void;
  onError?: (error: any) => void;
}

export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions = {}) => {
  const [manager] = useState(() => new RealtimeUpdatesManager({
    enableAnimations: true,
    batchUpdates: true,
    batchDelay: 100,
    maxUpdateQueue: 1000,
    animationDuration: 300,
    enableDiffVisualization: true,
    enableUpdateHistory: true,
    maxHistorySize: 500,
    ...options
  }));

  const [statistics, setStatistics] = useState(manager.getStatistics());
  const updateStatsInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Set up event listeners
    if (options.onUpdate) {
      manager.on('update', options.onUpdate);
    }

    if (options.onBatchComplete) {
      manager.on('batch:complete', (data) => options.onBatchComplete?.(data.updates));
    }

    if (options.onError) {
      manager.on('update:error', options.onError);
      manager.on('batch:error', options.onError);
    }

    // Update statistics periodically
    updateStatsInterval.current = setInterval(() => {
      setStatistics(manager.getStatistics());
    }, 1000);

    return () => {
      manager.removeAllListeners();
      if (updateStatsInterval.current) {
        clearInterval(updateStatsInterval.current);
      }
    };
  }, [manager, options]);

  return {
    manager,
    statistics,
    addUpdate: manager.addUpdate.bind(manager),
    clear: manager.clear.bind(manager),
    getHistory: manager.getUpdateHistory.bind(manager),
    updateOptions: manager.updateOptions.bind(manager)
  };
};

/**
 * Default real-time options
 */
export const defaultRealtimeOptions: RealtimeOptions = {
  enableAnimations: true,
  batchUpdates: true,
  batchDelay: 100,
  maxUpdateQueue: 1000,
  animationDuration: 300,
  enableDiffVisualization: true,
  enableUpdateHistory: true,
  maxHistorySize: 500
};