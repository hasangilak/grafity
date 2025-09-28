import { Neo4jAdapter, Neo4jConfig } from './Neo4jAdapter';
import { GraphStore } from '../GraphStore';
import { AnyGraphNode } from '../types/NodeTypes';
import { GraphEdge, EdgeRelationType } from '../types/EdgeTypes';

export interface Neo4jGraphStoreOptions extends Neo4jConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  batchSize?: number;
  autoSync?: boolean;
}

/**
 * Neo4j-backed graph store implementation
 * Extends in-memory GraphStore with Neo4j persistence
 */
export class Neo4jGraphStore extends GraphStore {
  private neo4j: Neo4jAdapter;
  private options: Neo4jGraphStoreOptions;
  private syncQueue: {
    nodes: Map<string, AnyGraphNode>;
    edges: Map<string, GraphEdge>;
    deletedNodes: Set<string>;
    deletedEdges: Set<string>;
  };
  private syncTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(options: Neo4jGraphStoreOptions) {
    super();
    this.options = {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      batchSize: 1000,
      autoSync: true,
      ...options
    };

    this.neo4j = new Neo4jAdapter({
      uri: options.uri,
      username: options.username,
      password: options.password,
      database: options.database
    });

    this.syncQueue = {
      nodes: new Map(),
      edges: new Map(),
      deletedNodes: new Set(),
      deletedEdges: new Set()
    };

    if (this.options.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Initialize connection and load data from Neo4j
   */
  async initialize(): Promise<void> {
    // Test connection
    const connected = await this.neo4j.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Neo4j');
    }

    // Initialize schema
    await this.neo4j.initializeSchema();

    // Load existing data if cache is enabled
    if (this.options.cacheEnabled) {
      await this.loadFromNeo4j();
    }

    this.isInitialized = true;
    console.log('Neo4jGraphStore initialized successfully');
  }

  /**
   * Load all data from Neo4j into memory
   */
  async loadFromNeo4j(): Promise<void> {
    console.log('Loading graph from Neo4j...');

    // Clear current in-memory data
    this.clear();

    // Load nodes
    const nodes = await this.neo4j.getAllNodes();
    for (const node of nodes) {
      super.addNode(node);
    }

    // Load edges
    const edges = await this.neo4j.getAllEdges();
    for (const edge of edges) {
      super.addEdge(edge);
    }

    console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges from Neo4j`);
  }

  /**
   * Override: Add node with queuing for Neo4j sync
   */
  addNode(node: AnyGraphNode): void {
    super.addNode(node);

    if (this.isInitialized) {
      this.syncQueue.nodes.set(node.id, node);
      this.syncQueue.deletedNodes.delete(node.id);
    }
  }

  /**
   * Override: Update node with queuing for Neo4j sync
   */
  updateNode(id: string, updates: Partial<AnyGraphNode>): void {
    super.updateNode(id, updates);

    const node = this.getNode(id);
    if (node && this.isInitialized) {
      this.syncQueue.nodes.set(id, node);
    }
  }

  /**
   * Override: Remove node with queuing for Neo4j sync
   */
  removeNode(id: string): void {
    super.removeNode(id);

    if (this.isInitialized) {
      this.syncQueue.deletedNodes.add(id);
      this.syncQueue.nodes.delete(id);
    }
  }

  /**
   * Override: Add edge with queuing for Neo4j sync
   */
  addEdge(edge: GraphEdge): void {
    super.addEdge(edge);

    if (this.isInitialized) {
      this.syncQueue.edges.set(edge.id, edge);
      this.syncQueue.deletedEdges.delete(edge.id);
    }
  }

  /**
   * Override: Update edge with queuing for Neo4j sync
   */
  updateEdge(id: string, updates: Partial<GraphEdge>): void {
    super.updateEdge(id, updates);

    const edge = this.getEdge(id);
    if (edge && this.isInitialized) {
      this.syncQueue.edges.set(id, edge);
    }
  }

  /**
   * Override: Remove edge with queuing for Neo4j sync
   */
  removeEdge(id: string): void {
    super.removeEdge(id);

    if (this.isInitialized) {
      this.syncQueue.deletedEdges.add(id);
      this.syncQueue.edges.delete(id);
    }
  }

  /**
   * Sync pending changes to Neo4j
   */
  async sync(): Promise<void> {
    if (!this.isInitialized) return;

    const pendingNodes = Array.from(this.syncQueue.nodes.values());
    const pendingEdges = Array.from(this.syncQueue.edges.values());
    const deletedNodes = Array.from(this.syncQueue.deletedNodes);
    const deletedEdges = Array.from(this.syncQueue.deletedEdges);

    // Delete nodes and edges
    for (const nodeId of deletedNodes) {
      await this.neo4j.deleteNode(nodeId);
    }
    for (const edgeId of deletedEdges) {
      await this.neo4j.deleteEdge(edgeId);
    }

    // Upsert nodes in batches
    if (pendingNodes.length > 0) {
      const batches = this.createBatches(pendingNodes, this.options.batchSize!);
      for (const batch of batches) {
        await this.neo4j.upsertNodes(batch);
      }
    }

    // Upsert edges in batches
    if (pendingEdges.length > 0) {
      const batches = this.createBatches(pendingEdges, this.options.batchSize!);
      for (const batch of batches) {
        await this.neo4j.upsertEdges(batch);
      }
    }

    // Clear sync queue
    this.syncQueue.nodes.clear();
    this.syncQueue.edges.clear();
    this.syncQueue.deletedNodes.clear();
    this.syncQueue.deletedEdges.clear();

    console.log(`Synced ${pendingNodes.length} nodes and ${pendingEdges.length} edges to Neo4j`);
  }

  /**
   * Force reload from Neo4j (discards local changes)
   */
  async reload(): Promise<void> {
    // Clear sync queue
    this.syncQueue.nodes.clear();
    this.syncQueue.edges.clear();
    this.syncQueue.deletedNodes.clear();
    this.syncQueue.deletedEdges.clear();

    // Reload from Neo4j
    await this.loadFromNeo4j();
  }

  /**
   * Override: Get node (optionally from Neo4j if not cached)
   */
  async getNodeAsync(id: string): Promise<AnyGraphNode | undefined> {
    // Try memory first
    let node = super.getNode(id);

    // If not in memory and cache is disabled, fetch from Neo4j
    if (!node && !this.options.cacheEnabled && this.isInitialized) {
      node = await this.neo4j.getNode(id);
      if (node) {
        super.addNode(node); // Add to memory cache
      }
    }

    return node;
  }

  /**
   * Override: Get edge (optionally from Neo4j if not cached)
   */
  async getEdgeAsync(id: string): Promise<GraphEdge | undefined> {
    // Try memory first
    let edge = super.getEdge(id);

    // If not in memory and cache is disabled, fetch from Neo4j
    if (!edge && !this.options.cacheEnabled && this.isInitialized) {
      edge = await this.neo4j.getEdge(id);
      if (edge) {
        super.addEdge(edge); // Add to memory cache
      }
    }

    return edge;
  }

  /**
   * Execute a Cypher query directly
   */
  async query(cypher: string, params?: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Neo4jGraphStore not initialized');
    }
    return this.neo4j.query(cypher, params);
  }

  /**
   * Get statistics from Neo4j
   */
  async getNeo4jStatistics(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Neo4jGraphStore not initialized');
    }
    return this.neo4j.getStatistics();
  }

  /**
   * Clear all data (both memory and Neo4j)
   */
  async clearAll(): Promise<void> {
    super.clear();

    if (this.isInitialized) {
      await this.neo4j.clear();
    }

    // Clear sync queue
    this.syncQueue.nodes.clear();
    this.syncQueue.edges.clear();
    this.syncQueue.deletedNodes.clear();
    this.syncQueue.deletedEdges.clear();
  }

  /**
   * Close connection and cleanup
   */
  async close(): Promise<void> {
    // Stop auto sync
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Final sync
    if (this.isInitialized && this.options.autoSync) {
      await this.sync();
    }

    // Close Neo4j connection
    await this.neo4j.close();
    this.isInitialized = false;
  }

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    // Sync every 30 seconds
    this.syncTimer = setInterval(async () => {
      if (this.isInitialized && this.hasPendingChanges()) {
        try {
          await this.sync();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    }, 30000);
  }

  /**
   * Check if there are pending changes
   */
  private hasPendingChanges(): boolean {
    return (
      this.syncQueue.nodes.size > 0 ||
      this.syncQueue.edges.size > 0 ||
      this.syncQueue.deletedNodes.size > 0 ||
      this.syncQueue.deletedEdges.size > 0
    );
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Export to Cypher statements
   */
  async exportToCypher(): Promise<string[]> {
    const statements: string[] = [];

    // Export nodes
    const nodes = this.getAllNodes();
    for (const node of nodes) {
      const labels = this.getNodeLabelsForExport(node);
      const props = JSON.stringify(this.sanitizeForExport(node));
      statements.push(
        `CREATE (n:${labels.join(':')} ${props})`
      );
    }

    // Export edges
    const edges = this.getAllEdges();
    for (const edge of edges) {
      const props = JSON.stringify(this.sanitizeForExport(edge));
      statements.push(
        `MATCH (s:Node {id: '${edge.source}'}), (t:Node {id: '${edge.target}'}) ` +
        `CREATE (s)-[:${edge.type.toUpperCase()} ${props}]->(t)`
      );
    }

    return statements;
  }

  /**
   * Helper: Get node labels for export
   */
  private getNodeLabelsForExport(node: AnyGraphNode): string[] {
    const labels = ['Node'];
    const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1) + 'Node';
    labels.push(typeLabel);
    return labels;
  }

  /**
   * Helper: Sanitize object for export
   */
  private sanitizeForExport(obj: any): any {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && key !== 'metadata') {
        if (typeof value === 'object') {
          sanitized[key] = JSON.stringify(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }
}