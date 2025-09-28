import * as ts from 'typescript';
import { ASTVisitor } from './ASTVisitor';
import { ComponentInfo } from './extractors/ComponentExtractor';
import { FunctionInfo } from './extractors/FunctionAnalyzer';

export interface Pattern {
  name: string;
  type: 'good' | 'bad' | 'neutral';
  category: 'react' | 'typescript' | 'general';
  confidence: number; // 0-1
  description: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface PatternReport {
  patterns: Pattern[];
  score: number; // Overall code quality score
  summary: {
    good: number;
    bad: number;
    neutral: number;
  };
}

export class PatternDetector extends ASTVisitor<Pattern> {
  private components: ComponentInfo[] = [];
  private functions: FunctionInfo[] = [];
  private patterns: Pattern[] = [];

  constructor(
    checker: ts.TypeChecker,
    components?: ComponentInfo[],
    functions?: FunctionInfo[]
  ) {
    super(checker);
    this.components = components || [];
    this.functions = functions || [];
  }

  /**
   * Detect React Hook Rules violations
   */
  private detectHookViolations(node: ts.CallExpression): void {
    const expr = node.expression;
    if (!ts.isIdentifier(expr) || !expr.text.startsWith('use')) return;

    // Check if hook is called inside a loop
    if (this.isInsideLoop(node)) {
      this.patterns.push({
        name: 'Hook Inside Loop',
        type: 'bad',
        category: 'react',
        confidence: 1.0,
        description: `Hook "${expr.text}" is called inside a loop`,
        location: this.getNodeLocation(node),
        suggestion: 'Move hook calls outside of loops to follow Rules of Hooks'
      });
    }

    // Check if hook is called conditionally
    if (this.isConditional(node)) {
      this.patterns.push({
        name: 'Conditional Hook',
        type: 'bad',
        category: 'react',
        confidence: 1.0,
        description: `Hook "${expr.text}" is called conditionally`,
        location: this.getNodeLocation(node),
        suggestion: 'Hooks must be called unconditionally at the top level of the function'
      });
    }
  }

  /**
   * Detect prop drilling pattern
   */
  private detectPropDrilling(): void {
    // Analyze component tree for props passed through multiple levels
    const propChains = new Map<string, string[]>();

    for (const component of this.components) {
      if (component.props) {
        for (const child of component.children) {
          // Check if same prop name appears in child
          const childComp = this.components.find(c => c.name === child);
          if (childComp?.props && childComp.props.name === component.props.name) {
            const chain = propChains.get(component.props.name) || [];
            chain.push(component.name, child);
            propChains.set(component.props.name, chain);
          }
        }
      }
    }

    // Report chains longer than 3
    for (const [prop, chain] of propChains) {
      if (chain.length > 3) {
        this.patterns.push({
          name: 'Prop Drilling',
          type: 'bad',
          category: 'react',
          confidence: 0.8,
          description: `Prop "${prop}" is passed through ${chain.length} components`,
          location: { file: '', line: 0, column: 0 }, // Would need component location
          suggestion: 'Consider using Context API or state management library'
        });
      }
    }
  }

  /**
   * Detect custom hook pattern
   */
  private detectCustomHook(node: ts.FunctionDeclaration | ts.ArrowFunction): void {
    const name = this.getFunctionName(node);
    if (!name.startsWith('use')) return;

    // Check if it uses other hooks
    let usesHooks = false;
    ts.forEachChild(node, child => {
      if (ts.isCallExpression(child)) {
        const expr = child.expression;
        if (ts.isIdentifier(expr) && expr.text.startsWith('use')) {
          usesHooks = true;
        }
      }
    });

    if (usesHooks) {
      this.patterns.push({
        name: 'Custom Hook',
        type: 'good',
        category: 'react',
        confidence: 0.9,
        description: `Custom hook "${name}" properly encapsulates logic`,
        location: this.getNodeLocation(node),
      });
    }
  }

  /**
   * Detect large components
   */
  private detectLargeComponents(): void {
    for (const component of this.components) {
      const func = this.functions.find(f => f.name === component.name);
      if (func && func.complexity > 10) {
        this.patterns.push({
          name: 'Complex Component',
          type: 'bad',
          category: 'react',
          confidence: 0.7,
          description: `Component "${component.name}" has high complexity (${func.complexity})`,
          location: component.location,
          suggestion: 'Consider breaking into smaller components'
        });
      }

      if (component.hooks.length > 7) {
        this.patterns.push({
          name: 'Too Many Hooks',
          type: 'bad',
          category: 'react',
          confidence: 0.8,
          description: `Component "${component.name}" uses ${component.hooks.length} hooks`,
          location: component.location,
          suggestion: 'Consider extracting logic into custom hooks'
        });
      }
    }
  }

  /**
   * Detect any type usage
   */
  private detectAnyType(node: ts.TypeReferenceNode): void {
    if (node.typeName.getText() === 'any') {
      this.patterns.push({
        name: 'Any Type Usage',
        type: 'bad',
        category: 'typescript',
        confidence: 1.0,
        description: 'Using "any" type defeats TypeScript type safety',
        location: this.getNodeLocation(node),
        suggestion: 'Use specific types or unknown instead of any'
      });
    }
  }

  /**
   * Detect async without await
   */
  private detectAsyncWithoutAwait(node: ts.FunctionLikeDeclaration): void {
    if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) return;

    let hasAwait = false;
    const checkAwait = (n: ts.Node): void => {
      if (ts.isAwaitExpression(n)) {
        hasAwait = true;
        return;
      }
      ts.forEachChild(n, checkAwait);
    };

    if (node.body) {
      checkAwait(node.body);
    }

    if (!hasAwait) {
      this.patterns.push({
        name: 'Async Without Await',
        type: 'bad',
        category: 'general',
        confidence: 0.9,
        description: 'Async function without await',
        location: this.getNodeLocation(node),
        suggestion: 'Remove async keyword if await is not needed'
      });
    }
  }

  /**
   * Helper methods
   */
  private isInsideLoop(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isForStatement(parent) ||
          ts.isForInStatement(parent) ||
          ts.isForOfStatement(parent) ||
          ts.isWhileStatement(parent) ||
          ts.isDoStatement(parent)) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private isConditional(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isIfStatement(parent) ||
          ts.isConditionalExpression(parent)) {
        return true;
      }
      // Stop at function boundary
      if (ts.isFunctionLike(parent)) {
        break;
      }
      parent = parent.parent;
    }
    return false;
  }

  private getFunctionName(node: ts.FunctionLikeDeclaration): string {
    if (node.name) return node.name.getText();
    if (node.parent && ts.isVariableDeclaration(node.parent)) {
      return node.parent.name.getText();
    }
    return 'anonymous';
  }

  /**
   * Visit methods
   */
  protected visitCallExpression(node: ts.CallExpression): void {
    this.detectHookViolations(node);
  }

  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    this.detectCustomHook(node);
    this.detectAsyncWithoutAwait(node);
  }

  protected visitArrowFunction(node: ts.ArrowFunction): void {
    this.detectCustomHook(node);
    this.detectAsyncWithoutAwait(node);
  }

  protected visitFunctionExpression(node: ts.FunctionExpression): void {
    this.detectAsyncWithoutAwait(node);
  }

  /**
   * Generate pattern report
   */
  generateReport(): PatternReport {
    // Run component-level detections
    this.detectPropDrilling();
    this.detectLargeComponents();

    const summary = {
      good: this.patterns.filter(p => p.type === 'good').length,
      bad: this.patterns.filter(p => p.type === 'bad').length,
      neutral: this.patterns.filter(p => p.type === 'neutral').length
    };

    // Calculate score (0-100)
    const total = summary.good + summary.bad + summary.neutral;
    const score = total > 0
      ? Math.round((summary.good / total) * 100 - (summary.bad / total) * 50 + 50)
      : 100;

    return {
      patterns: this.patterns,
      score,
      summary
    };
  }

  // Other required visitor methods
  protected visitClassDeclaration(node: ts.ClassDeclaration): void {}
  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {}
  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {}
  protected visitImportDeclaration(node: ts.ImportDeclaration): void {}
  protected visitExportDeclaration(node: ts.ExportDeclaration): void {}
  protected visitExportAssignment(node: ts.ExportAssignment): void {}
  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {}
  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {}
  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {}
  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {}
}