import * as fs from 'fs';
import * as path from 'path';
import { ProjectGraph, DependencyNode, DependencyEdge, VisualizationConfig } from '../types';

export class ExportManager {

  public async exportToJson(graph: ProjectGraph, filePath: string): Promise<void> {
    const jsonData = JSON.stringify(graph, null, 2);
    await fs.promises.writeFile(filePath, jsonData, 'utf-8');
  }

  public async exportToDot(graph: ProjectGraph, filePath: string, config?: VisualizationConfig): Promise<void> {
    const dotContent = this.generateDotContent(graph, config);
    await fs.promises.writeFile(filePath, dotContent, 'utf-8');
  }

  public async exportToCsv(graph: ProjectGraph, filePath: string): Promise<void> {
    const csvContent = this.generateCsvContent(graph);
    await fs.promises.writeFile(filePath, csvContent, 'utf-8');
  }

  public async exportToMarkdown(graph: ProjectGraph, filePath: string): Promise<void> {
    const markdownContent = this.generateMarkdownReport(graph);
    await fs.promises.writeFile(filePath, markdownContent, 'utf-8');
  }

  private generateDotContent(graph: ProjectGraph, config?: VisualizationConfig): string {
    const { showLabels = true, colorScheme = 'default', clustering = false } = config || {};

    let dot = 'digraph ProjectGraph {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=filled];\n';
    dot += '  edge [fontsize=10];\n\n';

    // Add subgraphs for clustering if enabled
    if (clustering) {
      const fileGroups = new Map<string, DependencyNode[]>();

      graph.dependencies.nodes.forEach(node => {
        const dir = path.dirname(node.filePath);
        if (!fileGroups.has(dir)) {
          fileGroups.set(dir, []);
        }
        fileGroups.get(dir)!.push(node);
      });

      let clusterIndex = 0;
      fileGroups.forEach((nodes, dir) => {
        if (nodes.length > 1) {
          dot += `  subgraph cluster_${clusterIndex} {\n`;
          dot += `    label="${path.basename(dir)}";\n`;
          dot += `    color=lightgray;\n`;

          nodes.forEach(node => {
            const color = this.getNodeColor(node.type, colorScheme);
            const label = showLabels ? node.label.replace(/"/g, '\\"') : '';
            dot += `    "${node.id}" [label="${label}", fillcolor="${color}"];\n`;
          });

          dot += '  }\n\n';
          clusterIndex++;
        }
      });

      // Add standalone nodes
      graph.dependencies.nodes
        .filter(node => {
          const dir = path.dirname(node.filePath);
          return !fileGroups.has(dir) || fileGroups.get(dir)!.length === 1;
        })
        .forEach(node => {
          const color = this.getNodeColor(node.type, colorScheme);
          const label = showLabels ? node.label.replace(/"/g, '\\"') : '';
          dot += `  "${node.id}" [label="${label}", fillcolor="${color}"];\n`;
        });
    } else {
      // Add all nodes without clustering
      graph.dependencies.nodes.forEach(node => {
        const color = this.getNodeColor(node.type, colorScheme);
        const label = showLabels ? node.label.replace(/"/g, '\\"') : '';
        const shape = node.type === 'component' ? 'ellipse' : 'box';
        dot += `  "${node.id}" [label="${label}", fillcolor="${color}", shape=${shape}];\n`;
      });
    }

    dot += '\n  // Edges\n';

    // Add edges
    graph.dependencies.edges.forEach(edge => {
      const style = this.getEdgeStyle(edge.type);
      const color = this.getEdgeColor(edge.type, colorScheme);
      const label = edge.type;

      dot += `  "${edge.from}" -> "${edge.to}" [label="${label}", color="${color}", style=${style}];\n`;
    });

    dot += '}';
    return dot;
  }

  private generateCsvContent(graph: ProjectGraph): string {
    const lines: string[] = [];

    // Dependencies CSV
    lines.push('Type,From,To,Relationship,Weight');
    graph.dependencies.edges.forEach(edge => {
      const fromNode = graph.dependencies.nodes.find(n => n.id === edge.from);
      const toNode = graph.dependencies.nodes.find(n => n.id === edge.to);

      lines.push([
        'dependency',
        fromNode?.label || edge.from,
        toNode?.label || edge.to,
        edge.type,
        edge.weight.toString()
      ].join(','));
    });

    // Components CSV
    lines.push('\nType,Name,FilePath,ComponentType,PropsCount,HooksCount');
    graph.components.forEach(component => {
      lines.push([
        'component',
        component.name,
        component.filePath,
        component.type,
        component.props.length.toString(),
        component.hooks.length.toString()
      ].join(','));
    });

    // Functions CSV
    lines.push('\nType,Name,FilePath,IsAsync,IsExported,ParameterCount,CallsCount');
    graph.functions.forEach(func => {
      lines.push([
        'function',
        func.name,
        func.filePath,
        func.isAsync.toString(),
        func.isExported.toString(),
        func.parameters.length.toString(),
        func.calls.length.toString()
      ].join(','));
    });

    return lines.join('\n');
  }

  private generateMarkdownReport(graph: ProjectGraph): string {
    const md: string[] = [];

    md.push('# Project Analysis Report\n');
    md.push(`**Generated on:** ${new Date().toISOString()}\n`);

    // Overview
    md.push('## Overview\n');
    md.push(`- **Total Files:** ${graph.files.length}`);
    md.push(`- **Total Components:** ${graph.components.length}`);
    md.push(`- **Total Functions:** ${graph.functions.length}`);
    md.push(`- **Total Dependencies:** ${graph.dependencies.edges.length}`);
    md.push(`- **User Journeys:** ${graph.userJourneys.length}\n`);

    // File Statistics
    const filesByExtension = graph.files.reduce((acc, file) => {
      acc[file.extension] = (acc[file.extension] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    md.push('## File Types\n');
    md.push('| Extension | Count |');
    md.push('|-----------|-------|');
    Object.entries(filesByExtension).forEach(([ext, count]) => {
      md.push(`| ${ext} | ${count} |`);
    });
    md.push('');

    // Component Analysis
    md.push('## Components\n');

    const componentsByType = graph.components.reduce((acc, comp) => {
      acc[comp.type] = (acc[comp.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    md.push('### Component Types\n');
    md.push('| Type | Count |');
    md.push('|------|-------|');
    Object.entries(componentsByType).forEach(([type, count]) => {
      md.push(`| ${type} | ${count} |`);
    });
    md.push('');

    // Top components by complexity
    const topComponents = graph.components
      .sort((a, b) => (b.props.length + b.hooks.length) - (a.props.length + a.hooks.length))
      .slice(0, 10);

    md.push('### Most Complex Components\n');
    md.push('| Component | Props | Hooks | Type | File |');
    md.push('|-----------|-------|-------|------|------|');
    topComponents.forEach(comp => {
      const fileName = path.basename(comp.filePath);
      md.push(`| ${comp.name} | ${comp.props.length} | ${comp.hooks.length} | ${comp.type} | ${fileName} |`);
    });
    md.push('');

    // Function Analysis
    const asyncFunctions = graph.functions.filter(f => f.isAsync).length;
    const exportedFunctions = graph.functions.filter(f => f.isExported).length;

    md.push('## Functions\n');
    md.push(`- **Total Functions:** ${graph.functions.length}`);
    md.push(`- **Async Functions:** ${asyncFunctions}`);
    md.push(`- **Exported Functions:** ${exportedFunctions}\n`);

    // Most called functions
    const functionCallCounts = new Map<string, number>();
    graph.functions.forEach(func => {
      func.calls.forEach(call => {
        functionCallCounts.set(call.name, (functionCallCounts.get(call.name) || 0) + 1);
      });
    });

    const topCalledFunctions = Array.from(functionCallCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    if (topCalledFunctions.length > 0) {
      md.push('### Most Called Functions\n');
      md.push('| Function | Call Count |');
      md.push('|----------|------------|');
      topCalledFunctions.forEach(([name, count]) => {
        md.push(`| ${name} | ${count} |`);
      });
      md.push('');
    }

    // User Journeys
    if (graph.userJourneys.length > 0) {
      md.push('## User Journeys\n');
      graph.userJourneys.forEach(journey => {
        md.push(`### ${journey.name}\n`);
        md.push(`**Steps:** ${journey.steps.length}\n`);
        md.push('**Flow:**\n');
        journey.steps.forEach((step, index) => {
          md.push(`${index + 1}. **${step.type}** - ${step.description}`);
        });
        md.push('');
      });
    }

    // Dependency Analysis
    const dependencyTypes = graph.dependencies.edges.reduce((acc, edge) => {
      acc[edge.type] = (acc[edge.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    md.push('## Dependencies\n');
    md.push('### Dependency Types\n');
    md.push('| Type | Count |');
    md.push('|------|-------|');
    Object.entries(dependencyTypes).forEach(([type, count]) => {
      md.push(`| ${type} | ${count} |`);
    });
    md.push('');

    return md.join('\n');
  }

  private getNodeColor(nodeType: string, colorScheme: string): string {
    const schemes: Record<string, Record<string, string>> = {
      default: {
        component: '#4CAF50',
        function: '#2196F3',
        file: '#FF9800',
        hook: '#9C27B0'
      },
      pastel: {
        component: '#81C784',
        function: '#64B5F6',
        file: '#FFB74D',
        hook: '#BA68C8'
      },
      dark: {
        component: '#388E3C',
        function: '#1976D2',
        file: '#F57C00',
        hook: '#7B1FA2'
      }
    };

    return schemes[colorScheme]?.[nodeType] || schemes.default[nodeType] || '#757575';
  }

  private getEdgeColor(edgeType: string, colorScheme: string): string {
    const schemes: Record<string, Record<string, string>> = {
      default: {
        imports: '#666666',
        calls: '#2196F3',
        renders: '#4CAF50',
        passes_props: '#FF5722'
      }
    };

    return schemes[colorScheme]?.[edgeType] || schemes.default[edgeType] || '#999999';
  }

  private getEdgeStyle(edgeType: string): string {
    switch (edgeType) {
      case 'imports':
        return 'solid';
      case 'calls':
        return 'dashed';
      case 'renders':
        return 'bold';
      case 'passes_props':
        return 'dotted';
      default:
        return 'solid';
    }
  }

  public async exportMultipleFormats(
    graph: ProjectGraph,
    outputDir: string,
    formats: string[] = ['json', 'dot', 'csv', 'markdown'],
    config?: VisualizationConfig
  ): Promise<void> {
    // Ensure output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `project-analysis-${timestamp}`;

    const exports: Promise<void>[] = [];

    if (formats.includes('json')) {
      exports.push(
        this.exportToJson(graph, path.join(outputDir, `${baseFileName}.json`))
      );
    }

    if (formats.includes('dot')) {
      exports.push(
        this.exportToDot(graph, path.join(outputDir, `${baseFileName}.dot`), config)
      );
    }

    if (formats.includes('csv')) {
      exports.push(
        this.exportToCsv(graph, path.join(outputDir, `${baseFileName}.csv`))
      );
    }

    if (formats.includes('markdown')) {
      exports.push(
        this.exportToMarkdown(graph, path.join(outputDir, `${baseFileName}.md`))
      );
    }

    await Promise.all(exports);
  }
}