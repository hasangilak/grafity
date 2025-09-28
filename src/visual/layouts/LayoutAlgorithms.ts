import * as d3 from 'd3';
import dagre from 'dagre';

export interface LayoutNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

export interface LayoutEdge {
  source: string;
  target: string;
  [key: string]: any;
}

export interface LayoutOptions {
  width: number;
  height: number;
  padding?: number;
  [key: string]: any;
}

export type LayoutAlgorithm = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions
) => void;

/**
 * Collection of graph layout algorithms
 */
export class LayoutAlgorithms {
  /**
   * Force-directed layout using D3's force simulation
   */
  static forceDirected(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const {
      width,
      height,
      linkDistance = 60,
      chargeStrength = -300,
      centerStrength = 0.1,
      iterations = 300
    } = options;

    // Create simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(edges)
        .id((d: any) => d.id)
        .distance(linkDistance))
      .force('charge', d3.forceManyBody()
        .strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2)
        .strength(centerStrength))
      .force('collision', d3.forceCollide()
        .radius((d: any) => (d.width || 30) / 2 + 5))
      .stop();

    // Run simulation
    for (let i = 0; i < iterations; i++) {
      simulation.tick();
    }

    // Ensure nodes are within bounds
    nodes.forEach(node => {
      node.x = Math.max(20, Math.min(width - 20, node.x || width / 2));
      node.y = Math.max(20, Math.min(height - 20, node.y || height / 2));
    });
  }

  /**
   * Hierarchical layout using Dagre
   */
  static hierarchical(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const {
      width,
      height,
      direction = 'TB', // TB, BT, LR, RL
      rankSep = 50,
      nodeSep = 30,
      marginX = 20,
      marginY = 20
    } = options;

    // Create dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      ranksep: rankSep,
      nodesep: nodeSep,
      marginx: marginX,
      marginy: marginY
    });

    // Add nodes
    nodes.forEach(node => {
      g.setNode(node.id, {
        width: node.width || 100,
        height: node.height || 50
      });
    });

    // Add edges
    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target, {});
    });

    // Run layout
    dagre.layout(g);

    // Apply positions
    nodes.forEach(node => {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        node.x = dagreNode.x;
        node.y = dagreNode.y;
      }
    });

    // Scale to fit viewport
    this.scaleToFit(nodes, width, height);
  }

  /**
   * Circular layout
   */
  static circular(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const { width, height, padding = 50 } = options;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - padding;

    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, i) => {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });
  }

  /**
   * Grid layout
   */
  static grid(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const {
      width,
      height,
      padding = 20,
      cellSize = 100
    } = options;

    const cols = Math.floor((width - padding * 2) / cellSize);
    const rows = Math.ceil(nodes.length / cols);

    const startX = padding + cellSize / 2;
    const startY = padding + cellSize / 2;

    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      node.x = startX + col * cellSize;
      node.y = startY + row * cellSize;
    });

    // Center grid if it doesn't fill the viewport
    const actualWidth = cols * cellSize;
    const actualHeight = rows * cellSize;

    if (actualWidth < width - padding * 2) {
      const offsetX = (width - actualWidth) / 2 - padding;
      nodes.forEach(node => {
        node.x! += offsetX;
      });
    }

    if (actualHeight < height - padding * 2) {
      const offsetY = (height - actualHeight) / 2 - padding;
      nodes.forEach(node => {
        node.y! += offsetY;
      });
    }
  }

  /**
   * Radial layout - nodes arranged in concentric circles
   */
  static radial(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const {
      width,
      height,
      padding = 50,
      centerNode = nodes[0]?.id
    } = options;

    const centerX = width / 2;
    const centerY = height / 2;

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(node => adjacency.set(node.id, new Set()));

    edges.forEach(edge => {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    });

    // BFS to determine levels
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: [string, number][] = [[centerNode, 0]];

    while (queue.length > 0) {
      const [nodeId, level] = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      levels.set(nodeId, level);

      adjacency.get(nodeId)?.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push([neighbor, level + 1]);
        }
      });
    }

    // Place nodes that weren't reached
    let maxLevel = Math.max(...Array.from(levels.values()));
    nodes.forEach(node => {
      if (!levels.has(node.id)) {
        levels.set(node.id, maxLevel + 1);
      }
    });

    // Group nodes by level
    const levelGroups = new Map<number, LayoutNode[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node);
    });

    // Position nodes
    const maxRadius = Math.min(width, height) / 2 - padding;
    const levelCount = levelGroups.size;

    levelGroups.forEach((group, level) => {
      if (level === 0) {
        // Center node
        group[0].x = centerX;
        group[0].y = centerY;
      } else {
        const radius = (level / levelCount) * maxRadius;
        const angleStep = (2 * Math.PI) / group.length;

        group.forEach((node, i) => {
          const angle = i * angleStep;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
      }
    });
  }

  /**
   * Tree layout for hierarchical data
   */
  static tree(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const {
      width,
      height,
      direction = 'vertical', // vertical or horizontal
      padding = 50
    } = options;

    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set(edges.map(e => e.target));
    const roots = nodes.filter(n => !hasIncoming.has(n.id));

    if (roots.length === 0 && nodes.length > 0) {
      // If no roots found, use first node
      roots.push(nodes[0]);
    }

    // Build hierarchy
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const childrenMap = new Map<string, string[]>();

    edges.forEach(edge => {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    });

    // Create tree layout
    const treeLayout = direction === 'vertical'
      ? d3.tree().size([width - padding * 2, height - padding * 2])
      : d3.tree().size([height - padding * 2, width - padding * 2]);

    // Process each tree
    roots.forEach(root => {
      const hierarchy = this.buildHierarchy(root.id, nodeMap, childrenMap);
      const treeData = d3.hierarchy(hierarchy);
      const tree = treeLayout(treeData);

      // Apply positions
      tree.each((d: any) => {
        const node = nodeMap.get(d.data.id);
        if (node) {
          if (direction === 'vertical') {
            node.x = d.x + padding;
            node.y = d.y + padding;
          } else {
            node.x = d.y + padding;
            node.y = d.x + padding;
          }
        }
      });
    });
  }

  /**
   * Spectral layout using eigenvectors
   */
  static spectral(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const { width, height, padding = 50 } = options;

    // Build adjacency matrix
    const n = nodes.length;
    const nodeIndex = new Map(nodes.map((node, i) => [node.id, i]));
    const adjacency: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    edges.forEach(edge => {
      const i = nodeIndex.get(edge.source);
      const j = nodeIndex.get(edge.target);
      if (i !== undefined && j !== undefined) {
        adjacency[i][j] = 1;
        adjacency[j][i] = 1; // Undirected
      }
    });

    // Compute degree matrix
    const degree = adjacency.map(row => row.reduce((sum, val) => sum + val, 0));

    // Compute Laplacian matrix (D - A)
    const laplacian: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          laplacian[i][j] = degree[i];
        } else {
          laplacian[i][j] = -adjacency[i][j];
        }
      }
    }

    // For simplicity, use random positions (real implementation would compute eigenvectors)
    // TODO: Implement proper eigenvector computation
    nodes.forEach(node => {
      node.x = padding + Math.random() * (width - 2 * padding);
      node.y = padding + Math.random() * (height - 2 * padding);
    });

    // Apply force-directed as fallback
    this.forceDirected(nodes, edges, options);
  }

  /**
   * Custom layout using provided function
   */
  static custom(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions & { layoutFn: LayoutAlgorithm }
  ): void {
    if (options.layoutFn) {
      options.layoutFn(nodes, edges, options);
    }
  }

  /**
   * Helper: Build hierarchy for tree layout
   */
  private static buildHierarchy(
    nodeId: string,
    nodeMap: Map<string, LayoutNode>,
    childrenMap: Map<string, string[]>
  ): any {
    const node = nodeMap.get(nodeId);
    if (!node) return null;

    const children = childrenMap.get(nodeId) || [];
    const childHierarchies = children
      .map(childId => this.buildHierarchy(childId, nodeMap, childrenMap))
      .filter(child => child !== null);

    return {
      id: node.id,
      ...node,
      children: childHierarchies.length > 0 ? childHierarchies : undefined
    };
  }

  /**
   * Helper: Scale positions to fit viewport
   */
  private static scaleToFit(
    nodes: LayoutNode[],
    width: number,
    height: number,
    padding: number = 50
  ): void {
    if (nodes.length === 0) return;

    // Find bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      if (node.x !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
      }
      if (node.y !== undefined) {
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    });

    // Calculate scale
    const currentWidth = maxX - minX;
    const currentHeight = maxY - minY;
    const targetWidth = width - 2 * padding;
    const targetHeight = height - 2 * padding;

    const scaleX = currentWidth > 0 ? targetWidth / currentWidth : 1;
    const scaleY = currentHeight > 0 ? targetHeight / currentHeight : 1;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

    // Apply scale and center
    const offsetX = (width - currentWidth * scale) / 2 - minX * scale;
    const offsetY = (height - currentHeight * scale) / 2 - minY * scale;

    nodes.forEach(node => {
      if (node.x !== undefined) {
        node.x = node.x * scale + offsetX;
      }
      if (node.y !== undefined) {
        node.y = node.y * scale + offsetY;
      }
    });
  }

  /**
   * Get available layout names
   */
  static getAvailableLayouts(): string[] {
    return [
      'forceDirected',
      'hierarchical',
      'circular',
      'grid',
      'radial',
      'tree',
      'spectral'
    ];
  }

  /**
   * Apply layout by name
   */
  static applyLayout(
    name: string,
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions
  ): void {
    const layouts: Record<string, LayoutAlgorithm> = {
      forceDirected: this.forceDirected,
      hierarchical: this.hierarchical,
      circular: this.circular,
      grid: this.grid,
      radial: this.radial,
      tree: this.tree,
      spectral: this.spectral
    };

    const layoutFn = layouts[name];
    if (layoutFn) {
      layoutFn.call(this, nodes, edges, options);
    } else {
      throw new Error(`Unknown layout: ${name}`);
    }
  }
}