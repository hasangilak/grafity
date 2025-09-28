import * as ts from 'typescript';
import { ASTVisitor } from '../ASTVisitor';

export interface ComponentInfo {
  name: string;
  type: 'functional' | 'class' | 'arrow';
  props?: PropInfo;
  hooks: HookInfo[];
  children: string[];
  location: {
    file: string;
    line: number;
    column: number;
  };
  isExported: boolean;
  hasJSX: boolean;
}

export interface PropInfo {
  name: string;
  type?: string;
  required: boolean;
  defaultValue?: string;
}

export interface HookInfo {
  name: string;
  type: 'useState' | 'useEffect' | 'useContext' | 'useReducer' | 'useMemo' | 'useCallback' | 'useRef' | 'custom';
  dependencies?: string[];
}

export class ComponentExtractor extends ASTVisitor<ComponentInfo> {
  private currentComponent?: ComponentInfo;

  /**
   * Check if a function returns JSX
   */
  private returnsJSX(node: ts.FunctionLikeDeclaration): boolean {
    let hasJSX = false;

    const checkNode = (n: ts.Node): void => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        hasJSX = true;
        return;
      }
      if (ts.isReturnStatement(n)) {
        if (n.expression && (ts.isJsxElement(n.expression) || ts.isJsxSelfClosingElement(n.expression))) {
          hasJSX = true;
          return;
        }
      }
      ts.forEachChild(n, checkNode);
    };

    if (node.body) {
      checkNode(node.body);
    }

    return hasJSX;
  }

  /**
   * Check if name looks like a React component
   */
  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  /**
   * Extract props from function parameters
   */
  private extractProps(params: ts.NodeArray<ts.ParameterDeclaration>): PropInfo | undefined {
    if (params.length === 0) return undefined;

    const firstParam = params[0];
    const type = this.getNodeType(firstParam);

    if (!type) return undefined;

    const propInfo: PropInfo = {
      name: firstParam.name.getText(),
      type: this.checker.typeToString(type),
      required: !firstParam.questionToken,
      defaultValue: firstParam.initializer?.getText()
    };

    return propInfo;
  }

  /**
   * Extract hooks from component body
   */
  private extractHooks(node: ts.Node): HookInfo[] {
    const hooks: HookInfo[] = [];

    const findHooks = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const expression = n.expression;
        if (ts.isIdentifier(expression)) {
          const hookName = expression.text;

          if (hookName.startsWith('use')) {
            const hookInfo: HookInfo = {
              name: hookName,
              type: this.getHookType(hookName)
            };

            // Extract dependencies for useEffect, useMemo, useCallback
            if (['useEffect', 'useMemo', 'useCallback'].includes(hookName) && n.arguments.length > 1) {
              const depsArg = n.arguments[1];
              if (ts.isArrayLiteralExpression(depsArg)) {
                hookInfo.dependencies = depsArg.elements.map(e => e.getText());
              }
            }

            hooks.push(hookInfo);
          }
        }
      }
      ts.forEachChild(n, findHooks);
    };

    findHooks(node);
    return hooks;
  }

  /**
   * Get hook type from name
   */
  private getHookType(hookName: string): HookInfo['type'] {
    const builtinHooks = ['useState', 'useEffect', 'useContext', 'useReducer', 'useMemo', 'useCallback', 'useRef'];
    if (builtinHooks.includes(hookName)) {
      return hookName as HookInfo['type'];
    }
    return 'custom';
  }

  /**
   * Extract child components used
   */
  private extractChildComponents(node: ts.Node): string[] {
    const children = new Set<string>();

    const findComponents = (n: ts.Node): void => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tagName = ts.isJsxElement(n)
          ? n.openingElement.tagName
          : n.tagName;

        if (ts.isIdentifier(tagName) && this.isComponentName(tagName.text)) {
          children.add(tagName.text);
        }
      }
      ts.forEachChild(n, findComponents);
    };

    findComponents(node);
    return Array.from(children);
  }

  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    const name = node.name?.text;
    if (!name || !this.isComponentName(name)) return;
    if (!this.returnsJSX(node)) return;

    const component: ComponentInfo = {
      name,
      type: 'functional',
      props: this.extractProps(node.parameters),
      hooks: this.extractHooks(node),
      children: this.extractChildComponents(node),
      location: this.getNodeLocation(node),
      isExported: this.isExported(node),
      hasJSX: true
    };

    this.results.push(component);
  }

  protected visitFunctionExpression(node: ts.FunctionExpression): void {
    // Function expressions are typically not components unless assigned
    // Handled in variable declarations
  }

  protected visitArrowFunction(node: ts.ArrowFunction): void {
    // Arrow functions are typically handled via variable declarations
    if (!this.currentContext?.parent) return;

    const parent = this.currentContext.parent;
    if (ts.isVariableDeclaration(parent)) {
      const name = parent.name.getText();
      if (!this.isComponentName(name)) return;
      if (!this.returnsJSX(node)) return;

      const component: ComponentInfo = {
        name,
        type: 'arrow',
        props: this.extractProps(node.parameters),
        hooks: this.extractHooks(node),
        children: this.extractChildComponents(node),
        location: this.getNodeLocation(node),
        isExported: this.isVariableDeclarationExported(parent),
        hasJSX: true
      };

      this.results.push(component);
    }
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {
    if (!node.name) return;
    const name = node.name.text;
    if (!this.isComponentName(name)) return;

    // Check if extends React.Component or React.PureComponent
    let isReactComponent = false;
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const typeName = type.expression.getText();
          if (typeName.includes('Component') || typeName.includes('React')) {
            isReactComponent = true;
            break;
          }
        }
      }
    }

    if (!isReactComponent) return;

    // Check for render method
    let hasRender = false;
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name?.getText() === 'render') {
        hasRender = true;
        break;
      }
    }

    if (!hasRender) return;

    const component: ComponentInfo = {
      name,
      type: 'class',
      hooks: [], // Class components don't use hooks
      children: this.extractChildComponents(node),
      location: this.getNodeLocation(node),
      isExported: this.isExported(node),
      hasJSX: true
    };

    this.results.push(component);
  }

  private isVariableDeclarationExported(node: ts.VariableDeclaration): boolean {
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      if (ts.isVariableStatement(parent)) {
        return this.isExported(parent);
      }
      parent = parent.parent;
    }
    return false;
  }

  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
    // Not relevant for component extraction
  }

  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    // Not relevant for component extraction
  }

  protected visitImportDeclaration(node: ts.ImportDeclaration): void {
    // Not relevant for component extraction
  }

  protected visitExportDeclaration(node: ts.ExportDeclaration): void {
    // Not relevant for component extraction
  }

  protected visitExportAssignment(node: ts.ExportAssignment): void {
    // Not relevant for component extraction
  }

  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {
    // Handled in arrow function visitor
  }

  protected visitCallExpression(node: ts.CallExpression): void {
    // Not directly relevant for component extraction
  }

  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {
    // Already handled in component extraction
  }

  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {
    // Not relevant for component extraction
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {
    // Handled in class component detection
  }
}