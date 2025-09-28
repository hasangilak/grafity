import * as ts from 'typescript';
import { ASTVisitor } from './ASTVisitor';

export interface DataFlowNode {
  id: string;
  type: 'variable' | 'prop' | 'state' | 'context' | 'parameter' | 'return';
  name: string;
  value?: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface DataFlowEdge {
  from: string;
  to: string;
  type: 'assignment' | 'prop-passing' | 'state-update' | 'return' | 'parameter';
  transformation?: string;
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  entry: string[];
  exit: string[];
}

export class DataFlowAnalyzer extends ASTVisitor<DataFlowNode> {
  private flowNodes: Map<string, DataFlowNode> = new Map();
  private flowEdges: DataFlowEdge[] = [];
  private nodeIdCounter = 0;
  private currentScope: Map<string, string> = new Map(); // variable name -> node id

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    return `df_node_${this.nodeIdCounter++}`;
  }

  /**
   * Track variable assignment
   */
  private trackAssignment(target: ts.Node, source: ts.Node): void {
    const targetName = this.getIdentifierName(target);
    const sourceName = this.getIdentifierName(source);

    if (!targetName) return;

    // Create or get target node
    let targetNodeId = this.currentScope.get(targetName);
    if (!targetNodeId) {
      targetNodeId = this.generateNodeId();
      const targetNode: DataFlowNode = {
        id: targetNodeId,
        type: 'variable',
        name: targetName,
        location: this.getNodeLocation(target)
      };
      this.flowNodes.set(targetNodeId, targetNode);
      this.currentScope.set(targetName, targetNodeId);
      this.results.push(targetNode);
    }

    // Create edge if source is tracked
    if (sourceName) {
      const sourceNodeId = this.currentScope.get(sourceName);
      if (sourceNodeId) {
        this.flowEdges.push({
          from: sourceNodeId,
          to: targetNodeId,
          type: 'assignment'
        });
      }
    }
  }

  /**
   * Track React state updates
   */
  private trackStateUpdate(node: ts.CallExpression): void {
    const expr = node.expression;

    // Check for setState pattern
    if (ts.isIdentifier(expr) && expr.text.startsWith('set')) {
      const stateName = expr.text.substring(3).toLowerCase();
      const stateNodeId = this.currentScope.get(stateName);

      if (stateNodeId && node.arguments.length > 0) {
        const newStateNodeId = this.generateNodeId();
        const newStateNode: DataFlowNode = {
          id: newStateNodeId,
          type: 'state',
          name: `${stateName}_updated`,
          location: this.getNodeLocation(node)
        };

        this.flowNodes.set(newStateNodeId, newStateNode);
        this.results.push(newStateNode);

        this.flowEdges.push({
          from: stateNodeId,
          to: newStateNodeId,
          type: 'state-update'
        });
      }
    }
  }

  /**
   * Track prop passing in JSX
   */
  private trackPropPassing(node: ts.JsxAttributes): void {
    for (const prop of node.properties) {
      if (ts.isJsxAttribute(prop) && prop.initializer) {
        const propName = prop.name.getText();
        const propNodeId = this.generateNodeId();

        const propNode: DataFlowNode = {
          id: propNodeId,
          type: 'prop',
          name: propName,
          location: this.getNodeLocation(prop)
        };

        this.flowNodes.set(propNodeId, propNode);
        this.results.push(propNode);

        // Track source of prop value
        if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
          const sourceName = this.getIdentifierName(prop.initializer.expression);
          if (sourceName) {
            const sourceNodeId = this.currentScope.get(sourceName);
            if (sourceNodeId) {
              this.flowEdges.push({
                from: sourceNodeId,
                to: propNodeId,
                type: 'prop-passing'
              });
            }
          }
        }
      }
    }
  }

  /**
   * Get identifier name from node
   */
  private getIdentifierName(node: ts.Node): string | undefined {
    if (ts.isIdentifier(node)) {
      return node.text;
    }
    if (ts.isPropertyAccessExpression(node)) {
      return node.getText();
    }
    return undefined;
  }

  /**
   * Track function parameters
   */
  private trackParameters(params: ts.NodeArray<ts.ParameterDeclaration>): void {
    for (const param of params) {
      const paramName = param.name.getText();
      const paramNodeId = this.generateNodeId();

      const paramNode: DataFlowNode = {
        id: paramNodeId,
        type: 'parameter',
        name: paramName,
        location: this.getNodeLocation(param)
      };

      this.flowNodes.set(paramNodeId, paramNode);
      this.currentScope.set(paramName, paramNodeId);
      this.results.push(paramNode);
    }
  }

  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {
    const name = node.name.getText();
    const nodeId = this.generateNodeId();

    // Check if this is a useState hook
    let type: DataFlowNode['type'] = 'variable';
    if (node.initializer && ts.isCallExpression(node.initializer)) {
      const callExpr = node.initializer.expression;
      if (ts.isIdentifier(callExpr) && callExpr.text === 'useState') {
        type = 'state';
      } else if (ts.isIdentifier(callExpr) && callExpr.text === 'useContext') {
        type = 'context';
      }
    }

    const dataNode: DataFlowNode = {
      id: nodeId,
      type,
      name,
      value: node.initializer?.getText(),
      location: this.getNodeLocation(node)
    };

    this.flowNodes.set(nodeId, dataNode);
    this.currentScope.set(name, nodeId);
    this.results.push(dataNode);

    // Track data flow from initializer
    if (node.initializer) {
      const sourceName = this.getIdentifierName(node.initializer);
      if (sourceName) {
        const sourceNodeId = this.currentScope.get(sourceName);
        if (sourceNodeId) {
          this.flowEdges.push({
            from: sourceNodeId,
            to: nodeId,
            type: 'assignment'
          });
        }
      }
    }
  }

  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    // Create new scope for function
    const prevScope = this.currentScope;
    this.currentScope = new Map(prevScope);

    this.trackParameters(node.parameters);

    // Visit function body
    if (node.body) {
      ts.forEachChild(node.body, child => this.visitNode(child));
    }

    // Restore scope
    this.currentScope = prevScope;
  }

  protected visitArrowFunction(node: ts.ArrowFunction): void {
    // Create new scope for function
    const prevScope = this.currentScope;
    this.currentScope = new Map(prevScope);

    this.trackParameters(node.parameters);

    // Visit function body
    ts.forEachChild(node.body, child => this.visitNode(child));

    // Restore scope
    this.currentScope = prevScope;
  }

  protected visitCallExpression(node: ts.CallExpression): void {
    this.trackStateUpdate(node);
  }

  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {
    const attributes = ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;

    this.trackPropPassing(attributes);
  }

  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {
    // Track property access for data flow
    const objectName = this.getIdentifierName(node.expression);
    if (objectName) {
      const sourceNodeId = this.currentScope.get(objectName);
      if (sourceNodeId) {
        // Property access creates a derived data flow
        const propNodeId = this.generateNodeId();
        const propNode: DataFlowNode = {
          id: propNodeId,
          type: 'variable',
          name: node.getText(),
          location: this.getNodeLocation(node)
        };

        this.flowNodes.set(propNodeId, propNode);
        this.results.push(propNode);

        this.flowEdges.push({
          from: sourceNodeId,
          to: propNodeId,
          type: 'assignment',
          transformation: `access .${node.name.text}`
        });
      }
    }
  }

  /**
   * Build complete data flow graph
   */
  buildDataFlowGraph(): DataFlowGraph {
    // Identify entry and exit points
    const entry: string[] = [];
    const exit: string[] = [];

    // Entry points: parameters and initial state
    for (const node of this.flowNodes.values()) {
      if (node.type === 'parameter' || node.type === 'context') {
        entry.push(node.id);
      }
      if (node.type === 'return') {
        exit.push(node.id);
      }
    }

    // Find nodes with no incoming edges (sources)
    const hasIncoming = new Set(this.flowEdges.map(e => e.to));
    for (const node of this.flowNodes.values()) {
      if (!hasIncoming.has(node.id) && !entry.includes(node.id)) {
        entry.push(node.id);
      }
    }

    // Find nodes with no outgoing edges (sinks)
    const hasOutgoing = new Set(this.flowEdges.map(e => e.from));
    for (const node of this.flowNodes.values()) {
      if (!hasOutgoing.has(node.id) && !exit.includes(node.id)) {
        exit.push(node.id);
      }
    }

    return {
      nodes: Array.from(this.flowNodes.values()),
      edges: this.flowEdges,
      entry,
      exit
    };
  }

  // Other required visitor methods
  protected visitFunctionExpression(node: ts.FunctionExpression): void {
    this.visitFunctionDeclaration(node as any);
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {}
  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {}
  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {}
  protected visitImportDeclaration(node: ts.ImportDeclaration): void {}
  protected visitExportDeclaration(node: ts.ExportDeclaration): void {}
  protected visitExportAssignment(node: ts.ExportAssignment): void {}
  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {}
}