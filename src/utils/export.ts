import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectGraph,
  DependencyNode,
  DependencyEdge,
  VisualizationConfig,
  SemanticData,
  BusinessContext,
  AIMetrics,
  FeatureVector,
  ComponentInfo,
  FunctionInfo
} from '../types';

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

  // AI-Enhanced Export Methods

  public async exportForLLM(graph: ProjectGraph, filePath: string): Promise<void> {
    const llmFormat = this.generateLLMOptimizedFormat(graph);
    await fs.promises.writeFile(filePath, llmFormat, 'utf-8');
  }

  public async exportForGNN(graph: ProjectGraph, filePath: string): Promise<void> {
    const gnnData = this.generateGNNFormat(graph);
    await fs.promises.writeFile(filePath, JSON.stringify(gnnData, null, 2), 'utf-8');
  }

  public async exportEmbeddings(graph: ProjectGraph, filePath: string): Promise<void> {
    const embeddings = this.generateEmbeddingsFormat(graph);
    await fs.promises.writeFile(filePath, JSON.stringify(embeddings, null, 2), 'utf-8');
  }

  public async exportSemanticAnnotations(graph: ProjectGraph, filePath: string): Promise<void> {
    const semanticData = this.generateSemanticAnnotationsFormat(graph);
    await fs.promises.writeFile(filePath, JSON.stringify(semanticData, null, 2), 'utf-8');
  }

  public async exportBusinessContext(graph: ProjectGraph, filePath: string): Promise<void> {
    const businessData = this.generateBusinessContextFormat(graph);
    await fs.promises.writeFile(filePath, businessData, 'utf-8');
  }

  public async exportTrainingData(graph: ProjectGraph, outputDir: string): Promise<void> {
    await fs.promises.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Export multiple training formats
    const exports: Promise<void>[] = [
      this.exportForLLM(graph, path.join(outputDir, `llm-training-${timestamp}.txt`)),
      this.exportForGNN(graph, path.join(outputDir, `gnn-training-${timestamp}.json`)),
      this.exportEmbeddings(graph, path.join(outputDir, `embeddings-${timestamp}.json`)),
      this.exportSemanticAnnotations(graph, path.join(outputDir, `semantic-${timestamp}.json`)),
      this.exportBusinessContext(graph, path.join(outputDir, `business-context-${timestamp}.md`))
    ];

    await Promise.all(exports);
  }

  private generateLLMOptimizedFormat(graph: ProjectGraph): string {
    const sections: string[] = [];

    // Project Overview Section
    sections.push('# Project Architecture Analysis');
    sections.push('');
    sections.push('## Overview');
    sections.push(`This project contains ${graph.components.length} components and ${graph.functions.length} functions.`);
    sections.push('');

    // Semantic Patterns Section
    if (graph.semanticData?.architecturalPatterns) {
      sections.push('## Architectural Patterns Detected');
      graph.semanticData.architecturalPatterns.forEach(pattern => {
        sections.push(`### ${pattern.name} (Confidence: ${Math.round(pattern.confidence * 100)}%)`);
        sections.push(pattern.description);
        sections.push(`**Components**: ${pattern.components.join(', ')}`);
        sections.push(`**Benefits**: ${pattern.benefits.join('; ')}`);
        if (pattern.considerations.length > 0) {
          sections.push(`**Considerations**: ${pattern.considerations.join('; ')}`);
        }
        sections.push('');
      });
    }

    // Component Descriptions
    sections.push('## Component Analysis');
    graph.components.forEach(component => {
      sections.push(`### ${component.name}`);
      sections.push(`**Type**: ${component.type} component`);
      sections.push(`**File**: ${component.filePath}`);

      if (component.props.length > 0) {
        sections.push(`**Props**: ${component.props.map(p => `${p.name}${p.isRequired ? ' (required)' : ''}`).join(', ')}`);
      }

      if (component.hooks.length > 0) {
        sections.push(`**Hooks**: ${component.hooks.map(h => h.name).join(', ')}`);
      }

      if (component.children.length > 0) {
        sections.push(`**Child Components**: ${component.children.map(c => c.name).join(', ')}`);
      }
      sections.push('');
    });

    // Data Flow Analysis
    if (graph.dataFlows.length > 0) {
      sections.push('## Data Flow Patterns');
      const flowsByType = graph.dataFlows.reduce((acc, flow) => {
        if (!acc[flow.type]) acc[flow.type] = [];
        acc[flow.type].push(flow);
        return acc;
      }, {} as Record<string, typeof graph.dataFlows>);

      Object.entries(flowsByType).forEach(([type, flows]) => {
        sections.push(`### ${type.toUpperCase()} Flows`);
        flows.forEach(flow => {
          sections.push(`- ${flow.from} → ${flow.to}`);
        });
        sections.push('');
      });
    }

    // Business Context
    if (graph.businessContext?.userPersonas) {
      sections.push('## Business Context');
      sections.push('### User Personas');
      graph.businessContext.userPersonas.forEach(persona => {
        sections.push(`**${persona.name}** (${persona.role}): ${persona.goals.join(', ')}`);
      });
      sections.push('');
    }

    // Quality Assessment
    if (graph.semanticData?.qualityIndicators) {
      const quality = graph.semanticData.qualityIndicators;
      sections.push('## Quality Assessment');
      sections.push(`- **Maintainability**: ${quality.maintainability}/100`);
      sections.push(`- **Reliability**: ${quality.reliability}/100`);
      sections.push(`- **Security**: ${quality.security}/100`);
      if (quality.testCoverage !== undefined) {
        sections.push(`- **Test Coverage**: ${quality.testCoverage}/100`);
      }
      sections.push(`- **Documentation**: ${quality.documentation}/100`);
      sections.push('');
    }

    return sections.join('\n');
  }

  private generateGNNFormat(graph: ProjectGraph) {
    // Generate Graph Neural Network compatible format
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeFeatures: number[][] = [];

    // Create node mappings
    const nodeIdMap = new Map<string, number>();
    let nodeIndex = 0;

    // Add component nodes
    graph.components.forEach(component => {
      const id = nodeIndex++;
      nodeIdMap.set(`component:${component.name}`, id);

      nodes.push({
        id,
        type: 'component',
        label: component.name,
        component_type: component.type,
        props_count: component.props.length,
        hooks_count: component.hooks.length,
        children_count: component.children.length
      });

      // Generate feature vector for this component
      const features = this.generateNodeFeatures(component, graph);
      nodeFeatures.push(features);
    });

    // Add function nodes
    graph.functions.forEach(func => {
      const id = nodeIndex++;
      nodeIdMap.set(`function:${func.name}`, id);

      nodes.push({
        id,
        type: 'function',
        label: func.name,
        is_async: func.isAsync,
        is_exported: func.isExported,
        params_count: func.parameters.length,
        calls_count: func.calls.length
      });

      const features = this.generateFunctionFeatures(func, graph);
      nodeFeatures.push(features);
    });

    // Generate edges from dependency graph
    graph.dependencies.edges.forEach(edge => {
      const sourceId = this.findNodeId(edge.from, nodeIdMap);
      const targetId = this.findNodeId(edge.to, nodeIdMap);

      if (sourceId !== -1 && targetId !== -1) {
        edges.push({
          source: sourceId,
          target: targetId,
          type: edge.type,
          weight: edge.weight
        });
      }
    });

    // Add adjacency matrix
    const adjacencyMatrix = this.generateAdjacencyMatrix(nodes.length, edges);

    return {
      metadata: {
        num_nodes: nodes.length,
        num_edges: edges.length,
        node_types: [...new Set(nodes.map(n => n.type))],
        edge_types: [...new Set(edges.map(e => e.type))]
      },
      nodes,
      edges,
      node_features: nodeFeatures,
      adjacency_matrix: adjacencyMatrix,
      graph_level_features: this.generateGraphLevelFeatures(graph)
    };
  }

  private generateEmbeddingsFormat(graph: ProjectGraph) {
    const componentEmbeddings: Record<string, number[]> = {};
    const functionEmbeddings: Record<string, number[]> = {};

    // Generate simple embeddings based on component characteristics
    graph.components.forEach(component => {
      const embedding = this.generateComponentEmbedding(component, graph);
      componentEmbeddings[component.name] = embedding;
    });

    graph.functions.forEach(func => {
      const embedding = this.generateFunctionEmbedding(func, graph);
      functionEmbeddings[func.name] = embedding;
    });

    return {
      embedding_dimension: 128, // Standard embedding size
      component_embeddings: componentEmbeddings,
      function_embeddings: functionEmbeddings,
      similarity_matrix: this.generateSimilarityMatrix(Object.values(componentEmbeddings)),
      metadata: {
        generation_method: 'feature_based',
        features_included: [
          'complexity', 'coupling', 'cohesion', 'business_value',
          'change_frequency', 'test_coverage', 'documentation'
        ]
      }
    };
  }

  private generateSemanticAnnotationsFormat(graph: ProjectGraph) {
    return {
      architectural_patterns: graph.semanticData?.architecturalPatterns || [],
      anti_patterns: graph.semanticData?.antiPatterns || [],
      business_domains: graph.semanticData?.businessDomains || [],
      complexity_metrics: graph.semanticData?.complexityMetrics || {},
      quality_indicators: graph.semanticData?.qualityIndicators || {},
      component_classifications: this.classifyComponents(graph),
      dependency_analysis: this.analyzeDependencyPatterns(graph),
      refactoring_opportunities: this.identifyRefactoringOpportunities(graph)
    };
  }

  private generateBusinessContextFormat(graph: ProjectGraph): string {
    const sections: string[] = [];

    sections.push('# Business Context Analysis');
    sections.push('');

    if (graph.businessContext?.userPersonas) {
      sections.push('## User Personas');
      graph.businessContext.userPersonas.forEach(persona => {
        sections.push(`### ${persona.name} - ${persona.role}`);
        sections.push(`**Goals**: ${persona.goals.join(', ')}`);
        sections.push(`**Pain Points**: ${persona.painPoints.join(', ')}`);
        sections.push(`**Interacts with**: ${persona.components.join(', ')}`);
        sections.push('');
      });
    }

    if (graph.businessContext?.businessProcesses) {
      sections.push('## Business Processes');
      graph.businessContext.businessProcesses.forEach(process => {
        sections.push(`### ${process.name}`);
        sections.push(process.description);
        sections.push(`**Business Value**: ${process.businessValue}/10`);
        sections.push(`**Frequency**: ${process.frequency}`);
        sections.push(`**Components Involved**: ${process.components.join(', ')}`);

        if (process.steps.length > 0) {
          sections.push('**Process Steps**:');
          process.steps.forEach((step, index) => {
            sections.push(`  ${index + 1}. ${step.name} (${step.actor}): ${step.description}`);
          });
        }
        sections.push('');
      });
    }

    if (graph.userJourneys.length > 0) {
      sections.push('## User Journeys');
      graph.userJourneys.forEach(journey => {
        sections.push(`### ${journey.name}`);
        sections.push(`**Components**: ${journey.components.join(', ')}`);
        sections.push('**Journey Steps**:');
        journey.steps.forEach((step, index) => {
          sections.push(`  ${index + 1}. ${step.type}: ${step.description}`);
        });
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  // Helper methods for AI format generation
  private generateNodeFeatures(component: ComponentInfo, graph: ProjectGraph): number[] {
    // Generate standardized feature vector for components
    return [
      component.props.length,
      component.hooks.length,
      component.children.length,
      component.type === 'function' ? 1 : component.type === 'class' ? 2 : 3,
      // Add more features as needed
    ];
  }

  private generateFunctionFeatures(func: FunctionInfo, graph: ProjectGraph): number[] {
    return [
      func.parameters.length,
      func.calls.length,
      func.isAsync ? 1 : 0,
      func.isExported ? 1 : 0,
      // Add more features as needed
    ];
  }

  private findNodeId(nodeIdentifier: string, nodeIdMap: Map<string, number>): number {
    // Try to find node ID by different possible identifiers
    const possible = [
      nodeIdentifier,
      `component:${nodeIdentifier}`,
      `function:${nodeIdentifier}`
    ];

    for (const identifier of possible) {
      if (nodeIdMap.has(identifier)) {
        return nodeIdMap.get(identifier)!;
      }
    }

    return -1; // Not found
  }

  private generateAdjacencyMatrix(numNodes: number, edges: any[]): number[][] {
    const matrix = Array(numNodes).fill(null).map(() => Array(numNodes).fill(0));

    edges.forEach(edge => {
      matrix[edge.source][edge.target] = edge.weight || 1;
    });

    return matrix;
  }

  private generateGraphLevelFeatures(graph: ProjectGraph): number[] {
    return [
      graph.components.length,
      graph.functions.length,
      graph.dependencies.edges.length,
      graph.dataFlows.length,
      // Add complexity metrics if available
      graph.semanticData?.complexityMetrics.cyclomaticComplexity || 0,
      graph.semanticData?.qualityIndicators.maintainability || 0
    ];
  }

  private generateComponentEmbedding(component: ComponentInfo, graph: ProjectGraph): number[] {
    // Generate a 128-dimensional embedding (simplified)
    const features = this.generateNodeFeatures(component, graph);
    const embedding = new Array(128).fill(0);

    // Map features to embedding space (simplified approach)
    features.forEach((feature, index) => {
      if (index < 128) {
        embedding[index] = feature / 10.0; // Normalize
      }
    });

    return embedding;
  }

  private generateFunctionEmbedding(func: FunctionInfo, graph: ProjectGraph): number[] {
    const features = this.generateFunctionFeatures(func, graph);
    const embedding = new Array(128).fill(0);

    features.forEach((feature, index) => {
      if (index < 128) {
        embedding[index] = feature / 10.0;
      }
    });

    return embedding;
  }

  private generateSimilarityMatrix(embeddings: number[][]): number[][] {
    const n = embeddings.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.cosineSimilarity(embeddings[i], embeddings[j]);
        }
      }
    }

    return matrix;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (magnitudeA * magnitudeB) || 0;
  }

  private classifyComponents(graph: ProjectGraph): Record<string, string> {
    const classifications: Record<string, string> = {};

    graph.components.forEach(component => {
      const name = component.name.toLowerCase();

      if (name.includes('page') || name.includes('screen') || name.includes('view')) {
        classifications[component.name] = 'page';
      } else if (name.includes('form') || name.includes('input')) {
        classifications[component.name] = 'form';
      } else if (name.includes('button') || name.includes('link')) {
        classifications[component.name] = 'interactive';
      } else if (name.includes('modal') || name.includes('dialog')) {
        classifications[component.name] = 'modal';
      } else if (component.children.length > 3) {
        classifications[component.name] = 'container';
      } else {
        classifications[component.name] = 'component';
      }
    });

    return classifications;
  }

  private analyzeDependencyPatterns(graph: ProjectGraph) {
    return {
      circular_dependencies: 0, // Would be calculated by dependency analyzer
      coupling_metrics: {
        high_coupling: graph.dependencies.edges.filter(e => e.weight > 5).length,
        total_edges: graph.dependencies.edges.length
      },
      dependency_depth: this.calculateDependencyDepth(graph),
      common_dependencies: this.findCommonDependencies(graph)
    };
  }

  private identifyRefactoringOpportunities(graph: ProjectGraph) {
    const opportunities = [];

    // Large components that could be split
    const largeComponents = graph.components.filter(c =>
      c.props.length > 10 || c.hooks.length > 5 || c.children.length > 8
    );

    largeComponents.forEach(component => {
      opportunities.push({
        type: 'split_component',
        component: component.name,
        reason: 'Large component with many responsibilities',
        suggested_action: 'Break into smaller, focused components'
      });
    });

    // Functions with many parameters
    const complexFunctions = graph.functions.filter(f => f.parameters.length > 5);
    complexFunctions.forEach(func => {
      opportunities.push({
        type: 'simplify_function',
        component: func.name,
        reason: 'Function has too many parameters',
        suggested_action: 'Use object parameters or break into smaller functions'
      });
    });

    return opportunities;
  }

  private calculateDependencyDepth(graph: ProjectGraph): number {
    // Simplified dependency depth calculation
    return Math.max(3, Math.floor(graph.dependencies.edges.length / graph.components.length));
  }

  private findCommonDependencies(graph: ProjectGraph): string[] {
    const dependencyCounts = new Map<string, number>();

    graph.dependencies.edges.forEach(edge => {
      dependencyCounts.set(edge.to, (dependencyCounts.get(edge.to) || 0) + 1);
    });

    return Array.from(dependencyCounts.entries())
      .filter(([, count]) => count > 3)
      .map(([dep]) => dep);
  }
}