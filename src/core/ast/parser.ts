import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileInfo,
  ImportDeclaration,
  ExportDeclaration,
  ComponentInfo,
  FunctionInfo,
  SourceLocation,
  PropInfo,
  HookInfo,
  ParameterInfo,
  FunctionCall
} from '../../types';

export class ASTParser {
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

  public parseFile(filePath: string): {
    imports: ImportDeclaration[];
    exports: ExportDeclaration[];
    components: ComponentInfo[];
    functions: FunctionInfo[];
  } {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${filePath}`);
    }

    const result = {
      imports: this.extractImports(sourceFile),
      exports: this.extractExports(sourceFile),
      components: this.extractComponents(sourceFile),
      functions: this.extractFunctions(sourceFile)
    };

    return result;
  }

  private extractImports(sourceFile: ts.SourceFile): ImportDeclaration[] {
    const imports: ImportDeclaration[] = [];

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifiers: string[] = [];
        let isDefault = false;
        let isNamespace = false;

        if (node.importClause) {
          // Default import
          if (node.importClause.name) {
            specifiers.push(node.importClause.name.text);
            isDefault = true;
          }

          // Named imports
          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              specifiers.push(node.importClause.namedBindings.name.text);
              isNamespace = true;
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach((element) => {
                specifiers.push(element.name.text);
              });
            }
          }
        }

        imports.push({
          source: node.moduleSpecifier.text,
          specifiers,
          isDefault,
          isNamespace,
          location: this.getSourceLocation(node, sourceFile)
        });
      }
    });

    return imports;
  }

  private extractExports(sourceFile: ts.SourceFile): ExportDeclaration[] {
    const exports: ExportDeclaration[] = [];

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node)) {
        let name: string | undefined;
        let source: string | undefined;
        let isDefault = false;
        let isNamespace = false;

        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          source = node.moduleSpecifier.text;
        }

        if (node.exportClause) {
          if (ts.isNamespaceExport(node.exportClause)) {
            name = node.exportClause.name.text;
            isNamespace = true;
          } else if (ts.isNamedExports(node.exportClause)) {
            // Handle multiple named exports
            node.exportClause.elements.forEach((element) => {
              exports.push({
                name: element.name.text,
                source,
                isDefault: false,
                isNamespace: false,
                location: this.getSourceLocation(element, sourceFile)
              });
            });
            return; // Skip the main push at the end
          }
        }

        exports.push({
          name,
          source,
          isDefault,
          isNamespace,
          location: this.getSourceLocation(node, sourceFile)
        });
      }

      // Export assignments and default exports
      if (ts.isExportAssignment(node)) {
        exports.push({
          name: node.isExportEquals ? undefined : 'default',
          isDefault: !node.isExportEquals,
          isNamespace: false,
          location: this.getSourceLocation(node, sourceFile)
        });
      }
    });

    return exports;
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

  private extractFunctions(sourceFile: ts.SourceFile): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(this.createFunctionInfo(node, sourceFile));
      }

      // Arrow functions in variable declarations
      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        if (node.initializer && ts.isArrowFunction(node.initializer)) {
          functions.push(this.createFunctionInfoFromArrow(node, sourceFile));
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  private returnsJSX(node: ts.FunctionDeclaration | ts.ArrowFunction): boolean {
    // Check if function returns JSX by looking for JSX elements
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

  private createFunctionInfo(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): FunctionInfo {
    return {
      name: node.name ? node.name.text : 'anonymous',
      filePath: sourceFile.fileName,
      parameters: this.extractParameters(node.parameters),
      returnType: this.getReturnType(node),
      isAsync: !!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword),
      isExported: this.isExported(node),
      calls: this.extractFunctionCalls(node),
      location: this.getSourceLocation(node, sourceFile)
    };
  }

  private createFunctionInfoFromArrow(node: ts.VariableDeclaration, sourceFile: ts.SourceFile): FunctionInfo {
    const arrowFunction = node.initializer as ts.ArrowFunction;

    return {
      name: node.name.getText(),
      filePath: sourceFile.fileName,
      parameters: this.extractParameters(arrowFunction.parameters),
      returnType: this.getReturnTypeFromArrow(arrowFunction),
      isAsync: !!arrowFunction.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword),
      isExported: this.isExported(node),
      calls: this.extractFunctionCalls(arrowFunction),
      location: this.getSourceLocation(node, sourceFile)
    };
  }

  private extractProps(node: ts.Node): PropInfo[] {
    // Extract props from function parameters or class component props interface
    const props: PropInfo[] = [];

    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      if (node.parameters.length > 0) {
        const propsParam = node.parameters[0];
        if (propsParam.type) {
          // Extract props from type annotation
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
            defaultValue: undefined // Could be extracted from default parameters
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
    // Extract dependencies from useEffect, useCallback, useMemo
    if (callExpression.arguments.length > 1) {
      const depsArg = callExpression.arguments[1];
      if (ts.isArrayLiteralExpression(depsArg)) {
        return depsArg.elements.map(el => el.getText()).filter(Boolean);
      }
    }
    return [];
  }

  private extractParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): ParameterInfo[] {
    return parameters.map(param => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      isOptional: !!param.questionToken,
      defaultValue: param.initializer ? param.initializer.getText() : undefined
    }));
  }

  private getReturnType(node: ts.FunctionDeclaration): string {
    if (node.type) {
      return node.type.getText();
    }

    // Try to infer return type from TypeScript checker
    const symbol = this.checker.getSymbolAtLocation(node.name!);
    if (symbol) {
      const type = this.checker.getTypeOfSymbolAtLocation(symbol, node);
      const signature = this.checker.getSignaturesOfType(type, ts.SignatureKind.Call)[0];
      if (signature) {
        return this.checker.typeToString(signature.getReturnType());
      }
    }

    return 'any';
  }

  private getReturnTypeFromArrow(node: ts.ArrowFunction): string {
    if (node.type) {
      return node.type.getText();
    }
    return 'any';
  }

  private isExported(node: ts.Node): boolean {
    return !!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
  }

  private extractFunctionCalls(node: ts.Node): FunctionCall[] {
    const calls: FunctionCall[] = [];

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        let name = 'unknown';
        if (ts.isIdentifier(n.expression)) {
          name = n.expression.text;
        } else if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.name)) {
          name = n.expression.name.text;
        }

        calls.push({
          name,
          arguments: n.arguments.map(arg => arg.getText()),
          location: this.getSourceLocation(n, node.getSourceFile())
        });
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return calls;
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