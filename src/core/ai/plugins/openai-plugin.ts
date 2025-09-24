import { AIPlugin, AIPluginConfig, AICapability } from '../plugin-system';
import { ProjectGraph, AIResponse, VisualChange, AISuggestion, ImpactAnalysis, LearningData, CodeModification } from '../../../types';

export interface OpenAIConfig extends AIPluginConfig {
  apiKey: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

export class OpenAIPlugin implements AIPlugin {
  public readonly name = 'openai';
  public readonly version = '1.0.0';
  public readonly capabilities: AICapability[] = [
    'code_generation',
    'pattern_analysis',
    'impact_analysis',
    'suggestion_generation',
    'learning_adaptation'
  ];

  private config: OpenAIConfig | null = null;
  private learningHistory: LearningData[] = [];

  public async initialize(config: AIPluginConfig): Promise<void> {
    const openAIConfig = config as OpenAIConfig;

    if (!openAIConfig.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = {
      apiKey: openAIConfig.apiKey,
      modelName: openAIConfig.modelName || 'gpt-4',
      temperature: openAIConfig.temperature || 0.1,
      maxTokens: openAIConfig.maxTokens || 2000,
      baseUrl: openAIConfig.baseUrl || 'https://api.openai.com/v1',
      ...openAIConfig.customSettings
    };

    console.log(`OpenAI Plugin initialized with model: ${this.config.modelName}`);
  }

  public async analyzeGraph(graph: ProjectGraph): Promise<AIResponse> {
    if (!this.config) {
      throw new Error('Plugin not initialized');
    }

    const prompt = this.createGraphAnalysisPrompt(graph);
    const response = await this.callOpenAI(prompt, 'graph_analysis');

    return {
      id: this.generateResponseId(),
      timestamp: new Date(),
      trigger: 'code_change',
      codeChanges: [],
      architecturalImpact: this.parseArchitecturalImpact(response),
      suggestions: this.parseSuggestions(response),
      confidence: this.calculateConfidence(response),
      learningFeedback: undefined
    };
  }

  public async generateCode(change: VisualChange): Promise<AIResponse> {
    if (!this.config) {
      throw new Error('Plugin not initialized');
    }

    const prompt = this.createCodeGenerationPrompt(change);
    const response = await this.callOpenAI(prompt, 'code_generation');

    return {
      id: this.generateResponseId(),
      timestamp: new Date(),
      trigger: 'visual_change',
      codeChanges: this.parseCodeModifications(response, change),
      architecturalImpact: this.parseArchitecturalImpact(response),
      suggestions: [],
      confidence: this.calculateConfidence(response)
    };
  }

  public async suggestImprovements(graph: ProjectGraph): Promise<AISuggestion[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized');
    }

    const prompt = this.createImprovementPrompt(graph);
    const response = await this.callOpenAI(prompt, 'improvement_suggestions');

    return this.parseSuggestions(response);
  }

  public async learnFromFeedback(feedback: LearningData): Promise<void> {
    this.learningHistory.push(feedback);

    if (this.learningHistory.length > 100) {
      this.learningHistory = this.learningHistory.slice(-50);
    }

    console.log(`OpenAI Plugin: Learning from feedback - ${feedback.userFeedback}`);
  }

  public async cleanup(): Promise<void> {
    this.config = null;
    this.learningHistory = [];
    console.log('OpenAI Plugin cleaned up');
  }

  private async callOpenAI(prompt: string, context: string): Promise<string> {
    if (!this.config) {
      throw new Error('Plugin not initialized');
    }

    try {
      const requestBody = {
        model: this.config.modelName,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(context)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      };

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  private getSystemPrompt(context: string): string {
    const basePrompt = `You are an AI assistant specialized in software architecture analysis and code generation for React/TypeScript projects. You have deep understanding of:

- React patterns (hooks, components, state management)
- TypeScript best practices
- Software architecture patterns
- Code quality and maintainability
- Performance optimization

Always respond with structured JSON that can be parsed programmatically.`;

    const contextPrompts = {
      graph_analysis: `${basePrompt}

Focus on analyzing the project structure, identifying patterns, anti-patterns, and architectural insights. Provide actionable suggestions for improvement.`,

      code_generation: `${basePrompt}

Generate clean, well-structured React/TypeScript code based on visual changes. Follow modern React patterns and best practices. Consider component composition, type safety, and performance.`,

      improvement_suggestions: `${basePrompt}

Provide specific, actionable improvement suggestions. Focus on code quality, performance, maintainability, and architectural soundness. Prioritize suggestions by impact and effort.`
    };

    return contextPrompts[context as keyof typeof contextPrompts] || basePrompt;
  }

  private createGraphAnalysisPrompt(graph: ProjectGraph): string {
    const graphSummary = {
      totalFiles: graph.files.length,
      totalComponents: graph.components.length,
      totalFunctions: graph.functions.length,
      dependencies: graph.dependencies.nodes.length,
      patterns: graph.semanticData?.architecturalPatterns?.length || 0,
      antiPatterns: graph.semanticData?.antiPatterns?.length || 0
    };

    const recentLearning = this.learningHistory.slice(-5);

    return `Analyze this React/TypeScript project graph:

Project Summary:
${JSON.stringify(graphSummary, null, 2)}

Components (first 10):
${graph.components.slice(0, 10).map(comp =>
  `- ${comp.name} (${comp.type}): ${comp.hooks.length} hooks, ${comp.props.length} props`
).join('\n')}

Dependencies (sample):
${graph.dependencies.edges.slice(0, 20).map(edge =>
  `${edge.from} -> ${edge.to} (${edge.type})`
).join('\n')}

Previous Learning Context:
${recentLearning.map(learning =>
  `${learning.userFeedback}: ${learning.reasoning || 'No reasoning provided'}`
).join('\n')}

Please provide:
1. Architectural pattern analysis
2. Code quality assessment
3. Potential issues and anti-patterns
4. Performance considerations
5. Improvement suggestions

Response format:
{
  "analysis": {
    "patterns": [...],
    "quality_score": 0-100,
    "issues": [...],
    "performance": {...}
  },
  "suggestions": [
    {
      "type": "...",
      "priority": "...",
      "title": "...",
      "description": "...",
      "implementation": "..."
    }
  ]
}`;
  }

  private createCodeGenerationPrompt(change: VisualChange): string {
    const recentLearning = this.learningHistory.slice(-3);

    return `Generate React/TypeScript code for this visual change:

Change Details:
- Type: ${change.type}
- Source Component: ${change.sourceComponent}
- Target Component: ${change.targetComponent || 'N/A'}
- Business Intent: ${change.businessIntent || 'Not specified'}
- Properties: ${JSON.stringify(change.properties || {}, null, 2)}

Code Generation Hints:
${JSON.stringify(change.codeGenerationHint || {}, null, 2)}

Previous Learning Context:
${recentLearning.map(learning =>
  `${learning.userFeedback}: ${learning.patterns?.join(', ') || 'No patterns'}`
).join('\n')}

Generate modern React/TypeScript code that:
1. Follows React best practices
2. Uses appropriate TypeScript types
3. Implements clean component patterns
4. Considers performance implications
5. Maintains code consistency

Response format:
{
  "code_modifications": [
    {
      "file": "path/to/file.tsx",
      "type": "create|modify|delete",
      "changes": [
        {
          "startLine": number,
          "endLine": number,
          "oldContent": "...",
          "newContent": "...",
          "changeType": "add|remove|modify"
        }
      ],
      "reasoning": "Why this change is needed"
    }
  ],
  "impact_analysis": {
    "affected_components": [...],
    "risk_level": "low|medium|high",
    "testing_required": [...],
    "performance_impact": "positive|negative|neutral"
  }
}`;
  }

  private createImprovementPrompt(graph: ProjectGraph): string {
    const complexityMetrics = graph.semanticData?.complexityMetrics;
    const antiPatterns = graph.semanticData?.antiPatterns || [];
    const recentLearning = this.learningHistory.slice(-5);

    return `Suggest improvements for this React/TypeScript project:

Current Metrics:
${complexityMetrics ? JSON.stringify({
  cyclomaticComplexity: complexityMetrics.cyclomaticComplexity,
  maintainabilityIndex: complexityMetrics.maintainabilityIndex,
  technicalDebt: complexityMetrics.technicalDebt.totalMinutes
}, null, 2) : 'No metrics available'}

Detected Issues:
${antiPatterns.map(pattern =>
  `- ${pattern.type}: ${pattern.description} (${pattern.severity})`
).join('\n')}

Team Learning History:
${recentLearning.map(learning =>
  `${learning.userFeedback} -> ${learning.modifications || 'No specific modifications'}`
).join('\n')}

Provide specific, actionable improvement suggestions prioritized by business value and implementation effort.

Response format:
{
  "suggestions": [
    {
      "id": "unique-id",
      "type": "refactor|optimize|security|pattern|business",
      "priority": "low|medium|high|critical",
      "title": "Short title",
      "description": "Detailed description",
      "reasoning": "Why this matters",
      "implementation": "How to implement",
      "business_value": "Business justification",
      "effort": "small|medium|large|epic",
      "components": ["affected", "components"],
      "code_example": "Optional code example"
    }
  ]
}`;
  }

  private parseCodeModifications(response: string, change: VisualChange): CodeModification[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.code_modifications || [];
    } catch (error) {
      console.warn('Failed to parse code modifications, generating fallback');
      return this.generateFallbackCodeModification(change);
    }
  }

  private parseArchitecturalImpact(response: string): ImpactAnalysis {
    try {
      const parsed = JSON.parse(response);
      return parsed.impact_analysis || parsed.analysis || {
        affectedComponents: [],
        riskLevel: 'low',
        testingRequired: [],
        deploymentConsiderations: [],
        businessImpact: 'Unknown impact'
      };
    } catch (error) {
      return {
        affectedComponents: [],
        riskLevel: 'low',
        testingRequired: [],
        deploymentConsiderations: ['Review generated changes'],
        businessImpact: 'AI-generated changes require review'
      };
    }
  }

  private parseSuggestions(response: string): AISuggestion[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.suggestions || [];
    } catch (error) {
      console.warn('Failed to parse suggestions from AI response');
      return [];
    }
  }

  private calculateConfidence(response: string): number {
    try {
      const parsed = JSON.parse(response);
      return parsed.confidence || 0.7;
    } catch (error) {
      return 0.5;
    }
  }

  private generateFallbackCodeModification(change: VisualChange): CodeModification[] {
    return [{
      file: `./src/components/${change.sourceComponent}.tsx`,
      type: 'modify',
      changes: [{
        startLine: 1,
        endLine: 1,
        oldContent: '',
        newContent: `// AI-generated change: ${change.type} on ${change.sourceComponent}`,
        changeType: 'add'
      }],
      reasoning: 'Fallback modification due to AI parsing error'
    }];
  }

  private generateResponseId(): string {
    return `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}