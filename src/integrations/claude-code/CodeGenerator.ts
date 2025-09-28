import { ClaudeCodeWrapper } from './ClaudeCodeWrapper';

export interface GenerationRequest {
  type: 'component' | 'function' | 'class' | 'test' | 'module';
  name: string;
  description: string;
  specifications?: {
    props?: any[];
    methods?: any[];
    dependencies?: string[];
    patterns?: string[];
  };
  context?: {
    framework?: 'react' | 'vue' | 'angular' | 'node';
    language?: 'typescript' | 'javascript';
    style?: 'functional' | 'class-based';
  };
}

export interface GeneratedCode {
  code: string;
  language: string;
  fileName: string;
  dependencies: string[];
  imports: string[];
  exports: string[];
  tests?: string;
  documentation?: string;
}

export class CodeGenerator {
  private claude: ClaudeCodeWrapper;

  constructor(claudeWrapper?: ClaudeCodeWrapper) {
    this.claude = claudeWrapper || new ClaudeCodeWrapper({ outputFormat: 'json' });
  }

  /**
   * Generate code from graph description
   */
  async generateFromGraph(graphNodes: any[], targetType: string): Promise<GeneratedCode[]> {
    const prompt = this.buildGraphToCodePrompt(targetType);
    const graphData = this.formatGraphForGeneration(graphNodes);

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(graphData));

    if (!response.success) {
      throw new Error(`Code generation failed: ${response.error}`);
    }

    return this.parseGeneratedCode(response.data);
  }

  /**
   * Generate React component
   */
  async generateComponent(request: GenerationRequest): Promise<GeneratedCode> {
    const prompt = `Generate a React TypeScript component with these specifications:
    Name: ${request.name}
    Description: ${request.description}
    Props: ${JSON.stringify(request.specifications?.props || [])}
    Patterns: ${request.specifications?.patterns?.join(', ') || 'none'}

    Requirements:
    - Use functional component with TypeScript
    - Include proper prop types
    - Add JSDoc comments
    - Follow React best practices
    - Include hooks if needed

    Return JSON with:
    { code, imports[], exports[], dependencies[], fileName }`;

    const response = await this.claude.executeJson<any>(prompt);

    if (!response.success) {
      throw new Error(`Component generation failed: ${response.error}`);
    }

    return this.createGeneratedCode(response.data, 'component');
  }

  /**
   * Generate function implementation
   */
  async generateFunction(request: GenerationRequest): Promise<GeneratedCode> {
    const prompt = `Generate a TypeScript function with these specifications:
    Name: ${request.name}
    Description: ${request.description}
    Parameters: ${JSON.stringify(request.specifications?.props || [])}

    Requirements:
    - Include TypeScript types
    - Add JSDoc documentation
    - Handle errors properly
    - Follow functional programming principles where applicable

    Return JSON with:
    { code, imports[], exports[], documentation }`;

    const response = await this.claude.executeJson<any>(prompt);

    if (!response.success) {
      throw new Error(`Function generation failed: ${response.error}`);
    }

    return this.createGeneratedCode(response.data, 'function');
  }

  /**
   * Generate test suite
   */
  async generateTests(code: string, framework: 'jest' | 'mocha' | 'vitest' = 'jest'): Promise<GeneratedCode> {
    const prompt = `Generate comprehensive tests for this code using ${framework}:

    ${code}

    Requirements:
    - Test all functions/methods
    - Include edge cases
    - Mock dependencies
    - Achieve high coverage
    - Add descriptive test names

    Return JSON with:
    { code, imports[], description }`;

    const response = await this.claude.executeJson<any>(prompt, code);

    if (!response.success) {
      throw new Error(`Test generation failed: ${response.error}`);
    }

    return this.createGeneratedCode(response.data, 'test');
  }

  /**
   * Generate module from business requirements
   */
  async generateModule(businessRequirements: string): Promise<GeneratedCode[]> {
    const prompt = `Generate a complete TypeScript module based on these business requirements:

    ${businessRequirements}

    Create:
    1. Main module file with exports
    2. Type definitions
    3. Implementation functions
    4. Unit tests
    5. Documentation

    Return JSON array with each file:
    [{ fileName, code, type, imports[], exports[] }]`;

    const response = await this.claude.executeJson<any[]>(prompt);

    if (!response.success || !response.data) {
      throw new Error(`Module generation failed: ${response.error || 'No data returned'}`);
    }

    return response.data.map(file => this.createGeneratedCode(file, 'module'));
  }

  /**
   * Apply generated code to files
   */
  async applyToFile(generatedCode: GeneratedCode, targetPath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.join(targetPath, generatedCode.fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, generatedCode.code, 'utf8');

    // Write test file if exists
    if (generatedCode.tests) {
      const testPath = filePath.replace('.ts', '.test.ts').replace('.tsx', '.test.tsx');
      fs.writeFileSync(testPath, generatedCode.tests, 'utf8');
    }
  }

  /**
   * Validate generated code syntax
   */
  async validateCode(code: string, language: 'typescript' | 'javascript' = 'typescript'): Promise<boolean> {
    if (language === 'typescript') {
      return this.validateTypeScript(code);
    }
    return this.validateJavaScript(code);
  }

  /**
   * Build graph-to-code prompt
   */
  private buildGraphToCodePrompt(targetType: string): string {
    return `Generate ${targetType} code from this graph structure:

    Analyze the nodes and relationships to create:
    1. Appropriate components/functions
    2. Proper data flow
    3. Type definitions
    4. Module structure

    Requirements:
    - TypeScript with strict types
    - Follow best practices
    - Include error handling
    - Add documentation

    Return JSON array with generated files:
    [{ fileName, code, type, imports[], exports[], dependencies[] }]`;
  }

  /**
   * Format graph for code generation
   */
  private formatGraphForGeneration(graphNodes: any[]): any {
    return {
      nodes: graphNodes.map(node => ({
        id: node.id,
        type: node.type,
        name: node.label || node.name,
        properties: node.metadata,
        connections: node.connections || []
      })),
      relationships: this.extractRelationships(graphNodes),
      patterns: this.identifyPatterns(graphNodes)
    };
  }

  /**
   * Extract relationships from graph nodes
   */
  private extractRelationships(nodes: any[]): any[] {
    const relationships: any[] = [];

    nodes.forEach(node => {
      if (node.connections) {
        node.connections.forEach((conn: any) => {
          relationships.push({
            from: node.id,
            to: conn.target,
            type: conn.type
          });
        });
      }
    });

    return relationships;
  }

  /**
   * Identify patterns in graph
   */
  private identifyPatterns(nodes: any[]): string[] {
    const patterns: string[] = [];

    // Check for common patterns
    const hasComponents = nodes.some(n => n.type === 'component');
    const hasServices = nodes.some(n => n.type === 'service');
    const hasModels = nodes.some(n => n.type === 'model');

    if (hasComponents && hasServices) {
      patterns.push('mvc');
    }
    if (hasServices && hasModels) {
      patterns.push('layered');
    }
    if (nodes.length > 10) {
      patterns.push('modular');
    }

    return patterns;
  }

  /**
   * Parse generated code response
   */
  private parseGeneratedCode(data: any): GeneratedCode[] {
    if (Array.isArray(data)) {
      return data.map(item => this.createGeneratedCode(item, item.type));
    }
    return [this.createGeneratedCode(data, 'unknown')];
  }

  /**
   * Create GeneratedCode object
   */
  private createGeneratedCode(data: any, type: string): GeneratedCode {
    return {
      code: data.code || '',
      language: data.language || 'typescript',
      fileName: data.fileName || `${type}.ts`,
      dependencies: data.dependencies || [],
      imports: data.imports || [],
      exports: data.exports || [],
      tests: data.tests,
      documentation: data.documentation
    };
  }

  /**
   * Validate TypeScript code
   */
  private async validateTypeScript(code: string): Promise<boolean> {
    try {
      const ts = await import('typescript');

      const result = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ESNext,
          jsx: ts.JsxEmit.React,
          strict: true
        }
      });

      return result.diagnostics?.length === 0;
    } catch (error) {
      console.error('TypeScript validation error:', error);
      return false;
    }
  }

  /**
   * Validate JavaScript code
   */
  private validateJavaScript(code: string): boolean {
    try {
      // Basic syntax check using Function constructor
      new Function(code);
      return true;
    } catch (error) {
      console.error('JavaScript validation error:', error);
      return false;
    }
  }

  /**
   * Create prompt template
   */
  createPromptTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), JSON.stringify(value));
    });

    return result;
  }

  /**
   * Generate code snippet
   */
  async generateSnippet(description: string): Promise<string> {
    const response = await this.claude.execute(
      `Generate a code snippet for: ${description}. Return only the code, no explanation.`
    );

    return response.trim();
  }
}

// Export singleton for convenience
export const codeGenerator = new CodeGenerator();