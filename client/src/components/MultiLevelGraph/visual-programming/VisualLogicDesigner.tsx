import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Alert
} from '@mui/material';
import {
  AccountTree,
  Functions,
  DataObject,
  CompareArrows,
  PlayArrow,
  Save,
  Code,
  Visibility,
  Edit,
  Add,
  Psychology
} from '@mui/icons-material';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider
} from 'reactflow';
import LogicNodeTypes from './nodes/LogicNodeTypes';
import DataFlowNode from './nodes/DataFlowNode';
import ConditionalNode from './nodes/ConditionalNode';
import ActionNode from './nodes/ActionNode';
import LogicPalette from './LogicPalette';
import FlowExecutionPanel from './FlowExecutionPanel';
import CodeGenerationPanel from './CodeGenerationPanel';

const nodeTypes = {
  dataFlow: DataFlowNode,
  conditional: ConditionalNode,
  action: ActionNode,
  ...LogicNodeTypes
};

interface VisualLogicDesignerProps {
  onLogicSave?: (logic: any) => void;
  onCodeGenerate?: (code: string) => void;
  enableAI?: boolean;
}

interface LogicFlow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  variables: Variable[];
  functions: LogicFunction[];
}

interface Variable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: any;
  scope: 'global' | 'local' | 'parameter';
}

interface LogicFunction {
  id: string;
  name: string;
  description: string;
  parameters: Variable[];
  returnType: string;
  nodes: string[];
}

const VisualLogicDesigner: React.FC<VisualLogicDesignerProps> = ({
  onLogicSave,
  onCodeGenerate,
  enableAI = true
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [showPalette, setShowPalette] = useState(true);
  const [showExecution, setShowExecution] = useState(false);
  const [showCodeGen, setShowCodeGen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [logicFlow, setLogicFlow] = useState<LogicFlow>({
    id: 'flow-1',
    name: 'Business Logic Flow',
    description: 'Main business logic implementation',
    nodes: [],
    edges: [],
    variables: [
      {
        id: 'var-1',
        name: 'userInput',
        type: 'object',
        value: {},
        scope: 'global'
      },
      {
        id: 'var-2',
        name: 'result',
        type: 'object',
        value: {},
        scope: 'global'
      }
    ],
    functions: []
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(logicFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(logicFlow.edges);

  const [executionState, setExecutionState] = useState({
    currentNodeId: null,
    executionLog: [],
    variables: new Map(),
    isRunning: false
  });

  const tabs = [
    { id: 'design', label: 'Logic Design', icon: <AccountTree /> },
    { id: 'variables', label: 'Variables', icon: <DataObject /> },
    { id: 'functions', label: 'Functions', icon: <Functions /> },
    { id: 'preview', label: 'Preview', icon: <Visibility /> }
  ];

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: 'smoothstep',
      animated: true,
      style: { strokeWidth: 2 }
    };

    setEdges(eds => addEdge(newEdge, eds));

    // Update logic flow state
    setLogicFlow(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge]
    }));
  }, [setEdges]);

  // Handle drag and drop from palette
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const nodeType = event.dataTransfer.getData('application/reactflow');
    const nodeLabel = event.dataTransfer.getData('application/reactflow-label');

    if (!nodeType) return;

    const position = {
      x: event.clientX - 250, // Adjust for palette width
      y: event.clientY - 100
    };

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: {
        label: nodeLabel,
        config: getDefaultNodeConfig(nodeType),
        onEdit: (nodeId: string, newData: any) => {
          setNodes(nds => nds.map(n =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
          ));
        }
      }
    };

    setNodes(nds => nds.concat(newNode));

    // Update logic flow state
    setLogicFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  }, [setNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Execute the logic flow
  const executeFlow = useCallback(async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setShowExecution(true);
    setExecutionState(prev => ({ ...prev, isRunning: true }));

    try {
      const executor = new LogicFlowExecutor(logicFlow, setExecutionState);
      await executor.execute();
    } catch (error) {
      console.error('Flow execution failed:', error);
    } finally {
      setIsExecuting(false);
      setExecutionState(prev => ({ ...prev, isRunning: false }));
    }
  }, [logicFlow, isExecuting]);

  // Generate code from visual logic
  const generateCode = useCallback(() => {
    const generator = new LogicCodeGenerator(logicFlow);
    const generatedCode = generator.generateTypeScript();

    setShowCodeGen(true);
    onCodeGenerate?.(generatedCode);
  }, [logicFlow, onCodeGenerate]);

  // Save logic flow
  const saveFlow = useCallback(() => {
    const flowToSave = {
      ...logicFlow,
      nodes,
      edges
    };

    setLogicFlow(flowToSave);
    onLogicSave?.(flowToSave);
  }, [logicFlow, nodes, edges, onLogicSave]);

  const getFlowStats = () => {
    const nodeTypes = nodes.reduce((acc, node) => {
      acc[node.type || 'unknown'] = (acc[node.type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes,
      complexity: calculateFlowComplexity(nodes, edges)
    };
  };

  const renderCurrentTab = () => {
    switch (currentTab) {
      case 0: // Design
        return (
          <Box sx={{ height: '100%', position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background color="#f0f0f0" gap={20} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </Box>
        );

      case 1: // Variables
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Flow Variables
            </Typography>
            {logicFlow.variables.map(variable => (
              <Paper key={variable.id} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {variable.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Type: {variable.type} | Scope: {variable.scope}
                    </Typography>
                  </Box>
                  <Chip label={variable.type} size="small" />
                </Box>
              </Paper>
            ))}
            <Button startIcon={<Add />} variant="outlined" fullWidth>
              Add Variable
            </Button>
          </Box>
        );

      case 2: // Functions
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Logic Functions
            </Typography>
            {logicFlow.functions.map(func => (
              <Paper key={func.id} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1">
                  {func.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {func.description}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Chip label={`${func.parameters.length} params`} size="small" />
                  <Chip label={func.returnType} size="small" color="primary" />
                </Box>
              </Paper>
            ))}
            <Button startIcon={<Add />} variant="outlined" fullWidth>
              Add Function
            </Button>
          </Box>
        );

      case 3: // Preview
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Flow Preview
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              This flow contains {getFlowStats().totalNodes} nodes and {getFlowStats().totalEdges} connections.
              Complexity score: {getFlowStats().complexity}
            </Alert>

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {Object.entries(getFlowStats().nodeTypes).map(([type, count]) => (
                <Chip
                  key={type}
                  label={`${type}: ${count}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>

            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={executeFlow}
              disabled={isExecuting}
              fullWidth
              sx={{ mb: 1 }}
            >
              {isExecuting ? 'Executing...' : 'Execute Flow'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<Code />}
              onClick={generateCode}
              fullWidth
            >
              Generate Code
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      {/* Logic Palette */}
      {showPalette && (
        <LogicPalette
          onToggle={() => setShowPalette(!showPalette)}
          variables={logicFlow.variables}
          functions={logicFlow.functions}
        />
      )}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Paper sx={{ borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography variant="h6">
                {logicFlow.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {logicFlow.description}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Toggle Palette">
                <IconButton onClick={() => setShowPalette(!showPalette)}>
                  <Edit />
                </IconButton>
              </Tooltip>

              {enableAI && (
                <Tooltip title="AI Assistance">
                  <IconButton color="secondary">
                    <Psychology />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Save Flow">
                <IconButton onClick={saveFlow} color="primary">
                  <Save />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs
            value={currentTab}
            onChange={(_, value) => setCurrentTab(value)}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={tab.id}
                icon={tab.icon}
                label={tab.label}
                sx={{ minHeight: 48 }}
              />
            ))}
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderCurrentTab()}
        </Box>
      </Box>

      {/* Execution Panel */}
      {showExecution && (
        <FlowExecutionPanel
          executionState={executionState}
          onClose={() => setShowExecution(false)}
          flow={logicFlow}
        />
      )}

      {/* Code Generation Panel */}
      {showCodeGen && (
        <CodeGenerationPanel
          flow={logicFlow}
          onClose={() => setShowCodeGen(false)}
          onApplyCode={(code) => {
            onCodeGenerate?.(code);
            setShowCodeGen(false);
          }}
        />
      )}
    </Box>
  );
};

// Helper functions and classes
function getDefaultNodeConfig(nodeType: string) {
  switch (nodeType) {
    case 'conditional':
      return { condition: 'value > 0', trueLabel: 'Yes', falseLabel: 'No' };
    case 'action':
      return { actionType: 'assign', target: 'result', expression: 'value' };
    case 'dataFlow':
      return { operation: 'transform', input: 'data', output: 'result' };
    default:
      return {};
  }
}

function calculateFlowComplexity(nodes: Node[], edges: Edge[]): number {
  const conditionalNodes = nodes.filter(n => n.type === 'conditional').length;
  const loopNodes = nodes.filter(n => n.type === 'loop').length;
  const totalConnections = edges.length;

  return conditionalNodes * 2 + loopNodes * 3 + totalConnections * 0.5;
}

class LogicFlowExecutor {
  constructor(
    private flow: LogicFlow,
    private setState: React.Dispatch<React.SetStateAction<any>>
  ) {}

  async execute(): Promise<void> {
    // Simulate flow execution
    const startNodes = this.flow.nodes.filter(node =>
      !this.flow.edges.some(edge => edge.target === node.id)
    );

    for (const startNode of startNodes) {
      await this.executeNode(startNode.id);
    }
  }

  private async executeNode(nodeId: string): Promise<any> {
    const node = this.flow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.setState((prev: any) => ({
      ...prev,
      currentNodeId: nodeId,
      executionLog: [...prev.executionLog, { nodeId, timestamp: new Date(), status: 'executing' }]
    }));

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find next nodes
    const nextEdges = this.flow.edges.filter(edge => edge.source === nodeId);

    for (const edge of nextEdges) {
      await this.executeNode(edge.target);
    }
  }
}

class LogicCodeGenerator {
  constructor(private flow: LogicFlow) {}

  generateTypeScript(): string {
    return `// Generated from Visual Logic Designer
// Flow: ${this.flow.name}
// Description: ${this.flow.description}

${this.generateInterfaces()}

${this.generateMainFunction()}

${this.generateNodeFunctions()}

export default ${this.flow.name.replace(/\s+/g, '')};
`;
  }

  private generateInterfaces(): string {
    return `interface FlowContext {
  variables: Map<string, any>;
  input: any;
  output: any;
}

interface NodeResult {
  success: boolean;
  value: any;
  nextNodes: string[];
}`;
  }

  private generateMainFunction(): string {
    return `async function ${this.flow.name.replace(/\s+/g, '')}(input: any): Promise<any> {
  const context: FlowContext = {
    variables: new Map(),
    input,
    output: {}
  };

  ${this.flow.variables.map(v => `context.variables.set('${v.name}', ${JSON.stringify(v.value)});`).join('\n  ')}

  // Execute flow logic
  const result = await executeFlow(context);
  return result;
}`;
  }

  private generateNodeFunctions(): string {
    return this.flow.nodes.map(node => {
      switch (node.type) {
        case 'conditional':
          return `// Conditional Node: ${node.id}
function ${node.id}(context: FlowContext): NodeResult {
  const condition = ${node.data.config?.condition || 'true'};
  return {
    success: true,
    value: condition,
    nextNodes: condition ? ['${node.data.config?.trueNext || ''}'] : ['${node.data.config?.falseNext || ''}']
  };
}`;

        case 'action':
          return `// Action Node: ${node.id}
function ${node.id}(context: FlowContext): NodeResult {
  // ${node.data.config?.actionType || 'action'} operation
  const result = performAction(context, '${node.data.config?.target || ''}', '${node.data.config?.expression || ''}');
  return {
    success: true,
    value: result,
    nextNodes: ['${node.data.config?.next || ''}']
  };
}`;

        default:
          return `// Node: ${node.id}
function ${node.id}(context: FlowContext): NodeResult {
  return {
    success: true,
    value: null,
    nextNodes: []
  };
}`;
      }
    }).join('\n\n');
  }
}

const VisualLogicDesignerWrapper: React.FC<VisualLogicDesignerProps> = (props) => (
  <ReactFlowProvider>
    <VisualLogicDesigner {...props} />
  </ReactFlowProvider>
);

export default VisualLogicDesignerWrapper;