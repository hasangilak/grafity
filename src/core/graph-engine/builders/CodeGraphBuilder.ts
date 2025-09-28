import { GraphBuilder } from './GraphBuilder';
import { GraphStore } from '../GraphStore';
import { createCodeNode } from '../types/NodeTypes';
import { ComponentInfo } from '../../ast-mechanical/extractors/ComponentExtractor';
import { FunctionInfo } from '../../ast-mechanical/extractors/FunctionAnalyzer';
import { ImportInfo, ExportInfo } from '../../ast-mechanical/extractors/ImportExportTracker';
import { TypeInfo } from '../../ast-mechanical/extractors/TypeExtractor';
import { MechanicalAnalysisResult } from '../../pipeline/MechanicalPipeline';

/**
 * Builds a graph from mechanical analysis results (Phase 2 data)
 */
export class CodeGraphBuilder extends GraphBuilder {
  private componentNodeMap: Map<string, string> = new Map();
  private functionNodeMap: Map<string, string> = new Map();
  private typeNodeMap: Map<string, string> = new Map();
  private fileNodeMap: Map<string, string> = new Map();

  async build(data: MechanicalAnalysisResult): Promise<GraphStore> {
    console.log('Building code graph from mechanical analysis...');

    // Create nodes for components
    this.createComponentNodes(data.components);

    // Create nodes for functions
    this.createFunctionNodes(data.functions);

    // Create nodes for types
    this.createTypeNodes(data.types);

    // Create file nodes and connect imports/exports
    this.createFileNodesAndConnections(data.imports, data.exports);

    // Create component relationships
    this.createComponentRelationships(data.components);

    // Create function call relationships
    this.createFunctionCallRelationships(data.functions);

    // Create data flow relationships
    this.createDataFlowRelationships(data);

    console.log(`Code graph built: ${this.store.getStatistics().totalNodes} nodes, ${this.store.getStatistics().totalEdges} edges`);
    return this.store;
  }

  private createComponentNodes(components: ComponentInfo[]): void {
    for (const component of components) {
      const nodeId = this.generateNodeId('component');
      const node = createCodeNode({
        id: nodeId,
        label: component.name,
        description: `${component.type} component in ${component.location.file}`,
        codeType: 'component',
        filePath: component.location.file,
        lineNumber: component.location.line,
        language: 'typescript',
        props: component.props ? [{
          name: component.props.name,
          type: component.props.type || 'any',
          required: component.props.required
        }] : [],
        hooks: component.hooks.map(h => ({
          name: h.name,
          type: h.type
        })),
        metadata: {
          isExported: component.isExported,
          hasJSX: component.hasJSX,
          componentType: component.type
        }
      });

      this.addNode(node);
      this.componentNodeMap.set(component.name, nodeId);

      // Create file node if not exists
      this.findOrCreateFileNode(component.location.file);
    }
  }

  private createFunctionNodes(functions: FunctionInfo[]): void {
    for (const func of functions) {
      const nodeId = this.generateNodeId('function');
      const node = createCodeNode({
        id: nodeId,
        label: func.name,
        description: `${func.type} function`,
        codeType: 'function',
        filePath: func.location.file,
        lineNumber: func.location.line,
        language: 'typescript',
        complexity: func.complexity,
        metadata: {
          isAsync: func.isAsync,
          isGenerator: func.isGenerator,
          isExported: func.isExported,
          parameters: func.parameters,
          returnType: func.returnType
        }
      });

      this.addNode(node);
      this.functionNodeMap.set(func.name, nodeId);

      // Connect to file
      const fileNodeId = this.findOrCreateFileNode(func.location.file);
      this.connectNodes(fileNodeId, nodeId, 'uses');
    }
  }

  private createTypeNodes(types: TypeInfo[]): void {
    for (const type of types) {
      const nodeId = this.generateNodeId('type');
      const node = createCodeNode({
        id: nodeId,
        label: type.name,
        description: `${type.kind} type`,
        codeType: type.kind === 'interface' ? 'interface' : 'type',
        filePath: type.location.file,
        lineNumber: type.location.line,
        language: 'typescript',
        metadata: {
          kind: type.kind,
          isExported: type.isExported,
          members: type.members,
          generics: type.generics,
          extends: type.extends,
          implements: type.implements
        }
      });

      this.addNode(node);
      this.typeNodeMap.set(type.name, nodeId);

      // Connect to file
      const fileNodeId = this.findOrCreateFileNode(type.location.file);
      this.connectNodes(fileNodeId, nodeId, 'uses');
    }
  }

  private createFileNodesAndConnections(imports: ImportInfo[], exports: ExportInfo[]): void {
    // Process imports
    for (const imp of imports) {
      const sourceFile = imp.location.file;
      const targetFile = imp.source;

      const sourceNodeId = this.findOrCreateFileNode(sourceFile);
      const targetNodeId = this.findOrCreateFileNode(targetFile);

      // Create import relationship
      this.connectNodes(sourceNodeId, targetNodeId, 'imports');

      // Connect specific imports if they're components/functions
      for (const spec of imp.specifiers) {
        if (this.componentNodeMap.has(spec.name)) {
          const componentId = this.componentNodeMap.get(spec.name)!;
          this.connectNodes(sourceNodeId, componentId, 'imports');
        }
        if (this.functionNodeMap.has(spec.name)) {
          const functionId = this.functionNodeMap.get(spec.name)!;
          this.connectNodes(sourceNodeId, functionId, 'imports');
        }
      }
    }

    // Process exports
    for (const exp of exports) {
      const fileNodeId = this.findOrCreateFileNode(exp.location.file);

      // Connect exported items
      if (exp.name) {
        if (this.componentNodeMap.has(exp.name)) {
          const componentId = this.componentNodeMap.get(exp.name)!;
          this.connectNodes(fileNodeId, componentId, 'exports');
        }
        if (this.functionNodeMap.has(exp.name)) {
          const functionId = this.functionNodeMap.get(exp.name)!;
          this.connectNodes(fileNodeId, functionId, 'exports');
        }
        if (this.typeNodeMap.has(exp.name)) {
          const typeId = this.typeNodeMap.get(exp.name)!;
          this.connectNodes(fileNodeId, typeId, 'exports');
        }
      }
    }
  }

  private createComponentRelationships(components: ComponentInfo[]): void {
    for (const component of components) {
      const componentId = this.componentNodeMap.get(component.name);
      if (!componentId) continue;

      // Connect to child components
      for (const childName of component.children) {
        const childId = this.componentNodeMap.get(childName);
        if (childId) {
          this.connectNodes(componentId, childId, 'renders');
        }
      }

      // Connect hooks usage
      for (const hook of component.hooks) {
        if (hook.type === 'custom') {
          // Try to find custom hook as a function
          const hookId = this.functionNodeMap.get(hook.name);
          if (hookId) {
            this.connectNodes(componentId, hookId, 'calls');
          }
        }
      }
    }
  }

  private createFunctionCallRelationships(functions: FunctionInfo[]): void {
    for (const func of functions) {
      const functionId = this.functionNodeMap.get(func.name);
      if (!functionId) continue;

      // Connect function calls
      for (const calledFunc of func.calls) {
        const calledId = this.functionNodeMap.get(calledFunc);
        if (calledId) {
          this.connectNodes(functionId, calledId, 'calls');
        }
      }
    }
  }

  private createDataFlowRelationships(data: MechanicalAnalysisResult): void {
    // Process data flow graphs
    for (const flowGraph of data.dataFlow) {
      for (const edge of flowGraph.edges) {
        // Try to find corresponding nodes
        const sourceNode = flowGraph.nodes.find(n => n.id === edge.from);
        const targetNode = flowGraph.nodes.find(n => n.id === edge.to);

        if (sourceNode && targetNode) {
          // Map to component/function nodes if possible
          if (edge.type === 'prop-passing') {
            // This represents props being passed between components
            const sourceComponent = this.findComponentByLocation(sourceNode.location);
            const targetComponent = this.findComponentByLocation(targetNode.location);

            if (sourceComponent && targetComponent) {
              this.connectNodes(sourceComponent, targetComponent, 'passes_props');
            }
          } else if (edge.type === 'state-update') {
            // State updates within a component
            const component = this.findComponentByLocation(sourceNode.location);
            if (component) {
              // Self-edge for state management
              this.connectNodes(component, component, 'uses_state');
            }
          }
        }
      }
    }
  }

  private findOrCreateFileNode(filePath: string): string {
    if (this.fileNodeMap.has(filePath)) {
      return this.fileNodeMap.get(filePath)!;
    }

    const fileName = filePath.split('/').pop() || filePath;
    const nodeId = this.generateNodeId('file');
    const node = createCodeNode({
      id: nodeId,
      label: fileName,
      description: `File: ${filePath}`,
      codeType: 'file',
      filePath,
      language: filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
      metadata: {}
    });

    this.addNode(node);
    this.fileNodeMap.set(filePath, nodeId);
    return nodeId;
  }

  private findComponentByLocation(location: { file: string; line: number }): string | undefined {
    // Find component at specific location
    for (const [name, id] of this.componentNodeMap) {
      const node = this.store.getNode(id);
      if (node && 'filePath' in node && 'lineNumber' in node &&
          node.filePath === location.file &&
          node.lineNumber && Math.abs(node.lineNumber - location.line) < 10) {
        return id;
      }
    }
    return undefined;
  }
}