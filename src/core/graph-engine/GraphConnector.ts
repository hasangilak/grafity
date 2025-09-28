import { GraphStore } from './GraphStore';
import { AnyGraphNode, CodeNode, BusinessNode, DocumentNode, ConversationNode } from './types/NodeTypes';
import { GraphEdge, EdgeRelationType } from './types/EdgeTypes';

export interface ConnectionRule {
  sourceType: string;
  targetType: string;
  matcher: (source: AnyGraphNode, target: AnyGraphNode) => boolean;
  edgeType: EdgeRelationType;
  bidirectional?: boolean;
  weight?: number;
}

export interface ConnectionResult {
  created: number;
  updated: number;
  conflicts: number;
  errors: string[];
}

/**
 * Service for automatically connecting related nodes across different graph types
 */
export class GraphConnector {
  private rules: ConnectionRule[] = [];
  private connectionCache = new Map<string, Set<string>>();

  constructor(private store: GraphStore) {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default connection rules
   */
  private initializeDefaultRules(): void {
    // Connect code functions to business features
    this.addRule({
      sourceType: 'business',
      targetType: 'code',
      matcher: (business, code) => {
        if (code.type !== 'code') return false;
        const codeNode = code as CodeNode;
        const businessNode = business as BusinessNode;

        // Match if function name contains business feature keywords
        const featureName = businessNode.label.toLowerCase();
        const functionName = codeNode.label.toLowerCase();

        return functionName.includes(featureName) ||
               featureName.split(' ').some(word =>
                 word.length > 3 && functionName.includes(word)
               );
      },
      edgeType: 'implements',
      bidirectional: true,
      weight: 0.7
    });

    // Connect documentation to code
    this.addRule({
      sourceType: 'document',
      targetType: 'code',
      matcher: (doc, code) => {
        if (code.type !== 'code') return false;
        const docNode = doc as DocumentNode;
        const codeNode = code as CodeNode;

        // Check if document references code file
        const docContent = docNode.content?.toLowerCase() || '';
        const codePath = codeNode.metadata?.filePath?.toLowerCase() || '';

        return codePath && docContent.includes(codePath.split('/').pop()!);
      },
      edgeType: 'documents',
      bidirectional: false,
      weight: 0.8
    });

    // Connect conversation to code
    this.addRule({
      sourceType: 'conversation',
      targetType: 'code',
      matcher: (conv, code) => {
        if (code.type !== 'code') return false;
        const convNode = conv as ConversationNode;
        const codeNode = code as CodeNode;

        // Check if conversation mentions code element
        const messages = convNode.messages?.map(m => m.content.toLowerCase()).join(' ') || '';
        const codeName = codeNode.label.toLowerCase();

        return messages.includes(codeName) ||
               (codeNode.metadata?.filePath &&
                messages.includes(codeNode.metadata.filePath.split('/').pop()!.toLowerCase()));
      },
      edgeType: 'references',
      bidirectional: false,
      weight: 0.6
    });

    // Connect business nodes to documentation
    this.addRule({
      sourceType: 'business',
      targetType: 'document',
      matcher: (business, doc) => {
        const businessNode = business as BusinessNode;
        const docNode = doc as DocumentNode;

        // Check if document contains business terms
        const businessTerms = businessNode.label.toLowerCase().split(' ');
        const docContent = (docNode.content?.toLowerCase() || '') +
                          (docNode.label.toLowerCase() || '');

        const matches = businessTerms.filter(term =>
          term.length > 3 && docContent.includes(term)
        );

        return matches.length >= Math.ceil(businessTerms.length / 2);
      },
      edgeType: 'documents',
      bidirectional: true,
      weight: 0.7
    });

    // Connect related code nodes (not already connected)
    this.addRule({
      sourceType: 'code',
      targetType: 'code',
      matcher: (source, target) => {
        if (source.id === target.id) return false;

        const sourceCode = source as CodeNode;
        const targetCode = target as CodeNode;

        // Skip if already connected
        const edges = this.store.getAllEdges();
        const existingEdge = edges.find(e => e.source === source.id && e.target === target.id);
        if (existingEdge) return false;

        // Connect if they share significant naming patterns
        const sourceWords = this.extractWords(sourceCode.label);
        const targetWords = this.extractWords(targetCode.label);

        const commonWords = sourceWords.filter(w => targetWords.includes(w));
        const threshold = Math.min(sourceWords.length, targetWords.length) / 2;

        return commonWords.length >= threshold && commonWords.length > 1;
      },
      edgeType: 'relates_to',
      bidirectional: true,
      weight: 0.5
    });
  }

  /**
   * Add a custom connection rule
   */
  addRule(rule: ConnectionRule): void {
    this.rules.push(rule);
  }

  /**
   * Clear all connection rules
   */
  clearRules(): void {
    this.rules = [];
  }

  /**
   * Connect all nodes based on rules
   */
  connectAll(): ConnectionResult {
    const result: ConnectionResult = {
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: []
    };

    const nodes = this.store.getAllNodes();

    // Process each rule
    for (const rule of this.rules) {
      const sourceNodes = nodes.filter(n => n.type === rule.sourceType);
      const targetNodes = nodes.filter(n => n.type === rule.targetType);

      for (const source of sourceNodes) {
        for (const target of targetNodes) {
          if (source.id === target.id) continue;

          try {
            if (rule.matcher(source, target)) {
              const connected = this.createConnection(
                source.id,
                target.id,
                rule.edgeType,
                rule.bidirectional,
                rule.weight
              );

              if (connected === 'created') {
                result.created++;
              } else if (connected === 'updated') {
                result.updated++;
              } else if (connected === 'conflict') {
                result.conflicts++;
              }
            }
          } catch (error: any) {
            result.errors.push(
              `Error connecting ${source.id} to ${target.id}: ${error.message}`
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Connect specific node types
   */
  connectNodeTypes(
    sourceType: string,
    targetType: string
  ): ConnectionResult {
    const result: ConnectionResult = {
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: []
    };

    const relevantRules = this.rules.filter(r =>
      r.sourceType === sourceType && r.targetType === targetType
    );

    if (relevantRules.length === 0) {
      result.errors.push(
        `No rules found for connecting ${sourceType} to ${targetType}`
      );
      return result;
    }

    const sourceNodes = this.store.getNodesByType(sourceType);
    const targetNodes = this.store.getNodesByType(targetType);

    for (const rule of relevantRules) {
      for (const source of sourceNodes) {
        for (const target of targetNodes) {
          if (source.id === target.id) continue;

          try {
            if (rule.matcher(source, target)) {
              const connected = this.createConnection(
                source.id,
                target.id,
                rule.edgeType,
                rule.bidirectional,
                rule.weight
              );

              if (connected === 'created') {
                result.created++;
              } else if (connected === 'updated') {
                result.updated++;
              } else if (connected === 'conflict') {
                result.conflicts++;
              }
            }
          } catch (error: any) {
            result.errors.push(
              `Error connecting ${source.id} to ${target.id}: ${error.message}`
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Find related nodes for a specific node
   */
  findRelatedNodes(
    nodeId: string,
    maxDistance: number = 2
  ): AnyGraphNode[] {
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [
      { id: nodeId, distance: 0 }
    ];
    const related: AnyGraphNode[] = [];

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      if (distance > 0) {
        const node = this.store.getNode(id);
        if (node) {
          related.push(node);
        }
      }

      if (distance < maxDistance) {
        const edges = [
          ...this.store.getOutgoingEdges(id),
          ...this.store.getIncomingEdges(id)
        ];

        for (const edge of edges) {
          const nextId = edge.source === id ? edge.target : edge.source;
          if (!visited.has(nextId)) {
            queue.push({ id: nextId, distance: distance + 1 });
          }
        }
      }
    }

    return related;
  }

  /**
   * Calculate connection strength between two nodes
   */
  calculateConnectionStrength(
    sourceId: string,
    targetId: string
  ): number {
    const source = this.store.getNode(sourceId);
    const target = this.store.getNode(targetId);

    if (!source || !target) return 0;

    let strength = 0;

    // Direct connection
    const edges = this.store.getAllEdges();
    const directEdge = edges.find(e => e.source === sourceId && e.target === targetId);
    if (directEdge) {
      strength += directEdge.weight || 1;
    }

    // Reverse connection
    const reverseEdge = edges.find(e => e.source === targetId && e.target === sourceId);
    if (reverseEdge) {
      strength += (reverseEdge.weight || 1) * 0.5;
    }

    // Common neighbors
    const sourceNeighbors = new Set(
      this.store.getOutgoingEdges(sourceId).map(e => e.target)
    );
    const targetNeighbors = new Set(
      this.store.getOutgoingEdges(targetId).map(e => e.target)
    );

    const commonNeighbors = Array.from(sourceNeighbors).filter(n =>
      targetNeighbors.has(n)
    );

    strength += commonNeighbors.length * 0.1;

    // Type similarity
    if (source.type === target.type) {
      strength += 0.2;
    }

    // Name similarity
    const sourceWords = this.extractWords(source.label);
    const targetWords = this.extractWords(target.label);
    const commonWords = sourceWords.filter(w => targetWords.includes(w));

    if (commonWords.length > 0) {
      strength += commonWords.length * 0.15;
    }

    return Math.min(strength, 1); // Cap at 1
  }

  /**
   * Handle edge conflicts when creating connections
   */
  private handleEdgeConflict(
    existingEdge: GraphEdge,
    newType: EdgeRelationType,
    newWeight?: number
  ): 'keep' | 'replace' | 'merge' {
    // If same type, merge weights
    if (existingEdge.type === newType) {
      return 'merge';
    }

    // Prefer higher weight edges
    const existingWeight = existingEdge.weight || 0;
    const proposedWeight = newWeight || 0;

    if (proposedWeight > existingWeight) {
      return 'replace';
    }

    return 'keep';
  }

  /**
   * Create or update a connection between nodes
   */
  private createConnection(
    sourceId: string,
    targetId: string,
    type: EdgeRelationType,
    bidirectional?: boolean,
    weight?: number
  ): 'created' | 'updated' | 'conflict' | 'skipped' {
    const cacheKey = `${sourceId}-${targetId}`;

    // Check cache
    if (this.connectionCache.has(cacheKey)) {
      return 'skipped';
    }

    // Check if edge exists
    const edges = this.store.getAllEdges();
    const existingEdge = edges.find(e => e.source === sourceId && e.target === targetId);

    if (existingEdge) {
      const decision = this.handleEdgeConflict(existingEdge, type, weight);

      if (decision === 'keep') {
        return 'conflict';
      } else if (decision === 'replace') {
        this.store.removeEdge(existingEdge.id);
        this.store.addEdge({
          id: `${sourceId}-${targetId}-${type}`,
          source: sourceId,
          target: targetId,
          type,
          bidirectional: bidirectional || false,
          weight,
          metadata: {
            createdBy: 'GraphConnector',
            createdAt: new Date()
          }
        });
        return 'updated';
      } else if (decision === 'merge') {
        // Update weight
        existingEdge.weight = Math.min(1, (existingEdge.weight || 0) + (weight || 0));
        return 'updated';
      }
    }

    // Create new edge
    this.store.addEdge({
      id: `${sourceId}-${targetId}-${type}`,
      source: sourceId,
      target: targetId,
      type,
      bidirectional: bidirectional || false,
      weight,
      metadata: {
        createdBy: 'GraphConnector',
        createdAt: new Date()
      }
    });

    // Cache the connection
    if (!this.connectionCache.has(sourceId)) {
      this.connectionCache.set(sourceId, new Set());
    }
    this.connectionCache.get(sourceId)!.add(targetId);

    return 'created';
  }

  /**
   * Extract meaningful words from a label
   */
  private extractWords(label: string): string[] {
    // Split on camelCase, snake_case, kebab-case, spaces
    const words = label
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter short words

    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Clear connection cache
   */
  clearCache(): void {
    this.connectionCache.clear();
  }

  /**
   * Get connection statistics
   */
  getStatistics(): {
    totalRules: number;
    cachedConnections: number;
    nodeTypeCoverage: Record<string, number>;
    edgeTypeCoverage: Record<string, number>;
  } {
    const nodeTypeCoverage: Record<string, number> = {};
    const edgeTypeCoverage: Record<string, number> = {};

    // Count nodes by type that have connections
    const nodes = this.store.getAllNodes();
    for (const node of nodes) {
      const hasConnections =
        this.store.getOutgoingEdges(node.id).length > 0 ||
        this.store.getIncomingEdges(node.id).length > 0;

      if (hasConnections) {
        nodeTypeCoverage[node.type] = (nodeTypeCoverage[node.type] || 0) + 1;
      }
    }

    // Count edge types
    const edges = this.store.getAllEdges();
    for (const edge of edges) {
      edgeTypeCoverage[edge.type] = (edgeTypeCoverage[edge.type] || 0) + 1;
    }

    return {
      totalRules: this.rules.length,
      cachedConnections: Array.from(this.connectionCache.values())
        .reduce((sum, set) => sum + set.size, 0),
      nodeTypeCoverage,
      edgeTypeCoverage
    };
  }
}