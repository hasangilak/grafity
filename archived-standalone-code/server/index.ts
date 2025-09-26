import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { GraphGenerator } from '../core/graph/graph-generator';
import { DataFlowAnalyzer } from '../core/analysis/data-flow-analyzer';
import { ExportManager } from '../utils/export';
import { ProjectGraph, VisualizationConfig } from '../types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Global instances
let currentGraph: ProjectGraph | null = null;
const dataFlowAnalyzer = new DataFlowAnalyzer();
const exportManager = new ExportManager();

// Routes
app.post('/api/analyze', async (req, res) => {
  try {
    const { projectPath, options } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    console.log(`Analyzing project at: ${projectPath}`);

    const graphGenerator = new GraphGenerator(options);
    const graph = await graphGenerator.generateProjectGraph(projectPath);

    currentGraph = graph;

    // Generate data flow analysis
    const dataFlowAnalysis = dataFlowAnalyzer.analyze(
      graph.components,
      graph.functions
    );

    const response = {
      graph,
      dataFlowAnalysis,
      metadata: {
        analyzedAt: new Date(),
        totalFiles: graph.files.length,
        totalComponents: graph.components.length,
        totalFunctions: graph.functions.length,
        totalDependencies: graph.dependencies.edges.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/graph', (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  res.json(currentGraph);
});

app.get('/api/graph/filtered', (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  const filters = {
    fileTypes: req.query.fileTypes ? (req.query.fileTypes as string).split(',') : undefined,
    componentTypes: req.query.componentTypes ? (req.query.componentTypes as string).split(',') : undefined,
    includeTests: req.query.includeTests === 'true',
    includeNodeModules: req.query.includeNodeModules === 'true'
  };

  const graphGenerator = new GraphGenerator();
  const filteredGraph = graphGenerator.filterGraph(currentGraph, filters);

  res.json(filteredGraph);
});

app.get('/api/components', (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  const componentType = req.query.type as string;

  let components = currentGraph.components;

  if (componentType) {
    components = components.filter(c => c.type === componentType);
  }

  res.json(components);
});

app.get('/api/dependencies', (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  const includeExternal = req.query.includeExternal === 'true';

  let dependencies = currentGraph.dependencies;

  if (!includeExternal) {
    // Filter out external dependencies (simplified)
    dependencies = {
      nodes: dependencies.nodes.filter(node => !node.id.includes('node_modules')),
      edges: dependencies.edges.filter(edge =>
        !edge.from.includes('node_modules') && !edge.to.includes('node_modules')
      )
    };
  }

  res.json(dependencies);
});

app.get('/api/dataflow', async (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  try {
    const dataFlowAnalysis = dataFlowAnalyzer.analyze(
      currentGraph.components,
      currentGraph.functions
    );

    const dataFlowGraph = dataFlowAnalyzer.generateDataFlowGraph(dataFlowAnalysis);

    res.json({
      analysis: dataFlowAnalysis,
      graph: dataFlowGraph
    });
  } catch (error) {
    console.error('Data flow analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate data flow analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/export', async (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  const { format, config } = req.body as { format: string, config?: VisualizationConfig };

  try {
    switch (format) {
      case 'json':
        res.setHeader('Content-Disposition', 'attachment; filename="project-graph.json"');
        res.setHeader('Content-Type', 'application/json');
        res.json(currentGraph);
        break;

      case 'dot':
        const dotContent = generateDotFormat(currentGraph);
        res.setHeader('Content-Disposition', 'attachment; filename="project-graph.dot"');
        res.setHeader('Content-Type', 'text/plain');
        res.send(dotContent);
        break;

      case 'csv':
        const tempDir = path.join(process.cwd(), 'temp');
        const csvFile = path.join(tempDir, 'export.csv');
        await exportManager.exportToCsv(currentGraph, csvFile);
        res.download(csvFile, 'project-analysis.csv');
        break;

      case 'markdown':
        const tempDirMd = path.join(process.cwd(), 'temp');
        const mdFile = path.join(tempDirMd, 'export.md');
        await exportManager.exportToMarkdown(currentGraph, mdFile);
        res.download(mdFile, 'project-analysis.md');
        break;

      default:
        res.status(400).json({ error: 'Unsupported export format. Supported: json, dot, csv, markdown' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Failed to export graph',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk export endpoint
app.post('/api/export/bulk', async (req, res) => {
  if (!currentGraph) {
    return res.status(404).json({ error: 'No graph available. Run analysis first.' });
  }

  const { formats = ['json', 'dot', 'csv', 'markdown'], config } = req.body as {
    formats?: string[],
    config?: VisualizationConfig
  };

  try {
    const tempDir = path.join(process.cwd(), 'temp', `export-${Date.now()}`);
    await exportManager.exportMultipleFormats(currentGraph, tempDir, formats, config);

    res.json({
      message: 'Export completed successfully',
      outputDirectory: tempDir,
      formats: formats,
      files: formats.map(format => `project-analysis-*.${format === 'markdown' ? 'md' : format}`)
    });
  } catch (error) {
    console.error('Bulk export error:', error);
    res.status(500).json({
      error: 'Failed to export graph in multiple formats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    hasGraph: !!currentGraph
  });
});

// Utility function to generate DOT format
function generateDotFormat(graph: ProjectGraph): string {
  let dot = 'digraph ProjectGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box];\n\n';

  // Add nodes
  graph.dependencies.nodes.forEach(node => {
    const label = node.label.replace(/"/g, '\\"');
    const shape = node.type === 'component' ? 'ellipse' : 'box';
    const color = node.type === 'component' ? 'lightblue' : 'lightgray';
    dot += `  "${node.id}" [label="${label}", shape=${shape}, fillcolor=${color}, style=filled];\n`;
  });

  dot += '\n';

  // Add edges
  graph.dependencies.edges.forEach(edge => {
    const label = edge.type;
    const style = edge.type === 'imports' ? 'solid' : 'dashed';
    dot += `  "${edge.from}" -> "${edge.to}" [label="${label}", style=${style}];\n`;
  });

  dot += '}';
  return dot;
}

app.listen(PORT, () => {
  console.log(`🚀 Grafity server running on http://localhost:${PORT}`);
  console.log('📊 Ready to analyze code and generate visualizations');
});