import * as ts from 'typescript';
import { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';
import {
  ComponentInfo,
  PropInfo,
  HookInfo,
  SourceLocation,
  ParameterInfo,
  FunctionCall
} from '../types';

export interface ReactAnalysisResult {
  components: ComponentInfo[];
  hooks: HookInfo[];
  propFlows: Array<{
    from: string;
    to: string;
    propName: string;
    propType: string;
  }>;
  contextUsage: Array<{
    context: string;
    consumers: string[];
    provider?: string;
  }>;
}

export class ReactASTParser {
  private program: ts.Program;
  private checker: ts.TypeChecker;

  constructor(fileNames: string[], compilerOptions: ts.CompilerOptions = {}) {
    this.program = ts.createProgram(fileNames, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      allowJs: true,
      declaration: true,
      esModuleInterop: true,
      ...compilerOptions
    });
    this.checker = this.program.getTypeChecker();
  }

  /**
   * Analyzes React components in an Nx project
   */
  public analyzeNxProject(projectNode: ProjectGraphProjectNode): ReactAnalysisResult {
    const projectRoot = projectNode.data.root;
    const sourceFiles = this.program.getSourceFiles().filter(sf =>
      sf.fileName.includes(projectRoot) &&
      !sf.fileName.includes('node_modules')
    );

    const components: ComponentInfo[] = [];
    const allHooks: HookInfo[] = [];

    sourceFiles.forEach(sourceFile => {
      const fileComponents = this.extractComponents(sourceFile);
      components.push(...fileComponents);

      fileComponents.forEach(component => {
        allHooks.push(...component.hooks);
      });
    });

    return {
      components,
      hooks: allHooks,
      propFlows: this.analyzePropFlows(components),
      contextUsage: this.analyzeContextUsage(components)
    };
  }

  private extractComponents(sourceFile: ts.SourceFile): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    const visit = (node: ts.Node) => {
      // Function declarations that return JSX
      if (ts.isFunctionDeclaration(node) && node.name) {
        if (this.returnsJSX(node)) {
          components.push(this.createComponentInfo(node, sourceFile, 'function'));
        }
      }

      // Variable declarations with arrow functions that return JSX
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        if (node.initializer && ts.isArrowFunction(node.initializer)) {
          if (this.returnsJSX(node.initializer)) {
            components.push(this.createComponentInfo(node, sourceFile, 'arrow'));
          }
        }
      }

      // Class components
      if (ts.isClassDeclaration(node) && node.name) {
        if (this.isReactClassComponent(node)) {
          components.push(this.createComponentInfo(node, sourceFile, 'class'));
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  private returnsJSX(node: ts.FunctionDeclaration | ts.ArrowFunction): boolean {
    const hasJSX = { found: false };

    const visit = (n: ts.Node) => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        hasJSX.found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };

    if (node.body) {
      visit(node.body);
    }

    return hasJSX.found;
  }

  private isReactClassComponent(node: ts.ClassDeclaration): boolean {
    if (!node.heritageClauses) return false;

    return node.heritageClauses.some(clause =>
      clause.token === ts.SyntaxKind.ExtendsKeyword &&
      clause.types.some(type => {
        const typeName = type.expression;
        if (ts.isIdentifier(typeName)) {
          return typeName.text === 'Component' || typeName.text === 'PureComponent';
        }
        return false;
      })
    );
  }

  private createComponentInfo(
    node: ts.FunctionDeclaration | ts.VariableDeclaration | ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    type: 'function' | 'class' | 'arrow'
  ): ComponentInfo {
    const name = node.name ? node.name.getText() : 'Anonymous';

    return {
      name,
      filePath: sourceFile.fileName,
      type,
      props: this.extractProps(node),
      hooks: this.extractHooks(node),
      children: [], // Will be populated in post-processing
      location: this.getSourceLocation(node, sourceFile)
    };
  }

  private extractProps(node: ts.Node): PropInfo[] {
    const props: PropInfo[] = [];

    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      if (node.parameters.length > 0) {
        const propsParam = node.parameters[0];
        if (propsParam.type) {
          props.push(...this.extractPropsFromType(propsParam.type));
        }
      }
    }

    return props;
  }

  private extractPropsFromType(typeNode: ts.TypeNode): PropInfo[] {
    const props: PropInfo[] = [];

    if (ts.isTypeLiteralNode(typeNode)) {
      typeNode.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          props.push({
            name: member.name.text,
            type: member.type ? member.type.getText() : 'any',
            isRequired: !member.questionToken,
            defaultValue: undefined
          });
        }
      });
    }

    return props;
  }

  private extractHooks(node: ts.Node): HookInfo[] {
    const hooks: HookInfo[] = [];

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const hookName = n.expression.text;
        if (hookName.startsWith('use')) {
          hooks.push({
            name: hookName,
            type: this.getHookType(hookName),
            dependencies: this.extractHookDependencies(n),
            location: this.getSourceLocation(n, node.getSourceFile())
          });
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return hooks;
  }

  private getHookType(hookName: string): HookInfo['type'] {
    if (hookName === 'useState') return 'useState';
    if (hookName === 'useEffect') return 'useEffect';
    if (hookName === 'useContext') return 'useContext';
    if (['useCallback', 'useMemo', 'useRef', 'useReducer'].includes(hookName)) return 'other';
    return 'custom';
  }

  private extractHookDependencies(callExpression: ts.CallExpression): string[] {
    if (callExpression.arguments.length > 1) {
      const depsArg = callExpression.arguments[1];
      if (ts.isArrayLiteralExpression(depsArg)) {
        return depsArg.elements.map(el => el.getText()).filter(Boolean);
      }
    }
    return [];
  }

  private analyzePropFlows(components: ComponentInfo[]) {
    const propFlows: Array<{from: string, to: string, propName: string, propType: string}> = [];

    components.forEach(component => {
      component.children.forEach(child => {
        child.props.forEach(prop => {
          propFlows.push({
            from: `${component.filePath}#${component.name}`,
            to: `${child.filePath}#${child.name}`,
            propName: prop.name,
            propType: prop.type
          });
        });
      });
    });

    return propFlows;
  }

  private analyzeContextUsage(components: ComponentInfo[]) {
    const contextUsage: Array<{context: string, consumers: string[], provider?: string}> = [];
    const contextMap = new Map<string, {consumers: string[], provider?: string}>();

    components.forEach(component => {
      component.hooks.forEach(hook => {
        if (hook.type === 'useContext') {
          const contextName = hook.name.replace('use', '').replace('Context', '') + 'Context';
          const componentId = `${component.filePath}#${component.name}`;

          if (!contextMap.has(contextName)) {
            contextMap.set(contextName, { consumers: [], provider: undefined });
          }

          contextMap.get(contextName)!.consumers.push(componentId);
        }
      });

      // Detect potential providers (simplified)
      if (component.name.toLowerCase().includes('provider')) {
        const possibleContext = component.name.replace('Provider', '') + 'Context';
        if (!contextMap.has(possibleContext)) {
          contextMap.set(possibleContext, { consumers: [], provider: undefined });
        }
        contextMap.get(possibleContext)!.provider = `${component.filePath}#${component.name}`;
      }
    });

    contextMap.forEach((value, context) => {
      contextUsage.push({
        context,
        consumers: value.consumers,
        provider: value.provider
      });
    });

    return contextUsage;
  }

  private getSourceLocation(node: ts.Node, sourceFile: ts.SourceFile): SourceLocation {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      start: { line: start.line + 1, column: start.character + 1 },
      end: { line: end.line + 1, column: end.character + 1 }
    };
  }
}