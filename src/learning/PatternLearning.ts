import { Node, Edge } from '../core/graph-engine/types/NodeTypes';
import { ComponentInfo } from '../types';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  type: 'code' | 'usage' | 'architectural' | 'anti-pattern';
  category: string;
  confidence: number; // 0-1
  frequency: number;
  lastSeen: Date;
  createdAt: Date;
  examples: PatternExample[];
  rules: PatternRule[];
  suggestions: PatternSuggestion[];
  metadata: PatternMetadata;
}

export interface PatternExample {
  id: string;
  graphSnapshot: {
    nodes: Node[];
    edges: Edge[];
  };
  context: {
    projectType: string;
    framework: string;
    complexity: number;
  };
  outcome: 'positive' | 'negative' | 'neutral';
  feedback?: UserFeedback;
}

export interface PatternRule {
  id: string;
  condition: string; // JS expression or rule DSL
  action: 'suggest' | 'warn' | 'block' | 'enhance';
  priority: number;
  message: string;
}

export interface PatternSuggestion {
  id: string;
  type: 'improvement' | 'alternative' | 'optimization' | 'refactoring';
  title: string;
  description: string;
  code?: string;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface PatternMetadata {
  tags: string[];
  complexity: number;
  maintainability: number;
  performance: number;
  security: number;
  accessibility: number;
  relatedPatterns: string[];
  sourceType: 'detected' | 'manual' | 'imported';
}

export interface UserFeedback {
  userId: string;
  timestamp: Date;
  type: 'positive' | 'negative' | 'correction';
  rating: number; // 1-5
  comment?: string;
  correction?: {
    originalSuggestion: string;
    correctedSuggestion: string;
    explanation: string;
  };
}

export interface LearningContext {
  projectId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  graph: {
    nodes: Node[];
    edges: Edge[];
  };
  userActions: UserAction[];
  environment: {
    framework: string;
    language: string;
    projectType: string;
    complexity: number;
  };
}

export interface UserAction {
  id: string;
  type: 'code_generation' | 'modification' | 'deletion' | 'navigation' | 'feedback';
  timestamp: Date;
  target: string; // node/edge ID
  details: Record<string, any>;
  outcome?: ActionOutcome;
}

export interface ActionOutcome {
  success: boolean;
  timeToComplete: number;
  changesRequired: number;
  userSatisfaction?: number;
  errors?: string[];
}

export interface PatternAnalysisResult {
  detectedPatterns: DetectedPattern[];
  suggestions: PatternSuggestion[];
  warnings: PatternWarning[];
  metrics: {
    confidence: number;
    coverage: number;
    novelty: number;
  };
}

export interface DetectedPattern {
  pattern: Pattern;
  instances: PatternInstance[];
  confidence: number;
  context: string[];
}

export interface PatternInstance {
  nodeIds: string[];
  edgeIds: string[];
  metadata: Record<string, any>;
  score: number;
}

export interface PatternWarning {
  type: 'anti-pattern' | 'complexity' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedNodes: string[];
  suggestions: string[];
}

export interface LearningMetrics {
  totalPatterns: number;
  patternsLearned: number;
  accuracyRate: number;
  suggestionAcceptanceRate: number;
  userSatisfactionAverage: number;
  improvementTrend: number;
  lastUpdated: Date;
}

export class PatternLearningSystem {
  private patterns: Map<string, Pattern> = new Map();
  private userFeedback: Map<string, UserFeedback[]> = new Map();
  private learningContexts: LearningContext[] = [];
  private metrics: LearningMetrics;

  constructor() {
    this.metrics = {
      totalPatterns: 0,
      patternsLearned: 0,
      accuracyRate: 0,
      suggestionAcceptanceRate: 0,
      userSatisfactionAverage: 0,
      improvementTrend: 0,
      lastUpdated: new Date()
    };

    this.loadBasicPatterns();
  }

  /**
   * Analyze a graph for patterns
   */
  async analyzePatterns(
    nodes: Node[],
    edges: Edge[],
    context?: Partial<LearningContext>
  ): Promise<PatternAnalysisResult> {
    const detectedPatterns: DetectedPattern[] = [];
    const suggestions: PatternSuggestion[] = [];
    const warnings: PatternWarning[] = [];

    // Detect known patterns
    for (const [patternId, pattern] of this.patterns.entries()) {
      const instances = await this.detectPatternInstances(pattern, nodes, edges);

      if (instances.length > 0) {
        const confidence = this.calculatePatternConfidence(pattern, instances, context);

        detectedPatterns.push({
          pattern,
          instances,
          confidence,
          context: this.extractPatternContext(instances, nodes, edges)
        });

        // Generate suggestions based on detected patterns
        suggestions.push(...this.generateSuggestions(pattern, instances, nodes, edges));

        // Check for anti-patterns and warnings
        if (pattern.type === 'anti-pattern') {
          warnings.push({
            type: 'anti-pattern',
            severity: this.calculateSeverity(pattern, instances),
            message: `Detected anti-pattern: ${pattern.name}`,
            affectedNodes: instances.flatMap(i => i.nodeIds),
            suggestions: pattern.suggestions.map(s => s.description)
          });
        }
      }
    }

    // Detect novel patterns
    const novelPatterns = await this.detectNovelPatterns(nodes, edges, detectedPatterns);

    // Calculate metrics
    const metrics = {
      confidence: this.calculateOverallConfidence(detectedPatterns),
      coverage: this.calculateCoverage(detectedPatterns, nodes),
      novelty: novelPatterns.length / Math.max(1, detectedPatterns.length)
    };

    return {
      detectedPatterns,
      suggestions,
      warnings,
      metrics
    };
  }

  /**
   * Learn from user feedback
   */
  async learnFromFeedback(
    patternId: string,
    feedback: UserFeedback,
    context: LearningContext
  ): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Store feedback
    if (!this.userFeedback.has(patternId)) {
      this.userFeedback.set(patternId, []);
    }
    this.userFeedback.get(patternId)!.push(feedback);

    // Update pattern confidence based on feedback
    await this.updatePatternFromFeedback(pattern, feedback, context);

    // Learn corrections
    if (feedback.type === 'correction' && feedback.correction) {
      await this.learnFromCorrection(pattern, feedback.correction, context);
    }

    // Update metrics
    this.updateLearningMetrics();
  }

  /**
   * Learn from user actions
   */
  async learnFromActions(context: LearningContext): Promise<void> {
    this.learningContexts.push(context);

    // Analyze successful patterns
    const successfulActions = context.userActions.filter(
      action => action.outcome?.success === true
    );

    for (const action of successfulActions) {
      await this.analyzeSuccessfulAction(action, context);
    }

    // Analyze failed patterns
    const failedActions = context.userActions.filter(
      action => action.outcome?.success === false
    );

    for (const action of failedActions) {
      await this.analyzeFailedAction(action, context);
    }

    // Update existing patterns with new data
    await this.refinePatterns(context);

    this.updateLearningMetrics();
  }

  /**
   * Get suggestions for a specific context
   */
  async getSuggestions(
    nodes: Node[],
    edges: Edge[],
    context: Partial<LearningContext>
  ): Promise<PatternSuggestion[]> {
    const analysisResult = await this.analyzePatterns(nodes, edges, context);

    // Rank suggestions by relevance and confidence
    const rankedSuggestions = analysisResult.suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Top 10 suggestions

    // Personalize suggestions based on user history
    return this.personalizesuggestions(rankedSuggestions, context);
  }

  /**
   * Create a new pattern from examples
   */
  async createPattern(
    name: string,
    examples: PatternExample[],
    metadata: Partial<PatternMetadata> = {}
  ): Promise<Pattern> {
    const pattern: Pattern = {
      id: this.generatePatternId(name),
      name,
      description: metadata.tags?.join(', ') || 'Custom pattern',
      type: 'code',
      category: 'custom',
      confidence: 0.5,
      frequency: 0,
      lastSeen: new Date(),
      createdAt: new Date(),
      examples,
      rules: await this.generateRulesFromExamples(examples),
      suggestions: [],
      metadata: {
        tags: [],
        complexity: 0.5,
        maintainability: 0.5,
        performance: 0.5,
        security: 0.5,
        accessibility: 0.5,
        relatedPatterns: [],
        sourceType: 'detected',
        ...metadata
      }
    };

    this.patterns.set(pattern.id, pattern);
    this.updateLearningMetrics();

    return pattern;
  }

  /**
   * Get pattern library
   */
  getPatterns(filter?: {
    type?: string;
    category?: string;
    minConfidence?: number;
  }): Pattern[] {
    let patterns = Array.from(this.patterns.values());

    if (filter) {
      if (filter.type) {
        patterns = patterns.filter(p => p.type === filter.type);
      }
      if (filter.category) {
        patterns = patterns.filter(p => p.category === filter.category);
      }
      if (filter.minConfidence) {
        patterns = patterns.filter(p => p.confidence >= filter.minConfidence);
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  /**
   * Export patterns for sharing
   */
  exportPatterns(): string {
    const exportData = {
      patterns: Array.from(this.patterns.values()),
      metadata: {
        exportedAt: new Date(),
        version: '1.0',
        metrics: this.metrics
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import patterns from export
   */
  async importPatterns(data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);

      for (const pattern of importData.patterns) {
        // Merge with existing patterns or add new ones
        const existingPattern = this.patterns.get(pattern.id);

        if (existingPattern) {
          await this.mergePatterns(existingPattern, pattern);
        } else {
          this.patterns.set(pattern.id, pattern);
        }
      }

      this.updateLearningMetrics();
    } catch (error) {
      throw new Error(`Failed to import patterns: ${error.message}`);
    }
  }

  /**
   * Private methods
   */
  private async detectPatternInstances(
    pattern: Pattern,
    nodes: Node[],
    edges: Edge[]
  ): Promise<PatternInstance[]> {
    const instances: PatternInstance[] = [];

    // Use pattern rules to detect instances
    for (const rule of pattern.rules) {
      const matchingInstances = await this.evaluatePatternRule(rule, nodes, edges);
      instances.push(...matchingInstances);
    }

    // Use ML-based detection for learned patterns
    if (pattern.examples.length > 0) {
      const mlInstances = await this.detectInstancesWithML(pattern, nodes, edges);
      instances.push(...mlInstances);
    }

    return this.deduplicateInstances(instances);
  }

  private async evaluatePatternRule(
    rule: PatternRule,
    nodes: Node[],
    edges: Edge[]
  ): Promise<PatternInstance[]> {
    const instances: PatternInstance[] = [];

    // Simple rule evaluation - could be enhanced with a proper rule engine
    try {
      const ruleFunction = new Function('nodes', 'edges', `return (${rule.condition});`);
      const matches = ruleFunction(nodes, edges);

      if (matches) {
        // Extract instances from matches
        if (Array.isArray(matches)) {
          for (const match of matches) {
            instances.push({
              nodeIds: match.nodeIds || [],
              edgeIds: match.edgeIds || [],
              metadata: match.metadata || {},
              score: match.score || rule.priority
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Rule evaluation failed: ${error.message}`);
    }

    return instances;
  }

  private async detectInstancesWithML(
    pattern: Pattern,
    nodes: Node[],
    edges: Edge[]
  ): Promise<PatternInstance[]> {
    // Simple similarity-based detection
    // In a real implementation, this would use proper ML models
    const instances: PatternInstance[] = [];

    for (const example of pattern.examples) {
      const similarity = this.calculateGraphSimilarity(
        { nodes, edges },
        example.graphSnapshot
      );

      if (similarity > 0.7) {
        instances.push({
          nodeIds: nodes.map(n => n.id),
          edgeIds: edges.map(e => e.id),
          metadata: { similarity, exampleId: example.id },
          score: similarity
        });
      }
    }

    return instances;
  }

  private calculateGraphSimilarity(
    graph1: { nodes: Node[]; edges: Edge[] },
    graph2: { nodes: Node[]; edges: Edge[] }
  ): number {
    // Simple structural similarity calculation
    const nodeTypeSimilarity = this.calculateNodeTypeSimilarity(graph1.nodes, graph2.nodes);
    const edgeTypeSimilarity = this.calculateEdgeTypeSimilarity(graph1.edges, graph2.edges);
    const structuralSimilarity = this.calculateStructuralSimilarity(graph1, graph2);

    return (nodeTypeSimilarity + edgeTypeSimilarity + structuralSimilarity) / 3;
  }

  private calculateNodeTypeSimilarity(nodes1: Node[], nodes2: Node[]): number {
    const types1 = new Set(nodes1.map(n => n.type));
    const types2 = new Set(nodes2.map(n => n.type));

    const intersection = new Set([...types1].filter(t => types2.has(t)));
    const union = new Set([...types1, ...types2]);

    return intersection.size / union.size;
  }

  private calculateEdgeTypeSimilarity(edges1: Edge[], edges2: Edge[]): number {
    const types1 = new Set(edges1.map(e => e.type));
    const types2 = new Set(edges2.map(e => e.type));

    const intersection = new Set([...types1].filter(t => types2.has(t)));
    const union = new Set([...types1, ...types2]);

    return intersection.size / union.size;
  }

  private calculateStructuralSimilarity(
    graph1: { nodes: Node[]; edges: Edge[] },
    graph2: { nodes: Node[]; edges: Edge[] }
  ): number {
    // Compare graph density
    const density1 = graph1.edges.length / Math.max(1, graph1.nodes.length * (graph1.nodes.length - 1));
    const density2 = graph2.edges.length / Math.max(1, graph2.nodes.length * (graph2.nodes.length - 1));

    return 1 - Math.abs(density1 - density2);
  }

  private generateSuggestions(
    pattern: Pattern,
    instances: PatternInstance[],
    nodes: Node[],
    edges: Edge[]
  ): PatternSuggestion[] {
    return pattern.suggestions.map(suggestion => ({
      ...suggestion,
      confidence: pattern.confidence * 0.8, // Slightly lower confidence for suggestions
    }));
  }

  private calculatePatternConfidence(
    pattern: Pattern,
    instances: PatternInstance[],
    context?: Partial<LearningContext>
  ): number {
    let confidence = pattern.confidence;

    // Adjust based on instance quality
    const avgInstanceScore = instances.reduce((sum, i) => sum + i.score, 0) / instances.length;
    confidence *= avgInstanceScore;

    // Adjust based on feedback
    const feedback = this.userFeedback.get(pattern.id) || [];
    if (feedback.length > 0) {
      const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
      confidence *= (avgRating / 5); // Normalize to 0-1
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private async updatePatternFromFeedback(
    pattern: Pattern,
    feedback: UserFeedback,
    context: LearningContext
  ): Promise<void> {
    // Update confidence based on feedback
    const feedbackWeight = 0.1;
    const feedbackScore = feedback.rating / 5; // Normalize to 0-1

    pattern.confidence = (1 - feedbackWeight) * pattern.confidence + feedbackWeight * feedbackScore;

    // Update frequency
    pattern.frequency++;
    pattern.lastSeen = feedback.timestamp;

    // Add context example if positive feedback
    if (feedback.type === 'positive' && feedback.rating >= 4) {
      const example: PatternExample = {
        id: this.generateId(),
        graphSnapshot: { nodes: context.graph.nodes, edges: context.graph.edges },
        context: {
          projectType: context.environment.projectType,
          framework: context.environment.framework,
          complexity: context.environment.complexity
        },
        outcome: 'positive',
        feedback
      };

      pattern.examples.push(example);

      // Limit examples to prevent memory bloat
      if (pattern.examples.length > 50) {
        pattern.examples = pattern.examples.slice(-50);
      }
    }
  }

  private async learnFromCorrection(
    pattern: Pattern,
    correction: UserFeedback['correction'],
    context: LearningContext
  ): Promise<void> {
    if (!correction) return;

    // Create a new suggestion based on the correction
    const correctedSuggestion: PatternSuggestion = {
      id: this.generateId(),
      type: 'improvement',
      title: 'User Correction',
      description: correction.correctedSuggestion,
      confidence: 0.8,
      effort: 'medium',
      impact: 'medium'
    };

    pattern.suggestions.push(correctedSuggestion);

    // Update pattern rules if applicable
    const newRule: PatternRule = {
      id: this.generateId(),
      condition: this.generateRuleFromCorrection(correction),
      action: 'suggest',
      priority: 5,
      message: correction.explanation
    };

    pattern.rules.push(newRule);
  }

  private generateRuleFromCorrection(correction: UserFeedback['correction']): string {
    // Simple rule generation from correction
    // In a real implementation, this would be more sophisticated
    return `true`; // Placeholder
  }

  private async analyzeSuccessfulAction(
    action: UserAction,
    context: LearningContext
  ): Promise<void> {
    // Extract patterns from successful actions
    const patternCandidate = this.extractPatternFromAction(action, context);

    if (patternCandidate) {
      await this.reinforceOrCreatePattern(patternCandidate, 'positive');
    }
  }

  private async analyzeFailedAction(
    action: UserAction,
    context: LearningContext
  ): Promise<void> {
    // Learn what doesn't work
    const antiPatternCandidate = this.extractPatternFromAction(action, context);

    if (antiPatternCandidate) {
      await this.reinforceOrCreatePattern(antiPatternCandidate, 'negative');
    }
  }

  private extractPatternFromAction(
    action: UserAction,
    context: LearningContext
  ): Pattern | null {
    // Extract meaningful patterns from user actions
    // This is a simplified implementation
    return null;
  }

  private async reinforceOrCreatePattern(
    pattern: Pattern,
    outcome: 'positive' | 'negative'
  ): Promise<void> {
    const existingPattern = Array.from(this.patterns.values())
      .find(p => this.patternsAreSimilar(p, pattern));

    if (existingPattern) {
      // Reinforce existing pattern
      if (outcome === 'positive') {
        existingPattern.confidence = Math.min(1, existingPattern.confidence * 1.1);
      } else {
        existingPattern.confidence = Math.max(0, existingPattern.confidence * 0.9);
      }
      existingPattern.frequency++;
      existingPattern.lastSeen = new Date();
    } else {
      // Create new pattern
      pattern.confidence = outcome === 'positive' ? 0.6 : 0.3;
      this.patterns.set(pattern.id, pattern);
    }
  }

  private patternsAreSimilar(pattern1: Pattern, pattern2: Pattern): boolean {
    // Simple similarity check
    return pattern1.name === pattern2.name && pattern1.category === pattern2.category;
  }

  private async refinePatterns(context: LearningContext): Promise<void> {
    // Refine existing patterns with new data
    for (const [patternId, pattern] of this.patterns.entries()) {
      // Update pattern metadata based on new context
      const analysisResult = await this.analyzePatterns(
        context.graph.nodes,
        context.graph.edges,
        context
      );

      const detectedPattern = analysisResult.detectedPatterns
        .find(dp => dp.pattern.id === patternId);

      if (detectedPattern) {
        pattern.confidence = (pattern.confidence + detectedPattern.confidence) / 2;
        pattern.lastSeen = new Date();
        pattern.frequency++;
      }
    }
  }

  private personalizesuggestions(
    suggestions: PatternSuggestion[],
    context: Partial<LearningContext>
  ): PatternSuggestion[] {
    // Personalize based on user history
    // This is a simplified implementation
    return suggestions;
  }

  private deduplicateInstances(instances: PatternInstance[]): PatternInstance[] {
    const seen = new Set<string>();
    return instances.filter(instance => {
      const key = instance.nodeIds.concat(instance.edgeIds).sort().join(',');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async detectNovelPatterns(
    nodes: Node[],
    edges: Edge[],
    knownPatterns: DetectedPattern[]
  ): Promise<Pattern[]> {
    // Detect novel patterns not in the existing library
    // This would use clustering or other ML techniques
    return [];
  }

  private calculateOverallConfidence(patterns: DetectedPattern[]): number {
    if (patterns.length === 0) return 0;
    return patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  }

  private calculateCoverage(patterns: DetectedPattern[], nodes: Node[]): number {
    const coveredNodes = new Set(
      patterns.flatMap(p => p.instances.flatMap(i => i.nodeIds))
    );
    return coveredNodes.size / Math.max(1, nodes.length);
  }

  private calculateSeverity(
    pattern: Pattern,
    instances: PatternInstance[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const avgScore = instances.reduce((sum, i) => sum + i.score, 0) / instances.length;

    if (avgScore > 0.8) return 'critical';
    if (avgScore > 0.6) return 'high';
    if (avgScore > 0.4) return 'medium';
    return 'low';
  }

  private extractPatternContext(
    instances: PatternInstance[],
    nodes: Node[],
    edges: Edge[]
  ): string[] {
    // Extract contextual information about where patterns occur
    const contexts: string[] = [];

    for (const instance of instances) {
      const affectedNodes = nodes.filter(n => instance.nodeIds.includes(n.id));
      contexts.push(...affectedNodes.map(n => n.type));
    }

    return [...new Set(contexts)];
  }

  private async generateRulesFromExamples(examples: PatternExample[]): Promise<PatternRule[]> {
    // Generate rules from pattern examples
    // This is a simplified implementation
    return [];
  }

  private updateLearningMetrics(): void {
    this.metrics.totalPatterns = this.patterns.size;
    this.metrics.lastUpdated = new Date();

    // Calculate accuracy based on feedback
    const allFeedback = Array.from(this.userFeedback.values()).flat();
    if (allFeedback.length > 0) {
      const avgRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
      this.metrics.userSatisfactionAverage = avgRating;
      this.metrics.accuracyRate = avgRating / 5;
    }
  }

  private async mergePatterns(existing: Pattern, imported: Pattern): Promise<void> {
    // Merge two patterns intelligently
    existing.confidence = (existing.confidence + imported.confidence) / 2;
    existing.frequency += imported.frequency;
    existing.examples.push(...imported.examples);
    existing.suggestions.push(...imported.suggestions);
    existing.rules.push(...imported.rules);

    // Deduplicate
    existing.examples = existing.examples.slice(-50); // Keep recent examples
    existing.suggestions = this.deduplicateSuggestions(existing.suggestions);
    existing.rules = this.deduplicateRules(existing.rules);
  }

  private deduplicateSuggestions(suggestions: PatternSuggestion[]): PatternSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      const key = s.title + s.description;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateRules(rules: PatternRule[]): PatternRule[] {
    const seen = new Set<string>();
    return rules.filter(r => {
      if (seen.has(r.condition)) return false;
      seen.add(r.condition);
      return true;
    });
  }

  private loadBasicPatterns(): void {
    // Load some basic patterns to start with
    const basicPatterns: Pattern[] = [
      {
        id: 'react_component_composition',
        name: 'Component Composition',
        description: 'Components that compose other components effectively',
        type: 'code',
        category: 'react',
        confidence: 0.8,
        frequency: 0,
        lastSeen: new Date(),
        createdAt: new Date(),
        examples: [],
        rules: [
          {
            id: 'composition_rule',
            condition: `nodes.some(n => n.type === 'component' && n.data?.children?.length > 2)`,
            action: 'suggest',
            priority: 5,
            message: 'Good component composition detected'
          }
        ],
        suggestions: [
          {
            id: 'composition_suggestion',
            type: 'improvement',
            title: 'Extract Reusable Components',
            description: 'Consider extracting common UI patterns into reusable components',
            confidence: 0.7,
            effort: 'medium',
            impact: 'high'
          }
        ],
        metadata: {
          tags: ['react', 'composition', 'reusability'],
          complexity: 0.6,
          maintainability: 0.8,
          performance: 0.7,
          security: 0.5,
          accessibility: 0.6,
          relatedPatterns: [],
          sourceType: 'manual'
        }
      }
    ];

    basicPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
  }

  private generatePatternId(name: string): string {
    return `pattern_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createPatternLearningSystem(): PatternLearningSystem {
  return new PatternLearningSystem();
}