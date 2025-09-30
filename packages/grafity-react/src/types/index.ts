// Core React analysis types for Nx integration

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
  location: SourceLocation;
}

export interface PropInfo {
  name: string;
  type: string;
  isRequired: boolean;
  defaultValue?: string;
}

export interface HookInfo {
  name: string;
  type: 'useState' | 'useReducer' | 'useEffect' | 'useContext' | 'custom' | 'other';
  dependencies: string[];
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

// React Pattern Detection
export interface ReactPattern {
  id: string;
  name: string;
  type: 'pattern' | 'anti-pattern';
  confidence: number;
  location: SourceLocation;
  description: string;
  components: string[];
  suggestions?: string[];
}

export interface ReactPatternRule {
  name: string;
  type: 'pattern' | 'anti-pattern';
  description: string;
  detect: (components: ComponentInfo[]) => ReactPattern[];
}

// Nx Integration types
export interface NxReactProjectData {
  components: ComponentInfo[];
  patterns: ReactPattern[];
  dataFlows: {
    stateFlows: any[];
    propFlows: any[];
    contextFlows: any[];
  };
  metrics: ReactMetrics;
}

export interface ReactMetrics {
  componentCount: number;
  hookUsage: Record<string, number>;
  complexity: number;
  testCoverage?: number;
  propDepth: number;
  contextUsage: number;
}

// MCP Tool types
export interface ReactMCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface ComponentHierarchy {
  id: string;
  name: string;
  filePath: string;
  props: PropInfo[];
  children: ComponentHierarchy[];
  hooks: HookInfo[];
}

export interface HookUsageGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    hookType?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    label?: string;
  }>;
}

export interface PropFlowGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: 'component' | 'prop';
  }>;
  edges: Array<{
    from: string;
    to: string;
    propName: string;
    propType: string;
    isRequired: boolean;
  }>;
}