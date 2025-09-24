import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Divider
} from '@mui/material';
import {
  ExpandMore,
  ChevronLeft,
  ChevronRight,
  Storage,
  Business,
  AccountTree,
  Code,
  Api,
  Database,
  Web,
  Functions,
  DataObject,
  Timeline,
  Person,
  Settings,
  Security,
  Cloud,
  Memory,
  DeviceHub
} from '@mui/icons-material';
import { GraphLevel } from '../MultiLevelGraphManager';

interface PaletteItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: string;
  nodeType: string;
}

interface DragDropPaletteProps {
  currentLevel: GraphLevel;
  onToggle: () => void;
}

const paletteItems: Record<GraphLevel, PaletteItem[]> = {
  system: [
    {
      id: 'microservice',
      label: 'Microservice',
      icon: <Api />,
      description: 'Independent service component',
      category: 'Services',
      nodeType: 'microservice'
    },
    {
      id: 'database',
      label: 'Database',
      icon: <Database />,
      description: 'Data storage system',
      category: 'Data',
      nodeType: 'database'
    },
    {
      id: 'api-gateway',
      label: 'API Gateway',
      icon: <DeviceHub />,
      description: 'API routing and management',
      category: 'Services',
      nodeType: 'apiGateway'
    },
    {
      id: 'load-balancer',
      label: 'Load Balancer',
      icon: <Timeline />,
      description: 'Traffic distribution system',
      category: 'Infrastructure',
      nodeType: 'loadBalancer'
    },
    {
      id: 'message-queue',
      label: 'Message Queue',
      icon: <Memory />,
      description: 'Asynchronous message handling',
      category: 'Communication',
      nodeType: 'messageQueue'
    },
    {
      id: 'external-service',
      label: 'External Service',
      icon: <Cloud />,
      description: 'Third-party service integration',
      category: 'Integration',
      nodeType: 'externalService'
    }
  ],
  business: [
    {
      id: 'user-persona',
      label: 'User Persona',
      icon: <Person />,
      description: 'User type or role definition',
      category: 'Users',
      nodeType: 'userPersona'
    },
    {
      id: 'business-process',
      label: 'Business Process',
      icon: <Business />,
      description: 'Business workflow or process',
      category: 'Processes',
      nodeType: 'businessProcess'
    },
    {
      id: 'user-journey',
      label: 'User Journey',
      icon: <Timeline />,
      description: 'End-to-end user experience flow',
      category: 'Journeys',
      nodeType: 'userJourney'
    },
    {
      id: 'decision-point',
      label: 'Decision Point',
      icon: <Settings />,
      description: 'Business logic decision node',
      category: 'Logic',
      nodeType: 'decisionPoint'
    },
    {
      id: 'data-entity',
      label: 'Data Entity',
      icon: <DataObject />,
      description: 'Business data model',
      category: 'Data',
      nodeType: 'dataEntity'
    },
    {
      id: 'touchpoint',
      label: 'Touchpoint',
      icon: <Web />,
      description: 'Customer interaction point',
      category: 'Interactions',
      nodeType: 'touchpoint'
    }
  ],
  component: [
    {
      id: 'react-component',
      label: 'React Component',
      icon: <AccountTree />,
      description: 'Reusable React component',
      category: 'Components',
      nodeType: 'reactComponent'
    },
    {
      id: 'hook',
      label: 'Custom Hook',
      icon: <Functions />,
      description: 'Custom React hook',
      category: 'Hooks',
      nodeType: 'customHook'
    },
    {
      id: 'context-provider',
      label: 'Context Provider',
      icon: <DeviceHub />,
      description: 'React Context provider',
      category: 'State',
      nodeType: 'contextProvider'
    },
    {
      id: 'hoc',
      label: 'Higher-Order Component',
      icon: <Web />,
      description: 'Component wrapper/enhancer',
      category: 'Patterns',
      nodeType: 'hoc'
    },
    {
      id: 'service',
      label: 'Service',
      icon: <Api />,
      description: 'Business logic service',
      category: 'Services',
      nodeType: 'service'
    },
    {
      id: 'utility',
      label: 'Utility',
      icon: <Settings />,
      description: 'Helper utility function',
      category: 'Utils',
      nodeType: 'utility'
    }
  ],
  implementation: [
    {
      id: 'function',
      label: 'Function',
      icon: <Functions />,
      description: 'JavaScript/TypeScript function',
      category: 'Functions',
      nodeType: 'function'
    },
    {
      id: 'class',
      label: 'Class',
      icon: <Code />,
      description: 'ES6+ class definition',
      category: 'Classes',
      nodeType: 'class'
    },
    {
      id: 'variable',
      label: 'Variable',
      icon: <DataObject />,
      description: 'Variable or constant',
      category: 'Data',
      nodeType: 'variable'
    },
    {
      id: 'interface',
      label: 'Interface',
      icon: <Web />,
      description: 'TypeScript interface',
      category: 'Types',
      nodeType: 'interface'
    },
    {
      id: 'enum',
      label: 'Enum',
      icon: <Timeline />,
      description: 'Enumeration type',
      category: 'Types',
      nodeType: 'enum'
    },
    {
      id: 'module',
      label: 'Module',
      icon: <Storage />,
      description: 'Code module/namespace',
      category: 'Modules',
      nodeType: 'module'
    }
  ]
};

const DragDropPalette: React.FC<DragDropPaletteProps> = ({
  currentLevel,
  onToggle
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string>('');

  const items = paletteItems[currentLevel] || [];
  const categories = Array.from(new Set(items.map(item => item.category)));

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategory(expandedCategory === category ? '' : category);
  };

  if (collapsed) {
    return (
      <Paper
        sx={{
          width: 60,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          borderRadius: 0,
          borderRight: 1,
          borderColor: 'divider'
        }}
      >
        <Tooltip title="Expand Palette" placement="right">
          <IconButton onClick={() => setCollapsed(false)} size="small">
            <ChevronRight />
          </IconButton>
        </Tooltip>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {categories.slice(0, 4).map(category => {
            const categoryItems = items.filter(item => item.category === category);
            const firstItem = categoryItems[0];

            return (
              <Tooltip key={category} title={`${category} (${categoryItems.length})`} placement="right">
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                  onClick={() => setCollapsed(false)}
                >
                  {firstItem?.icon}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderRight: 1,
        borderColor: 'divider'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            Components
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)} Level
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Collapse Palette">
            <IconButton onClick={() => setCollapsed(true)} size="small">
              <ChevronLeft />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Level Indicator */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Chip
          size="small"
          label={`${items.length} components available`}
          color="primary"
          variant="outlined"
          sx={{ fontSize: '0.75rem' }}
        />
      </Box>

      {/* Component Categories */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {categories.map(category => {
          const categoryItems = items.filter(item => item.category === category);

          return (
            <Accordion
              key={category}
              expanded={expandedCategory === category}
              onChange={() => handleCategoryToggle(category)}
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                borderBottom: 1,
                borderColor: 'divider',
                borderRadius: 0
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  minHeight: 48,
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1
                  }
                }}
              >
                {categoryItems[0]?.icon}
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {category}
                </Typography>
                <Chip
                  size="small"
                  label={categoryItems.length}
                  sx={{ ml: 'auto', height: 18, fontSize: '0.625rem' }}
                />
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                <List dense>
                  {categoryItems.map(item => (
                    <ListItem
                      key={item.id}
                      sx={{
                        cursor: 'grab',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:active': { cursor: 'grabbing' },
                        borderRadius: 1,
                        mx: 1,
                        mb: 0.5
                      }}
                      draggable
                      onDragStart={(e) => onDragStart(e, item.nodeType, item.label)}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.label}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Drag components to canvas to create architecture
        </Typography>
      </Box>
    </Paper>
  );
};

export default DragDropPalette;