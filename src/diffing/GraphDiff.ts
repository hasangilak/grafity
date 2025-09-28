import { Node, Edge } from '../core/graph-engine/types/NodeTypes';

export interface GraphVersion {
  id: string;
  timestamp: Date;
  author: string;
  message: string;
  graph: {
    nodes: Node[];
    edges: Edge[];
  };
  metadata: {
    version: string;
    tags: string[];
    branch?: string;
    parentVersions: string[];
  };
}

export interface GraphDiff {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  timestamp: Date;
  changes: Change[];
  statistics: DiffStatistics;
  conflicts: Conflict[];
}

export interface Change {
  id: string;
  type: 'node_added' | 'node_removed' | 'node_modified' | 'edge_added' | 'edge_removed' | 'edge_modified';
  entity: 'node' | 'edge';
  entityId: string;
  before?: Node | Edge;
  after?: Node | Edge;
  path?: string[]; // Path to the changed property
  oldValue?: any;
  newValue?: any;
  semantic: SemanticChange;
}

export interface SemanticChange {
  category: 'structural' | 'data' | 'metadata' | 'behavioral';
  impact: 'breaking' | 'compatible' | 'enhancement' | 'cosmetic';
  description: string;
  affectedRelations: string[];
  migrations?: Migration[];
}

export interface Migration {
  type: 'automatic' | 'manual' | 'data_transform';
  description: string;
  code?: string;
  instructions?: string;
}

export interface DiffStatistics {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesModified: number;
  totalChanges: number;
  similarity: number; // 0-1 scale
  complexity: number; // 0-1 scale
}

export interface Conflict {
  id: string;
  type: 'node_conflict' | 'edge_conflict' | 'structural_conflict';
  description: string;
  entities: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategies: ConflictResolution[];
}

export interface ConflictResolution {
  strategy: 'keep_source' | 'keep_target' | 'merge' | 'manual' | 'auto_resolve';
  description: string;
  confidence: number;
  result?: Node | Edge;
}

export interface DiffOptions {
  ignoreMetadata?: boolean;
  ignoreTimestamps?: boolean;
  semanticDiff?: boolean;
  includeConflictResolution?: boolean;
  customComparators?: Record<string, (a: any, b: any) => boolean>;
  contextWindow?: number; // Number of surrounding nodes to consider for context
}

export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string; // For move/copy operations
}

export interface GraphPatch {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  operations: PatchOperation[];
  checksum: string;
  metadata: {
    createdAt: Date;
    createdBy: string;
    description: string;
  };
}

export interface DiffVisualization {
  type: 'unified' | 'side_by_side' | 'graph_overlay';
  format: 'html' | 'svg' | 'json' | 'text';
  content: string;
  highlights: DiffHighlight[];
}

export interface DiffHighlight {
  entityId: string;
  entityType: 'node' | 'edge';
  changeType: Change['type'];
  color: string;
  description: string;
}

export class GraphDiffingEngine {
  private versionHistory: Map<string, GraphVersion> = new Map();
  private diffs: Map<string, GraphDiff> = new Map();

  /**
   * Compare two graph versions
   */
  async compareGraphs(
    sourceGraph: { nodes: Node[]; edges: Edge[] },
    targetGraph: { nodes: Node[]; edges: Edge[] },
    options: DiffOptions = {}
  ): Promise<GraphDiff> {
    const diffId = this.generateDiffId();
    const timestamp = new Date();

    // Create maps for efficient lookup
    const sourceNodes = new Map(sourceGraph.nodes.map(n => [n.id, n]));
    const targetNodes = new Map(targetGraph.nodes.map(n => [n.id, n]));
    const sourceEdges = new Map(sourceGraph.edges.map(e => [e.id, e]));
    const targetEdges = new Map(targetGraph.edges.map(e => [e.id, e]));

    const changes: Change[] = [];

    // Compare nodes
    await this.compareNodes(sourceNodes, targetNodes, changes, options);

    // Compare edges
    await this.compareEdges(sourceEdges, targetEdges, changes, options);

    // Add semantic analysis if requested
    if (options.semanticDiff) {
      await this.addSemanticAnalysis(changes, sourceGraph, targetGraph);
    }

    // Calculate statistics
    const statistics = this.calculateDiffStatistics(changes, sourceGraph, targetGraph);

    // Detect conflicts
    const conflicts = options.includeConflictResolution
      ? await this.detectConflicts(changes, sourceGraph, targetGraph)
      : [];

    const diff: GraphDiff = {
      id: diffId,
      sourceVersion: 'source',
      targetVersion: 'target',
      timestamp,
      changes,
      statistics,
      conflicts
    };

    this.diffs.set(diffId, diff);
    return diff;
  }

  /**
   * Compare two specific versions from history
   */
  async compareVersions(
    sourceVersionId: string,
    targetVersionId: string,
    options: DiffOptions = {}
  ): Promise<GraphDiff> {
    const sourceVersion = this.versionHistory.get(sourceVersionId);
    const targetVersion = this.versionHistory.get(targetVersionId);

    if (!sourceVersion || !targetVersion) {
      throw new Error('Version not found');
    }

    const diff = await this.compareGraphs(
      sourceVersion.graph,
      targetVersion.graph,
      options
    );

    diff.sourceVersion = sourceVersionId;
    diff.targetVersion = targetVersionId;

    return diff;
  }

  /**
   * Create a patch from a diff
   */
  createPatch(diff: GraphDiff): GraphPatch {
    const operations: PatchOperation[] = [];

    for (const change of diff.changes) {
      switch (change.type) {
        case 'node_added':
          operations.push({
            op: 'add',
            path: `/nodes/${change.entityId}`,
            value: change.after
          });
          break;

        case 'node_removed':
          operations.push({
            op: 'remove',
            path: `/nodes/${change.entityId}`
          });
          break;

        case 'node_modified':
          if (change.path && change.newValue !== undefined) {
            operations.push({
              op: 'replace',
              path: `/nodes/${change.entityId}/${change.path.join('/')}`,
              value: change.newValue
            });
          }
          break;

        case 'edge_added':
          operations.push({
            op: 'add',
            path: `/edges/${change.entityId}`,
            value: change.after
          });
          break;

        case 'edge_removed':
          operations.push({
            op: 'remove',
            path: `/edges/${change.entityId}`
          });
          break;

        case 'edge_modified':
          if (change.path && change.newValue !== undefined) {
            operations.push({
              op: 'replace',
              path: `/edges/${change.entityId}/${change.path.join('/')}`,
              value: change.newValue
            });
          }
          break;
      }
    }

    const patch: GraphPatch = {
      id: this.generatePatchId(),
      sourceVersion: diff.sourceVersion,
      targetVersion: diff.targetVersion,
      operations,
      checksum: this.calculateChecksum(operations),
      metadata: {
        createdAt: new Date(),
        createdBy: 'system',
        description: `Patch from ${diff.sourceVersion} to ${diff.targetVersion}`
      }
    };

    return patch;
  }

  /**
   * Apply a patch to a graph
   */
  async applyPatch(
    graph: { nodes: Node[]; edges: Edge[] },
    patch: GraphPatch
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const result = {
      nodes: [...graph.nodes],
      edges: [...graph.edges]
    };

    const nodeMap = new Map(result.nodes.map(n => [n.id, n]));
    const edgeMap = new Map(result.edges.map(e => [e.id, e]));

    for (const operation of patch.operations) {
      await this.applyPatchOperation(operation, result, nodeMap, edgeMap);
    }

    return result;
  }

  /**
   * Generate visual diff representation
   */
  async generateVisualization(
    diff: GraphDiff,
    type: DiffVisualization['type'] = 'graph_overlay',
    format: DiffVisualization['format'] = 'html'
  ): Promise<DiffVisualization> {
    const highlights: DiffHighlight[] = [];

    // Generate highlights for changes
    for (const change of diff.changes) {
      highlights.push({
        entityId: change.entityId,
        entityType: change.entity,
        changeType: change.type,
        color: this.getChangeColor(change.type),
        description: this.generateChangeDescription(change)
      });
    }

    let content = '';

    switch (format) {
      case 'html':
        content = this.generateHtmlVisualization(diff, highlights, type);
        break;
      case 'svg':
        content = await this.generateSvgVisualization(diff, highlights, type);
        break;
      case 'json':
        content = JSON.stringify({ diff, highlights }, null, 2);
        break;
      case 'text':
        content = this.generateTextVisualization(diff);
        break;
    }

    return {
      type,
      format,
      content,
      highlights
    };
  }

  /**
   * Store a version in history
   */
  storeVersion(version: GraphVersion): void {
    this.versionHistory.set(version.id, version);
  }

  /**
   * Get version history
   */
  getVersionHistory(): GraphVersion[] {
    return Array.from(this.versionHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get diff by ID
   */
  getDiff(diffId: string): GraphDiff | null {
    return this.diffs.get(diffId) || null;
  }

  /**
   * Private methods
   */
  private async compareNodes(
    sourceNodes: Map<string, Node>,
    targetNodes: Map<string, Node>,
    changes: Change[],
    options: DiffOptions
  ): Promise<void> {
    // Find added nodes
    for (const [nodeId, node] of targetNodes) {
      if (!sourceNodes.has(nodeId)) {
        changes.push({
          id: this.generateChangeId(),
          type: 'node_added',
          entity: 'node',
          entityId: nodeId,
          after: node,
          semantic: {
            category: 'structural',
            impact: 'enhancement',
            description: `Added node ${nodeId} of type ${node.type}`,
            affectedRelations: []
          }
        });
      }
    }

    // Find removed nodes
    for (const [nodeId, node] of sourceNodes) {
      if (!targetNodes.has(nodeId)) {
        changes.push({
          id: this.generateChangeId(),
          type: 'node_removed',
          entity: 'node',
          entityId: nodeId,
          before: node,
          semantic: {
            category: 'structural',
            impact: 'breaking',
            description: `Removed node ${nodeId} of type ${node.type}`,
            affectedRelations: []
          }
        });
      }
    }

    // Find modified nodes
    for (const [nodeId, sourceNode] of sourceNodes) {
      const targetNode = targetNodes.get(nodeId);
      if (targetNode) {
        const nodeChanges = this.compareNodeProperties(sourceNode, targetNode, options);
        changes.push(...nodeChanges);
      }
    }
  }

  private async compareEdges(
    sourceEdges: Map<string, Edge>,
    targetEdges: Map<string, Edge>,
    changes: Change[],
    options: DiffOptions
  ): Promise<void> {
    // Find added edges
    for (const [edgeId, edge] of targetEdges) {
      if (!sourceEdges.has(edgeId)) {
        changes.push({
          id: this.generateChangeId(),
          type: 'edge_added',
          entity: 'edge',
          entityId: edgeId,
          after: edge,
          semantic: {
            category: 'structural',
            impact: 'enhancement',
            description: `Added edge ${edgeId} from ${edge.source} to ${edge.target}`,
            affectedRelations: [edge.source, edge.target]
          }
        });
      }
    }

    // Find removed edges
    for (const [edgeId, edge] of sourceEdges) {
      if (!targetEdges.has(edgeId)) {
        changes.push({
          id: this.generateChangeId(),
          type: 'edge_removed',
          entity: 'edge',
          entityId: edgeId,
          before: edge,
          semantic: {
            category: 'structural',
            impact: 'breaking',
            description: `Removed edge ${edgeId} from ${edge.source} to ${edge.target}`,
            affectedRelations: [edge.source, edge.target]
          }
        });
      }
    }

    // Find modified edges
    for (const [edgeId, sourceEdge] of sourceEdges) {
      const targetEdge = targetEdges.get(edgeId);
      if (targetEdge) {
        const edgeChanges = this.compareEdgeProperties(sourceEdge, targetEdge, options);
        changes.push(...edgeChanges);
      }
    }
  }

  private compareNodeProperties(source: Node, target: Node, options: DiffOptions): Change[] {
    const changes: Change[] = [];

    // Compare type
    if (source.type !== target.type) {
      changes.push({
        id: this.generateChangeId(),
        type: 'node_modified',
        entity: 'node',
        entityId: source.id,
        before: source,
        after: target,
        path: ['type'],
        oldValue: source.type,
        newValue: target.type,
        semantic: {
          category: 'behavioral',
          impact: 'breaking',
          description: `Changed node type from ${source.type} to ${target.type}`,
          affectedRelations: []
        }
      });
    }

    // Compare data
    const dataChanges = this.compareObjects(
      source.data || {},
      target.data || {},
      ['data'],
      options
    );

    changes.push(...dataChanges.map(change => ({
      id: this.generateChangeId(),
      type: 'node_modified' as const,
      entity: 'node' as const,
      entityId: source.id,
      before: source,
      after: target,
      path: change.path,
      oldValue: change.oldValue,
      newValue: change.newValue,
      semantic: {
        category: 'data' as const,
        impact: this.determineDataChangeImpact(change),
        description: `Modified node data: ${change.path.join('.')}`,
        affectedRelations: []
      }
    })));

    return changes;
  }

  private compareEdgeProperties(source: Edge, target: Edge, options: DiffOptions): Change[] {
    const changes: Change[] = [];

    // Compare type
    if (source.type !== target.type) {
      changes.push({
        id: this.generateChangeId(),
        type: 'edge_modified',
        entity: 'edge',
        entityId: source.id,
        before: source,
        after: target,
        path: ['type'],
        oldValue: source.type,
        newValue: target.type,
        semantic: {
          category: 'behavioral',
          impact: 'breaking',
          description: `Changed edge type from ${source.type} to ${target.type}`,
          affectedRelations: [source.source, source.target]
        }
      });
    }

    // Compare source/target (structural change)
    if (source.source !== target.source || source.target !== target.target) {
      changes.push({
        id: this.generateChangeId(),
        type: 'edge_modified',
        entity: 'edge',
        entityId: source.id,
        before: source,
        after: target,
        path: ['connection'],
        oldValue: { source: source.source, target: source.target },
        newValue: { source: target.source, target: target.target },
        semantic: {
          category: 'structural',
          impact: 'breaking',
          description: `Changed edge connection from ${source.source}->${source.target} to ${target.source}->${target.target}`,
          affectedRelations: [source.source, source.target, target.source, target.target]
        }
      });
    }

    // Compare data
    const dataChanges = this.compareObjects(
      source.data || {},
      target.data || {},
      ['data'],
      options
    );

    changes.push(...dataChanges.map(change => ({
      id: this.generateChangeId(),
      type: 'edge_modified' as const,
      entity: 'edge' as const,
      entityId: source.id,
      before: source,
      after: target,
      path: change.path,
      oldValue: change.oldValue,
      newValue: change.newValue,
      semantic: {
        category: 'data' as const,
        impact: this.determineDataChangeImpact(change),
        description: `Modified edge data: ${change.path.join('.')}`,
        affectedRelations: [source.source, source.target]
      }
    })));

    return changes;
  }

  private compareObjects(
    source: any,
    target: any,
    path: string[] = [],
    options: DiffOptions
  ): Array<{ path: string[]; oldValue: any; newValue: any }> {
    const changes: Array<{ path: string[]; oldValue: any; newValue: any }> = [];

    if (typeof source !== typeof target) {
      changes.push({ path, oldValue: source, newValue: target });
      return changes;
    }

    if (source === null || target === null || typeof source !== 'object') {
      if (source !== target) {
        changes.push({ path, oldValue: source, newValue: target });
      }
      return changes;
    }

    // Handle arrays
    if (Array.isArray(source) || Array.isArray(target)) {
      if (!Array.isArray(source) || !Array.isArray(target) || source.length !== target.length) {
        changes.push({ path, oldValue: source, newValue: target });
      } else {
        for (let i = 0; i < source.length; i++) {
          changes.push(...this.compareObjects(source[i], target[i], [...path, i.toString()], options));
        }
      }
      return changes;
    }

    // Handle objects
    const sourceKeys = new Set(Object.keys(source));
    const targetKeys = new Set(Object.keys(target));
    const allKeys = new Set([...sourceKeys, ...targetKeys]);

    for (const key of allKeys) {
      if (options.ignoreMetadata && this.isMetadataField(key)) {
        continue;
      }

      if (options.ignoreTimestamps && this.isTimestampField(key)) {
        continue;
      }

      if (!sourceKeys.has(key)) {
        changes.push({ path: [...path, key], oldValue: undefined, newValue: target[key] });
      } else if (!targetKeys.has(key)) {
        changes.push({ path: [...path, key], oldValue: source[key], newValue: undefined });
      } else {
        changes.push(...this.compareObjects(source[key], target[key], [...path, key], options));
      }
    }

    return changes;
  }

  private async addSemanticAnalysis(
    changes: Change[],
    sourceGraph: { nodes: Node[]; edges: Edge[] },
    targetGraph: { nodes: Node[]; edges: Edge[] }
  ): Promise<void> {
    // Enhance changes with semantic analysis
    for (const change of changes) {
      // Analyze impact on graph connectivity
      if (change.entity === 'edge') {
        const connectivityImpact = this.analyzeConnectivityImpact(change, sourceGraph, targetGraph);
        change.semantic.impact = connectivityImpact;
      }

      // Analyze behavioral changes
      if (change.path?.includes('type') || change.path?.includes('behavior')) {
        change.semantic.category = 'behavioral';
        change.semantic.impact = 'breaking';
      }

      // Add migration suggestions
      if (change.semantic.impact === 'breaking') {
        change.semantic.migrations = await this.generateMigrations(change);
      }
    }
  }

  private analyzeConnectivityImpact(
    change: Change,
    sourceGraph: { nodes: Node[]; edges: Edge[] },
    targetGraph: { nodes: Node[]; edges: Edge[] }
  ): SemanticChange['impact'] {
    if (change.type === 'edge_removed') {
      // Check if removal creates disconnected components
      const sourceConnectivity = this.calculateConnectivity(sourceGraph);
      const targetConnectivity = this.calculateConnectivity(targetGraph);

      if (targetConnectivity < sourceConnectivity) {
        return 'breaking';
      }
    }

    return 'compatible';
  }

  private calculateConnectivity(graph: { nodes: Node[]; edges: Edge[] }): number {
    // Simple connectivity measure - could be enhanced
    return graph.edges.length / Math.max(1, graph.nodes.length);
  }

  private async generateMigrations(change: Change): Promise<Migration[]> {
    const migrations: Migration[] = [];

    switch (change.type) {
      case 'node_removed':
        migrations.push({
          type: 'manual',
          description: `Manually handle removal of node ${change.entityId}`,
          instructions: `Review and update all references to node ${change.entityId} before removal`
        });
        break;

      case 'edge_removed':
        migrations.push({
          type: 'automatic',
          description: `Update references to removed edge ${change.entityId}`,
          code: `// Remove edge references\n// Update graph structure`
        });
        break;

      case 'node_modified':
        if (change.path?.includes('type')) {
          migrations.push({
            type: 'data_transform',
            description: `Transform node data for type change`,
            code: `// Transform node data\nnode.data = transformData(node.data, '${change.oldValue}', '${change.newValue}');`
          });
        }
        break;
    }

    return migrations;
  }

  private calculateDiffStatistics(
    changes: Change[],
    sourceGraph: { nodes: Node[]; edges: Edge[] },
    targetGraph: { nodes: Node[]; edges: Edge[] }
  ): DiffStatistics {
    const stats = {
      nodesAdded: 0,
      nodesRemoved: 0,
      nodesModified: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesModified: 0,
      totalChanges: changes.length,
      similarity: 0,
      complexity: 0
    };

    for (const change of changes) {
      switch (change.type) {
        case 'node_added': stats.nodesAdded++; break;
        case 'node_removed': stats.nodesRemoved++; break;
        case 'node_modified': stats.nodesModified++; break;
        case 'edge_added': stats.edgesAdded++; break;
        case 'edge_removed': stats.edgesRemoved++; break;
        case 'edge_modified': stats.edgesModified++; break;
      }
    }

    // Calculate similarity (Jaccard coefficient)
    const sourceSize = sourceGraph.nodes.length + sourceGraph.edges.length;
    const targetSize = targetGraph.nodes.length + targetGraph.edges.length;
    const unionSize = Math.max(sourceSize, targetSize);
    const changedEntities = new Set(changes.map(c => c.entityId)).size;

    stats.similarity = unionSize > 0 ? 1 - (changedEntities / unionSize) : 1;

    // Calculate complexity based on change types
    const structuralChanges = changes.filter(c =>
      c.semantic.category === 'structural' ||
      c.semantic.impact === 'breaking'
    ).length;

    stats.complexity = unionSize > 0 ? structuralChanges / unionSize : 0;

    return stats;
  }

  private async detectConflicts(
    changes: Change[],
    sourceGraph: { nodes: Node[]; edges: Edge[] },
    targetGraph: { nodes: Node[]; edges: Edge[] }
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Detect orphaned edges (edges referring to non-existent nodes)
    const orphanedEdges = this.detectOrphanedEdges(changes);
    if (orphanedEdges.length > 0) {
      conflicts.push({
        id: this.generateConflictId(),
        type: 'structural_conflict',
        description: 'Edges referring to removed nodes',
        entities: orphanedEdges,
        severity: 'high',
        resolutionStrategies: [
          {
            strategy: 'auto_resolve',
            description: 'Automatically remove orphaned edges',
            confidence: 0.9
          },
          {
            strategy: 'manual',
            description: 'Manually review and resolve',
            confidence: 1.0
          }
        ]
      });
    }

    // Detect type conflicts
    const typeConflicts = this.detectTypeConflicts(changes);
    conflicts.push(...typeConflicts);

    return conflicts;
  }

  private detectOrphanedEdges(changes: Change[]): string[] {
    const removedNodes = new Set(
      changes
        .filter(c => c.type === 'node_removed')
        .map(c => c.entityId)
    );

    const orphanedEdges: string[] = [];

    for (const change of changes) {
      if (change.type === 'edge_added' || change.type === 'edge_modified') {
        const edge = change.after as Edge;
        if (removedNodes.has(edge.source) || removedNodes.has(edge.target)) {
          orphanedEdges.push(change.entityId);
        }
      }
    }

    return orphanedEdges;
  }

  private detectTypeConflicts(changes: Change[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const typeChanges = changes.filter(c =>
      c.path?.includes('type') && (c.type === 'node_modified' || c.type === 'edge_modified')
    );

    for (const change of typeChanges) {
      if (this.isIncompatibleTypeChange(change.oldValue, change.newValue)) {
        conflicts.push({
          id: this.generateConflictId(),
          type: change.entity === 'node' ? 'node_conflict' : 'edge_conflict',
          description: `Incompatible type change from ${change.oldValue} to ${change.newValue}`,
          entities: [change.entityId],
          severity: 'high',
          resolutionStrategies: [
            {
              strategy: 'keep_source',
              description: 'Keep original type',
              confidence: 0.5
            },
            {
              strategy: 'keep_target',
              description: 'Accept new type',
              confidence: 0.5
            },
            {
              strategy: 'manual',
              description: 'Manual review required',
              confidence: 1.0
            }
          ]
        });
      }
    }

    return conflicts;
  }

  private async applyPatchOperation(
    operation: PatchOperation,
    graph: { nodes: Node[]; edges: Edge[] },
    nodeMap: Map<string, Node>,
    edgeMap: Map<string, Edge>
  ): Promise<void> {
    const pathParts = operation.path.split('/').filter(p => p);

    switch (operation.op) {
      case 'add':
        if (pathParts[0] === 'nodes') {
          const node = operation.value as Node;
          graph.nodes.push(node);
          nodeMap.set(node.id, node);
        } else if (pathParts[0] === 'edges') {
          const edge = operation.value as Edge;
          graph.edges.push(edge);
          edgeMap.set(edge.id, edge);
        }
        break;

      case 'remove':
        if (pathParts[0] === 'nodes') {
          const nodeId = pathParts[1];
          graph.nodes = graph.nodes.filter(n => n.id !== nodeId);
          nodeMap.delete(nodeId);
        } else if (pathParts[0] === 'edges') {
          const edgeId = pathParts[1];
          graph.edges = graph.edges.filter(e => e.id !== edgeId);
          edgeMap.delete(edgeId);
        }
        break;

      case 'replace':
        if (pathParts[0] === 'nodes') {
          const nodeId = pathParts[1];
          const node = nodeMap.get(nodeId);
          if (node && pathParts.length > 2) {
            this.setNestedProperty(node, pathParts.slice(2), operation.value);
          }
        } else if (pathParts[0] === 'edges') {
          const edgeId = pathParts[1];
          const edge = edgeMap.get(edgeId);
          if (edge && pathParts.length > 2) {
            this.setNestedProperty(edge, pathParts.slice(2), operation.value);
          }
        }
        break;
    }
  }

  private setNestedProperty(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in current)) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  private determineDataChangeImpact(change: { path: string[]; oldValue: any; newValue: any }): SemanticChange['impact'] {
    // Determine impact based on the type of change
    if (change.oldValue === undefined) return 'enhancement';
    if (change.newValue === undefined) return 'breaking';
    if (typeof change.oldValue !== typeof change.newValue) return 'breaking';
    return 'compatible';
  }

  private isMetadataField(key: string): boolean {
    return ['metadata', 'createdAt', 'updatedAt', 'version'].includes(key);
  }

  private isTimestampField(key: string): boolean {
    return ['timestamp', 'createdAt', 'updatedAt', 'lastModified'].includes(key);
  }

  private isIncompatibleTypeChange(oldType: string, newType: string): boolean {
    // Define incompatible type transitions
    const incompatibleTransitions = new Set([
      'component->function',
      'class->interface',
      'sync->async'
    ]);

    return incompatibleTransitions.has(`${oldType}->${newType}`);
  }

  private getChangeColor(changeType: Change['type']): string {
    const colors = {
      'node_added': '#28a745',
      'edge_added': '#28a745',
      'node_removed': '#dc3545',
      'edge_removed': '#dc3545',
      'node_modified': '#ffc107',
      'edge_modified': '#ffc107'
    };

    return colors[changeType] || '#6c757d';
  }

  private generateChangeDescription(change: Change): string {
    switch (change.type) {
      case 'node_added':
        return `Added node: ${change.entityId}`;
      case 'node_removed':
        return `Removed node: ${change.entityId}`;
      case 'node_modified':
        return `Modified node: ${change.entityId} (${change.path?.join('.') || 'properties'})`;
      case 'edge_added':
        return `Added edge: ${change.entityId}`;
      case 'edge_removed':
        return `Removed edge: ${change.entityId}`;
      case 'edge_modified':
        return `Modified edge: ${change.entityId} (${change.path?.join('.') || 'properties'})`;
      default:
        return `Changed: ${change.entityId}`;
    }
  }

  private generateHtmlVisualization(
    diff: GraphDiff,
    highlights: DiffHighlight[],
    type: DiffVisualization['type']
  ): string {
    let html = `
    <div class="graph-diff-visualization">
      <h2>Graph Diff Visualization</h2>
      <div class="diff-stats">
        <div class="stat">
          <span class="label">Total Changes:</span>
          <span class="value">${diff.statistics.totalChanges}</span>
        </div>
        <div class="stat">
          <span class="label">Similarity:</span>
          <span class="value">${(diff.statistics.similarity * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="changes-list">
    `;

    for (const change of diff.changes) {
      const color = this.getChangeColor(change.type);
      html += `
        <div class="change-item" style="border-left-color: ${color}">
          <div class="change-type">${change.type.replace('_', ' ')}</div>
          <div class="change-entity">${change.entityId}</div>
          <div class="change-description">${this.generateChangeDescription(change)}</div>
        </div>
      `;
    }

    html += `
      </div>
    </div>
    <style>
      .graph-diff-visualization {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .diff-stats {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }
      .stat {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 6px;
      }
      .change-item {
        border-left: 4px solid #ddd;
        padding: 10px;
        margin-bottom: 10px;
        background: #f8f9fa;
        border-radius: 0 6px 6px 0;
      }
      .change-type {
        font-weight: 600;
        text-transform: capitalize;
      }
      .change-entity {
        font-family: monospace;
        color: #6f42c1;
      }
    </style>
    `;

    return html;
  }

  private async generateSvgVisualization(
    diff: GraphDiff,
    highlights: DiffHighlight[],
    type: DiffVisualization['type']
  ): Promise<string> {
    // Generate SVG representation
    // This would integrate with the existing D3.js visualization system
    return `<svg width="800" height="600">
      <text x="50" y="50">Graph Diff SVG Visualization</text>
      <text x="50" y="80">Total Changes: ${diff.statistics.totalChanges}</text>
    </svg>`;
  }

  private generateTextVisualization(diff: GraphDiff): string {
    let text = `Graph Diff Report\n`;
    text += `==================\n\n`;
    text += `Statistics:\n`;
    text += `- Total Changes: ${diff.statistics.totalChanges}\n`;
    text += `- Nodes Added: ${diff.statistics.nodesAdded}\n`;
    text += `- Nodes Removed: ${diff.statistics.nodesRemoved}\n`;
    text += `- Nodes Modified: ${diff.statistics.nodesModified}\n`;
    text += `- Edges Added: ${diff.statistics.edgesAdded}\n`;
    text += `- Edges Removed: ${diff.statistics.edgesRemoved}\n`;
    text += `- Edges Modified: ${diff.statistics.edgesModified}\n`;
    text += `- Similarity: ${(diff.statistics.similarity * 100).toFixed(1)}%\n\n`;

    text += `Changes:\n`;
    text += `--------\n`;

    for (const change of diff.changes) {
      text += `${change.type.toUpperCase()}: ${change.entityId}\n`;
      if (change.semantic.description) {
        text += `  Description: ${change.semantic.description}\n`;
      }
      if (change.semantic.impact !== 'cosmetic') {
        text += `  Impact: ${change.semantic.impact}\n`;
      }
      text += `\n`;
    }

    return text;
  }

  private calculateChecksum(operations: PatchOperation[]): string {
    const content = JSON.stringify(operations);
    // Simple checksum - in production, use a proper hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private generateDiffId(): string {
    return `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePatchId(): string {
    return `patch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createGraphDiffingEngine(): GraphDiffingEngine {
  return new GraphDiffingEngine();
}