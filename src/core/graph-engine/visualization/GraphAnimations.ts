import * as d3 from 'd3';
import { AnyGraphNode } from '../types/NodeTypes';
import { GraphEdge } from '../types/EdgeTypes';

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: D3Node | string;
  target: D3Node | string;
  type: string;
}

/**
 * Helper class for D3.js graph animations and incremental updates
 */
export class GraphAnimations {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g: d3.Selection<SVGGElement, unknown, null, undefined>;
  private simulation: d3.Simulation<D3Node, D3Link>;
  private nodeElements: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>;
  private linkElements: d3.Selection<SVGLineElement, D3Link, SVGGElement, unknown>;
  private nodes: D3Node[] = [];
  private links: D3Link[] = [];

  constructor(
    svgSelector: string,
    width: number,
    height: number
  ) {
    // Setup SVG
    this.svg = d3.select<SVGSVGElement, unknown>(svgSelector);
    this.g = this.svg.append('g');

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Setup simulation
    this.simulation = d3.forceSimulation<D3Node, D3Link>(this.nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(this.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Initialize empty groups
    this.linkElements = this.g.append('g').selectAll<SVGLineElement, D3Link>('line');
    this.nodeElements = this.g.append('g').selectAll<SVGGElement, D3Node>('g');
  }

  /**
   * Initialize graph with nodes and links
   */
  initialize(nodes: AnyGraphNode[], edges: GraphEdge[]): void {
    this.nodes = nodes.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type
    }));

    this.links = edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type
    }));

    this.updateGraph();
  }

  /**
   * Add a single node with animation
   */
  addNode(node: AnyGraphNode, position?: { x: number; y: number }): void {
    const d3Node: D3Node = {
      id: node.id,
      label: node.label,
      type: node.type,
      x: position?.x || Math.random() * 800,
      y: position?.y || Math.random() * 600
    };

    this.nodes.push(d3Node);
    this.updateGraph(true);

    // Highlight new node
    this.highlightNode(node.id);
  }

  /**
   * Add a single edge with animation
   */
  addEdge(edge: GraphEdge): void {
    const d3Link: D3Link = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type
    };

    this.links.push(d3Link);
    this.updateGraph(true);

    // Highlight new edge
    this.highlightEdge(edge.id);
  }

  /**
   * Remove a node with animation
   */
  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.links = this.links.filter(l => {
      const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
      const targetId = typeof l.target === 'string' ? l.target : l.target.id;
      return sourceId !== nodeId && targetId !== nodeId;
    });
    this.updateGraph(true);
  }

  /**
   * Remove an edge with animation
   */
  removeEdge(edgeId: string): void {
    this.links = this.links.filter(l => l.id !== edgeId);
    this.updateGraph(true);
  }

  /**
   * Update graph visualization with optional animation
   */
  private updateGraph(animate: boolean = false): void {
    const transition = animate ? d3.transition().duration(750) : d3.transition().duration(0);

    // Update links
    this.linkElements = this.linkElements
      .data(this.links, (d: D3Link) => d.id)
      .join(
        enter => enter.append('line')
          .attr('class', 'link')
          .attr('stroke', '#999')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0)
          .call(enter => enter.transition(transition as any)
            .attr('stroke-opacity', 0.6)
          ),
        update => update,
        exit => exit
          .call(exit => exit.transition(transition as any)
            .attr('stroke-opacity', 0)
            .remove()
          )
      );

    // Update nodes
    this.nodeElements = this.nodeElements
      .data(this.nodes, (d: D3Node) => d.id)
      .join(
        enter => {
          const nodeGroup = enter.append('g')
            .attr('class', 'node')
            .attr('opacity', 0)
            .call(this.drag() as any);

          nodeGroup.append('circle')
            .attr('r', 0)
            .attr('fill', d => this.getNodeColor(d.type))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          nodeGroup.append('text')
            .attr('dy', 30)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(d => d.label.substring(0, 20));

          return nodeGroup
            .call(enter => enter.transition(transition as any)
              .attr('opacity', 1)
              .select('circle')
              .attr('r', 20)
            );
        },
        update => update,
        exit => exit
          .call(exit => exit.transition(transition as any)
            .attr('opacity', 0)
            .select('circle')
            .attr('r', 0)
            .end()
            .then(() => exit.remove())
          )
      );

    // Update simulation
    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<D3Node, D3Link>).links(this.links);

    if (animate) {
      this.simulation.alpha(0.3).restart();
    }

    // Update positions on tick
    this.simulation.on('tick', () => {
      this.linkElements
        .attr('x1', d => (d.source as D3Node).x || 0)
        .attr('y1', d => (d.source as D3Node).y || 0)
        .attr('x2', d => (d.target as D3Node).x || 0)
        .attr('y2', d => (d.target as D3Node).y || 0);

      this.nodeElements
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });
  }

  /**
   * Highlight a node with pulse animation
   */
  private highlightNode(nodeId: string): void {
    this.nodeElements
      .filter((d: D3Node) => d.id === nodeId)
      .select('circle')
      .transition()
      .duration(300)
      .attr('r', 30)
      .attr('fill', '#10b981')
      .transition()
      .duration(300)
      .attr('r', 20)
      .attr('fill', d => this.getNodeColor(d.type));
  }

  /**
   * Highlight an edge with pulse animation
   */
  private highlightEdge(edgeId: string): void {
    this.linkElements
      .filter((d: D3Link) => d.id === edgeId)
      .transition()
      .duration(300)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 4)
      .transition()
      .duration(300)
      .attr('stroke', '#999')
      .attr('stroke-width', 2);
  }

  /**
   * Get node color based on type
   */
  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      conversation: '#3b82f6',
      code: '#10b981',
      document: '#f59e0b',
      file: '#8b5cf6',
      component: '#ec4899',
      function: '#06b6d4',
      class: '#f43f5e'
    };
    return colors[type] || '#6b7280';
  }

  /**
   * Setup drag behavior for nodes
   */
  private drag(): d3.DragBehavior<SVGGElement, D3Node, D3Node | d3.SubjectPosition> {
    return d3.drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  /**
   * Center view on a specific node
   */
  centerOnNode(nodeId: string): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.x || !node.y) return;

    const svgNode = this.svg.node();
    if (!svgNode) return;

    const bbox = svgNode.getBoundingClientRect();
    const centerX = bbox.width / 2;
    const centerY = bbox.height / 2;

    const transform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(1)
      .translate(-node.x, -node.y);

    this.svg.transition()
      .duration(750)
      .call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
  }

  /**
   * Fit graph to view
   */
  fitToView(): void {
    const svgNode = this.svg.node();
    if (!svgNode) return;

    const bbox = this.g.node()?.getBBox();
    if (!bbox) return;

    const width = svgNode.clientWidth;
    const height = svgNode.clientHeight;

    const scale = Math.min(
      width / bbox.width,
      height / bbox.height,
      2
    ) * 0.9;

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2));

    this.svg.transition()
      .duration(750)
      .call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
  }

  /**
   * Destroy the animation system
   */
  destroy(): void {
    this.simulation.stop();
    this.svg.selectAll('*').remove();
  }
}

/**
 * Utility functions for graph animations
 */
export const GraphAnimationUtils = {
  /**
   * Create smooth transition for adding multiple nodes
   */
  batchAddNodes: (
    animation: GraphAnimations,
    nodes: AnyGraphNode[],
    delayMs: number = 100
  ): Promise<void> => {
    return new Promise((resolve) => {
      let index = 0;

      const addNext = () => {
        if (index < nodes.length) {
          animation.addNode(nodes[index]);
          index++;
          setTimeout(addNext, delayMs);
        } else {
          resolve();
        }
      };

      addNext();
    });
  },

  /**
   * Create smooth transition for adding multiple edges
   */
  batchAddEdges: (
    animation: GraphAnimations,
    edges: GraphEdge[],
    delayMs: number = 100
  ): Promise<void> => {
    return new Promise((resolve) => {
      let index = 0;

      const addNext = () => {
        if (index < edges.length) {
          animation.addEdge(edges[index]);
          index++;
          setTimeout(addNext, delayMs);
        } else {
          resolve();
        }
      };

      addNext();
    });
  }
};