import React, { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Panel,
  ReactFlowProvider
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  ButtonGroup,
  Switch,
  FormControlLabel
} from '@mui/material'
import dagre from 'dagre'
import { ProjectGraph, DependencyNode, DependencyEdge } from '../types'

interface GraphVisualizationProps {
  graph: ProjectGraph | null
}

const nodeWidth = 172
const nodeHeight = 36

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'component':
      return '#4CAF50' // Green
    case 'function':
      return '#2196F3' // Blue
    case 'file':
      return '#FF9800' // Orange
    case 'hook':
      return '#9C27B0' // Purple
    default:
      return '#757575' // Gray
  }
}

const getEdgeColor = (type: string) => {
  switch (type) {
    case 'imports':
      return '#666'
    case 'calls':
      return '#2196F3'
    case 'renders':
      return '#4CAF50'
    case 'passes_props':
      return '#FF5722'
    default:
      return '#999'
  }
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ graph }) => {
  const [filterType, setFilterType] = useState<string>('all')
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB')
  const [showLabels, setShowLabels] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)

  const initialNodes = useMemo(() => {
    if (!graph) return []

    let filteredNodes = graph.dependencies.nodes

    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === filterType)
    }

    return filteredNodes.map((node: DependencyNode): Node => ({
      id: node.id,
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        label: showLabels ? node.label : '',
      },
      style: {
        background: getNodeColor(node.type),
        color: 'white',
        border: '1px solid #222138',
        width: nodeWidth,
        fontSize: '12px',
      },
    }))
  }, [graph, filterType, showLabels])

  const initialEdges = useMemo(() => {
    if (!graph) return []

    const nodeIds = new Set(initialNodes.map(n => n.id))

    return graph.dependencies.edges
      .filter((edge: DependencyEdge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
      .map((edge: DependencyEdge): Edge => ({
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        animated: edge.type === 'calls',
        style: {
          stroke: getEdgeColor(edge.type),
          strokeWidth: 2,
        },
        label: edge.type,
        labelStyle: { fontSize: '10px', fontWeight: 'bold' },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#ffcc00', color: '#333', fillOpacity: 0.7 },
      }))
  }, [graph, initialNodes])

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges, layoutDirection),
    [initialNodes, initialEdges, layoutDirection]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      )

      setNodes([...layoutedNodes])
      setEdges([...layoutedEdges])
      setLayoutDirection(direction)
    },
    [nodes, edges, setNodes, setEdges]
  )

  if (!graph) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Dependency Graph
          </Typography>
          <Typography variant="body2" color="textSecondary">
            No project analyzed yet. Please analyze a project first.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const stats = {
    totalNodes: graph.dependencies.nodes.length,
    totalEdges: graph.dependencies.edges.length,
    nodeTypes: graph.dependencies.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  return (
    <Box sx={{ height: '100vh', width: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <MiniMap
            style={{ display: showMinimap ? 'block' : 'none' }}
            nodeColor={(node) => getNodeColor(node.data.type || 'default')}
          />
          <Background variant="dots" gap={12} size={1} />

          <Panel position="top-right">
            <Card sx={{ minWidth: 300, maxWidth: 400 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Graph Controls
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Filter by Type</InputLabel>
                    <Select
                      value={filterType}
                      label="Filter by Type"
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="component">Components</MenuItem>
                      <MenuItem value="function">Functions</MenuItem>
                      <MenuItem value="file">Files</MenuItem>
                      <MenuItem value="hook">Hooks</MenuItem>
                    </Select>
                  </FormControl>

                  <ButtonGroup fullWidth size="small" sx={{ mb: 1 }}>
                    <Button
                      variant={layoutDirection === 'TB' ? 'contained' : 'outlined'}
                      onClick={() => onLayout('TB')}
                    >
                      Vertical
                    </Button>
                    <Button
                      variant={layoutDirection === 'LR' ? 'contained' : 'outlined'}
                      onClick={() => onLayout('LR')}
                    >
                      Horizontal
                    </Button>
                  </ButtonGroup>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showLabels}
                          onChange={(e) => setShowLabels(e.target.checked)}
                        />
                      }
                      label="Show Labels"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showMinimap}
                          onChange={(e) => setShowMinimap(e.target.checked)}
                        />
                      }
                      label="Show Minimap"
                    />
                  </Box>
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                  Statistics
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {stats.totalNodes} nodes, {stats.totalEdges} edges
                </Typography>

                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Object.entries(stats.nodeTypes).map(([type, count]) => (
                    <Chip
                      key={type}
                      label={`${type}: ${count}`}
                      size="small"
                      style={{
                        backgroundColor: getNodeColor(type),
                        color: 'white'
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  )
}

export default GraphVisualization