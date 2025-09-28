import * as ts from 'typescript';
import { ASTVisitor } from '../ASTVisitor';

export interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  members?: MemberInfo[];
  generics?: GenericInfo[];
  extends?: string[];
  implements?: string[];
  isExported: boolean;
  location: {
    file: string;
    line: number;
    column: number;
  };
}

export interface MemberInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isReadonly: boolean;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

export interface GenericInfo {
  name: string;
  constraint?: string;
  default?: string;
}

export interface TypeHierarchy {
  type: string;
  extends: string[];
  implements: string[];
  children: TypeHierarchy[];
}

export class TypeExtractor extends ASTVisitor<TypeInfo> {
  private typeHierarchy: Map<string, Set<string>> = new Map();

  /**
   * Extract interface members
   */
  private extractInterfaceMembers(node: ts.InterfaceDeclaration): MemberInfo[] {
    const members: MemberInfo[] = [];

    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const type = member.type ? member.type.getText() : 'any';
        members.push({
          name: member.name.getText(),
          type,
          isOptional: !!member.questionToken,
          isReadonly: !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)
        });
      } else if (ts.isMethodSignature(member) && member.name) {
        const signature = this.checker.getSignatureFromDeclaration(member);
        const type = signature ? this.checker.signatureToString(signature) : 'Function';
        members.push({
          name: member.name.getText(),
          type,
          isOptional: !!member.questionToken,
          isReadonly: false
        });
      }
    }

    return members;
  }

  /**
   * Extract type alias definition
   */
  private extractTypeDefinition(node: ts.TypeAliasDeclaration): MemberInfo[] {
    const members: MemberInfo[] = [];

    if (node.type && ts.isTypeLiteralNode(node.type)) {
      for (const member of node.type.members) {
        if (ts.isPropertySignature(member) && member.name) {
          const type = member.type ? member.type.getText() : 'any';
          members.push({
            name: member.name.getText(),
            type,
            isOptional: !!member.questionToken,
            isReadonly: !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)
          });
        }
      }
    }

    return members;
  }

  /**
   * Extract class members
   */
  private extractClassMembers(node: ts.ClassDeclaration): MemberInfo[] {
    const members: MemberInfo[] = [];

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member) && member.name) {
        const type = member.type ? member.type.getText() :
                    this.getNodeType(member) ? this.checker.typeToString(this.getNodeType(member)!) :
                    'any';
        const flags = ts.getCombinedModifierFlags(member as ts.Declaration);

        members.push({
          name: member.name.getText(),
          type,
          isOptional: !!member.questionToken,
          isReadonly: !!(flags & ts.ModifierFlags.Readonly),
          isStatic: !!(flags & ts.ModifierFlags.Static),
          visibility: this.getVisibility(member)
        });
      } else if (ts.isMethodDeclaration(member) && member.name) {
        const signature = this.checker.getSignatureFromDeclaration(member);
        const type = signature ? this.checker.signatureToString(signature) : 'Function';
        const flags = ts.getCombinedModifierFlags(member as ts.Declaration);

        members.push({
          name: member.name.getText(),
          type,
          isOptional: !!member.questionToken,
          isReadonly: false,
          isStatic: !!(flags & ts.ModifierFlags.Static),
          visibility: this.getVisibility(member)
        });
      }
    }

    return members;
  }

  /**
   * Extract generic parameters
   */
  private extractGenerics(typeParams?: ts.NodeArray<ts.TypeParameterDeclaration>): GenericInfo[] {
    if (!typeParams) return [];

    return typeParams.map(param => ({
      name: param.name.text,
      constraint: param.constraint?.getText(),
      default: param.default?.getText()
    }));
  }

  /**
   * Extract heritage clauses (extends/implements)
   */
  private extractHeritage(node: ts.ClassDeclaration | ts.InterfaceDeclaration): { extends: string[], implements: string[] } {
    const result: { extends: string[], implements: string[] } = { extends: [], implements: [] };

    if (!node.heritageClauses) return result;

    for (const clause of node.heritageClauses) {
      const types = clause.types.map(t => t.expression.getText());

      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        result.extends = types;
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        result.implements = types;
      }
    }

    return result;
  }

  /**
   * Get member visibility
   */
  private getVisibility(member: ts.ClassElement): 'public' | 'private' | 'protected' {
    // Use getCombinedModifierFlags which works with ClassElement
    const flags = ts.getCombinedModifierFlags(member as ts.Declaration);

    if (flags & ts.ModifierFlags.Private) return 'private';
    if (flags & ts.ModifierFlags.Protected) return 'protected';
    if (flags & ts.ModifierFlags.Public) return 'public';

    return 'public';
  }

  protected visitInterfaceDeclaration(node: ts.InterfaceDeclaration): void {
    const heritage = this.extractHeritage(node);

    const typeInfo: TypeInfo = {
      name: node.name.text,
      kind: 'interface',
      members: this.extractInterfaceMembers(node),
      generics: this.extractGenerics(node.typeParameters),
      extends: heritage.extends,
      isExported: this.isExported(node),
      location: this.getNodeLocation(node)
    };

    this.results.push(typeInfo);

    // Update type hierarchy
    if (heritage.extends.length > 0) {
      this.typeHierarchy.set(node.name.text, new Set(heritage.extends));
    }
  }

  protected visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration): void {
    const typeInfo: TypeInfo = {
      name: node.name.text,
      kind: 'type',
      members: this.extractTypeDefinition(node),
      generics: this.extractGenerics(node.typeParameters),
      isExported: this.isExported(node),
      location: this.getNodeLocation(node)
    };

    this.results.push(typeInfo);
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration): void {
    if (!node.name) return;

    const heritage = this.extractHeritage(node);

    const typeInfo: TypeInfo = {
      name: node.name.text,
      kind: 'class',
      members: this.extractClassMembers(node),
      generics: this.extractGenerics(node.typeParameters),
      extends: heritage.extends,
      implements: heritage.implements,
      isExported: this.isExported(node),
      location: this.getNodeLocation(node)
    };

    this.results.push(typeInfo);

    // Update type hierarchy
    if (heritage.extends.length > 0 || heritage.implements.length > 0) {
      this.typeHierarchy.set(
        node.name.text,
        new Set([...heritage.extends, ...heritage.implements])
      );
    }
  }

  /**
   * Build complete type hierarchy
   */
  buildTypeHierarchy(): TypeHierarchy[] {
    const roots: TypeHierarchy[] = [];
    const processed = new Set<string>();

    const buildNode = (typeName: string): TypeHierarchy => {
      const typeInfo = this.results.find(t => t.name === typeName);
      const children: TypeHierarchy[] = [];

      // Find all types that extend/implement this type
      for (const [child, parents] of this.typeHierarchy) {
        if (parents.has(typeName) && !processed.has(child)) {
          processed.add(child);
          children.push(buildNode(child));
        }
      }

      return {
        type: typeName,
        extends: typeInfo?.extends || [],
        implements: typeInfo?.implements || [],
        children
      };
    };

    // Find root types (not extending anything)
    for (const typeInfo of this.results) {
      if (!this.typeHierarchy.has(typeInfo.name) && !processed.has(typeInfo.name)) {
        processed.add(typeInfo.name);
        roots.push(buildNode(typeInfo.name));
      }
    }

    return roots;
  }

  // These methods are not used in TypeExtractor but need to be implemented
  protected visitFunctionDeclaration(node: ts.FunctionDeclaration): void {}
  protected visitFunctionExpression(node: ts.FunctionExpression): void {}
  protected visitArrowFunction(node: ts.ArrowFunction): void {}
  protected visitImportDeclaration(node: ts.ImportDeclaration): void {}
  protected visitExportDeclaration(node: ts.ExportDeclaration): void {}
  protected visitExportAssignment(node: ts.ExportAssignment): void {}
  protected visitVariableDeclaration(node: ts.VariableDeclaration): void {}
  protected visitCallExpression(node: ts.CallExpression): void {}
  protected visitJsxElement(node: ts.JsxElement | ts.JsxSelfClosingElement): void {}
  protected visitPropertyAccess(node: ts.PropertyAccessExpression): void {}
  protected visitMethodDeclaration(node: ts.MethodDeclaration): void {}
}