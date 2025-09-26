import { ExecutorContext } from '@nx/devkit';
import { ReactProjectGraphProcessor } from '../../graph/project-graph-processor';
import { ReactDataFlowAnalyzer } from '../../analyzers';

export interface VisualizeComponentsExecutorSchema {
  projectRoot: string;
  outputPath: string;
  format?: 'html' | 'json' | 'svg';
}

export default async function runExecutor(
  options: VisualizeComponentsExecutorSchema,
  context: ExecutorContext
) {
  const processor = new ReactProjectGraphProcessor();
  const dataFlowAnalyzer = new ReactDataFlowAnalyzer();

  try {
    const projectName = context.projectName!;
    const projectRoot = options.projectRoot;
    const format = options.format || 'html';

    console.log(`🎨 Generating component visualization for ${projectName}...`);

    const analysis = await processor.processProject(
      projectName,
      projectRoot,
      context as any
    );

    if (!analysis) {
      console.log(`ℹ️  No React components found in ${projectName}`);
      return { success: true };
    }

    // Generate visualization data
    const visualizationData = dataFlowAnalyzer.generateDataFlowGraph({
      stateFlows: analysis.dataFlows.stateFlows,
      propFlows: analysis.dataFlows.propFlows,
      contextFlows: analysis.dataFlows.contextFlows,
      eventFlows: [],
      apiFlows: [],
    });

    // Create output content based on format
    let outputContent: string;
    let fileName: string;

    switch (format) {
      case 'json':
        outputContent = JSON.stringify(visualizationData, null, 2);
        fileName = 'component-graph.json';
        break;

      case 'svg':
        outputContent = generateSVG(visualizationData);
        fileName = 'component-graph.svg';
        break;

      case 'html':
      default:
        outputContent = generateHTML(visualizationData, projectName);
        fileName = 'component-visualization.html';
        break;
    }

    // Save visualization
    const fs = require('fs');
    const path = require('path');

    const outputDir = path.dirname(options.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    const fullOutputPath = path.join(outputDir, fileName);
    fs.writeFileSync(fullOutputPath, outputContent);

    console.log(`✅ Component visualization generated:`);
    console.log(`   📊 Nodes: ${visualizationData.nodes.length}`);
    console.log(`   🔗 Edges: ${visualizationData.edges.length}`);
    console.log(`   💾 Saved to: ${fullOutputPath}`);

    return {
      success: true,
      outputPath: fullOutputPath,
      visualizationData,
    };
  } catch (error) {
    console.error(`❌ Failed to generate component visualization:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function generateHTML(
  data: { nodes: any[]; edges: any[] },
  projectName: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React Components - ${projectName}</title>
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h1 {
            color: #333;
            margin: 0;
        }

        .header p {
            color: #666;
            margin: 5px 0;
        }

        #network {
            width: 100%;
            height: 600px;
            border: 1px solid #ddd;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 20px;
        }

        .stat {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2196F3;
        }

        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }

        .legend {
            margin-top: 20px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .legend h3 {
            margin-top: 0;
            color: #333;
        }

        .legend-item {
            display: inline-block;
            margin-right: 20px;
            margin-bottom: 5px;
        }

        .legend-color {
            display: inline-block;
            width: 12px;
            height: 12px;
            margin-right: 5px;
            border-radius: 50%;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>React Component Visualization</h1>
        <p>Project: <strong>${projectName}</strong></p>
        <p>Generated by Grafity React Analyzer</p>
    </div>

    <div id="network"></div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${data.nodes.length}</div>
            <div class="stat-label">Components</div>
        </div>
        <div class="stat">
            <div class="stat-value">${data.edges.length}</div>
            <div class="stat-label">Connections</div>
        </div>
        <div class="stat">
            <div class="stat-value">${data.edges.filter(e => e.type === 'passes_prop').length}</div>
            <div class="stat-label">Prop Flows</div>
        </div>
        <div class="stat">
            <div class="stat-value">${data.edges.filter(e => e.type === 'provides_context').length}</div>
            <div class="stat-label">Context Flows</div>
        </div>
    </div>

    <div class="legend">
        <h3>Legend</h3>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #2196F3;"></span>
            Component
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #FF9800;"></span>
            State
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #4CAF50;"></span>
            API
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background-color: #E91E63;"></span>
            Context
        </div>
    </div>

    <script>
        const nodes = new vis.DataSet(${JSON.stringify(data.nodes.map(node => ({
          id: node.id,
          label: node.label,
          color: getNodeColor(node.type),
          font: { color: '#333' },
        })))});

        const edges = new vis.DataSet(${JSON.stringify(data.edges.map(edge => ({
          from: edge.from,
          to: edge.to,
          label: edge.label || '',
          color: getEdgeColor(edge.type),
          arrows: 'to',
        })))});

        const container = document.getElementById('network');
        const graphData = { nodes, edges };

        const options = {
            layout: {
                improvedLayout: true,
                hierarchical: {
                    enabled: false
                }
            },
            physics: {
                enabled: true,
                stabilization: { iterations: 100 }
            },
            nodes: {
                shape: 'dot',
                size: 16,
                font: {
                    size: 12,
                    face: 'Arial'
                },
                borderWidth: 2
            },
            edges: {
                width: 2,
                font: {
                    size: 11,
                    face: 'Arial'
                },
                smooth: {
                    type: 'continuous'
                }
            },
            interaction: {
                hover: true
            }
        };

        const network = new vis.Network(container, graphData, options);

        function getNodeColor(type) {
            switch (type) {
                case 'state': return '#FF9800';
                case 'api': return '#4CAF50';
                case 'context': return '#E91E63';
                default: return '#2196F3';
            }
        }

        function getEdgeColor(type) {
            switch (type) {
                case 'passes_prop': return '#2196F3';
                case 'provides_context': return '#E91E63';
                case 'reads': return '#4CAF50';
                case 'writes': return '#FF5722';
                default: return '#999';
            }
        }

        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = nodes.get(nodeId);
                console.log('Selected node:', node);
            }
        });
    </script>
</body>
</html>`;
}

function generateSVG(data: { nodes: any[]; edges: any[] }): string {
  // Simple SVG generation - in a real implementation, you'd use a proper layout algorithm
  const width = 800;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>`;

  // Position nodes in a circle
  data.nodes.forEach((node, index) => {
    const angle = (index / data.nodes.length) * 2 * Math.PI;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    svg += `
    <circle cx="${x}" cy="${y}" r="20" fill="#2196F3" stroke="#1976D2" stroke-width="2"/>
    <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Arial" font-size="10" fill="white">
      ${node.label.substring(0, 8)}${node.label.length > 8 ? '...' : ''}
    </text>`;
  });

  svg += '</svg>';
  return svg;
}