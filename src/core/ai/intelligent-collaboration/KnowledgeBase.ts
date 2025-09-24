import { ProjectGraph, ArchitecturalPattern, SemanticData } from '../../../types/index.js';

export interface TeamKnowledge {
  team_id: string;
  team_name: string;
  created_at: Date;
  last_updated: Date;
  pattern_preferences: PatternPreference[];
  architectural_decisions: ArchitecturalDecision[];
  code_standards: CodeStandard[];
  anti_patterns: AntiPatternRule[];
  domain_knowledge: DomainKnowledge[];
  learning_metrics: LearningMetrics;
}

export interface PatternPreference {
  pattern_name: string;
  pattern_type: 'architectural' | 'design' | 'coding' | 'testing' | 'deployment';
  preference_score: number; // -100 to 100 (negative = avoid, positive = prefer)
  usage_frequency: number; // How often team uses this pattern
  success_rate: number; // How successful past implementations were
  context_conditions: ContextCondition[];
  rationale: string;
  examples: PatternExample[];
  last_used: Date;
  team_consensus: number; // 0-100, how much the team agrees on this preference
}

export interface ContextCondition {
  condition_type: 'project_size' | 'team_size' | 'domain' | 'technology_stack' | 'performance_requirements' | 'scalability_needs';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
  value: string | number;
  weight: number; // How important this condition is
}

export interface PatternExample {
  id: string;
  project_name: string;
  implementation_description: string;
  outcome: 'success' | 'failure' | 'mixed';
  lessons_learned: string[];
  code_snippets?: string[];
  metrics: PatternMetrics;
}

export interface PatternMetrics {
  implementation_time: number; // hours
  maintenance_effort: number; // 1-10 scale
  bug_frequency: number; // bugs per month
  performance_impact: number; // -100 to 100 (negative = worse, positive = better)
  developer_satisfaction: number; // 1-10 scale
  business_value: number; // 1-10 scale
}

export interface ArchitecturalDecision {
  id: string;
  title: string;
  decision_date: Date;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  rationale: string;
  consequences: DecisionConsequence[];
  stakeholders: Stakeholder[];
  tags: string[];
  related_patterns: string[];
  outcome_assessment?: OutcomeAssessment;
  superseded_by?: string; // ID of decision that superseded this one
}

export interface DecisionConsequence {
  consequence_type: 'positive' | 'negative' | 'neutral';
  description: string;
  impact_area: 'performance' | 'maintainability' | 'scalability' | 'security' | 'developer_experience' | 'business_value';
  severity: 'low' | 'medium' | 'high';
  timeline: 'immediate' | 'short_term' | 'long_term';
}

export interface Stakeholder {
  name: string;
  role: 'developer' | 'architect' | 'product_manager' | 'business_stakeholder' | 'security_expert';
  involvement: 'decision_maker' | 'consulted' | 'informed';
  agreement_level: number; // 1-10 scale
}

export interface OutcomeAssessment {
  assessment_date: Date;
  assessor: string;
  overall_satisfaction: number; // 1-10 scale
  predicted_vs_actual: PredictionAccuracy[];
  lessons_learned: string[];
  would_decide_again: boolean;
  suggested_improvements: string[];
}

export interface PredictionAccuracy {
  predicted_outcome: string;
  actual_outcome: string;
  accuracy_score: number; // 1-10 scale
}

export interface CodeStandard {
  id: string;
  category: 'naming' | 'structure' | 'documentation' | 'testing' | 'performance' | 'security' | 'style';
  title: string;
  description: string;
  rule_type: 'mandatory' | 'recommended' | 'optional';
  enforcement_level: 'automated' | 'review' | 'guideline';
  examples: CodeExample[];
  violations: ViolationPattern[];
  adoption_rate: number; // 0-100%
  effectiveness_score: number; // 1-10 scale
  last_updated: Date;
}

export interface CodeExample {
  description: string;
  good_example?: string;
  bad_example?: string;
  explanation: string;
}

export interface ViolationPattern {
  pattern: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  common_fixes: string[];
}

export interface AntiPatternRule {
  id: string;
  anti_pattern_name: string;
  description: string;
  why_problematic: string[];
  detection_rules: DetectionRule[];
  alternative_approaches: AlternativeApproach[];
  team_specific_context: string;
  historical_occurrences: HistoricalOccurrence[];
  prevention_strategies: string[];
}

export interface DetectionRule {
  rule_type: 'static_analysis' | 'pattern_matching' | 'metric_threshold' | 'code_smell';
  condition: string;
  threshold?: number;
  confidence: number; // 0-100
}

export interface AlternativeApproach {
  approach_name: string;
  description: string;
  when_to_use: string;
  implementation_guide: string;
  trade_offs: string[];
  team_preference_score: number; // How much the team likes this alternative
}

export interface HistoricalOccurrence {
  project_name: string;
  occurrence_date: Date;
  impact_severity: 'low' | 'medium' | 'high' | 'critical';
  resolution_time: number; // hours
  resolution_approach: string;
  lessons_learned: string[];
  cost_estimate?: number; // in hours or dollars
}

export interface DomainKnowledge {
  domain: string;
  sub_domains: string[];
  key_concepts: DomainConcept[];
  common_patterns: string[];
  domain_specific_rules: DomainRule[];
  business_context: BusinessContext;
  technical_constraints: TechnicalConstraint[];
  integration_points: IntegrationPoint[];
}

export interface DomainConcept {
  name: string;
  definition: string;
  relationships: ConceptRelationship[];
  importance: number; // 1-10 scale
  complexity: number; // 1-10 scale
  change_frequency: 'stable' | 'evolving' | 'volatile';
}

export interface ConceptRelationship {
  related_concept: string;
  relationship_type: 'contains' | 'extends' | 'depends_on' | 'aggregates' | 'composed_of';
  strength: number; // 1-10 scale
}

export interface DomainRule {
  rule_id: string;
  rule_description: string;
  business_justification: string;
  technical_implementation: string[];
  validation_criteria: string[];
  exceptions: RuleException[];
}

export interface RuleException {
  condition: string;
  justification: string;
  approval_required: boolean;
  historical_usage: number;
}

export interface BusinessContext {
  industry: string;
  business_model: string;
  key_stakeholders: string[];
  success_metrics: SuccessMetric[];
  constraints: BusinessConstraint[];
  opportunities: BusinessOpportunity[];
}

export interface SuccessMetric {
  metric_name: string;
  measurement_method: string;
  target_value?: string;
  current_value?: string;
  trend: 'improving' | 'stable' | 'declining';
}

export interface BusinessConstraint {
  constraint_type: 'budget' | 'timeline' | 'regulatory' | 'technical' | 'resource';
  description: string;
  impact_level: 'low' | 'medium' | 'high';
  workaround_options: string[];
}

export interface BusinessOpportunity {
  opportunity_description: string;
  potential_value: string;
  technical_requirements: string[];
  timeline_estimate: string;
  risk_assessment: string;
}

export interface TechnicalConstraint {
  constraint_type: 'performance' | 'scalability' | 'security' | 'integration' | 'technology' | 'resource';
  description: string;
  impact_on_architecture: string;
  mitigation_strategies: string[];
  measurement_criteria: string[];
}

export interface IntegrationPoint {
  system_name: string;
  integration_type: 'api' | 'database' | 'file' | 'message_queue' | 'event_stream';
  data_format: string;
  frequency: string;
  reliability_requirements: string;
  security_requirements: string[];
  known_issues: string[];
}

export interface LearningMetrics {
  total_decisions_tracked: number;
  pattern_adoption_rate: number; // How quickly team adopts new beneficial patterns
  anti_pattern_reduction_rate: number; // How well team avoids known anti-patterns
  decision_accuracy_trend: number[]; // Historical accuracy scores over time
  knowledge_application_score: number; // How well team applies learned knowledge
  collaboration_effectiveness: number; // How well team works together on architectural decisions
  innovation_index: number; // How often team introduces new beneficial patterns
  knowledge_sharing_frequency: number; // How often team members share knowledge
  continuous_learning_score: number; // How actively team learns from experience
  last_assessment_date: Date;
}

export interface KnowledgeQuery {
  query_type: 'pattern_recommendation' | 'decision_guidance' | 'anti_pattern_check' | 'domain_insight' | 'standard_validation';
  context: QueryContext;
  filters?: KnowledgeFilter[];
  similarity_threshold?: number;
  max_results?: number;
}

export interface QueryContext {
  project_characteristics?: ProjectCharacteristics;
  current_architecture?: ArchitecturalSnapshot;
  problem_description?: string;
  stakeholder_preferences?: StakeholderPreference[];
  constraints?: Constraint[];
}

export interface ProjectCharacteristics {
  size: 'small' | 'medium' | 'large' | 'enterprise';
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  domain: string;
  technology_stack: string[];
  team_size: number;
  timeline: string;
  budget_constraints: 'tight' | 'moderate' | 'flexible';
  scalability_requirements: 'low' | 'medium' | 'high' | 'massive';
  performance_requirements: 'standard' | 'high' | 'real_time' | 'batch';
}

export interface ArchitecturalSnapshot {
  current_patterns: string[];
  technology_choices: TechnologyChoice[];
  architectural_style: string;
  deployment_model: string;
  data_architecture: string;
  security_approach: string;
}

export interface TechnologyChoice {
  category: string;
  technology: string;
  version: string;
  rationale: string;
  satisfaction_level: number; // 1-10 scale
}

export interface StakeholderPreference {
  stakeholder_role: string;
  preferences: string[];
  priority_weights: { [key: string]: number };
  non_negotiables: string[];
}

export interface Constraint {
  constraint_type: string;
  description: string;
  flexibility: 'fixed' | 'negotiable' | 'preference';
  impact_if_violated: string;
}

export interface KnowledgeFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
}

export interface KnowledgeRecommendation {
  recommendation_id: string;
  recommendation_type: 'pattern_adoption' | 'anti_pattern_avoidance' | 'decision_guidance' | 'standard_application';
  title: string;
  description: string;
  confidence_score: number; // 0-100
  supporting_evidence: Evidence[];
  implementation_guidance: ImplementationGuidance;
  trade_offs: TradeOff[];
  similar_past_decisions: string[];
  estimated_impact: ImpactEstimation;
  risk_assessment: RiskAssessment;
}

export interface Evidence {
  evidence_type: 'historical_success' | 'team_preference' | 'domain_knowledge' | 'best_practice' | 'anti_pattern_avoidance';
  description: string;
  strength: number; // 1-10 scale
  source: string;
  date: Date;
}

export interface ImplementationGuidance {
  step_by_step: string[];
  code_examples: string[];
  tools_required: string[];
  estimated_effort: string;
  success_criteria: string[];
  common_pitfalls: string[];
  validation_methods: string[];
}

export interface TradeOff {
  aspect: string;
  positive_impact: string;
  negative_impact: string;
  severity: 'low' | 'medium' | 'high';
  mitigation_strategies: string[];
}

export interface ImpactEstimation {
  development_time: string;
  maintenance_effort: string;
  performance_impact: string;
  scalability_impact: string;
  team_productivity_impact: string;
  business_value_impact: string;
  risk_impact: string;
}

export interface RiskAssessment {
  implementation_risks: Risk[];
  operational_risks: Risk[];
  business_risks: Risk[];
  overall_risk_level: 'low' | 'medium' | 'high' | 'very_high';
  mitigation_strategies: string[];
}

export interface Risk {
  risk_description: string;
  probability: number; // 0-100
  impact: number; // 0-100
  risk_score: number; // probability * impact
  mitigation_actions: string[];
}

export class KnowledgeBase {
  private teamKnowledge: Map<string, TeamKnowledge> = new Map();
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly MAX_RECOMMENDATIONS = 10;

  public async initializeTeamKnowledge(teamId: string, teamName: string): Promise<TeamKnowledge> {
    const initialKnowledge: TeamKnowledge = {
      team_id: teamId,
      team_name: teamName,
      created_at: new Date(),
      last_updated: new Date(),
      pattern_preferences: [],
      architectural_decisions: [],
      code_standards: [],
      anti_patterns: [],
      domain_knowledge: [],
      learning_metrics: {
        total_decisions_tracked: 0,
        pattern_adoption_rate: 0,
        anti_pattern_reduction_rate: 0,
        decision_accuracy_trend: [],
        knowledge_application_score: 0,
        collaboration_effectiveness: 0,
        innovation_index: 0,
        knowledge_sharing_frequency: 0,
        continuous_learning_score: 0,
        last_assessment_date: new Date()
      }
    };

    this.teamKnowledge.set(teamId, initialKnowledge);
    return initialKnowledge;
  }

  public async recordArchitecturalDecision(teamId: string, decision: Omit<ArchitecturalDecision, 'id'>): Promise<string> {
    const knowledge = this.teamKnowledge.get(teamId);
    if (!knowledge) {
      throw new Error(`Team knowledge not found for team: ${teamId}`);
    }

    const decisionId = this.generateId();
    const fullDecision: ArchitecturalDecision = {
      ...decision,
      id: decisionId
    };

    knowledge.architectural_decisions.push(fullDecision);
    knowledge.last_updated = new Date();
    knowledge.learning_metrics.total_decisions_tracked++;

    // Update pattern preferences based on decision
    await this.updatePatternPreferencesFromDecision(teamId, fullDecision);

    return decisionId;
  }

  public async recordPatternUsage(teamId: string, patternName: string, usage: PatternExample): Promise<void> {
    const knowledge = this.teamKnowledge.get(teamId);
    if (!knowledge) {
      throw new Error(`Team knowledge not found for team: ${teamId}`);
    }

    let preference = knowledge.pattern_preferences.find(p => p.pattern_name === patternName);
    if (!preference) {
      preference = {
        pattern_name: patternName,
        pattern_type: 'architectural',
        preference_score: 0,
        usage_frequency: 0,
        success_rate: 0,
        context_conditions: [],
        rationale: '',
        examples: [],
        last_used: new Date(),
        team_consensus: 50
      };
      knowledge.pattern_preferences.push(preference);
    }

    preference.examples.push(usage);
    preference.usage_frequency++;
    preference.last_used = new Date();

    // Update success rate based on outcome
    const successfulUsages = preference.examples.filter(e => e.outcome === 'success').length;
    preference.success_rate = (successfulUsages / preference.examples.length) * 100;

    // Update preference score based on recent outcomes
    if (usage.outcome === 'success') {
      preference.preference_score = Math.min(preference.preference_score + 10, 100);
    } else if (usage.outcome === 'failure') {
      preference.preference_score = Math.max(preference.preference_score - 20, -100);
    }

    knowledge.last_updated = new Date();
  }

  public async recordAntiPatternOccurrence(teamId: string, antiPatternName: string, occurrence: HistoricalOccurrence): Promise<void> {
    const knowledge = this.teamKnowledge.get(teamId);
    if (!knowledge) {
      throw new Error(`Team knowledge not found for team: ${teamId}`);
    }

    let antiPattern = knowledge.anti_patterns.find(ap => ap.anti_pattern_name === antiPatternName);
    if (!antiPattern) {
      antiPattern = {
        id: this.generateId(),
        anti_pattern_name: antiPatternName,
        description: `Anti-pattern: ${antiPatternName}`,
        why_problematic: [],
        detection_rules: [],
        alternative_approaches: [],
        team_specific_context: '',
        historical_occurrences: [],
        prevention_strategies: []
      };
      knowledge.anti_patterns.push(antiPattern);
    }

    antiPattern.historical_occurrences.push(occurrence);
    knowledge.last_updated = new Date();

    // Update anti-pattern reduction rate
    this.updateAntiPatternMetrics(knowledge);
  }

  public async getRecommendations(teamId: string, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    const knowledge = this.teamKnowledge.get(teamId);
    if (!knowledge) {
      return [];
    }

    const recommendations: KnowledgeRecommendation[] = [];

    switch (query.query_type) {
      case 'pattern_recommendation':
        recommendations.push(...await this.getPatternRecommendations(knowledge, query));
        break;
      case 'decision_guidance':
        recommendations.push(...await this.getDecisionGuidance(knowledge, query));
        break;
      case 'anti_pattern_check':
        recommendations.push(...await this.getAntiPatternWarnings(knowledge, query));
        break;
      case 'domain_insight':
        recommendations.push(...await this.getDomainInsights(knowledge, query));
        break;
      case 'standard_validation':
        recommendations.push(...await this.getStandardValidation(knowledge, query));
        break;
    }

    return recommendations
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, query.max_results || this.MAX_RECOMMENDATIONS);
  }

  private async getPatternRecommendations(knowledge: TeamKnowledge, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // Find patterns that match the current context
    const relevantPatterns = knowledge.pattern_preferences.filter(pattern => {
      return this.matchesContext(pattern.context_conditions, query.context);
    });

    for (const pattern of relevantPatterns) {
      if (pattern.preference_score > 50 && pattern.success_rate > 70) {
        const recommendation: KnowledgeRecommendation = {
          recommendation_id: this.generateId(),
          recommendation_type: 'pattern_adoption',
          title: `Consider using ${pattern.pattern_name} pattern`,
          description: `Based on team history, the ${pattern.pattern_name} pattern has a ${pattern.success_rate}% success rate in similar contexts.`,
          confidence_score: this.calculatePatternConfidence(pattern, query.context),
          supporting_evidence: this.buildPatternEvidence(pattern),
          implementation_guidance: this.buildImplementationGuidance(pattern),
          trade_offs: this.identifyPatternTradeOffs(pattern),
          similar_past_decisions: this.findSimilarDecisions(knowledge, pattern.pattern_name),
          estimated_impact: this.estimatePatternImpact(pattern),
          risk_assessment: this.assessPatternRisks(pattern)
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private async getDecisionGuidance(knowledge: TeamKnowledge, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // Find similar past decisions
    const similarDecisions = knowledge.architectural_decisions.filter(decision => {
      return this.isDecisionSimilar(decision, query.context);
    });

    if (similarDecisions.length > 0) {
      const successfulDecisions = similarDecisions.filter(d =>
        d.outcome_assessment?.overall_satisfaction && d.outcome_assessment.overall_satisfaction >= 7
      );

      if (successfulDecisions.length > 0) {
        const mostSuccessful = successfulDecisions.reduce((prev, current) =>
          (current.outcome_assessment?.overall_satisfaction || 0) > (prev.outcome_assessment?.overall_satisfaction || 0) ? current : prev
        );

        const recommendation: KnowledgeRecommendation = {
          recommendation_id: this.generateId(),
          recommendation_type: 'decision_guidance',
          title: `Consider approach from successful decision: ${mostSuccessful.title}`,
          description: `A similar decision in the past achieved ${mostSuccessful.outcome_assessment?.overall_satisfaction}/10 satisfaction.`,
          confidence_score: this.calculateDecisionConfidence(mostSuccessful, similarDecisions),
          supporting_evidence: this.buildDecisionEvidence(mostSuccessful, similarDecisions),
          implementation_guidance: {
            step_by_step: [mostSuccessful.decision],
            code_examples: [],
            tools_required: [],
            estimated_effort: 'Based on similar past decision',
            success_criteria: mostSuccessful.consequences.filter(c => c.consequence_type === 'positive').map(c => c.description),
            common_pitfalls: mostSuccessful.consequences.filter(c => c.consequence_type === 'negative').map(c => c.description),
            validation_methods: []
          },
          trade_offs: mostSuccessful.consequences.map(c => ({
            aspect: c.impact_area,
            positive_impact: c.consequence_type === 'positive' ? c.description : '',
            negative_impact: c.consequence_type === 'negative' ? c.description : '',
            severity: c.severity,
            mitigation_strategies: []
          })),
          similar_past_decisions: [mostSuccessful.id],
          estimated_impact: {
            development_time: 'Estimated based on similar decision',
            maintenance_effort: 'Based on past experience',
            performance_impact: 'Similar to past decision',
            scalability_impact: 'Based on team history',
            team_productivity_impact: 'Positive based on past success',
            business_value_impact: 'High based on similar decision',
            risk_impact: 'Moderate based on team experience'
          },
          risk_assessment: {
            implementation_risks: [],
            operational_risks: [],
            business_risks: [],
            overall_risk_level: 'medium',
            mitigation_strategies: mostSuccessful.outcome_assessment?.suggested_improvements || []
          }
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private async getAntiPatternWarnings(knowledge: TeamKnowledge, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // Check for potential anti-patterns based on current context
    for (const antiPattern of knowledge.anti_patterns) {
      if (this.couldTriggerAntiPattern(antiPattern, query.context)) {
        const recommendation: KnowledgeRecommendation = {
          recommendation_id: this.generateId(),
          recommendation_type: 'anti_pattern_avoidance',
          title: `Warning: Potential ${antiPattern.anti_pattern_name} anti-pattern`,
          description: `The current context suggests risk of the ${antiPattern.anti_pattern_name} anti-pattern. ${antiPattern.description}`,
          confidence_score: this.calculateAntiPatternRisk(antiPattern, query.context),
          supporting_evidence: this.buildAntiPatternEvidence(antiPattern),
          implementation_guidance: {
            step_by_step: antiPattern.prevention_strategies,
            code_examples: [],
            tools_required: [],
            estimated_effort: 'Varies based on current architecture',
            success_criteria: [`Avoid ${antiPattern.anti_pattern_name} characteristics`],
            common_pitfalls: antiPattern.why_problematic,
            validation_methods: antiPattern.detection_rules.map(r => r.condition)
          },
          trade_offs: antiPattern.alternative_approaches.map(alt => ({
            aspect: alt.approach_name,
            positive_impact: alt.description,
            negative_impact: alt.trade_offs.join(', '),
            severity: 'medium',
            mitigation_strategies: [alt.implementation_guide]
          })),
          similar_past_decisions: [],
          estimated_impact: this.estimateAntiPatternAvoidanceImpact(antiPattern),
          risk_assessment: {
            implementation_risks: antiPattern.historical_occurrences.map(occ => ({
              risk_description: `Similar to ${occ.project_name} incident`,
              probability: 60,
              impact: this.severityToImpact(occ.impact_severity),
              risk_score: 60 * this.severityToImpact(occ.impact_severity) / 100,
              mitigation_actions: occ.lessons_learned
            })),
            operational_risks: [],
            business_risks: [],
            overall_risk_level: 'medium',
            mitigation_strategies: antiPattern.prevention_strategies
          }
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private async getDomainInsights(knowledge: TeamKnowledge, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    // Implementation for domain-specific insights based on team knowledge
    return [];
  }

  private async getStandardValidation(knowledge: TeamKnowledge, query: KnowledgeQuery): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // Check if current approach aligns with team standards
    const relevantStandards = knowledge.code_standards.filter(standard =>
      this.isStandardRelevant(standard, query.context)
    );

    for (const standard of relevantStandards) {
      if (standard.adoption_rate < 80) {
        const recommendation: KnowledgeRecommendation = {
          recommendation_id: this.generateId(),
          recommendation_type: 'standard_application',
          title: `Apply team standard: ${standard.title}`,
          description: `Team standard for ${standard.category} has ${standard.adoption_rate}% adoption rate. ${standard.description}`,
          confidence_score: standard.effectiveness_score * 10,
          supporting_evidence: [{
            evidence_type: 'best_practice',
            description: `Team standard with ${standard.effectiveness_score}/10 effectiveness`,
            strength: standard.effectiveness_score,
            source: 'Team Knowledge Base',
            date: standard.last_updated
          }],
          implementation_guidance: {
            step_by_step: [standard.description],
            code_examples: standard.examples.map(ex => ex.good_example || ''),
            tools_required: [],
            estimated_effort: standard.enforcement_level === 'automated' ? 'Low' : 'Medium',
            success_criteria: [`Meets ${standard.title} requirements`],
            common_pitfalls: standard.violations.map(v => v.pattern),
            validation_methods: [`Check against ${standard.title} guidelines`]
          },
          trade_offs: [],
          similar_past_decisions: [],
          estimated_impact: {
            development_time: 'Minimal if automated',
            maintenance_effort: 'Reduced long-term',
            performance_impact: 'Neutral',
            scalability_impact: 'Positive for consistency',
            team_productivity_impact: 'Positive long-term',
            business_value_impact: 'Improved code quality',
            risk_impact: 'Reduced'
          },
          risk_assessment: {
            implementation_risks: [],
            operational_risks: [],
            business_risks: [],
            overall_risk_level: 'low',
            mitigation_strategies: []
          }
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private matchesContext(conditions: ContextCondition[], context: QueryContext): boolean {
    if (conditions.length === 0) return true;

    return conditions.some(condition => {
      // Simple context matching logic - would be more sophisticated in real implementation
      return true; // Placeholder
    });
  }

  private calculatePatternConfidence(pattern: PatternPreference, context: QueryContext): number {
    let confidence = pattern.preference_score;

    // Adjust based on success rate
    confidence += (pattern.success_rate - 50);

    // Adjust based on team consensus
    confidence = confidence * (pattern.team_consensus / 100);

    // Adjust based on usage frequency (more usage = more confidence)
    if (pattern.usage_frequency > 5) confidence += 10;
    else if (pattern.usage_frequency < 2) confidence -= 10;

    return Math.max(0, Math.min(100, confidence));
  }

  private buildPatternEvidence(pattern: PatternPreference): Evidence[] {
    const evidence: Evidence[] = [];

    if (pattern.success_rate > 70) {
      evidence.push({
        evidence_type: 'historical_success',
        description: `${pattern.success_rate}% success rate across ${pattern.examples.length} uses`,
        strength: Math.round(pattern.success_rate / 10),
        source: 'Team History',
        date: pattern.last_used
      });
    }

    if (pattern.preference_score > 60) {
      evidence.push({
        evidence_type: 'team_preference',
        description: `Team preference score: ${pattern.preference_score}/100`,
        strength: Math.round(pattern.preference_score / 10),
        source: 'Team Preferences',
        date: pattern.last_used
      });
    }

    return evidence;
  }

  private buildImplementationGuidance(pattern: PatternPreference): ImplementationGuidance {
    const successfulExamples = pattern.examples.filter(e => e.outcome === 'success');

    return {
      step_by_step: [pattern.rationale],
      code_examples: successfulExamples.flatMap(ex => ex.code_snippets || []),
      tools_required: [],
      estimated_effort: this.estimateEffortFromHistory(pattern.examples),
      success_criteria: [`Implement ${pattern.pattern_name} pattern correctly`],
      common_pitfalls: pattern.examples
        .filter(e => e.outcome === 'failure')
        .flatMap(e => e.lessons_learned),
      validation_methods: [`Verify ${pattern.pattern_name} pattern implementation`]
    };
  }

  private identifyPatternTradeOffs(pattern: PatternPreference): TradeOff[] {
    return pattern.examples.flatMap(example => {
      return example.lessons_learned.map(lesson => ({
        aspect: 'Implementation',
        positive_impact: example.outcome === 'success' ? lesson : '',
        negative_impact: example.outcome === 'failure' ? lesson : '',
        severity: 'medium' as const,
        mitigation_strategies: example.outcome === 'failure' ? [lesson] : []
      }));
    });
  }

  private findSimilarDecisions(knowledge: TeamKnowledge, patternName: string): string[] {
    return knowledge.architectural_decisions
      .filter(decision => decision.related_patterns.includes(patternName))
      .map(decision => decision.id);
  }

  private estimatePatternImpact(pattern: PatternPreference): ImpactEstimation {
    const avgMetrics = this.calculateAverageMetrics(pattern.examples);

    return {
      development_time: `${avgMetrics.implementation_time} hours (avg from team history)`,
      maintenance_effort: `${avgMetrics.maintenance_effort}/10 maintenance effort`,
      performance_impact: avgMetrics.performance_impact > 0 ? 'Positive' : 'Neutral',
      scalability_impact: 'Based on pattern characteristics',
      team_productivity_impact: avgMetrics.developer_satisfaction > 7 ? 'Positive' : 'Neutral',
      business_value_impact: `${avgMetrics.business_value}/10 business value`,
      risk_impact: pattern.success_rate > 80 ? 'Low risk' : 'Moderate risk'
    };
  }

  private assessPatternRisks(pattern: PatternPreference): RiskAssessment {
    const failures = pattern.examples.filter(e => e.outcome === 'failure');

    return {
      implementation_risks: failures.map(failure => ({
        risk_description: `Risk similar to ${failure.project_name}`,
        probability: (failures.length / pattern.examples.length) * 100,
        impact: 70,
        risk_score: ((failures.length / pattern.examples.length) * 100) * 0.7,
        mitigation_actions: failure.lessons_learned
      })),
      operational_risks: [],
      business_risks: [],
      overall_risk_level: pattern.success_rate > 80 ? 'low' : pattern.success_rate > 60 ? 'medium' : 'high',
      mitigation_strategies: failures.flatMap(f => f.lessons_learned)
    };
  }

  private calculateAverageMetrics(examples: PatternExample[]): PatternMetrics {
    if (examples.length === 0) {
      return {
        implementation_time: 0,
        maintenance_effort: 5,
        bug_frequency: 0,
        performance_impact: 0,
        developer_satisfaction: 5,
        business_value: 5
      };
    }

    const sum = examples.reduce((acc, ex) => ({
      implementation_time: acc.implementation_time + ex.metrics.implementation_time,
      maintenance_effort: acc.maintenance_effort + ex.metrics.maintenance_effort,
      bug_frequency: acc.bug_frequency + ex.metrics.bug_frequency,
      performance_impact: acc.performance_impact + ex.metrics.performance_impact,
      developer_satisfaction: acc.developer_satisfaction + ex.metrics.developer_satisfaction,
      business_value: acc.business_value + ex.metrics.business_value
    }), {
      implementation_time: 0,
      maintenance_effort: 0,
      bug_frequency: 0,
      performance_impact: 0,
      developer_satisfaction: 0,
      business_value: 0
    });

    return {
      implementation_time: sum.implementation_time / examples.length,
      maintenance_effort: sum.maintenance_effort / examples.length,
      bug_frequency: sum.bug_frequency / examples.length,
      performance_impact: sum.performance_impact / examples.length,
      developer_satisfaction: sum.developer_satisfaction / examples.length,
      business_value: sum.business_value / examples.length
    };
  }

  private isDecisionSimilar(decision: ArchitecturalDecision, context: QueryContext): boolean {
    // Simplified similarity check - would use more sophisticated matching in real implementation
    if (!context.problem_description) return false;

    return decision.context.toLowerCase().includes(context.problem_description.toLowerCase()) ||
           decision.decision.toLowerCase().includes(context.problem_description.toLowerCase());
  }

  private calculateDecisionConfidence(decision: ArchitecturalDecision, similarDecisions: ArchitecturalDecision[]): number {
    const satisfactionScore = decision.outcome_assessment?.overall_satisfaction || 5;
    const similarityScore = Math.min(similarDecisions.length * 10, 50);

    return Math.min((satisfactionScore * 10) + similarityScore, 100);
  }

  private buildDecisionEvidence(decision: ArchitecturalDecision, similarDecisions: ArchitecturalDecision[]): Evidence[] {
    const evidence: Evidence[] = [];

    if (decision.outcome_assessment) {
      evidence.push({
        evidence_type: 'historical_success',
        description: `Previous similar decision achieved ${decision.outcome_assessment.overall_satisfaction}/10 satisfaction`,
        strength: decision.outcome_assessment.overall_satisfaction,
        source: `Decision: ${decision.title}`,
        date: decision.decision_date
      });
    }

    if (similarDecisions.length > 1) {
      evidence.push({
        evidence_type: 'team_preference',
        description: `${similarDecisions.length} similar decisions in team history`,
        strength: Math.min(similarDecisions.length, 10),
        source: 'Team Decision History',
        date: new Date()
      });
    }

    return evidence;
  }

  private couldTriggerAntiPattern(antiPattern: AntiPatternRule, context: QueryContext): boolean {
    // Check if current context matches anti-pattern conditions
    for (const rule of antiPattern.detection_rules) {
      if (this.evaluateDetectionRule(rule, context)) {
        return true;
      }
    }
    return false;
  }

  private evaluateDetectionRule(rule: DetectionRule, context: QueryContext): boolean {
    // Simplified rule evaluation - would be more sophisticated in real implementation
    if (!context.problem_description) return false;

    return context.problem_description.toLowerCase().includes(rule.condition.toLowerCase());
  }

  private calculateAntiPatternRisk(antiPattern: AntiPatternRule, context: QueryContext): number {
    const historicalFrequency = antiPattern.historical_occurrences.length;
    const recentOccurrences = antiPattern.historical_occurrences.filter(
      occ => (new Date().getTime() - occ.occurrence_date.getTime()) < (365 * 24 * 60 * 60 * 1000) // Last year
    ).length;

    let riskScore = Math.min(historicalFrequency * 10, 50);
    riskScore += recentOccurrences * 15;

    return Math.min(riskScore, 100);
  }

  private buildAntiPatternEvidence(antiPattern: AntiPatternRule): Evidence[] {
    return antiPattern.historical_occurrences.map(occ => ({
      evidence_type: 'historical_success',
      description: `${occ.impact_severity} impact incident in ${occ.project_name}`,
      strength: this.severityToStrength(occ.impact_severity),
      source: `Project: ${occ.project_name}`,
      date: occ.occurrence_date
    }));
  }

  private severityToStrength(severity: string): number {
    switch (severity) {
      case 'critical': return 10;
      case 'high': return 8;
      case 'medium': return 6;
      case 'low': return 4;
      default: return 5;
    }
  }

  private severityToImpact(severity: string): number {
    switch (severity) {
      case 'critical': return 100;
      case 'high': return 80;
      case 'medium': return 60;
      case 'low': return 40;
      default: return 50;
    }
  }

  private estimateAntiPatternAvoidanceImpact(antiPattern: AntiPatternRule): ImpactEstimation {
    const avgResolutionTime = antiPattern.historical_occurrences.length > 0
      ? antiPattern.historical_occurrences.reduce((sum, occ) => sum + occ.resolution_time, 0) / antiPattern.historical_occurrences.length
      : 0;

    return {
      development_time: `Prevention: 2-4 hours vs Resolution: ${avgResolutionTime} hours`,
      maintenance_effort: 'Significantly reduced',
      performance_impact: 'Positive - avoids performance degradation',
      scalability_impact: 'Positive - maintains scalability',
      team_productivity_impact: 'High positive impact',
      business_value_impact: 'High - avoids technical debt',
      risk_impact: 'Significantly reduced'
    };
  }

  private isStandardRelevant(standard: CodeStandard, context: QueryContext): boolean {
    // Simplified relevance check - would be more sophisticated in real implementation
    return true; // Assume all standards are potentially relevant
  }

  private estimateEffortFromHistory(examples: PatternExample[]): string {
    if (examples.length === 0) return 'Unknown';

    const avgTime = examples.reduce((sum, ex) => sum + ex.metrics.implementation_time, 0) / examples.length;

    if (avgTime < 8) return 'Low (< 1 day)';
    if (avgTime < 40) return 'Medium (1-5 days)';
    return 'High (> 5 days)';
  }

  private updatePatternPreferencesFromDecision(teamId: string, decision: ArchitecturalDecision): Promise<void> {
    // Update pattern preferences based on architectural decision
    // This would analyze the decision and update relevant pattern scores
    return Promise.resolve();
  }

  private updateAntiPatternMetrics(knowledge: TeamKnowledge): void {
    // Calculate anti-pattern reduction rate based on historical data
    const totalOccurrences = knowledge.anti_patterns.reduce((sum, ap) => sum + ap.historical_occurrences.length, 0);
    const recentOccurrences = knowledge.anti_patterns.reduce((sum, ap) => {
      return sum + ap.historical_occurrences.filter(occ =>
        (new Date().getTime() - occ.occurrence_date.getTime()) < (90 * 24 * 60 * 60 * 1000) // Last 90 days
      ).length;
    }, 0);

    if (totalOccurrences > 0) {
      knowledge.learning_metrics.anti_pattern_reduction_rate =
        Math.max(0, 100 - ((recentOccurrences / totalOccurrences) * 100));
    }
  }

  private generateId(): string {
    return `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async exportTeamKnowledge(teamId: string): Promise<TeamKnowledge | null> {
    return this.teamKnowledge.get(teamId) || null;
  }

  public async importTeamKnowledge(knowledge: TeamKnowledge): Promise<void> {
    this.teamKnowledge.set(knowledge.team_id, knowledge);
  }

  public async updateLearningMetrics(teamId: string): Promise<void> {
    const knowledge = this.teamKnowledge.get(teamId);
    if (!knowledge) return;

    // Recalculate all learning metrics
    knowledge.learning_metrics.pattern_adoption_rate = this.calculatePatternAdoptionRate(knowledge);
    knowledge.learning_metrics.knowledge_application_score = this.calculateKnowledgeApplicationScore(knowledge);
    knowledge.learning_metrics.collaboration_effectiveness = this.calculateCollaborationEffectiveness(knowledge);
    knowledge.learning_metrics.innovation_index = this.calculateInnovationIndex(knowledge);
    knowledge.learning_metrics.continuous_learning_score = this.calculateContinuousLearningScore(knowledge);
    knowledge.learning_metrics.last_assessment_date = new Date();
  }

  private calculatePatternAdoptionRate(knowledge: TeamKnowledge): number {
    const recommendedPatterns = knowledge.pattern_preferences.filter(p => p.preference_score > 50).length;
    const adoptedPatterns = knowledge.pattern_preferences.filter(p => p.usage_frequency > 0).length;

    return recommendedPatterns > 0 ? (adoptedPatterns / recommendedPatterns) * 100 : 0;
  }

  private calculateKnowledgeApplicationScore(knowledge: TeamKnowledge): number {
    const decisionsWithOutcomes = knowledge.architectural_decisions.filter(d => d.outcome_assessment).length;
    const successfulDecisions = knowledge.architectural_decisions.filter(d =>
      d.outcome_assessment && d.outcome_assessment.overall_satisfaction >= 7
    ).length;

    return decisionsWithOutcomes > 0 ? (successfulDecisions / decisionsWithOutcomes) * 100 : 0;
  }

  private calculateCollaborationEffectiveness(knowledge: TeamKnowledge): number {
    const consensusScores = knowledge.pattern_preferences.map(p => p.team_consensus);
    const avgConsensus = consensusScores.length > 0
      ? consensusScores.reduce((sum, score) => sum + score, 0) / consensusScores.length
      : 50;

    return avgConsensus;
  }

  private calculateInnovationIndex(knowledge: TeamKnowledge): number {
    const customPatterns = knowledge.pattern_preferences.filter(p =>
      !['mvc', 'observer', 'factory', 'singleton', 'strategy'].includes(p.pattern_name.toLowerCase())
    ).length;

    const totalPatterns = knowledge.pattern_preferences.length;
    return totalPatterns > 0 ? (customPatterns / totalPatterns) * 100 : 0;
  }

  private calculateContinuousLearningScore(knowledge: TeamKnowledge): number {
    const recentDecisions = knowledge.architectural_decisions.filter(d =>
      (new Date().getTime() - d.decision_date.getTime()) < (90 * 24 * 60 * 60 * 1000) // Last 90 days
    ).length;

    const recentPatternUsage = knowledge.pattern_preferences.filter(p =>
      (new Date().getTime() - p.last_used.getTime()) < (90 * 24 * 60 * 60 * 1000) // Last 90 days
    ).length;

    return Math.min((recentDecisions + recentPatternUsage) * 5, 100);
  }
}