import { ProjectGraph, ComponentInfo, DependencyNode, DataFlow } from '../../types/core.js';

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: ChangeType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requester: string;
  targetComponents: string[];
  proposedChanges: ProposedChange[];
  businessJustification: string;
  timeline: string;
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface ProposedChange {
  componentId: string;
  changeType: 'add' | 'modify' | 'remove' | 'refactor';
  description: string;
  codeChanges: CodeChange[];
  configChanges: ConfigChange[];
  apiChanges: ApiChange[];
  schemaChanges: SchemaChange[];
}

export interface ChangeImpactAnalysis {
  changeId: string;
  timestamp: Date;
  overallRiskScore: number;
  impactScope: ImpactScope;
  affectedComponents: ComponentImpact[];
  dataFlowImpacts: DataFlowImpact[];
  businessImpacts: BusinessImpact[];
  technicalImpacts: TechnicalImpact[];
  riskAssessment: RiskAssessment;
  recommendations: ChangeRecommendation[];
  rollbackPlan: RollbackPlan;
  testingStrategy: TestingStrategy;
  deploymentStrategy: DeploymentStrategy;
}

export interface ImpactScope {
  directlyAffected: string[];
  indirectlyAffected: string[];
  downstreamServices: string[];
  upstreamServices: string[];
  crossCuttingConcerns: string[];
  externalDependencies: string[];
  databaseChanges: string[];
  configurationChanges: string[];
}

export interface ComponentImpact {
  componentId: string;
  componentName: string;
  impactLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  impactType: 'breaking' | 'non-breaking' | 'enhancement' | 'bug-fix';
  changeReason: string;
  estimatedEffort: number;
  riskFactors: RiskFactor[];
  dependencies: ComponentDependency[];
  testingRequirements: TestingRequirement[];
  rollbackComplexity: 'low' | 'medium' | 'high';
}

export interface DataFlowImpact {
  flowId: string;
  sourceComponent: string;
  targetComponent: string;
  impactType: 'structure' | 'format' | 'volume' | 'frequency' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigationStrategy: string;
  validationRequired: boolean;
  dataConversionNeeded: boolean;
}

export interface BusinessImpact {
  area: BusinessArea;
  impactType: 'positive' | 'negative' | 'neutral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedStakeholders: string[];
  financialImpact: FinancialImpact;
  userExperienceImpact: UserExperienceImpact;
  complianceImpact: ComplianceImpact;
  timeToValue: string;
}

export interface TechnicalImpact {
  category: TechnicalCategory;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigationRequired: boolean;
  mitigationStrategy: string;
  monitoringRequired: boolean;
  performanceImpact: PerformanceImpact;
  securityImpact: SecurityImpact;
  scalabilityImpact: ScalabilityImpact;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  contingencyPlans: ContingencyPlan[];
  riskMonitoring: RiskMonitoring;
}

export interface ChangeRecommendation {
  type: 'approve' | 'modify' | 'defer' | 'reject';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  prerequisites: string[];
  estimatedEffort: number;
  suggestedTimeline: string;
  resourceRequirements: ResourceRequirement[];
}

export interface RollbackPlan {
  complexity: 'low' | 'medium' | 'high' | 'impossible';
  estimatedTime: number;
  prerequisites: string[];
  steps: RollbackStep[];
  dataRecoveryRequired: boolean;
  configRestoreRequired: boolean;
  riskOfRollback: 'low' | 'medium' | 'high';
}

export interface TestingStrategy {
  testTypes: TestType[];
  testEnvironments: TestEnvironment[];
  testData: TestDataRequirement[];
  automationCoverage: number;
  regressionScope: string[];
  performanceTestingRequired: boolean;
  securityTestingRequired: boolean;
  userAcceptanceTestingRequired: boolean;
}

export interface DeploymentStrategy {
  type: 'blue-green' | 'canary' | 'rolling' | 'feature-flag' | 'maintenance-window';
  phases: DeploymentPhase[];
  rolloutStrategy: RolloutStrategy;
  monitoringPlan: MonitoringPlan;
  rollbackTriggers: RollbackTrigger[];
  communicationPlan: CommunicationPlan;
}

export type ChangeType =
  | 'feature-addition'
  | 'bug-fix'
  | 'refactoring'
  | 'performance-improvement'
  | 'security-enhancement'
  | 'dependency-update'
  | 'configuration-change'
  | 'schema-migration'
  | 'api-change'
  | 'infrastructure-change';

export type BusinessArea =
  | 'revenue'
  | 'customer-experience'
  | 'operations'
  | 'compliance'
  | 'security'
  | 'performance'
  | 'scalability'
  | 'maintainability';

export type TechnicalCategory =
  | 'performance'
  | 'scalability'
  | 'security'
  | 'reliability'
  | 'maintainability'
  | 'compatibility'
  | 'deployment'
  | 'monitoring';

interface CodeChange {
  file: string;
  type: 'add' | 'modify' | 'delete';
  linesChanged: number;
  complexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

interface ConfigChange {
  configFile: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  restartRequired: boolean;
  scope: 'local' | 'global';
}

interface ApiChange {
  endpoint: string;
  method: string;
  changeType: 'add' | 'modify' | 'remove' | 'deprecate';
  breakingChange: boolean;
  versionImpact: string;
}

interface SchemaChange {
  table: string;
  changeType: 'add' | 'modify' | 'remove';
  backwardCompatible: boolean;
  dataMigrationRequired: boolean;
  downtime: boolean;
}

interface RiskFactor {
  factor: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface ComponentDependency {
  dependentComponent: string;
  dependencyType: 'compile-time' | 'runtime' | 'data' | 'configuration';
  criticality: 'low' | 'medium' | 'high';
  breakingChangePotential: boolean;
}

interface TestingRequirement {
  testType: TestType;
  coverage: number;
  automationPossible: boolean;
  estimatedEffort: number;
}

interface FinancialImpact {
  developmentCost: number;
  operationalCost: number;
  opportunityCost: number;
  revenueImpact: number;
  riskCost: number;
}

interface UserExperienceImpact {
  affectedUserSegments: string[];
  experienceChange: 'improvement' | 'degradation' | 'neutral';
  usabilityImpact: 'low' | 'medium' | 'high';
  accessibilityImpact: 'low' | 'medium' | 'high';
}

interface ComplianceImpact {
  regulations: string[];
  impactType: 'positive' | 'negative' | 'neutral';
  auditRequired: boolean;
  documentationUpdated: boolean;
}

interface PerformanceImpact {
  responseTime: { current: number; projected: number };
  throughput: { current: number; projected: number };
  resourceUtilization: { cpu: number; memory: number; disk: number; network: number };
  loadCapacity: { current: number; projected: number };
}

interface SecurityImpact {
  threatModelChange: boolean;
  newVulnerabilities: string[];
  removedVulnerabilities: string[];
  attackSurfaceChange: 'increase' | 'decrease' | 'neutral';
  complianceImpact: string[];
}

interface ScalabilityImpact {
  horizontalScaling: 'improved' | 'degraded' | 'neutral';
  verticalScaling: 'improved' | 'degraded' | 'neutral';
  bottlenecks: string[];
  capacityLimits: string[];
}

interface MitigationStrategy {
  strategy: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: 'low' | 'medium' | 'high';
  timeline: string;
}

interface ContingencyPlan {
  scenario: string;
  probability: 'low' | 'medium' | 'high';
  actions: string[];
  resources: string[];
  timeline: string;
}

interface RiskMonitoring {
  metrics: MonitoringMetric[];
  alerts: AlertConfig[];
  dashboards: string[];
  reportingFrequency: string;
}

interface ResourceRequirement {
  type: 'human' | 'technical' | 'financial';
  description: string;
  quantity: number;
  duration: string;
  availability: 'available' | 'needs-allocation' | 'unavailable';
}

interface RollbackStep {
  step: number;
  description: string;
  estimatedTime: number;
  prerequisites: string[];
  risks: string[];
}

interface TestType {
  name: string;
  scope: string[];
  automation: boolean;
  effort: number;
  criticality: 'low' | 'medium' | 'high';
}

interface TestEnvironment {
  name: string;
  type: 'development' | 'staging' | 'production' | 'isolated';
  availability: boolean;
  dataRequirements: string[];
}

interface TestDataRequirement {
  dataset: string;
  size: string;
  anonymization: boolean;
  refreshRequired: boolean;
}

interface DeploymentPhase {
  phase: number;
  name: string;
  description: string;
  components: string[];
  duration: number;
  rollbackPoint: boolean;
}

interface RolloutStrategy {
  type: 'immediate' | 'gradual' | 'phased';
  percentage: number[];
  criteria: string[];
  duration: number;
}

interface MonitoringPlan {
  metrics: MonitoringMetric[];
  alerts: AlertConfig[];
  dashboards: string[];
  duration: number;
}

interface MonitoringMetric {
  name: string;
  threshold: number;
  unit: string;
  frequency: string;
}

interface AlertConfig {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  recipients: string[];
}

interface RollbackTrigger {
  condition: string;
  automatic: boolean;
  threshold: number;
  timeframe: number;
}

interface CommunicationPlan {
  stakeholders: string[];
  channels: string[];
  frequency: string;
  templates: string[];
}

export class ChangeImpactPredictor {
  private analysisHistory: Map<string, ChangeImpactAnalysis> = new Map();
  private componentRelationships: Map<string, string[]> = new Map();
  private businessRules: Map<string, (component: ComponentInfo) => boolean> = new Map();

  constructor() {
    this.initializeBusinessRules();
  }

  public async analyzeChangeImpact(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ChangeImpactAnalysis> {
    const analysis: ChangeImpactAnalysis = {
      changeId: changeRequest.id,
      timestamp: new Date(),
      overallRiskScore: 0,
      impactScope: await this.calculateImpactScope(changeRequest, graph),
      affectedComponents: await this.analyzeComponentImpacts(changeRequest, graph),
      dataFlowImpacts: await this.analyzeDataFlowImpacts(changeRequest, graph),
      businessImpacts: await this.analyzeBusinessImpacts(changeRequest, graph),
      technicalImpacts: await this.analyzeTechnicalImpacts(changeRequest, graph),
      riskAssessment: await this.assessRisks(changeRequest, graph),
      recommendations: await this.generateRecommendations(changeRequest, graph),
      rollbackPlan: await this.createRollbackPlan(changeRequest, graph),
      testingStrategy: await this.designTestingStrategy(changeRequest, graph),
      deploymentStrategy: await this.designDeploymentStrategy(changeRequest, graph)
    };

    analysis.overallRiskScore = this.calculateOverallRiskScore(analysis);
    this.analysisHistory.set(changeRequest.id, analysis);

    return analysis;
  }

  public async predictCascadingEffects(
    componentIds: string[],
    graph: ProjectGraph
  ): Promise<CascadingEffect[]> {
    const effects: CascadingEffect[] = [];

    for (const componentId of componentIds) {
      const cascade = await this.traceCascadingEffects(componentId, graph, new Set(), 0, 5);
      effects.push({
        originComponent: componentId,
        effectChain: cascade,
        totalImpactScore: this.calculateCascadeImpact(cascade),
        riskLevel: this.assessCascadeRisk(cascade)
      });
    }

    return effects;
  }

  public async simulateChange(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ChangeSimulation> {
    const beforeState = this.captureSystemState(graph);
    const afterState = await this.projectSystemState(changeRequest, graph);

    return {
      changeId: changeRequest.id,
      beforeState,
      afterState,
      differences: this.calculateStateDifferences(beforeState, afterState),
      performanceMetrics: await this.simulatePerformanceChanges(changeRequest, graph),
      scalabilityMetrics: await this.simulateScalabilityChanges(changeRequest, graph),
      reliabilityMetrics: await this.simulateReliabilityChanges(changeRequest, graph)
    };
  }

  public async generateImpactVisualization(
    analysis: ChangeImpactAnalysis,
    graph: ProjectGraph
  ): Promise<ImpactVisualization> {
    return {
      analysisId: analysis.changeId,
      impactGraph: await this.createImpactGraph(analysis, graph),
      heatMap: await this.createImpactHeatMap(analysis, graph),
      timeline: await this.createImpactTimeline(analysis),
      riskMatrix: await this.createRiskMatrix(analysis),
      dependencyChain: await this.createDependencyChain(analysis, graph)
    };
  }

  public async getHistoricalTrends(): Promise<HistoricalTrends> {
    const analyses = Array.from(this.analysisHistory.values());

    return {
      changeFrequency: this.analyzeChangeFrequency(analyses),
      riskTrends: this.analyzeRiskTrends(analyses),
      impactPatterns: this.analyzeImpactPatterns(analyses),
      successRates: this.analyzeSuccessRates(analyses),
      commonFailures: this.analyzeCommonFailures(analyses)
    };
  }

  private async calculateImpactScope(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ImpactScope> {
    const directlyAffected = changeRequest.targetComponents;
    const indirectlyAffected: string[] = [];
    const downstreamServices: string[] = [];
    const upstreamServices: string[] = [];
    const crossCuttingConcerns: string[] = [];
    const externalDependencies: string[] = [];
    const databaseChanges: string[] = [];
    const configurationChanges: string[] = [];

    for (const componentId of directlyAffected) {
      const component = graph.components[componentId];
      if (!component) continue;

      const dependencies = this.findComponentDependencies(componentId, graph);
      const dependents = this.findComponentDependents(componentId, graph);

      indirectlyAffected.push(...dependencies.filter(dep => !directlyAffected.includes(dep)));
      downstreamServices.push(...this.findDownstreamServices(componentId, graph));
      upstreamServices.push(...this.findUpstreamServices(componentId, graph));

      if (this.isCrossCuttingConcern(component)) {
        crossCuttingConcerns.push(componentId);
      }

      if (this.hasExternalDependencies(component)) {
        externalDependencies.push(...this.getExternalDependencies(component));
      }

      for (const change of changeRequest.proposedChanges) {
        if (change.schemaChanges?.length > 0) {
          databaseChanges.push(...change.schemaChanges.map(sc => sc.table));
        }
        if (change.configChanges?.length > 0) {
          configurationChanges.push(...change.configChanges.map(cc => cc.configFile));
        }
      }
    }

    return {
      directlyAffected,
      indirectlyAffected: [...new Set(indirectlyAffected)],
      downstreamServices: [...new Set(downstreamServices)],
      upstreamServices: [...new Set(upstreamServices)],
      crossCuttingConcerns: [...new Set(crossCuttingConcerns)],
      externalDependencies: [...new Set(externalDependencies)],
      databaseChanges: [...new Set(databaseChanges)],
      configurationChanges: [...new Set(configurationChanges)]
    };
  }

  private async analyzeComponentImpacts(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ComponentImpact[]> {
    const impacts: ComponentImpact[] = [];

    for (const change of changeRequest.proposedChanges) {
      const component = graph.components[change.componentId];
      if (!component) continue;

      const impact: ComponentImpact = {
        componentId: change.componentId,
        componentName: component.name,
        impactLevel: this.assessComponentImpactLevel(change, component),
        impactType: this.determineImpactType(change),
        changeReason: change.description,
        estimatedEffort: this.estimateEffort(change),
        riskFactors: await this.identifyRiskFactors(change, component, graph),
        dependencies: await this.analyzeDependencies(change.componentId, graph),
        testingRequirements: await this.determineTestingRequirements(change, component),
        rollbackComplexity: this.assessRollbackComplexity(change, component)
      };

      impacts.push(impact);
    }

    const indirectImpacts = await this.analyzeIndirectImpacts(changeRequest, graph);
    impacts.push(...indirectImpacts);

    return impacts;
  }

  private async analyzeDataFlowImpacts(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<DataFlowImpact[]> {
    const impacts: DataFlowImpact[] = [];

    if (!graph.dataFlows) return impacts;

    for (const change of changeRequest.proposedChanges) {
      const affectedFlows = graph.dataFlows.filter(flow =>
        flow.source === change.componentId || flow.target === change.componentId
      );

      for (const flow of affectedFlows) {
        const impact: DataFlowImpact = {
          flowId: flow.id || `${flow.source}->${flow.target}`,
          sourceComponent: flow.source,
          targetComponent: flow.target,
          impactType: this.determineDataFlowImpactType(change, flow),
          severity: this.assessDataFlowImpactSeverity(change, flow),
          description: `Data flow affected by ${change.changeType} in ${change.componentId}`,
          mitigationStrategy: this.suggestDataFlowMitigation(change, flow),
          validationRequired: this.requiresValidation(change, flow),
          dataConversionNeeded: this.requiresDataConversion(change, flow)
        };

        impacts.push(impact);
      }
    }

    return impacts;
  }

  private async analyzeBusinessImpacts(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<BusinessImpact[]> {
    const impacts: BusinessImpact[] = [];

    for (const change of changeRequest.proposedChanges) {
      const component = graph.components[change.componentId];
      if (!component) continue;

      for (const [area, ruleFunc] of this.businessRules) {
        if (ruleFunc(component)) {
          const impact: BusinessImpact = {
            area: area as BusinessArea,
            impactType: this.determineBusinessImpactType(change, area),
            severity: this.assessBusinessImpactSeverity(change, area),
            description: `${area} impact from ${change.changeType} in ${component.name}`,
            affectedStakeholders: this.identifyAffectedStakeholders(area, change),
            financialImpact: await this.calculateFinancialImpact(change, area),
            userExperienceImpact: await this.assessUserExperienceImpact(change, component),
            complianceImpact: await this.assessComplianceImpact(change, component),
            timeToValue: this.estimateTimeToValue(change, area)
          };

          impacts.push(impact);
        }
      }
    }

    return impacts;
  }

  private async analyzeTechnicalImpacts(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<TechnicalImpact[]> {
    const impacts: TechnicalImpact[] = [];

    for (const change of changeRequest.proposedChanges) {
      const component = graph.components[change.componentId];
      if (!component) continue;

      const technicalCategories: TechnicalCategory[] = [
        'performance',
        'scalability',
        'security',
        'reliability',
        'maintainability',
        'compatibility',
        'deployment',
        'monitoring'
      ];

      for (const category of technicalCategories) {
        const impact = await this.assessTechnicalImpact(change, component, category, graph);
        if (impact) {
          impacts.push(impact);
        }
      }
    }

    return impacts;
  }

  private async assessRisks(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];
    const mitigationStrategies: MitigationStrategy[] = [];
    const contingencyPlans: ContingencyPlan[] = [];

    for (const change of changeRequest.proposedChanges) {
      const component = graph.components[change.componentId];
      if (!component) continue;

      const changeRisks = await this.identifyChangeRisks(change, component, graph);
      riskFactors.push(...changeRisks);

      const mitigations = await this.developMitigationStrategies(changeRisks, change);
      mitigationStrategies.push(...mitigations);

      const contingencies = await this.createContingencyPlans(changeRisks, change);
      contingencyPlans.push(...contingencies);
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);
    const riskMonitoring = await this.setupRiskMonitoring(riskFactors, changeRequest);

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies,
      contingencyPlans,
      riskMonitoring
    };
  }

  private async generateRecommendations(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ChangeRecommendation[]> {
    const recommendations: ChangeRecommendation[] = [];

    const riskScore = await this.calculateChangeRiskScore(changeRequest, graph);
    const complexity = await this.assessChangeComplexity(changeRequest, graph);
    const businessValue = await this.assessBusinessValue(changeRequest, graph);

    if (riskScore > 8) {
      recommendations.push({
        type: 'modify',
        priority: 'high',
        title: 'Reduce Change Scope',
        description: 'Consider breaking this change into smaller, less risky increments',
        rationale: 'High risk score indicates significant potential for negative impact',
        prerequisites: ['Risk mitigation planning', 'Stakeholder approval'],
        estimatedEffort: complexity * 0.3,
        suggestedTimeline: 'Extended by 50%',
        resourceRequirements: [
          {
            type: 'human',
            description: 'Senior architect review',
            quantity: 1,
            duration: '1 week',
            availability: 'needs-allocation'
          }
        ]
      });
    }

    if (complexity > 7) {
      recommendations.push({
        type: 'modify',
        priority: 'medium',
        title: 'Implement Phased Rollout',
        description: 'Deploy changes in phases to reduce risk and enable early feedback',
        rationale: 'High complexity changes benefit from gradual deployment',
        prerequisites: ['Feature flag implementation', 'Monitoring setup'],
        estimatedEffort: complexity * 0.2,
        suggestedTimeline: 'Extended by 25%',
        resourceRequirements: [
          {
            type: 'technical',
            description: 'Feature flag infrastructure',
            quantity: 1,
            duration: 'Permanent',
            availability: 'needs-allocation'
          }
        ]
      });
    }

    if (businessValue < 5) {
      recommendations.push({
        type: 'defer',
        priority: 'low',
        title: 'Consider Business Value',
        description: 'Reevaluate the business justification for this change',
        rationale: 'Low business value may not justify the implementation cost and risk',
        prerequisites: ['Business case review', 'Alternative solution analysis'],
        estimatedEffort: 0,
        suggestedTimeline: 'Deferred pending review',
        resourceRequirements: []
      });
    }

    if (riskScore < 3 && complexity < 4 && businessValue > 8) {
      recommendations.push({
        type: 'approve',
        priority: 'high',
        title: 'Proceed with Change',
        description: 'This change is low risk, low complexity, and high value',
        rationale: 'Optimal characteristics for successful implementation',
        prerequisites: ['Standard testing', 'Code review'],
        estimatedEffort: complexity,
        suggestedTimeline: 'As proposed',
        resourceRequirements: []
      });
    }

    return recommendations;
  }

  private async createRollbackPlan(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<RollbackPlan> {
    const steps: RollbackStep[] = [];
    let complexity: 'low' | 'medium' | 'high' | 'impossible' = 'low';
    let estimatedTime = 0;
    let dataRecoveryRequired = false;
    let configRestoreRequired = false;

    for (const change of changeRequest.proposedChanges) {
      if (change.schemaChanges?.some(sc => !sc.backwardCompatible)) {
        complexity = 'high';
        dataRecoveryRequired = true;
        steps.push({
          step: steps.length + 1,
          description: `Restore database schema for ${change.componentId}`,
          estimatedTime: 60,
          prerequisites: ['Database backup verification', 'Maintenance window'],
          risks: ['Data loss', 'Downtime']
        });
        estimatedTime += 60;
      }

      if (change.apiChanges?.some(ac => ac.breakingChange)) {
        if (complexity === 'low') complexity = 'medium';
        steps.push({
          step: steps.length + 1,
          description: `Restore API version for ${change.componentId}`,
          estimatedTime: 30,
          prerequisites: ['API versioning support', 'Client compatibility check'],
          risks: ['Client disruption', 'Service degradation']
        });
        estimatedTime += 30;
      }

      if (change.configChanges?.length > 0) {
        configRestoreRequired = true;
        steps.push({
          step: steps.length + 1,
          description: `Restore configuration for ${change.componentId}`,
          estimatedTime: 15,
          prerequisites: ['Configuration backup', 'Service restart capability'],
          risks: ['Service restart', 'Configuration drift']
        });
        estimatedTime += 15;
      }

      steps.push({
        step: steps.length + 1,
        description: `Redeploy previous version of ${change.componentId}`,
        estimatedTime: 30,
        prerequisites: ['Previous version availability', 'Deployment pipeline'],
        risks: ['Service interruption', 'State inconsistency']
      });
      estimatedTime += 30;
    }

    const riskOfRollback = this.assessRollbackRisk(changeRequest, complexity, dataRecoveryRequired);

    return {
      complexity,
      estimatedTime,
      prerequisites: ['Rollback approval', 'Notification to stakeholders'],
      steps,
      dataRecoveryRequired,
      configRestoreRequired,
      riskOfRollback
    };
  }

  private async designTestingStrategy(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<TestingStrategy> {
    const testTypes: TestType[] = [];
    const testEnvironments: TestEnvironment[] = [];
    const testData: TestDataRequirement[] = [];
    let automationCoverage = 0;
    const regressionScope: string[] = [];

    const impactScope = await this.calculateImpactScope(changeRequest, graph);

    testTypes.push(
      {
        name: 'Unit Tests',
        scope: changeRequest.targetComponents,
        automation: true,
        effort: 20,
        criticality: 'high'
      },
      {
        name: 'Integration Tests',
        scope: impactScope.indirectlyAffected,
        automation: true,
        effort: 40,
        criticality: 'high'
      }
    );

    if (impactScope.databaseChanges.length > 0) {
      testTypes.push({
        name: 'Database Tests',
        scope: impactScope.databaseChanges,
        automation: true,
        effort: 30,
        criticality: 'high'
      });
    }

    if (impactScope.externalDependencies.length > 0) {
      testTypes.push({
        name: 'Contract Tests',
        scope: impactScope.externalDependencies,
        automation: true,
        effort: 25,
        criticality: 'medium'
      });
    }

    const hasUIChanges = changeRequest.proposedChanges.some(change =>
      change.componentId.toLowerCase().includes('ui') ||
      change.componentId.toLowerCase().includes('frontend')
    );

    if (hasUIChanges) {
      testTypes.push({
        name: 'UI Tests',
        scope: ['frontend'],
        automation: false,
        effort: 50,
        criticality: 'medium'
      });
    }

    testEnvironments.push(
      { name: 'Development', type: 'development', availability: true, dataRequirements: ['Mock data'] },
      { name: 'Staging', type: 'staging', availability: true, dataRequirements: ['Production-like data'] },
      { name: 'Pre-production', type: 'isolated', availability: true, dataRequirements: ['Sanitized production data'] }
    );

    automationCoverage = testTypes.filter(t => t.automation).reduce((sum, t) => sum + t.effort, 0) /
                        testTypes.reduce((sum, t) => sum + t.effort, 0) * 100;

    regressionScope.push(...impactScope.indirectlyAffected);

    return {
      testTypes,
      testEnvironments,
      testData,
      automationCoverage,
      regressionScope,
      performanceTestingRequired: changeRequest.type === 'performance-improvement',
      securityTestingRequired: changeRequest.type === 'security-enhancement',
      userAcceptanceTestingRequired: hasUIChanges
    };
  }

  private async designDeploymentStrategy(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<DeploymentStrategy> {
    const riskScore = await this.calculateChangeRiskScore(changeRequest, graph);
    const complexity = await this.assessChangeComplexity(changeRequest, graph);

    let strategyType: DeploymentStrategy['type'] = 'rolling';
    if (riskScore > 7 || complexity > 8) {
      strategyType = 'blue-green';
    } else if (riskScore > 5 || complexity > 6) {
      strategyType = 'canary';
    }

    const phases: DeploymentPhase[] = [];
    let phaseNumber = 1;

    if (strategyType === 'canary') {
      phases.push(
        {
          phase: phaseNumber++,
          name: 'Canary Deployment',
          description: 'Deploy to 5% of infrastructure',
          components: changeRequest.targetComponents,
          duration: 60,
          rollbackPoint: true
        },
        {
          phase: phaseNumber++,
          name: 'Extended Canary',
          description: 'Deploy to 25% of infrastructure',
          components: changeRequest.targetComponents,
          duration: 120,
          rollbackPoint: true
        },
        {
          phase: phaseNumber++,
          name: 'Full Deployment',
          description: 'Deploy to all infrastructure',
          components: changeRequest.targetComponents,
          duration: 180,
          rollbackPoint: false
        }
      );
    } else if (strategyType === 'blue-green') {
      phases.push(
        {
          phase: phaseNumber++,
          name: 'Green Environment Setup',
          description: 'Deploy to green environment',
          components: changeRequest.targetComponents,
          duration: 120,
          rollbackPoint: true
        },
        {
          phase: phaseNumber++,
          name: 'Traffic Switch',
          description: 'Switch traffic to green environment',
          components: ['load-balancer'],
          duration: 30,
          rollbackPoint: true
        }
      );
    } else {
      phases.push({
        phase: phaseNumber++,
        name: 'Rolling Deployment',
        description: 'Deploy to instances sequentially',
        components: changeRequest.targetComponents,
        duration: 90,
        rollbackPoint: true
      });
    }

    const monitoringMetrics: MonitoringMetric[] = [
      { name: 'Error Rate', threshold: 0.1, unit: 'percentage', frequency: '1 minute' },
      { name: 'Response Time', threshold: 500, unit: 'milliseconds', frequency: '1 minute' },
      { name: 'Throughput', threshold: 1000, unit: 'requests/minute', frequency: '1 minute' }
    ];

    const alerts: AlertConfig[] = [
      {
        name: 'High Error Rate',
        condition: 'error_rate > 1%',
        severity: 'critical',
        recipients: ['on-call', 'deployment-team']
      },
      {
        name: 'Slow Response Time',
        condition: 'response_time > 1000ms',
        severity: 'warning',
        recipients: ['deployment-team']
      }
    ];

    const rollbackTriggers: RollbackTrigger[] = [
      {
        condition: 'error_rate > 5%',
        automatic: true,
        threshold: 5,
        timeframe: 300
      },
      {
        condition: 'response_time > 2000ms',
        automatic: false,
        threshold: 2000,
        timeframe: 600
      }
    ];

    return {
      type: strategyType,
      phases,
      rolloutStrategy: {
        type: 'gradual',
        percentage: [5, 25, 100],
        criteria: ['Error rate < 0.5%', 'Response time < 200ms'],
        duration: phases.reduce((sum, p) => sum + p.duration, 0)
      },
      monitoringPlan: {
        metrics: monitoringMetrics,
        alerts,
        dashboards: ['deployment-dashboard', 'application-metrics'],
        duration: 1440
      },
      rollbackTriggers,
      communicationPlan: {
        stakeholders: ['development-team', 'operations-team', 'product-owners'],
        channels: ['slack', 'email', 'dashboard'],
        frequency: 'Per phase',
        templates: ['deployment-start', 'deployment-complete', 'rollback-notification']
      }
    };
  }

  private calculateOverallRiskScore(analysis: ChangeImpactAnalysis): number {
    const riskWeights = {
      riskAssessment: 0.3,
      componentImpacts: 0.25,
      businessImpacts: 0.2,
      technicalImpacts: 0.15,
      dataFlowImpacts: 0.1
    };

    let score = 0;

    score += this.convertRiskLevelToScore(analysis.riskAssessment.overallRisk) * riskWeights.riskAssessment;

    const avgComponentRisk = analysis.affectedComponents.reduce((sum, c) =>
      sum + this.convertImpactLevelToScore(c.impactLevel), 0) / analysis.affectedComponents.length;
    score += avgComponentRisk * riskWeights.componentImpacts;

    const avgBusinessRisk = analysis.businessImpacts.reduce((sum, b) =>
      sum + this.convertSeverityToScore(b.severity), 0) / Math.max(analysis.businessImpacts.length, 1);
    score += avgBusinessRisk * riskWeights.businessImpacts;

    const avgTechnicalRisk = analysis.technicalImpacts.reduce((sum, t) =>
      sum + this.convertSeverityToScore(t.severity), 0) / Math.max(analysis.technicalImpacts.length, 1);
    score += avgTechnicalRisk * riskWeights.technicalImpacts;

    const avgDataFlowRisk = analysis.dataFlowImpacts.reduce((sum, d) =>
      sum + this.convertSeverityToScore(d.severity), 0) / Math.max(analysis.dataFlowImpacts.length, 1);
    score += avgDataFlowRisk * riskWeights.dataFlowImpacts;

    return Math.min(10, Math.max(0, score));
  }

  private convertRiskLevelToScore(level: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (level) {
      case 'low': return 2;
      case 'medium': return 4;
      case 'high': return 7;
      case 'critical': return 10;
      default: return 0;
    }
  }

  private convertImpactLevelToScore(level: 'minimal' | 'low' | 'medium' | 'high' | 'critical'): number {
    switch (level) {
      case 'minimal': return 1;
      case 'low': return 2;
      case 'medium': return 5;
      case 'high': return 8;
      case 'critical': return 10;
      default: return 0;
    }
  }

  private convertSeverityToScore(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'low': return 2;
      case 'medium': return 4;
      case 'high': return 7;
      case 'critical': return 10;
      default: return 0;
    }
  }

  private async traceCascadingEffects(
    componentId: string,
    graph: ProjectGraph,
    visited: Set<string>,
    depth: number,
    maxDepth: number
  ): Promise<CascadeEffect[]> {
    if (depth >= maxDepth || visited.has(componentId)) {
      return [];
    }

    visited.add(componentId);
    const effects: CascadeEffect[] = [];

    const dependencies = this.findComponentDependents(componentId, graph);

    for (const depId of dependencies) {
      effects.push({
        componentId: depId,
        depth,
        impactType: this.determineCascadeImpactType(componentId, depId, graph),
        severity: this.assessCascadeSeverity(componentId, depId, graph),
        probability: this.estimateCascadeProbability(componentId, depId, graph)
      });

      const nestedEffects = await this.traceCascadingEffects(depId, graph, visited, depth + 1, maxDepth);
      effects.push(...nestedEffects);
    }

    visited.delete(componentId);
    return effects;
  }

  private findComponentDependencies(componentId: string, graph: ProjectGraph): string[] {
    return graph.dependencies.edges
      .filter(edge => edge.source === componentId)
      .map(edge => edge.target);
  }

  private findComponentDependents(componentId: string, graph: ProjectGraph): string[] {
    return graph.dependencies.edges
      .filter(edge => edge.target === componentId)
      .map(edge => edge.source);
  }

  private findDownstreamServices(componentId: string, graph: ProjectGraph): string[] {
    const downstream: string[] = [];
    const visited = new Set<string>();
    const queue = [componentId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependencies = this.findComponentDependencies(current, graph);
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          downstream.push(dep);
          queue.push(dep);
        }
      }
    }

    return downstream;
  }

  private findUpstreamServices(componentId: string, graph: ProjectGraph): string[] {
    const upstream: string[] = [];
    const visited = new Set<string>();
    const queue = [componentId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependents = this.findComponentDependents(current, graph);
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          upstream.push(dep);
          queue.push(dep);
        }
      }
    }

    return upstream;
  }

  private isCrossCuttingConcern(component: ComponentInfo): boolean {
    const crossCuttingKeywords = ['auth', 'log', 'cache', 'config', 'util', 'common'];
    return crossCuttingKeywords.some(keyword =>
      component.name.toLowerCase().includes(keyword)
    );
  }

  private hasExternalDependencies(component: ComponentInfo): boolean {
    return component.name.toLowerCase().includes('client') ||
           component.name.toLowerCase().includes('external') ||
           component.name.toLowerCase().includes('api');
  }

  private getExternalDependencies(component: ComponentInfo): string[] {
    return [`external-${component.name}`];
  }

  private initializeBusinessRules(): void {
    this.businessRules.set('revenue', (component) =>
      component.name.toLowerCase().includes('payment') ||
      component.name.toLowerCase().includes('billing') ||
      component.name.toLowerCase().includes('subscription')
    );

    this.businessRules.set('customer-experience', (component) =>
      component.name.toLowerCase().includes('ui') ||
      component.name.toLowerCase().includes('frontend') ||
      component.name.toLowerCase().includes('user')
    );

    this.businessRules.set('operations', (component) =>
      component.name.toLowerCase().includes('admin') ||
      component.name.toLowerCase().includes('management') ||
      component.name.toLowerCase().includes('monitoring')
    );

    this.businessRules.set('security', (component) =>
      component.name.toLowerCase().includes('auth') ||
      component.name.toLowerCase().includes('security') ||
      component.name.toLowerCase().includes('encryption')
    );
  }

  private assessComponentImpactLevel(
    change: ProposedChange,
    component: ComponentInfo
  ): 'minimal' | 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    if (change.changeType === 'remove') score += 4;
    else if (change.changeType === 'refactor') score += 3;
    else if (change.changeType === 'modify') score += 2;
    else if (change.changeType === 'add') score += 1;

    if (change.apiChanges?.some(api => api.breakingChange)) score += 3;
    if (change.schemaChanges?.some(schema => !schema.backwardCompatible)) score += 3;
    if (change.codeChanges?.some(code => code.complexity === 'high')) score += 2;

    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'minimal';
  }

  private determineImpactType(change: ProposedChange): 'breaking' | 'non-breaking' | 'enhancement' | 'bug-fix' {
    if (change.apiChanges?.some(api => api.breakingChange) ||
        change.schemaChanges?.some(schema => !schema.backwardCompatible)) {
      return 'breaking';
    }
    if (change.changeType === 'add') return 'enhancement';
    if (change.description.toLowerCase().includes('fix')) return 'bug-fix';
    return 'non-breaking';
  }

  private estimateEffort(change: ProposedChange): number {
    let effort = 0;

    effort += change.codeChanges?.reduce((sum, code) => {
      const complexity = code.complexity === 'high' ? 3 : code.complexity === 'medium' ? 2 : 1;
      return sum + (code.linesChanged / 100) * complexity;
    }, 0) || 0;

    effort += (change.apiChanges?.length || 0) * 2;
    effort += (change.schemaChanges?.length || 0) * 4;
    effort += (change.configChanges?.length || 0) * 1;

    return Math.max(1, Math.round(effort));
  }

  private async identifyRiskFactors(
    change: ProposedChange,
    component: ComponentInfo,
    graph: ProjectGraph
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (change.apiChanges?.some(api => api.breakingChange)) {
      factors.push({
        factor: 'Breaking API Changes',
        description: 'Changes may break existing clients',
        probability: 'high',
        impact: 'high',
        mitigation: 'API versioning and deprecation strategy'
      });
    }

    if (change.schemaChanges?.some(schema => schema.dataMigrationRequired)) {
      factors.push({
        factor: 'Data Migration Required',
        description: 'Database migration may cause downtime',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Online migration strategy and rollback plan'
      });
    }

    const dependentCount = this.findComponentDependents(component.id, graph).length;
    if (dependentCount > 5) {
      factors.push({
        factor: 'High Dependency Count',
        description: `${dependentCount} components depend on this component`,
        probability: 'low',
        impact: 'high',
        mitigation: 'Extensive testing and gradual rollout'
      });
    }

    return factors;
  }

  private async analyzeDependencies(componentId: string, graph: ProjectGraph): Promise<ComponentDependency[]> {
    const dependencies: ComponentDependency[] = [];

    const dependentIds = this.findComponentDependents(componentId, graph);

    for (const depId of dependentIds) {
      dependencies.push({
        dependentComponent: depId,
        dependencyType: 'runtime',
        criticality: 'medium',
        breakingChangePotential: true
      });
    }

    return dependencies;
  }

  private async determineTestingRequirements(
    change: ProposedChange,
    component: ComponentInfo
  ): Promise<TestingRequirement[]> {
    const requirements: TestingRequirement[] = [
      {
        testType: { name: 'Unit Tests', scope: [component.id], automation: true, effort: 10, criticality: 'high' },
        coverage: 80,
        automationPossible: true,
        estimatedEffort: 10
      }
    ];

    if (change.apiChanges?.length > 0) {
      requirements.push({
        testType: { name: 'API Tests', scope: [component.id], automation: true, effort: 15, criticality: 'high' },
        coverage: 90,
        automationPossible: true,
        estimatedEffort: 15
      });
    }

    if (change.schemaChanges?.length > 0) {
      requirements.push({
        testType: { name: 'Database Tests', scope: [component.id], automation: true, effort: 20, criticality: 'high' },
        coverage: 95,
        automationPossible: true,
        estimatedEffort: 20
      });
    }

    return requirements;
  }

  private assessRollbackComplexity(change: ProposedChange, component: ComponentInfo): 'low' | 'medium' | 'high' {
    if (change.schemaChanges?.some(schema => !schema.backwardCompatible)) return 'high';
    if (change.apiChanges?.some(api => api.breakingChange)) return 'medium';
    if (change.changeType === 'remove') return 'high';
    return 'low';
  }

  private async analyzeIndirectImpacts(
    changeRequest: ChangeRequest,
    graph: ProjectGraph
  ): Promise<ComponentImpact[]> {
    const indirectImpacts: ComponentImpact[] = [];
    const impactScope = await this.calculateImpactScope(changeRequest, graph);

    for (const componentId of impactScope.indirectlyAffected) {
      const component = graph.components[componentId];
      if (!component) continue;

      indirectImpacts.push({
        componentId,
        componentName: component.name,
        impactLevel: 'low',
        impactType: 'non-breaking',
        changeReason: 'Indirect dependency impact',
        estimatedEffort: 2,
        riskFactors: [],
        dependencies: [],
        testingRequirements: [{
          testType: { name: 'Integration Tests', scope: [componentId], automation: true, effort: 5, criticality: 'medium' },
          coverage: 70,
          automationPossible: true,
          estimatedEffort: 5
        }],
        rollbackComplexity: 'low'
      });
    }

    return indirectImpacts;
  }

  private determineDataFlowImpactType(change: ProposedChange, flow: DataFlow): 'structure' | 'format' | 'volume' | 'frequency' | 'security' {
    if (change.apiChanges?.length > 0) return 'structure';
    if (change.schemaChanges?.length > 0) return 'format';
    if (change.changeType === 'modify') return 'frequency';
    return 'structure';
  }

  private assessDataFlowImpactSeverity(change: ProposedChange, flow: DataFlow): 'low' | 'medium' | 'high' | 'critical' {
    if (change.apiChanges?.some(api => api.breakingChange)) return 'high';
    if (change.schemaChanges?.some(schema => !schema.backwardCompatible)) return 'critical';
    return 'medium';
  }

  private suggestDataFlowMitigation(change: ProposedChange, flow: DataFlow): string {
    if (change.apiChanges?.some(api => api.breakingChange)) {
      return 'Implement API versioning and provide migration path';
    }
    if (change.schemaChanges?.some(schema => !schema.backwardCompatible)) {
      return 'Implement data transformation layer and backward compatibility';
    }
    return 'Validate data flow integrity and implement monitoring';
  }

  private requiresValidation(change: ProposedChange, flow: DataFlow): boolean {
    return change.apiChanges?.length > 0 || change.schemaChanges?.length > 0;
  }

  private requiresDataConversion(change: ProposedChange, flow: DataFlow): boolean {
    return change.schemaChanges?.some(schema => schema.dataMigrationRequired) || false;
  }

  private determineBusinessImpactType(change: ProposedChange, area: string): 'positive' | 'negative' | 'neutral' {
    if (change.changeType === 'add') return 'positive';
    if (change.changeType === 'remove') return 'negative';
    return 'neutral';
  }

  private assessBusinessImpactSeverity(change: ProposedChange, area: string): 'low' | 'medium' | 'high' | 'critical' {
    if (area === 'revenue' && change.changeType === 'remove') return 'critical';
    if (area === 'customer-experience' && change.apiChanges?.some(api => api.breakingChange)) return 'high';
    return 'medium';
  }

  private identifyAffectedStakeholders(area: string, change: ProposedChange): string[] {
    const stakeholderMap: Record<string, string[]> = {
      'revenue': ['finance', 'sales', 'product'],
      'customer-experience': ['product', 'design', 'customer-support'],
      'operations': ['operations', 'devops', 'management'],
      'security': ['security', 'compliance', 'legal']
    };

    return stakeholderMap[area] || ['development'];
  }

  private async calculateFinancialImpact(change: ProposedChange, area: string): Promise<FinancialImpact> {
    const developmentCost = this.estimateEffort(change) * 1000;
    const operationalCost = area === 'operations' ? developmentCost * 0.5 : 0;
    const opportunityCost = change.changeType === 'add' ? developmentCost * 0.2 : 0;
    const revenueImpact = area === 'revenue' ? (change.changeType === 'add' ? 10000 : -5000) : 0;
    const riskCost = developmentCost * 0.1;

    return {
      developmentCost,
      operationalCost,
      opportunityCost,
      revenueImpact,
      riskCost
    };
  }

  private async assessUserExperienceImpact(change: ProposedChange, component: ComponentInfo): Promise<UserExperienceImpact> {
    const isUIComponent = component.name.toLowerCase().includes('ui') ||
                         component.name.toLowerCase().includes('frontend');

    return {
      affectedUserSegments: isUIComponent ? ['all-users'] : ['power-users'],
      experienceChange: change.changeType === 'add' ? 'improvement' : 'neutral',
      usabilityImpact: isUIComponent ? 'medium' : 'low',
      accessibilityImpact: isUIComponent ? 'medium' : 'low'
    };
  }

  private async assessComplianceImpact(change: ProposedChange, component: ComponentInfo): Promise<ComplianceImpact> {
    const regulations: string[] = [];

    if (component.name.toLowerCase().includes('auth') ||
        component.name.toLowerCase().includes('user')) {
      regulations.push('GDPR', 'CCPA');
    }

    if (component.name.toLowerCase().includes('payment') ||
        component.name.toLowerCase().includes('billing')) {
      regulations.push('PCI DSS');
    }

    return {
      regulations,
      impactType: change.changeType === 'add' ? 'positive' : 'neutral',
      auditRequired: regulations.length > 0,
      documentationUpdated: false
    };
  }

  private estimateTimeToValue(change: ProposedChange, area: string): string {
    const effort = this.estimateEffort(change);
    if (effort < 5) return '1 week';
    if (effort < 15) return '1 month';
    if (effort < 30) return '3 months';
    return '6 months';
  }

  private async assessTechnicalImpact(
    change: ProposedChange,
    component: ComponentInfo,
    category: TechnicalCategory,
    graph: ProjectGraph
  ): Promise<TechnicalImpact | null> {
    let impact: TechnicalImpact | null = null;

    switch (category) {
      case 'performance':
        impact = {
          category,
          description: 'Performance implications of the change',
          severity: change.changeType === 'refactor' ? 'medium' : 'low',
          mitigationRequired: change.changeType === 'refactor',
          mitigationStrategy: 'Performance testing and monitoring',
          monitoringRequired: true,
          performanceImpact: {
            responseTime: { current: 100, projected: change.changeType === 'refactor' ? 80 : 100 },
            throughput: { current: 1000, projected: change.changeType === 'add' ? 1200 : 1000 },
            resourceUtilization: { cpu: 0, memory: 0, disk: 0, network: 0 },
            loadCapacity: { current: 5000, projected: 5000 }
          },
          securityImpact: {
            threatModelChange: false,
            newVulnerabilities: [],
            removedVulnerabilities: [],
            attackSurfaceChange: 'neutral',
            complianceImpact: []
          },
          scalabilityImpact: {
            horizontalScaling: 'neutral',
            verticalScaling: 'neutral',
            bottlenecks: [],
            capacityLimits: []
          }
        };
        break;

      case 'security':
        if (change.apiChanges?.length > 0 || component.name.toLowerCase().includes('auth')) {
          impact = {
            category,
            description: 'Security implications of the change',
            severity: change.apiChanges?.some(api => api.breakingChange) ? 'high' : 'medium',
            mitigationRequired: true,
            mitigationStrategy: 'Security review and penetration testing',
            monitoringRequired: true,
            performanceImpact: {
              responseTime: { current: 100, projected: 100 },
              throughput: { current: 1000, projected: 1000 },
              resourceUtilization: { cpu: 0, memory: 0, disk: 0, network: 0 },
              loadCapacity: { current: 5000, projected: 5000 }
            },
            securityImpact: {
              threatModelChange: true,
              newVulnerabilities: [],
              removedVulnerabilities: [],
              attackSurfaceChange: change.changeType === 'add' ? 'increase' : 'neutral',
              complianceImpact: ['Security audit required']
            },
            scalabilityImpact: {
              horizontalScaling: 'neutral',
              verticalScaling: 'neutral',
              bottlenecks: [],
              capacityLimits: []
            }
          };
        }
        break;
    }

    return impact;
  }

  private async identifyChangeRisks(
    change: ProposedChange,
    component: ComponentInfo,
    graph: ProjectGraph
  ): Promise<RiskFactor[]> {
    return this.identifyRiskFactors(change, component, graph);
  }

  private async developMitigationStrategies(
    riskFactors: RiskFactor[],
    change: ProposedChange
  ): Promise<MitigationStrategy[]> {
    return riskFactors.map(risk => ({
      strategy: risk.factor,
      description: risk.mitigation,
      effort: 'medium',
      effectiveness: 'high',
      timeline: '1 week'
    }));
  }

  private async createContingencyPlans(
    riskFactors: RiskFactor[],
    change: ProposedChange
  ): Promise<ContingencyPlan[]> {
    return riskFactors
      .filter(risk => risk.impact === 'high')
      .map(risk => ({
        scenario: risk.description,
        probability: risk.probability,
        actions: ['Immediate rollback', 'Stakeholder notification', 'Root cause analysis'],
        resources: ['On-call engineer', 'Incident commander'],
        timeline: '1 hour'
      }));
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalRisks = riskFactors.filter(r => r.impact === 'high' && r.probability === 'high');
    const highRisks = riskFactors.filter(r => r.impact === 'high' || r.probability === 'high');

    if (criticalRisks.length > 0) return 'critical';
    if (highRisks.length > 2) return 'high';
    if (highRisks.length > 0) return 'medium';
    return 'low';
  }

  private async setupRiskMonitoring(
    riskFactors: RiskFactor[],
    changeRequest: ChangeRequest
  ): Promise<RiskMonitoring> {
    return {
      metrics: [
        { name: 'Error Rate', threshold: 1, unit: 'percentage', frequency: '1 minute' },
        { name: 'Response Time', threshold: 500, unit: 'milliseconds', frequency: '1 minute' }
      ],
      alerts: [
        {
          name: 'High Risk Detected',
          condition: 'error_rate > 5%',
          severity: 'critical',
          recipients: ['on-call', 'change-owner']
        }
      ],
      dashboards: ['change-impact-dashboard'],
      reportingFrequency: 'Daily during deployment'
    };
  }

  private async calculateChangeRiskScore(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<number> {
    let score = 0;

    for (const change of changeRequest.proposedChanges) {
      if (change.changeType === 'remove') score += 3;
      if (change.apiChanges?.some(api => api.breakingChange)) score += 3;
      if (change.schemaChanges?.some(schema => !schema.backwardCompatible)) score += 4;

      const dependentCount = this.findComponentDependents(change.componentId, graph).length;
      score += Math.min(3, dependentCount * 0.5);
    }

    return Math.min(10, score);
  }

  private async assessChangeComplexity(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<number> {
    let complexity = 0;

    for (const change of changeRequest.proposedChanges) {
      complexity += change.codeChanges?.reduce((sum, code) =>
        sum + (code.complexity === 'high' ? 3 : code.complexity === 'medium' ? 2 : 1), 0) || 0;
      complexity += (change.apiChanges?.length || 0) * 2;
      complexity += (change.schemaChanges?.length || 0) * 3;
    }

    return Math.min(10, complexity);
  }

  private async assessBusinessValue(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<number> {
    let value = 0;

    if (changeRequest.type === 'feature-addition') value += 3;
    if (changeRequest.type === 'performance-improvement') value += 2;
    if (changeRequest.type === 'security-enhancement') value += 3;
    if (changeRequest.priority === 'critical') value += 3;
    if (changeRequest.priority === 'high') value += 2;

    return Math.min(10, value);
  }

  private assessRollbackRisk(
    changeRequest: ChangeRequest,
    complexity: 'low' | 'medium' | 'high' | 'impossible',
    dataRecoveryRequired: boolean
  ): 'low' | 'medium' | 'high' {
    if (complexity === 'impossible') return 'high';
    if (dataRecoveryRequired) return 'high';
    if (complexity === 'high') return 'medium';
    return 'low';
  }

  private calculateCascadeImpact(cascade: CascadeEffect[]): number {
    return cascade.reduce((sum, effect) => {
      const severityScore = this.convertSeverityToScore(effect.severity);
      const probabilityMultiplier = effect.probability === 'high' ? 1 : effect.probability === 'medium' ? 0.7 : 0.4;
      return sum + (severityScore * probabilityMultiplier);
    }, 0);
  }

  private assessCascadeRisk(cascade: CascadeEffect[]): 'low' | 'medium' | 'high' | 'critical' {
    const totalImpact = this.calculateCascadeImpact(cascade);
    if (totalImpact > 20) return 'critical';
    if (totalImpact > 15) return 'high';
    if (totalImpact > 10) return 'medium';
    return 'low';
  }

  private determineCascadeImpactType(sourceId: string, targetId: string, graph: ProjectGraph): string {
    const edge = graph.dependencies.edges.find(e => e.source === sourceId && e.target === targetId);
    return edge?.type || 'dependency';
  }

  private assessCascadeSeverity(sourceId: string, targetId: string, graph: ProjectGraph): 'low' | 'medium' | 'high' | 'critical' {
    const targetDependentCount = this.findComponentDependents(targetId, graph).length;
    if (targetDependentCount > 10) return 'critical';
    if (targetDependentCount > 5) return 'high';
    if (targetDependentCount > 2) return 'medium';
    return 'low';
  }

  private estimateCascadeProbability(sourceId: string, targetId: string, graph: ProjectGraph): 'low' | 'medium' | 'high' {
    const edge = graph.dependencies.edges.find(e => e.source === sourceId && e.target === targetId);
    if (edge?.type === 'runtime') return 'high';
    if (edge?.type === 'compile-time') return 'medium';
    return 'low';
  }

  private captureSystemState(graph: ProjectGraph): SystemState {
    return {
      componentCount: Object.keys(graph.components).length,
      dependencyCount: graph.dependencies.edges.length,
      dataFlowCount: graph.dataFlows?.length || 0,
      complexityScore: this.calculateSystemComplexity(graph),
      couplingScore: this.calculateSystemCoupling(graph)
    };
  }

  private async projectSystemState(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<SystemState> {
    const currentState = this.captureSystemState(graph);

    let componentDelta = 0;
    let dependencyDelta = 0;

    for (const change of changeRequest.proposedChanges) {
      if (change.changeType === 'add') componentDelta += 1;
      if (change.changeType === 'remove') componentDelta -= 1;

      dependencyDelta += (change.apiChanges?.length || 0) * 2;
    }

    return {
      componentCount: currentState.componentCount + componentDelta,
      dependencyCount: currentState.dependencyCount + dependencyDelta,
      dataFlowCount: currentState.dataFlowCount,
      complexityScore: currentState.complexityScore + (componentDelta * 0.1),
      couplingScore: currentState.couplingScore + (dependencyDelta * 0.05)
    };
  }

  private calculateStateDifferences(before: SystemState, after: SystemState): StateDifference[] {
    return [
      {
        metric: 'Component Count',
        before: before.componentCount,
        after: after.componentCount,
        change: after.componentCount - before.componentCount,
        percentChange: ((after.componentCount - before.componentCount) / before.componentCount) * 100
      },
      {
        metric: 'Dependency Count',
        before: before.dependencyCount,
        after: after.dependencyCount,
        change: after.dependencyCount - before.dependencyCount,
        percentChange: ((after.dependencyCount - before.dependencyCount) / before.dependencyCount) * 100
      }
    ];
  }

  private async simulatePerformanceChanges(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<PerformanceMetrics> {
    return {
      responseTime: { current: 200, projected: 180, change: -20, unit: 'ms' },
      throughput: { current: 1000, projected: 1100, change: 100, unit: 'rps' },
      errorRate: { current: 0.1, projected: 0.05, change: -0.05, unit: '%' },
      resourceUtilization: {
        cpu: { current: 60, projected: 55, change: -5, unit: '%' },
        memory: { current: 70, projected: 75, change: 5, unit: '%' },
        disk: { current: 40, projected: 40, change: 0, unit: '%' },
        network: { current: 30, projected: 35, change: 5, unit: '%' }
      }
    };
  }

  private async simulateScalabilityChanges(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<ScalabilityMetrics> {
    return {
      maxUsers: { current: 10000, projected: 12000, change: 2000, unit: 'users' },
      maxThroughput: { current: 5000, projected: 6000, change: 1000, unit: 'rps' },
      scaleOutTime: { current: 300, projected: 240, change: -60, unit: 'seconds' },
      costPerUser: { current: 0.1, projected: 0.08, change: -0.02, unit: 'USD' }
    };
  }

  private async simulateReliabilityChanges(changeRequest: ChangeRequest, graph: ProjectGraph): Promise<ReliabilityMetrics> {
    return {
      uptime: { current: 99.9, projected: 99.95, change: 0.05, unit: '%' },
      mtbf: { current: 720, projected: 800, change: 80, unit: 'hours' },
      mttr: { current: 15, projected: 12, change: -3, unit: 'minutes' },
      errorBudget: { current: 0.1, projected: 0.05, change: -0.05, unit: '%' }
    };
  }

  private async createImpactGraph(analysis: ChangeImpactAnalysis, graph: ProjectGraph): Promise<ImpactGraph> {
    const nodes = analysis.affectedComponents.map(comp => ({
      id: comp.componentId,
      name: comp.componentName,
      impactLevel: comp.impactLevel,
      type: 'component'
    }));

    const edges = analysis.dataFlowImpacts.map(flow => ({
      source: flow.sourceComponent,
      target: flow.targetComponent,
      impact: flow.severity,
      type: 'dataflow'
    }));

    return { nodes, edges };
  }

  private async createImpactHeatMap(analysis: ChangeImpactAnalysis, graph: ProjectGraph): Promise<ImpactHeatMap> {
    const heatMapData: HeatMapCell[] = [];

    for (const comp of analysis.affectedComponents) {
      heatMapData.push({
        x: comp.componentId,
        y: 'Impact',
        value: this.convertImpactLevelToScore(comp.impactLevel),
        label: comp.componentName
      });
    }

    return { data: heatMapData };
  }

  private async createImpactTimeline(analysis: ChangeImpactAnalysis): Promise<ImpactTimeline> {
    const events: TimelineEvent[] = [
      {
        timestamp: new Date(),
        event: 'Change Analysis',
        description: 'Impact analysis completed',
        severity: 'low'
      },
      {
        timestamp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        event: 'Deployment Start',
        description: 'Change deployment begins',
        severity: 'medium'
      },
      {
        timestamp: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        event: 'Full Rollout',
        description: 'Change fully deployed',
        severity: 'high'
      }
    ];

    return { events };
  }

  private async createRiskMatrix(analysis: ChangeImpactAnalysis): Promise<RiskMatrix> {
    const matrix: RiskCell[] = analysis.riskAssessment.riskFactors.map(risk => ({
      factor: risk.factor,
      probability: risk.probability,
      impact: risk.impact,
      score: this.calculateRiskScore(risk.probability, risk.impact)
    }));

    return { cells: matrix };
  }

  private async createDependencyChain(analysis: ChangeImpactAnalysis, graph: ProjectGraph): Promise<DependencyChain> {
    const chains: ChainLink[] = [];

    for (const comp of analysis.affectedComponents) {
      const dependencies = this.findComponentDependencies(comp.componentId, graph);
      for (const dep of dependencies) {
        chains.push({
          from: comp.componentId,
          to: dep,
          type: 'dependency',
          strength: 'medium'
        });
      }
    }

    return { chains };
  }

  private calculateSystemComplexity(graph: ProjectGraph): number {
    const componentCount = Object.keys(graph.components).length;
    const dependencyCount = graph.dependencies.edges.length;
    return (componentCount + dependencyCount * 2) / 10;
  }

  private calculateSystemCoupling(graph: ProjectGraph): number {
    const componentCount = Object.keys(graph.components).length;
    const dependencyCount = graph.dependencies.edges.length;
    return componentCount > 0 ? dependencyCount / componentCount : 0;
  }

  private calculateRiskScore(probability: string, impact: string): number {
    const probScore = probability === 'high' ? 3 : probability === 'medium' ? 2 : 1;
    const impactScore = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
    return probScore * impactScore;
  }

  private analyzeChangeFrequency(analyses: ChangeImpactAnalysis[]): ChangeFrequencyTrend {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentChanges = analyses.filter(a => a.timestamp >= thirtyDaysAgo);

    return {
      changesPerMonth: recentChanges.length,
      averageRiskScore: recentChanges.reduce((sum, a) => sum + a.overallRiskScore, 0) / recentChanges.length || 0,
      trend: recentChanges.length > 10 ? 'increasing' : recentChanges.length < 5 ? 'decreasing' : 'stable'
    };
  }

  private analyzeRiskTrends(analyses: ChangeImpactAnalysis[]): RiskTrendAnalysis {
    const riskScores = analyses.map(a => a.overallRiskScore);
    const average = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length || 0;

    return {
      averageRisk: average,
      highRiskChanges: analyses.filter(a => a.overallRiskScore > 7).length,
      riskTrend: average > 5 ? 'increasing' : average < 3 ? 'decreasing' : 'stable'
    };
  }

  private analyzeImpactPatterns(analyses: ChangeImpactAnalysis[]): ImpactPatternAnalysis {
    const patterns: Record<string, number> = {};

    for (const analysis of analyses) {
      for (const comp of analysis.affectedComponents) {
        patterns[comp.impactType] = (patterns[comp.impactType] || 0) + 1;
      }
    }

    return {
      mostCommonImpact: Object.keys(patterns).reduce((a, b) => patterns[a] > patterns[b] ? a : b, 'non-breaking'),
      impactDistribution: patterns
    };
  }

  private analyzeSuccessRates(analyses: ChangeImpactAnalysis[]): SuccessRateAnalysis {
    const totalChanges = analyses.length;
    const lowRiskChanges = analyses.filter(a => a.overallRiskScore < 4).length;

    return {
      overallSuccessRate: totalChanges > 0 ? (lowRiskChanges / totalChanges) * 100 : 100,
      lowRiskSuccessRate: 95,
      highRiskSuccessRate: 75
    };
  }

  private analyzeCommonFailures(analyses: ChangeImpactAnalysis[]): CommonFailureAnalysis {
    const failurePatterns: Record<string, number> = {
      'Breaking API Changes': 0,
      'Database Migration Issues': 0,
      'Dependency Conflicts': 0,
      'Performance Degradation': 0
    };

    for (const analysis of analyses) {
      for (const risk of analysis.riskAssessment.riskFactors) {
        if (failurePatterns.hasOwnProperty(risk.factor)) {
          failurePatterns[risk.factor]++;
        }
      }
    }

    return {
      commonFailures: Object.entries(failurePatterns)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([failure, count]) => ({ failure, frequency: count }))
    };
  }
}

interface CascadingEffect {
  originComponent: string;
  effectChain: CascadeEffect[];
  totalImpactScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface CascadeEffect {
  componentId: string;
  depth: number;
  impactType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
}

interface ChangeSimulation {
  changeId: string;
  beforeState: SystemState;
  afterState: SystemState;
  differences: StateDifference[];
  performanceMetrics: PerformanceMetrics;
  scalabilityMetrics: ScalabilityMetrics;
  reliabilityMetrics: ReliabilityMetrics;
}

interface SystemState {
  componentCount: number;
  dependencyCount: number;
  dataFlowCount: number;
  complexityScore: number;
  couplingScore: number;
}

interface StateDifference {
  metric: string;
  before: number;
  after: number;
  change: number;
  percentChange: number;
}

interface PerformanceMetrics {
  responseTime: { current: number; projected: number; change: number; unit: string };
  throughput: { current: number; projected: number; change: number; unit: string };
  errorRate: { current: number; projected: number; change: number; unit: string };
  resourceUtilization: {
    cpu: { current: number; projected: number; change: number; unit: string };
    memory: { current: number; projected: number; change: number; unit: string };
    disk: { current: number; projected: number; change: number; unit: string };
    network: { current: number; projected: number; change: number; unit: string };
  };
}

interface ScalabilityMetrics {
  maxUsers: { current: number; projected: number; change: number; unit: string };
  maxThroughput: { current: number; projected: number; change: number; unit: string };
  scaleOutTime: { current: number; projected: number; change: number; unit: string };
  costPerUser: { current: number; projected: number; change: number; unit: string };
}

interface ReliabilityMetrics {
  uptime: { current: number; projected: number; change: number; unit: string };
  mtbf: { current: number; projected: number; change: number; unit: string };
  mttr: { current: number; projected: number; change: number; unit: string };
  errorBudget: { current: number; projected: number; change: number; unit: string };
}

interface ImpactVisualization {
  analysisId: string;
  impactGraph: ImpactGraph;
  heatMap: ImpactHeatMap;
  timeline: ImpactTimeline;
  riskMatrix: RiskMatrix;
  dependencyChain: DependencyChain;
}

interface ImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
}

interface ImpactNode {
  id: string;
  name: string;
  impactLevel: string;
  type: string;
}

interface ImpactEdge {
  source: string;
  target: string;
  impact: string;
  type: string;
}

interface ImpactHeatMap {
  data: HeatMapCell[];
}

interface HeatMapCell {
  x: string;
  y: string;
  value: number;
  label: string;
}

interface ImpactTimeline {
  events: TimelineEvent[];
}

interface TimelineEvent {
  timestamp: Date;
  event: string;
  description: string;
  severity: string;
}

interface RiskMatrix {
  cells: RiskCell[];
}

interface RiskCell {
  factor: string;
  probability: string;
  impact: string;
  score: number;
}

interface DependencyChain {
  chains: ChainLink[];
}

interface ChainLink {
  from: string;
  to: string;
  type: string;
  strength: string;
}

interface HistoricalTrends {
  changeFrequency: ChangeFrequencyTrend;
  riskTrends: RiskTrendAnalysis;
  impactPatterns: ImpactPatternAnalysis;
  successRates: SuccessRateAnalysis;
  commonFailures: CommonFailureAnalysis;
}

interface ChangeFrequencyTrend {
  changesPerMonth: number;
  averageRiskScore: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface RiskTrendAnalysis {
  averageRisk: number;
  highRiskChanges: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
}

interface ImpactPatternAnalysis {
  mostCommonImpact: string;
  impactDistribution: Record<string, number>;
}

interface SuccessRateAnalysis {
  overallSuccessRate: number;
  lowRiskSuccessRate: number;
  highRiskSuccessRate: number;
}

interface CommonFailureAnalysis {
  commonFailures: Array<{
    failure: string;
    frequency: number;
  }>;
}