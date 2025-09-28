import * as ts from 'typescript';
import * as path from 'path';
import { ASTVisitor } from '../ASTVisitor';

export interface ImportInfo {
  source: string; // Module being imported from
  specifiers: ImportSpecifier[];
  isTypeOnly: boolean;
  isDynamic: boolean;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface ImportSpecifier {
  name: string; // Local name
  originalName?: string; // Name in source module (if different)
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'named' | 'default' | 're-export';
  source?: string; // For re-exports
  isTypeOnly: boolean;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface DependencyTree {
  file: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  dependencies: string[]; // Resolved module paths
  dependents: string[]; // Files that import this file
}

export class ImportExportTracker extends ASTVisitor<ImportInfo | ExportInfo> {
  private imports: ImportInfo[] = [];
  private exports: ExportInfo[] = [];
  private dynamicImports: ImportInfo[] = [];
  private dependencyMap: Map<string, Set<string>> = new Map();

  visit(sourceFile: ts.SourceFile): (ImportInfo | ExportInfo)[] {
    // Reset for new file
    this.imports = [];
    this.exports = [];
    this.dynamicImports = [];

    // Visit the source file
    super.visit(sourceFile);

    // Build dependency map
    const currentFile = sourceFile.fileName;
    const deps = new Set<string>();
    for (const imp of this.imports) {
      deps.add(imp.source);
    }
    this.dependencyMap.set(currentFile, deps);

    return [...this.imports, ...this.exports];
  }

  /**
   * Resolve module path
   */
  private resolveModulePath(moduleName: string, containingFile: string): string {
    // Handle relative paths
    if (moduleName.startsWith('.')) {
      const dir = path.dirname(containingFile);
      return path.resolve(dir, moduleName);
    }

    // Node modules or aliases - return as is
    return moduleName;
  }

  /**
   * Extract import specifiers
   */
  private extractImportSpecifiers(node: ts.ImportDeclaration): ImportSpecifier[] {
    const specifiers: ImportSpecifier[] = [];

    if (!node.importClause) {
      return specifiers;
    }

    // Default import
    if (node.importClause.name) {
      specifiers.push({
        name: node.importClause.name.text,
        isDefault: true,
        isNamespace: false
      });
    }

    // Named bindings
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        // import * as name from 'module'
        specifiers.push({
          name: node.importClause.namedBindings.name.text,
          isDefault: false,
          isNamespace: true
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        // import { name1, name2 as alias } from 'module'
        for (const element of node.importClause.namedBindings.elements) {
          specifiers.push({
            name: element.name.text,
            originalName: element.propertyName?.text,
            isDefault: false,
            isNamespace: false
          });
        }
      }
    }

    return specifiers;
  }

  protected visitImportDeclaration(node: ts.ImportDeclaration): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return;

    const source = moduleSpecifier.text;
    const resolvedPath = this.resolveModulePath(source, this.currentContext!.sourceFile.fileName);

    const importInfo: ImportInfo = {
      source: resolvedPath,
      specifiers: this.extractImportSpecifiers(node),
      isTypeOnly: !!node.importClause?.isTypeOnly,
      isDynamic: false,
      location: this.getNodeLocation(node)
    };

    this.imports.push(importInfo);
    this.results.push(importInfo);
  }

  protected visitCallExpression(node: ts.CallExpression): void {
    // Check for dynamic imports: import('module')
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const args = node.arguments;
      if (args.length > 0 && ts.isStringLiteral(args[0])) {
        const source = args[0].text;
        const resolvedPath = this.resolveModulePath(source, this.currentContext!.sourceFile.fileName);

        const importInfo: ImportInfo = {
          source: resolvedPath,
          specifiers: [], // Dynamic imports don't have specifiers
          isTypeOnly: false,
          isDynamic: true,
          location: this.getNodeLocation(node)
        };

        this.dynamicImports.push(importInfo);
        this.imports.push(importInfo);
        this.results.push(importInfo);
      }
    }
  }

  protected visitExportDeclaration(node: ts.ExportDeclaration): void {
    // Re-exports: export { name } from 'module'
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const source = node.moduleSpecifier.text;

      if (node.exportClause) {
        if (ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            const exportInfo: ExportInfo = {
              name: element.name.text,
              type: 're-export',
              source: this.resolveModulePath(source, this.currentContext!.sourceFile.fileName),
              isTypeOnly: node.isTypeOnly || false,
              location: this.getNodeLocation(element)
            };

            this.exports.push(exportInfo);
            this.results.push(exportInfo);
          }
        }
      } else {
        // export * from 'module'
        const exportInfo: ExportInfo = {
          name: '*',
          type: 're-export',
          source: this.resolveModulePath(source, this.currentContext!.sourceFile.fileName),
          isTypeOnly: node.isTypeOnly || false,
          location: this.getNodeLocation(node)
        };

        this.exports.push(exportInfo);
        this.results.push(exportInfo);
      }
    } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      // Named exports: export { name1, name2 }
      for (const element of node.exportClause.elements) {
        const exportInfo: ExportInfo = {
          name: element.name.text,
          type: 'named',
          isTypeOnly: node.isTypeOnly || false,
          location: this.getNodeLocation(element)
        };

        this.exports.push(exportInfo);
        this.results.push(exportInfo);
      }
    }
  }

  protected visitExportAssignment(node: ts.ExportAssignment): void {
    // export default ...
    const exportInfo: ExportInfo = {
      name: 'default',
      type: 'default',
      isTypeOnly: false,
      location: this.getNodeLocation(node)
    };

    this.exports.push(exportInfo);
    this.results.push(exportInfo);
  }

  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {
    if (this.isExported(node) && node.name) {
      const exportInfo: ExportInfo = {
        name: node.name.text,
        type: 'named',
        isTypeOnly: false,
        location: this.getNodeLocation(node)
      };

      this.exports.push(exportInfo);
      this.results.push(exportInfo);
    }
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {
    if (this.isExported(node) && node.name) {
      const exportInfo: ExportInfo = {
        name: node.name.text,
        type: 'named',
        isTypeOnly: false,
        location: this.getNodeLocation(node)
      };

      this.exports.push(exportInfo);
      this.results.push(exportInfo);
    }
  }

  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {
    // Check if parent variable statement is exported
    let parent: ts.Node | undefined = node.parent;
    while (parent) {
      if (ts.isVariableStatement(parent) && this.isExported(parent)) {
        const exportInfo: ExportInfo = {
          name: node.name.getText(),
          type: 'named',
          isTypeOnly: false,
          location: this.getNodeLocation(node)
        };

        this.exports.push(exportInfo);
        this.results.push(exportInfo);
        break;
      }
      parent = parent.parent;
    }
  }

  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
    if (this.isExported(node)) {
      const exportInfo: ExportInfo = {
        name: node.name.text,
        type: 'named',
        isTypeOnly: true,
        location: this.getNodeLocation(node)
      };

      this.exports.push(exportInfo);
      this.results.push(exportInfo);
    }
  }

  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    if (this.isExported(node)) {
      const exportInfo: ExportInfo = {
        name: node.name.text,
        type: 'named',
        isTypeOnly: true,
        location: this.getNodeLocation(node)
      };

      this.exports.push(exportInfo);
      this.results.push(exportInfo);
    }
  }

  /**
   * Build dependency tree for current file
   */
  buildDependencyTree(fileName: string): DependencyTree {
    const tree: DependencyTree = {
      file: fileName,
      imports: this.imports.filter(i => i.location.file === fileName),
      exports: this.exports.filter(e => e.location.file === fileName),
      dependencies: Array.from(this.dependencyMap.get(fileName) || []),
      dependents: []
    };

    // Find dependents
    for (const [file, deps] of this.dependencyMap) {
      if (deps.has(fileName)) {
        tree.dependents.push(file);
      }
    }

    return tree;
  }

  /**
   * Get all imports
   */
  getImports(): ImportInfo[] {
    return this.imports;
  }

  /**
   * Get all exports
   */
  getExports(): ExportInfo[] {
    return this.exports;
  }

  /**
   * Get dynamic imports
   */
  getDynamicImports(): ImportInfo[] {
    return this.dynamicImports;
  }

  protected visitFunctionExpression(node: ts.FunctionExpression): void {
    // Not relevant for import/export tracking
  }

  protected visitArrowFunction(node: ts.ArrowFunction): void {
    // Not relevant for import/export tracking
  }

  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {
    // Not relevant for import/export tracking
  }

  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {
    // Not relevant for import/export tracking
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {
    // Not relevant for import/export tracking
  }
}