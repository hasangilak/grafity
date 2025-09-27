import { ComponentInfo, FunctionInfo, FileInfo, ProjectGraph } from '../../types';

export interface UserStory {
  id: string;
  title: string;
  description: string;
  persona: string;
  action: string;
  benefit: string;
  acceptanceCriteria: string[];
  sourceComponents: string[];
  sourceFunctions: string[];
  confidence: number; // 0-1, how confident we are in this inference
  storyType: 'crud' | 'interaction' | 'navigation' | 'validation' | 'integration';
  businessCapability: string;
  complexity: 'simple' | 'medium' | 'complex';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface BusinessCapability {
  id: string;
  name: string;
  description: string;
  userStories: string[]; // IDs of user stories
  components: string[]; // Component names
  dataEntities: string[]; // Extracted from types/interfaces
  operations: BusinessOperation[];
  businessValue: 'core' | 'supporting' | 'generic';
}

export interface BusinessOperation {
  name: string;
  type: 'create' | 'read' | 'update' | 'delete' | 'process' | 'validate' | 'notify';
  entity: string;
  trigger: 'user_action' | 'system_event' | 'scheduled' | 'external';
  businessRules: string[];
  implementedBy: string[]; // Function/component names
}

export interface ExtractedBusinessContext {
  userStories: UserStory[];
  capabilities: BusinessCapability[];
  personas: UserPersona[];
  dataModel: DataEntity[];
  businessRules: BusinessRule[];
}

export interface UserPersona {
  id: string;
  name: string;
  description: string;
  goals: string[];
  frustrations: string[];
  capabilities: string[]; // What they can do in the system
  inferredFromComponents: string[];
}

export interface DataEntity {
  name: string;
  attributes: string[];
  relationships: EntityRelationship[];
  operations: string[]; // CRUD operations available
  businessPurpose: string;
  sourceFiles: string[];
}

export interface EntityRelationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  relationshipName: string;
}

export interface BusinessRule {
  id: string;
  description: string;
  category: 'validation' | 'calculation' | 'workflow' | 'authorization';
  implementation: string[];
  affectedEntities: string[];
  conditions: string[];
  actions: string[];
}

export class BusinessStoryExtractor {
  private projectGraph: ProjectGraph;
  private extractedContext: ExtractedBusinessContext;

  constructor(projectGraph: ProjectGraph) {
    this.projectGraph = projectGraph;
    this.extractedContext = {
      userStories: [],
      capabilities: [],
      personas: [],
      dataModel: [],
      businessRules: []
    };
  }

  public async extractBusinessContext(): Promise<ExtractedBusinessContext> {
    // Extract data entities from TypeScript types
    this.extractDataEntities();

    // Infer user personas from UI components and contexts
    this.inferUserPersonas();

    // Extract user stories from component patterns
    this.extractUserStoriesFromComponents();

    // Extract user stories from API/service patterns
    this.extractUserStoriesFromServices();

    // Identify business capabilities
    this.identifyBusinessCapabilities();

    // Extract business rules from validation and logic
    this.extractBusinessRules();

    // Connect and enrich the extracted context
    this.enrichBusinessContext();

    return this.extractedContext;
  }

  private extractDataEntities(): void {
    // Look for TypeScript interfaces and types that represent business entities
    const typeFiles = this.projectGraph.files
      .filter(file => file.path.includes('types') || file.path.includes('models'));

    typeFiles.forEach(file => {
      // Extract interfaces and types
      const entityPattern = /interface\s+(\w+)|type\s+(\w+)\s*=/g;
      const matches = file.path.match(entityPattern) || [];

      matches.forEach(match => {
        const entityName = match.replace(/interface\s+|type\s+|=/g, '').trim();

        // Skip utility types
        if (this.isUtilityType(entityName)) return;

        const entity: DataEntity = {
          name: entityName,
          attributes: this.extractEntityAttributes(entityName, file),
          relationships: this.extractEntityRelationships(entityName),
          operations: this.findEntityOperations(entityName),
          businessPurpose: this.inferBusinessPurpose(entityName),
          sourceFiles: [file.path]
        };

        this.extractedContext.dataModel.push(entity);
      });
    });
  }

  private inferUserPersonas(): void {
    // Look for user-related components and contexts
    const userComponents = this.projectGraph.components
      .filter(comp => this.isUserRelatedComponent(comp.name));

    // Extract from UserContext if exists
    const userContext = this.projectGraph.files
      .find(file => file.path.includes('UserContext'));

    if (userContext) {
      const persona: UserPersona = {
        id: 'authenticated-user',
        name: 'Authenticated User',
        description: 'A logged-in user with access to application features',
        goals: [],
        frustrations: [],
        capabilities: [],
        inferredFromComponents: userComponents.map(c => c.name)
      };

      // Infer capabilities from component names
      userComponents.forEach(comp => {
        const capability = this.inferCapabilityFromComponent(comp);
        if (capability) {
          persona.capabilities.push(capability);
        }
      });

      this.extractedContext.personas.push(persona);
    }

    // Check for admin/guest patterns
    this.checkForAdminPersona();
    this.checkForGuestPersona();
  }

  private extractUserStoriesFromComponents(): void {
    this.projectGraph.components.forEach(component => {
      // Extract CRUD stories from component patterns
      const crudStories = this.extractCRUDStories(component);
      this.extractedContext.userStories.push(...crudStories);

      // Extract interaction stories from event handlers
      const interactionStories = this.extractInteractionStories(component);
      this.extractedContext.userStories.push(...interactionStories);

      // Extract navigation stories from routing
      const navigationStories = this.extractNavigationStories(component);
      this.extractedContext.userStories.push(...navigationStories);
    });
  }

  private extractCRUDStories(component: ComponentInfo): UserStory[] {
    const stories: UserStory[] = [];
    const componentName = component.name.toLowerCase();

    // Pattern matching for CRUD operations
    const crudPatterns = {
      create: ['create', 'add', 'new', 'submit', 'post'],
      read: ['list', 'view', 'display', 'show', 'get'],
      update: ['edit', 'update', 'modify', 'change', 'put', 'patch'],
      delete: ['delete', 'remove', 'destroy', 'cancel']
    };

    Object.entries(crudPatterns).forEach(([operation, patterns]) => {
      patterns.forEach(pattern => {
        if (componentName.includes(pattern) ||
            component.props.some(p => p.name.toLowerCase().includes(pattern)) ||
            component.hooks.some(h => h.name.toLowerCase().includes(pattern))) {

          const entity = this.extractEntityFromComponent(component);
          const story: UserStory = {
            id: `story-${component.name}-${operation}-${Date.now()}`,
            title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} ${entity}`,
            description: `User can ${operation} ${entity.toLowerCase()} in the system`,
            persona: 'authenticated-user',
            action: `${operation} ${entity.toLowerCase()}`,
            benefit: this.inferBenefit(operation, entity),
            acceptanceCriteria: this.generateAcceptanceCriteria(operation, entity),
            sourceComponents: [component.name],
            sourceFunctions: component.hooks.map(h => h.name),
            confidence: 0.8,
            storyType: 'crud',
            businessCapability: `${entity} Management`,
            complexity: this.assessComplexity(component),
            priority: this.assessPriority(operation, entity)
          };

          stories.push(story);
        }
      });
    });

    return stories;
  }

  private extractInteractionStories(component: ComponentInfo): UserStory[] {
    const stories: UserStory[] = [];

    // Look for event handlers (onClick, onSubmit, onChange, etc.)
    const eventHandlerPattern = /on[A-Z]\w+/;
    const eventHandlers = component.props.filter(p => eventHandlerPattern.test(p.name));

    eventHandlers.forEach(handler => {
      const action = this.extractActionFromHandler(handler.name);
      const entity = this.extractEntityFromComponent(component);

      const story: UserStory = {
        id: `story-interaction-${component.name}-${handler.name}-${Date.now()}`,
        title: `User ${action} on ${entity}`,
        description: `User can ${action.toLowerCase()} to interact with ${entity.toLowerCase()}`,
        persona: 'authenticated-user',
        action: action.toLowerCase(),
        benefit: `Provides interactive control over ${entity.toLowerCase()}`,
        acceptanceCriteria: [
          `User can ${action.toLowerCase()} successfully`,
          `System provides feedback after ${action.toLowerCase()}`,
          `Action results in expected state change`
        ],
        sourceComponents: [component.name],
        sourceFunctions: [handler.name],
        confidence: 0.7,
        storyType: 'interaction',
        businessCapability: `${entity} Interaction`,
        complexity: 'simple',
        priority: 'medium'
      };

      stories.push(story);
    });

    return stories;
  }

  private extractNavigationStories(component: ComponentInfo): UserStory[] {
    const stories: UserStory[] = [];

    // Look for routing patterns in the file that contains this component
    const routePatterns = ['Route', 'Link', 'navigate', 'redirect'];
    const componentFile = this.projectGraph.files.find(f => f.path === component.filePath);
    const hasRouting = componentFile && (componentFile as any).imports &&
      (componentFile as any).imports.some((imp: any) =>
        routePatterns.some(pattern => imp.source && imp.source.includes(pattern))
      );

    if (hasRouting) {
      const story: UserStory = {
        id: `story-nav-${component.name}-${Date.now()}`,
        title: `Navigate to ${component.name}`,
        description: `User can navigate to ${component.name} page/view`,
        persona: 'authenticated-user',
        action: `navigate to ${component.name}`,
        benefit: `Access ${component.name} functionality`,
        acceptanceCriteria: [
          `Navigation link/button is visible`,
          `Clicking navigates to correct page`,
          `Page loads successfully`,
          `User can navigate back`
        ],
        sourceComponents: [component.name],
        sourceFunctions: [],
        confidence: 0.6,
        storyType: 'navigation',
        businessCapability: 'Navigation',
        complexity: 'simple',
        priority: 'low'
      };

      stories.push(story);
    }

    return stories;
  }

  private extractUserStoriesFromServices(): void {
    // Look for service/API files
    const serviceFiles = this.projectGraph.files
      .filter(file => file.path.includes('service') || file.path.includes('api'));

    serviceFiles.forEach(file => {
      const functions = this.projectGraph.functions
        .filter(func => func.filePath === file.path);

      functions.forEach(func => {
        const story = this.extractStoryFromServiceFunction(func);
        if (story) {
          this.extractedContext.userStories.push(story);
        }
      });
    });
  }

  private extractStoryFromServiceFunction(func: FunctionInfo): UserStory | null {
    const funcName = func.name.toLowerCase();

    // API patterns
    const apiPatterns = {
      get: { action: 'retrieve', type: 'read' },
      post: { action: 'create', type: 'create' },
      put: { action: 'update', type: 'update' },
      patch: { action: 'modify', type: 'update' },
      delete: { action: 'remove', type: 'delete' }
    };

    for (const [pattern, info] of Object.entries(apiPatterns)) {
      if (funcName.includes(pattern)) {
        const entity = this.extractEntityFromFunction(func);

        return {
          id: `story-service-${func.name}-${Date.now()}`,
          title: `${info.action} ${entity} via API`,
          description: `System can ${info.action} ${entity.toLowerCase()} through API`,
          persona: 'system',
          action: `${info.action} ${entity.toLowerCase()}`,
          benefit: `Enables ${entity.toLowerCase()} ${info.type} operations`,
          acceptanceCriteria: [
            `API endpoint is accessible`,
            `Request validation is performed`,
            `Response includes expected data`,
            `Error handling is implemented`
          ],
          sourceComponents: [],
          sourceFunctions: [func.name],
          confidence: 0.75,
          storyType: 'integration',
          businessCapability: `${entity} API`,
          complexity: 'medium',
          priority: 'high'
        };
      }
    }

    return null;
  }

  private identifyBusinessCapabilities(): void {
    // Group user stories by business capability
    const capabilityMap = new Map<string, UserStory[]>();

    this.extractedContext.userStories.forEach(story => {
      const existing = capabilityMap.get(story.businessCapability) || [];
      existing.push(story);
      capabilityMap.set(story.businessCapability, existing);
    });

    // Create business capabilities
    capabilityMap.forEach((stories, capabilityName) => {
      const capability: BusinessCapability = {
        id: `cap-${capabilityName.replace(/\s+/g, '-').toLowerCase()}`,
        name: capabilityName,
        description: this.generateCapabilityDescription(capabilityName, stories),
        userStories: stories.map(s => s.id),
        components: [...new Set(stories.flatMap(s => s.sourceComponents))],
        dataEntities: this.findRelatedEntities(capabilityName),
        operations: this.extractOperations(stories),
        businessValue: this.assessBusinessValue(capabilityName, stories)
      };

      this.extractedContext.capabilities.push(capability);
    });
  }

  private extractBusinessRules(): void {
    // Look for validation patterns
    const validationFunctions = this.projectGraph.functions
      .filter(func => this.isValidationFunction(func));

    validationFunctions.forEach(func => {
      const rule: BusinessRule = {
        id: `rule-${func.name}-${Date.now()}`,
        description: this.inferRuleDescription(func),
        category: 'validation',
        implementation: [func.name],
        affectedEntities: this.findAffectedEntities(func),
        conditions: this.extractConditions(func),
        actions: this.extractActions(func)
      };

      this.extractedContext.businessRules.push(rule);
    });

    // Look for workflow patterns (if/else chains, state machines)
    this.extractWorkflowRules();

    // Look for authorization patterns
    this.extractAuthorizationRules();
  }

  private enrichBusinessContext(): void {
    // Connect user stories to personas
    this.extractedContext.userStories.forEach(story => {
      const persona = this.extractedContext.personas.find(p => p.id === story.persona);
      if (persona && !persona.goals.includes(story.title)) {
        persona.goals.push(story.title);
      }
    });

    // Add relationships between entities
    this.extractedContext.dataModel.forEach(entity => {
      // Look for foreign key patterns
      entity.attributes.forEach(attr => {
        const relatedEntity = this.extractedContext.dataModel.find(e =>
          attr.toLowerCase().includes(e.name.toLowerCase() + 'id')
        );

        if (relatedEntity) {
          entity.relationships.push({
            from: entity.name,
            to: relatedEntity.name,
            type: 'one-to-many',
            relationshipName: `${entity.name}-has-${relatedEntity.name}`
          });
        }
      });
    });

    // Score and prioritize user stories
    this.scoreUserStories();
  }

  // Helper methods
  private isUtilityType(name: string): boolean {
    const utilityTypes = ['Props', 'State', 'Options', 'Config', 'Response', 'Request'];
    return utilityTypes.some(util => name.includes(util));
  }

  private extractEntityAttributes(entityName: string, file: FileInfo): string[] {
    // This would need actual AST parsing for accuracy
    // For now, return placeholder attributes
    return ['id', 'name', 'createdAt', 'updatedAt'];
  }

  private extractEntityRelationships(entityName: string): EntityRelationship[] {
    return [];
  }

  private findEntityOperations(entityName: string): string[] {
    const operations: string[] = [];

    // Look for functions that operate on this entity
    this.projectGraph.functions.forEach(func => {
      if (func.name.toLowerCase().includes(entityName.toLowerCase())) {
        operations.push(func.name);
      }
    });

    return operations;
  }

  private inferBusinessPurpose(entityName: string): string {
    const purposeMap: Record<string, string> = {
      'User': 'Represents system users and their authentication',
      'Todo': 'Represents tasks or items to be completed',
      'Product': 'Represents items available for purchase',
      'Order': 'Represents customer purchase transactions',
      'Dashboard': 'Provides overview and analytics'
    };

    return purposeMap[entityName] || `Manages ${entityName} data and operations`;
  }

  private isUserRelatedComponent(componentName: string): boolean {
    const userPatterns = ['User', 'Profile', 'Account', 'Auth', 'Login', 'Register'];
    return userPatterns.some(pattern => componentName.includes(pattern));
  }

  private inferCapabilityFromComponent(component: ComponentInfo): string {
    const name = component.name.toLowerCase();

    if (name.includes('profile')) return 'View and edit profile';
    if (name.includes('todo') || name.includes('task')) return 'Manage tasks';
    if (name.includes('dashboard')) return 'View dashboard and analytics';
    if (name.includes('settings')) return 'Configure application settings';

    return `Interact with ${component.name}`;
  }

  private checkForAdminPersona(): void {
    const adminComponents = this.projectGraph.components
      .filter(comp => comp.name.toLowerCase().includes('admin'));

    if (adminComponents.length > 0) {
      this.extractedContext.personas.push({
        id: 'admin-user',
        name: 'Administrator',
        description: 'System administrator with elevated privileges',
        goals: ['Manage users', 'Configure system', 'View analytics', 'Monitor system health'],
        frustrations: ['Complex configuration', 'Lack of automation'],
        capabilities: ['Full system access', 'User management', 'System configuration'],
        inferredFromComponents: adminComponents.map(c => c.name)
      });
    }
  }

  private checkForGuestPersona(): void {
    const publicComponents = this.projectGraph.components
      .filter(comp => !this.requiresAuth(comp));

    if (publicComponents.length > 0) {
      this.extractedContext.personas.push({
        id: 'guest-user',
        name: 'Guest User',
        description: 'Unauthenticated visitor',
        goals: ['Browse public content', 'Learn about the application', 'Sign up'],
        frustrations: ['Limited access', 'Registration required'],
        capabilities: ['View public content', 'Register account'],
        inferredFromComponents: publicComponents.map(c => c.name)
      });
    }
  }

  private requiresAuth(component: ComponentInfo): boolean {
    // Check if component uses auth context or has auth checks
    return component.hooks.some(h => h.name.includes('useUser') || h.name.includes('useAuth'));
  }

  private extractEntityFromComponent(component: ComponentInfo): string {
    const name = component.name;

    // Remove common prefixes/suffixes
    const cleaned = name
      .replace(/^(Create|Edit|Delete|View|List)/, '')
      .replace(/(List|Form|Item|Page|View|Component)$/, '');

    return cleaned || 'Entity';
  }

  private inferBenefit(operation: string, entity: string): string {
    const benefits: Record<string, string> = {
      create: `Add new ${entity.toLowerCase()} to the system`,
      read: `View and access ${entity.toLowerCase()} information`,
      update: `Keep ${entity.toLowerCase()} information current`,
      delete: `Remove unnecessary ${entity.toLowerCase()} from the system`
    };

    return benefits[operation] || `Perform ${operation} on ${entity.toLowerCase()}`;
  }

  private generateAcceptanceCriteria(operation: string, entity: string): string[] {
    const criteria: Record<string, string[]> = {
      create: [
        `User can access ${entity} creation form`,
        `All required fields are validated`,
        `Success message is displayed after creation`,
        `New ${entity} appears in the list`
      ],
      read: [
        `${entity} data is displayed correctly`,
        `Loading state is shown while fetching`,
        `Error handling for failed requests`,
        `Data is formatted appropriately`
      ],
      update: [
        `Current ${entity} data is pre-populated`,
        `Changes are validated before saving`,
        `Success confirmation after update`,
        `Updated data is reflected immediately`
      ],
      delete: [
        `Confirmation prompt before deletion`,
        `Success message after deletion`,
        `${entity} is removed from all views`,
        `Related data is handled appropriately`
      ]
    };

    return criteria[operation] || [`${operation} operation completes successfully`];
  }

  private assessComplexity(component: ComponentInfo): 'simple' | 'medium' | 'complex' {
    const hookCount = component.hooks.length;
    const propCount = component.props.length;

    if (hookCount > 5 || propCount > 10) return 'complex';
    if (hookCount > 2 || propCount > 5) return 'medium';
    return 'simple';
  }

  private assessPriority(operation: string, entity: string): 'low' | 'medium' | 'high' | 'critical' {
    // Core entities get higher priority
    const coreEntities = ['User', 'Auth', 'Payment', 'Order'];

    if (coreEntities.some(core => entity.includes(core))) {
      return operation === 'create' || operation === 'read' ? 'critical' : 'high';
    }

    if (operation === 'delete') return 'low';
    if (operation === 'create' || operation === 'read') return 'medium';
    return 'low';
  }

  private extractActionFromHandler(handlerName: string): string {
    const action = handlerName.replace(/^on/, '');
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  private extractEntityFromFunction(func: FunctionInfo): string {
    const name = func.name;

    // Extract entity from function name patterns
    const patterns = [
      /get(\w+)/i,
      /create(\w+)/i,
      /update(\w+)/i,
      /delete(\w+)/i,
      /fetch(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return 'Entity';
  }

  private generateCapabilityDescription(name: string, stories: UserStory[]): string {
    const operations = stories.map(s => s.action).join(', ');
    return `Provides capability to ${operations} for ${name.toLowerCase()}`;
  }

  private findRelatedEntities(capabilityName: string): string[] {
    return this.extractedContext.dataModel
      .filter(entity => capabilityName.toLowerCase().includes(entity.name.toLowerCase()))
      .map(e => e.name);
  }

  private extractOperations(stories: UserStory[]): BusinessOperation[] {
    return stories.map(story => ({
      name: story.action,
      type: this.mapStoryTypeToOperationType(story.storyType),
      entity: this.extractEntityFromStory(story),
      trigger: 'user_action' as const,
      businessRules: [],
      implementedBy: [...story.sourceComponents, ...story.sourceFunctions]
    }));
  }

  private mapStoryTypeToOperationType(storyType: string): BusinessOperation['type'] {
    const typeMap: Record<string, BusinessOperation['type']> = {
      crud: 'process',
      interaction: 'process',
      navigation: 'read',
      validation: 'validate',
      integration: 'process'
    };

    return typeMap[storyType] || 'process';
  }

  private extractEntityFromStory(story: UserStory): string {
    const words = story.title.split(' ');
    return words[words.length - 1] || 'Entity';
  }

  private assessBusinessValue(name: string, stories: UserStory[]): 'core' | 'supporting' | 'generic' {
    const coreKeywords = ['User', 'Auth', 'Payment', 'Order', 'Product'];

    if (coreKeywords.some(keyword => name.includes(keyword))) {
      return 'core';
    }

    if (stories.some(s => s.priority === 'critical' || s.priority === 'high')) {
      return 'core';
    }

    if (stories.length > 5) {
      return 'supporting';
    }

    return 'generic';
  }

  private isValidationFunction(func: FunctionInfo): boolean {
    const name = func.name.toLowerCase();
    return name.includes('validate') || name.includes('check') || name.includes('verify');
  }

  private inferRuleDescription(func: FunctionInfo): string {
    const name = func.name;
    return `Business rule implemented by ${name}`;
  }

  private findAffectedEntities(func: FunctionInfo): string[] {
    return this.extractedContext.dataModel
      .filter(entity => func.name.toLowerCase().includes(entity.name.toLowerCase()))
      .map(e => e.name);
  }

  private extractConditions(func: FunctionInfo): string[] {
    // Would need AST analysis for actual conditions
    return [`Conditions defined in ${func.name}`];
  }

  private extractActions(func: FunctionInfo): string[] {
    // Would need AST analysis for actual actions
    return [`Actions performed by ${func.name}`];
  }

  private extractWorkflowRules(): void {
    // Look for state management and workflow patterns
    const workflowComponents = this.projectGraph.components
      .filter(comp => comp.hooks.some(h => h.name === 'useState' || h.name === 'useReducer'));

    workflowComponents.forEach(comp => {
      const rule: BusinessRule = {
        id: `rule-workflow-${comp.name}-${Date.now()}`,
        description: `Workflow logic in ${comp.name}`,
        category: 'workflow',
        implementation: [comp.name],
        affectedEntities: [],
        conditions: ['State transitions defined in component'],
        actions: ['Update component state', 'Trigger side effects']
      };

      this.extractedContext.businessRules.push(rule);
    });
  }

  private extractAuthorizationRules(): void {
    // Look for auth checks
    const authFunctions = this.projectGraph.functions
      .filter(func => func.name.toLowerCase().includes('auth') ||
                     func.name.toLowerCase().includes('permission'));

    authFunctions.forEach(func => {
      const rule: BusinessRule = {
        id: `rule-auth-${func.name}-${Date.now()}`,
        description: `Authorization check in ${func.name}`,
        category: 'authorization',
        implementation: [func.name],
        affectedEntities: ['User'],
        conditions: ['User authentication status', 'User role/permissions'],
        actions: ['Grant access', 'Deny access', 'Redirect to login']
      };

      this.extractedContext.businessRules.push(rule);
    });
  }

  private scoreUserStories(): void {
    this.extractedContext.userStories.forEach(story => {
      // Adjust confidence based on evidence
      let confidenceBoost = 0;

      // More source components/functions = higher confidence
      confidenceBoost += (story.sourceComponents.length * 0.05);
      confidenceBoost += (story.sourceFunctions.length * 0.05);

      // Adjust priority based on business capability value
      const capability = this.extractedContext.capabilities.find(c =>
        c.userStories.includes(story.id)
      );

      if (capability?.businessValue === 'core') {
        story.priority = story.priority === 'low' ? 'medium' :
                        story.priority === 'medium' ? 'high' : story.priority;
      }

      story.confidence = Math.min(1, story.confidence + confidenceBoost);
    });
  }
}