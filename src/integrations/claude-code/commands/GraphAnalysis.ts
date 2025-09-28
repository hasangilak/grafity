import { ClaudeCodeWrapper } from '../ClaudeCodeWrapper';
import { ProjectGraph } from '../../../../client/src/types';
import { BusinessGraph } from '../../../core/reverse-engineering/BusinessGraphBuilder';

export interface GraphPattern {
  name: string;
  description: string;
  occurrences: number;
  nodes: string[];
  quality: 'good' | 'neutral' | 'anti-pattern';
  impact: 'high' | 'medium' | 'low';
}

export interface ArchitecturalConcern {
  type: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  affectedNodes: string[];
  recommendation: string;
}

export interface GraphAnalysisResult {
  patterns: GraphPattern[];
  concerns: ArchitecturalConcern[];
  metrics: {
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    modularity: number;
    cyclomatic: number;
  };
  insights: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
  };
  recommendations: string[];
}

export class GraphAnalysis {
  private claude: ClaudeCodeWrapper;

  constructor(claudeWrapper?: ClaudeCodeWrapper) {
    this.claude = claudeWrapper || new ClaudeCodeWrapper({ outputFormat: 'json' });
  }

  /**
   * Analyze project graph for patterns and insights
   */
  async analyzeProjectGraph(graph: ProjectGraph): Promise<GraphAnalysisResult> {
    const graphData = this.formatProjectGraph(graph);
    const prompt = this.buildProjectGraphPrompt();

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(graphData));

    if (!response.success) {
      throw new Error(`Graph analysis failed: ${response.error}`);
    }

    return this.parseGraphAnalysis(response.data, graph);
  }

  /**
   * Analyze business graph for domain insights
   */
  async analyzeBusinessGraph(graph: BusinessGraph): Promise<GraphAnalysisResult> {
    const graphData = this.formatBusinessGraph(graph);
    const prompt = this.buildBusinessGraphPrompt();

    const response = await this.claude.executeJson<any>(prompt, JSON.stringify(graphData));

    if (!response.success) {
      throw new Error(`Business graph analysis failed: ${response.error}`);
    }

    return this.parseBusinessAnalysis(response.data, graph);
  }

  /**
   * Detect architectural patterns in graph
   */
  async detectPatterns(graph: any): Promise<GraphPattern[]> {
    const graphData = this.simplifyGraphForAnalysis(graph);

    const prompt = `Analyze this code graph and identify architectural patterns:
    - MVC/MVP/MVVM patterns
    - Layered architecture
    - Microservices patterns
    - Component composition patterns
    - Data flow patterns
    - Anti-patterns (god objects, circular dependencies, etc.)

    Return JSON array of patterns with:
    { name, description, occurrences, nodes[], quality, impact }`;

    const response = await this.claude.executeJson<any[]>(prompt, JSON.stringify(graphData));

    if (!response.success || !response.data) {
      throw new Error(`Pattern detection failed: ${response.error || 'No data returned'}`);
    }

    return response.data.map(p => this.createPattern(p));
  }

  /**
   * Identify architectural concerns
   */
  async identifyConcerns(graph: any): Promise<ArchitecturalConcern[]> {
    const graphData = this.simplifyGraphForAnalysis(graph);

    const prompt = `Analyze this code graph and identify architectural concerns:
    - Tight coupling
    - Circular dependencies
    - God components/classes
    - Missing abstractions
    - Performance bottlenecks
    - Security issues
    - Maintainability problems

    Return JSON array of concerns with:
    { type, severity, description, affectedNodes[], recommendation }`;

    const response = await this.claude.executeJson<any[]>(prompt, JSON.stringify(graphData));

    if (!response.success || !response.data) {
      throw new Error(`Concern identification failed: ${response.error || 'No data returned'}`);
    }

    return response.data.map(c => this.createConcern(c));
  }

  /**
   * Generate improvement suggestions
   */
  async generateSuggestions(graph: any): Promise<string[]> {
    const graphData = this.simplifyGraphForAnalysis(graph);

    const prompt = `Analyze this code graph and suggest improvements:
    - Architecture refactoring
    - Component decomposition
    - Dependency optimization
    - Performance enhancements
    - Code organization
    - Testing strategies

    Return JSON array of actionable suggestions`;

    const response = await this.claude.executeJson<string[]>(
      prompt,
      JSON.stringify(graphData)
    );

    if (!response.success || !response.data) {
      throw new Error(`Suggestion generation failed: ${response.error || 'No data returned'}`);
    }

    return response.data;
  }

  /**
   * Compare two graphs for changes
   */
  async compareGraphs(before: any, after: any): Promise<any> {
    const comparisonData = {
      before: this.simplifyGraphForAnalysis(before),
      after: this.simplifyGraphForAnalysis(after)
    };

    const prompt = `Compare these two code graphs and identify:
    - Added nodes and edges
    - Removed nodes and edges
    - Modified relationships
    - Architectural changes
    - Quality improvements or degradations

    Return JSON with:
    { added, removed, modified, improvements[], regressions[], summary }`;

    const response = await this.claude.executeJson<any>(
      prompt,
      JSON.stringify(comparisonData)
    );

    if (!response.success) {
      throw new Error(`Graph comparison failed: ${response.error}`);
    }

    return response.data;
  }

  /**
   * Format project graph for analysis
   */
  private formatProjectGraph(graph: ProjectGraph): any {
    return {
      nodes: graph.dependencies?.nodes?.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        metadata: n.metadata
      })) || [],
      edges: graph.dependencies?.edges?.map(e => ({
        from: e.from,
        to: e.to,
        type: e.type
      })) || [],
      stats: {
        componentCount: graph.components?.length || 0,
        functionCount: graph.functions?.length || 0,
        fileCount: graph.files?.length || 0
      }
    };
  }

  /**
   * Format business graph for analysis
   */
  private formatBusinessGraph(graph: BusinessGraph): any {
    return {
      nodes: graph.nodes?.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        businessValue: (n as any).metadata?.businessValue
      })) || [],
      edges: graph.edges?.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        bidirectional: (e as any).bidirectional || e.direction === 'bidirectional'
      })) || [],
      clusters: graph.clusters || [],
      metadata: graph.metadata
    };
  }

  /**
   * Simplify graph for analysis
   */
  private simplifyGraphForAnalysis(graph: any): any {
    // Extract essential structure
    const nodes = new Map<string, any>();
    const edges: any[] = [];

    // Process nodes
    if (graph.nodes) {
      graph.nodes.forEach((node: any) => {
        nodes.set(node.id || node.name, {
          id: node.id || node.name,
          type: node.type,
          label: node.label || node.name,
          degree: 0
        });
      });
    }

    // Process edges and calculate degrees
    if (graph.edges) {
      graph.edges.forEach((edge: any) => {
        const source = edge.source || edge.from;
        const target = edge.target || edge.to;

        edges.push({
          source,
          target,
          type: edge.type
        });

        // Update degrees
        const sourceNode = nodes.get(source);
        const targetNode = nodes.get(target);
        if (sourceNode) sourceNode.degree++;
        if (targetNode) targetNode.degree++;
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      metrics: {
        nodeCount: nodes.size,
        edgeCount: edges.length,
        avgDegree: nodes.size > 0 ? edges.length * 2 / nodes.size : 0
      }
    };
  }

  /**
   * Build project graph analysis prompt
   */
  private buildProjectGraphPrompt(): string {
    return `Analyze this software project graph and provide insights:

    1. Identify architectural patterns (MVC, layered, microservices, etc.)
    2. Detect anti-patterns and code smells
    3. Assess modularity and coupling
    4. Identify potential bottlenecks
    5. Evaluate overall architecture quality

    Return JSON with:
    {
      "patterns": [{ name, description, occurrences, quality, impact }],
      "concerns": [{ type, severity, description, recommendation }],
      "metrics": { modularity, coupling, cohesion, complexity },
      "insights": { strengths[], weaknesses[], opportunities[] },
      "recommendations": ["actionable suggestions"]
    }`;
  }

  /**
   * Build business graph analysis prompt
   */
  private buildBusinessGraphPrompt(): string {
    return `Analyze this business domain graph and provide insights:

    1. Identify business capability patterns
    2. Assess domain boundaries
    3. Detect missing or weak connections
    4. Evaluate business-technical alignment
    5. Identify optimization opportunities

    Return JSON with:
    {
      "patterns": [{ name, description, businessValue }],
      "domainInsights": { boundaries[], capabilities[], gaps[] },
      "alignment": { score, issues[], opportunities[] },
      "recommendations": ["business-focused suggestions"]
    }`;
  }

  /**
   * Parse graph analysis response
   */
  private parseGraphAnalysis(claudeData: any, graph: ProjectGraph): GraphAnalysisResult {
    return {
      patterns: this.parsePatterns(claudeData.patterns),
      concerns: this.parseConcerns(claudeData.concerns),
      metrics: {
        nodeCount: graph.dependencies?.nodes?.length || 0,
        edgeCount: graph.dependencies?.edges?.length || 0,
        avgDegree: this.calculateAvgDegree(graph),
        modularity: claudeData.metrics?.modularity || 0,
        cyclomatic: claudeData.metrics?.complexity || 0
      },
      insights: {
        summary: claudeData.summary || 'Graph analysis complete',
        strengths: claudeData.insights?.strengths || [],
        weaknesses: claudeData.insights?.weaknesses || [],
        opportunities: claudeData.insights?.opportunities || []
      },
      recommendations: claudeData.recommendations || []
    };
  }

  /**
   * Parse business analysis response
   */
  private parseBusinessAnalysis(claudeData: any, graph: BusinessGraph): GraphAnalysisResult {
    return {
      patterns: this.parseBusinessPatterns(claudeData.patterns),
      concerns: this.parseBusinessConcerns(claudeData.domainInsights),
      metrics: {
        nodeCount: graph.nodes?.length || 0,
        edgeCount: graph.edges?.length || 0,
        avgDegree: this.calculateBusinessAvgDegree(graph),
        modularity: claudeData.alignment?.score || 0,
        cyclomatic: 0
      },
      insights: {
        summary: claudeData.summary || 'Business analysis complete',
        strengths: claudeData.domainInsights?.capabilities || [],
        weaknesses: claudeData.domainInsights?.gaps || [],
        opportunities: claudeData.alignment?.opportunities || []
      },
      recommendations: claudeData.recommendations || []
    };
  }

  /**
   * Parse patterns from response
   */
  private parsePatterns(patterns: any[]): GraphPattern[] {
    if (!patterns) return [];

    return patterns.map(p => ({
      name: p.name || 'Unknown',
      description: p.description || '',
      occurrences: p.occurrences || 1,
      nodes: p.nodes || [],
      quality: p.quality || 'neutral',
      impact: p.impact || 'medium'
    }));
  }

  /**
   * Parse business patterns
   */
  private parseBusinessPatterns(patterns: any[]): GraphPattern[] {
    if (!patterns) return [];

    return patterns.map(p => ({
      name: p.name || 'Unknown',
      description: p.description || '',
      occurrences: 1,
      nodes: [],
      quality: p.businessValue > 0.7 ? 'good' : 'neutral',
      impact: p.businessValue > 0.7 ? 'high' : 'medium'
    }));
  }

  /**
   * Parse concerns from response
   */
  private parseConcerns(concerns: any[]): ArchitecturalConcern[] {
    if (!concerns) return [];

    return concerns.map(c => ({
      type: c.type || 'general',
      severity: c.severity || 'info',
      description: c.description || '',
      affectedNodes: c.affectedNodes || [],
      recommendation: c.recommendation || ''
    }));
  }

  /**
   * Parse business concerns
   */
  private parseBusinessConcerns(insights: any): ArchitecturalConcern[] {
    const concerns: ArchitecturalConcern[] = [];

    if (insights?.gaps) {
      insights.gaps.forEach((gap: string) => {
        concerns.push({
          type: 'business_gap',
          severity: 'major',
          description: gap,
          affectedNodes: [],
          recommendation: 'Address business capability gap'
        });
      });
    }

    if (insights?.boundaries) {
      insights.boundaries.forEach((boundary: any) => {
        if (boundary.issues) {
          concerns.push({
            type: 'domain_boundary',
            severity: 'minor',
            description: boundary.issues,
            affectedNodes: [],
            recommendation: 'Review domain boundaries'
          });
        }
      });
    }

    return concerns;
  }

  /**
   * Create pattern object
   */
  private createPattern(data: any): GraphPattern {
    return {
      name: data.name || 'Unknown',
      description: data.description || '',
      occurrences: data.occurrences || 1,
      nodes: data.nodes || [],
      quality: data.quality || 'neutral',
      impact: data.impact || 'medium'
    };
  }

  /**
   * Create concern object
   */
  private createConcern(data: any): ArchitecturalConcern {
    return {
      type: data.type || 'general',
      severity: data.severity || 'info',
      description: data.description || '',
      affectedNodes: data.affectedNodes || [],
      recommendation: data.recommendation || ''
    };
  }

  /**
   * Calculate average degree for project graph
   */
  private calculateAvgDegree(graph: ProjectGraph): number {
    const nodeCount = graph.dependencies?.nodes?.length || 0;
    const edgeCount = graph.dependencies?.edges?.length || 0;
    return nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;
  }

  /**
   * Calculate average degree for business graph
   */
  private calculateBusinessAvgDegree(graph: BusinessGraph): number {
    const nodeCount = graph.nodes?.length || 0;
    const edgeCount = graph.edges?.length || 0;
    return nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;
  }
}

// Export singleton for convenience
export const graphAnalysis = new GraphAnalysis();