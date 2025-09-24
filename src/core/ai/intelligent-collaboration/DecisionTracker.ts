import { ProjectGraph, ArchitecturalPattern } from '../../../types/index.js';

export interface DecisionRecord {
  id: string;
  timestamp: Date;
  decision_type: 'architectural' | 'technical' | 'business' | 'design' | 'security' | 'performance';
  title: string;
  description: string;
  context: DecisionContext;
  options_considered: DecisionOption[];
  chosen_option: string; // ID of the chosen option
  decision_maker: DecisionMaker;
  stakeholders: StakeholderInput[];
  rationale: DecisionRationale;
  impact_assessment: ImpactAssessment;
  implementation_plan: ImplementationPlan;
  success_criteria: SuccessCriterion[];
  risks: RiskAssessment[];
  assumptions: Assumption[];
  dependencies: DecisionDependency[];
  status: 'proposed' | 'approved' | 'implemented' | 'validated' | 'revised' | 'deprecated';
  outcomes: DecisionOutcome[];
  lessons_learned: LessonLearned[];
  related_decisions: string[];
  tags: string[];
  attachments: Attachment[];
  review_history: ReviewRecord[];
  metrics: DecisionMetrics;
}

export interface DecisionContext {
  business_context: BusinessContext;
  technical_context: TechnicalContext;
  organizational_context: OrganizationalContext;
  temporal_context: TemporalContext;
  external_factors: ExternalFactor[];
  constraints: ContextualConstraint[];
  current_architecture_state: ArchitecturalState;
}

export interface BusinessContext {
  business_objectives: string[];
  user_needs: UserNeed[];
  market_conditions: string[];
  competitive_landscape: string[];
  revenue_impact: RevenueImpact;
  customer_segments: string[];
  business_risks: BusinessRisk[];
  regulatory_requirements: string[];
  compliance_needs: string[];
}

export interface UserNeed {
  user_type: string;
  need_description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  satisfaction_metric: string;
  current_pain_points: string[];
}

export interface RevenueImpact {
  impact_type: 'cost_reduction' | 'revenue_increase' | 'risk_mitigation' | 'efficiency_gain';
  estimated_value: number;
  timeframe: string;
  confidence_level: number; // 0-100
  calculation_method: string;
}

export interface BusinessRisk {
  risk_description: string;
  probability: number; // 0-100
  business_impact: number; // 0-100
  mitigation_strategies: string[];
}

export interface TechnicalContext {
  current_architecture: string[];
  technology_stack: TechnologyStack;
  system_constraints: SystemConstraint[];
  performance_requirements: PerformanceRequirement[];
  scalability_requirements: ScalabilityRequirement[];
  security_requirements: SecurityRequirement[];
  integration_requirements: IntegrationRequirement[];
  technical_debt: TechnicalDebt[];
  available_resources: TechnicalResource[];
}

export interface TechnologyStack {
  frontend: string[];
  backend: string[];
  databases: string[];
  infrastructure: string[];
  tools: string[];
  libraries: string[];
  versions: { [key: string]: string };
}

export interface SystemConstraint {
  constraint_type: 'hardware' | 'software' | 'network' | 'storage' | 'security' | 'compliance';
  description: string;
  impact_level: 'blocking' | 'limiting' | 'preference';
  workaround_available: boolean;
  workaround_description?: string;
}

export interface PerformanceRequirement {
  metric: 'response_time' | 'throughput' | 'latency' | 'memory_usage' | 'cpu_usage';
  target_value: number;
  unit: string;
  measurement_context: string;
  priority: 'must_have' | 'should_have' | 'nice_to_have';
}

export interface ScalabilityRequirement {
  dimension: 'users' | 'data' | 'transactions' | 'geography' | 'features';
  current_scale: string;
  target_scale: string;
  growth_rate: string;
  timeline: string;
}

export interface SecurityRequirement {
  requirement_type: 'authentication' | 'authorization' | 'encryption' | 'audit' | 'privacy' | 'compliance';
  description: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  compliance_frameworks: string[];
  implementation_guidelines: string[];
}

export interface IntegrationRequirement {
  system_name: string;
  integration_type: 'api' | 'database' | 'file_transfer' | 'event_streaming' | 'batch_processing';
  data_volume: string;
  frequency: string;
  reliability_requirements: string;
  latency_requirements: string;
}

export interface TechnicalDebt {
  debt_type: 'code_quality' | 'architecture' | 'documentation' | 'testing' | 'security' | 'performance';
  description: string;
  impact_severity: 'low' | 'medium' | 'high' | 'critical';
  affected_components: string[];
  estimated_effort_to_fix: string;
  business_impact: string;
}

export interface TechnicalResource {
  resource_type: 'team_capacity' | 'budget' | 'infrastructure' | 'tools' | 'expertise';
  availability: string;
  constraints: string[];
  cost_implications: string;
}

export interface OrganizationalContext {
  team_structure: TeamStructure;
  decision_making_process: string;
  communication_patterns: CommunicationPattern[];
  culture_factors: CultureFactor[];
  skill_matrix: SkillAssessment[];
  change_management: ChangeManagement;
  governance_model: GovernanceModel;
}

export interface TeamStructure {
  team_size: number;
  roles: TeamRole[];
  reporting_structure: string;
  collaboration_model: string;
  geographic_distribution: string[];
  experience_levels: { [role: string]: string };
}

export interface TeamRole {
  role_name: string;
  responsibilities: string[];
  decision_authority: string[];
  required_skills: string[];
  current_capacity: number; // 0-100%
}

export interface CommunicationPattern {
  pattern_type: 'formal_meetings' | 'informal_discussions' | 'documentation' | 'code_reviews' | 'slack_channels';
  frequency: string;
  participants: string[];
  effectiveness: number; // 1-10 scale
  improvement_opportunities: string[];
}

export interface CultureFactor {
  factor: string;
  impact_on_decision: 'positive' | 'negative' | 'neutral';
  description: string;
  adaptation_strategies: string[];
}

export interface SkillAssessment {
  skill_category: string;
  current_level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  desired_level: 'novice' | 'intermediate' | 'advanced' | 'expert';
  gap_analysis: string;
  development_plan: string[];
}

export interface ChangeManagement {
  change_tolerance: 'low' | 'medium' | 'high';
  change_process: string[];
  stakeholder_buy_in: number; // 0-100%
  training_requirements: string[];
  communication_strategy: string;
}

export interface GovernanceModel {
  approval_process: string[];
  review_cycles: string;
  compliance_checkpoints: string[];
  escalation_procedures: string[];
  documentation_requirements: string[];
}

export interface TemporalContext {
  deadline_constraints: DeadlineConstraint[];
  seasonal_factors: SeasonalFactor[];
  market_timing: MarketTiming;
  resource_availability_timeline: ResourceTimeline[];
  dependency_timelines: DependencyTimeline[];
}

export interface DeadlineConstraint {
  deadline_type: 'hard' | 'soft' | 'preferred';
  date: Date;
  consequence_of_missing: string;
  flexibility: number; // 0-100%
  driving_factors: string[];
}

export interface SeasonalFactor {
  factor_description: string;
  timing: string;
  impact_on_decision: string;
  historical_patterns: string[];
}

export interface MarketTiming {
  competitive_pressure: 'low' | 'medium' | 'high';
  market_opportunity_window: string;
  customer_readiness: string;
  technology_maturity: string;
}

export interface ResourceTimeline {
  resource_type: string;
  availability_periods: AvailabilityPeriod[];
  constraints: string[];
  cost_variations: CostVariation[];
}

export interface AvailabilityPeriod {
  start_date: Date;
  end_date: Date;
  capacity: number; // 0-100%
  conditions: string[];
}

export interface CostVariation {
  period: string;
  cost_multiplier: number;
  reason: string;
}

export interface DependencyTimeline {
  dependency_name: string;
  expected_completion: Date;
  confidence_level: number; // 0-100%
  contingency_plans: string[];
}

export interface ExternalFactor {
  factor_type: 'regulatory' | 'market' | 'technology' | 'economic' | 'social' | 'environmental';
  description: string;
  impact_direction: 'positive' | 'negative' | 'neutral' | 'mixed';
  probability_of_occurrence: number; // 0-100%
  potential_impact: number; // 0-100%
  monitoring_strategy: string;
  contingency_plans: string[];
}

export interface ContextualConstraint {
  constraint_type: string;
  description: string;
  flexibility: 'fixed' | 'negotiable' | 'preference';
  impact_if_violated: string;
  alternatives: string[];
}

export interface ArchitecturalState {
  current_patterns: string[];
  architectural_style: string;
  quality_attributes: QualityAttribute[];
  technical_metrics: TechnicalMetric[];
  known_issues: ArchitecturalIssue[];
  evolution_history: ArchitecturalEvolution[];
}

export interface QualityAttribute {
  attribute: 'performance' | 'scalability' | 'reliability' | 'security' | 'maintainability' | 'usability';
  current_level: number; // 1-10 scale
  target_level: number; // 1-10 scale
  measurement_method: string;
  improvement_strategies: string[];
}

export interface TechnicalMetric {
  metric_name: string;
  current_value: number;
  target_value?: number;
  unit: string;
  trend: 'improving' | 'stable' | 'degrading';
  measurement_frequency: string;
}

export interface ArchitecturalIssue {
  issue_type: 'technical_debt' | 'performance_bottleneck' | 'security_vulnerability' | 'scalability_limit';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_components: string[];
  root_causes: string[];
  proposed_solutions: string[];
}

export interface ArchitecturalEvolution {
  change_date: Date;
  change_description: string;
  change_rationale: string;
  impact_assessment: string;
  success_metrics: string[];
  actual_outcomes: string[];
}

export interface DecisionOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  implementation_complexity: 'low' | 'medium' | 'high' | 'very_high';
  cost_estimate: CostEstimate;
  timeline_estimate: TimelineEstimate;
  risk_assessment: OptionRiskAssessment;
  assumptions: string[];
  dependencies: string[];
  success_probability: number; // 0-100%
  reversibility: 'easy' | 'moderate' | 'difficult' | 'irreversible';
  strategic_alignment: number; // 1-10 scale
  technical_feasibility: number; // 1-10 scale
  business_value: number; // 1-10 scale
  supporting_evidence: Evidence[];
}

export interface CostEstimate {
  development_cost: number;
  operational_cost: number;
  maintenance_cost: number;
  opportunity_cost: number;
  currency: string;
  confidence_level: number; // 0-100%
  cost_breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  category: string;
  amount: number;
  justification: string;
  uncertainty_range: { min: number; max: number };
}

export interface TimelineEstimate {
  estimated_duration: string;
  confidence_level: number; // 0-100%
  critical_path: string[];
  milestones: Milestone[];
  dependencies: string[];
  buffer_time: string;
  risk_factors: TimelineRisk[];
}

export interface Milestone {
  name: string;
  description: string;
  target_date: Date;
  deliverables: string[];
  success_criteria: string[];
  dependencies: string[];
}

export interface TimelineRisk {
  risk_description: string;
  probability: number; // 0-100%
  impact_on_timeline: string;
  mitigation_strategies: string[];
}

export interface OptionRiskAssessment {
  technical_risks: Risk[];
  business_risks: Risk[];
  operational_risks: Risk[];
  security_risks: Risk[];
  compliance_risks: Risk[];
  overall_risk_level: 'low' | 'medium' | 'high' | 'very_high';
  risk_mitigation_plan: string[];
}

export interface Risk {
  risk_id: string;
  description: string;
  probability: number; // 0-100%
  impact: number; // 0-100%
  risk_score: number; // probability * impact
  category: string;
  mitigation_strategies: string[];
  contingency_plans: string[];
  owner: string;
  monitoring_approach: string;
}

export interface Evidence {
  evidence_type: 'research' | 'prototype' | 'case_study' | 'expert_opinion' | 'data_analysis' | 'benchmarking';
  description: string;
  source: string;
  credibility: number; // 1-10 scale
  relevance: number; // 1-10 scale
  date: Date;
  key_findings: string[];
  limitations: string[];
}

export interface DecisionMaker {
  name: string;
  role: string;
  authority_level: string;
  expertise_areas: string[];
  decision_making_style: 'analytical' | 'intuitive' | 'consensus' | 'directive';
  bias_awareness: BiasAwareness[];
  previous_similar_decisions: string[];
}

export interface BiasAwareness {
  bias_type: string;
  description: string;
  mitigation_strategies: string[];
  monitoring_approach: string;
}

export interface StakeholderInput {
  stakeholder_id: string;
  name: string;
  role: string;
  influence_level: 'low' | 'medium' | 'high';
  interest_level: 'low' | 'medium' | 'high';
  position: 'supporter' | 'neutral' | 'opposer' | 'unknown';
  concerns: string[];
  requirements: string[];
  preferred_option?: string;
  rationale_for_preference: string;
  engagement_level: number; // 1-10 scale
  communication_preferences: string[];
}

export interface DecisionRationale {
  primary_drivers: RationalDriver[];
  secondary_considerations: string[];
  trade_offs_accepted: TradeOff[];
  alternatives_rejected: RejectedAlternative[];
  assumptions_made: string[];
  decision_logic: string;
  alignment_with_strategy: string;
  precedent_considerations: PrecedentConsideration[];
}

export interface RationalDriver {
  driver_type: 'business_value' | 'technical_necessity' | 'risk_mitigation' | 'strategic_alignment' | 'user_need' | 'compliance';
  description: string;
  weight: number; // 1-10 scale of importance
  supporting_evidence: string[];
  quantifiable_benefits: QuantifiableBenefit[];
}

export interface QuantifiableBenefit {
  benefit_type: string;
  metric: string;
  baseline_value: number;
  target_value: number;
  measurement_method: string;
  timeframe: string;
}

export interface TradeOff {
  aspect: string;
  what_was_given_up: string;
  what_was_gained: string;
  rationale: string;
  reversibility: boolean;
  impact_assessment: string;
}

export interface RejectedAlternative {
  alternative_name: string;
  rejection_reasons: string[];
  conditions_for_reconsideration: string[];
  lessons_for_future: string[];
}

export interface PrecedentConsideration {
  similar_decision: string;
  outcome: string;
  lessons_applied: string[];
  differences_in_context: string[];
}

export interface ImpactAssessment {
  business_impact: BusinessImpactAssessment;
  technical_impact: TechnicalImpactAssessment;
  organizational_impact: OrganizationalImpactAssessment;
  user_impact: UserImpactAssessment;
  financial_impact: FinancialImpactAssessment;
  timeline_impact: TimelineImpactAssessment;
  risk_impact: RiskImpactAssessment;
}

export interface BusinessImpactAssessment {
  revenue_impact: RevenueImpact;
  market_position_impact: string;
  customer_satisfaction_impact: string;
  operational_efficiency_impact: string;
  strategic_alignment_impact: string;
  competitive_advantage_impact: string;
  brand_impact: string;
}

export interface TechnicalImpactAssessment {
  performance_impact: PerformanceImpact;
  scalability_impact: ScalabilityImpact;
  maintainability_impact: MaintainabilityImpact;
  security_impact: SecurityImpact;
  reliability_impact: ReliabilityImpact;
  technology_debt_impact: TechnicalDebtImpact;
  innovation_impact: InnovationImpact;
}

export interface PerformanceImpact {
  response_time_impact: string;
  throughput_impact: string;
  resource_usage_impact: string;
  measurement_methods: string[];
  expected_improvements: string[];
  potential_degradations: string[];
}

export interface ScalabilityImpact {
  user_scalability: string;
  data_scalability: string;
  geographic_scalability: string;
  feature_scalability: string;
  scaling_bottlenecks: string[];
  scaling_opportunities: string[];
}

export interface MaintainabilityImpact {
  code_complexity_impact: string;
  documentation_impact: string;
  testing_impact: string;
  deployment_impact: string;
  monitoring_impact: string;
  long_term_maintenance_effort: string;
}

export interface SecurityImpact {
  attack_surface_changes: string;
  vulnerability_introduction: string[];
  security_controls_impact: string;
  compliance_impact: string;
  privacy_impact: string;
  audit_requirements_impact: string;
}

export interface ReliabilityImpact {
  availability_impact: string;
  fault_tolerance_impact: string;
  recovery_capabilities_impact: string;
  monitoring_capabilities_impact: string;
  incident_response_impact: string;
  sla_impact: string;
}

export interface TechnicalDebtImpact {
  debt_reduction: string[];
  new_debt_introduction: string[];
  debt_interest_impact: string;
  refactoring_opportunities: string[];
  technical_risk_changes: string;
}

export interface InnovationImpact {
  technology_advancement: string;
  learning_opportunities: string[];
  capability_building: string[];
  future_flexibility_impact: string;
  competitive_differentiation: string;
}

export interface OrganizationalImpactAssessment {
  team_structure_impact: string;
  skill_requirements_impact: SkillRequirementImpact[];
  process_changes: ProcessChange[];
  communication_impact: string;
  culture_impact: string;
  change_management_requirements: string[];
}

export interface SkillRequirementImpact {
  skill_area: string;
  current_capability: string;
  required_capability: string;
  gap_size: 'small' | 'medium' | 'large';
  development_approach: string[];
  timeline_to_proficiency: string;
  cost_of_development: string;
}

export interface ProcessChange {
  process_name: string;
  current_process: string;
  proposed_changes: string[];
  impact_level: 'low' | 'medium' | 'high';
  implementation_effort: string;
  training_requirements: string[];
  resistance_likelihood: string;
}

export interface UserImpactAssessment {
  user_experience_changes: UserExperienceChange[];
  workflow_impact: WorkflowImpact[];
  training_requirements: TrainingRequirement[];
  adoption_challenges: AdoptionChallenge[];
  user_satisfaction_impact: string;
  accessibility_impact: string;
}

export interface UserExperienceChange {
  user_type: string;
  current_experience: string;
  new_experience: string;
  improvement_areas: string[];
  potential_issues: string[];
  mitigation_strategies: string[];
}

export interface WorkflowImpact {
  workflow_name: string;
  current_steps: string[];
  new_steps: string[];
  efficiency_impact: string;
  learning_curve: string;
  error_reduction_potential: string;
}

export interface TrainingRequirement {
  audience: string;
  training_type: 'documentation' | 'hands_on' | 'video' | 'workshop' | 'mentoring';
  estimated_duration: string;
  delivery_method: string;
  success_metrics: string[];
  ongoing_support_needs: string;
}

export interface AdoptionChallenge {
  challenge_description: string;
  affected_users: string[];
  severity: 'low' | 'medium' | 'high';
  mitigation_strategies: string[];
  success_indicators: string[];
  timeline_for_resolution: string;
}

export interface FinancialImpactAssessment {
  capital_expenditure: CapitalExpenditure;
  operational_expenditure: OperationalExpenditure;
  revenue_impact: RevenueImpact;
  cost_savings: CostSaving[];
  roi_analysis: ROIAnalysis;
  budget_impact: BudgetImpact;
  financial_risks: FinancialRisk[];
}

export interface CapitalExpenditure {
  total_amount: number;
  breakdown: ExpenditureBreakdown[];
  timing: ExpenditureTiming[];
  funding_source: string;
  approval_requirements: string[];
  alternative_financing_options: string[];
}

export interface ExpenditureBreakdown {
  category: string;
  amount: number;
  justification: string;
  criticality: 'essential' | 'important' | 'nice_to_have';
  alternatives: string[];
}

export interface ExpenditureTiming {
  phase: string;
  amount: number;
  target_date: Date;
  dependencies: string[];
  flexibility: string;
}

export interface OperationalExpenditure {
  ongoing_costs: OngoingCost[];
  cost_changes: CostChange[];
  efficiency_improvements: EfficiencyImprovement[];
  resource_reallocation: ResourceReallocation[];
}

export interface OngoingCost {
  cost_category: string;
  monthly_amount: number;
  annual_amount: number;
  cost_drivers: string[];
  variability: 'fixed' | 'variable' | 'semi_variable';
  optimization_opportunities: string[];
}

export interface CostChange {
  category: string;
  current_cost: number;
  new_cost: number;
  change_amount: number;
  change_percentage: number;
  reason_for_change: string;
  timeline: string;
}

export interface EfficiencyImprovement {
  area: string;
  current_efficiency: string;
  improved_efficiency: string;
  quantified_benefit: number;
  measurement_method: string;
  realization_timeline: string;
}

export interface ResourceReallocation {
  resource_type: string;
  current_allocation: string;
  new_allocation: string;
  productivity_impact: string;
  cost_impact: number;
  change_management_needs: string;
}

export interface CostSaving {
  saving_category: string;
  annual_saving: number;
  one_time_saving?: number;
  realization_timeline: string;
  certainty_level: number; // 0-100%
  dependencies: string[];
  measurement_approach: string;
}

export interface ROIAnalysis {
  calculation_method: string;
  time_horizon: string;
  investment_amount: number;
  expected_returns: ExpectedReturn[];
  break_even_point: string;
  net_present_value: number;
  internal_rate_of_return: number;
  payback_period: string;
  sensitivity_analysis: SensitivityFactor[];
}

export interface ExpectedReturn {
  return_type: string;
  annual_value: number;
  confidence_level: number; // 0-100%
  value_realization_timeline: string;
  dependencies: string[];
}

export interface SensitivityFactor {
  factor: string;
  impact_on_roi: string;
  probability_of_occurrence: number; // 0-100%
  mitigation_strategies: string[];
}

export interface BudgetImpact {
  budget_category: string;
  current_budget: number;
  impact_amount: number;
  new_budget_requirement: number;
  funding_gap?: number;
  funding_solutions: string[];
  approval_process: string[];
}

export interface FinancialRisk {
  risk_description: string;
  potential_financial_impact: number;
  probability: number; // 0-100%
  risk_mitigation_cost: number;
  insurance_available: boolean;
  contingency_reserve_needed: number;
}

export interface TimelineImpactAssessment {
  project_timeline_impact: string;
  milestone_changes: MilestoneChange[];
  critical_path_impact: string;
  resource_timeline_impact: ResourceTimelineImpact[];
  dependency_timeline_changes: DependencyTimelineChange[];
  risk_to_deadlines: TimelineRisk[];
}

export interface MilestoneChange {
  milestone_name: string;
  original_date: Date;
  new_date: Date;
  change_reason: string;
  impact_on_downstream: string[];
  mitigation_options: string[];
}

export interface ResourceTimelineImpact {
  resource_type: string;
  original_timeline: string;
  new_timeline: string;
  availability_changes: string;
  cost_implications: string;
  alternative_resources: string[];
}

export interface DependencyTimelineChange {
  dependency_name: string;
  original_timeline: string;
  new_timeline: string;
  impact_on_decision: string;
  contingency_plans: string[];
}

export interface RiskImpactAssessment {
  new_risks_introduced: Risk[];
  existing_risks_mitigated: string[];
  risk_profile_changes: RiskProfileChange[];
  overall_risk_level_change: string;
  risk_appetite_alignment: string;
  contingency_planning_needs: string[];
}

export interface RiskProfileChange {
  risk_category: string;
  current_level: string;
  new_level: string;
  change_drivers: string[];
  monitoring_requirements: string[];
  escalation_triggers: string[];
}

export interface ImplementationPlan {
  phases: ImplementationPhase[];
  dependencies: ImplementationDependency[];
  resources_required: ResourceRequirement[];
  timeline: ImplementationTimeline;
  quality_gates: QualityGate[];
  communication_plan: CommunicationPlan;
  risk_mitigation_plan: RiskMitigationPlan;
  rollback_plan: RollbackPlan;
  success_metrics: ImplementationMetric[];
}

export interface ImplementationPhase {
  phase_id: string;
  phase_name: string;
  description: string;
  objectives: string[];
  deliverables: Deliverable[];
  entry_criteria: string[];
  exit_criteria: string[];
  duration: string;
  dependencies: string[];
  resources_required: string[];
  risks: string[];
  success_metrics: string[];
}

export interface Deliverable {
  deliverable_id: string;
  name: string;
  description: string;
  acceptance_criteria: string[];
  delivery_date: Date;
  responsible_party: string;
  dependencies: string[];
  quality_standards: string[];
}

export interface ImplementationDependency {
  dependency_id: string;
  dependency_type: 'technical' | 'business' | 'external' | 'regulatory' | 'resource';
  description: string;
  dependent_activities: string[];
  dependency_owner: string;
  expected_resolution: Date;
  contingency_plans: string[];
  monitoring_approach: string;
}

export interface ResourceRequirement {
  resource_type: 'human' | 'technical' | 'financial' | 'infrastructure';
  description: string;
  quantity_needed: number;
  duration: string;
  skills_required: string[];
  availability_constraints: string[];
  cost_estimate: number;
  alternatives: string[];
}

export interface ImplementationTimeline {
  start_date: Date;
  end_date: Date;
  major_milestones: Milestone[];
  critical_path: string[];
  buffer_time: string;
  review_points: ReviewPoint[];
  go_no_go_decisions: GoNoGoDecision[];
}

export interface ReviewPoint {
  review_date: Date;
  review_scope: string[];
  reviewers: string[];
  success_criteria: string[];
  escalation_criteria: string[];
  deliverables_reviewed: string[];
}

export interface GoNoGoDecision {
  decision_point: string;
  decision_date: Date;
  decision_criteria: string[];
  decision_makers: string[];
  go_consequences: string[];
  no_go_consequences: string[];
  data_required: string[];
}

export interface QualityGate {
  gate_id: string;
  gate_name: string;
  gate_criteria: GateCriterion[];
  measurement_methods: string[];
  responsible_party: string;
  escalation_process: string[];
  remediation_options: string[];
}

export interface GateCriterion {
  criterion: string;
  measurement: string;
  target_value: string;
  acceptable_range: string;
  criticality: 'must_pass' | 'should_pass' | 'nice_to_pass';
}

export interface CommunicationPlan {
  stakeholder_groups: StakeholderGroup[];
  communication_channels: CommunicationChannel[];
  communication_frequency: CommunicationFrequency[];
  key_messages: KeyMessage[];
  feedback_mechanisms: FeedbackMechanism[];
  escalation_protocols: EscalationProtocol[];
}

export interface StakeholderGroup {
  group_name: string;
  stakeholders: string[];
  communication_needs: string[];
  preferred_channels: string[];
  engagement_level: 'inform' | 'consult' | 'involve' | 'collaborate' | 'empower';
  key_concerns: string[];
}

export interface CommunicationChannel {
  channel_name: string;
  channel_type: 'email' | 'meeting' | 'dashboard' | 'report' | 'presentation' | 'workshop';
  audience: string[];
  frequency: string;
  content_type: string[];
  responsible_party: string;
}

export interface CommunicationFrequency {
  stakeholder_group: string;
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'ad_hoc';
  communication_type: string;
  timing_considerations: string[];
}

export interface KeyMessage {
  message_id: string;
  audience: string[];
  core_message: string;
  supporting_points: string[];
  anticipated_concerns: string[];
  response_strategies: string[];
  delivery_method: string[];
}

export interface FeedbackMechanism {
  mechanism_name: string;
  description: string;
  target_audience: string[];
  feedback_frequency: string;
  response_commitment: string;
  analysis_method: string;
  action_process: string;
}

export interface EscalationProtocol {
  trigger_conditions: string[];
  escalation_levels: EscalationLevel[];
  communication_requirements: string[];
  decision_authority: string[];
  timeline_expectations: string;
}

export interface EscalationLevel {
  level: number;
  stakeholders: string[];
  response_time: string;
  authority_scope: string[];
  escalation_criteria: string[];
}

export interface RiskMitigationPlan {
  identified_risks: IdentifiedRisk[];
  mitigation_strategies: MitigationStrategy[];
  contingency_plans: ContingencyPlan[];
  monitoring_approach: RiskMonitoring[];
  response_protocols: RiskResponseProtocol[];
}

export interface IdentifiedRisk {
  risk_id: string;
  risk_description: string;
  risk_category: string;
  probability: number; // 0-100%
  impact: number; // 0-100%
  risk_owner: string;
  mitigation_priority: 'low' | 'medium' | 'high' | 'critical';
  related_dependencies: string[];
}

export interface MitigationStrategy {
  risk_id: string;
  strategy_type: 'avoid' | 'reduce' | 'transfer' | 'accept';
  strategy_description: string;
  implementation_steps: string[];
  resource_requirements: string[];
  effectiveness_measure: string;
  cost_estimate: number;
  timeline: string;
}

export interface ContingencyPlan {
  risk_id: string;
  trigger_conditions: string[];
  response_actions: ResponseAction[];
  resource_requirements: string[];
  decision_makers: string[];
  communication_plan: string[];
  success_criteria: string[];
}

export interface ResponseAction {
  action_description: string;
  responsible_party: string;
  timeline: string;
  dependencies: string[];
  success_metrics: string[];
}

export interface RiskMonitoring {
  risk_id: string;
  monitoring_frequency: string;
  key_indicators: string[];
  monitoring_methods: string[];
  responsible_party: string;
  reporting_mechanism: string;
  escalation_triggers: string[];
}

export interface RiskResponseProtocol {
  response_type: 'immediate' | 'planned' | 'escalated';
  trigger_conditions: string[];
  response_team: string[];
  response_steps: string[];
  communication_requirements: string[];
  success_criteria: string[];
  lessons_capture_process: string;
}

export interface RollbackPlan {
  rollback_triggers: RollbackTrigger[];
  rollback_procedures: RollbackProcedure[];
  data_backup_strategy: DataBackupStrategy;
  system_restoration_steps: string[];
  stakeholder_communication: string[];
  business_continuity_measures: string[];
  lessons_learned_capture: string;
}

export interface RollbackTrigger {
  trigger_description: string;
  measurement_criteria: string[];
  decision_makers: string[];
  evaluation_timeline: string;
  escalation_process: string[];
}

export interface RollbackProcedure {
  procedure_name: string;
  steps: RollbackStep[];
  estimated_duration: string;
  resource_requirements: string[];
  dependencies: string[];
  validation_steps: string[];
}

export interface RollbackStep {
  step_number: number;
  description: string;
  responsible_party: string;
  estimated_time: string;
  dependencies: string[];
  validation_criteria: string[];
  rollback_risks: string[];
}

export interface DataBackupStrategy {
  backup_scope: string[];
  backup_frequency: string;
  backup_retention: string;
  restoration_procedures: string[];
  testing_schedule: string;
  responsible_parties: string[];
  validation_methods: string[];
}

export interface ImplementationMetric {
  metric_name: string;
  description: string;
  measurement_method: string;
  target_value: string;
  actual_value?: string;
  measurement_frequency: string;
  responsible_party: string;
  reporting_mechanism: string;
}

export interface SuccessCriterion {
  criterion_id: string;
  description: string;
  measurement_method: string;
  target_value: string;
  measurement_timing: 'immediate' | 'short_term' | 'long_term';
  responsible_party: string;
  validation_approach: string[];
  acceptance_threshold: string;
}

export interface Assumption {
  assumption_id: string;
  description: string;
  category: 'business' | 'technical' | 'organizational' | 'external';
  criticality: 'low' | 'medium' | 'high';
  validation_method: string;
  validation_timeline: string;
  impact_if_invalid: string;
  contingency_plans: string[];
  monitoring_approach: string;
}

export interface DecisionDependency {
  dependency_id: string;
  dependency_type: 'decision' | 'approval' | 'resource' | 'external_event' | 'technical_milestone';
  description: string;
  dependent_decision: string;
  dependency_owner: string;
  expected_resolution_date: Date;
  impact_if_delayed: string;
  alternatives: string[];
  escalation_path: string[];
}

export interface DecisionOutcome {
  outcome_id: string;
  measurement_date: Date;
  success_criteria_met: SuccessCriterionResult[];
  metrics_achieved: MetricResult[];
  unexpected_outcomes: UnexpectedOutcome[];
  stakeholder_satisfaction: StakeholderSatisfaction[];
  business_impact_realized: BusinessImpactRealized;
  technical_impact_realized: TechnicalImpactRealized;
  lessons_learned: LessonLearned[];
  recommendations_for_future: string[];
}

export interface SuccessCriterionResult {
  criterion_id: string;
  target_value: string;
  actual_value: string;
  achievement_status: 'exceeded' | 'met' | 'partially_met' | 'not_met';
  variance_explanation: string;
  contributing_factors: string[];
}

export interface MetricResult {
  metric_name: string;
  target_value: string;
  actual_value: string;
  measurement_method: string;
  variance_percentage: number;
  trend_analysis: string;
  improvement_opportunities: string[];
}

export interface UnexpectedOutcome {
  outcome_description: string;
  outcome_type: 'positive' | 'negative' | 'neutral';
  impact_assessment: string;
  root_cause_analysis: string[];
  response_actions_taken: string[];
  lessons_for_future: string[];
}

export interface StakeholderSatisfaction {
  stakeholder_name: string;
  role: string;
  satisfaction_score: number; // 1-10 scale
  specific_feedback: string[];
  concerns_raised: string[];
  suggestions_for_improvement: string[];
  engagement_effectiveness: number; // 1-10 scale
}

export interface BusinessImpactRealized {
  revenue_impact_achieved: RevenueImpactAchieved;
  operational_improvements: OperationalImprovement[];
  strategic_benefits: StrategyBenefit[];
  market_position_changes: string;
  customer_satisfaction_changes: CustomerSatisfactionChange[];
}

export interface RevenueImpactAchieved {
  projected_impact: number;
  actual_impact: number;
  variance: number;
  realization_timeline: string;
  contributing_factors: string[];
  measurement_challenges: string[];
}

export interface OperationalImprovement {
  improvement_area: string;
  baseline_metric: string;
  current_metric: string;
  improvement_percentage: number;
  sustainability_assessment: string;
  scaling_potential: string;
}

export interface StrategyBenefit {
  benefit_description: string;
  strategic_objective_alignment: string;
  measurable_impact: string;
  long_term_implications: string[];
  competitive_advantage_gained: string;
}

export interface CustomerSatisfactionChange {
  customer_segment: string;
  baseline_satisfaction: number;
  current_satisfaction: number;
  key_improvement_areas: string[];
  feedback_themes: string[];
  retention_impact: string;
}

export interface TechnicalImpactRealized {
  performance_improvements: PerformanceImprovementRealized[];
  scalability_enhancements: ScalabilityEnhancement[];
  maintainability_changes: MaintainabilityChange[];
  security_improvements: SecurityImprovementRealized[];
  technical_debt_impact: TechnicalDebtImpactRealized;
}

export interface PerformanceImprovementRealized {
  performance_metric: string;
  baseline_value: string;
  current_value: string;
  improvement_percentage: number;
  consistency_assessment: string;
  user_experience_impact: string;
}

export interface ScalabilityEnhancement {
  scalability_dimension: string;
  baseline_capacity: string;
  current_capacity: string;
  scaling_efficiency: string;
  bottleneck_resolution: string[];
  future_scaling_potential: string;
}

export interface MaintainabilityChange {
  maintainability_aspect: string;
  baseline_assessment: string;
  current_assessment: string;
  developer_productivity_impact: string;
  code_quality_metrics: CodeQualityMetric[];
  maintenance_cost_impact: string;
}

export interface CodeQualityMetric {
  metric_name: string;
  baseline_value: number;
  current_value: number;
  target_value: number;
  trend: 'improving' | 'stable' | 'degrading';
  improvement_actions: string[];
}

export interface SecurityImprovementRealized {
  security_aspect: string;
  baseline_assessment: string;
  current_assessment: string;
  vulnerabilities_addressed: string[];
  new_security_capabilities: string[];
  compliance_improvements: string[];
}

export interface TechnicalDebtImpactRealized {
  debt_reduction_achieved: string[];
  new_debt_incurred: string[];
  overall_debt_trend: 'reduced' | 'stable' | 'increased';
  maintenance_efficiency_impact: string;
  future_development_velocity_impact: string;
}

export interface LessonLearned {
  lesson_id: string;
  lesson_category: 'process' | 'technical' | 'communication' | 'planning' | 'risk_management' | 'stakeholder_management';
  lesson_description: string;
  context: string;
  what_worked_well: string[];
  what_could_be_improved: string[];
  root_cause_analysis: string[];
  recommendations_for_future: string[];
  applicable_situations: string[];
  knowledge_sharing_plan: string;
  verification_date: Date;
  lesson_owner: string;
}

export interface Attachment {
  attachment_id: string;
  name: string;
  type: 'document' | 'image' | 'spreadsheet' | 'presentation' | 'code' | 'data' | 'model' | 'prototype';
  description: string;
  file_path?: string;
  url?: string;
  size: number;
  created_date: Date;
  created_by: string;
  access_permissions: string[];
  version: string;
  tags: string[];
}

export interface ReviewRecord {
  review_id: string;
  review_date: Date;
  reviewer: string;
  review_type: 'peer_review' | 'expert_review' | 'stakeholder_review' | 'compliance_review' | 'post_implementation_review';
  review_scope: string[];
  findings: ReviewFinding[];
  recommendations: ReviewRecommendation[];
  approval_status: 'approved' | 'approved_with_conditions' | 'rejected' | 'needs_revision';
  follow_up_required: boolean;
  follow_up_actions: string[];
  next_review_date?: Date;
}

export interface ReviewFinding {
  finding_id: string;
  category: 'strength' | 'weakness' | 'risk' | 'opportunity' | 'compliance_gap';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
  impact_assessment: string;
  recommendation: string;
  priority: number;
}

export interface ReviewRecommendation {
  recommendation_id: string;
  description: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementation_effort: 'low' | 'medium' | 'high';
  expected_benefit: string;
  implementation_timeline: string;
  resource_requirements: string[];
  dependencies: string[];
  success_metrics: string[];
}

export interface DecisionMetrics {
  decision_quality_score: number; // 1-10 scale
  stakeholder_alignment_score: number; // 1-10 scale
  implementation_success_rate: number; // 0-100%
  time_to_decision: string;
  cost_of_decision_making: number;
  reversibility_exercised: boolean;
  unintended_consequences: UnintendedConsequence[];
  value_realization_timeline: string;
  decision_confidence_level: number; // 0-100%
  peer_review_scores: PeerReviewScore[];
}

export interface UnintendedConsequence {
  consequence_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_areas: string[];
  mitigation_actions: string[];
  prevention_for_future: string[];
}

export interface PeerReviewScore {
  reviewer: string;
  expertise_area: string;
  score: number; // 1-10 scale
  rationale: string;
  key_concerns: string[];
  suggestions_for_improvement: string[];
}

export interface DecisionQuery {
  query_type: 'similar_decisions' | 'impact_analysis' | 'stakeholder_analysis' | 'risk_assessment' | 'outcome_prediction';
  filters: DecisionFilter[];
  similarity_criteria?: SimilarityCriteria[];
  time_range?: TimeRange;
  include_outcomes?: boolean;
  include_lessons?: boolean;
  max_results?: number;
}

export interface DecisionFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range' | 'matches_pattern';
  value: any;
  weight?: number;
}

export interface SimilarityCriteria {
  aspect: 'context' | 'options' | 'stakeholders' | 'impact' | 'risks' | 'outcomes';
  weight: number; // 1-10 scale
  threshold: number; // 0-100%
}

export interface TimeRange {
  start_date: Date;
  end_date: Date;
}

export class DecisionTracker {
  private decisions: Map<string, DecisionRecord> = new Map();
  private readonly SIMILARITY_THRESHOLD = 0.7;

  public async recordDecision(decision: Omit<DecisionRecord, 'id' | 'timestamp'>): Promise<string> {
    const decisionId = this.generateId();
    const fullDecision: DecisionRecord = {
      ...decision,
      id: decisionId,
      timestamp: new Date()
    };

    this.decisions.set(decisionId, fullDecision);
    return decisionId;
  }

  public async updateDecisionStatus(decisionId: string, status: DecisionRecord['status']): Promise<void> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    decision.status = status;
    this.decisions.set(decisionId, decision);
  }

  public async addDecisionOutcome(decisionId: string, outcome: DecisionOutcome): Promise<void> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    decision.outcomes.push(outcome);
    this.decisions.set(decisionId, decision);
  }

  public async addLessonLearned(decisionId: string, lesson: LessonLearned): Promise<void> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    decision.lessons_learned.push(lesson);
    this.decisions.set(decisionId, decision);
  }

  public async addReviewRecord(decisionId: string, review: ReviewRecord): Promise<void> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    decision.review_history.push(review);
    this.decisions.set(decisionId, decision);
  }

  public async queryDecisions(query: DecisionQuery): Promise<DecisionRecord[]> {
    let results = Array.from(this.decisions.values());

    // Apply filters
    if (query.filters && query.filters.length > 0) {
      results = results.filter(decision => this.matchesFilters(decision, query.filters));
    }

    // Apply time range filter
    if (query.time_range) {
      results = results.filter(decision =>
        decision.timestamp >= query.time_range!.start_date &&
        decision.timestamp <= query.time_range!.end_date
      );
    }

    // Apply similarity matching for similar_decisions query
    if (query.query_type === 'similar_decisions' && query.similarity_criteria) {
      results = results.filter(decision => this.calculateSimilarity(decision, query.similarity_criteria!) >= this.SIMILARITY_THRESHOLD);
    }

    // Sort by relevance/timestamp
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    if (query.max_results) {
      results = results.slice(0, query.max_results);
    }

    // Filter included data based on query preferences
    return results.map(decision => this.filterDecisionData(decision, query));
  }

  public async getDecisionById(decisionId: string): Promise<DecisionRecord | null> {
    return this.decisions.get(decisionId) || null;
  }

  public async getDecisionHistory(): Promise<DecisionRecord[]> {
    return Array.from(this.decisions.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async analyzeDecisionPatterns(): Promise<DecisionPatternAnalysis> {
    const allDecisions = Array.from(this.decisions.values());

    return {
      total_decisions: allDecisions.length,
      decision_types: this.analyzeDecisionTypes(allDecisions),
      success_rates: this.analyzeSuccessRates(allDecisions),
      common_stakeholders: this.analyzeCommonStakeholders(allDecisions),
      frequent_risks: this.analyzeFrequentRisks(allDecisions),
      decision_patterns: this.identifyDecisionPatterns(allDecisions),
      improvement_opportunities: this.identifyImprovementOpportunities(allDecisions),
      learning_trends: this.analyzeLearningTrends(allDecisions)
    };
  }

  private matchesFilters(decision: DecisionRecord, filters: DecisionFilter[]): boolean {
    return filters.every(filter => this.evaluateFilter(decision, filter));
  }

  private evaluateFilter(decision: DecisionRecord, filter: DecisionFilter): boolean {
    const fieldValue = this.getFieldValue(decision, filter.field);

    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(filter.value.toLowerCase());
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > filter.value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < filter.value;
      case 'in_range':
        return typeof fieldValue === 'number' && fieldValue >= filter.value.min && fieldValue <= filter.value.max;
      case 'matches_pattern':
        return typeof fieldValue === 'string' && new RegExp(filter.value).test(fieldValue);
      default:
        return false;
    }
  }

  private getFieldValue(decision: DecisionRecord, field: string): any {
    const fields = field.split('.');
    let value: any = decision;

    for (const f of fields) {
      if (value && typeof value === 'object') {
        value = value[f];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private calculateSimilarity(decision: DecisionRecord, criteria: SimilarityCriteria[]): number {
    // Simplified similarity calculation - would be more sophisticated in real implementation
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const score = this.calculateAspectSimilarity(decision, criterion.aspect);
      totalScore += score * criterion.weight;
      totalWeight += criterion.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private calculateAspectSimilarity(decision: DecisionRecord, aspect: string): number {
    // Simplified aspect similarity - would use more sophisticated matching in real implementation
    return Math.random() * 100; // Placeholder
  }

  private filterDecisionData(decision: DecisionRecord, query: DecisionQuery): DecisionRecord {
    const filtered = { ...decision };

    if (!query.include_outcomes) {
      filtered.outcomes = [];
    }

    if (!query.include_lessons) {
      filtered.lessons_learned = [];
    }

    return filtered;
  }

  private analyzeDecisionTypes(decisions: DecisionRecord[]): { [type: string]: number } {
    const types: { [type: string]: number } = {};
    decisions.forEach(decision => {
      types[decision.decision_type] = (types[decision.decision_type] || 0) + 1;
    });
    return types;
  }

  private analyzeSuccessRates(decisions: DecisionRecord[]): { [status: string]: number } {
    const statuses: { [status: string]: number } = {};
    decisions.forEach(decision => {
      statuses[decision.status] = (statuses[decision.status] || 0) + 1;
    });
    return statuses;
  }

  private analyzeCommonStakeholders(decisions: DecisionRecord[]): { [stakeholder: string]: number } {
    const stakeholders: { [stakeholder: string]: number } = {};
    decisions.forEach(decision => {
      decision.stakeholders.forEach(sh => {
        stakeholders[sh.name] = (stakeholders[sh.name] || 0) + 1;
      });
    });
    return stakeholders;
  }

  private analyzeFrequentRisks(decisions: DecisionRecord[]): { [risk: string]: number } {
    const risks: { [risk: string]: number } = {};
    decisions.forEach(decision => {
      decision.risks.forEach(risk => {
        risks[risk.risk_description] = (risks[risk.risk_description] || 0) + 1;
      });
    });
    return risks;
  }

  private identifyDecisionPatterns(decisions: DecisionRecord[]): DecisionPattern[] {
    // Simplified pattern identification - would be more sophisticated in real implementation
    return [{
      pattern_name: 'Common Architecture Decision',
      pattern_description: 'Recurring architectural decisions with similar context',
      frequency: Math.floor(decisions.length * 0.3),
      success_rate: 85,
      common_characteristics: ['microservices', 'scalability', 'performance']
    }];
  }

  private identifyImprovementOpportunities(decisions: DecisionRecord[]): string[] {
    const opportunities: string[] = [];

    // Analyze common failure patterns
    const failedDecisions = decisions.filter(d => d.status === 'deprecated' || d.outcomes.some(o => o.unexpected_outcomes.some(uo => uo.outcome_type === 'negative')));

    if (failedDecisions.length > decisions.length * 0.2) {
      opportunities.push('High failure rate - consider improving decision-making process');
    }

    // Analyze stakeholder engagement
    const lowEngagement = decisions.filter(d => d.stakeholders.some(s => s.engagement_level < 5));
    if (lowEngagement.length > decisions.length * 0.3) {
      opportunities.push('Improve stakeholder engagement in decision-making process');
    }

    return opportunities;
  }

  private analyzeLearningTrends(decisions: DecisionRecord[]): LearningTrend[] {
    // Simplified learning trend analysis
    return [{
      trend_name: 'Decision Quality Improvement',
      trend_description: 'Decision quality scores improving over time',
      trend_direction: 'positive',
      confidence: 85,
      supporting_data: 'Quality scores increased 15% over last 6 months'
    }];
  }

  private generateId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async exportDecisions(format: 'json' | 'csv' | 'markdown'): Promise<string> {
    const decisions = Array.from(this.decisions.values());

    switch (format) {
      case 'json':
        return JSON.stringify(decisions, null, 2);
      case 'csv':
        return this.convertToCSV(decisions);
      case 'markdown':
        return this.convertToMarkdown(decisions);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(decisions: DecisionRecord[]): string {
    // Simplified CSV conversion - would be more comprehensive in real implementation
    const headers = ['ID', 'Title', 'Type', 'Status', 'Date', 'Decision Maker'];
    const rows = decisions.map(d => [
      d.id,
      d.title,
      d.decision_type,
      d.status,
      d.timestamp.toISOString(),
      d.decision_maker.name
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private convertToMarkdown(decisions: DecisionRecord[]): string {
    // Simplified Markdown conversion
    let markdown = '# Decision History\n\n';

    decisions.forEach(decision => {
      markdown += `## ${decision.title}\n\n`;
      markdown += `- **ID**: ${decision.id}\n`;
      markdown += `- **Type**: ${decision.decision_type}\n`;
      markdown += `- **Status**: ${decision.status}\n`;
      markdown += `- **Date**: ${decision.timestamp.toISOString()}\n`;
      markdown += `- **Decision Maker**: ${decision.decision_maker.name}\n\n`;
      markdown += `${decision.description}\n\n`;
      markdown += `**Rationale**: ${decision.rationale.decision_logic}\n\n`;
      markdown += '---\n\n';
    });

    return markdown;
  }
}

export interface DecisionPatternAnalysis {
  total_decisions: number;
  decision_types: { [type: string]: number };
  success_rates: { [status: string]: number };
  common_stakeholders: { [stakeholder: string]: number };
  frequent_risks: { [risk: string]: number };
  decision_patterns: DecisionPattern[];
  improvement_opportunities: string[];
  learning_trends: LearningTrend[];
}

export interface DecisionPattern {
  pattern_name: string;
  pattern_description: string;
  frequency: number;
  success_rate: number;
  common_characteristics: string[];
}

export interface LearningTrend {
  trend_name: string;
  trend_description: string;
  trend_direction: 'positive' | 'negative' | 'stable';
  confidence: number; // 0-100%
  supporting_data: string;
}