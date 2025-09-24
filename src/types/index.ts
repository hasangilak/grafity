export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  content: string;
  size: number;
  lastModified: Date;
}

export interface ImportDeclaration {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isNamespace: boolean;
  location: SourceLocation;
}

export interface ExportDeclaration {
  name?: string;
  source?: string;
  isDefault: boolean;
  isNamespace: boolean;
  location: SourceLocation;
}

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ComponentInfo {
  name: string;
  filePath: string;
  type: 'function' | 'class' | 'arrow';
  props: PropInfo[];
  hooks: HookInfo[];
  children: ComponentInfo[];
  parent?: ComponentInfo;
  location: SourceLocation;
}

export interface PropInfo {
  name: string;
  type: string;
  isRequired: boolean;
  defaultValue?: string;
  description?: string;
}

export interface HookInfo {
  name: string;
  type: 'useState' | 'useEffect' | 'useContext' | 'custom' | 'other';
  dependencies?: string[];
  location: SourceLocation;
}

export interface FunctionInfo {
  name: string;
  filePath: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  calls: FunctionCall[];
  location: SourceLocation;
}

export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface FunctionCall {
  name: string;
  arguments: string[];
  location: SourceLocation;
}

export interface DataFlow {
  from: string;
  to: string;
  type: 'props' | 'state' | 'context' | 'function_call' | 'import';
  data?: any;
  location: SourceLocation;
}

export interface UserJourney {
  id: string;
  name: string;
  steps: UserStep[];
  components: string[];
  routes: string[];
}

export interface UserStep {
  id: string;
  type: 'click' | 'input' | 'navigation' | 'form_submit' | 'api_call';
  component: string;
  description: string;
  triggers: string[];
}

export interface ProjectGraph {
  files: FileInfo[];
  components: ComponentInfo[];
  functions: FunctionInfo[];
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  dataFlows: DataFlow[];
  userJourneys: UserJourney[];
  dependencies: DependencyGraph;
  // AI Enhancement: Semantic annotations and business context
  semanticData?: SemanticData;
  businessContext?: BusinessContext;
  aiMetrics?: AIMetrics;
}

// AI Enhancement: Semantic data for AI consumption
export interface SemanticData {
  architecturalPatterns: ArchitecturalPattern[];
  antiPatterns: AntiPattern[];
  businessDomains: BusinessDomain[];
  complexityMetrics: ComplexityMetrics;
  qualityIndicators: QualityIndicators;
}

export interface ArchitecturalPattern {
  type: 'MVC' | 'Observer' | 'Factory' | 'Singleton' | 'Strategy' | 'Decorator' | 'Command' | 'Custom';
  name: string;
  description: string;
  components: string[];
  confidence: number; // 0-1
  location: SourceLocation;
  benefits: string[];
  considerations: string[];
}

export interface AntiPattern {
  type: 'GodObject' | 'CircularDependency' | 'DeadCode' | 'DuplicatedCode' | 'LongParameterList' | 'Custom';
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  location: SourceLocation;
  suggestedFix?: string;
}

export interface BusinessDomain {
  name: string;
  description: string;
  components: string[];
  businessCapabilities: string[];
  dataEntities: string[];
  workflows: string[];
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: TechnicalDebt;
  coupling: CouplingMetrics;
  cohesion: CohesionMetrics;
}

export interface TechnicalDebt {
  totalMinutes: number;
  issues: DebtIssue[];
  trends: DebtTrend[];
}

export interface DebtIssue {
  type: 'maintainability' | 'reliability' | 'security' | 'performance';
  severity: 'minor' | 'major' | 'critical';
  effort: number; // minutes
  component: string;
  description: string;
}

export interface DebtTrend {
  date: Date;
  totalDebt: number;
  newDebt: number;
  resolvedDebt: number;
}

export interface CouplingMetrics {
  afferentCoupling: number; // Incoming dependencies
  efferentCoupling: number; // Outgoing dependencies
  instability: number; // 0-1, 0 = stable, 1 = unstable
}

export interface CohesionMetrics {
  lackOfCohesion: number;
  cohesionRatio: number;
}

export interface QualityIndicators {
  maintainability: number; // 0-100
  reliability: number; // 0-100
  security: number; // 0-100
  testCoverage?: number; // 0-100
  documentation: number; // 0-100
}

// AI Enhancement: Business context mapping
export interface BusinessContext {
  userPersonas: UserPersona[];
  businessProcesses: BusinessProcess[];
  dataModels: DataModel[];
  complianceRequirements: ComplianceRequirement[];
  performanceRequirements: PerformanceRequirement[];
}

export interface UserPersona {
  id: string;
  name: string;
  role: string;
  goals: string[];
  painPoints: string[];
  journeys: string[]; // References to UserJourney IDs
  components: string[]; // Components this persona interacts with
}

export interface BusinessProcess {
  id: string;
  name: string;
  description: string;
  steps: ProcessStep[];
  components: string[];
  dataFlows: string[];
  businessValue: number; // 1-10
  frequency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProcessStep {
  id: string;
  name: string;
  description: string;
  actor: string; // User persona or system
  action: string;
  component?: string;
  dataInputs: string[];
  dataOutputs: string[];
}

export interface DataModel {
  name: string;
  description: string;
  entities: DataEntity[];
  relationships: DataRelationship[];
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface DataEntity {
  name: string;
  attributes: DataAttribute[];
  businessRules: string[];
  components: string[]; // Components that work with this entity
}

export interface DataAttribute {
  name: string;
  type: string;
  required: boolean;
  sensitive: boolean;
  businessDescription?: string;
}

export interface DataRelationship {
  from: string;
  to: string;
  type: 'oneToOne' | 'oneToMany' | 'manyToMany';
  description: string;
}

export interface ComplianceRequirement {
  standard: 'GDPR' | 'SOX' | 'HIPAA' | 'PCI-DSS' | 'ISO27001' | 'Custom';
  name: string;
  description: string;
  affectedComponents: string[];
  controls: ComplianceControl[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceControl {
  id: string;
  description: string;
  implemented: boolean;
  evidenceComponents: string[];
  lastReviewed?: Date;
}

export interface PerformanceRequirement {
  name: string;
  type: 'latency' | 'throughput' | 'availability' | 'scalability';
  target: string;
  component: string;
  businessJustification: string;
  currentStatus: 'met' | 'not_met' | 'unknown';
  metrics?: PerformanceMetric[];
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: number;
}

// AI Enhancement: Machine learning features and metadata
export interface AIMetrics {
  nodeEmbeddings?: number[][]; // Pre-computed embeddings for components
  adjacencyMatrix?: number[][]; // Graph adjacency for ML models
  featureVectors?: FeatureVector[];
  similarityMatrix?: number[][]; // Component similarity scores
  clusteringData?: ClusteringResult[];
  changePatterns?: ChangePattern[];
  usagePatterns?: UsagePattern[];
}

export interface FeatureVector {
  componentId: string;
  features: {
    complexity: number;
    coupling: number;
    cohesion: number;
    changeFrequency: number;
    businessValue: number;
    testCoverage: number;
    documentationScore: number;
    [key: string]: number; // Additional custom features
  };
}

export interface ClusteringResult {
  algorithm: string;
  clusters: ComponentCluster[];
  silhouetteScore?: number;
}

export interface ComponentCluster {
  id: string;
  components: string[];
  centroid?: number[];
  businessTheme?: string;
  architecturalTheme?: string;
}

export interface ChangePattern {
  components: string[];
  frequency: number;
  lastOccurrence: Date;
  changeType: 'feature' | 'bugfix' | 'refactor' | 'performance';
  businessReason?: string;
}

export interface UsagePattern {
  userPersona: string;
  componentSequence: string[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  businessOutcome: string;
}

// AI Enhancement: Visual changes and AI responses for bidirectional sync
export interface VisualChange {
  id: string;
  timestamp: Date;
  user: string;
  type: 'drag' | 'connect' | 'delete' | 'modify' | 'create';
  sourceComponent: string;
  targetComponent?: string;
  properties?: Record<string, any>;
  businessIntent?: string;
  codeGenerationHint?: GenerationHint;
}

export interface GenerationHint {
  framework?: 'react' | 'vue' | 'angular' | 'vanilla';
  pattern?: string;
  style?: 'functional' | 'class' | 'hooks';
  dependencies?: string[];
  businessLogic?: string;
}

export interface AIResponse {
  id: string;
  timestamp: Date;
  trigger: 'visual_change' | 'code_change' | 'suggestion_request';
  codeChanges: CodeModification[];
  architecturalImpact: ImpactAnalysis;
  suggestions: AISuggestion[];
  confidence: number; // 0-1
  learningFeedback?: LearningData;
}

export interface CodeModification {
  file: string;
  type: 'create' | 'modify' | 'delete';
  changes: FileChange[];
  reasoning: string;
  businessJustification?: string;
}

export interface FileChange {
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  changeType: 'add' | 'remove' | 'modify';
}

export interface ImpactAnalysis {
  affectedComponents: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  testingRequired: string[];
  deploymentConsiderations: string[];
  businessImpact: string;
  performanceImpact?: 'positive' | 'negative' | 'neutral';
}

export interface AISuggestion {
  id: string;
  type: 'refactor' | 'optimize' | 'security' | 'pattern' | 'business';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  reasoning: string;
  implementation: string;
  businessValue?: string;
  effort: 'small' | 'medium' | 'large' | 'epic';
  components: string[];
  codeExample?: string;
}

export interface LearningData {
  userFeedback: 'accepted' | 'rejected' | 'modified';
  modifications?: string;
  reasoning?: string;
  businessContext?: string;
  patterns?: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  label: string;
  type: 'file' | 'component' | 'function' | 'hook';
  filePath: string;
  metadata: Record<string, any>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'renders' | 'passes_props';
  weight: number;
  metadata: Record<string, any>;
}

export interface AnalysisOptions {
  includeNodeModules: boolean;
  maxDepth: number;
  followSymlinks: boolean;
  includeTests: boolean;
  patterns: {
    include: string[];
    exclude: string[];
  };
}

export interface VisualizationConfig {
  layout: 'hierarchical' | 'force' | 'circular' | 'dagre';
  showLabels: boolean;
  showTypes: boolean;
  colorScheme: string;
  clustering: boolean;
  exportFormat: 'svg' | 'png' | 'json' | 'dot';
}