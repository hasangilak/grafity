import { AnyGraphNode, CodeNode, BusinessNode, DocumentNode, ConversationNode } from './types/NodeTypes';
import { GraphEdge, EdgeRelationType } from './types/EdgeTypes';

/**
 * In-memory graph storage with indexing and search capabilities
 */
export class GraphStore {
  private nodes: Map<string, AnyGraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  // Indexes for fast lookups
  private nodesByType: Map<string, Set<string>> = new Map();
  private edgesBySource: Map<string, Set<string>> = new Map();
  private edgesByTarget: Map<string, Set<string>> = new Map();
  private edgesByType: Map<EdgeRelationType, Set<string>> = new Map();

  constructor() {
    // Initialize type indexes
    this.nodesByType.set('code', new Set());
    this.nodesByType.set('business', new Set());
    this.nodesByType.set('document', new Set());
    this.nodesByType.set('conversation', new Set());
    this.nodesByType.set('unknown', new Set());
  }

  /**
   * Node CRUD operations
   */
  addNode(node: AnyGraphNode): void {
    this.nodes.set(node.id, node);

    // Update type index
    const typeSet = this.nodesByType.get(node.type) || new Set();
    typeSet.add(node.id);
    this.nodesByType.set(node.type, typeSet);
  }

  getNode(id: string): AnyGraphNode | undefined {
    return this.nodes.get(id);
  }

  updateNode(id: string, updates: Partial<AnyGraphNode>): void {
    const node = this.nodes.get(id);
    if (node) {
      const updatedNode = {
        ...node,
        ...updates,
        metadata: {
          ...node.metadata,
          ...updates.metadata,
          updatedAt: new Date()
        }
      };
      this.nodes.set(id, updatedNode);
    }
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (node) {
      // Remove from type index
      const typeSet = this.nodesByType.get(node.type);
      typeSet?.delete(id);

      // Remove all edges connected to this node
      const sourceEdges = this.edgesBySource.get(id) || new Set();
      const targetEdges = this.edgesByTarget.get(id) || new Set();
      [...sourceEdges, ...targetEdges].forEach(edgeId => {
        this.removeEdge(edgeId);
      });

      this.nodes.delete(id);
    }
  }

  /**
   * Edge CRUD operations
   */
  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);

    // Update source index
    const sourceSet = this.edgesBySource.get(edge.source) || new Set();
    sourceSet.add(edge.id);
    this.edgesBySource.set(edge.source, sourceSet);

    // Update target index
    const targetSet = this.edgesByTarget.get(edge.target) || new Set();
    targetSet.add(edge.id);
    this.edgesByTarget.set(edge.target, targetSet);

    // Update type index
    const typeSet = this.edgesByType.get(edge.type) || new Set();
    typeSet.add(edge.id);
    this.edgesByType.set(edge.type, typeSet);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  updateEdge(id: string, updates: Partial<GraphEdge>): void {
    const edge = this.edges.get(id);
    if (edge) {
      const updatedEdge = {
        ...edge,
        ...updates,
        metadata: {
          ...edge.metadata,
          ...updates.metadata,
          updatedAt: new Date()
        }
      };
      this.edges.set(id, updatedEdge);
    }
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (edge) {
      // Remove from indexes
      this.edgesBySource.get(edge.source)?.delete(id);
      this.edgesByTarget.get(edge.target)?.delete(id);
      this.edgesByType.get(edge.type)?.delete(id);

      this.edges.delete(id);
    }
  }

  /**
   * Query operations
   */
  getAllNodes(): AnyGraphNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  getNodesByType(type: string): AnyGraphNode[] {
    const nodeIds = this.nodesByType.get(type) || new Set();
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is AnyGraphNode => node !== undefined);
  }

  getEdgesByType(type: EdgeRelationType): GraphEdge[] {
    const edgeIds = this.edgesByType.get(type) || new Set();
    return Array.from(edgeIds)
      .map(id => this.edges.get(id))
      .filter((edge): edge is GraphEdge => edge !== undefined);
  }

  getOutgoingEdges(nodeId: string): GraphEdge[] {
    const edgeIds = this.edgesBySource.get(nodeId) || new Set();
    return Array.from(edgeIds)
      .map(id => this.edges.get(id))
      .filter((edge): edge is GraphEdge => edge !== undefined);
  }

  getIncomingEdges(nodeId: string): GraphEdge[] {
    const edgeIds = this.edgesByTarget.get(nodeId) || new Set();
    return Array.from(edgeIds)
      .map(id => this.edges.get(id))
      .filter((edge): edge is GraphEdge => edge !== undefined);
  }

  getConnectedNodes(nodeId: string): AnyGraphNode[] {
    const outgoing = this.getOutgoingEdges(nodeId).map(e => e.target);
    const incoming = this.getIncomingEdges(nodeId).map(e => e.source);
    const connectedIds = new Set([...outgoing, ...incoming]);

    return Array.from(connectedIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is AnyGraphNode => node !== undefined);
  }

  /**
   * Search capabilities
   */
  searchNodes(query: string): AnyGraphNode[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllNodes().filter(node =>
      node.label.toLowerCase().includes(lowerQuery) ||
      node.description?.toLowerCase().includes(lowerQuery) ||
      node.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  findNodesByLabel(label: string): AnyGraphNode[] {
    return this.getAllNodes().filter(node => node.label === label);
  }

  findEdgesBetween(sourceId: string, targetId: string): GraphEdge[] {
    return this.getAllEdges().filter(edge =>
      edge.source === sourceId && edge.target === targetId
    );
  }

  /**
   * Graph statistics
   */
  getStatistics() {
    const nodesByType: Record<string, number> = {};
    for (const [type, nodes] of this.nodesByType) {
      nodesByType[type] = nodes.size;
    }

    const edgesByType: Record<string, number> = {};
    for (const [type, edges] of this.edgesByType) {
      edgesByType[type] = edges.size;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByType,
      edgesByType,
      bidirectionalEdges: this.getAllEdges().filter(e => e.bidirectional).length,
      averageOutDegree: this.nodes.size > 0
        ? this.edges.size / this.nodes.size
        : 0
    };
  }

  /**
   * Export/Import for persistence
   */
  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }

  fromJSON(data: { nodes: AnyGraphNode[], edges: GraphEdge[] }): void {
    // Clear existing data
    this.clear();

    // Load nodes
    data.nodes.forEach(node => this.addNode(node));

    // Load edges
    data.edges.forEach(edge => this.addEdge(edge));
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByType.forEach(set => set.clear());
    this.edgesBySource.clear();
    this.edgesByTarget.clear();
    this.edgesByType.clear();
  }

  /**
   * Graph validation
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for orphan edges
    for (const edge of this.edges.values()) {
      if (!this.nodes.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
      }
      if (!this.nodes.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
      }
    }

    // Check for duplicate edges
    const edgeKeys = new Set<string>();
    for (const edge of this.edges.values()) {
      const key = `${edge.source}-${edge.target}-${edge.type}`;
      if (edgeKeys.has(key) && !edge.bidirectional) {
        errors.push(`Duplicate edge found: ${key}`);
      }
      edgeKeys.add(key);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}