import React, { useMemo, useCallback } from 'react';
import { Box, Chip, Badge, Tooltip } from '@mui/material';
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
  NodeChange
} from 'reactflow';
import {
  AccountTree,
  Functions,
  DataObject,
  Api,
  Warning,
  CheckCircle,
  Psychology,
  Speed
} from '@mui/icons-material';
import { ProjectGraph, ComponentInfo } from '../../../../types';
import { ViewContext, GraphLevel } from '../MultiLevelGraphManager';
import ReactComponentNode from '../nodes/ReactComponentNode';
import HookNodeComponent from '../nodes/HookNodeComponent';
import DataFlowEdge from '../edges/DataFlowEdge';

const nodeTypes = {
  reactComponent: ReactComponentNode,
  hook: HookNodeComponent
};

const edgeTypes = {
  dataFlow: DataFlowEdge
};

interface ComponentLevelViewProps {
  graph: ProjectGraph;
  viewContext: ViewContext;
  onNodeSelect: (nodeId: string) => void;
  onNodeEdit?: (nodeId: string, changes: any) => void;
  onVisualChange?: (change: any) => void;
  onDrillDown?: (nodeId: string, targetLevel: GraphLevel) => void;
  aiSuggestionsEnabled?: boolean;
}

const ComponentLevelView: React.FC<ComponentLevelViewProps> = ({
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

    // Create nodes for React components
    if (graph.components) {
      graph.components.forEach((component, index) => {
        const x = (index % 4) * 250 + 100;
        const y = Math.floor(index / 4) * 180 + 100;

        // Calculate component complexity score
        const complexityScore = calculateComplexityScore(component);
        const qualityScore = getQualityScore(component, graph);

        nodes.push({
          id: `component-${component.name}`,
          type: 'reactComponent',
          position: { x, y },
          data: {
            component,
            complexityScore,
            qualityScore,
            selected: viewContext.selectedNodes.has(`component-${component.name}`),
            onSelect: () => onNodeSelect(`component-${component.name}`),
            onEdit: (changes: any) => onNodeEdit?.(`component-${component.name}`, changes),
            onDrillDown: () => onDrillDown?.(`component-${component.name}`, 'implementation'),
            aiSuggestions: aiSuggestionsEnabled ? generateComponentSuggestions(component, graph) : [],
            showDetails: viewContext.zoomLevel > 0.8
          },
          className: getComponentClassName(complexityScore, qualityScore)
        });

        // Create hook nodes for components with many hooks
        if (component.hooks.length > 3) {
          component.hooks.forEach((hook, hookIndex) => {
            const hookX = x + (hookIndex % 2) * 60 - 30;
            const hookY = y + 80 + Math.floor(hookIndex / 2) * 40;

            nodes.push({
              id: `hook-${component.name}-${hook.name}`,
              type: 'hook',
              position: { x: hookX, y: hookY },
              data: {
                hook,
                parentComponent: component.name,
                selected: viewContext.selectedNodes.has(`hook-${component.name}-${hook.name}`),
                onSelect: () => onNodeSelect(`hook-${component.name}-${hook.name}`)
              },
              parentNode: `component-${component.name}`,
              extent: 'parent',
              draggable: false
            });
          });
        }
      });
    }

    // Create edges for component relationships
    if (graph.dependencies?.edges) {
      graph.dependencies.edges.forEach(edge => {
        const sourceComponent = graph.components?.find(c =>
          edge.from.includes(c.name) || c.filePath.includes(edge.from)
        );
        const targetComponent = graph.components?.find(c =>
          edge.to.includes(c.name) || c.filePath.includes(edge.to)
        );

        if (sourceComponent && targetComponent && sourceComponent !== targetComponent) {
          const edgeType = determineEdgeType(edge.type, edge.metadata);

          edges.push({
            id: `${sourceComponent.name}-${targetComponent.name}`,
            source: `component-${sourceComponent.name}`,
            target: `component-${targetComponent.name}`,
            type: edgeType.reactFlowType,
            data: {
              relationshipType: edge.type,
              metadata: edge.metadata,
              weight: edge.weight
            },
            style: {
              stroke: edgeType.color,
              strokeWidth: Math.max(1, edge.weight * 2),
              strokeDasharray: edgeType.dashArray
            },
            animated: edge.type === 'renders' || edge.type === 'passes_props',
            label: edgeType.label
          });
        }
      });
    }

    // Add data flow edges
    if (graph.dataFlows) {
      graph.dataFlows.forEach(flow => {
        const sourceComp = flow.from.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
        const targetComp = flow.to.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');

        if (sourceComp && targetComp && sourceComp !== targetComp) {
          edges.push({
            id: `dataflow-${flow.from}-${flow.to}`,
            source: `component-${sourceComp}`,
            target: `component-${targetComp}`,
            type: 'dataFlow',
            data: {
              flowType: flow.type,
              data: flow.data
            },
            style: {
              stroke: getDataFlowColor(flow.type),
              strokeWidth: 3,
              strokeDasharray: flow.type === 'context' ? '10,5' : undefined
            },
            animated: true,
            label: flow.type
          });
        }
      });
    }

    return { nodes, edges };
  }, [graph, viewContext, onNodeSelect, onNodeEdit, onDrillDown, aiSuggestionsEnabled]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    // Determine connection type based on source and target
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return;

    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.target}-${Date.now()}`,
      type: 'smoothstep',
      animated: true,
      label: 'uses',
      style: { stroke: '#666', strokeWidth: 2 }
    };

    setEdges(eds => addEdge(newEdge, eds));

    // Notify about the visual change for AI processing
    onVisualChange?({
      type: 'connect',
      sourceComponent: connection.source?.replace('component-', ''),
      targetComponent: connection.target?.replace('component-', ''),
      businessIntent: 'Component relationship established',
      level: 'component',
      codeGenerationHint: {
        framework: 'react',
        pattern: 'component-composition',
        style: 'functional'
      }
    });
  }, [nodes, setEdges, onVisualChange]);

  const handleNodeChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Track drag operations and modifications
    const significantChanges = changes.filter(change =>
      change.type === 'position' || change.type === 'dimensions'
    );

    if (significantChanges.length > 0) {
      onVisualChange?({
        type: 'drag',
        changes: significantChanges,
        level: 'component'
      });
    }
  }, [onNodesChange, onVisualChange]);

  const getComponentStats = () => {
    const totalComponents = graph.components?.length || 0;
    const functionalComponents = graph.components?.filter(c => c.type === 'function').length || 0;
    const classComponents = graph.components?.filter(c => c.type === 'class').length || 0;
    const componentsWithHooks = graph.components?.filter(c => c.hooks.length > 0).length || 0;

    const avgComplexity = graph.components?.reduce((sum, c) =>
      sum + calculateComplexityScore(c), 0) / totalComponents || 0;

    return {
      total: totalComponents,
      functional: functionalComponents,
      class: classComponents,
      withHooks: componentsWithHooks,
      avgComplexity: Math.round(avgComplexity * 10) / 10
    };
  };

  const getQualityMetrics = () => {
    const components = graph.components || [];
    const highQuality = components.filter(c => getQualityScore(c, graph) > 80).length;
    const needsAttention = components.filter(c => getQualityScore(c, graph) < 60).length;
    const patterns = graph.semanticData?.architecturalPatterns?.length || 0;
    const antiPatterns = graph.semanticData?.antiPatterns?.length || 0;

    return { highQuality, needsAttention, patterns, antiPatterns };
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
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#f5f5f5" gap={20} />
        <Controls />
        <MiniMap
          style={{ background: 'rgba(255, 255, 255, 0.9)' }}
          nodeColor={(node) => {
            if (node.className?.includes('high-complexity')) return '#f44336';
            if (node.className?.includes('medium-complexity')) return '#ff9800';
            return '#4caf50';
          }}
        />
      </ReactFlow>

      {/* Component Statistics */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Chip
          icon={<AccountTree />}
          label={`${getComponentStats().total} Components`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Functions />}
          label={`${getComponentStats().withHooks} with Hooks`}
          color="secondary"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Speed />}
          label={`${getComponentStats().avgComplexity} avg complexity`}
          color={getComponentStats().avgComplexity > 3 ? 'warning' : 'success'}
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Quality Metrics */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Badge badgeContent={getQualityMetrics().patterns} color="success">
          <Chip
            icon={<CheckCircle />}
            label="Patterns"
            color="success"
            variant="outlined"
            size="small"
          />
        </Badge>
        <Badge badgeContent={getQualityMetrics().antiPatterns} color="error">
          <Chip
            icon={<Warning />}
            label="Issues"
            color="error"
            variant="outlined"
            size="small"
          />
        </Badge>
      </Box>

      {/* AI Component Insights */}
      {aiSuggestionsEnabled && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            maxWidth: 350,
            zIndex: 1000
          }}
        >
          <Tooltip title="AI-powered component analysis and optimization suggestions">
            <Chip
              icon={<Psychology />}
              label="Component Intelligence"
              color="info"
              onClick={() => {
                console.log('Show AI component insights');
              }}
            />
          </Tooltip>
        </Box>
      )}

      {/* Filter Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Chip
          label="Show Related Only"
          clickable
          color={viewContext.filters.showOnlyRelated ? 'primary' : 'default'}
          variant={viewContext.filters.showOnlyRelated ? 'filled' : 'outlined'}
          size="small"
          onClick={() => {
            // Toggle filter
            onVisualChange?({
              type: 'filter',
              filter: 'showOnlyRelated',
              value: !viewContext.filters.showOnlyRelated
            });
          }}
        />
        <Chip
          label="Group Similar"
          clickable
          color={viewContext.filters.groupBySimilarity ? 'primary' : 'default'}
          variant={viewContext.filters.groupBySimilarity ? 'filled' : 'outlined'}
          size="small"
          onClick={() => {
            onVisualChange?({
              type: 'filter',
              filter: 'groupBySimilarity',
              value: !viewContext.filters.groupBySimilarity
            });
          }}
        />
      </Box>
    </Box>
  );
};

// Helper functions
function calculateComplexityScore(component: ComponentInfo): number {
  const propsWeight = component.props.length * 0.5;
  const hooksWeight = component.hooks.length * 0.8;
  const childrenWeight = component.children.length * 0.3;

  return Math.min(10, propsWeight + hooksWeight + childrenWeight);
}

function getQualityScore(component: ComponentInfo, graph: ProjectGraph): number {
  let score = 100;

  // Deduct for high complexity
  const complexity = calculateComplexityScore(component);
  if (complexity > 5) score -= (complexity - 5) * 10;

  // Deduct for missing prop types
  const missingTypes = component.props.filter(p => p.type === 'any').length;
  score -= missingTypes * 5;

  // Add for good practices (hooks usage, TypeScript)
  if (component.hooks.length > 0 && component.hooks.length < 5) score += 10;
  if (component.filePath.includes('.tsx')) score += 5;

  return Math.max(0, Math.min(100, score));
}

function generateComponentSuggestions(component: ComponentInfo, graph: ProjectGraph) {
  const suggestions = [];
  const complexity = calculateComplexityScore(component);

  if (complexity > 6) {
    suggestions.push({
      type: 'refactor',
      title: 'Reduce complexity',
      description: `Component has ${complexity.toFixed(1)} complexity. Consider splitting into smaller components.`
    });
  }

  if (component.props.length > 8) {
    suggestions.push({
      type: 'optimization',
      title: 'Simplify props interface',
      description: `Component has ${component.props.length} props. Consider using composition or config objects.`
    });
  }

  if (component.hooks.length > 5) {
    suggestions.push({
      type: 'pattern',
      title: 'Extract custom hooks',
      description: `Component uses ${component.hooks.length} hooks. Consider creating custom hooks for reusability.`
    });
  }

  return suggestions;
}

function determineEdgeType(relationType: string, metadata: any) {
  switch (relationType) {
    case 'imports':
      return {
        reactFlowType: 'smoothstep',
        color: '#666',
        label: 'imports',
        dashArray: undefined
      };
    case 'renders':
      return {
        reactFlowType: 'smoothstep',
        color: '#1976d2',
        label: 'renders',
        dashArray: undefined
      };
    case 'passes_props':
      return {
        reactFlowType: 'smoothstep',
        color: '#388e3c',
        label: 'props',
        dashArray: '5,5'
      };
    case 'calls':
      return {
        reactFlowType: 'straight',
        color: '#f57c00',
        label: 'calls',
        dashArray: undefined
      };
    default:
      return {
        reactFlowType: 'smoothstep',
        color: '#999',
        label: relationType,
        dashArray: undefined
      };
  }
}

function getDataFlowColor(flowType: string): string {
  switch (flowType) {
    case 'state': return '#e91e63';
    case 'props': return '#4caf50';
    case 'context': return '#9c27b0';
    case 'api_call': return '#ff9800';
    default: return '#666';
  }
}

function getComponentClassName(complexity: number, quality: number): string {
  const classes = ['react-component'];

  if (complexity > 6) classes.push('high-complexity');
  else if (complexity > 3) classes.push('medium-complexity');
  else classes.push('low-complexity');

  if (quality > 80) classes.push('high-quality');
  else if (quality < 60) classes.push('needs-attention');

  return classes.join(' ');
}

export default ComponentLevelView;