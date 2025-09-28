import * as d3 from 'd3';
import { GraphStore } from '../../core/graph-engine/GraphStore';
import { AnyGraphNode } from '../../core/graph-engine/types/NodeTypes';
import { GraphEdge } from '../../core/graph-engine/types/EdgeTypes';

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  data: AnyGraphNode;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  selected?: boolean;
  hovered?: boolean;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  data: GraphEdge;
  source: D3Node | string;
  target: D3Node | string;
  // Edge bundling properties
  bundled?: boolean;
  bundleId?: string;
  controlPoints?: Array<{ x: number; y: number }>;
  path?: string;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  nodeRadius?: number;
  linkDistance?: number;
  chargeStrength?: number;
  centerForce?: number;
  useWebWorker?: boolean;
  enableCollision?: boolean;
  enableZoom?: boolean;
  enableDrag?: boolean;
  maxZoom?: number;
  minZoom?: number;
  enableEdgeBundling?: boolean;
  bundlingStrength?: number;
  bundlingIterations?: number;
}

export interface ViewLevel {
  name: string;
  minZoom: number;
  maxZoom: number;
  nodeRenderer: (node: D3Node) => void;
  edgeRenderer: (edge: D3Link) => void;
}

/**
 * Advanced D3.js graph renderer with performance optimizations
 */
export class D3GraphRenderer {
  private store: GraphStore;
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<D3Node, D3Link> | null = null;
  private nodes: D3Node[] = [];
  private links: D3Link[] = [];
  private options: Required<RenderOptions>;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private currentTransform: d3.ZoomTransform = d3.zoomIdentity;

  // Performance optimization
  private quadtree: d3.Quadtree<D3Node> | null = null;
  private visibleNodes: Set<string> = new Set();
  private renderRequestId: number | null = null;

  // View levels for semantic zoom
  private viewLevels: ViewLevel[] = [
    {
      name: 'overview',
      minZoom: 0.1,
      maxZoom: 0.5,
      nodeRenderer: this.renderNodeOverview.bind(this),
      edgeRenderer: this.renderEdgeOverview.bind(this)
    },
    {
      name: 'standard',
      minZoom: 0.5,
      maxZoom: 2,
      nodeRenderer: this.renderNodeStandard.bind(this),
      edgeRenderer: this.renderEdgeStandard.bind(this)
    },
    {
      name: 'detail',
      minZoom: 2,
      maxZoom: 10,
      nodeRenderer: this.renderNodeDetail.bind(this),
      edgeRenderer: this.renderEdgeDetail.bind(this)
    }
  ];

  constructor(store: GraphStore, options: RenderOptions = {}) {
    this.store = store;
    this.options = {
      width: options.width || 1200,
      height: options.height || 800,
      nodeRadius: options.nodeRadius || 8,
      linkDistance: options.linkDistance || 60,
      chargeStrength: options.chargeStrength || -300,
      centerForce: options.centerForce || 0.1,
      useWebWorker: options.useWebWorker !== false,
      enableCollision: options.enableCollision !== false,
      enableZoom: options.enableZoom !== false,
      enableDrag: options.enableDrag !== false,
      maxZoom: options.maxZoom || 10,
      minZoom: options.minZoom || 0.1,
      enableEdgeBundling: options.enableEdgeBundling || false,
      bundlingStrength: options.bundlingStrength || 0.85,
      bundlingIterations: options.bundlingIterations || 60
    };
  }

  /**
   * Initialize the renderer with a container element
   */
  init(container: HTMLElement): void {
    this.container = container;
    this.setupSVG();
    this.setupSimulation();
    this.prepareData();
    this.render();

    if (this.options.enableZoom) {
      this.setupZoom();
    }

    if (this.options.enableDrag) {
      this.setupDrag();
    }

    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Setup SVG container
   */
  private setupSVG(): void {
    if (!this.container) return;

    // Clear existing SVG
    d3.select(this.container).selectAll('*').remove();

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .classed('d3-graph-renderer', true);

    // Add defs for arrows, gradients, etc.
    const defs = this.svg.append('defs');

    // Arrow markers for directed edges
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    // Gradient for edges
    const gradient = defs.append('linearGradient')
      .attr('id', 'edge-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .style('stop-color', '#4A90E2')
      .style('stop-opacity', 0.6);

    gradient.append('stop')
      .attr('offset', '100%')
      .style('stop-color', '#50E3C2')
      .style('stop-opacity', 0.6);

    // Main group for zoom/pan
    this.g = this.svg.append('g').classed('main-group', true);

    // Layer groups for proper z-ordering
    this.g.append('g').classed('links-layer', true);
    this.g.append('g').classed('nodes-layer', true);
    this.g.append('g').classed('labels-layer', true);
  }

  /**
   * Setup D3 force simulation
   */
  private setupSimulation(): void {
    this.simulation = d3.forceSimulation<D3Node, D3Link>()
      .force('link', d3.forceLink<D3Node, D3Link>()
        .id(d => d.id)
        .distance(this.options.linkDistance))
      .force('charge', d3.forceManyBody()
        .strength(this.options.chargeStrength))
      .force('center', d3.forceCenter(
        this.options.width / 2,
        this.options.height / 2
      ).strength(this.options.centerForce));

    if (this.options.enableCollision) {
      this.simulation.force('collision', d3.forceCollide<D3Node>()
        .radius(d => this.getNodeRadius(d) + 2));
    }

    // Use Web Worker for physics if available and enabled
    if (this.options.useWebWorker && typeof Worker !== 'undefined') {
      // TODO: Implement Web Worker for physics calculations
    }

    this.simulation.on('tick', () => this.onTick());
  }

  /**
   * Prepare data from graph store
   */
  private prepareData(): void {
    const storeNodes = this.store.getAllNodes();
    const storeEdges = this.store.getAllEdges();

    // Convert nodes
    this.nodes = storeNodes.map(node => ({
      id: node.id,
      data: node,
      x: Math.random() * this.options.width,
      y: Math.random() * this.options.height
    }));

    // Convert edges
    this.links = storeEdges.map(edge => ({
      id: edge.id,
      data: edge,
      source: edge.source,
      target: edge.target
    }));

    // Build quadtree for spatial indexing
    this.buildQuadtree();
  }

  /**
   * Build quadtree for efficient spatial queries
   */
  private buildQuadtree(): void {
    this.quadtree = d3.quadtree<D3Node>()
      .x(d => d.x || 0)
      .y(d => d.y || 0)
      .addAll(this.nodes);
  }

  /**
   * Main render method
   */
  private render(): void {
    if (!this.g || !this.simulation) return;

    // Update simulation data
    this.simulation.nodes(this.nodes);
    const linkForce = this.simulation.force('link') as d3.ForceLink<D3Node, D3Link>;
    if (linkForce) {
      linkForce.links(this.links);
    }

    // Render links
    this.renderLinks();

    // Render nodes
    this.renderNodes();

    // Start simulation
    this.simulation.alpha(1).restart();
  }

  /**
   * Render links based on current zoom level
   */
  private renderLinks(): void {
    if (!this.g) return;

    // Apply edge bundling if enabled
    if (this.options.enableEdgeBundling) {
      this.applyEdgeBundling();
      this.renderBundledEdges();
      return;
    }

    const linksLayer = this.g.select('.links-layer');
    const viewLevel = this.getCurrentViewLevel();

    // Remove any bundled edges first
    linksLayer.selectAll('.bundled-edge').remove();

    const links = linksLayer.selectAll<SVGLineElement, D3Link>('.link')
      .data(this.links.filter(d => !d.bundled), d => d.id);

    // Remove old links
    links.exit().remove();

    // Add new links
    const linksEnter = links.enter()
      .append('line')
      .classed('link', true)
      .attr('stroke', d => this.getEdgeColor(d))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.data.weight || 1))
      .attr('marker-end', d => d.data.bidirectional ? null : 'url(#arrow)');

    // Merge and update
    links.merge(linksEnter)
      .each(function(d) {
        viewLevel.edgeRenderer(d);
      });
  }

  /**
   * Render nodes based on current zoom level
   */
  private renderNodes(): void {
    if (!this.g) return;

    const nodesLayer = this.g.select('.nodes-layer');
    const viewLevel = this.getCurrentViewLevel();

    const nodes = nodesLayer.selectAll<SVGGElement, D3Node>('.node')
      .data(this.nodes, d => d.id);

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes
    const nodesEnter = nodes.enter()
      .append('g')
      .classed('node', true);

    nodesEnter.append('circle')
      .attr('r', d => this.getNodeRadius(d))
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Merge and update
    nodes.merge(nodesEnter)
      .each(function(d) {
        viewLevel.nodeRenderer(d);
      });
  }

  /**
   * Render node in overview mode (minimal detail)
   */
  private renderNodeOverview(node: D3Node): void {
    // Just show dots with colors
    const selection = d3.select(this.container)
      .selectAll<SVGGElement, D3Node>(`.node`)
      .filter(d => d.id === node.id);

    selection.select('circle')
      .attr('r', 3)
      .attr('fill', this.getNodeColor(node));
  }

  /**
   * Render node in standard mode
   */
  private renderNodeStandard(node: D3Node): void {
    const selection = d3.select(this.container)
      .selectAll<SVGGElement, D3Node>(`.node`)
      .filter(d => d.id === node.id);

    selection.select('circle')
      .attr('r', this.getNodeRadius(node))
      .attr('fill', this.getNodeColor(node));

    // Add label
    if (!selection.select('text').node()) {
      selection.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .style('font-size', '10px')
        .style('fill', '#333');
    }

    selection.select('text')
      .text(d => d.data.label.substring(0, 20));
  }

  /**
   * Render node in detail mode
   */
  private renderNodeDetail(node: D3Node): void {
    const selection = d3.select(this.container)
      .selectAll<SVGGElement, D3Node>(`.node`)
      .filter(d => d.id === node.id);

    selection.select('circle')
      .attr('r', this.getNodeRadius(node) * 1.2)
      .attr('fill', this.getNodeColor(node))
      .attr('stroke-width', 3);

    // Full label
    selection.select('text')
      .text(d => d.data.label)
      .style('font-size', '12px')
      .style('font-weight', 'bold');

    // Add metadata on hover
    if (node.hovered) {
      // TODO: Show tooltip with metadata
    }
  }

  /**
   * Render edge in overview mode
   */
  private renderEdgeOverview(edge: D3Link): void {
    // Hide edges in overview
    const selection = d3.select(this.container)
      .selectAll<SVGLineElement, D3Link>(`.link`)
      .filter(d => d.id === edge.id);

    selection.style('display', 'none');
  }

  /**
   * Render edge in standard mode
   */
  private renderEdgeStandard(edge: D3Link): void {
    const selection = d3.select(this.container)
      .selectAll<SVGLineElement, D3Link>(`.link`)
      .filter(d => d.id === edge.id);

    selection
      .style('display', 'block')
      .attr('stroke-width', Math.sqrt(edge.data.weight || 1))
      .attr('stroke-opacity', 0.4);
  }

  /**
   * Render edge in detail mode
   */
  private renderEdgeDetail(edge: D3Link): void {
    const selection = d3.select(this.container)
      .selectAll<SVGLineElement, D3Link>(`.link`)
      .filter(d => d.id === edge.id);

    selection
      .style('display', 'block')
      .attr('stroke-width', Math.sqrt(edge.data.weight || 1) * 1.5)
      .attr('stroke-opacity', 0.6);

    // TODO: Add edge labels
  }

  /**
   * Get current view level based on zoom
   */
  private getCurrentViewLevel(): ViewLevel {
    const zoom = this.currentTransform.k;
    return this.viewLevels.find(level =>
      zoom >= level.minZoom && zoom <= level.maxZoom
    ) || this.viewLevels[1]; // Default to standard
  }

  /**
   * Setup zoom behavior
   */
  private setupZoom(): void {
    if (!this.svg || !this.g) return;

    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        this.g!.attr('transform', event.transform.toString());

        // Update view level
        this.updateViewLevel();

        // Update visible nodes for culling
        this.updateVisibleNodes();
      });

    this.svg.call(this.zoom);
  }

  /**
   * Setup drag behavior
   */
  private setupDrag(): void {
    if (!this.g) return;

    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0);
        }
        // Keep node fixed after drag
        // Uncomment to release: d.fx = null; d.fy = null;
      });

    this.g.selectAll<SVGGElement, D3Node>('.node')
      .call(drag);
  }

  /**
   * Update view level based on zoom
   */
  private updateViewLevel(): void {
    const viewLevel = this.getCurrentViewLevel();

    // Re-render nodes and edges with new level
    this.nodes.forEach(node => viewLevel.nodeRenderer(node));
    this.links.forEach(edge => viewLevel.edgeRenderer(edge));
  }

  /**
   * Update visible nodes for viewport culling
   */
  private updateVisibleNodes(): void {
    if (!this.svg) return;

    const bounds = this.svg.node()?.getBoundingClientRect();
    if (!bounds) return;

    // Calculate visible viewport in data coordinates
    const topLeft = this.currentTransform.invert([0, 0]);
    const bottomRight = this.currentTransform.invert([bounds.width, bounds.height]);

    this.visibleNodes.clear();

    // Use quadtree for efficient spatial query
    if (this.quadtree) {
      this.quadtree.visit((node, x1, y1, x2, y2) => {
        if (!node.data) return false;

        if (node.data.x! >= topLeft[0] && node.data.x! <= bottomRight[0] &&
            node.data.y! >= topLeft[1] && node.data.y! <= bottomRight[1]) {
          this.visibleNodes.add(node.data.id);
        }

        // Don't traverse if box is outside viewport
        return x1 > bottomRight[0] || x2 < topLeft[0] ||
               y1 > bottomRight[1] || y2 < topLeft[1];
      });
    }
  }

  /**
   * Simulation tick handler
   */
  private onTick(): void {
    if (!this.g) return;

    // Update link positions
    this.g.selectAll<SVGLineElement, D3Link>('.link')
      .attr('x1', d => (d.source as D3Node).x || 0)
      .attr('y1', d => (d.source as D3Node).y || 0)
      .attr('x2', d => (d.target as D3Node).x || 0)
      .attr('y2', d => (d.target as D3Node).y || 0);

    // Update node positions
    this.g.selectAll<SVGGElement, D3Node>('.node')
      .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);

    // Rebuild quadtree periodically
    if (this.simulation && this.simulation.alpha() > 0.01) {
      this.buildQuadtree();
    }
  }

  /**
   * Start render loop with requestAnimationFrame
   */
  private startRenderLoop(): void {
    const render = () => {
      // Only render visible nodes for performance
      if (this.visibleNodes.size > 0) {
        // TODO: Implement visibility culling
      }

      this.renderRequestId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Get node radius based on type and metadata
   */
  private getNodeRadius(node: D3Node): number {
    const base = this.options.nodeRadius;
    const complexity = node.data.metadata?.complexity as number || 1;
    return base + Math.log(complexity + 1) * 2;
  }

  /**
   * Get node color based on type
   */
  private getNodeColor(node: D3Node): string {
    const colors: Record<string, string> = {
      'code': '#4A90E2',
      'business': '#50E3C2',
      'document': '#F5A623',
      'conversation': '#BD10E0',
      'unknown': '#9B9B9B'
    };
    return colors[node.data.type] || colors.unknown;
  }

  /**
   * Update graph with new data
   */
  update(): void {
    this.prepareData();
    this.render();
  }

  /**
   * Destroy the renderer and clean up
   */
  destroy(): void {
    if (this.renderRequestId) {
      cancelAnimationFrame(this.renderRequestId);
    }

    if (this.simulation) {
      this.simulation.stop();
    }

    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
    }

    this.nodes = [];
    this.links = [];
    this.visibleNodes.clear();
    this.quadtree = null;
  }

  /**
   * Apply edge bundling algorithm
   */
  private applyEdgeBundling(): void {
    if (!this.options.enableEdgeBundling || this.links.length === 0) return;

    // Reset bundling properties
    this.links.forEach(link => {
      link.bundled = false;
      link.bundleId = undefined;
      link.controlPoints = [];
      link.path = undefined;
    });

    // Group edges by similar paths
    const bundleGroups = this.groupSimilarEdges();

    // Apply bundling to each group
    bundleGroups.forEach((group, groupId) => {
      if (group.length > 1) {
        this.bundleEdgeGroup(group, groupId);
      }
    });
  }

  /**
   * Group similar edges for bundling
   */
  private groupSimilarEdges(): Map<string, D3Link[]> {
    const groups = new Map<string, D3Link[]>();
    const threshold = 50; // Distance threshold for grouping

    this.links.forEach(link => {
      const source = link.source as D3Node;
      const target = link.target as D3Node;

      if (!source.x || !source.y || !target.x || !target.y) return;

      // Create a key based on approximate direction and distance
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Quantize angle and distance for grouping
      const angleGroup = Math.round(angle / (Math.PI / 8)) * (Math.PI / 8);
      const distanceGroup = Math.round(distance / threshold) * threshold;
      const groupKey = `${angleGroup.toFixed(2)}_${distanceGroup}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(link);
    });

    return groups;
  }

  /**
   * Bundle a group of edges together
   */
  private bundleEdgeGroup(edges: D3Link[], groupId: string): void {
    const bundleId = `bundle_${groupId}`;

    // Calculate bundle path using force-directed bundling
    const controlPoints = this.calculateBundlePath(edges);

    edges.forEach(edge => {
      edge.bundled = true;
      edge.bundleId = bundleId;
      edge.controlPoints = controlPoints;
      edge.path = this.generateBundlePath(edge, controlPoints);
    });
  }

  /**
   * Calculate bundle path control points
   */
  private calculateBundlePath(edges: D3Link[]): Array<{ x: number; y: number }> {
    if (edges.length === 0) return [];

    const firstEdge = edges[0];
    const source = firstEdge.source as D3Node;
    const target = firstEdge.target as D3Node;

    if (!source.x || !source.y || !target.x || !target.y) return [];

    // Simple bundling: create control points along the edge
    const controlPoints: Array<{ x: number; y: number }> = [];
    const segments = Math.max(3, Math.min(8, Math.floor(edges.length / 2)));

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = source.x + (target.x - source.x) * t;
      const y = source.y + (target.y - source.y) * t;

      // Add some curvature to the bundle
      const offset = Math.sin(t * Math.PI) * 20 * (edges.length / 10);
      const perpX = -(target.y - source.y) / Math.sqrt((target.x - source.x) ** 2 + (target.y - source.y) ** 2);
      const perpY = (target.x - source.x) / Math.sqrt((target.x - source.x) ** 2 + (target.y - source.y) ** 2);

      controlPoints.push({
        x: x + perpX * offset,
        y: y + perpY * offset
      });
    }

    // Iteratively refine control points using force-directed approach
    for (let iter = 0; iter < this.options.bundlingIterations; iter++) {
      this.refineBundleControlPoints(controlPoints, edges);
    }

    return controlPoints;
  }

  /**
   * Refine bundle control points using force-directed approach
   */
  private refineBundleControlPoints(
    controlPoints: Array<{ x: number; y: number }>,
    edges: D3Link[]
  ): void {
    const strength = this.options.bundlingStrength;

    controlPoints.forEach((point, i) => {
      let fx = 0, fy = 0;

      // Attraction to nearby edges
      edges.forEach(edge => {
        const source = edge.source as D3Node;
        const target = edge.target as D3Node;

        if (!source.x || !source.y || !target.x || !target.y) return;

        const t = (i + 1) / (controlPoints.length + 1);
        const edgePoint = {
          x: source.x + (target.x - source.x) * t,
          y: source.y + (target.y - source.y) * t
        };

        const dx = edgePoint.x - point.x;
        const dy = edgePoint.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          fx += (dx / distance) * strength;
          fy += (dy / distance) * strength;
        }
      });

      // Smoothing with neighboring control points
      if (i > 0) {
        const prev = controlPoints[i - 1];
        fx += (prev.x - point.x) * 0.1;
        fy += (prev.y - point.y) * 0.1;
      }

      if (i < controlPoints.length - 1) {
        const next = controlPoints[i + 1];
        fx += (next.x - point.x) * 0.1;
        fy += (next.y - point.y) * 0.1;
      }

      point.x += fx * 0.1;
      point.y += fy * 0.1;
    });
  }

  /**
   * Generate SVG path string for bundled edge
   */
  private generateBundlePath(edge: D3Link, controlPoints: Array<{ x: number; y: number }>): string {
    const source = edge.source as D3Node;
    const target = edge.target as D3Node;

    if (!source.x || !source.y || !target.x || !target.y) return '';

    let path = `M ${source.x} ${source.y}`;

    if (controlPoints.length === 0) {
      path += ` L ${target.x} ${target.y}`;
    } else {
      // Create smooth curve through control points
      if (controlPoints.length === 1) {
        path += ` Q ${controlPoints[0].x} ${controlPoints[0].y} ${target.x} ${target.y}`;
      } else {
        // Use cubic Bezier curves for multiple control points
        for (let i = 0; i < controlPoints.length; i++) {
          const cp = controlPoints[i];
          const nextPoint = i === controlPoints.length - 1 ? { x: target.x, y: target.y } : controlPoints[i + 1];

          if (i === 0) {
            // First control point
            path += ` Q ${cp.x} ${cp.y} ${(cp.x + nextPoint.x) / 2} ${(cp.y + nextPoint.y) / 2}`;
          } else if (i === controlPoints.length - 1) {
            // Last control point to target
            path += ` Q ${cp.x} ${cp.y} ${target.x} ${target.y}`;
          } else {
            // Intermediate control points
            path += ` Q ${cp.x} ${cp.y} ${(cp.x + nextPoint.x) / 2} ${(cp.y + nextPoint.y) / 2}`;
          }
        }
      }
    }

    return path;
  }

  /**
   * Update edge rendering to use bundled paths
   */
  private renderBundledEdges(): void {
    if (!this.g) return;

    const linksLayer = this.g.select('.links-layer');

    // Remove existing bundled paths
    linksLayer.selectAll('.bundled-edge').remove();

    // Group bundled edges by bundle ID
    const bundleGroups = new Map<string, D3Link[]>();
    this.links.forEach(link => {
      if (link.bundled && link.bundleId) {
        if (!bundleGroups.has(link.bundleId)) {
          bundleGroups.set(link.bundleId, []);
        }
        bundleGroups.get(link.bundleId)!.push(link);
      }
    });

    // Render each bundle
    bundleGroups.forEach((bundle, bundleId) => {
      const bundleGroup = linksLayer.append('g')
        .classed('bundled-edge', true)
        .attr('data-bundle-id', bundleId);

      bundle.forEach((link, index) => {
        if (link.path) {
          bundleGroup.append('path')
            .attr('d', link.path)
            .attr('stroke', this.getEdgeColor(link))
            .attr('stroke-width', 1)
            .attr('fill', 'none')
            .attr('opacity', 0.7)
            .attr('stroke-dasharray', index > 0 ? '2,2' : 'none') // Dash non-primary edges in bundle
            .classed('bundled-path', true);
        }
      });
    });
  }

  /**
   * Get edge color based on type
   */
  private getEdgeColor(edge: D3Link): string {
    const colors: Record<string, string> = {
      'dependency': '#4A90E2',
      'communication': '#BD10E0',
      'dataFlow': '#50E3C2',
      'reference': '#F5A623'
    };
    return colors[edge.data.type] || '#999';
  }

  /**
   * Enable or disable edge bundling
   */
  setEdgeBundling(enabled: boolean): void {
    this.options.enableEdgeBundling = enabled;
    if (enabled) {
      this.applyEdgeBundling();
      this.renderBundledEdges();
    } else {
      // Remove bundling and render normal edges
      this.links.forEach(link => {
        link.bundled = false;
        link.bundleId = undefined;
        link.controlPoints = [];
        link.path = undefined;
      });
      if (this.g) {
        this.g.select('.links-layer').selectAll('.bundled-edge').remove();
      }
      this.render(); // Re-render with normal edges
    }
  }

  /**
   * Export current view as SVG
   */
  exportSVG(): string {
    if (!this.svg) return '';

    const svgNode = this.svg.node();
    if (!svgNode) return '';

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgNode);
  }

  /**
   * Export current view as PNG
   */
  async exportPNG(): Promise<Blob> {
    const svgString = this.exportSVG();
    const canvas = document.createElement('canvas');
    canvas.width = this.options.width;
    canvas.height = this.options.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert to PNG'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}