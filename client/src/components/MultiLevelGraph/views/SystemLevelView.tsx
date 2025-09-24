import React, { useMemo, useCallback } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import ReactFlow, {
  Node,
  Edge,
  ConnectionMode,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  EdgeChange,
  NodeChange
} from 'reactflow';
import {
  Storage,
  Cloud,
  Security,
  Api,
  Database,
  Web,
  Memory,
  DeveloperBoard
} from '@mui/icons-material';
import { ProjectGraph, BusinessDomain } from '../../../../types';
import { ViewContext, GraphLevel } from '../MultiLevelGraphManager';
import SystemNodeComponent from '../nodes/SystemNodeComponent';
import ServiceNodeComponent from '../nodes/ServiceNodeComponent';

const nodeTypes = {
  system: SystemNodeComponent,
  service: ServiceNodeComponent
};

interface SystemLevelViewProps {
  graph: ProjectGraph;
  viewContext: ViewContext;
  onNodeSelect: (nodeId: string) => void;
  onNodeEdit?: (nodeId: string, changes: any) => void;
  onVisualChange?: (change: any) => void;
  onDrillDown?: (nodeId: string, targetLevel: GraphLevel) => void;
  aiSuggestionsEnabled?: boolean;
}

const SystemLevelView: React.FC<SystemLevelViewProps> = ({
  graph,
  viewContext,
  onNodeSelect,
  onNodeEdit,
  onVisualChange,
  onDrillDown,
  aiSuggestionsEnabled
}) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create nodes for business domains as system components
    if (graph.semanticData?.businessDomains) {
      graph.semanticData.businessDomains.forEach((domain, index) => {
        const x = (index % 3) * 300 + 100;
        const y = Math.floor(index / 3) * 200 + 100;

        nodes.push({
          id: `domain-${domain.name}`,
          type: 'system',
          position: { x, y },
          data: {
            label: domain.name,
            description: domain.description,
            type: 'domain',
            components: domain.components,
            capabilities: domain.businessCapabilities,
            dataEntities: domain.dataEntities,
            workflows: domain.workflows,
            icon: <Business />,
            selected: viewContext.selectedNodes.has(`domain-${domain.name}`),
            onSelect: () => onNodeSelect(`domain-${domain.name}`),
            onDrillDown: () => onDrillDown?.(`domain-${domain.name}`, 'business'),
            aiSuggestions: aiSuggestionsEnabled ? generateDomainSuggestions(domain) : []
          }
        });
      });
    }

    // Create nodes for external services and databases
    const externalDeps = graph.dependencies?.nodes?.filter(
      node => node.filePath.includes('node_modules') || node.type === 'external'
    ) || [];

    const serviceGroups = groupExternalServices(externalDeps);
    Object.entries(serviceGroups).forEach(([category, services], categoryIndex) => {
      const x = categoryIndex * 280 + 500;
      const baseY = 400;

      services.forEach((service, serviceIndex) => {
        const y = baseY + serviceIndex * 120;

        nodes.push({
          id: `service-${service.id}`,
          type: 'service',
          position: { x, y },
          data: {
            label: service.label,
            category,
            type: getServiceType(category),
            version: extractVersion(service.metadata),
            description: `${category} service`,
            icon: getServiceIcon(category),
            connections: service.metadata?.connections || 0,
            selected: viewContext.selectedNodes.has(`service-${service.id}`),
            onSelect: () => onNodeSelect(`service-${service.id}`),
            onDrillDown: () => onDrillDown?.(`service-${service.id}`, 'component'),
            aiSuggestions: aiSuggestionsEnabled ? generateServiceSuggestions(service, category) : []
          }
        });
      });
    });

    // Create edges between domains and services
    graph.semanticData?.businessDomains?.forEach(domain => {
      domain.components.forEach(componentPath => {
        // Find related external services
        const relatedServices = findRelatedServices(componentPath, externalDeps);
        relatedServices.forEach(serviceId => {
          edges.push({
            id: `domain-${domain.name}-service-${serviceId}`,
            source: `domain-${domain.name}`,
            target: `service-${serviceId}`,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#666', strokeWidth: 2 },
            label: 'uses'
          });
        });
      });
    });

    // Add system-level data flows
    if (graph.semanticData?.businessDomains) {
      for (let i = 0; i < graph.semanticData.businessDomains.length - 1; i++) {
        const domain1 = graph.semanticData.businessDomains[i];
        const domain2 = graph.semanticData.businessDomains[i + 1];

        // Check for shared components or data flows
        const sharedComponents = domain1.components.filter(c =>
          domain2.components.includes(c)
        );

        if (sharedComponents.length > 0) {
          edges.push({
            id: `flow-${domain1.name}-${domain2.name}`,
            source: `domain-${domain1.name}`,
            target: `domain-${domain2.name}`,
            type: 'smoothstep',
            style: { stroke: '#1976d2', strokeWidth: 3, strokeDasharray: '5,5' },
            label: `${sharedComponents.length} shared`,
            animated: true
          });
        }
      }
    }

    return { nodes, edges };
  }, [graph, viewContext.selectedNodes, onNodeSelect, onDrillDown, aiSuggestionsEnabled]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.target}`,
      type: 'smoothstep',
      animated: true
    };

    setEdges(eds => addEdge(newEdge, eds));

    // Notify about the visual change
    onVisualChange?({
      type: 'connect',
      sourceComponent: connection.source,
      targetComponent: connection.target,
      businessIntent: 'System-level integration established',
      level: 'system'
    });
  }, [setEdges, onVisualChange]);

  const handleNodeChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Track drag operations for AI learning
    const dragChanges = changes.filter(change => change.type === 'position');
    if (dragChanges.length > 0) {
      onVisualChange?({
        type: 'drag',
        changes: dragChanges,
        level: 'system'
      });
    }
  }, [onNodesChange, onVisualChange]);

  const getSystemMetrics = () => {
    const domains = graph.semanticData?.businessDomains?.length || 0;
    const externalServices = Object.keys(groupExternalServices(
      graph.dependencies?.nodes?.filter(n => n.filePath.includes('node_modules')) || []
    )).length;

    return { domains, externalServices };
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodeChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#f0f0f0" gap={20} />
        <Controls />
        <MiniMap
          style={{ background: 'rgba(255, 255, 255, 0.9)' }}
          nodeColor="rgb(25, 118, 210)"
        />
      </ReactFlow>

      {/* System Metrics Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Chip
          icon={<DeveloperBoard />}
          label={`${getSystemMetrics().domains} Domains`}
          color="primary"
          variant="outlined"
        />
        <Chip
          icon={<Api />}
          label={`${getSystemMetrics().externalServices} Services`}
          color="secondary"
          variant="outlined"
        />
      </Box>

      {/* AI Insights Overlay */}
      {aiSuggestionsEnabled && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            maxWidth: 300,
            zIndex: 1000
          }}
        >
          <Tooltip title="AI-detected system patterns and suggestions">
            <Chip
              icon={<Storage />}
              label="System Architecture Insights"
              color="info"
              onClick={() => {
                // Open AI insights panel
                console.log('Show AI system insights');
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

// Helper functions
function generateDomainSuggestions(domain: BusinessDomain) {
  return [
    {
      type: 'optimization',
      title: `Optimize ${domain.name} data flows`,
      description: 'Consider implementing caching layer for frequently accessed data'
    },
    {
      type: 'security',
      title: 'Add security boundaries',
      description: 'Consider adding authentication checks for sensitive operations'
    }
  ];
}

function generateServiceSuggestions(service: any, category: string) {
  return [
    {
      type: 'performance',
      title: `${service.label} optimization`,
      description: `Consider connection pooling for ${category} service`
    }
  ];
}

function groupExternalServices(deps: any[]) {
  const groups: Record<string, any[]> = {
    'API Services': [],
    'Databases': [],
    'UI Libraries': [],
    'Utilities': [],
    'Development': []
  };

  deps.forEach(dep => {
    const category = categorizeService(dep.label);
    if (groups[category]) {
      groups[category].push(dep);
    } else {
      groups['Utilities'].push(dep);
    }
  });

  return groups;
}

function categorizeService(serviceName: string): string {
  if (serviceName.includes('api') || serviceName.includes('axios') || serviceName.includes('fetch')) {
    return 'API Services';
  }
  if (serviceName.includes('db') || serviceName.includes('mongo') || serviceName.includes('postgres')) {
    return 'Databases';
  }
  if (serviceName.includes('react') || serviceName.includes('mui') || serviceName.includes('ui')) {
    return 'UI Libraries';
  }
  if (serviceName.includes('test') || serviceName.includes('jest') || serviceName.includes('dev')) {
    return 'Development';
  }
  return 'Utilities';
}

function getServiceType(category: string): string {
  switch (category) {
    case 'API Services': return 'api';
    case 'Databases': return 'database';
    case 'UI Libraries': return 'ui';
    case 'Development': return 'dev';
    default: return 'utility';
  }
}

function getServiceIcon(category: string) {
  switch (category) {
    case 'API Services': return <Api />;
    case 'Databases': return <Database />;
    case 'UI Libraries': return <Web />;
    case 'Development': return <DeveloperBoard />;
    default: return <Memory />;
  }
}

function extractVersion(metadata: any): string {
  return metadata?.version || '1.0.0';
}

function findRelatedServices(componentPath: string, services: any[]): string[] {
  // Simple heuristic to find related services based on component imports
  return services
    .filter(service => componentPath.toLowerCase().includes(service.label.toLowerCase()))
    .map(service => service.id);
}

export default SystemLevelView;