import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Paper, Tabs, Tab, IconButton, Tooltip, Zoom, Fade } from '@mui/material';
import {
  AccountTree,
  Business,
  Code,
  Storage,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Layers,
  ViewModule,
  Timeline
} from '@mui/icons-material';
import { ReactFlow, Background, Controls, MiniMap } from 'reactflow';
import { ProjectGraph, ComponentInfo, BusinessProcess, UserJourney } from '../../../types';
import SystemLevelView from './views/SystemLevelView';
import BusinessFlowView from './views/BusinessFlowView';
import ComponentLevelView from './views/ComponentLevelView';
import ImplementationLevelView from './views/ImplementationLevelView';
import ViewTransitionControls from './controls/ViewTransitionControls';
import CollaborationOverlay from './overlays/CollaborationOverlay';

export type GraphLevel = 'system' | 'business' | 'component' | 'implementation';

export interface ViewContext {
  level: GraphLevel;
  selectedNodes: Set<string>;
  focusedComponent?: string;
  zoomLevel: number;
  panPosition: { x: number; y: number };
  filters: {
    showOnlyRelated: boolean;
    hideExternalDeps: boolean;
    groupBySimilarity: boolean;
    highlightCriticalPath: boolean;
  };
}

export interface MultiLevelGraphProps {
  graph: ProjectGraph;
  onNodeSelect?: (nodeId: string, level: GraphLevel) => void;
  onNodeEdit?: (nodeId: string, changes: any) => void;
  onVisualChange?: (change: any) => void;
  enableCollaboration?: boolean;
  aiSuggestionsEnabled?: boolean;
}

const MultiLevelGraphManager: React.FC<MultiLevelGraphProps> = ({
  graph,
  onNodeSelect,
  onNodeEdit,
  onVisualChange,
  enableCollaboration = false,
  aiSuggestionsEnabled = true
}) => {
  const [currentLevel, setCurrentLevel] = useState<GraphLevel>('component');
  const [viewHistory, setViewHistory] = useState<GraphLevel[]>(['component']);
  const [viewContext, setViewContext] = useState<ViewContext>({
    level: 'component',
    selectedNodes: new Set(),
    zoomLevel: 1,
    panPosition: { x: 0, y: 0 },
    filters: {
      showOnlyRelated: false,
      hideExternalDeps: true,
      groupBySimilarity: false,
      highlightCriticalPath: false
    }
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const levelConfigs = useMemo(() => ({
    system: {
      label: 'System Architecture',
      icon: <Storage />,
      description: 'High-level system components, databases, and external services',
      color: '#1976d2'
    },
    business: {
      label: 'Business Flows',
      icon: <Business />,
      description: 'User journeys, business processes, and domain workflows',
      color: '#388e3c'
    },
    component: {
      label: 'Component Graph',
      icon: <AccountTree />,
      description: 'React components, dependencies, and relationships',
      color: '#f57c00'
    },
    implementation: {
      label: 'Code Implementation',
      icon: <Code />,
      description: 'Functions, classes, and implementation details',
      color: '#7b1fa2'
    }
  }), []);

  const handleLevelChange = useCallback(async (newLevel: GraphLevel) => {
    if (newLevel === currentLevel || isTransitioning) return;

    setIsTransitioning(true);

    // Add to history for navigation
    setViewHistory(prev => [...prev, newLevel]);

    // Smooth transition with context preservation
    setTimeout(() => {
      setCurrentLevel(newLevel);
      setViewContext(prev => ({
        ...prev,
        level: newLevel,
        selectedNodes: new Set() // Reset selection on level change
      }));
      setIsTransitioning(false);
    }, 300);
  }, [currentLevel, isTransitioning]);

  const handleNodeSelection = useCallback((nodeId: string) => {
    setViewContext(prev => {
      const newSelected = new Set(prev.selectedNodes);
      if (newSelected.has(nodeId)) {
        newSelected.delete(nodeId);
      } else {
        newSelected.add(nodeId);
      }
      return { ...prev, selectedNodes: newSelected };
    });

    onNodeSelect?.(nodeId, currentLevel);
  }, [currentLevel, onNodeSelect]);

  const handleZoomToFit = useCallback(() => {
    // Trigger zoom to fit functionality
    setViewContext(prev => ({ ...prev, zoomLevel: 1, panPosition: { x: 0, y: 0 } }));
  }, []);

  const handleDrillDown = useCallback((nodeId: string, targetLevel: GraphLevel) => {
    setViewContext(prev => ({
      ...prev,
      focusedComponent: nodeId,
      selectedNodes: new Set([nodeId])
    }));
    handleLevelChange(targetLevel);
  }, [handleLevelChange]);

  const handleBreadcrumbNav = useCallback((targetLevel: GraphLevel) => {
    const levelIndex = viewHistory.lastIndexOf(targetLevel);
    if (levelIndex !== -1) {
      setViewHistory(prev => prev.slice(0, levelIndex + 1));
      handleLevelChange(targetLevel);
    }
  }, [viewHistory, handleLevelChange]);

  const renderCurrentView = () => {
    const commonProps = {
      graph,
      viewContext,
      onNodeSelect: handleNodeSelection,
      onNodeEdit,
      onVisualChange,
      onDrillDown: handleDrillDown,
      aiSuggestionsEnabled
    };

    switch (currentLevel) {
      case 'system':
        return <SystemLevelView {...commonProps} />;
      case 'business':
        return <BusinessFlowView {...commonProps} />;
      case 'component':
        return <ComponentLevelView {...commonProps} />;
      case 'implementation':
        return <ImplementationLevelView {...commonProps} />;
      default:
        return <ComponentLevelView {...commonProps} />;
    }
  };

  const getCurrentLevelData = () => {
    switch (currentLevel) {
      case 'system':
        return {
          nodeCount: (graph.semanticData?.businessDomains?.length || 0) +
                    (graph.dependencies?.nodes?.filter(n => n.type === 'file')?.length || 0),
          description: 'System services and external integrations'
        };
      case 'business':
        return {
          nodeCount: graph.userJourneys?.length || 0,
          description: `${graph.userJourneys?.length || 0} user journeys mapped`
        };
      case 'component':
        return {
          nodeCount: graph.components?.length || 0,
          description: `${graph.components?.length || 0} React components analyzed`
        };
      case 'implementation':
        return {
          nodeCount: graph.functions?.length || 0,
          description: `${graph.functions?.length || 0} functions and methods`
        };
      default:
        return { nodeCount: 0, description: 'No data available' };
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Level Navigation Tabs */}
      <Paper sx={{ borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2 }}>
          <Tabs
            value={currentLevel}
            onChange={(_, value) => handleLevelChange(value)}
            sx={{ flexGrow: 1 }}
          >
            {Object.entries(levelConfigs).map(([level, config]) => (
              <Tab
                key={level}
                value={level}
                icon={config.icon}
                label={config.label}
                sx={{
                  minHeight: 72,
                  '&.Mui-selected': {
                    color: config.color,
                    '& .MuiSvgIcon-root': { color: config.color }
                  }
                }}
              />
            ))}
          </Tabs>

          {/* View Controls */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Zoom to Fit">
              <IconButton onClick={handleZoomToFit}>
                <CenterFocusStrong />
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle Layers">
              <IconButton>
                <Layers />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Settings">
              <IconButton>
                <ViewModule />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Current Level Info */}
        <Box sx={{ px: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: levelConfigs[currentLevel].color }}>
              {levelConfigs[currentLevel].icon}
            </Box>
            <Box>
              <Box sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                {getCurrentLevelData().nodeCount} nodes
              </Box>
              <Box sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                {getCurrentLevelData().description}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Breadcrumb Navigation */}
        <ViewTransitionControls
          currentLevel={currentLevel}
          viewHistory={viewHistory}
          onNavigate={handleBreadcrumbNav}
          isTransitioning={isTransitioning}
        />
      </Paper>

      {/* Graph View Container */}
      <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        <Fade in={!isTransitioning} timeout={300}>
          <Box sx={{ width: '100%', height: '100%' }}>
            {renderCurrentView()}
          </Box>
        </Fade>

        {/* Collaboration Overlay */}
        {enableCollaboration && (
          <CollaborationOverlay
            currentLevel={currentLevel}
            selectedNodes={Array.from(viewContext.selectedNodes)}
            onCollaborationEvent={(event) => {
              console.log('Collaboration event:', event);
              onVisualChange?.(event);
            }}
          />
        )}

        {/* Transition Loading */}
        {isTransitioning && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Timeline sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Box>Transitioning to {levelConfigs[currentLevel].label}...</Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MultiLevelGraphManager;