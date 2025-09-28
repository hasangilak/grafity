import * as ts from 'typescript';
import { ClaudeCodeWrapper } from '../ClaudeCodeWrapper';
import { ComponentInfo, FunctionInfo } from '../../../../client/src/types';

export interface ASTInsight {
  nodeType: string;
  name: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  semanticMeaning: string;
  businessContext?: string;
  patterns?: string[];
  suggestions?: string[];
  confidence: number;
}

export interface ASTAnalysisResult {
  insights: ASTInsight[];
  summary: {
    totalNodes: number;
    componentCount: number;
    functionCount: number;
    complexityScore: number;
    patterns: string[];
  };
}

export class ASTAnalysis {
  private claude: ClaudeCodeWrapper;

  constructor(claudeWrapper?: ClaudeCodeWrapper) {
    this.claude = claudeWrapper || new ClaudeCodeWrapper({ outputFormat: 'json' });
  }

  /**
   * Analyze AST nodes and extract semantic insights
   */
  async analyzeAST(
    sourceFile: ts.SourceFile,
    filePath: string
  ): Promise<ASTAnalysisResult> {
    const astData = this.extractASTData(sourceFile, filePath);
    const prompt = this.buildAnalysisPrompt();

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(astData));

    if (!response.success) {
      throw new Error(`AST analysis failed: ${response.error}`);
    }

    return this.parseInsights(response.data, astData);
  }

  /**
   * Analyze React component AST
   */
  async analyzeComponent(component: ComponentInfo): Promise<ASTInsight> {
    const componentData = this.formatComponentForAnalysis(component);

    const prompt = `Analyze this React component and provide insights:
    - Identify its business purpose
    - Detect patterns (hooks, props, state management)
    - Suggest improvements
    - Rate complexity (1-10)

    Return JSON with: { purpose, patterns[], improvements[], complexity, confidence }`;

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(componentData));

    if (!response.success || !response.data) {
      throw new Error(`Component analysis failed: ${response.error || 'No data returned'}`);
    }

    return this.createComponentInsight(component, response.data);
  }

  /**
   * Analyze function implementation
   */
  async analyzeFunction(func: FunctionInfo): Promise<ASTInsight> {
    const functionData = this.formatFunctionForAnalysis(func);

    const prompt = `Analyze this function and provide insights:
    - What is its business purpose?
    - What patterns does it implement?
    - Are there any anti-patterns or issues?
    - Complexity score (1-10)

    Return JSON with: { purpose, patterns[], issues[], complexity, suggestions[], confidence }`;

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(functionData));

    if (!response.success || !response.data) {
      throw new Error(`Function analysis failed: ${response.error || 'No data returned'}`);
    }

    return this.createFunctionInsight(func, response.data);
  }

  /**
   * Batch analyze multiple AST nodes
   */
  async batchAnalyze(nodes: any[]): Promise<ASTInsight[]> {
    const batchData = nodes.map(node => this.formatNodeForAnalysis(node));

    const prompt = `Analyze these code elements and provide insights for each:
    - Business purpose
    - Patterns and anti-patterns
    - Relationships between elements
    - Overall architecture assessment

    Return JSON array with insights for each element`;

    const response = await this.claude.executeJson<any[]>(prompt, JSON.stringify(batchData));

    if (!response.success || !response.data) {
      throw new Error(`Batch analysis failed: ${response.error || 'No data returned'}`);
    }

    return response.data.map((insight, index) =>
      this.createInsight(nodes[index], insight)
    );
  }

  /**
   * Extract AST data for analysis
   */
  private extractASTData(sourceFile: ts.SourceFile, filePath: string): any {
    const components: any[] = [];
    const functions: any[] = [];
    const classes: any[] = [];
    const hooks: any[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
        const name = (node as any).name?.getText() || 'anonymous';

        // Check if it's a React component
        if (this.isReactComponent(node)) {
          components.push(this.extractNodeInfo(node, name, filePath));
        } else if (name.startsWith('use')) {
          hooks.push(this.extractNodeInfo(node, name, filePath));
        } else {
          functions.push(this.extractNodeInfo(node, name, filePath));
        }
      } else if (ts.isClassDeclaration(node)) {
        const name = node.name?.getText() || 'anonymous';
        classes.push(this.extractNodeInfo(node, name, filePath));
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      filePath,
      components,
      functions,
      classes,
      hooks,
      stats: {
        totalNodes: this.countNodes(sourceFile),
        lineCount: sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line
      }
    };
  }

  /**
   * Check if node is a React component
   */
  private isReactComponent(node: ts.Node): boolean {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      const name = (node as any).name?.getText() || '';
      // React components typically start with uppercase
      return /^[A-Z]/.test(name);
    }
    return false;
  }

  /**
   * Extract node information
   */
  private extractNodeInfo(node: ts.Node, name: string, filePath: string): any {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    return {
      name,
      type: ts.SyntaxKind[node.kind],
      location: {
        file: filePath,
        line: line + 1,
        column: character + 1
      },
      text: node.getText().substring(0, 500), // First 500 chars
      children: node.getChildCount()
    };
  }

  /**
   * Count total nodes in AST
   */
  private countNodes(node: ts.Node): number {
    let count = 1;
    ts.forEachChild(node, child => {
      count += this.countNodes(child);
    });
    return count;
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(): string {
    return `Analyze this TypeScript/React code structure and provide semantic insights:

    For each component/function/class:
    1. Identify its business purpose and domain context
    2. Detect design patterns and anti-patterns
    3. Assess code quality and complexity
    4. Suggest improvements
    5. Identify relationships with other elements

    Return JSON with:
    {
      "insights": [
        {
          "element": "name",
          "type": "component|function|class|hook",
          "purpose": "business purpose",
          "patterns": ["pattern1", "pattern2"],
          "antiPatterns": ["issue1"],
          "complexity": 1-10,
          "suggestions": ["improvement1"],
          "relationships": ["related elements"],
          "confidence": 0.0-1.0
        }
      ],
      "summary": {
        "overallQuality": "assessment",
        "architecturalPatterns": ["patterns"],
        "recommendations": ["recommendations"]
      }
    }`;
  }

  /**
   * Format component for analysis
   */
  private formatComponentForAnalysis(component: ComponentInfo): any {
    return {
      name: component.name,
      type: component.type,
      props: component.props,
      hooks: component.hooks,
      hasState: component.hooks?.some((h: any) => h.name === 'useState'),
      hasEffects: component.hooks?.some((h: any) => h.name === 'useEffect'),
      complexity: (component as any).complexity || 0,
      lineCount: (component as any).lineCount || 0
    };
  }

  /**
   * Format function for analysis
   */
  private formatFunctionForAnalysis(func: FunctionInfo): any {
    return {
      name: func.name,
      parameters: func.parameters,
      returnType: func.returnType,
      async: func.isAsync,
      complexity: (func as any).complexity || 0,
      lineCount: (func as any).lineCount || 0,
      calls: func.calls || []
    };
  }

  /**
   * Format node for analysis
   */
  private formatNodeForAnalysis(node: any): any {
    return {
      name: node.name || 'unknown',
      type: node.type || 'unknown',
      location: node.location,
      metrics: {
        complexity: node.complexity || 0,
        lineCount: node.lineCount || 0
      }
    };
  }

  /**
   * Parse insights from Claude response
   */
  private parseInsights(claudeData: any, astData: any): ASTAnalysisResult {
    const insights: ASTInsight[] = [];

    // Process component insights
    if (claudeData.insights) {
      for (const insight of claudeData.insights) {
        insights.push({
          nodeType: insight.type,
          name: insight.element,
          location: this.findLocation(insight.element, astData),
          semanticMeaning: insight.purpose,
          businessContext: insight.purpose,
          patterns: insight.patterns,
          suggestions: insight.suggestions,
          confidence: insight.confidence || 0.8
        });
      }
    }

    return {
      insights,
      summary: {
        totalNodes: astData.stats.totalNodes,
        componentCount: astData.components.length,
        functionCount: astData.functions.length,
        complexityScore: this.calculateComplexity(insights),
        patterns: claudeData.summary?.architecturalPatterns || []
      }
    };
  }

  /**
   * Create component insight
   */
  private createComponentInsight(component: ComponentInfo, claudeData: any): ASTInsight {
    return {
      nodeType: 'component',
      name: component.name,
      location: {
        file: component.filePath || '',
        line: (component as any).startLine || component.location?.start?.line || 0,
        column: 0
      },
      semanticMeaning: claudeData.purpose || 'React component',
      businessContext: claudeData.purpose,
      patterns: claudeData.patterns || [],
      suggestions: claudeData.improvements || [],
      confidence: claudeData.confidence || 0.8
    };
  }

  /**
   * Create function insight
   */
  private createFunctionInsight(func: FunctionInfo, claudeData: any): ASTInsight {
    return {
      nodeType: 'function',
      name: func.name,
      location: {
        file: func.filePath || '',
        line: (func as any).startLine || func.location?.start?.line || 0,
        column: 0
      },
      semanticMeaning: claudeData.purpose || 'Function',
      businessContext: claudeData.purpose,
      patterns: claudeData.patterns || [],
      suggestions: claudeData.suggestions || [],
      confidence: claudeData.confidence || 0.8
    };
  }

  /**
   * Create generic insight
   */
  private createInsight(node: any, claudeData: any): ASTInsight {
    return {
      nodeType: node.type || 'unknown',
      name: node.name || 'unknown',
      location: node.location || { file: '', line: 0, column: 0 },
      semanticMeaning: claudeData.purpose || '',
      businessContext: claudeData.businessContext,
      patterns: claudeData.patterns || [],
      suggestions: claudeData.suggestions || [],
      confidence: claudeData.confidence || 0.7
    };
  }

  /**
   * Find location of element in AST data
   */
  private findLocation(elementName: string, astData: any): any {
    // Search in components
    const component = astData.components.find((c: any) => c.name === elementName);
    if (component) return component.location;

    // Search in functions
    const func = astData.functions.find((f: any) => f.name === elementName);
    if (func) return func.location;

    // Search in classes
    const cls = astData.classes.find((c: any) => c.name === elementName);
    if (cls) return cls.location;

    // Default location
    return { file: astData.filePath, line: 0, column: 0 };
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexity(insights: ASTInsight[]): number {
    if (insights.length === 0) return 0;

    const complexities = insights.map(i => {
      // Extract complexity from patterns or suggestions
      const hasComplexPatterns = (i.patterns?.length || 0) > 3;
      const hasSuggestions = (i.suggestions?.length || 0) > 0;
      return hasComplexPatterns ? 0.7 : hasSuggestions ? 0.5 : 0.3;
    });

    return complexities.reduce((a, b) => a + b, 0) / complexities.length;
  }
}

// Export singleton for convenience
export const astAnalysis = new ASTAnalysis();