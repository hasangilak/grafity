import * as ts from 'typescript';

export interface VisitorOptions {
  maxDepth?: number;
  nodeFilter?: (node: ts.Node) => boolean;
  followImports?: boolean;
  skipNodeModules?: boolean;
}

export interface VisitContext {
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  depth: number;
  path: string[];
  parent?: ts.Node;
}

export abstract class ASTVisitor<T = any> {
  protected checker: ts.TypeChecker;
  protected options: VisitorOptions;
  protected results: T[] = [];
  protected currentContext?: VisitContext;

  constructor(checker: ts.TypeChecker, options: VisitorOptions = {}) {
    this.checker = checker;
    this.options = {
      maxDepth: 100,
      skipNodeModules: true,
      ...options
    };
  }

  /**
   * Visit a source file and extract information
   */
  visit(sourceFile: ts.SourceFile): T[] {
    this.results = [];
    this.currentContext = {
      sourceFile,
      checker: this.checker,
      depth: 0,
      path: [sourceFile.fileName]
    };

    this.visitNode(sourceFile);
    return this.results;
  }

  /**
   * Visit a single node
   */
  protected visitNode(node: ts.Node): void {
    if (!this.currentContext) return;

    // Check depth limit
    if (this.currentContext.depth > (this.options.maxDepth || 100)) {
      return;
    }

    // Apply node filter
    if (this.options.nodeFilter && !this.options.nodeFilter(node)) {
      return;
    }

    // Update context
    const prevParent = this.currentContext.parent;
    this.currentContext.parent = node;
    this.currentContext.depth++;

    // Dispatch to specific visitor methods
    this.dispatchVisit(node);

    // Visit children
    ts.forEachChild(node, child => this.visitNode(child));

    // Restore context
    this.currentContext.parent = prevParent;
    this.currentContext.depth--;
  }

  /**
   * Dispatch to specific visitor methods based on node kind
   */
  protected dispatchVisit(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        this.visitFunctionDeclaration(node as ts.FunctionDeclaration);
        break;
      case ts.SyntaxKind.FunctionExpression:
        this.visitFunctionExpression(node as ts.FunctionExpression);
        break;
      case ts.SyntaxKind.ArrowFunction:
        this.visitArrowFunction(node as ts.ArrowFunction);
        break;
      case ts.SyntaxKind.ClassDeclaration:
        this.visitClassDeclaration(node as ts.ClassDeclaration);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        this.visitInterfaceDeclaration(node as ts.InterfaceDeclaration);
        break;
      case ts.SyntaxKind.TypeAliasDeclaration:
        this.visitTypeAliasDeclaration(node as ts.TypeAliasDeclaration);
        break;
      case ts.SyntaxKind.ImportDeclaration:
        this.visitImportDeclaration(node as ts.ImportDeclaration);
        break;
      case ts.SyntaxKind.ExportDeclaration:
        this.visitExportDeclaration(node as ts.ExportDeclaration);
        break;
      case ts.SyntaxKind.ExportAssignment:
        this.visitExportAssignment(node as ts.ExportAssignment);
        break;
      case ts.SyntaxKind.VariableDeclaration:
        this.visitVariableDeclaration(node as ts.VariableDeclaration);
        break;
      case ts.SyntaxKind.CallExpression:
        this.visitCallExpression(node as ts.CallExpression);
        break;
      case ts.SyntaxKind.JsxElement:
      case ts.SyntaxKind.JsxSelfClosingElement:
        this.visitJsxElement(node as ts.JsxElement | ts.JsxSelfClosingElement);
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        this.visitPropertyAccess(node as ts.PropertyAccessExpression);
        break;
      case ts.SyntaxKind.MethodDeclaration:
        this.visitMethodDeclaration(node as ts.MethodDeclaration);
        break;
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract visitFunctionDeclaration(node: ts.FunctionDeclaration): void;
  protected abstract visitFunctionExpression(node: ts.FunctionExpression): void;
  protected abstract visitArrowFunction(node: ts.ArrowFunction): void;
  protected abstract visitClassDeclaration(node: ts.ClassDeclaration): void;
  protected abstract visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void;
  protected abstract visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void;
  protected abstract visitImportDeclaration(node: ts.ImportDeclaration): void;
  protected abstract visitExportDeclaration(node: ts.ExportDeclaration): void;
  protected abstract visitExportAssignment(node: ts.ExportAssignment): void;
  protected abstract visitVariableDeclaration(node: ts.VariableDeclaration): void;
  protected abstract visitCallExpression(node: ts.CallExpression): void;
  protected abstract visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void;
  protected abstract visitPropertyAccess(node: ts.PropertyAccessExpression): void;
  protected abstract visitMethodDeclaration(node: ts.MethodDeclaration): void;

  /**
   * Helper to get node location
   */
  protected getNodeLocation(node: ts.Node): { line: number; column: number; file: string } {
    if (!this.currentContext) {
      return { line: 0, column: 0, file: '' };
    }

    const { line, character } = this.currentContext.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {
      line: line + 1,
      column: character + 1,
      file: this.currentContext.sourceFile.fileName
    };
  }

  /**
   * Helper to get node text
   */
  protected getNodeText(node: ts.Node): string {
    if (!this.currentContext) return '';
    return node.getText(this.currentContext.sourceFile);
  }

  /**
   * Helper to get type of node
   */
  protected getNodeType(node: ts.Node): ts.Type | undefined {
    try {
      return this.checker.getTypeAtLocation(node);
    } catch {
      return undefined;
    }
  }

  /**
   * Helper to get symbol of node
   */
  protected getNodeSymbol(node: ts.Node): ts.Symbol | undefined {
    try {
      return this.checker.getSymbolAtLocation(node);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if node is exported
   */
  protected isExported(node: ts.Node): boolean {
    return !!(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export);
  }

  /**
   * Check if node has specific modifier
   */
  protected hasModifier(node: ts.Node, modifier: ts.ModifierFlags): boolean {
    return !!(ts.getCombinedModifierFlags(node as ts.Declaration) & modifier);
  }

  /**
   * Get results
   */
  getResults(): T[] {
    return this.results;
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.results = [];
  }
}

/**
 * Composite visitor that runs multiple visitors
 */
export class CompositeVisitor<T = any> extends ASTVisitor<T> {
  private visitors: ASTVisitor<any>[] = [];

  constructor(checker: ts.TypeChecker, visitors: ASTVisitor<any>[], options?: VisitorOptions) {
    super(checker, options);
    this.visitors = visitors;
  }

  visit(sourceFile: ts.SourceFile): T[] {
    const allResults: any[] = [];

    for (const visitor of this.visitors) {
      const results = visitor.visit(sourceFile);
      allResults.push(...results);
    }

    return allResults as T[];
  }

  // Implement abstract methods (delegate to child visitors)
  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {}
  protected visitFunctionExpression(node: ts.FunctionExpression): void {}
  protected visitArrowFunction(node: ts.ArrowFunction): void {}
  protected visitClassDeclaration(node: ts.ClassDeclaration): void {}
  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {}
  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {}
  protected visitImportDeclaration(node: ts.ImportDeclaration): void {}
  protected visitExportDeclaration(node: ts.ExportDeclaration): void {}
  protected visitExportAssignment(node: ts.ExportAssignment): void {}
  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {}
  protected visitCallExpression(node: ts.CallExpression): void {}
  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {}
  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {}
  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {}
}