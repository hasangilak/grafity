import { ComponentInfo, FunctionInfo, ProjectGraph } from '../../types';
import { ComponentMapping, DataFlowPattern } from './ComponentBusinessMapper';

export interface UserJourney {
  id: string;
  name: string;
  persona: string;
  goal: string;
  trigger: JourneyTrigger;
  steps: JourneyStep[];
  dataFlow: JourneyDataFlow[];
  outcomes: JourneyOutcome[];
  alternativePaths: AlternativePath[];
  metrics: JourneyMetrics;
  businessValue: string;
}

export interface JourneyTrigger {
  type: 'user_action' | 'system_event' | 'time_based' | 'external_event';
  description: string;
  component?: string;
  preconditions: string[];
}

export interface JourneyStep {
  id: string;
  order: number;
  type: 'interaction' | 'process' | 'decision' | 'data_operation' | 'navigation';
  description: string;
  component: string;
  userAction?: string;
  systemResponse?: string;
  dataTransformation?: DataOperation;
  nextSteps: string[]; // IDs of possible next steps
  duration?: number; // estimated time in seconds
}

export interface DataOperation {
  operation: 'create' | 'read' | 'update' | 'delete' | 'transform' | 'validate';
  entity: string;
  attributes?: string[];
  conditions?: string[];
  transformations?: string[];
}

export interface JourneyDataFlow {
  stepId: string;
  dataIn: DataPoint[];
  processing: string[];
  dataOut: DataPoint[];
  sideEffects: string[];
}

export interface DataPoint {
  name: string;
  type: string;
  source: 'user_input' | 'database' | 'api' | 'computation' | 'context';
  validation?: string[];
  required: boolean;
}

export interface JourneyOutcome {
  type: 'success' | 'failure' | 'partial';
  description: string;
  businessImpact: string;
  technicalResult: string;
  measurableMetrics: string[];
}

export interface AlternativePath {
  id: string;
  condition: string;
  description: string;
  fromStep: string;
  toStep: string;
  probability: number; // 0-1
  steps: JourneyStep[];
}

export interface JourneyMetrics {
  estimatedDuration: number; // seconds
  complexity: number; // 1-10
  userEffort: number; // 1-10
  systemLoad: number; // 1-10
  dataPoints: number;
  decisionPoints: number;
  integrationPoints: number;
}

export interface UserJourneyMap {
  journeys: UserJourney[];
  journeyRelationships: JourneyRelationship[];
  commonPatterns: JourneyPattern[];
  dataFlowGraph: DataFlowGraph;
}

export interface JourneyRelationship {
  from: string;
  to: string;
  relationshipType: 'leads_to' | 'requires' | 'alternative_to' | 'extends';
  condition?: string;
}

export interface JourneyPattern {
  id: string;
  name: string;
  description: string;
  occurrences: string[]; // Journey IDs where pattern occurs
  patternSteps: PatternStep[];
  businessPurpose: string;
}

export interface PatternStep {
  type: string;
  commonComponents: string[];
  dataPattern: string;
  frequency: number;
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  clusters: DataFlowCluster[];
}

export interface DataFlowNode {
  id: string;
  type: 'component' | 'data_store' | 'api' | 'user' | 'system';
  name: string;
  dataOperations: DataOperation[];
  journeyReferences: string[];
}

export interface DataFlowEdge {
  id: string;
  from: string;
  to: string;
  dataType: string;
  operation: string;
  volume: 'low' | 'medium' | 'high';
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataFlowCluster {
  id: string;
  name: string;
  nodes: string[];
  purpose: string;
  dataConsistencyRequirements: string[];
}

export class DataFlowToUserJourney {
  private projectGraph: ProjectGraph;
  private journeyMap: UserJourneyMap;
  private componentMappings: Map<string, ComponentMapping>;

  constructor(
    projectGraph: ProjectGraph,
    componentMappings: Map<string, ComponentMapping>
  ) {
    this.projectGraph = projectGraph;
    this.componentMappings = componentMappings;
    this.journeyMap = {
      journeys: [],
      journeyRelationships: [],
      commonPatterns: [],
      dataFlowGraph: {
        nodes: [],
        edges: [],
        clusters: []
      }
    };
  }

  public transformDataFlowsToJourneys(): UserJourneyMap {
    // Identify entry points (components that can start journeys)
    const entryPoints = this.identifyEntryPoints();

    // Trace data flows from entry points to create journeys
    entryPoints.forEach(entryPoint => {
      const journey = this.traceUserJourney(entryPoint);
      if (journey) {
        this.journeyMap.journeys.push(journey);
      }
    });

    // Identify common patterns across journeys
    this.identifyCommonPatterns();

    // Build comprehensive data flow graph
    this.buildDataFlowGraph();

    // Establish journey relationships
    this.establishJourneyRelationships();

    // Calculate journey metrics
    this.calculateJourneyMetrics();

    return this.journeyMap;
  }

  private identifyEntryPoints(): ComponentInfo[] {
    // Entry points are components that:
    // 1. Are routes/pages
    // 2. Have forms
    // 3. Are dashboards
    // 4. Have no parent components calling them

    return this.projectGraph.components.filter(component => {
      const name = component.name.toLowerCase();

      // Check if it's a page/route component
      if (name.includes('page') || name.includes('view') || name.includes('screen')) {
        return true;
      }

      // Check if it's a form component at root level
      if (name.includes('form') && !this.hasParentComponent(component)) {
        return true;
      }

      // Check if it's a dashboard
      if (name.includes('dashboard') || name.includes('home')) {
        return true;
      }

      // Check if it's a list view (often an entry point)
      if (name.includes('list') && !this.hasParentComponent(component)) {
        return true;
      }

      return false;
    });
  }

  private hasParentComponent(component: ComponentInfo): boolean {
    // Check if any other component imports this one
    return this.projectGraph.components.some(otherComp =>
      otherComp.name !== component.name &&
      otherComp.children?.some(child =>
        typeof child === 'string' ? child === component.name : child.name === component.name
      )
    );
  }

  private traceUserJourney(entryPoint: ComponentInfo): UserJourney | null {
    const journeyName = this.inferJourneyName(entryPoint);
    const journeyGoal = this.inferJourneyGoal(entryPoint);

    const journey: UserJourney = {
      id: `journey-${entryPoint.name.toLowerCase()}-${Date.now()}`,
      name: journeyName,
      persona: this.inferPersona(entryPoint),
      goal: journeyGoal,
      trigger: this.identifyJourneyTrigger(entryPoint),
      steps: [],
      dataFlow: [],
      outcomes: [],
      alternativePaths: [],
      metrics: {
        estimatedDuration: 0,
        complexity: 0,
        userEffort: 0,
        systemLoad: 0,
        dataPoints: 0,
        decisionPoints: 0,
        integrationPoints: 0
      },
      businessValue: this.inferBusinessValue(journeyGoal)
    };

    // Trace the journey steps
    const visited = new Set<string>();
    this.traceJourneySteps(entryPoint, journey, visited, 1);

    // Identify data flows for each step
    journey.steps.forEach(step => {
      const dataFlow = this.analyzeStepDataFlow(step, journey);
      if (dataFlow) {
        journey.dataFlow.push(dataFlow);
      }
    });

    // Identify possible outcomes
    journey.outcomes = this.identifyJourneyOutcomes(journey);

    // Find alternative paths
    journey.alternativePaths = this.findAlternativePaths(journey);

    return journey.steps.length > 0 ? journey : null;
  }

  private inferJourneyName(component: ComponentInfo): string {
    const name = component.name;

    // Common journey patterns
    if (name.includes('Login')) return 'User Login Journey';
    if (name.includes('Register')) return 'User Registration Journey';
    if (name.includes('TodoList')) return 'Task Management Journey';
    if (name.includes('Dashboard')) return 'Dashboard Overview Journey';
    if (name.includes('Profile')) return 'Profile Management Journey';
    if (name.includes('CreateTodo')) return 'Task Creation Journey';
    if (name.includes('Settings')) return 'Settings Configuration Journey';

    return `${name} User Journey`;
  }

  private inferJourneyGoal(component: ComponentInfo): string {
    const name = component.name.toLowerCase();
    const mapping = this.componentMappings.get(component.name);

    if (mapping) {
      return mapping.businessPurpose;
    }

    // Infer from component name
    if (name.includes('create')) return 'Create a new item';
    if (name.includes('edit')) return 'Edit existing item';
    if (name.includes('delete')) return 'Remove an item';
    if (name.includes('list')) return 'View and manage items';
    if (name.includes('dashboard')) return 'Get overview of system state';
    if (name.includes('profile')) return 'Manage user information';

    return 'Complete user task';
  }

  private inferPersona(component: ComponentInfo): string {
    // Check if component requires authentication
    if (component.hooks.some(h => h.name.includes('useUser') || h.name.includes('useAuth'))) {
      return 'authenticated-user';
    }

    // Check for admin patterns
    if (component.name.toLowerCase().includes('admin')) {
      return 'admin-user';
    }

    return 'guest-user';
  }

  private identifyJourneyTrigger(component: ComponentInfo): JourneyTrigger {
    const name = component.name.toLowerCase();

    if (name.includes('dashboard') || name.includes('home')) {
      return {
        type: 'user_action',
        description: 'User navigates to dashboard',
        component: component.name,
        preconditions: ['User is authenticated', 'Application is loaded']
      };
    }

    if (name.includes('form')) {
      return {
        type: 'user_action',
        description: 'User initiates form interaction',
        component: component.name,
        preconditions: ['Form is accessible', 'User has necessary permissions']
      };
    }

    return {
      type: 'user_action',
      description: `User accesses ${component.name}`,
      component: component.name,
      preconditions: []
    };
  }

  private traceJourneySteps(
    component: ComponentInfo,
    journey: UserJourney,
    visited: Set<string>,
    order: number
  ): void {
    if (visited.has(component.name)) return;
    visited.add(component.name);

    const mapping = this.componentMappings.get(component.name);
    if (!mapping) return;

    // Create steps for each interaction pattern
    mapping.interactionPatterns.forEach((pattern, index) => {
      const step: JourneyStep = {
        id: `step-${component.name}-${index}`,
        order: order + index,
        type: this.mapPatternToStepType(pattern.type),
        description: pattern.description,
        component: component.name,
        userAction: pattern.triggers.join(', '),
        systemResponse: pattern.outcomes.join(', '),
        dataTransformation: this.extractDataOperation(component, pattern),
        nextSteps: [],
        duration: this.estimateStepDuration(pattern.type)
      };

      journey.steps.push(step);

      // Track metrics
      if (pattern.type === 'user_input') journey.metrics.userEffort++;
      if (pattern.type === 'api_call') journey.metrics.integrationPoints++;
      if (this.isDecisionPoint(pattern)) journey.metrics.decisionPoints++;
    });

    // Trace child components
    if (component.children) {
      component.children.forEach(child => {
        const childName = typeof child === 'string' ? child : child.name;
        const childComponent = this.projectGraph.components.find(c => c.name === childName);
        if (childComponent) {
          this.traceJourneySteps(childComponent, journey, visited, order + mapping.interactionPatterns.length);
        }
      });
    }
  }

  private mapPatternToStepType(patternType: string): JourneyStep['type'] {
    const typeMap: Record<string, JourneyStep['type']> = {
      'user_input': 'interaction',
      'display': 'process',
      'navigation': 'navigation',
      'state_management': 'process',
      'api_call': 'data_operation'
    };

    return typeMap[patternType] || 'process';
  }

  private extractDataOperation(component: ComponentInfo, pattern: any): DataOperation | undefined {
    if (pattern.type !== 'api_call' && pattern.type !== 'state_management') {
      return undefined;
    }

    const name = component.name.toLowerCase();
    let operation: DataOperation['operation'] = 'read';
    let entity = 'data';

    if (name.includes('create') || name.includes('add')) operation = 'create';
    else if (name.includes('edit') || name.includes('update')) operation = 'update';
    else if (name.includes('delete') || name.includes('remove')) operation = 'delete';
    else if (name.includes('validate')) operation = 'validate';

    if (name.includes('todo') || name.includes('task')) entity = 'Task';
    else if (name.includes('user')) entity = 'User';
    else if (name.includes('profile')) entity = 'Profile';

    return {
      operation,
      entity,
      attributes: [],
      conditions: [],
      transformations: []
    };
  }

  private estimateStepDuration(patternType: string): number {
    const durations: Record<string, number> = {
      'user_input': 5,
      'display': 1,
      'navigation': 2,
      'state_management': 0.5,
      'api_call': 3
    };

    return durations[patternType] || 1;
  }

  private isDecisionPoint(pattern: any): boolean {
    return pattern.outcomes.length > 1 || pattern.description.includes('decision');
  }

  private analyzeStepDataFlow(step: JourneyStep, journey: UserJourney): JourneyDataFlow {
    const component = this.projectGraph.components.find(c => c.name === step.component);
    const mapping = this.componentMappings.get(step.component);

    const dataFlow: JourneyDataFlow = {
      stepId: step.id,
      dataIn: [],
      processing: [],
      dataOut: [],
      sideEffects: []
    };

    if (component && mapping) {
      // Analyze inputs
      mapping.dataFlow.inputs.forEach(input => {
        dataFlow.dataIn.push({
          name: input.dataType,
          type: input.dataType,
          source: input.source as any,
          validation: [],
          required: true
        });
      });

      // Analyze processing
      mapping.dataFlow.transformations.forEach(transform => {
        dataFlow.processing.push(transform.businessLogic);
      });

      // Analyze outputs
      mapping.dataFlow.outputs.forEach(output => {
        dataFlow.dataOut.push({
          name: output.dataType,
          type: output.dataType,
          source: 'computation',
          validation: [],
          required: false
        });
      });

      // Side effects
      dataFlow.sideEffects = mapping.dataFlow.sideEffects;
    }

    journey.metrics.dataPoints += dataFlow.dataIn.length + dataFlow.dataOut.length;

    return dataFlow;
  }

  private identifyJourneyOutcomes(journey: UserJourney): JourneyOutcome[] {
    const outcomes: JourneyOutcome[] = [];

    // Success outcome
    outcomes.push({
      type: 'success',
      description: `Successfully complete ${journey.goal}`,
      businessImpact: `User achieves intended goal`,
      technicalResult: 'All operations completed successfully',
      measurableMetrics: ['Completion time', 'Success rate', 'User satisfaction']
    });

    // Failure outcomes based on integration points
    if (journey.metrics.integrationPoints > 0) {
      outcomes.push({
        type: 'failure',
        description: 'API/Integration failure',
        businessImpact: 'User cannot complete task',
        technicalResult: 'External service unavailable or error',
        measurableMetrics: ['Error rate', 'Retry attempts', 'Fallback usage']
      });
    }

    // Partial completion for multi-step journeys
    if (journey.steps.length > 3) {
      outcomes.push({
        type: 'partial',
        description: 'User abandons journey',
        businessImpact: 'Goal partially achieved or abandoned',
        technicalResult: 'Journey interrupted by user action',
        measurableMetrics: ['Drop-off rate', 'Completion percentage', 'Time to abandon']
      });
    }

    return outcomes;
  }

  private findAlternativePaths(journey: UserJourney): AlternativePath[] {
    const alternativePaths: AlternativePath[] = [];

    // Look for conditional steps or decision points
    journey.steps.forEach((step, index) => {
      if (step.type === 'decision' || journey.metrics.decisionPoints > 0) {
        // Create alternative path for error handling
        alternativePaths.push({
          id: `alt-path-error-${step.id}`,
          condition: 'Error or validation failure',
          description: 'Error handling path',
          fromStep: step.id,
          toStep: journey.steps[0]?.id || step.id,
          probability: 0.1,
          steps: this.createErrorHandlingSteps(step)
        });
      }
    });

    return alternativePaths;
  }

  private createErrorHandlingSteps(originalStep: JourneyStep): JourneyStep[] {
    return [
      {
        id: `${originalStep.id}-error`,
        order: originalStep.order + 0.1,
        type: 'process',
        description: 'Display error message',
        component: originalStep.component,
        systemResponse: 'Show error notification',
        nextSteps: [originalStep.id],
        duration: 2
      },
      {
        id: `${originalStep.id}-retry`,
        order: originalStep.order + 0.2,
        type: 'interaction',
        description: 'User can retry action',
        component: originalStep.component,
        userAction: 'Click retry',
        nextSteps: [originalStep.id],
        duration: 3
      }
    ];
  }

  private inferBusinessValue(goal: string): string {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('create') || goalLower.includes('add')) {
      return 'Enables users to add new data to the system, expanding business capabilities';
    }
    if (goalLower.includes('manage') || goalLower.includes('edit')) {
      return 'Provides control and flexibility over business data';
    }
    if (goalLower.includes('view') || goalLower.includes('overview')) {
      return 'Offers insights and visibility into business operations';
    }
    if (goalLower.includes('delete') || goalLower.includes('remove')) {
      return 'Maintains data hygiene and system efficiency';
    }

    return 'Supports business operations and user productivity';
  }

  private identifyCommonPatterns(): void {
    const patternOccurrences = new Map<string, string[]>();

    // Analyze steps across all journeys for patterns
    this.journeyMap.journeys.forEach(journey => {
      const stepSequences = this.extractStepSequences(journey);

      stepSequences.forEach(sequence => {
        const patternKey = this.generatePatternKey(sequence);
        const occurrences = patternOccurrences.get(patternKey) || [];
        occurrences.push(journey.id);
        patternOccurrences.set(patternKey, occurrences);
      });
    });

    // Create patterns that occur in multiple journeys
    patternOccurrences.forEach((occurrences, patternKey) => {
      if (occurrences.length > 1) {
        const pattern = this.createJourneyPattern(patternKey, occurrences);
        this.journeyMap.commonPatterns.push(pattern);
      }
    });
  }

  private extractStepSequences(journey: UserJourney): JourneyStep[][] {
    const sequences: JourneyStep[][] = [];

    // Extract sequences of 2-3 steps
    for (let i = 0; i < journey.steps.length - 1; i++) {
      sequences.push([journey.steps[i], journey.steps[i + 1]]);

      if (i < journey.steps.length - 2) {
        sequences.push([journey.steps[i], journey.steps[i + 1], journey.steps[i + 2]]);
      }
    }

    return sequences;
  }

  private generatePatternKey(sequence: JourneyStep[]): string {
    return sequence.map(step => `${step.type}-${step.description.split(' ')[0]}`).join('->');
  }

  private createJourneyPattern(patternKey: string, occurrences: string[]): JourneyPattern {
    const steps = patternKey.split('->');

    return {
      id: `pattern-${patternKey.replace(/->/g, '-')}`,
      name: this.inferPatternName(steps),
      description: `Common pattern occurring in ${occurrences.length} journeys`,
      occurrences,
      patternSteps: steps.map(step => ({
        type: step.split('-')[0],
        commonComponents: [],
        dataPattern: step,
        frequency: occurrences.length
      })),
      businessPurpose: this.inferPatternPurpose(steps)
    };
  }

  private inferPatternName(steps: string[]): string {
    if (steps.some(s => s.includes('interaction')) && steps.some(s => s.includes('data_operation'))) {
      return 'User Input to Data Operation';
    }
    if (steps.every(s => s.includes('process'))) {
      return 'Sequential Processing';
    }
    if (steps.some(s => s.includes('navigation'))) {
      return 'Navigation Flow';
    }

    return 'Common Interaction Pattern';
  }

  private inferPatternPurpose(steps: string[]): string {
    if (steps.some(s => s.includes('interaction')) && steps.some(s => s.includes('data_operation'))) {
      return 'Capture user input and persist to database';
    }
    if (steps.some(s => s.includes('navigation'))) {
      return 'Guide user through application flow';
    }

    return 'Standardize user interaction flow';
  }

  private buildDataFlowGraph(): void {
    // Create nodes for all components
    this.journeyMap.journeys.forEach(journey => {
      journey.steps.forEach(step => {
        if (!this.journeyMap.dataFlowGraph.nodes.find(n => n.id === step.component)) {
          const node: DataFlowNode = {
            id: step.component,
            type: 'component',
            name: step.component,
            dataOperations: step.dataTransformation ? [step.dataTransformation] : [],
            journeyReferences: [journey.id]
          };
          this.journeyMap.dataFlowGraph.nodes.push(node);
        }
      });
    });

    // Create edges based on data flows
    this.journeyMap.journeys.forEach(journey => {
      for (let i = 0; i < journey.steps.length - 1; i++) {
        const fromStep = journey.steps[i];
        const toStep = journey.steps[i + 1];

        const edge: DataFlowEdge = {
          id: `edge-${fromStep.id}-${toStep.id}`,
          from: fromStep.component,
          to: toStep.component,
          dataType: 'user-data',
          operation: fromStep.type,
          volume: 'medium',
          criticality: this.assessCriticality(fromStep, journey)
        };

        if (!this.journeyMap.dataFlowGraph.edges.find(e =>
          e.from === edge.from && e.to === edge.to
        )) {
          this.journeyMap.dataFlowGraph.edges.push(edge);
        }
      }
    });

    // Create clusters based on business domains
    this.createDataFlowClusters();
  }

  private assessCriticality(step: JourneyStep, journey: UserJourney): 'low' | 'medium' | 'high' | 'critical' {
    if (step.dataTransformation?.operation === 'delete') return 'critical';
    if (step.type === 'data_operation' && journey.persona === 'authenticated-user') return 'high';
    if (step.type === 'interaction') return 'medium';
    return 'low';
  }

  private createDataFlowClusters(): void {
    // Group nodes by common patterns
    const clusters = new Map<string, string[]>();

    this.journeyMap.dataFlowGraph.nodes.forEach(node => {
      const clusterName = this.inferClusterName(node.name);
      const nodes = clusters.get(clusterName) || [];
      nodes.push(node.id);
      clusters.set(clusterName, nodes);
    });

    clusters.forEach((nodes, name) => {
      if (nodes.length > 1) {
        this.journeyMap.dataFlowGraph.clusters.push({
          id: `cluster-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          nodes,
          purpose: `Group components related to ${name}`,
          dataConsistencyRequirements: this.inferConsistencyRequirements(name)
        });
      }
    });
  }

  private inferClusterName(nodeName: string): string {
    const name = nodeName.toLowerCase();

    if (name.includes('todo') || name.includes('task')) return 'Task Management';
    if (name.includes('user') || name.includes('profile')) return 'User Management';
    if (name.includes('dashboard')) return 'Analytics';

    return 'General';
  }

  private inferConsistencyRequirements(clusterName: string): string[] {
    const requirements: string[] = ['Data integrity'];

    if (clusterName.includes('User')) {
      requirements.push('Authentication consistency', 'Session management');
    }
    if (clusterName.includes('Task')) {
      requirements.push('Task state consistency', 'Order preservation');
    }

    return requirements;
  }

  private establishJourneyRelationships(): void {
    this.journeyMap.journeys.forEach(journey1 => {
      this.journeyMap.journeys.forEach(journey2 => {
        if (journey1.id === journey2.id) return;

        // Check for sequential relationships
        if (this.canLeadTo(journey1, journey2)) {
          this.journeyMap.journeyRelationships.push({
            from: journey1.id,
            to: journey2.id,
            relationshipType: 'leads_to',
            condition: 'After completion'
          });
        }

        // Check for dependency relationships
        if (this.requiresJourney(journey2, journey1)) {
          this.journeyMap.journeyRelationships.push({
            from: journey2.id,
            to: journey1.id,
            relationshipType: 'requires',
            condition: 'Must complete first'
          });
        }
      });
    });
  }

  private canLeadTo(journey1: UserJourney, journey2: UserJourney): boolean {
    // Check if the end of journey1 connects to the start of journey2
    const lastStep = journey1.steps[journey1.steps.length - 1];
    const firstStep = journey2.steps[0];

    return lastStep && firstStep &&
           (lastStep.component === firstStep.component ||
            lastStep.nextSteps.includes(firstStep.id));
  }

  private requiresJourney(journey1: UserJourney, journey2: UserJourney): boolean {
    // Check if journey1 requires authentication and journey2 provides it
    if (journey1.trigger.preconditions.includes('User is authenticated') &&
        journey2.name.toLowerCase().includes('login')) {
      return true;
    }

    return false;
  }

  private calculateJourneyMetrics(): void {
    this.journeyMap.journeys.forEach(journey => {
      // Calculate total duration
      journey.metrics.estimatedDuration = journey.steps.reduce((sum, step) =>
        sum + (step.duration || 0), 0
      );

      // Calculate complexity based on steps and decision points
      journey.metrics.complexity = Math.min(10,
        journey.steps.length / 3 +
        journey.metrics.decisionPoints * 2 +
        journey.alternativePaths.length
      );

      // Calculate user effort
      journey.metrics.userEffort = Math.min(10,
        journey.steps.filter(s => s.type === 'interaction').length * 2
      );

      // Calculate system load
      journey.metrics.systemLoad = Math.min(10,
        journey.metrics.integrationPoints * 3 +
        journey.steps.filter(s => s.type === 'data_operation').length * 2
      );
    });
  }
}