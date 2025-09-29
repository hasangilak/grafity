import { gql } from 'apollo-server-express';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

// Base scalar types
const baseTypeDefs = gql`
  scalar Date
  scalar JSON
  scalar Upload

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Subscription {
    _empty: String
  }

  # Common types
  interface Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input SortInput {
    field: String!
    direction: SortDirection!
  }

  enum SortDirection {
    ASC
    DESC
  }

  type Error {
    message: String!
    code: String
    path: [String!]
  }

  type OperationResult {
    success: Boolean!
    message: String
    errors: [Error!]
  }
`;

// Analysis types
const analysisTypeDefs = gql`
  extend type Query {
    # Project analysis
    analyzeProject(projectPath: String!): ProjectAnalysis
    getProjectGraph(projectId: ID!): ProjectGraph
    getComponentTree(projectId: ID!): ComponentTree

    # Search and discovery
    searchComponents(query: String!, filters: ComponentFilters): ComponentSearchResult!
    findPatterns(projectId: ID!, patternTypes: [PatternType!]): [Pattern!]!

    # Metrics and insights
    getProjectMetrics(projectId: ID!): ProjectMetrics
    getCodeComplexity(projectId: ID!): ComplexityAnalysis
    getDependencyInsights(projectId: ID!): DependencyInsights
  }

  extend type Mutation {
    # Project management
    createProject(input: CreateProjectInput!): ProjectResult!
    updateProject(id: ID!, input: UpdateProjectInput!): ProjectResult!
    deleteProject(id: ID!): OperationResult!

    # Analysis operations
    triggerAnalysis(projectId: ID!, options: AnalysisOptions): AnalysisResult!
    generateDocumentation(projectId: ID!, options: DocumentationOptions): DocumentationResult!

    # Pattern management
    savePattern(input: SavePatternInput!): PatternResult!
    removePattern(id: ID!): OperationResult!
  }

  extend type Subscription {
    # Real-time analysis updates
    analysisProgress(projectId: ID!): AnalysisProgress!
    projectUpdated(projectId: ID!): ProjectUpdate!
    patternDetected(projectId: ID!): PatternDetection!
  }

  # Project types
  type Project implements Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    name: String!
    description: String
    path: String!
    type: ProjectType!
    status: ProjectStatus!
    lastAnalyzed: Date
    metrics: ProjectMetrics
    components: [Component!]!
    dependencies: [Dependency!]!
    patterns: [Pattern!]!
  }

  type ProjectAnalysis {
    project: Project!
    components: [Component!]!
    dependencies: [Dependency!]!
    patterns: [Pattern!]!
    metrics: ProjectMetrics!
    insights: [Insight!]!
    recommendations: [Recommendation!]!
  }

  type ProjectGraph {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
    metadata: JSON
  }

  type ComponentTree {
    root: ComponentNode!
    totalComponents: Int!
    maxDepth: Int!
  }

  # Component types
  type Component implements Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    name: String!
    type: ComponentType!
    path: String!
    size: Int!
    complexity: Int!
    dependencies: [ComponentDependency!]!
    exports: [ComponentExport!]!
    imports: [ComponentImport!]!
    props: [ComponentProp!]!
    hooks: [ComponentHook!]!
    methods: [ComponentMethod!]!
    patterns: [Pattern!]!
    sourceCode: String
    documentation: String
  }

  type ComponentNode {
    component: Component!
    children: [ComponentNode!]!
    parent: ComponentNode
    depth: Int!
  }

  type ComponentDependency {
    target: Component!
    type: DependencyType!
    strength: Float!
    isCircular: Boolean!
  }

  type ComponentExport {
    name: String!
    type: ExportType!
    isDefault: Boolean!
  }

  type ComponentImport {
    name: String!
    source: String!
    type: ImportType!
    isTypeOnly: Boolean!
  }

  type ComponentProp {
    name: String!
    type: String!
    isRequired: Boolean!
    defaultValue: String
    description: String
  }

  type ComponentHook {
    name: String!
    type: HookType!
    dependencies: [String!]!
    isCustom: Boolean!
  }

  type ComponentMethod {
    name: String!
    parameters: [MethodParameter!]!
    returnType: String
    complexity: Int!
    isAsync: Boolean!
  }

  type MethodParameter {
    name: String!
    type: String!
    isOptional: Boolean!
    defaultValue: String
  }

  # Pattern types
  type Pattern implements Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    name: String!
    type: PatternType!
    description: String!
    category: PatternCategory!
    confidence: Float!
    severity: PatternSeverity!
    components: [Component!]!
    examples: [PatternExample!]!
    recommendations: [String!]!
    metadata: JSON
  }

  type PatternExample {
    component: Component!
    lineNumber: Int
    code: String!
    explanation: String
  }

  # Graph types
  type GraphNode {
    id: ID!
    label: String!
    type: NodeType!
    data: JSON
    position: Position
    style: NodeStyle
  }

  type GraphEdge {
    id: ID!
    source: ID!
    target: ID!
    type: EdgeType!
    label: String
    data: JSON
    style: EdgeStyle
  }

  type Position {
    x: Float!
    y: Float!
  }

  type NodeStyle {
    color: String
    backgroundColor: String
    borderColor: String
    shape: String
    size: Float
  }

  type EdgeStyle {
    color: String
    width: Float
    style: String
    arrow: Boolean
  }

  # Metrics types
  type ProjectMetrics {
    totalComponents: Int!
    totalLines: Int!
    averageComplexity: Float!
    testCoverage: Float
    maintainabilityIndex: Float!
    technicalDebt: Float!
    dependencies: DependencyMetrics!
    patterns: PatternMetrics!
    performance: PerformanceMetrics
  }

  type DependencyMetrics {
    total: Int!
    circular: Int!
    outdated: Int!
    vulnerabilities: Int!
    complexity: Float!
  }

  type PatternMetrics {
    total: Int!
    antiPatterns: Int!
    goodPatterns: Int!
    criticalIssues: Int!
  }

  type PerformanceMetrics {
    bundleSize: Int
    loadTime: Float
    renderTime: Float
    memoryUsage: Int
  }

  type ComplexityAnalysis {
    overall: Float!
    byComponent: [ComponentComplexity!]!
    distribution: ComplexityDistribution!
    recommendations: [String!]!
  }

  type ComponentComplexity {
    component: Component!
    cyclomaticComplexity: Int!
    cognitiveComplexity: Int!
    maintainabilityIndex: Float!
  }

  type ComplexityDistribution {
    low: Int!
    medium: Int!
    high: Int!
    critical: Int!
  }

  type DependencyInsights {
    graph: DependencyGraph!
    circular: [CircularDependency!]!
    critical: [CriticalDependency!]!
    unused: [UnusedDependency!]!
    recommendations: [String!]!
  }

  type DependencyGraph {
    nodes: [DependencyNode!]!
    edges: [DependencyEdge!]!
  }

  type DependencyNode {
    id: ID!
    name: String!
    version: String
    type: DependencyNodeType!
    size: Int
    isExternal: Boolean!
  }

  type DependencyEdge {
    source: ID!
    target: ID!
    type: DependencyRelationType!
    strength: Float!
  }

  type CircularDependency {
    components: [Component!]!
    path: [String!]!
    severity: CircularDependencySeverity!
  }

  type CriticalDependency {
    component: Component!
    dependents: Int!
    impact: Float!
    type: CriticalDependencyType!
  }

  type UnusedDependency {
    name: String!
    version: String!
    size: Int!
    lastUsed: Date
  }

  # Search types
  type ComponentSearchResult {
    components: [Component!]!
    totalCount: Int!
    facets: SearchFacets!
    suggestions: [String!]!
  }

  type SearchFacets {
    types: [SearchFacet!]!
    patterns: [SearchFacet!]!
    complexity: [SearchFacet!]!
  }

  type SearchFacet {
    value: String!
    count: Int!
  }

  # Insight types
  type Insight implements Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    type: InsightType!
    title: String!
    description: String!
    severity: InsightSeverity!
    confidence: Float!
    component: Component
    pattern: Pattern
    data: JSON
  }

  type Recommendation implements Node {
    id: ID!
    createdAt: Date!
    updatedAt: Date!
    type: RecommendationType!
    title: String!
    description: String!
    priority: RecommendationPriority!
    effort: RecommendationEffort!
    impact: RecommendationImpact!
    component: Component
    pattern: Pattern
    steps: [String!]!
  }

  # Input types
  input CreateProjectInput {
    name: String!
    description: String
    path: String!
    type: ProjectType!
  }

  input UpdateProjectInput {
    name: String
    description: String
    path: String
  }

  input AnalysisOptions {
    includePatterns: Boolean = true
    includeMetrics: Boolean = true
    includeDependencies: Boolean = true
    includeComplexity: Boolean = true
    patterns: [PatternType!]
    depth: AnalysisDepth = FULL
  }

  input DocumentationOptions {
    format: DocumentationFormat!
    includeExamples: Boolean = true
    includePatterns: Boolean = true
    includeMetrics: Boolean = false
    template: String
  }

  input SavePatternInput {
    name: String!
    type: PatternType!
    description: String!
    category: PatternCategory!
    examples: [PatternExampleInput!]!
    metadata: JSON
  }

  input PatternExampleInput {
    componentId: ID!
    lineNumber: Int
    code: String!
    explanation: String
  }

  input ComponentFilters {
    types: [ComponentType!]
    patterns: [PatternType!]
    complexity: ComplexityRange
    size: SizeRange
    hasTests: Boolean
  }

  input ComplexityRange {
    min: Int
    max: Int
  }

  input SizeRange {
    min: Int
    max: Int
  }

  # Result types
  type ProjectResult {
    success: Boolean!
    project: Project
    errors: [Error!]
  }

  type AnalysisResult {
    success: Boolean!
    analysis: ProjectAnalysis
    errors: [Error!]
  }

  type DocumentationResult {
    success: Boolean!
    path: String
    url: String
    errors: [Error!]
  }

  type PatternResult {
    success: Boolean!
    pattern: Pattern
    errors: [Error!]
  }

  # Subscription types
  type AnalysisProgress {
    projectId: ID!
    stage: AnalysisStage!
    progress: Float!
    message: String
    error: String
  }

  type ProjectUpdate {
    projectId: ID!
    type: ProjectUpdateType!
    data: JSON
  }

  type PatternDetection {
    projectId: ID!
    pattern: Pattern!
    component: Component!
    confidence: Float!
  }

  # Enums
  enum ProjectType {
    REACT
    VUE
    ANGULAR
    NODE
    TYPESCRIPT
    JAVASCRIPT
    UNKNOWN
  }

  enum ProjectStatus {
    ACTIVE
    ANALYZING
    COMPLETED
    ERROR
    ARCHIVED
  }

  enum ComponentType {
    FUNCTION_COMPONENT
    CLASS_COMPONENT
    HOOK
    UTILITY
    SERVICE
    TYPE
    INTERFACE
    ENUM
    CONSTANT
    CONFIG
    TEST
    STORY
    UNKNOWN
  }

  enum DependencyType {
    IMPORT
    EXPORT
    CALL
    INSTANTIATION
    INHERITANCE
    COMPOSITION
    PROP_PASSING
    CONTEXT_USAGE
  }

  enum ExportType {
    DEFAULT
    NAMED
    NAMESPACE
    RE_EXPORT
  }

  enum ImportType {
    DEFAULT
    NAMED
    NAMESPACE
    SIDE_EFFECT
  }

  enum HookType {
    USE_STATE
    USE_EFFECT
    USE_CONTEXT
    USE_REDUCER
    USE_MEMO
    USE_CALLBACK
    USE_REF
    USE_IMPERATIVE_HANDLE
    USE_DEBUG_VALUE
    CUSTOM
  }

  enum PatternType {
    # Good patterns
    CUSTOM_HOOK
    COMPOUND_COMPONENT
    RENDER_PROPS
    HIGHER_ORDER_COMPONENT
    CONTEXT_PROVIDER
    ERROR_BOUNDARY
    LAZY_LOADING
    MEMOIZATION

    # Anti-patterns
    PROP_DRILLING
    GOD_COMPONENT
    TIGHT_COUPLING
    CIRCULAR_DEPENDENCY
    UNUSED_CODE
    DUPLICATED_CODE
    COMPLEX_COMPONENT
    INEFFICIENT_RENDER
    MEMORY_LEAK
    SECURITY_ISSUE
  }

  enum PatternCategory {
    ARCHITECTURE
    PERFORMANCE
    MAINTAINABILITY
    SECURITY
    TESTING
    ACCESSIBILITY
    BEST_PRACTICE
    ANTI_PATTERN
  }

  enum PatternSeverity {
    INFO
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum NodeType {
    COMPONENT
    HOOK
    UTILITY
    SERVICE
    TYPE
    INTERFACE
    CONSTANT
    FILE
    FOLDER
    PACKAGE
  }

  enum EdgeType {
    IMPORT
    EXPORT
    DEPENDENCY
    COMPOSITION
    INHERITANCE
    CALL
    PROP_FLOW
    DATA_FLOW
  }

  enum DependencyNodeType {
    INTERNAL
    EXTERNAL
    PEER
    DEV
  }

  enum DependencyRelationType {
    DEPENDS_ON
    PEER_OF
    DEV_DEPENDENCY
    OPTIONAL
  }

  enum CircularDependencySeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum CriticalDependencyType {
    BOTTLENECK
    SINGLE_POINT_OF_FAILURE
    HIGH_COUPLING
    CENTRAL_HUB
  }

  enum InsightType {
    PERFORMANCE
    MAINTAINABILITY
    SECURITY
    ARCHITECTURE
    TESTING
    ACCESSIBILITY
    BEST_PRACTICE
  }

  enum InsightSeverity {
    INFO
    WARNING
    ERROR
    CRITICAL
  }

  enum RecommendationType {
    REFACTOR
    OPTIMIZE
    SECURITY_FIX
    ARCHITECTURE_IMPROVEMENT
    TESTING
    DOCUMENTATION
    DEPENDENCY_UPDATE
  }

  enum RecommendationPriority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum RecommendationEffort {
    MINIMAL
    LOW
    MEDIUM
    HIGH
    EXTENSIVE
  }

  enum RecommendationImpact {
    MINIMAL
    LOW
    MEDIUM
    HIGH
    MAJOR
  }

  enum AnalysisDepth {
    SHALLOW
    MEDIUM
    FULL
    DEEP
  }

  enum DocumentationFormat {
    MARKDOWN
    HTML
    PDF
    JSON
  }

  enum AnalysisStage {
    INITIALIZING
    SCANNING_FILES
    PARSING_CODE
    ANALYZING_DEPENDENCIES
    DETECTING_PATTERNS
    CALCULATING_METRICS
    GENERATING_INSIGHTS
    GENERATING_RECOMMENDATIONS
    FINALIZING
    COMPLETED
    ERROR
  }

  enum ProjectUpdateType {
    ANALYSIS_COMPLETED
    PATTERNS_UPDATED
    METRICS_UPDATED
    COMPONENTS_ADDED
    COMPONENTS_REMOVED
    DEPENDENCIES_UPDATED
    ERROR_OCCURRED
  }
`;

// Base resolvers
const baseResolvers = {
  Date: {
    serialize: (date: Date) => date.toISOString(),
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => new Date(ast.value)
  },
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => JSON.parse(ast.value)
  }
};

// Analysis resolvers - will be implemented with actual business logic
const analysisResolvers = {
  Query: {
    analyzeProject: async (parent: any, args: any, context: any) => {
      // Implementation will use actual analysis services
      throw new Error('analyzeProject resolver not yet implemented');
    },
    getProjectGraph: async (parent: any, args: any, context: any) => {
      throw new Error('getProjectGraph resolver not yet implemented');
    },
    getComponentTree: async (parent: any, args: any, context: any) => {
      throw new Error('getComponentTree resolver not yet implemented');
    },
    searchComponents: async (parent: any, args: any, context: any) => {
      throw new Error('searchComponents resolver not yet implemented');
    },
    findPatterns: async (parent: any, args: any, context: any) => {
      throw new Error('findPatterns resolver not yet implemented');
    },
    getProjectMetrics: async (parent: any, args: any, context: any) => {
      throw new Error('getProjectMetrics resolver not yet implemented');
    },
    getCodeComplexity: async (parent: any, args: any, context: any) => {
      throw new Error('getCodeComplexity resolver not yet implemented');
    },
    getDependencyInsights: async (parent: any, args: any, context: any) => {
      throw new Error('getDependencyInsights resolver not yet implemented');
    }
  },

  Mutation: {
    createProject: async (parent: any, args: any, context: any) => {
      throw new Error('createProject resolver not yet implemented');
    },
    updateProject: async (parent: any, args: any, context: any) => {
      throw new Error('updateProject resolver not yet implemented');
    },
    deleteProject: async (parent: any, args: any, context: any) => {
      throw new Error('deleteProject resolver not yet implemented');
    },
    triggerAnalysis: async (parent: any, args: any, context: any) => {
      throw new Error('triggerAnalysis resolver not yet implemented');
    },
    generateDocumentation: async (parent: any, args: any, context: any) => {
      throw new Error('generateDocumentation resolver not yet implemented');
    },
    savePattern: async (parent: any, args: any, context: any) => {
      throw new Error('savePattern resolver not yet implemented');
    },
    removePattern: async (parent: any, args: any, context: any) => {
      throw new Error('removePattern resolver not yet implemented');
    }
  },

  Subscription: {
    analysisProgress: {
      subscribe: async (parent: any, args: any, context: any) => {
        throw new Error('analysisProgress subscription not yet implemented');
      }
    },
    projectUpdated: {
      subscribe: async (parent: any, args: any, context: any) => {
        throw new Error('projectUpdated subscription not yet implemented');
      }
    },
    patternDetected: {
      subscribe: async (parent: any, args: any, context: any) => {
        throw new Error('patternDetected subscription not yet implemented');
      }
    }
  }
};

// Merge all type definitions and resolvers
export const graphqlSchema = {
  typeDefs: mergeTypeDefs([baseTypeDefs, analysisTypeDefs]),
  resolvers: mergeResolvers([baseResolvers, analysisResolvers])
};