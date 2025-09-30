import { GraphStore } from '../GraphStore';
import { AnyGraphNode } from '../types/NodeTypes';
import { GraphEdge } from '../types/EdgeTypes';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Generates standalone HTML visualization of the graph using D3.js
 */
export class HtmlGraphGenerator {
  private store: GraphStore;

  constructor(store: GraphStore) {
    this.store = store;
  }

  /**
   * Generate complete HTML file with embedded visualization
   */
  async generateHtml(outputPath: string): Promise<void> {
    const html = this.createHtmlContent();
    await fs.writeFile(outputPath, html, 'utf-8');
    console.log(`Graph visualization generated: ${outputPath}`);
  }

  /**
   * Create the complete HTML content
   */
  private createHtmlContent(): string {
    const graphData = this.prepareGraphData();
    const stats = this.store.getStatistics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grafity - Graph Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div id="header">
        <h1>🌐 Grafity Graph Visualization</h1>
        <div id="stats">
            <span class="stat">Nodes: <strong>${stats.totalNodes}</strong></span>
            <span class="stat">Edges: <strong>${stats.totalEdges}</strong></span>
            <span class="stat">Bi-directional: <strong>${stats.bidirectionalEdges}</strong></span>
        </div>
    </div>

    <div id="controls">
        <div class="control-group">
            <label>Node Type Filter:</label>
            <select id="nodeTypeFilter">
                <option value="all">All Types</option>
                <option value="code">Code</option>
                <option value="business">Business</option>
                <option value="document">Document</option>
                <option value="conversation">Conversation</option>
            </select>
        </div>

        <div class="control-group">
            <label>Layout:</label>
            <button onclick="resetSimulation()">Reset Layout</button>
            <button onclick="toggleLabels()">Toggle Labels</button>
        </div>

        <div class="control-group">
            <label>Search:</label>
            <input type="text" id="searchInput" placeholder="Search nodes..." onkeyup="searchNodes(this.value)">
        </div>
    </div>

    <div id="tooltip" class="tooltip"></div>
    <div id="graph-container">
        <svg id="graph"></svg>
    </div>

    <div id="legend">
        <h3>Legend</h3>
        <div class="legend-item">
            <span class="legend-color" style="background: #4CAF50;"></span>
            <span>Code (Component/Function)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: #2196F3;"></span>
            <span>Business (Feature/Story)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: #FF9800;"></span>
            <span>Document</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: #9C27B0;"></span>
            <span>Conversation</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: #666;"></span>
            <span>File/Other</span>
        </div>
    </div>

    <script>
        const graphData = ${JSON.stringify(graphData, null, 2)};
        ${this.getJavaScript()}
    </script>
</body>
</html>`;
  }

  /**
   * Prepare graph data for D3.js
   */
  private prepareGraphData() {
    const nodes = this.store.getAllNodes().map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      description: node.description || '',
      codeType: 'codeType' in node ? node.codeType : undefined,
      filePath: 'filePath' in node ? node.filePath : undefined
    }));

    const links = this.store.getAllEdges().map(edge => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      bidirectional: edge.bidirectional,
      weight: edge.weight || 1
    }));

    return { nodes, links };
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        #header {
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #header h1 {
            font-size: 24px;
            color: #333;
        }

        #stats {
            display: flex;
            gap: 20px;
        }

        .stat {
            color: #666;
            font-size: 14px;
        }

        .stat strong {
            color: #333;
            font-size: 18px;
        }

        #controls {
            background: rgba(255, 255, 255, 0.95);
            padding: 15px 20px;
            display: flex;
            gap: 30px;
            align-items: center;
            border-bottom: 1px solid #ddd;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .control-group label {
            font-size: 14px;
            font-weight: 500;
            color: #666;
        }

        select, input, button {
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            background: white;
        }

        button {
            cursor: pointer;
            background: #667eea;
            color: white;
            border: none;
            transition: background 0.3s;
        }

        button:hover {
            background: #5a67d8;
        }

        #graph-container {
            flex: 1;
            position: relative;
            background: rgba(255, 255, 255, 0.9);
            overflow: hidden;
        }

        #graph {
            width: 100%;
            height: 100%;
        }

        .node {
            cursor: pointer;
            stroke: #fff;
            stroke-width: 2px;
        }

        .node.highlighted {
            stroke: #ff6b6b;
            stroke-width: 4px;
        }

        .node.dimmed {
            opacity: 0.3;
        }

        .link {
            stroke-opacity: 0.6;
            stroke-width: 2px;
        }

        .link.bidirectional {
            stroke-dasharray: 5, 5;
        }

        .link.highlighted {
            stroke-opacity: 1;
            stroke-width: 4px;
        }

        .link.dimmed {
            opacity: 0.1;
        }

        .node-label {
            font-size: 12px;
            font-weight: 500;
            pointer-events: none;
            user-select: none;
        }

        .tooltip {
            position: absolute;
            text-align: left;
            padding: 12px;
            font-size: 13px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 8px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            max-width: 300px;
        }

        .tooltip.show {
            opacity: 1;
        }

        #legend {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        #legend h3 {
            font-size: 14px;
            margin-bottom: 10px;
            color: #666;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 5px;
            font-size: 13px;
        }

        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 50%;
        }
    `;
  }

  /**
   * Get JavaScript code for visualization
   */
  private getJavaScript(): string {
    return `
        // Set up dimensions
        const width = document.getElementById('graph-container').clientWidth;
        const height = document.getElementById('graph-container').clientHeight;

        // Create SVG
        const svg = d3.select('#graph')
            .attr('viewBox', [0, 0, width, height]);

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Create container for zoom/pan
        const container = svg.append('g');

        // Create arrow markers for directed edges
        svg.append('defs').selectAll('marker')
            .data(['arrow'])
            .enter().append('marker')
            .attr('id', d => d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        // Color scale for node types
        const colorScale = {
            'code': '#4CAF50',
            'business': '#2196F3',
            'document': '#FF9800',
            'conversation': '#9C27B0',
            'unknown': '#666'
        };

        // Color scale for code subtypes
        const codeColorScale = {
            'component': '#4CAF50',
            'function': '#8BC34A',
            'class': '#689F38',
            'interface': '#558B2F',
            'type': '#33691E',
            'file': '#827717',
            'variable': '#F57C00'
        };

        // Create simulation
        const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links)
                .id(d => d.id)
                .distance(d => d.bidirectional ? 80 : 120))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Create links
        const link = container.append('g')
            .selectAll('line')
            .data(graphData.links)
            .enter().append('line')
            .attr('class', d => 'link' + (d.bidirectional ? ' bidirectional' : ''))
            .attr('stroke', '#999')
            .attr('marker-end', d => d.bidirectional ? '' : 'url(#arrow)');

        // Create nodes
        const node = container.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                if (d.codeType === 'component') return 12;
                if (d.codeType === 'function') return 10;
                if (d.codeType === 'file') return 8;
                return 10;
            })
            .attr('fill', d => {
                if (d.type === 'code' && d.codeType) {
                    return codeColorScale[d.codeType] || colorScale[d.type];
                }
                return colorScale[d.type] || '#666';
            })
            .call(drag(simulation));

        // Create labels
        const label = container.append('g')
            .selectAll('text')
            .data(graphData.nodes)
            .enter().append('text')
            .attr('class', 'node-label')
            .attr('dx', 15)
            .attr('dy', 4)
            .text(d => d.label)
            .style('font-size', '12px')
            .style('fill', '#333');

        // Tooltip
        const tooltip = d3.select('.tooltip');

        // Node hover interactions
        node.on('mouseover', function(event, d) {
            // Show tooltip
            let tooltipContent = '<strong>' + d.label + '</strong><br/>';
            tooltipContent += 'Type: ' + d.type;
            if (d.codeType) tooltipContent += ' (' + d.codeType + ')';
            tooltipContent += '<br/>';

            // Enhanced tooltip for conversation nodes (messages)
            if (d.type === 'conversation' && d.metadata) {
                // Show message content preview
                const content = d.metadata.content || d.description || '';
                if (content) {
                    const preview = content.substring(0, 100);
                    tooltipContent += '<div style="margin-top: 8px; padding: 6px; background: #f3f4f6; border-radius: 4px; font-size: 11px;">';
                    tooltipContent += preview + (content.length > 100 ? '...' : '');
                    tooltipContent += '</div>';
                }

                // Show metadata
                if (d.metadata.timestamp) {
                    tooltipContent += '<div style="margin-top: 4px; font-size: 11px; color: #6b7280;">⏱️ ' + new Date(d.metadata.timestamp).toLocaleString() + '</div>';
                }

                if (d.metadata.role) {
                    tooltipContent += '<div style="font-size: 11px; color: #6b7280;">👤 Role: ' + d.metadata.role + '</div>';
                }

                // Show connection count
                const connections = graphData.links.filter(link => {
                    const sourceId = link.source.id || link.source;
                    const targetId = link.target.id || link.target;
                    return sourceId === d.id || targetId === d.id;
                });
                tooltipContent += '<div style="font-size: 11px; color: #6b7280;">🔗 ' + connections.length + ' connections</div>';

                tooltipContent += '<div style="margin-top: 4px; font-size: 10px; color: #9ca3af; font-style: italic;">Click to view full message</div>';
            } else {
                // Standard tooltip for non-conversation nodes
                if (d.description) tooltipContent += d.description + '<br/>';
                if (d.filePath) tooltipContent += 'File: ' + d.filePath;
            }

            tooltip.html(tooltipContent)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .style('max-width', '300px')
                .classed('show', true);

            // Highlight connected nodes
            const connectedNodeIds = new Set();
            graphData.links.forEach(link => {
                if (link.source.id === d.id || link.source === d.id) {
                    connectedNodeIds.add(link.target.id || link.target);
                }
                if (link.target.id === d.id || link.target === d.id) {
                    connectedNodeIds.add(link.source.id || link.source);
                }
            });

            node.classed('dimmed', n => n.id !== d.id && !connectedNodeIds.has(n.id))
                .classed('highlighted', n => n.id === d.id);

            link.classed('dimmed', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return sourceId !== d.id && targetId !== d.id;
            })
            .classed('highlighted', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return sourceId === d.id || targetId === d.id;
            });
        })
        .on('mouseout', function() {
            tooltip.classed('show', false);
            node.classed('dimmed', false).classed('highlighted', false);
            link.classed('dimmed', false).classed('highlighted', false);
        })
        .on('click', function(event, d) {
            // Focus on node and its neighbors
            const connectedNodeIds = new Set([d.id]);
            graphData.links.forEach(link => {
                if (link.source.id === d.id || link.source === d.id) {
                    connectedNodeIds.add(link.target.id || link.target);
                }
                if (link.target.id === d.id || link.target === d.id) {
                    connectedNodeIds.add(link.source.id || link.source);
                }
            });

            // Filter visualization to show only connected nodes
            node.style('display', n => connectedNodeIds.has(n.id) ? 'block' : 'none');
            link.style('display', l => {
                const sourceId = l.source.id || l.source;
                const targetId = l.target.id || l.target;
                return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId) ? 'block' : 'none';
            });
            label.style('display', n => connectedNodeIds.has(n.id) ? 'block' : 'none');

            event.stopPropagation();
        });

        // Click on background to reset
        svg.on('click', function() {
            node.style('display', 'block');
            link.style('display', 'block');
            label.style('display', 'block');
        });

        // Update positions on tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Drag behavior
        function drag(simulation) {
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }

            return d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);
        }

        // Control functions
        function resetSimulation() {
            simulation.alpha(1).restart();
        }

        let labelsVisible = true;
        function toggleLabels() {
            labelsVisible = !labelsVisible;
            label.style('display', labelsVisible ? 'block' : 'none');
        }

        function searchNodes(query) {
            if (!query) {
                node.classed('dimmed', false).classed('highlighted', false);
                link.classed('dimmed', false);
                return;
            }

            const lowerQuery = query.toLowerCase();
            node.classed('highlighted', d => d.label.toLowerCase().includes(lowerQuery))
                .classed('dimmed', d => !d.label.toLowerCase().includes(lowerQuery));

            link.classed('dimmed', true);
        }

        // Node type filter
        document.getElementById('nodeTypeFilter').addEventListener('change', function(e) {
            const selectedType = e.target.value;

            if (selectedType === 'all') {
                node.style('display', 'block');
                label.style('display', 'block');
            } else {
                node.style('display', d => d.type === selectedType ? 'block' : 'none');
                label.style('display', d => d.type === selectedType ? 'block' : 'none');
            }

            // Hide links not connected to visible nodes
            link.style('display', l => {
                const sourceVisible = selectedType === 'all' || l.source.type === selectedType;
                const targetVisible = selectedType === 'all' || l.target.type === selectedType;
                return sourceVisible && targetVisible ? 'block' : 'none';
            });
        });
    `;
  }
}