import { GraphStore } from './GraphStore';
import { AnyGraphNode } from './types/NodeTypes';
import { GraphEdge, EdgeRelationType } from './types/EdgeTypes';

export type NodePredicate = (node: AnyGraphNode) => boolean;
export type EdgePredicate = (edge: GraphEdge) => boolean;

export interface QueryResult<T = any> {
  nodes?: AnyGraphNode[];
  edges?: GraphEdge[];
  paths?: Path[];
  aggregations?: Record<string, T>;
  metadata?: Record<string, any>;
}

export interface Path {
  nodes: AnyGraphNode[];
  edges: GraphEdge[];
  length: number;
  weight: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  includeEdges?: boolean;
  maxDepth?: number;
}

/**
 * Advanced query engine for the graph
 */
export class QueryEngine {
  constructor(private store: GraphStore) {}

  /**
   * Find nodes matching a predicate
   */
  findNodes(predicate: NodePredicate, options: QueryOptions = {}): QueryResult {
    const allNodes = this.store.getAllNodes();
    let nodes = allNodes.filter(predicate);

    // Apply sorting
    if (options.orderBy) {
      nodes = this.sortNodes(nodes, options.orderBy, options.direction);
    }

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      nodes = nodes.slice(start, end);
    }

    const result: QueryResult = { nodes };

    // Include edges if requested
    if (options.includeEdges && nodes.length > 0) {
      const nodeIds = new Set(nodes.map(n => n.id));
      const edges = this.store.getAllEdges().filter(e =>
        nodeIds.has(e.source) || nodeIds.has(e.target)
      );
      result.edges = edges;
    }

    return result;
  }

  /**
   * Find edges matching a predicate
   */
  findEdges(predicate: EdgePredicate, options: QueryOptions = {}): QueryResult {
    const allEdges = this.store.getAllEdges();
    let edges = allEdges.filter(predicate);

    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      edges = edges.slice(start, end);
    }

    return { edges };
  }

  /**
   * Find all paths between two nodes
   */
  findPaths(
    sourceId: string,
    targetId: string,
    options: QueryOptions = {}
  ): QueryResult {
    const maxDepth = options.maxDepth || 10;
    const limit = options.limit || 10;
    const paths: Path[] = [];

    const visited = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (currentId: string, depth: number) => {
      if (depth > maxDepth) return;
      if (paths.length >= limit) return;

      if (currentId === targetId) {
        // Found a path
        const pathNodes = [...currentPath, currentId].map(id =>
          this.store.getNode(id)!
        );
        const pathEdges = this.getPathEdges(currentPath.concat(currentId));

        paths.push({
          nodes: pathNodes,
          edges: pathEdges,
          length: pathNodes.length,
          weight: pathEdges.reduce((sum, e) => sum + (e.weight || 1), 0)
        });
        return;
      }

      if (visited.has(currentId)) return;

      visited.add(currentId);
      currentPath.push(currentId);

      const outgoingEdges = this.store.getOutgoingEdges(currentId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, depth + 1);
      }

      currentPath.pop();
      visited.delete(currentId);
    };

    dfs(sourceId, 0);

    // Sort paths by length
    paths.sort((a, b) => a.length - b.length);

    return { paths };
  }

  /**
   * Find shortest path between two nodes (Dijkstra's algorithm)
   */
  findShortestPath(sourceId: string, targetId: string): QueryResult {
    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const unvisited = new Set<string>();

    // Initialize distances
    for (const node of this.store.getAllNodes()) {
      distances.set(node.id, Infinity);
      unvisited.add(node.id);
    }
    distances.set(sourceId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let currentId: string | null = null;
      let minDistance = Infinity;

      for (const id of unvisited) {
        const distance = distances.get(id)!;
        if (distance < minDistance) {
          minDistance = distance;
          currentId = id;
        }
      }

      if (currentId === null || minDistance === Infinity) break;
      if (currentId === targetId) break;

      unvisited.delete(currentId);

      // Update distances to neighbors
      const edges = this.store.getOutgoingEdges(currentId);
      for (const edge of edges) {
        if (!unvisited.has(edge.target)) continue;

        const weight = edge.weight || 1;
        const altDistance = distances.get(currentId)! + weight;

        if (altDistance < distances.get(edge.target)!) {
          distances.set(edge.target, altDistance);
          previous.set(edge.target, currentId);
        }
      }
    }

    // Reconstruct path
    if (!previous.has(targetId) && sourceId !== targetId) {
      return { paths: [] }; // No path found
    }

    const pathNodeIds: string[] = [];
    let currentId: string | undefined = targetId;

    while (currentId !== undefined) {
      pathNodeIds.unshift(currentId);
      currentId = previous.get(currentId);
      if (currentId === sourceId) {
        pathNodeIds.unshift(sourceId);
        break;
      }
    }

    const pathNodes = pathNodeIds.map(id => this.store.getNode(id)!);
    const pathEdges = this.getPathEdges(pathNodeIds);

    const path: Path = {
      nodes: pathNodes,
      edges: pathEdges,
      length: pathNodes.length,
      weight: distances.get(targetId) || 0
    };

    return { paths: [path] };
  }

  /**
   * Find nodes within a certain distance from a source node
   */
  findNeighborhood(
    sourceId: string,
    maxDistance: number = 2
  ): QueryResult {
    const visited = new Map<string, number>();
    const queue: Array<{ id: string; distance: number }> = [
      { id: sourceId, distance: 0 }
    ];

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.set(id, distance);

      if (distance < maxDistance) {
        const edges = this.store.getOutgoingEdges(id);
        for (const edge of edges) {
          if (!visited.has(edge.target)) {
            queue.push({ id: edge.target, distance: distance + 1 });
          }
        }

        const incomingEdges = this.store.getIncomingEdges(id);
        for (const edge of incomingEdges) {
          if (!visited.has(edge.source)) {
            queue.push({ id: edge.source, distance: distance + 1 });
          }
        }
      }
    }

    const nodes = Array.from(visited.keys())
      .map(id => this.store.getNode(id)!)
      .filter(node => node !== undefined);

    return {
      nodes,
      metadata: {
        distances: Object.fromEntries(visited)
      }
    };
  }

  /**
   * Pattern matching - find subgraphs matching a pattern
   */
  findPattern(pattern: {
    nodes: Array<{ type?: string; predicate?: NodePredicate }>;
    edges: Array<{ type?: EdgeRelationType; from: number; to: number }>;
  }): QueryResult {
    const matches: Array<{ nodes: AnyGraphNode[]; edges: GraphEdge[] }> = [];
    const allNodes = this.store.getAllNodes();

    // Try each node as a potential starting point
    for (const startNode of allNodes) {
      const nodeMatches: AnyGraphNode[] = [startNode];
      const edgeMatches: GraphEdge[] = [];
      let isMatch = true;

      // Check if start node matches first pattern node
      const firstPattern = pattern.nodes[0];
      if (firstPattern.type && startNode.type !== firstPattern.type) continue;
      if (firstPattern.predicate && !firstPattern.predicate(startNode)) continue;

      // Try to match the rest of the pattern
      for (const edgePattern of pattern.edges) {
        const fromNode = nodeMatches[edgePattern.from];
        if (!fromNode) {
          isMatch = false;
          break;
        }

        const edges = this.store.getOutgoingEdges(fromNode.id);
        const matchingEdge = edges.find(e => {
          if (edgePattern.type && e.type !== edgePattern.type) return false;

          const targetNode = this.store.getNode(e.target);
          if (!targetNode) return false;

          const targetPattern = pattern.nodes[edgePattern.to];
          if (targetPattern.type && targetNode.type !== targetPattern.type) return false;
          if (targetPattern.predicate && !targetPattern.predicate(targetNode)) return false;

          return true;
        });

        if (matchingEdge) {
          edgeMatches.push(matchingEdge);
          if (nodeMatches.length <= edgePattern.to) {
            nodeMatches[edgePattern.to] = this.store.getNode(matchingEdge.target)!;
          }
        } else {
          isMatch = false;
          break;
        }
      }

      if (isMatch && nodeMatches.length === pattern.nodes.length) {
        matches.push({ nodes: nodeMatches, edges: edgeMatches });
      }
    }

    return {
      nodes: matches.flatMap(m => m.nodes),
      edges: matches.flatMap(m => m.edges),
      metadata: { matchCount: matches.length }
    };
  }

  /**
   * Aggregate nodes by a property
   */
  aggregate<T = any>(
    groupBy: string | ((node: AnyGraphNode) => string),
    aggregator?: (nodes: AnyGraphNode[]) => T
  ): QueryResult<T> {
    const groups = new Map<string, AnyGraphNode[]>();

    for (const node of this.store.getAllNodes()) {
      const key = typeof groupBy === 'function'
        ? groupBy(node)
        : (node as any)[groupBy];

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(node);
    }

    const aggregations: Record<string, T> = {};

    for (const [key, nodes] of groups) {
      if (aggregator) {
        aggregations[key] = aggregator(nodes);
      } else {
        aggregations[key] = nodes.length as any;
      }
    }

    return { aggregations };
  }

  /**
   * Complex query combining multiple conditions
   */
  query(params: {
    where?: {
      nodes?: NodePredicate;
      edges?: EdgePredicate;
    };
    include?: {
      neighbors?: boolean;
      paths?: boolean;
      edges?: boolean;
    };
    aggregate?: {
      groupBy?: string;
      count?: boolean;
    };
    options?: QueryOptions;
  }): QueryResult {
    let result: QueryResult = {};

    // Find matching nodes
    if (params.where?.nodes) {
      const nodeResult = this.findNodes(params.where.nodes, params.options);
      result.nodes = nodeResult.nodes;

      // Include edges if requested
      if (params.include?.edges) {
        result.edges = nodeResult.edges;
      }

      // Include neighbors if requested
      if (params.include?.neighbors && result.nodes) {
        const allNeighbors = new Set<string>();
        for (const node of result.nodes) {
          const neighborhood = this.findNeighborhood(node.id, 1);
          neighborhood.nodes?.forEach(n => allNeighbors.add(n.id));
        }

        result.nodes = Array.from(allNeighbors)
          .map(id => this.store.getNode(id)!)
          .filter(n => n !== undefined);
      }
    }

    // Find matching edges
    if (params.where?.edges) {
      const edgeResult = this.findEdges(params.where.edges, params.options);
      result.edges = [...(result.edges || []), ...(edgeResult.edges || [])];
    }

    // Apply aggregation
    if (params.aggregate && result.nodes) {
      if (params.aggregate.groupBy) {
        const groups = new Map<string, number>();
        for (const node of result.nodes) {
          const key = (node as any)[params.aggregate.groupBy];
          groups.set(key, (groups.get(key) || 0) + 1);
        }
        result.aggregations = Object.fromEntries(groups);
      }

      if (params.aggregate.count) {
        result.metadata = {
          ...result.metadata,
          totalCount: result.nodes.length
        };
      }
    }

    return result;
  }

  /**
   * Helper methods
   */
  private sortNodes(
    nodes: AnyGraphNode[],
    field: string,
    direction: 'asc' | 'desc' = 'asc'
  ): AnyGraphNode[] {
    return [...nodes].sort((a, b) => {
      const aVal = (a as any)[field];
      const bVal = (b as any)[field];

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private getPathEdges(nodeIds: string[]): GraphEdge[] {
    const edges: GraphEdge[] = [];

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const sourceId = nodeIds[i];
      const targetId = nodeIds[i + 1];

      const edge = this.store.getAllEdges().find(e =>
        e.source === sourceId && e.target === targetId
      );

      if (edge) {
        edges.push(edge);
      }
    }

    return edges;
  }
}