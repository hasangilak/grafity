import { GraphStore } from '../GraphStore';
import { AnyGraphNode, createCodeNode, createBusinessNode, createDocumentNode, createConversationNode } from '../types/NodeTypes';
import { GraphEdge, createEdge, createBidirectionalEdge, EdgeRelationType } from '../types/EdgeTypes';

/**
 * Abstract base class for building graphs
 */
export abstract class GraphBuilder {
  protected store: GraphStore;
  protected nodeIdCounter: number = 0;
  protected edgeIdCounter: number = 0;

  constructor(store?: GraphStore) {
    this.store = store || new GraphStore();
  }

  /**
   * Abstract method to build the graph
   */
  abstract build(data: any): Promise<GraphStore>;

  /**
   * Generate unique node ID
   */
  protected generateNodeId(prefix: string = 'node'): string {
    return `${prefix}_${++this.nodeIdCounter}`;
  }

  /**
   * Generate unique edge ID
   */
  protected generateEdgeId(source: string, target: string, type: string): string {
    return `${source}-${type}-${target}-${++this.edgeIdCounter}`;
  }

  /**
   * Add node to store with validation
   */
  protected addNode(node: AnyGraphNode): void {
    if (!node.id) {
      node.id = this.generateNodeId(node.type);
    }
    this.store.addNode(node);
  }

  /**
   * Add edge to store with validation
   */
  protected addEdge(edge: GraphEdge): void {
    if (!edge.id) {
      edge.id = this.generateEdgeId(edge.source, edge.target, edge.type);
    }

    // Validate nodes exist
    if (!this.store.getNode(edge.source)) {
      throw new Error(`Source node ${edge.source} does not exist`);
    }
    if (!this.store.getNode(edge.target)) {
      throw new Error(`Target node ${edge.target} does not exist`);
    }

    this.store.addEdge(edge);
  }

  /**
   * Add bi-directional edge
   */
  protected addBidirectionalEdge(
    source: string,
    target: string,
    type: EdgeRelationType,
    params?: Partial<GraphEdge>
  ): void {
    const [forwardEdge, reverseEdge] = createBidirectionalEdge(source, target, type, params);
    this.addEdge(forwardEdge);
    this.addEdge(reverseEdge);
  }

  /**
   * Find or create node by label
   */
  protected findOrCreateNode(label: string, type: AnyGraphNode['type'], additionalProps?: any): string {
    const existingNodes = this.store.findNodesByLabel(label);
    const existingNode = existingNodes.find(n => n.type === type);

    if (existingNode) {
      return existingNode.id;
    }

    // Create new node based on type
    let newNode: AnyGraphNode;
    const nodeId = this.generateNodeId(type);

    switch (type) {
      case 'code':
        newNode = createCodeNode({
          id: nodeId,
          label,
          codeType: 'file',
          filePath: '',
          language: 'typescript',
          metadata: {},
          ...additionalProps
        });
        break;
      case 'business':
        newNode = createBusinessNode({
          id: nodeId,
          label,
          businessType: 'feature',
          metadata: {},
          ...additionalProps
        });
        break;
      case 'document':
        newNode = createDocumentNode({
          id: nodeId,
          label,
          documentType: 'markdown',
          metadata: {},
          ...additionalProps
        });
        break;
      case 'conversation':
        newNode = createConversationNode({
          id: nodeId,
          label,
          conversationType: 'message',
          timestamp: new Date(),
          content: '',
          metadata: {},
          ...additionalProps
        });
        break;
      default:
        newNode = {
          id: nodeId,
          type: 'unknown',
          label,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date()
          },
          ...additionalProps
        };
    }

    this.addNode(newNode);
    return nodeId;
  }

  /**
   * Connect nodes if not already connected
   */
  protected connectNodes(
    sourceId: string,
    targetId: string,
    type: EdgeRelationType,
    bidirectional: boolean = false
  ): void {
    // Check if edge already exists
    const existingEdges = this.store.findEdgesBetween(sourceId, targetId);
    if (existingEdges.some(e => e.type === type)) {
      return; // Already connected
    }

    if (bidirectional) {
      this.addBidirectionalEdge(sourceId, targetId, type);
    } else {
      const edge = createEdge({
        id: this.generateEdgeId(sourceId, targetId, type),
        source: sourceId,
        target: targetId,
        type,
        bidirectional: false
      });
      this.addEdge(edge);
    }
  }

  /**
   * Get the built graph store
   */
  getStore(): GraphStore {
    return this.store;
  }

  /**
   * Validate the built graph
   */
  validate(): { valid: boolean; errors: string[] } {
    return this.store.validate();
  }

  /**
   * Get graph statistics
   */
  getStatistics() {
    return this.store.getStatistics();
  }
}