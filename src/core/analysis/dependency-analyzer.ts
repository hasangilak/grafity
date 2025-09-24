import * as path from 'path';
import {
  FileInfo,
  ImportDeclaration,
  ExportDeclaration,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ComponentInfo,
  FunctionInfo
} from '../../types';

export interface DependencyAnalysisResult {
  graph: DependencyGraph;
  cycles: string[][];
  orphans: string[];
  metrics: DependencyMetrics;
}

export interface DependencyMetrics {
  totalNodes: number;
  totalEdges: number;
  averageDependencies: number;
  maxDependencies: number;
  circularDependencies: number;
  orphanedFiles: number;
  externalDependencies: string[];
}

export class DependencyAnalyzer {
  private files: FileInfo[] = [];
  private imports: Map<string, ImportDeclaration[]> = new Map();
  private exports: Map<string, ExportDeclaration[]> = new Map();
  private components: Map<string, ComponentInfo[]> = new Map();
  private functions: Map<string, FunctionInfo[]> = new Map();

  public analyze(
    files: FileInfo[],
    imports: Map<string, ImportDeclaration[]>,
    exports: Map<string, ExportDeclaration[]>,
    components: Map<string, ComponentInfo[]>,
    functions: Map<string, FunctionInfo[]>
  ): DependencyAnalysisResult {
    this.files = files;
    this.imports = imports;
    this.exports = exports;
    this.components = components;
    this.functions = functions;

    const graph = this.buildDependencyGraph();
    const cycles = this.detectCycles(graph);
    const orphans = this.findOrphans(graph);
    const metrics = this.calculateMetrics(graph, cycles, orphans);

    return {
      graph,
      cycles,
      orphans,
      metrics
    };
  }

  private buildDependencyGraph(): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Create nodes for files
    this.files.forEach(file => {
      const node: DependencyNode = {
        id: file.path,
        label: path.basename(file.path),
        type: 'file',
        filePath: file.path,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
          extension: file.extension
        }
      };
      nodes.push(node);
      nodeMap.set(file.path, node);
    });

    // Create nodes for components
    this.components.forEach((componentList, filePath) => {
      componentList.forEach(component => {
        const componentId = `${filePath}#${component.name}`;
        const node: DependencyNode = {
          id: componentId,
          label: component.name,
          type: 'component',
          filePath: component.filePath,
          metadata: {
            componentType: component.type,
            propsCount: component.props.length,
            hooksCount: component.hooks.length
          }
        };
        nodes.push(node);
        nodeMap.set(componentId, node);
      });
    });

    // Create nodes for functions
    this.functions.forEach((functionList, filePath) => {
      functionList.forEach(func => {
        const functionId = `${filePath}#${func.name}`;
        const node: DependencyNode = {
          id: functionId,
          label: func.name,
          type: 'function',
          filePath: func.filePath,
          metadata: {
            isAsync: func.isAsync,
            isExported: func.isExported,
            parameterCount: func.parameters.length,
            callsCount: func.calls.length
          }
        };
        nodes.push(node);
        nodeMap.set(functionId, node);
      });
    });

    // Create edges from imports
    this.imports.forEach((importList, filePath) => {
      importList.forEach(importDecl => {
        const resolvedPath = this.resolveImportPath(importDecl.source, filePath);

        if (resolvedPath && nodeMap.has(resolvedPath)) {
          const edge: DependencyEdge = {
            from: filePath,
            to: resolvedPath,
            type: 'imports',
            weight: 1,
            metadata: {
              specifiers: importDecl.specifiers,
              isDefault: importDecl.isDefault,
              isNamespace: importDecl.isNamespace
            }
          };
          edges.push(edge);
        }
      });
    });

    // Create edges from function calls
    this.functions.forEach((functionList, filePath) => {
      functionList.forEach(func => {
        const functionId = `${filePath}#${func.name}`;

        func.calls.forEach(call => {
          // Try to find the called function in other files
          const calledFunctionId = this.findFunctionReference(call.name, filePath);
          if (calledFunctionId && nodeMap.has(calledFunctionId)) {
            const edge: DependencyEdge = {
              from: functionId,
              to: calledFunctionId,
              type: 'calls',
              weight: 1,
              metadata: {
                functionName: call.name,
                arguments: call.arguments
              }
            };
            edges.push(edge);
          }
        });
      });
    });

    // Create edges for component relationships
    this.components.forEach((componentList, filePath) => {
      componentList.forEach(component => {
        const componentId = `${filePath}#${component.name}`;

        // Add edges for component parent-child relationships
        component.children.forEach(child => {
          const childId = `${child.filePath}#${child.name}`;
          if (nodeMap.has(childId)) {
            const edge: DependencyEdge = {
              from: componentId,
              to: childId,
              type: 'renders',
              weight: 1,
              metadata: {
                componentName: child.name
              }
            };
            edges.push(edge);
          }
        });
      });
    });

    return { nodes, edges };
  }

  private resolveImportPath(importPath: string, fromFile: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, importPath);

      // Try different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (this.files.some(f => f.path === fullPath)) {
          return fullPath;
        }
      }
    }

    // Handle absolute imports (would need tsconfig path mapping)
    // For now, return null for external dependencies
    return null;
  }

  private findFunctionReference(functionName: string, fromFile: string): string | null {
    // First, check in the same file
    const sameFunctions = this.functions.get(fromFile);
    if (sameFunctions?.some(f => f.name === functionName)) {
      return `${fromFile}#${functionName}`;
    }

    // Then check in imported files
    const fileImports = this.imports.get(fromFile) || [];

    for (const importDecl of fileImports) {
      if (importDecl.specifiers.includes(functionName)) {
        const resolvedPath = this.resolveImportPath(importDecl.source, fromFile);
        if (resolvedPath) {
          const functions = this.functions.get(resolvedPath);
          if (functions?.some(f => f.name === functionName)) {
            return `${resolvedPath}#${functionName}`;
          }
        }
      }
    }

    return null;
  }

  private detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...currentPath.slice(cycleStart), nodeId]);
        }
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      // Find all outgoing edges
      const outgoingEdges = graph.edges.filter(edge => edge.from === nodeId);

      for (const edge of outgoingEdges) {
        if (dfs(edge.to)) {
          // Don't return immediately, continue to find all cycles
        }
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
      return false;
    };

    // Check all nodes
    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    return cycles;
  }

  private findOrphans(graph: DependencyGraph): string[] {
    const orphans: string[] = [];
    const hasIncoming = new Set<string>();
    const hasOutgoing = new Set<string>();

    // Mark nodes with incoming/outgoing edges
    graph.edges.forEach(edge => {
      hasOutgoing.add(edge.from);
      hasIncoming.add(edge.to);
    });

    // Find orphaned nodes (no incoming or outgoing dependencies)
    graph.nodes.forEach(node => {
      if (!hasIncoming.has(node.id) && !hasOutgoing.has(node.id)) {
        orphans.push(node.id);
      }
    });

    return orphans;
  }

  private calculateMetrics(
    graph: DependencyGraph,
    cycles: string[][],
    orphans: string[]
  ): DependencyMetrics {
    const dependencyCounts = new Map<string, number>();
    const externalDeps = new Set<string>();

    // Count dependencies per node
    graph.edges.forEach(edge => {
      const count = dependencyCounts.get(edge.from) || 0;
      dependencyCounts.set(edge.from, count + 1);
    });

    // Find external dependencies
    this.imports.forEach(importList => {
      importList.forEach(importDecl => {
        if (!importDecl.source.startsWith('.')) {
          externalDeps.add(importDecl.source);
        }
      });
    });

    const dependencyValues = Array.from(dependencyCounts.values());
    const totalDependencies = dependencyValues.reduce((sum, count) => sum + count, 0);

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      averageDependencies: dependencyValues.length > 0 ? totalDependencies / dependencyValues.length : 0,
      maxDependencies: dependencyValues.length > 0 ? Math.max(...dependencyValues) : 0,
      circularDependencies: cycles.length,
      orphanedFiles: orphans.length,
      externalDependencies: Array.from(externalDeps)
    };
  }

  public getStronglyConnectedComponents(graph: DependencyGraph): string[][] {
    const components: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];

    // First DFS to fill the stack
    const dfs1 = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const outgoingEdges = graph.edges.filter(edge => edge.from === nodeId);
      outgoingEdges.forEach(edge => dfs1(edge.to));

      stack.push(nodeId);
    };

    // Second DFS on transposed graph
    const dfs2 = (nodeId: string, component: string[]) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      component.push(nodeId);

      const incomingEdges = graph.edges.filter(edge => edge.to === nodeId);
      incomingEdges.forEach(edge => dfs2(edge.from, component));
    };

    // First pass
    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs1(node.id);
      }
    });

    // Reset visited for second pass
    visited.clear();

    // Second pass
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (!visited.has(nodeId)) {
        const component: string[] = [];
        dfs2(nodeId, component);
        if (component.length > 0) {
          components.push(component);
        }
      }
    }

    return components;
  }
}