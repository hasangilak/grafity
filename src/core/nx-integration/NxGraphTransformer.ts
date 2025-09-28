import { ProjectGraph, ProjectGraphDependency, ProjectGraphProjectNode } from '@nx/devkit';
import { NxGraphData, NxProjectData } from './NxGraphProcessor';

export interface TransformedNode {
  id: string;
  type: 'project' | 'file' | 'component' | 'function';
  label: string;
  metadata: {
    projectType?: 'application' | 'library';
    framework?: string;
    language?: string;
    path?: string;
    tags?: string[];
    metrics?: {
      fileCount?: number;
      componentCount?: number;
      functionCount?: number;
      lineCount?: number;
    };
  };
}

export interface TransformedEdge {
  source: string;
  target: string;
  type: 'depends_on' | 'imports' | 'exports' | 'implicit' | 'static';
  metadata?: {
    weight?: number;
    isCircular?: boolean;
    isCritical?: boolean;
  };
}

export interface TransformedGraph {
  nodes: TransformedNode[];
  edges: TransformedEdge[];
  clusters?: {
    id: string;
    label: string;
    nodes: string[];
    type: 'application' | 'library' | 'feature' | 'shared';
  }[];
  metadata: {
    timestamp: Date;
    projectCount: number;
    edgeCount: number;
    framework: string;
  };
}

export class NxGraphTransformer {
  /**
   * Transform Nx project graph to internal format
   */
  transformProjectGraph(projectGraph: ProjectGraph): TransformedGraph {
    const nodes: TransformedNode[] = [];
    const edges: TransformedEdge[] = [];
    const clusters: TransformedGraph['clusters'] = [];

    // Transform project nodes
    for (const [projectName, projectNode] of Object.entries(projectGraph.nodes)) {
      const node = this.transformProjectNode(projectName, projectNode as ProjectGraphProjectNode);
      nodes.push(node);
    }

    // Transform dependencies to edges
    for (const [source, deps] of Object.entries(projectGraph.dependencies)) {
      for (const dep of deps) {
        const edge = this.transformDependency(source, dep);
        if (edge) {
          edges.push(edge);
        }
      }
    }

    // Detect and create clusters
    const detectedClusters = this.detectClusters(nodes, projectGraph);
    if (detectedClusters) {
      clusters.push(...detectedClusters);
    }

    // Add circular dependency detection
    this.detectCircularDependencies(edges);

    return {
      nodes,
      edges,
      clusters,
      metadata: {
        timestamp: new Date(),
        projectCount: nodes.length,
        edgeCount: edges.length,
        framework: this.detectFramework(projectGraph)
      }
    };
  }

  /**
   * Transform Nx graph data to internal format
   */
  transformNxData(nxData: NxGraphData): TransformedGraph {
    const nodes: TransformedNode[] = [];
    const edges: TransformedEdge[] = [];

    // Transform projects to nodes
    for (const [name, project] of nxData.projects) {
      nodes.push({
        id: name,
        type: 'project',
        label: name,
        metadata: {
          projectType: project.projectType,
          path: project.root,
          tags: project.tags,
          metrics: {
            fileCount: project.files?.length || 0
          }
        }
      });

      // Create file nodes if needed
      if (project.files) {
        for (const file of project.files) {
          nodes.push({
            id: file,
            type: 'file',
            label: this.getFileName(file),
            metadata: {
              path: file,
              language: this.getFileLanguage(file)
            }
          });

          // Create edge from project to file
          edges.push({
            source: name,
            target: file,
            type: 'imports'
          });
        }
      }
    }

    // Transform dependencies to edges
    for (const [source, targets] of nxData.dependencies) {
      for (const target of targets) {
        edges.push({
          source,
          target,
          type: 'depends_on',
          metadata: {
            weight: 1
          }
        });
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        timestamp: new Date(),
        projectCount: nxData.projects.size,
        edgeCount: edges.length,
        framework: 'nx'
      }
    };
  }

  /**
   * Extract entry points from projects
   */
  extractEntryPoints(graph: TransformedGraph): TransformedNode[] {
    const entryPoints: TransformedNode[] = [];

    for (const node of graph.nodes) {
      if (node.type === 'project' && node.metadata.projectType === 'application') {
        entryPoints.push(node);
      }
    }

    return entryPoints;
  }

  /**
   * Map build targets to components
   */
  mapTargetsToComponents(
    projectNode: ProjectGraphProjectNode,
    components: any[]
  ): Map<string, string[]> {
    const targetMap = new Map<string, string[]>();

    if (!projectNode.data.targets) {
      return targetMap;
    }

    for (const [targetName, targetConfig] of Object.entries(projectNode.data.targets)) {
      const relatedComponents: string[] = [];

      // Map based on target type
      if (targetName === 'build' || targetName === 'serve') {
        // All components are involved in build
        relatedComponents.push(...components.map(c => c.name));
      } else if (targetName === 'test') {
        // Test files might be specific to components
        const testFiles = this.findTestFiles(targetConfig);
        relatedComponents.push(...this.matchTestsToComponents(testFiles, components));
      } else if (targetName === 'storybook') {
        // Storybook typically documents components
        relatedComponents.push(...components.filter(c => c.hasStories).map(c => c.name));
      }

      if (relatedComponents.length > 0) {
        targetMap.set(targetName, relatedComponents);
      }
    }

    return targetMap;
  }

  /**
   * Create hierarchical structure from flat graph
   */
  createHierarchy(graph: TransformedGraph): any {
    const hierarchy: any = {
      name: 'root',
      type: 'workspace',
      children: []
    };

    // Group by project type
    const applications: any[] = [];
    const libraries: any[] = [];

    for (const node of graph.nodes) {
      if (node.type === 'project') {
        const projectHierarchy = {
          name: node.label,
          type: node.metadata.projectType,
          value: node.metadata.metrics?.fileCount || 1,
          children: this.getProjectChildren(node, graph)
        };

        if (node.metadata.projectType === 'application') {
          applications.push(projectHierarchy);
        } else {
          libraries.push(projectHierarchy);
        }
      }
    }

    if (applications.length > 0) {
      hierarchy.children.push({
        name: 'Applications',
        type: 'category',
        children: applications
      });
    }

    if (libraries.length > 0) {
      hierarchy.children.push({
        name: 'Libraries',
        type: 'category',
        children: libraries
      });
    }

    return hierarchy;
  }

  /**
   * Transform a single project node
   */
  private transformProjectNode(
    name: string,
    node: ProjectGraphProjectNode
  ): TransformedNode {
    return {
      id: name,
      type: 'project',
      label: name,
      metadata: {
        projectType: node.data.projectType as 'application' | 'library',
        framework: this.detectProjectFramework(node),
        path: node.data.root,
        tags: node.data.tags,
        metrics: {
          fileCount: 0  // Files property not available in ProjectConfiguration
        }
      }
    };
  }

  /**
   * Transform a dependency edge
   */
  private transformDependency(
    source: string,
    dep: ProjectGraphDependency
  ): TransformedEdge | null {
    if (!dep.target) {
      return null;
    }

    return {
      source,
      target: dep.target,
      type: dep.type as 'static' | 'implicit' || 'depends_on',
      metadata: {
        weight: 1
      }
    };
  }

  /**
   * Detect project framework
   */
  private detectProjectFramework(node: ProjectGraphProjectNode): string {
    // Check project configuration for framework hints
    const targets = node.data.targets || {};

    // Check for framework-specific build targets
    if (targets.serve?.executor?.includes('react') || targets.build?.executor?.includes('react')) {
      return 'react';
    }
    if (targets.serve?.executor?.includes('angular') || targets.build?.executor?.includes('angular')) {
      return 'angular';
    }
    if (targets.serve?.executor?.includes('vue') || targets.build?.executor?.includes('vue')) {
      return 'vue';
    }

    // Fallback to checking tags
    const tags = node.data.tags || [];
    const hasReact = tags.some((t: string) => t.includes('react'));
    const hasAngular = tags.some((t: string) => t.includes('angular'));
    const hasVue = tags.some((t: string) => t.includes('vue'));

    if (hasReact) return 'react';
    if (hasAngular) return 'angular';
    if (hasVue) return 'vue';

    return 'typescript';
  }

  /**
   * Detect overall framework
   */
  private detectFramework(graph: ProjectGraph): string {
    const frameworks = new Set<string>();

    for (const node of Object.values(graph.nodes)) {
      const framework = this.detectProjectFramework(node as ProjectGraphProjectNode);
      frameworks.add(framework);
    }

    // Return most common or first found
    return frameworks.values().next().value || 'nx';
  }

  /**
   * Detect clusters in the graph
   */
  private detectClusters(
    nodes: TransformedNode[],
    projectGraph: ProjectGraph
  ): TransformedGraph['clusters'] {
    const clusters: TransformedGraph['clusters'] = [];

    // Group by tags
    const tagGroups = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.metadata.tags) {
        for (const tag of node.metadata.tags) {
          if (!tagGroups.has(tag)) {
            tagGroups.set(tag, []);
          }
          tagGroups.get(tag)!.push(node.id);
        }
      }
    }

    // Create clusters from tag groups
    for (const [tag, nodeIds] of tagGroups) {
      if (nodeIds.length > 1) {
        clusters.push({
          id: `cluster-${tag}`,
          label: tag,
          nodes: nodeIds,
          type: this.getClusterType(tag)
        });
      }
    }

    return clusters;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(edges: TransformedEdge[]): void {
    const graph = new Map<string, Set<string>>();

    // Build adjacency list
    for (const edge of edges) {
      if (!graph.has(edge.source)) {
        graph.set(edge.source, new Set());
      }
      graph.get(edge.source)!.add(edge.target);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Mark edge as circular
          const edge = edges.find(e => e.source === node && e.target === neighbor);
          if (edge && edge.metadata) {
            edge.metadata.isCircular = true;
          }
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }
  }

  /**
   * Get project children for hierarchy
   */
  private getProjectChildren(node: TransformedNode, graph: TransformedGraph): any[] {
    const children: any[] = [];
    const projectEdges = graph.edges.filter(e => e.source === node.id);

    for (const edge of projectEdges) {
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      if (targetNode && targetNode.type === 'file') {
        children.push({
          name: targetNode.label,
          type: 'file',
          value: 1
        });
      }
    }

    return children;
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Get file language
   */
  private getFileLanguage(filePath: string): string {
    const ext = filePath.split('.').pop();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'vue':
        return 'vue';
      default:
        return 'unknown';
    }
  }

  /**
   * Find test files in target config
   */
  private findTestFiles(targetConfig: any): string[] {
    const testFiles: string[] = [];

    if (targetConfig.options?.testPathPattern) {
      // Jest/Vitest pattern
      testFiles.push(targetConfig.options.testPathPattern);
    }

    return testFiles;
  }

  /**
   * Match test files to components
   */
  private matchTestsToComponents(testFiles: string[], components: any[]): string[] {
    const matched: string[] = [];

    for (const testFile of testFiles) {
      for (const component of components) {
        if (testFile.includes(component.name)) {
          matched.push(component.name);
        }
      }
    }

    return matched;
  }

  /**
   * Get cluster type from tag
   */
  private getClusterType(tag: string): 'application' | 'library' | 'feature' | 'shared' {
    if (tag.includes('app')) return 'application';
    if (tag.includes('lib')) return 'library';
    if (tag.includes('feature')) return 'feature';
    return 'shared';
  }
}