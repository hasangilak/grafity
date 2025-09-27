import { ComponentInfo, ProjectGraph } from '../../types';
import { UserStory, BusinessCapability, DataEntity } from './BusinessStoryExtractor';

export interface BusinessFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'supporting' | 'utility';
  components: ComponentMapping[];
  userStories: string[];
  dataEntities: string[];
  businessValue: number; // 0-100
  technicalComplexity: number; // 0-100
  dependencies: FeatureDependency[];
  metrics: FeatureMetrics;
}

export interface ComponentMapping {
  componentName: string;
  componentType: 'container' | 'presentational' | 'functional' | 'hybrid';
  responsibility: string;
  businessPurpose: string;
  interactionPatterns: InteractionPattern[];
  dataFlow: DataFlowPattern;
}

export interface InteractionPattern {
  type: 'user_input' | 'display' | 'navigation' | 'state_management' | 'api_call';
  description: string;
  triggers: string[];
  outcomes: string[];
}

export interface DataFlowPattern {
  inputs: DataInput[];
  transformations: DataTransformation[];
  outputs: DataOutput[];
  sideEffects: string[];
}

export interface DataInput {
  source: 'props' | 'state' | 'context' | 'api' | 'route';
  dataType: string;
  purpose: string;
}

export interface DataTransformation {
  operation: string;
  businessLogic: string;
  validation: string[];
}

export interface DataOutput {
  destination: 'render' | 'state_update' | 'api_call' | 'navigation' | 'event';
  dataType: string;
  effect: string;
}

export interface FeatureDependency {
  featureId: string;
  dependencyType: 'requires' | 'extends' | 'optional';
  reason: string;
}

export interface FeatureMetrics {
  codeLines: number;
  componentCount: number;
  userInteractionPoints: number;
  apiEndpoints: number;
  averageComplexity: number;
}

export interface BusinessComponentGraph {
  features: BusinessFeature[];
  componentMappings: Map<string, ComponentMapping>;
  featureRelationships: FeatureRelationship[];
  businessDomains: BusinessDomain[];
}

export interface FeatureRelationship {
  from: string;
  to: string;
  relationshipType: 'depends_on' | 'extends' | 'complements' | 'alternative_to';
  strength: number; // 0-1
  description: string;
}

export interface BusinessDomain {
  id: string;
  name: string;
  description: string;
  features: string[];
  coreComponents: string[];
  boundaryComponents: string[];
  domainLanguage: DomainTerm[];
}

export interface DomainTerm {
  term: string;
  technicalMapping: string;
  componentReferences: string[];
  description: string;
}

export class ComponentBusinessMapper {
  private projectGraph: ProjectGraph;
  private businessGraph: BusinessComponentGraph;

  constructor(projectGraph: ProjectGraph) {
    this.projectGraph = projectGraph;
    this.businessGraph = {
      features: [],
      componentMappings: new Map(),
      featureRelationships: [],
      businessDomains: []
    };
  }

  public mapComponentsToBusinessFeatures(
    userStories: UserStory[],
    capabilities: BusinessCapability[],
    dataEntities: DataEntity[]
  ): BusinessComponentGraph {
    // Map each component to its business purpose
    this.mapComponents();

    // Identify business features from component clusters
    this.identifyBusinessFeatures(userStories, capabilities);

    // Create feature relationships
    this.createFeatureRelationships();

    // Identify business domains
    this.identifyBusinessDomains();

    // Calculate metrics
    this.calculateFeatureMetrics();

    return this.businessGraph;
  }

  private mapComponents(): void {
    Array.from(this.projectGraph.components.values()).forEach(component => {
      const mapping = this.createComponentMapping(component);
      this.businessGraph.componentMappings.set(component.name, mapping);
    });
  }

  private createComponentMapping(component: ComponentInfo): ComponentMapping {
    return {
      componentName: component.name,
      componentType: this.classifyComponentType(component),
      responsibility: this.inferComponentResponsibility(component),
      businessPurpose: this.inferBusinessPurpose(component),
      interactionPatterns: this.extractInteractionPatterns(component),
      dataFlow: this.analyzeDataFlow(component)
    };
  }

  private classifyComponentType(component: ComponentInfo): ComponentMapping['componentType'] {
    const hasState = component.hooks.some(h => h.name === 'useState' || h.name === 'useReducer');
    const hasChildren = component.children && component.children.length > 0;
    const hasComplexLogic = component.hooks.length > 3;

    if (hasState && hasChildren && hasComplexLogic) {
      return 'hybrid';
    } else if (hasState || hasComplexLogic) {
      return 'container';
    } else if (hasChildren) {
      return 'presentational';
    } else {
      return 'functional';
    }
  }

  private inferComponentResponsibility(component: ComponentInfo): string {
    const name = component.name.toLowerCase();

    // Common patterns
    if (name.includes('list')) return 'Display and manage collection of items';
    if (name.includes('form')) return 'Collect and validate user input';
    if (name.includes('dashboard')) return 'Provide overview and key metrics';
    if (name.includes('profile')) return 'Display and manage user information';
    if (name.includes('header')) return 'Provide navigation and app context';
    if (name.includes('footer')) return 'Display supplementary information';
    if (name.includes('modal') || name.includes('dialog')) return 'Present focused interaction';
    if (name.includes('button')) return 'Trigger user actions';
    if (name.includes('input')) return 'Accept user input';
    if (name.includes('card')) return 'Display grouped information';

    // Check hooks for more context
    if (component.hooks.some(h => h.name.includes('fetch') || h.name.includes('api'))) {
      return 'Manage data fetching and API interactions';
    }

    if (component.hooks.some(h => h.name === 'useContext')) {
      return 'Consume and utilize shared application state';
    }

    return `Manage ${component.name} functionality`;
  }

  private inferBusinessPurpose(component: ComponentInfo): string {
    const name = component.name;
    const responsibility = this.inferComponentResponsibility(component);

    // Map to business terms
    const businessPurposeMap: Record<string, string> = {
      'TodoList': 'Enable task management and organization',
      'UserProfile': 'Manage user identity and preferences',
      'Dashboard': 'Provide business insights and overview',
      'CreateTodoForm': 'Capture new task requirements',
      'Header': 'Facilitate application navigation',
      'TodoItem': 'Display and manage individual tasks',
      'UserAvatar': 'Represent user identity visually',
      'RecentActivity': 'Track and display user actions',
      'TodoSummary': 'Provide task completion metrics'
    };

    return businessPurposeMap[name] || `Support ${responsibility.toLowerCase()}`;
  }

  private extractInteractionPatterns(component: ComponentInfo): InteractionPattern[] {
    const patterns: InteractionPattern[] = [];

    // Check for user input patterns
    const inputProps = component.props.filter(p => p.name.startsWith('on'));
    inputProps.forEach(prop => {
      patterns.push({
        type: 'user_input',
        description: `Handle ${this.humanizeEventName(prop.name)}`,
        triggers: [prop.name],
        outcomes: this.inferEventOutcomes(prop.name, component)
      });
    });

    // Check for display patterns
    if (component.props.some(p => p.name === 'data' || p.name === 'items')) {
      patterns.push({
        type: 'display',
        description: 'Display data to user',
        triggers: ['Data prop change', 'Component mount'],
        outcomes: ['Render updated view', 'Show information to user']
      });
    }

    // Check for navigation patterns
    const componentFile = this.projectGraph.files.find(f => f.path === component.filePath);
    if (componentFile && (componentFile as any).imports &&
        (componentFile as any).imports.some((imp: any) => imp.source && imp.source.includes('router'))) {
      patterns.push({
        type: 'navigation',
        description: 'Handle navigation between views',
        triggers: ['User click', 'Programmatic navigation'],
        outcomes: ['Route change', 'View update']
      });
    }

    // Check for state management patterns
    if (component.hooks.some(h => h.name === 'useState' || h.name === 'useReducer')) {
      patterns.push({
        type: 'state_management',
        description: 'Manage component state',
        triggers: ['User interaction', 'Data updates'],
        outcomes: ['State change', 'Re-render', 'Side effects']
      });
    }

    // Check for API patterns
    if (component.hooks.some(h => h.name === 'useEffect') &&
        componentFile && (componentFile as any).imports &&
        (componentFile as any).imports.some((imp: any) => imp.source && (imp.source.includes('api') || imp.source.includes('service')))) {
      patterns.push({
        type: 'api_call',
        description: 'Communicate with backend services',
        triggers: ['Component mount', 'User action', 'State change'],
        outcomes: ['Data fetch', 'Data mutation', 'Error handling']
      });
    }

    return patterns;
  }

  private analyzeDataFlow(component: ComponentInfo): DataFlowPattern {
    const inputs: DataInput[] = [];
    const transformations: DataTransformation[] = [];
    const outputs: DataOutput[] = [];
    const sideEffects: string[] = [];

    // Analyze inputs
    component.props.forEach(prop => {
      inputs.push({
        source: 'props',
        dataType: prop.type || 'unknown',
        purpose: this.inferPropPurpose(prop.name)
      });
    });

    if (component.hooks.some(h => h.name === 'useState')) {
      inputs.push({
        source: 'state',
        dataType: 'component state',
        purpose: 'Maintain component-specific data'
      });
    }

    if (component.hooks.some(h => h.name === 'useContext')) {
      inputs.push({
        source: 'context',
        dataType: 'shared state',
        purpose: 'Access application-wide data'
      });
    }

    // Analyze transformations
    if (component.hooks.some(h => h.name === 'useMemo')) {
      transformations.push({
        operation: 'Memoization',
        businessLogic: 'Optimize expensive computations',
        validation: []
      });
    }

    if (component.name.toLowerCase().includes('form')) {
      transformations.push({
        operation: 'Form validation',
        businessLogic: 'Ensure data integrity',
        validation: ['Required fields', 'Format validation', 'Business rules']
      });
    }

    // Analyze outputs
    if (component.props.some(p => p.name.startsWith('on'))) {
      outputs.push({
        destination: 'event',
        dataType: 'user action',
        effect: 'Trigger parent component handler'
      });
    }

    if (component.hooks.some(h => h.name === 'useState')) {
      outputs.push({
        destination: 'state_update',
        dataType: 'state mutation',
        effect: 'Update component state and trigger re-render'
      });
    }

    // Analyze side effects
    if (component.hooks.some(h => h.name === 'useEffect')) {
      sideEffects.push('Perform side effects on state/prop changes');
    }

    return { inputs, transformations, outputs, sideEffects };
  }

  private identifyBusinessFeatures(
    userStories: UserStory[],
    capabilities: BusinessCapability[]
  ): void {
    // Group components by business capability
    capabilities.forEach(capability => {
      const feature = this.createBusinessFeature(capability, userStories);
      this.businessGraph.features.push(feature);
    });

    // Identify additional features from component clusters
    this.identifyImplicitFeatures();
  }

  private createBusinessFeature(
    capability: BusinessCapability,
    userStories: UserStory[]
  ): BusinessFeature {
    const relatedStories = userStories.filter(s => capability.userStories.includes(s.id));
    const components = this.findRelatedComponents(capability);

    return {
      id: `feature-${capability.id}`,
      name: capability.name,
      description: capability.description,
      category: this.categorizeFeature(capability),
      components: components,
      userStories: capability.userStories,
      dataEntities: capability.dataEntities,
      businessValue: this.calculateBusinessValue(capability, relatedStories),
      technicalComplexity: this.calculateTechnicalComplexity(components),
      dependencies: this.identifyFeatureDependencies(capability),
      metrics: {
        codeLines: 0, // Would need actual line count
        componentCount: components.length,
        userInteractionPoints: this.countInteractionPoints(components),
        apiEndpoints: capability.operations.length,
        averageComplexity: this.calculateAverageComplexity(components)
      }
    };
  }

  private findRelatedComponents(capability: BusinessCapability): ComponentMapping[] {
    return capability.components
      .map(name => this.businessGraph.componentMappings.get(name))
      .filter(mapping => mapping !== undefined) as ComponentMapping[];
  }

  private categorizeFeature(capability: BusinessCapability): 'core' | 'supporting' | 'utility' {
    if (capability.businessValue === 'core') return 'core';
    if (capability.businessValue === 'supporting') return 'supporting';
    return 'utility';
  }

  private calculateBusinessValue(
    capability: BusinessCapability,
    stories: UserStory[]
  ): number {
    let value = 0;

    // Base value from capability
    if (capability.businessValue === 'core') value += 40;
    else if (capability.businessValue === 'supporting') value += 20;
    else value += 10;

    // Add value from story priorities
    stories.forEach(story => {
      if (story.priority === 'critical') value += 10;
      else if (story.priority === 'high') value += 7;
      else if (story.priority === 'medium') value += 4;
      else value += 1;
    });

    // Cap at 100
    return Math.min(100, value);
  }

  private calculateTechnicalComplexity(components: ComponentMapping[]): number {
    let complexity = 0;

    components.forEach(comp => {
      // Add complexity based on component type
      if (comp.componentType === 'hybrid') complexity += 15;
      else if (comp.componentType === 'container') complexity += 10;
      else if (comp.componentType === 'functional') complexity += 5;
      else complexity += 3;

      // Add complexity for interaction patterns
      complexity += comp.interactionPatterns.length * 3;

      // Add complexity for data flow
      complexity += comp.dataFlow.inputs.length * 2;
      complexity += comp.dataFlow.transformations.length * 5;
    });

    return Math.min(100, complexity);
  }

  private identifyFeatureDependencies(capability: BusinessCapability): FeatureDependency[] {
    const dependencies: FeatureDependency[] = [];

    // Check for common dependencies
    if (capability.name.includes('User') || capability.name.includes('Auth')) {
      // Most features depend on authentication
    } else {
      dependencies.push({
        featureId: 'feature-user-auth',
        dependencyType: 'requires',
        reason: 'Requires user authentication'
      });
    }

    return dependencies;
  }

  private countInteractionPoints(components: ComponentMapping[]): number {
    return components.reduce((count, comp) => {
      return count + comp.interactionPatterns.filter(p => p.type === 'user_input').length;
    }, 0);
  }

  private calculateAverageComplexity(components: ComponentMapping[]): number {
    if (components.length === 0) return 0;

    const totalComplexity = components.reduce((sum, comp) => {
      let complexity = 0;
      if (comp.componentType === 'hybrid') complexity = 8;
      else if (comp.componentType === 'container') complexity = 6;
      else if (comp.componentType === 'functional') complexity = 3;
      else complexity = 1;

      return sum + complexity;
    }, 0);

    return totalComplexity / components.length;
  }

  private identifyImplicitFeatures(): void {
    // Find components not assigned to any feature
    const assignedComponents = new Set<string>();
    this.businessGraph.features.forEach(feature => {
      feature.components.forEach(comp => {
        assignedComponents.add(comp.componentName);
      });
    });

    const unassignedComponents = Array.from(this.businessGraph.componentMappings.values())
      .filter(comp => !assignedComponents.has(comp.componentName));

    // Group unassigned components into implicit features
    if (unassignedComponents.length > 0) {
      const implicitFeature: BusinessFeature = {
        id: 'feature-ui-infrastructure',
        name: 'UI Infrastructure',
        description: 'Common UI components and utilities',
        category: 'utility',
        components: unassignedComponents,
        userStories: [],
        dataEntities: [],
        businessValue: 20,
        technicalComplexity: 30,
        dependencies: [],
        metrics: {
          codeLines: 0,
          componentCount: unassignedComponents.length,
          userInteractionPoints: this.countInteractionPoints(unassignedComponents),
          apiEndpoints: 0,
          averageComplexity: this.calculateAverageComplexity(unassignedComponents)
        }
      };

      this.businessGraph.features.push(implicitFeature);
    }
  }

  private createFeatureRelationships(): void {
    const features = this.businessGraph.features;

    features.forEach(feature1 => {
      features.forEach(feature2 => {
        if (feature1.id === feature2.id) return;

        const relationship = this.analyzeFeatureRelationship(feature1, feature2);
        if (relationship) {
          this.businessGraph.featureRelationships.push(relationship);
        }
      });
    });
  }

  private analyzeFeatureRelationship(
    feature1: BusinessFeature,
    feature2: BusinessFeature
  ): FeatureRelationship | null {
    // Check for dependencies
    const hasDependency = feature1.dependencies.some(d => d.featureId === feature2.id);
    if (hasDependency) {
      return {
        from: feature1.id,
        to: feature2.id,
        relationshipType: 'depends_on',
        strength: 0.8,
        description: `${feature1.name} depends on ${feature2.name}`
      };
    }

    // Check for shared components
    const sharedComponents = feature1.components.filter(c1 =>
      feature2.components.some(c2 => c1.componentName === c2.componentName)
    );

    if (sharedComponents.length > 0) {
      return {
        from: feature1.id,
        to: feature2.id,
        relationshipType: 'complements',
        strength: sharedComponents.length / Math.max(feature1.components.length, feature2.components.length),
        description: `Features share ${sharedComponents.length} component(s)`
      };
    }

    // Check for shared data entities
    const sharedEntities = feature1.dataEntities.filter(e =>
      feature2.dataEntities.includes(e)
    );

    if (sharedEntities.length > 0) {
      return {
        from: feature1.id,
        to: feature2.id,
        relationshipType: 'complements',
        strength: 0.5,
        description: `Features operate on shared data: ${sharedEntities.join(', ')}`
      };
    }

    return null;
  }

  private identifyBusinessDomains(): void {
    // Group features into domains based on naming and relationships
    const domainClusters = this.clusterFeaturesByDomain();

    domainClusters.forEach((features, domainName) => {
      const domain: BusinessDomain = {
        id: `domain-${domainName.toLowerCase().replace(/\s+/g, '-')}`,
        name: domainName,
        description: `Business domain for ${domainName.toLowerCase()} capabilities`,
        features: features.map(f => f.id),
        coreComponents: this.identifyCoreComponents(features),
        boundaryComponents: this.identifyBoundaryComponents(features),
        domainLanguage: this.extractDomainLanguage(features)
      };

      this.businessGraph.businessDomains.push(domain);
    });
  }

  private clusterFeaturesByDomain(): Map<string, BusinessFeature[]> {
    const clusters = new Map<string, BusinessFeature[]>();

    this.businessGraph.features.forEach(feature => {
      // Simple clustering by name patterns
      let domain = 'General';

      if (feature.name.includes('User') || feature.name.includes('Auth')) {
        domain = 'User Management';
      } else if (feature.name.includes('Todo') || feature.name.includes('Task')) {
        domain = 'Task Management';
      } else if (feature.name.includes('Dashboard') || feature.name.includes('Analytics')) {
        domain = 'Analytics';
      } else if (feature.name.includes('UI') || feature.name.includes('Infrastructure')) {
        domain = 'Infrastructure';
      }

      const existing = clusters.get(domain) || [];
      existing.push(feature);
      clusters.set(domain, existing);
    });

    return clusters;
  }

  private identifyCoreComponents(features: BusinessFeature[]): string[] {
    // Components that appear in multiple features are core to the domain
    const componentCounts = new Map<string, number>();

    features.forEach(feature => {
      feature.components.forEach(comp => {
        const count = componentCounts.get(comp.componentName) || 0;
        componentCounts.set(comp.componentName, count + 1);
      });
    });

    return Array.from(componentCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, _]) => name);
  }

  private identifyBoundaryComponents(features: BusinessFeature[]): string[] {
    // Components that interact with external systems or other domains
    const boundaryComponents: string[] = [];

    features.forEach(feature => {
      feature.components.forEach(comp => {
        if (comp.interactionPatterns.some(p => p.type === 'api_call')) {
          boundaryComponents.push(comp.componentName);
        }
      });
    });

    return [...new Set(boundaryComponents)];
  }

  private extractDomainLanguage(features: BusinessFeature[]): DomainTerm[] {
    const terms: DomainTerm[] = [];

    // Extract terms from feature and component names
    features.forEach(feature => {
      const featureTerm: DomainTerm = {
        term: feature.name,
        technicalMapping: feature.id,
        componentReferences: feature.components.map(c => c.componentName),
        description: feature.description
      };
      terms.push(featureTerm);

      // Extract terms from data entities
      feature.dataEntities.forEach(entity => {
        terms.push({
          term: entity,
          technicalMapping: `entity-${entity.toLowerCase()}`,
          componentReferences: feature.components
            .filter(c => c.businessPurpose.includes(entity))
            .map(c => c.componentName),
          description: `Data entity representing ${entity.toLowerCase()}`
        });
      });
    });

    return terms;
  }

  private calculateFeatureMetrics(): void {
    // Update metrics for each feature
    this.businessGraph.features.forEach(feature => {
      feature.metrics.codeLines = this.estimateCodeLines(feature);
      feature.metrics.componentCount = feature.components.length;
      feature.metrics.userInteractionPoints = this.countInteractionPoints(feature.components);
      feature.metrics.averageComplexity = this.calculateAverageComplexity(feature.components);
    });
  }

  private estimateCodeLines(feature: BusinessFeature): number {
    // Rough estimation based on component complexity
    return feature.components.reduce((total, comp) => {
      let lines = 50; // Base lines per component

      if (comp.componentType === 'hybrid') lines += 150;
      else if (comp.componentType === 'container') lines += 100;
      else if (comp.componentType === 'functional') lines += 50;

      lines += comp.interactionPatterns.length * 20;
      lines += comp.dataFlow.transformations.length * 30;

      return total + lines;
    }, 0);
  }

  private humanizeEventName(eventName: string): string {
    return eventName
      .replace(/^on/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
  }

  private inferEventOutcomes(eventName: string, component: ComponentInfo): string[] {
    const outcomes: string[] = [];

    if (eventName.includes('Submit')) {
      outcomes.push('Form submission', 'Data validation', 'API call');
    } else if (eventName.includes('Click')) {
      outcomes.push('State update', 'Navigation', 'Action trigger');
    } else if (eventName.includes('Change')) {
      outcomes.push('Input update', 'Validation', 'State change');
    }

    return outcomes;
  }

  private inferPropPurpose(propName: string): string {
    const purposeMap: Record<string, string> = {
      'data': 'Provide data for display',
      'items': 'Supply collection for rendering',
      'value': 'Current value or state',
      'onChange': 'Handle value changes',
      'onSubmit': 'Handle form submission',
      'onClick': 'Handle user clicks',
      'loading': 'Indicate loading state',
      'error': 'Display error state',
      'disabled': 'Control interaction availability'
    };

    return purposeMap[propName] || `Support ${propName} functionality`;
  }
}