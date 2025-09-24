import React, { useMemo, useCallback } from 'react';
import { Box, Chip, Avatar, Tooltip, Paper } from '@mui/material';
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
  Functions,
  Code,
  DataObject,
  Api,
  BugReport,
  Security,
  Psychology,
  TrendingUp,
  Error
} from '@mui/icons-material';
import { ProjectGraph, FunctionInfo } from '../../../../types';
import { ViewContext, GraphLevel } from '../MultiLevelGraphManager';
import FunctionNodeComponent from '../nodes/FunctionNodeComponent';
import ClassNodeComponent from '../nodes/ClassNodeComponent';
import VariableNodeComponent from '../nodes/VariableNodeComponent';

const nodeTypes = {
  function: FunctionNodeComponent,
  class: ClassNodeComponent,
  variable: VariableNodeComponent
};

interface ImplementationLevelViewProps {
  graph: ProjectGraph;
  viewContext: ViewContext;
  onNodeSelect: (nodeId: string) => void;
  onNodeEdit?: (nodeId: string, changes: any) => void;
  onVisualChange?: (change: any) => void;
  onDrillDown?: (nodeId: string, targetLevel: GraphLevel) => void;
  aiSuggestionsEnabled?: boolean;
}

const ImplementationLevelView: React.FC<ImplementationLevelViewProps> = ({
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

    // Create nodes for functions
    if (graph.functions) {
      graph.functions.forEach((func, index) => {
        const x = (index % 5) * 200 + 100;
        const y = Math.floor(index / 5) * 150 + 100;

        const complexity = calculateFunctionComplexity(func);
        const riskScore = calculateRiskScore(func, graph);

        nodes.push({
          id: `function-${func.name}`,
          type: 'function',
          position: { x, y },
          data: {
            function: func,
            complexity,
            riskScore,
            selected: viewContext.selectedNodes.has(`function-${func.name}`),
            onSelect: () => onNodeSelect(`function-${func.name}`),
            onEdit: (changes: any) => onNodeEdit?.(`function-${func.name}`, changes),
            aiSuggestions: aiSuggestionsEnabled ? generateFunctionSuggestions(func, graph) : [],
            showDetails: viewContext.zoomLevel > 0.6
          },
          className: getFunctionClassName(complexity, riskScore, func)
        });
      });
    }

    // Create function call edges
    if (graph.functions) {
      graph.functions.forEach(func => {
        func.calls.forEach(call => {
          const targetFunc = graph.functions?.find(f => f.name === call.name);
          if (targetFunc && targetFunc !== func) {
            edges.push({
              id: `call-${func.name}-${call.name}`,
              source: `function-${func.name}`,
              target: `function-${targetFunc.name}`,
              type: 'smoothstep',
              style: {
                stroke: '#666',
                strokeWidth: Math.min(3, call.arguments.length + 1)
              },
              animated: func.isAsync || targetFunc.isAsync,
              label: call.arguments.length > 0 ? `${call.arguments.length} args` : undefined
            });
          }
        });
      });
    }

    // Add error flow edges for try-catch patterns
    if (graph.functions) {
      graph.functions.forEach(func => {
        if (func.name.includes('try') || func.name.includes('catch') || func.name.includes('error')) {
          // Find related functions for error handling
          const relatedFunctions = graph.functions?.filter(f =>
            f !== func && (
              f.filePath === func.filePath ||
              func.calls.some(call => call.name === f.name)
            )
          ) || [];

          relatedFunctions.forEach(related => {
            edges.push({
              id: `error-${func.name}-${related.name}`,
              source: `function-${func.name}`,
              target: `function-${related.name}`,
              type: 'smoothstep',
              style: {
                stroke: '#f44336',
                strokeWidth: 2,
                strokeDasharray: '5,5'
              },
              label: 'error handling',
              animated: true
            });
          });
        }
      });
    }

    return { nodes, edges };
  }, [graph, viewContext, onNodeSelect, onNodeEdit, aiSuggestionsEnabled]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    const sourceFunc = nodes.find(n => n.id === connection.source)?.data?.function;
    const targetFunc = nodes.find(n => n.id === connection.target)?.data?.function;

    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.target}`,
      type: 'smoothstep',
      style: { stroke: '#666', strokeWidth: 2 },
      label: 'calls',
      animated: sourceFunc?.isAsync || targetFunc?.isAsync
    };

    setEdges(eds => addEdge(newEdge, eds));

    onVisualChange?({
      type: 'connect',
      sourceComponent: sourceFunc?.name,
      targetComponent: targetFunc?.name,
      businessIntent: 'Function call relationship established',
      level: 'implementation',
      codeGenerationHint: {
        framework: 'javascript',
        pattern: 'function-call',
        dependencies: [sourceFunc?.name, targetFunc?.name].filter(Boolean)
      }
    });
  }, [nodes, setEdges, onVisualChange]);

  const getImplementationStats = () => {
    const functions = graph.functions || [];
    const asyncFunctions = functions.filter(f => f.isAsync).length;
    const exportedFunctions = functions.filter(f => f.isExported).length;
    const totalComplexity = functions.reduce((sum, f) => sum + calculateFunctionComplexity(f), 0);
    const avgComplexity = functions.length > 0 ? totalComplexity / functions.length : 0;

    const highRiskFunctions = functions.filter(f => calculateRiskScore(f, graph) > 70).length;

    return {
      total: functions.length,
      async: asyncFunctions,
      exported: exportedFunctions,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      highRisk: highRiskFunctions
    };
  };

  const getCodeQualityMetrics = () => {
    const functions = graph.functions || [];
    const wellDocumented = functions.filter(f => f.returnType !== 'unknown').length;
    const withParams = functions.filter(f => f.parameters.length > 0).length;
    const complexFunctions = functions.filter(f => calculateFunctionComplexity(f) > 5).length;

    const antiPatterns = graph.semanticData?.antiPatterns?.filter(ap =>
      ap.type === 'LongParameterList' || ap.type === 'DeadCode'
    ).length || 0;

    return {
      documented: wellDocumented,
      withParams,
      complex: complexFunctions,
      antiPatterns
    };
  };

  const getCriticalFunctions = () => {
    const functions = graph.functions || [];
    return functions
      .filter(f => calculateRiskScore(f, graph) > 80)
      .sort((a, b) => calculateRiskScore(b, graph) - calculateRiskScore(a, graph))
      .slice(0, 3);
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
        maxZoom={2}
      >
        <Background color="#fafafa" gap={15} />
        <Controls />
        <MiniMap
          style={{ background: 'rgba(255, 255, 255, 0.9)' }}
          nodeColor={(node) => {
            if (node.className?.includes('high-risk')) return '#f44336';
            if (node.className?.includes('complex')) return '#ff9800';
            if (node.className?.includes('async')) return '#2196f3';
            return '#4caf50';
          }}
        />
      </ReactFlow>

      {/* Implementation Statistics */}
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
          icon={<Functions />}
          label={`${getImplementationStats().total} Functions`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Api />}
          label={`${getImplementationStats().async} Async`}
          color="info"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<TrendingUp />}
          label={`${getImplementationStats().avgComplexity} avg complexity`}
          color={getImplementationStats().avgComplexity > 4 ? 'warning' : 'success'}
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Error />}
          label={`${getImplementationStats().highRisk} high risk`}
          color={getImplementationStats().highRisk > 0 ? 'error' : 'success'}
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Code Quality Metrics */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          zIndex: 1000
        }}
      >
        <Chip
          icon={<Code />}
          label={`${getCodeQualityMetrics().documented} typed`}
          color="success"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<BugReport />}
          label={`${getCodeQualityMetrics().antiPatterns} issues`}
          color={getCodeQualityMetrics().antiPatterns > 0 ? 'error' : 'success'}
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Security />}
          label={`${getCodeQualityMetrics().complex} complex`}
          color={getCodeQualityMetrics().complex > 5 ? 'warning' : 'success'}
          variant="outlined"
          size="small"
        />
      </Box>

      {/* Critical Functions Alert */}
      {getCriticalFunctions().length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            p: 2,
            maxWidth: 300,
            zIndex: 1000,
            bgcolor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Error color="error" />
            <Box sx={{ fontWeight: 'bold', color: 'error.main' }}>
              Critical Functions
            </Box>
          </Box>
          {getCriticalFunctions().map((func, index) => (
            <Chip
              key={func.name}
              label={func.name}
              size="small"
              color="error"
              variant="outlined"
              sx={{ mr: 1, mb: 1 }}
              onClick={() => onNodeSelect(`function-${func.name}`)}
            />
          ))}
        </Paper>
      )}

      {/* AI Implementation Insights */}
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
          <Tooltip title="AI-powered code analysis and refactoring suggestions">
            <Chip
              icon={<Psychology />}
              label="Code Intelligence"
              color="secondary"
              onClick={() => {
                console.log('Show AI implementation insights');
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

// Helper functions
function calculateFunctionComplexity(func: FunctionInfo): number {
  let complexity = 1; // Base complexity

  // Add complexity for parameters
  complexity += func.parameters.length * 0.5;

  // Add complexity for function calls
  complexity += func.calls.length * 0.3;

  // Add complexity for async functions
  if (func.isAsync) complexity += 1;

  // Add complexity for functions with many responsibilities (heuristic)
  if (func.name.includes('and') || func.name.includes('And')) complexity += 1;

  return Math.min(10, complexity);
}

function calculateRiskScore(func: FunctionInfo, graph: ProjectGraph): number {
  let risk = 0;

  // High complexity increases risk
  const complexity = calculateFunctionComplexity(func);
  risk += complexity * 8;

  // Many parameters increase risk
  if (func.parameters.length > 5) risk += (func.parameters.length - 5) * 5;

  // Unknown return types increase risk
  if (func.returnType === 'unknown' || func.returnType === 'any') risk += 15;

  // Functions called by many other functions are risky if they fail
  const callers = graph.functions?.filter(f =>
    f.calls.some(call => call.name === func.name)
  ).length || 0;
  if (callers > 3) risk += callers * 3;

  // Async functions without proper error handling
  if (func.isAsync && !func.calls.some(call => call.name.includes('catch'))) {
    risk += 20;
  }

  return Math.min(100, risk);
}

function generateFunctionSuggestions(func: FunctionInfo, graph: ProjectGraph) {
  const suggestions = [];
  const complexity = calculateFunctionComplexity(func);
  const risk = calculateRiskScore(func, graph);

  if (complexity > 6) {
    suggestions.push({
      type: 'refactor',
      title: 'Reduce complexity',
      description: `Function complexity is ${complexity.toFixed(1)}. Consider breaking into smaller functions.`
    });
  }

  if (func.parameters.length > 6) {
    suggestions.push({
      type: 'refactor',
      title: 'Simplify parameters',
      description: `Function has ${func.parameters.length} parameters. Consider using an options object.`
    });
  }

  if (func.isAsync && !func.calls.some(call => call.name.includes('catch'))) {
    suggestions.push({
      type: 'security',
      title: 'Add error handling',
      description: 'Async function should have proper error handling.'
    });
  }

  if (func.returnType === 'unknown') {
    suggestions.push({
      type: 'type-safety',
      title: 'Add return type',
      description: 'Function should have explicit return type annotation.'
    });
  }

  if (risk > 70) {
    suggestions.push({
      type: 'critical',
      title: 'High risk function',
      description: `Risk score: ${risk}. Consider adding tests and monitoring.`
    });
  }

  return suggestions;
}

function getFunctionClassName(complexity: number, risk: number, func: FunctionInfo): string {
  const classes = ['implementation-function'];

  if (risk > 70) classes.push('high-risk');
  else if (risk > 40) classes.push('medium-risk');

  if (complexity > 6) classes.push('complex');
  if (func.isAsync) classes.push('async');
  if (func.isExported) classes.push('exported');

  return classes.join(' ');
}

export default ImplementationLevelView;