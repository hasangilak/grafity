import {
  UserStory,
  BusinessCapability,
  DataEntity,
  BusinessRule,
  ExtractedBusinessContext
} from './BusinessStoryExtractor';
import {
  BusinessFeature,
  ComponentMapping,
  BusinessComponentGraph,
  BusinessDomain
} from './ComponentBusinessMapper';
import { UserJourney, UserJourneyMap } from './DataFlowToUserJourney';

export interface BusinessGraph {
  nodes: BusinessGraphNode[];
  edges: BusinessGraphEdge[];
  clusters: GraphCluster[];
  metadata: GraphMetadata;
}

export interface BusinessGraphNode {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  data: any; // Original data object (UserStory, Component, etc.)
  position?: { x: number; y: number };
  size?: number;
  color?: string;
  icon?: string;
  metrics?: NodeMetrics;
  tags?: string[];
}

export type NodeType =
  | 'user_story'
  | 'business_capability'
  | 'business_feature'
  | 'component'
  | 'data_entity'
  | 'user_journey'
  | 'business_rule'
  | 'user_persona'
  | 'api_endpoint'
  | 'integration_point';

export interface BusinessGraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label: string;
  weight: number; // 0-1, strength of relationship
  direction: 'unidirectional' | 'bidirectional';
  metadata?: EdgeMetadata;
  style?: EdgeStyle;
}

export type EdgeType =
  | 'implements'
  | 'uses'
  | 'depends_on'
  | 'extends'
  | 'triggers'
  | 'validates'
  | 'transforms'
  | 'navigates_to'
  | 'belongs_to'
  | 'requires';

export interface EdgeMetadata {
  confidence?: number;
  dataFlow?: string;
  businessRule?: string;
  frequency?: number;
  criticalPath?: boolean;
}

export interface EdgeStyle {
  strokeWidth?: number;
  strokeColor?: string;
  animated?: boolean;
  dashed?: boolean;
}

export interface GraphCluster {
  id: string;
  name: string;
  type: 'domain' | 'feature' | 'journey' | 'technical';
  nodes: string[];
  color?: string;
  collapsed?: boolean;
  metadata?: ClusterMetadata;
}

export interface ClusterMetadata {
  businessValue: number;
  complexity: number;
  completeness: number; // How much of the business domain is implemented
  riskLevel: 'low' | 'medium' | 'high';
}

export interface NodeMetrics {
  importance: number; // 0-100
  complexity: number; // 0-100
  connectivity: number; // Number of connections
  businessValue: number; // 0-100
  technicalDebt?: number; // 0-100
  coverage?: number; // Test coverage or implementation coverage
}

export interface GraphMetadata {
  title: string;
  description: string;
  generatedAt: Date;
  statistics: GraphStatistics;
  viewOptions: ViewOptions;
  legend: LegendItem[];
}

export interface GraphStatistics {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeType, number>;
  edgesByType: Record<EdgeType, number>;
  avgConnectivity: number;
  graphDensity: number;
  clusters: number;
  isolatedNodes: number;
}

export interface ViewOptions {
  layout: 'hierarchical' | 'force' | 'circular' | 'geographic';
  showLabels: boolean;
  showMetrics: boolean;
  filterByType?: NodeType[];
  highlightCriticalPaths: boolean;
  collapseThreshold?: number; // Collapse clusters with more than N nodes
}

export interface LegendItem {
  type: 'node' | 'edge';
  category: string;
  color?: string;
  icon?: string;
  description: string;
}

export interface GraphExportFormat {
  format: 'json' | 'graphml' | 'gexf' | 'cytoscape' | 'd3' | 'vis';
  includeMetadata: boolean;
  includePositions: boolean;
  prettyPrint?: boolean;
}

export class BusinessGraphBuilder {
  private graph: BusinessGraph;
  private nodeMap: Map<string, BusinessGraphNode>;
  private edgeMap: Map<string, BusinessGraphEdge>;

  constructor() {
    this.graph = {
      nodes: [],
      edges: [],
      clusters: [],
      metadata: {
        title: 'Business Context Graph',
        description: 'Reverse-engineered business context from codebase',
        generatedAt: new Date(),
        statistics: this.initializeStatistics(),
        viewOptions: this.getDefaultViewOptions(),
        legend: this.generateLegend()
      }
    };
    this.nodeMap = new Map();
    this.edgeMap = new Map();
  }

  public buildGraph(
    businessContext: ExtractedBusinessContext,
    componentGraph: BusinessComponentGraph,
    journeyMap: UserJourneyMap
  ): BusinessGraph {
    // Add nodes from different sources
    this.addUserStoryNodes(businessContext.userStories);
    this.addBusinessCapabilityNodes(businessContext.capabilities);
    this.addBusinessFeatureNodes(componentGraph.features);
    this.addComponentNodes(componentGraph.componentMappings);
    this.addDataEntityNodes(businessContext.dataModel);
    this.addUserJourneyNodes(journeyMap.journeys);
    this.addBusinessRuleNodes(businessContext.businessRules);
    this.addPersonaNodes(businessContext.personas);

    // Create edges based on relationships
    this.createUserStoryEdges(businessContext);
    this.createCapabilityEdges(businessContext);
    this.createFeatureEdges(componentGraph);
    this.createJourneyEdges(journeyMap);
    this.createDataFlowEdges(journeyMap);
    this.createBusinessRuleEdges(businessContext);

    // Create clusters
    this.createDomainClusters(componentGraph.businessDomains);
    this.createFeatureClusters(componentGraph.features);
    this.createJourneyClusters(journeyMap.journeys);

    // Calculate metrics
    this.calculateNodeMetrics();
    this.calculateGraphStatistics();

    // Apply layout
    this.applyLayout();

    return this.graph;
  }

  private addUserStoryNodes(userStories: UserStory[]): void {
    userStories.forEach(story => {
      const node: BusinessGraphNode = {
        id: story.id,
        type: 'user_story',
        label: story.title,
        description: story.description,
        data: story,
        color: this.getColorForPriority(story.priority),
        icon: 'story',
        metrics: {
          importance: this.calculateStoryImportance(story),
          complexity: story.complexity === 'complex' ? 80 :
                     story.complexity === 'medium' ? 50 : 20,
          connectivity: 0,
          businessValue: story.priority === 'critical' ? 100 :
                        story.priority === 'high' ? 75 :
                        story.priority === 'medium' ? 50 : 25
        },
        tags: [story.storyType, story.priority, story.businessCapability]
      };

      this.addNode(node);
    });
  }

  private addBusinessCapabilityNodes(capabilities: BusinessCapability[]): void {
    capabilities.forEach(capability => {
      const node: BusinessGraphNode = {
        id: capability.id,
        type: 'business_capability',
        label: capability.name,
        description: capability.description,
        data: capability,
        color: this.getColorForBusinessValue(capability.businessValue),
        icon: 'capability',
        metrics: {
          importance: capability.businessValue === 'core' ? 90 :
                     capability.businessValue === 'supporting' ? 60 : 30,
          complexity: capability.operations.length * 10,
          connectivity: 0,
          businessValue: capability.businessValue === 'core' ? 100 :
                        capability.businessValue === 'supporting' ? 60 : 30
        },
        tags: [capability.businessValue]
      };

      this.addNode(node);
    });
  }

  private addBusinessFeatureNodes(features: BusinessFeature[]): void {
    features.forEach(feature => {
      const node: BusinessGraphNode = {
        id: feature.id,
        type: 'business_feature',
        label: feature.name,
        description: feature.description,
        data: feature,
        color: this.getColorForCategory(feature.category),
        icon: 'feature',
        metrics: {
          importance: feature.businessValue,
          complexity: feature.technicalComplexity,
          connectivity: 0,
          businessValue: feature.businessValue
        },
        tags: [feature.category]
      };

      this.addNode(node);
    });
  }

  private addComponentNodes(componentMappings: Map<string, ComponentMapping>): void {
    componentMappings.forEach((mapping, componentName) => {
      const node: BusinessGraphNode = {
        id: `component-${componentName}`,
        type: 'component',
        label: componentName,
        description: mapping.businessPurpose,
        data: mapping,
        color: this.getColorForComponentType(mapping.componentType),
        icon: 'component',
        metrics: {
          importance: this.calculateComponentImportance(mapping),
          complexity: mapping.interactionPatterns.length * 10 +
                     mapping.dataFlow.transformations.length * 15,
          connectivity: 0,
          businessValue: 50 // Default, will be calculated based on connections
        },
        tags: [mapping.componentType]
      };

      this.addNode(node);
    });
  }

  private addDataEntityNodes(dataEntities: DataEntity[]): void {
    dataEntities.forEach(entity => {
      const node: BusinessGraphNode = {
        id: `entity-${entity.name}`,
        type: 'data_entity',
        label: entity.name,
        description: entity.businessPurpose,
        data: entity,
        color: '#4A90E2',
        icon: 'database',
        metrics: {
          importance: entity.operations.length * 15,
          complexity: entity.attributes.length * 5 +
                     entity.relationships.length * 10,
          connectivity: 0,
          businessValue: 60
        },
        tags: ['data']
      };

      this.addNode(node);
    });
  }

  private addUserJourneyNodes(journeys: UserJourney[]): void {
    journeys.forEach(journey => {
      const node: BusinessGraphNode = {
        id: journey.id,
        type: 'user_journey',
        label: journey.name,
        description: journey.goal,
        data: journey,
        color: '#9B59B6',
        icon: 'journey',
        metrics: {
          importance: 70,
          complexity: journey.metrics.complexity * 10,
          connectivity: 0,
          businessValue: this.calculateJourneyBusinessValue(journey)
        },
        tags: [journey.persona, journey.trigger.type]
      };

      this.addNode(node);
    });
  }

  private addBusinessRuleNodes(rules: BusinessRule[]): void {
    rules.forEach(rule => {
      const node: BusinessGraphNode = {
        id: rule.id,
        type: 'business_rule',
        label: rule.description,
        description: `${rule.category} rule affecting ${rule.affectedEntities.join(', ')}`,
        data: rule,
        color: '#E74C3C',
        icon: 'rule',
        metrics: {
          importance: rule.category === 'validation' ? 80 :
                     rule.category === 'authorization' ? 90 : 60,
          complexity: rule.conditions.length * 10 +
                     rule.actions.length * 5,
          connectivity: 0,
          businessValue: 70
        },
        tags: [rule.category]
      };

      this.addNode(node);
    });
  }

  private addPersonaNodes(personas: any[]): void {
    personas.forEach(persona => {
      const node: BusinessGraphNode = {
        id: persona.id,
        type: 'user_persona',
        label: persona.name,
        description: persona.description,
        data: persona,
        color: '#27AE60',
        icon: 'user',
        metrics: {
          importance: 80,
          complexity: 20,
          connectivity: 0,
          businessValue: 90
        },
        tags: ['persona']
      };

      this.addNode(node);
    });
  }

  private createUserStoryEdges(context: ExtractedBusinessContext): void {
    context.userStories.forEach(story => {
      // Connect to capability
      const capability = context.capabilities.find(cap =>
        cap.userStories.includes(story.id)
      );

      if (capability) {
        this.addEdge({
          id: `edge-${story.id}-${capability.id}`,
          source: story.id,
          target: capability.id,
          type: 'belongs_to',
          label: 'belongs to',
          weight: 0.8,
          direction: 'unidirectional',
          metadata: { confidence: story.confidence }
        });
      }

      // Connect to components
      story.sourceComponents.forEach(componentName => {
        const componentId = `component-${componentName}`;
        if (this.nodeMap.has(componentId)) {
          this.addEdge({
            id: `edge-${story.id}-${componentId}`,
            source: story.id,
            target: componentId,
            type: 'implements',
            label: 'implemented by',
            weight: 0.7,
            direction: 'unidirectional',
            style: { strokeColor: '#3498DB' }
          });
        }
      });
    });
  }

  private createCapabilityEdges(context: ExtractedBusinessContext): void {
    context.capabilities.forEach(capability => {
      // Connect to data entities
      capability.dataEntities.forEach(entityName => {
        const entityId = `entity-${entityName}`;
        if (this.nodeMap.has(entityId)) {
          this.addEdge({
            id: `edge-${capability.id}-${entityId}`,
            source: capability.id,
            target: entityId,
            type: 'uses',
            label: 'uses',
            weight: 0.6,
            direction: 'bidirectional',
            style: { strokeColor: '#9B59B6', dashed: true }
          });
        }
      });
    });
  }

  private createFeatureEdges(componentGraph: BusinessComponentGraph): void {
    // Feature relationships
    componentGraph.featureRelationships.forEach(rel => {
      this.addEdge({
        id: `edge-${rel.from}-${rel.to}`,
        source: rel.from,
        target: rel.to,
        type: rel.relationshipType as EdgeType,
        label: rel.description,
        weight: rel.strength,
        direction: rel.relationshipType === 'depends_on' ? 'unidirectional' : 'bidirectional',
        metadata: { criticalPath: rel.relationshipType === 'depends_on' }
      });
    });

    // Feature to component edges
    componentGraph.features.forEach(feature => {
      feature.components.forEach(component => {
        const componentId = `component-${component.componentName}`;
        if (this.nodeMap.has(componentId)) {
          this.addEdge({
            id: `edge-${feature.id}-${componentId}`,
            source: feature.id,
            target: componentId,
            type: 'uses',
            label: 'contains',
            weight: 0.7,
            direction: 'unidirectional'
          });
        }
      });
    });
  }

  private createJourneyEdges(journeyMap: UserJourneyMap): void {
    // Journey relationships
    journeyMap.journeyRelationships.forEach(rel => {
      this.addEdge({
        id: `edge-${rel.from}-${rel.to}`,
        source: rel.from,
        target: rel.to,
        type: rel.relationshipType === 'leads_to' ? 'navigates_to' :
              rel.relationshipType === 'requires' ? 'requires' : 'extends',
        label: rel.relationshipType,
        weight: 0.6,
        direction: 'unidirectional',
        metadata: { businessRule: rel.condition }
      });
    });

    // Journey to component edges
    journeyMap.journeys.forEach(journey => {
      const uniqueComponents = new Set(journey.steps.map(s => s.component));
      uniqueComponents.forEach(componentName => {
        const componentId = `component-${componentName}`;
        if (this.nodeMap.has(componentId)) {
          this.addEdge({
            id: `edge-${journey.id}-${componentId}`,
            source: journey.id,
            target: componentId,
            type: 'uses',
            label: 'traverses',
            weight: 0.5,
            direction: 'unidirectional',
            style: { animated: true }
          });
        }
      });
    });
  }

  private createDataFlowEdges(journeyMap: UserJourneyMap): void {
    journeyMap.dataFlowGraph.edges.forEach(flowEdge => {
      const sourceId = `component-${flowEdge.from}`;
      const targetId = `component-${flowEdge.to}`;

      if (this.nodeMap.has(sourceId) && this.nodeMap.has(targetId)) {
        this.addEdge({
          id: flowEdge.id,
          source: sourceId,
          target: targetId,
          type: 'transforms',
          label: flowEdge.operation,
          weight: flowEdge.criticality === 'critical' ? 1.0 :
                 flowEdge.criticality === 'high' ? 0.8 :
                 flowEdge.criticality === 'medium' ? 0.5 : 0.3,
          direction: 'unidirectional',
          metadata: {
            dataFlow: flowEdge.dataType,
            criticalPath: flowEdge.criticality === 'critical'
          },
          style: {
            strokeWidth: flowEdge.volume === 'high' ? 3 :
                        flowEdge.volume === 'medium' ? 2 : 1,
            strokeColor: flowEdge.criticality === 'critical' ? '#E74C3C' :
                        flowEdge.criticality === 'high' ? '#F39C12' : '#95A5A6',
            animated: flowEdge.criticality === 'critical'
          }
        });
      }
    });
  }

  private createBusinessRuleEdges(context: ExtractedBusinessContext): void {
    context.businessRules.forEach(rule => {
      // Connect to affected entities
      rule.affectedEntities.forEach(entityName => {
        const entityId = `entity-${entityName}`;
        if (this.nodeMap.has(entityId)) {
          this.addEdge({
            id: `edge-${rule.id}-${entityId}`,
            source: rule.id,
            target: entityId,
            type: 'validates',
            label: 'validates',
            weight: 0.7,
            direction: 'unidirectional',
            style: { strokeColor: '#E74C3C', dashed: true }
          });
        }
      });

      // Connect to implementing components
      rule.implementation.forEach(impl => {
        const componentId = `component-${impl}`;
        if (this.nodeMap.has(componentId)) {
          this.addEdge({
            id: `edge-${rule.id}-${componentId}`,
            source: rule.id,
            target: componentId,
            type: 'implements',
            label: 'enforced by',
            weight: 0.8,
            direction: 'unidirectional'
          });
        }
      });
    });
  }

  private createDomainClusters(domains: BusinessDomain[]): void {
    domains.forEach(domain => {
      const nodeIds: string[] = [];

      // Add feature nodes
      domain.features.forEach(featureId => {
        if (this.nodeMap.has(featureId)) {
          nodeIds.push(featureId);
        }
      });

      // Add component nodes
      domain.coreComponents.forEach(componentName => {
        const componentId = `component-${componentName}`;
        if (this.nodeMap.has(componentId)) {
          nodeIds.push(componentId);
        }
      });

      if (nodeIds.length > 0) {
        this.graph.clusters.push({
          id: domain.id,
          name: domain.name,
          type: 'domain',
          nodes: nodeIds,
          color: this.getColorForDomain(domain.name),
          metadata: {
            businessValue: 80,
            complexity: 60,
            completeness: (domain.features.length / 10) * 100, // Rough estimate
            riskLevel: 'medium'
          }
        });
      }
    });
  }

  private createFeatureClusters(features: BusinessFeature[]): void {
    features.forEach(feature => {
      const nodeIds: string[] = [feature.id];

      // Add related user story nodes
      feature.userStories.forEach(storyId => {
        if (this.nodeMap.has(storyId)) {
          nodeIds.push(storyId);
        }
      });

      // Add component nodes
      feature.components.forEach(comp => {
        const componentId = `component-${comp.componentName}`;
        if (this.nodeMap.has(componentId)) {
          nodeIds.push(componentId);
        }
      });

      if (nodeIds.length > 2) {
        this.graph.clusters.push({
          id: `cluster-${feature.id}`,
          name: `${feature.name} Feature`,
          type: 'feature',
          nodes: nodeIds,
          color: this.getColorForCategory(feature.category),
          collapsed: nodeIds.length > 5,
          metadata: {
            businessValue: feature.businessValue,
            complexity: feature.technicalComplexity,
            completeness: 70,
            riskLevel: feature.technicalComplexity > 70 ? 'high' :
                       feature.technicalComplexity > 40 ? 'medium' : 'low'
          }
        });
      }
    });
  }

  private createJourneyClusters(journeys: UserJourney[]): void {
    // Group journeys by persona
    const journeysByPersona = new Map<string, UserJourney[]>();

    journeys.forEach(journey => {
      const persona = journey.persona;
      const existing = journeysByPersona.get(persona) || [];
      existing.push(journey);
      journeysByPersona.set(persona, existing);
    });

    journeysByPersona.forEach((personaJourneys, persona) => {
      if (personaJourneys.length > 1) {
        const nodeIds = personaJourneys.map(j => j.id);

        this.graph.clusters.push({
          id: `cluster-journey-${persona}`,
          name: `${persona} Journeys`,
          type: 'journey',
          nodes: nodeIds,
          color: '#9B59B6',
          metadata: {
            businessValue: 70,
            complexity: personaJourneys.reduce((sum, j) =>
              sum + j.metrics.complexity, 0) / personaJourneys.length * 10,
            completeness: 80,
            riskLevel: 'low'
          }
        });
      }
    });
  }

  private calculateNodeMetrics(): void {
    // Calculate connectivity for each node
    this.graph.nodes.forEach(node => {
      const incomingEdges = this.graph.edges.filter(e => e.target === node.id);
      const outgoingEdges = this.graph.edges.filter(e => e.source === node.id);

      if (node.metrics) {
        node.metrics.connectivity = incomingEdges.length + outgoingEdges.length;

        // Adjust importance based on connectivity
        node.metrics.importance = Math.min(100,
          node.metrics.importance + (node.metrics.connectivity * 2)
        );
      }
    });
  }

  private calculateGraphStatistics(): void {
    const stats = this.graph.metadata.statistics;

    stats.totalNodes = this.graph.nodes.length;
    stats.totalEdges = this.graph.edges.length;

    // Count nodes by type
    this.graph.nodes.forEach(node => {
      stats.nodesByType[node.type] = (stats.nodesByType[node.type] || 0) + 1;
    });

    // Count edges by type
    this.graph.edges.forEach(edge => {
      stats.edgesByType[edge.type] = (stats.edgesByType[edge.type] || 0) + 1;
    });

    // Calculate average connectivity
    const totalConnectivity = this.graph.nodes.reduce((sum, node) =>
      sum + (node.metrics?.connectivity || 0), 0
    );
    stats.avgConnectivity = totalConnectivity / stats.totalNodes;

    // Calculate graph density
    const maxPossibleEdges = stats.totalNodes * (stats.totalNodes - 1) / 2;
    stats.graphDensity = stats.totalEdges / maxPossibleEdges;

    stats.clusters = this.graph.clusters.length;

    // Find isolated nodes
    stats.isolatedNodes = this.graph.nodes.filter(node =>
      !this.graph.edges.some(e => e.source === node.id || e.target === node.id)
    ).length;
  }

  private applyLayout(): void {
    // Simple hierarchical layout
    const levels = this.calculateHierarchyLevels();
    const nodesByLevel = new Map<number, BusinessGraphNode[]>();

    // Group nodes by level
    levels.forEach((level, nodeId) => {
      const node = this.nodeMap.get(nodeId);
      if (node) {
        const nodesAtLevel = nodesByLevel.get(level) || [];
        nodesAtLevel.push(node);
        nodesByLevel.set(level, nodesAtLevel);
      }
    });

    // Position nodes
    let y = 100;
    nodesByLevel.forEach((nodes, level) => {
      let x = 100;
      const spacing = 1000 / Math.max(nodes.length, 1);

      nodes.forEach(node => {
        node.position = { x, y };
        x += spacing;
      });

      y += 150;
    });
  }

  private calculateHierarchyLevels(): Map<string, number> {
    const levels = new Map<string, number>();

    // Assign levels based on node types
    this.graph.nodes.forEach(node => {
      let level = 3; // Default middle level

      switch (node.type) {
        case 'user_persona':
          level = 0;
          break;
        case 'user_journey':
          level = 1;
          break;
        case 'user_story':
          level = 2;
          break;
        case 'business_capability':
        case 'business_feature':
          level = 3;
          break;
        case 'component':
          level = 4;
          break;
        case 'data_entity':
        case 'business_rule':
          level = 5;
          break;
        case 'api_endpoint':
        case 'integration_point':
          level = 6;
          break;
      }

      levels.set(node.id, level);
    });

    return levels;
  }

  private addNode(node: BusinessGraphNode): void {
    this.graph.nodes.push(node);
    this.nodeMap.set(node.id, node);
  }

  private addEdge(edge: BusinessGraphEdge): void {
    // Avoid duplicate edges
    const edgeKey = `${edge.source}-${edge.target}-${edge.type}`;
    if (!this.edgeMap.has(edgeKey)) {
      this.graph.edges.push(edge);
      this.edgeMap.set(edgeKey, edge);
    }
  }

  // Helper methods for styling
  private getColorForPriority(priority: string): string {
    const colors: Record<string, string> = {
      'critical': '#E74C3C',
      'high': '#F39C12',
      'medium': '#3498DB',
      'low': '#95A5A6'
    };
    return colors[priority] || '#95A5A6';
  }

  private getColorForBusinessValue(value: string): string {
    const colors: Record<string, string> = {
      'core': '#27AE60',
      'supporting': '#3498DB',
      'generic': '#95A5A6'
    };
    return colors[value] || '#95A5A6';
  }

  private getColorForCategory(category: string): string {
    const colors: Record<string, string> = {
      'core': '#E74C3C',
      'supporting': '#9B59B6',
      'utility': '#95A5A6'
    };
    return colors[category] || '#3498DB';
  }

  private getColorForComponentType(type: string): string {
    const colors: Record<string, string> = {
      'container': '#E67E22',
      'presentational': '#3498DB',
      'functional': '#27AE60',
      'hybrid': '#9B59B6'
    };
    return colors[type] || '#95A5A6';
  }

  private getColorForDomain(domain: string): string {
    const colors: Record<string, string> = {
      'User Management': '#3498DB',
      'Task Management': '#27AE60',
      'Analytics': '#9B59B6',
      'Infrastructure': '#95A5A6'
    };
    return colors[domain] || '#F39C12';
  }

  private calculateStoryImportance(story: UserStory): number {
    let importance = 50;

    if (story.priority === 'critical') importance += 30;
    else if (story.priority === 'high') importance += 20;
    else if (story.priority === 'medium') importance += 10;

    importance += story.confidence * 20;

    return Math.min(100, importance);
  }

  private calculateComponentImportance(mapping: ComponentMapping): number {
    let importance = 30;

    if (mapping.componentType === 'container') importance += 20;
    else if (mapping.componentType === 'hybrid') importance += 30;

    importance += mapping.interactionPatterns.length * 5;
    importance += mapping.dataFlow.transformations.length * 10;

    return Math.min(100, importance);
  }

  private calculateJourneyBusinessValue(journey: UserJourney): number {
    let value = 50;

    if (journey.persona === 'authenticated-user') value += 20;
    if (journey.metrics.complexity > 5) value += 10;
    if (journey.metrics.integrationPoints > 2) value += 15;

    return Math.min(100, value);
  }

  private initializeStatistics(): GraphStatistics {
    return {
      totalNodes: 0,
      totalEdges: 0,
      nodesByType: {} as Record<NodeType, number>,
      edgesByType: {} as Record<EdgeType, number>,
      avgConnectivity: 0,
      graphDensity: 0,
      clusters: 0,
      isolatedNodes: 0
    };
  }

  private getDefaultViewOptions(): ViewOptions {
    return {
      layout: 'hierarchical',
      showLabels: true,
      showMetrics: false,
      highlightCriticalPaths: true,
      collapseThreshold: 10
    };
  }

  private generateLegend(): LegendItem[] {
    return [
      // Node types
      { type: 'node', category: 'User Story', color: '#3498DB', icon: 'story', description: 'User requirements and features' },
      { type: 'node', category: 'Business Capability', color: '#27AE60', icon: 'capability', description: 'High-level business functions' },
      { type: 'node', category: 'Component', color: '#E67E22', icon: 'component', description: 'UI/Code components' },
      { type: 'node', category: 'Data Entity', color: '#4A90E2', icon: 'database', description: 'Data models and entities' },
      { type: 'node', category: 'User Journey', color: '#9B59B6', icon: 'journey', description: 'User interaction flows' },
      { type: 'node', category: 'Business Rule', color: '#E74C3C', icon: 'rule', description: 'Validation and business logic' },

      // Edge types
      { type: 'edge', category: 'Implements', description: 'Component implements story/feature' },
      { type: 'edge', category: 'Uses', description: 'Component uses entity/service' },
      { type: 'edge', category: 'Depends On', description: 'Feature dependency relationship' },
      { type: 'edge', category: 'Transforms', description: 'Data transformation flow' }
    ];
  }

  // Export methods
  public exportGraph(format: GraphExportFormat): string {
    switch (format.format) {
      case 'json':
        return this.exportAsJSON(format);
      case 'cytoscape':
        return this.exportAsCytoscape(format);
      case 'd3':
        return this.exportAsD3(format);
      default:
        return this.exportAsJSON(format);
    }
  }

  private exportAsJSON(options: GraphExportFormat): string {
    const data = {
      nodes: this.graph.nodes.map(node => ({
        ...node,
        data: options.includeMetadata ? node.data : undefined,
        position: options.includePositions ? node.position : undefined,
        metrics: options.includeMetadata ? node.metrics : undefined
      })),
      edges: this.graph.edges,
      clusters: options.includeMetadata ? this.graph.clusters : undefined,
      metadata: options.includeMetadata ? this.graph.metadata : undefined
    };

    return options.prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  private exportAsCytoscape(options: GraphExportFormat): string {
    const elements = [
      ...this.graph.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          ...( options.includeMetadata ? { metrics: node.metrics } : {})
        },
        position: options.includePositions ? node.position : undefined,
        classes: node.type
      })),
      ...this.graph.edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type,
          weight: edge.weight
        },
        classes: edge.type
      }))
    ];

    return JSON.stringify({ elements }, null, options.prettyPrint ? 2 : 0);
  }

  private exportAsD3(options: GraphExportFormat): string {
    const data = {
      nodes: this.graph.nodes.map(node => ({
        id: node.id,
        label: node.label,
        group: node.type,
        value: node.metrics?.importance || 50,
        ...( options.includePositions ? { x: node.position?.x, y: node.position?.y } : {})
      })),
      links: this.graph.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        value: edge.weight,
        type: edge.type
      }))
    };

    return JSON.stringify(data, null, options.prettyPrint ? 2 : 0);
  }
}