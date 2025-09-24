import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Paper, Tooltip, Fab, Snackbar, Alert } from '@mui/material';
import {
  Add,
  ContentCopy,
  Delete,
  Undo,
  Redo,
  Save,
  Preview,
  AutoAwesome
} from '@mui/icons-material';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  ReactFlowInstance,
  OnSelectionChangeParams
} from 'reactflow';
import { ProjectGraph, VisualChange } from '../../../../types';
import { GraphLevel } from '../MultiLevelGraphManager';
import DragDropPalette from './DragDropPalette';
import LivePreviewPanel from './LivePreviewPanel';
import ArchitectureToolbar from './ArchitectureToolbar';
import 'reactflow/dist/style.css';

interface DragDropCanvasProps {
  graph: ProjectGraph;
  currentLevel: GraphLevel;
  initialNodes: Node[];
  initialEdges: Edge[];
  onVisualChange?: (change: VisualChange) => void;
  onArchitectureChange?: (nodes: Node[], edges: Edge[]) => void;
  enableAIAssistance?: boolean;
}

interface CanvasAction {
  type: 'node_add' | 'node_delete' | 'node_move' | 'edge_add' | 'edge_delete';
  timestamp: Date;
  data: any;
}

const DragDropCanvas: React.FC<DragDropCanvasProps> = ({
  graph,
  currentLevel,
  initialNodes,
  initialEdges,
  onVisualChange,
  onArchitectureChange,
  enableAIAssistance = true
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [actionHistory, setActionHistory] = useState<CanvasAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showPalette, setShowPalette] = useState(true);
  const [previewCode, setPreviewCode] = useState<string>('');
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Handle node changes with live preview
  const handleNodeChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Track significant changes for AI processing
    const significantChanges = changes.filter(change =>
      change.type === 'position' || change.type === 'dimensions' || change.type === 'add' || change.type === 'remove'
    );

    if (significantChanges.length > 0) {
      const action: CanvasAction = {
        type: 'node_move',
        timestamp: new Date(),
        data: { changes: significantChanges, currentLevel }
      };

      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
      setHistoryIndex(prev => prev + 1);

      // Notify about visual changes for AI processing
      onVisualChange?.({
        type: 'drag',
        sourceComponent: 'canvas',
        properties: { changes: significantChanges, level: currentLevel },
        businessIntent: 'Architecture manipulation in progress'
      });

      // Generate live preview if enabled
      if (enableAIAssistance) {
        generateLivePreview();
      }
    }
  }, [onNodesChange, currentLevel, onVisualChange, historyIndex, enableAIAssistance]);

  // Handle edge changes
  const handleEdgeChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);

    const action: CanvasAction = {
      type: changes[0]?.type === 'remove' ? 'edge_delete' : 'edge_add',
      timestamp: new Date(),
      data: { changes, currentLevel }
    };

    setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
    setHistoryIndex(prev => prev + 1);
  }, [onEdgesChange, currentLevel, historyIndex]);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    const newEdge = addEdge({
      ...connection,
      type: 'smoothstep',
      animated: true
    }, edges);

    setEdges(newEdge);

    // Notify AI about the new connection
    onVisualChange?.({
      type: 'connect',
      sourceComponent: connection.source || '',
      targetComponent: connection.target || '',
      businessIntent: `Connected ${connection.source} to ${connection.target} at ${currentLevel} level`,
      codeGenerationHint: {
        framework: getCurrentFramework(),
        pattern: getConnectionPattern(connection, currentLevel),
        dependencies: [connection.source, connection.target].filter(Boolean) as string[]
      }
    });

    const action: CanvasAction = {
      type: 'edge_add',
      timestamp: new Date(),
      data: { connection, currentLevel }
    };

    setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
    setHistoryIndex(prev => prev + 1);

    showNotification('Connection created. AI is generating code...', 'success');
  }, [edges, setEdges, onVisualChange, currentLevel, historyIndex]);

  // Handle selection changes
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);
    setSelectedEdges(params.edges);
  }, []);

  // Handle drag and drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    if (!reactFlowInstance) return;

    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/reactflow-label');

    if (!type) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: {
        label: label || `New ${type}`,
        onEdit: (nodeId: string, changes: any) => {
          console.log('Node edited:', nodeId, changes);
        }
      }
    };

    setNodes(nds => nds.concat(newNode));

    const action: CanvasAction = {
      type: 'node_add',
      timestamp: new Date(),
      data: { node: newNode, currentLevel }
    };

    setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
    setHistoryIndex(prev => prev + 1);

    // Notify AI about new node
    onVisualChange?.({
      type: 'create',
      sourceComponent: newNode.id,
      properties: { type, label, position },
      businessIntent: `Added new ${type} component to ${currentLevel} level`
    });

    showNotification(`Added new ${type} component`, 'success');
  }, [reactFlowInstance, setNodes, currentLevel, onVisualChange, historyIndex]);

  // Generate live preview
  const generateLivePreview = useCallback(async () => {
    if (!enableAIAssistance) return;

    try {
      // Simulate AI code generation
      const architectureSnapshot = {
        level: currentLevel,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target }))
      };

      // This would be replaced with actual AI API call
      const mockPreview = generateMockPreview(architectureSnapshot);
      setPreviewCode(mockPreview);

    } catch (error) {
      console.error('Failed to generate preview:', error);
      showNotification('Failed to generate code preview', 'warning');
    }
  }, [enableAIAssistance, currentLevel, nodes, edges]);

  // Undo/Redo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      // Apply previous state
      showNotification('Action undone', 'info');
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < actionHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
      // Apply next state
      showNotification('Action redone', 'info');
    }
  }, [historyIndex, actionHistory.length]);

  // Delete selected items
  const handleDelete = useCallback(() => {
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      const nodeIdsToDelete = selectedNodes.map(n => n.id);
      const edgeIdsToDelete = selectedEdges.map(e => e.id);

      setNodes(nds => nds.filter(n => !nodeIdsToDelete.includes(n.id)));
      setEdges(eds => eds.filter(e => !edgeIdsToDelete.includes(e.id)));

      const action: CanvasAction = {
        type: 'node_delete',
        timestamp: new Date(),
        data: { deletedNodes: nodeIdsToDelete, deletedEdges: edgeIdsToDelete, currentLevel }
      };

      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
      setHistoryIndex(prev => prev + 1);

      showNotification(`Deleted ${nodeIdsToDelete.length} nodes and ${edgeIdsToDelete.length} edges`, 'info');
    }
  }, [selectedNodes, selectedEdges, setNodes, setEdges, currentLevel, historyIndex]);

  // Copy selected items
  const handleCopy = useCallback(() => {
    if (selectedNodes.length > 0) {
      const copiedNodes = selectedNodes.map(node => ({
        ...node,
        id: `${node.id}-copy-${Date.now()}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50
        }
      }));

      setNodes(nds => [...nds, ...copiedNodes]);
      showNotification(`Copied ${copiedNodes.length} nodes`, 'success');
    }
  }, [selectedNodes, setNodes]);

  // Save architecture
  const handleSave = useCallback(() => {
    onArchitectureChange?.(nodes, edges);
    showNotification('Architecture saved successfully', 'success');
  }, [nodes, edges, onArchitectureChange]);

  // Show notification
  const showNotification = (message: string, severity: 'success' | 'info' | 'warning' | 'error') => {
    setNotification({ open: true, message, severity });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'z':
            event.preventDefault();
            if (event.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'c':
            event.preventDefault();
            handleCopy();
            break;
          case 's':
            event.preventDefault();
            handleSave();
            break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            handleDelete();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handleSave, handleDelete]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', display: 'flex' }}>
      {/* Drag and Drop Palette */}
      {showPalette && (
        <DragDropPalette
          currentLevel={currentLevel}
          onToggle={() => setShowPalette(!showPalette)}
        />
      )}

      {/* Main Canvas */}
      <Box
        ref={reactFlowWrapper}
        sx={{ flexGrow: 1, height: '100%' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodeChange}
          onEdgesChange={handleEdgeChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onInit={setReactFlowInstance}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#f0f0f0" gap={16} />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* Architecture Toolbar */}
        <ArchitectureToolbar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onSave={handleSave}
          onTogglePreview={() => setShowPreview(!showPreview)}
          onTogglePalette={() => setShowPalette(!showPalette)}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < actionHistory.length - 1}
          selectedCount={selectedNodes.length + selectedEdges.length}
        />
      </Box>

      {/* Live Preview Panel */}
      {showPreview && enableAIAssistance && (
        <LivePreviewPanel
          code={previewCode}
          currentLevel={currentLevel}
          onClose={() => setShowPreview(false)}
          onApplyCode={(code) => {
            console.log('Applying generated code:', code);
            showNotification('Code applied successfully', 'success');
          }}
        />
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Helper functions
function getCurrentFramework(): string {
  return 'react'; // Could be dynamic based on project analysis
}

function getConnectionPattern(connection: Connection, level: GraphLevel): string {
  switch (level) {
    case 'system': return 'service-integration';
    case 'business': return 'workflow-connection';
    case 'component': return 'component-composition';
    case 'implementation': return 'function-call';
    default: return 'generic-connection';
  }
}

function generateMockPreview(architecture: any): string {
  return `// Generated code for ${architecture.level} level
// Nodes: ${architecture.nodes.length}
// Edges: ${architecture.edges.length}

${architecture.nodes.map((node: any) => `
// ${node.type}: ${node.id}
const ${node.id.replace(/[^a-zA-Z0-9]/g, '')} = {
  id: '${node.id}',
  type: '${node.type}',
  data: ${JSON.stringify(node.data, null, 2)}
};
`).join('\n')}

${architecture.edges.map((edge: any) => `
// Connection: ${edge.source} -> ${edge.target}
// Implementation would depend on the connection type and level
`).join('\n')}
`;
}

const DragDropCanvasWrapper: React.FC<DragDropCanvasProps> = (props) => (
  <ReactFlowProvider>
    <DragDropCanvas {...props} />
  </ReactFlowProvider>
);

export default DragDropCanvasWrapper;