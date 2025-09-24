import React, { useMemo, useCallback } from 'react';
import { Box, Chip, Avatar, Tooltip } from '@mui/material';
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
  Connection
} from 'reactflow';
import {
  Person,
  Business,
  PlayArrow,
  CheckCircle,
  Error,
  Timeline,
  TrendingUp,
  AccountCircle
} from '@mui/icons-material';
import { ProjectGraph, UserJourney, UserStep, BusinessProcess } from '../../../../types';
import { ViewContext, GraphLevel } from '../MultiLevelGraphManager';
import UserJourneyNodeComponent from '../nodes/UserJourneyNodeComponent';
import BusinessProcessNodeComponent from '../nodes/BusinessProcessNodeComponent';
import UserPersonaNodeComponent from '../nodes/UserPersonaNodeComponent';

const nodeTypes = {
  userJourney: UserJourneyNodeComponent,
  businessProcess: BusinessProcessNodeComponent,
  userPersona: UserPersonaNodeComponent
};

interface BusinessFlowViewProps {
  graph: ProjectGraph;
  viewContext: ViewContext;
  onNodeSelect: (nodeId: string) => void;
  onNodeEdit?: (nodeId: string, changes: any) => void;
  onVisualChange?: (change: any) => void;
  onDrillDown?: (nodeId: string, targetLevel: GraphLevel) => void;
  aiSuggestionsEnabled?: boolean;
}

const BusinessFlowView: React.FC<BusinessFlowViewProps> = ({
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
    let yOffset = 0;

    // Create nodes for user personas
    if (graph.businessContext?.userPersonas) {
      graph.businessContext.userPersonas.forEach((persona, index) => {
        const x = index * 250 + 50;
        const y = 50;

        nodes.push({
          id: `persona-${persona.id}`,
          type: 'userPersona',
          position: { x, y },
          data: {
            persona,
            selected: viewContext.selectedNodes.has(`persona-${persona.id}`),
            onSelect: () => onNodeSelect(`persona-${persona.id}`),
            onDrillDown: () => onDrillDown?.(`persona-${persona.id}`, 'component'),
            aiSuggestions: aiSuggestionsEnabled ? generatePersonaSuggestions(persona) : []
          }
        });
      });
      yOffset = 200;
    }

    // Create nodes for user journeys
    if (graph.userJourneys) {
      graph.userJourneys.forEach((journey, index) => {
        const x = (index % 2) * 400 + 100;
        const y = yOffset + Math.floor(index / 2) * 300 + 100;

        nodes.push({
          id: `journey-${journey.id}`,
          type: 'userJourney',
          position: { x, y },
          data: {
            journey,
            selected: viewContext.selectedNodes.has(`journey-${journey.id}`),
            onSelect: () => onNodeSelect(`journey-${journey.id}`),
            onDrillDown: () => onDrillDown?.(`journey-${journey.id}`, 'component'),
            aiSuggestions: aiSuggestionsEnabled ? generateJourneySuggestions(journey, graph) : []
          }
        });

        // Create step nodes for detailed journeys
        journey.steps.forEach((step, stepIndex) => {
          const stepX = x + (stepIndex % 3) * 120 - 100;
          const stepY = y + Math.floor(stepIndex / 3) * 80 + 60;

          nodes.push({
            id: `step-${journey.id}-${step.id}`,
            type: 'default',
            position: { x: stepX, y: stepY },
            data: {
              label: step.description,
              type: step.type,
              component: step.component
            },
            style: {
              width: 100,
              height: 50,
              fontSize: 10,
              backgroundColor: getStepColor(step.type),
              border: '1px solid #ccc'
            }
          });

          // Connect steps in sequence
          if (stepIndex > 0) {
            const prevStepId = `step-${journey.id}-${journey.steps[stepIndex - 1].id}`;
            edges.push({
              id: `${prevStepId}-${step.id}`,
              source: prevStepId,
              target: `step-${journey.id}-${step.id}`,
              type: 'smoothstep',
              style: { stroke: '#666', strokeWidth: 1 },
              animated: true
            });
          }

          // Connect first step to journey node
          if (stepIndex === 0) {
            edges.push({
              id: `journey-${journey.id}-${step.id}`,
              source: `journey-${journey.id}`,
              target: `step-${journey.id}-${step.id}`,
              type: 'smoothstep',
              style: { stroke: '#1976d2', strokeWidth: 2 }
            });
          }
        });
      });
    }

    // Create nodes for business processes
    if (graph.businessContext?.businessProcesses) {
      const processYOffset = yOffset + (Math.ceil((graph.userJourneys?.length || 0) / 2) * 300) + 200;

      graph.businessContext.businessProcesses.forEach((process, index) => {
        const x = index * 350 + 100;
        const y = processYOffset;

        nodes.push({
          id: `process-${process.id}`,
          type: 'businessProcess',
          position: { x, y },
          data: {
            process,
            selected: viewContext.selectedNodes.has(`process-${process.id}`),
            onSelect: () => onNodeSelect(`process-${process.id}`),
            onDrillDown: () => onDrillDown?.(`process-${process.id}`, 'component'),
            aiSuggestions: aiSuggestionsEnabled ? generateProcessSuggestions(process, graph) : []
          }
        });
      });
    }

    // Create edges between personas and their journeys
    if (graph.businessContext?.userPersonas && graph.userJourneys) {
      graph.businessContext.userPersonas.forEach(persona => {
        persona.journeys.forEach(journeyId => {
          const journey = graph.userJourneys?.find(j => j.id === journeyId);
          if (journey) {
            edges.push({
              id: `persona-${persona.id}-journey-${journeyId}`,
              source: `persona-${persona.id}`,
              target: `journey-${journeyId}`,
              type: 'smoothstep',
              style: { stroke: '#388e3c', strokeWidth: 2 },
              label: 'follows',
              animated: true
            });
          }
        });
      });
    }

    // Create edges between journeys and business processes
    if (graph.userJourneys && graph.businessContext?.businessProcesses) {
      graph.userJourneys.forEach(journey => {
        graph.businessContext?.businessProcesses?.forEach(process => {
          // Check if journey components overlap with process components
          const sharedComponents = journey.components.filter(c =>
            process.components.includes(c)
          );

          if (sharedComponents.length > 0) {
            edges.push({
              id: `journey-${journey.id}-process-${process.id}`,
              source: `journey-${journey.id}`,
              target: `process-${process.id}`,
              type: 'smoothstep',
              style: { stroke: '#f57c00', strokeWidth: 2, strokeDasharray: '5,5' },
              label: `${sharedComponents.length} shared`,
              animated: true
            });
          }
        });
      });
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
      animated: true,
      label: 'custom flow'
    };

    setEdges(eds => addEdge(newEdge, eds));

    onVisualChange?({
      type: 'connect',
      sourceComponent: connection.source,
      targetComponent: connection.target,
      businessIntent: 'Business flow connection established',
      level: 'business'
    });
  }, [setEdges, onVisualChange]);

  const getBusinessMetrics = () => {
    const personas = graph.businessContext?.userPersonas?.length || 0;
    const journeys = graph.userJourneys?.length || 0;
    const processes = graph.businessContext?.businessProcesses?.length || 0;

    const totalSteps = graph.userJourneys?.reduce((sum, journey) =>
      sum + journey.steps.length, 0) || 0;

    const avgJourneyLength = journeys > 0 ? Math.round(totalSteps / journeys) : 0;

    return { personas, journeys, processes, avgJourneyLength };
  };

  const getCriticalPath = () => {
    // Identify the most complex or important user journey
    const journeys = graph.userJourneys || [];
    const criticalJourney = journeys.reduce((critical, current) => {
      const currentComplexity = current.steps.length * current.components.length;
      const criticalComplexity = critical.steps.length * critical.components.length;
      return currentComplexity > criticalComplexity ? current : critical;
    }, journeys[0]);

    return criticalJourney?.name || 'None identified';
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background color="#f8f9fa" gap={25} />
        <Controls />
        <MiniMap
          style={{ background: 'rgba(255, 255, 255, 0.9)' }}
          nodeColor={(node) => {
            switch (node.type) {
              case 'userPersona': return '#388e3c';
              case 'userJourney': return '#1976d2';
              case 'businessProcess': return '#f57c00';
              default: return '#666';
            }
          }}
        />
      </ReactFlow>

      {/* Business Metrics Overlay */}
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
          icon={<Person />}
          label={`${getBusinessMetrics().personas} Personas`}
          color="success"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Timeline />}
          label={`${getBusinessMetrics().journeys} Journeys`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Business />}
          label={`${getBusinessMetrics().processes} Processes`}
          color="warning"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<TrendingUp />}
          label={`${getBusinessMetrics().avgJourneyLength} avg steps`}
          color="info"
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Critical Path Indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 1000
        }}
      >
        <Tooltip title={`Most complex journey: ${getCriticalPath()}`}>
          <Chip
            icon={<Error />}
            label="Critical Path"
            color="error"
            variant="outlined"
            onClick={() => {
              // Highlight critical path
              console.log('Highlighting critical path:', getCriticalPath());
            }}
          />
        </Tooltip>
      </Box>

      {/* AI Business Insights */}
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
          <Tooltip title="AI-detected business optimization opportunities">
            <Chip
              icon={<AccountCircle />}
              label="Business Flow Insights"
              color="secondary"
              onClick={() => {
                console.log('Show AI business insights');
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

// Helper functions
function generatePersonaSuggestions(persona: any) {
  return [
    {
      type: 'ux',
      title: `Optimize ${persona.name} experience`,
      description: 'Consider simplifying complex workflows for this persona'
    },
    {
      type: 'feature',
      title: 'Missing capabilities',
      description: `Add features to address ${persona.name}'s pain points`
    }
  ];
}

function generateJourneySuggestions(journey: UserJourney, graph: ProjectGraph) {
  return [
    {
      type: 'optimization',
      title: `Streamline ${journey.name}`,
      description: `Journey has ${journey.steps.length} steps - consider consolidation`
    },
    {
      type: 'components',
      title: 'Component coverage',
      description: `Journey uses ${journey.components.length} components`
    }
  ];
}

function generateProcessSuggestions(process: any, graph: ProjectGraph) {
  return [
    {
      type: 'automation',
      title: `Automate ${process.name}`,
      description: 'Consider AI-assisted automation for repetitive steps'
    },
    {
      type: 'metrics',
      title: 'Add tracking',
      description: 'Implement business metrics tracking for this process'
    }
  ];
}

function getStepColor(stepType: string): string {
  switch (stepType) {
    case 'click': return '#e3f2fd';
    case 'input': return '#f3e5f5';
    case 'navigation': return '#e8f5e8';
    case 'form_submit': return '#fff3e0';
    case 'api_call': return '#fce4ec';
    default: return '#f5f5f5';
  }
}

export default BusinessFlowView;