import * as ts from 'typescript';
import { ASTVisitor } from '../ASTVisitor';

export interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow' | 'constructor';
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
  location: {
    file: string;
    line: number;
    column: number;
  };
  calls: string[]; // Functions this function calls
  complexity: number; // Cyclomatic complexity
}

export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  isRest: boolean;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  count: number;
  isAsync: boolean;
}

export class FunctionAnalyzer extends ASTVisitor<FunctionInfo> {
  private callGraph: Map<string, Set<string>> = new Map();
  private currentFunction?: FunctionInfo;

  /**
   * Extract parameter information
   */
  private extractParameters(params: ts.NodeArray<ts.ParameterDeclaration>): ParameterInfo[] {
    return params.map(param => {
      const type = this.getNodeType(param);
      return {
        name: param.name.getText(),
        type: type ? this.checker.typeToString(type) : undefined,
        isOptional: !!param.questionToken,
        hasDefault: !!param.initializer,
        defaultValue: param.initializer?.getText(),
        isRest: !!param.dotDotDotToken
      };
    });
  }

  /**
   * Extract return type
   */
  private extractReturnType(node: ts.FunctionLikeDeclaration): string | undefined {
    if (node.type) {
      return node.type.getText();
    }

    const signature = this.checker.getSignatureFromDeclaration(node);
    if (signature) {
      const returnType = signature.getReturnType();
      return this.checker.typeToString(returnType);
    }

    return undefined;
  }

  /**
   * Find function calls within a function body
   */
  private extractCalls(node: ts.Node): string[] {
    const calls = new Set<string>();

    const findCalls = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        let callName: string | undefined;

        if (ts.isIdentifier(n.expression)) {
          callName = n.expression.text;
        } else if (ts.isPropertyAccessExpression(n.expression)) {
          callName = n.expression.getText();
        }

        if (callName) {
          calls.add(callName);
        }
      }
      ts.forEachChild(n, findCalls);
    };

    findCalls(node);
    return Array.from(calls);
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const countBranches = (n: ts.Node): void => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const binaryExpr = n as ts.BinaryExpression;
          if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
      }
      ts.forEachChild(n, countBranches);
    };

    countBranches(node);
    return complexity;
  }

  /**
   * Get function name or generate one
   */
  private getFunctionName(node: ts.FunctionLikeDeclaration, parent?: ts.Node): string {
    // Named function
    if (node.name) {
      return node.name.getText();
    }

    // Arrow function or anonymous function in variable declaration
    if (parent && ts.isVariableDeclaration(parent)) {
      return parent.name.getText();
    }

    // Method in class or object
    if (parent && ts.isMethodDeclaration(parent) && parent.name) {
      const className = this.getClassName(parent);
      const methodName = parent.name.getText();
      return className ? `${className}.${methodName}` : methodName;
    }

    // Anonymous function
    const location = this.getNodeLocation(node);
    return `anonymous_${location.line}_${location.column}`;
  }

  /**
   * Get class name for method
   */
  private getClassName(method: ts.MethodDeclaration): string | undefined {
    let parent: ts.Node | undefined = method.parent;
    while (parent) {
      if (ts.isClassDeclaration(parent) && parent.name) {
        return parent.name.text;
      }
      parent = parent.parent;
    }
    return undefined;
  }

  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    const name = node.name?.text || 'anonymous';

    const functionInfo: FunctionInfo = {
      name,
      type: 'function',
      parameters: this.extractParameters(node.parameters),
      returnType: this.extractReturnType(node),
      isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      isExported: this.isExported(node),
      location: this.getNodeLocation(node),
      calls: this.extractCalls(node),
      complexity: this.calculateComplexity(node)
    };

    this.results.push(functionInfo);

    // Update call graph
    this.callGraph.set(name, new Set(functionInfo.calls));
  }

  protected visitFunctionExpression(node: ts.FunctionExpression): void {
    const name = this.getFunctionName(node, this.currentContext?.parent);

    const functionInfo: FunctionInfo = {
      name,
      type: 'function',
      parameters: this.extractParameters(node.parameters),
      returnType: this.extractReturnType(node),
      isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      isExported: false,
      location: this.getNodeLocation(node),
      calls: this.extractCalls(node),
      complexity: this.calculateComplexity(node)
    };

    this.results.push(functionInfo);
  }

  protected visitArrowFunction(node: ts.ArrowFunction): void {
    const name = this.getFunctionName(node, this.currentContext?.parent);

    const functionInfo: FunctionInfo = {
      name,
      type: 'arrow',
      parameters: this.extractParameters(node.parameters),
      returnType: this.extractReturnType(node),
      isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
      isGenerator: false, // Arrow functions can't be generators
      isExported: this.isParentExported(node),
      location: this.getNodeLocation(node),
      calls: this.extractCalls(node),
      complexity: this.calculateComplexity(node)
    };

    this.results.push(functionInfo);
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {
    const className = this.getClassName(node);
    const methodName = node.name?.getText() || 'anonymous';
    const fullName = className ? `${className}.${methodName}` : methodName;

    const functionInfo: FunctionInfo = {
      name: fullName,
      type: methodName === 'constructor' ? 'constructor' : 'method',
      parameters: this.extractParameters(node.parameters),
      returnType: this.extractReturnType(node),
      isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      isExported: this.isClassExported(node),
      location: this.getNodeLocation(node),
      calls: this.extractCalls(node),
      complexity: this.calculateComplexity(node)
    };

    this.results.push(functionInfo);
  }

  private isParentExported(node: ts.Node): boolean {
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      if (ts.isVariableStatement(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent)) {
        return this.isExported(parent);
      }
      parent = parent.parent;
    }
    return false;
  }

  private isClassExported(method: ts.MethodDeclaration): boolean {
    let parent: ts.Node | undefined = method.parent;
    while (parent) {
      if (ts.isClassDeclaration(parent)) {
        return this.isExported(parent);
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Build complete call graph
   */
  getCallGraph(): CallGraphEdge[] {
    const edges: CallGraphEdge[] = [];

    for (const [from, calls] of this.callGraph) {
      for (const to of calls) {
        edges.push({
          from,
          to,
          count: 1, // Could be enhanced to count actual occurrences
          isAsync: false // Could be enhanced to detect async calls
        });
      }
    }

    return edges;
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {
    // Methods are handled separately
  }

  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
    // Not relevant for function analysis
  }

  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    // Not relevant for function analysis
  }

  protected visitImportDeclaration(node: ts.ImportDeclaration): void {
    // Not relevant for function analysis
  }

  protected visitExportDeclaration(node: ts.ExportDeclaration): void {
    // Not relevant for function analysis
  }

  protected visitExportAssignment(node: ts.ExportAssignment): void {
    // Not relevant for function analysis
  }

  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {
    // Function expressions are handled separately
  }

  protected visitCallExpression(node: ts.CallExpression): void {
    // Already handled in extractCalls
  }

  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {
    // Not relevant for function analysis
  }

  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {
    // Not relevant for function analysis
  }
}