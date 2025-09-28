import { GraphStore } from '../GraphStore';
import { AnyGraphNode } from '../types/NodeTypes';
import { GraphEdge } from '../types/EdgeTypes';

export interface TraversalOptions {
  maxDepth?: number;
  visitOnce?: boolean;
  followBidirectional?: boolean;
}

export interface TraversalResult {
  visitOrder: string[];
  depths: Map<string, number>;
  parents: Map<string, string>;
  edges: GraphEdge[];
}

export interface ComponentResult {
  components: Set<string>[];
  bridges: GraphEdge[];
  articulationPoints: string[];
}

/**
 * Graph traversal algorithms
 */
export class GraphTraversal {
  constructor(private store: GraphStore) {}

  /**
   * Breadth-first search traversal
   */
  bfs(
    startId: string,
    options: TraversalOptions = {}
  ): TraversalResult {
    const {
      maxDepth = Infinity,
      visitOnce = true,
      followBidirectional = true
    } = options;

    const visitOrder: string[] = [];
    const depths = new Map<string, number>();
    const parents = new Map<string, string>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();

    const queue: Array<{ id: string; depth: number; parent?: string }> = [
      { id: startId, depth: 0 }
    ];

    while (queue.length > 0) {
      const { id, depth, parent } = queue.shift()!;

      if (visitOnce && visited.has(id)) continue;
      if (depth > maxDepth) continue;

      visited.add(id);
      visitOrder.push(id);
      depths.set(id, depth);

      if (parent) {
        parents.set(id, parent);
      }

      // Get adjacent nodes
      const outgoing = this.store.getOutgoingEdges(id);
      for (const edge of outgoing) {
        edges.push(edge);
        if (!visitOnce || !visited.has(edge.target)) {
          queue.push({
            id: edge.target,
            depth: depth + 1,
            parent: id
          });
        }
      }

      if (followBidirectional) {
        const incoming = this.store.getIncomingEdges(id);
        for (const edge of incoming) {
          if (edge.bidirectional) {
            edges.push(edge);
            if (!visitOnce || !visited.has(edge.source)) {
              queue.push({
                id: edge.source,
                depth: depth + 1,
                parent: id
              });
            }
          }
        }
      }
    }

    return { visitOrder, depths, parents, edges };
  }

  /**
   * Depth-first search traversal
   */
  dfs(
    startId: string,
    options: TraversalOptions = {}
  ): TraversalResult {
    const {
      maxDepth = Infinity,
      visitOnce = true,
      followBidirectional = true
    } = options;

    const visitOrder: string[] = [];
    const depths = new Map<string, number>();
    const parents = new Map<string, string>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();

    const dfsRecursive = (
      id: string,
      depth: number,
      parent?: string
    ): void => {
      if (visitOnce && visited.has(id)) return;
      if (depth > maxDepth) return;

      visited.add(id);
      visitOrder.push(id);
      depths.set(id, depth);

      if (parent) {
        parents.set(id, parent);
      }

      // Get adjacent nodes
      const outgoing = this.store.getOutgoingEdges(id);
      for (const edge of outgoing) {
        edges.push(edge);
        dfsRecursive(edge.target, depth + 1, id);
      }

      if (followBidirectional) {
        const incoming = this.store.getIncomingEdges(id);
        for (const edge of incoming) {
          if (edge.bidirectional) {
            edges.push(edge);
            dfsRecursive(edge.source, depth + 1, id);
          }
        }
      }
    };

    dfsRecursive(startId, 0);

    return { visitOrder, depths, parents, edges };
  }

  /**
   * Find shortest path using BFS
   */
  shortestPath(sourceId: string, targetId: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [
      { id: sourceId, path: [sourceId] }
    ];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === targetId) {
        return path;
      }

      if (visited.has(id)) continue;
      visited.add(id);

      const edges = this.store.getOutgoingEdges(id);
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          queue.push({
            id: edge.target,
            path: [...path, edge.target]
          });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find all simple paths between two nodes
   */
  findAllPaths(
    sourceId: string,
    targetId: string,
    maxLength: number = 10
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]): void => {
      if (path.length > maxLength) return;

      if (current === targetId) {
        paths.push([...path]);
        return;
      }

      visited.add(current);

      const edges = this.store.getOutgoingEdges(current);
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target, [...path, edge.target]);
        }
      }

      visited.delete(current);
    };

    dfs(sourceId, [sourceId]);

    return paths;
  }

  /**
   * Find connected components in the graph
   */
  findConnectedComponents(): ComponentResult {
    const visited = new Set<string>();
    const components: Set<string>[] = [];
    const allNodes = this.store.getAllNodes();

    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        const component = new Set<string>();
        const queue = [node.id];

        while (queue.length > 0) {
          const id = queue.shift()!;
          if (visited.has(id)) continue;

          visited.add(id);
          component.add(id);

          // Add all connected nodes
          const outgoing = this.store.getOutgoingEdges(id);
          for (const edge of outgoing) {
            if (!visited.has(edge.target)) {
              queue.push(edge.target);
            }
          }

          const incoming = this.store.getIncomingEdges(id);
          for (const edge of incoming) {
            if (!visited.has(edge.source)) {
              queue.push(edge.source);
            }
          }
        }

        components.push(component);
      }
    }

    // Find bridges (edges that disconnect components)
    const bridges = this.findBridges();

    // Find articulation points (nodes that disconnect components)
    const articulationPoints = this.findArticulationPoints();

    return { components, bridges, articulationPoints };
  }

  /**
   * Detect cycles in the graph
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const edges = this.store.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target);
        } else if (recStack.has(edge.target)) {
          // Found a cycle
          const cycleStart = path.indexOf(edge.target);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), edge.target]);
          }
        }
      }

      path.pop();
      recStack.delete(nodeId);
    };

    const allNodes = this.store.getAllNodes();
    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Topological sort (for DAGs)
   */
  topologicalSort(): string[] | null {
    const indegree = new Map<string, number>();
    const allNodes = this.store.getAllNodes();
    const result: string[] = [];

    // Initialize indegree
    for (const node of allNodes) {
      indegree.set(node.id, 0);
    }

    // Calculate indegree
    for (const node of allNodes) {
      const edges = this.store.getOutgoingEdges(node.id);
      for (const edge of edges) {
        indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
      }
    }

    // Find nodes with indegree 0
    const queue: string[] = [];
    for (const [nodeId, degree] of indegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const edges = this.store.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        const newDegree = (indegree.get(edge.target) || 0) - 1;
        indegree.set(edge.target, newDegree);

        if (newDegree === 0) {
          queue.push(edge.target);
        }
      }
    }

    // If all nodes are not included, there's a cycle
    if (result.length !== allNodes.length) {
      return null; // Graph has cycles
    }

    return result;
  }

  /**
   * Find strongly connected components (Kosaraju's algorithm)
   */
  findStronglyConnectedComponents(): Set<string>[] {
    const stack: string[] = [];
    const visited = new Set<string>();
    const allNodes = this.store.getAllNodes();

    // First DFS to fill stack
    const dfs1 = (nodeId: string): void => {
      visited.add(nodeId);
      const edges = this.store.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          dfs1(edge.target);
        }
      }
      stack.push(nodeId);
    };

    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        dfs1(node.id);
      }
    }

    // Second DFS on transposed graph
    visited.clear();
    const components: Set<string>[] = [];

    const dfs2 = (nodeId: string, component: Set<string>): void => {
      visited.add(nodeId);
      component.add(nodeId);

      // Use incoming edges (transposed)
      const edges = this.store.getIncomingEdges(nodeId);
      for (const edge of edges) {
        if (!visited.has(edge.source)) {
          dfs2(edge.source, component);
        }
      }
    };

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (!visited.has(nodeId)) {
        const component = new Set<string>();
        dfs2(nodeId, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Find bridges in the graph (edges whose removal disconnects the graph)
   */
  private findBridges(): GraphEdge[] {
    const bridges: GraphEdge[] = [];
    const visited = new Set<string>();
    const disc = new Map<string, number>();
    const low = new Map<string, number>();
    const parent = new Map<string, string>();
    let time = 0;

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      disc.set(nodeId, time);
      low.set(nodeId, time);
      time++;

      const edges = this.store.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        const v = edge.target;

        if (!visited.has(v)) {
          parent.set(v, nodeId);
          dfs(v);

          low.set(nodeId, Math.min(low.get(nodeId)!, low.get(v)!));

          // Check if edge is a bridge
          if (low.get(v)! > disc.get(nodeId)!) {
            bridges.push(edge);
          }
        } else if (v !== parent.get(nodeId)) {
          low.set(nodeId, Math.min(low.get(nodeId)!, disc.get(v)!));
        }
      }
    };

    const allNodes = this.store.getAllNodes();
    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return bridges;
  }

  /**
   * Find articulation points (nodes whose removal disconnects the graph)
   */
  private findArticulationPoints(): string[] {
    const articulationPoints = new Set<string>();
    const visited = new Set<string>();
    const disc = new Map<string, number>();
    const low = new Map<string, number>();
    const parent = new Map<string, string>();
    let time = 0;

    const dfs = (nodeId: string): void => {
      let children = 0;
      visited.add(nodeId);
      disc.set(nodeId, time);
      low.set(nodeId, time);
      time++;

      const edges = this.store.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        const v = edge.target;

        if (!visited.has(v)) {
          children++;
          parent.set(v, nodeId);
          dfs(v);

          low.set(nodeId, Math.min(low.get(nodeId)!, low.get(v)!));

          // Check for articulation point
          if (!parent.has(nodeId) && children > 1) {
            articulationPoints.add(nodeId);
          }

          if (parent.has(nodeId) && low.get(v)! >= disc.get(nodeId)!) {
            articulationPoints.add(nodeId);
          }
        } else if (v !== parent.get(nodeId)) {
          low.set(nodeId, Math.min(low.get(nodeId)!, disc.get(v)!));
        }
      }
    };

    const allNodes = this.store.getAllNodes();
    for (const node of allNodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return Array.from(articulationPoints);
  }

  /**
   * Check if graph is bipartite
   */
  isBipartite(): boolean {
    const color = new Map<string, number>();
    const allNodes = this.store.getAllNodes();

    for (const node of allNodes) {
      if (!color.has(node.id)) {
        const queue = [node.id];
        color.set(node.id, 0);

        while (queue.length > 0) {
          const u = queue.shift()!;
          const edges = this.store.getOutgoingEdges(u);

          for (const edge of edges) {
            const v = edge.target;

            if (!color.has(v)) {
              color.set(v, 1 - color.get(u)!);
              queue.push(v);
            } else if (color.get(v) === color.get(u)) {
              return false; // Not bipartite
            }
          }
        }
      }
    }

    return true;
  }
}