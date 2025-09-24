// Re-export types from the main project
// In a real project, these would be shared via a package or monorepo structure

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