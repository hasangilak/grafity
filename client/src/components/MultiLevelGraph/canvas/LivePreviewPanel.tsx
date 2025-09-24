import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Tabs,
  Tab,
  Chip,
  Alert,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  Close,
  Code,
  PlayArrow,
  Download,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Info,
  Psychology,
  AutoAwesome
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GraphLevel } from '../MultiLevelGraphManager';

interface LivePreviewPanelProps {
  code: string;
  currentLevel: GraphLevel;
  onClose: () => void;
  onApplyCode: (code: string) => void;
}

interface PreviewTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: string;
  language: string;
}

interface AIInsight {
  type: 'suggestion' | 'warning' | 'optimization' | 'pattern';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  code,
  currentLevel,
  onClose,
  onApplyCode
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(code);
  const [aiInsights, setAIInsights] = useState<AIInsight[]>([]);

  const tabs: PreviewTab[] = [
    {
      id: 'generated',
      label: 'Generated Code',
      icon: <Code />,
      content: generatedCode,
      language: getLanguageForLevel(currentLevel)
    },
    {
      id: 'types',
      label: 'Types',
      icon: <Info />,
      content: generateTypesCode(currentLevel),
      language: 'typescript'
    },
    {
      id: 'tests',
      label: 'Tests',
      icon: <CheckCircle />,
      content: generateTestsCode(currentLevel),
      language: 'typescript'
    },
    {
      id: 'config',
      label: 'Configuration',
      icon: <Warning />,
      content: generateConfigCode(currentLevel),
      language: 'json'
    }
  ];

  useEffect(() => {
    setGeneratedCode(code);
    generateAIInsights();
  }, [code]);

  const generateAIInsights = async () => {
    // Simulate AI analysis
    const insights: AIInsight[] = [
      {
        type: 'suggestion',
        title: 'Code Structure',
        description: 'Consider extracting common patterns into reusable utilities.',
        severity: 'medium'
      },
      {
        type: 'optimization',
        title: 'Performance',
        description: 'Implement lazy loading for large components.',
        severity: 'low'
      },
      {
        type: 'pattern',
        title: 'Architecture Pattern',
        description: 'This follows the Observer pattern well.',
        severity: 'low'
      }
    ];

    setAIInsights(insights);
  };

  const handleRefreshCode = async () => {
    setIsGenerating(true);

    // Simulate AI code regeneration
    setTimeout(() => {
      const refreshedCode = `${generatedCode}\n\n// Refreshed at ${new Date().toLocaleTimeString()}`;
      setGeneratedCode(refreshedCode);
      setIsGenerating(false);
    }, 2000);
  };

  const handleApplyCode = () => {
    onApplyCode(generatedCode);
    onClose();
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning': return 'warning';
      case 'optimization': return 'info';
      case 'pattern': return 'success';
      default: return 'primary';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <Warning />;
      case 'optimization': return <AutoAwesome />;
      case 'pattern': return <CheckCircle />;
      default: return <Psychology />;
    }
  };

  return (
    <Paper
      sx={{
        width: 450,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: 1,
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
            Live Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)} Level
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh Code">
            <IconButton onClick={handleRefreshCode} disabled={isGenerating} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Close Preview">
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Generation Progress */}
      {isGenerating && (
        <Box sx={{ px: 2, py: 1 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            AI is regenerating code...
          </Typography>
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, newValue) => setCurrentTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            sx={{ minHeight: 40, fontSize: '0.75rem', minWidth: 80 }}
          />
        ))}
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {tabs[currentTab] && (
          <SyntaxHighlighter
            language={tabs[currentTab].language}
            style={tomorrow}
            customStyle={{
              margin: 0,
              fontSize: '12px',
              lineHeight: 1.4,
              height: '100%'
            }}
            showLineNumbers
            wrapLines
          >
            {tabs[currentTab].content}
          </SyntaxHighlighter>
        )}
      </Box>

      {/* AI Insights */}
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          maxHeight: 200,
          overflow: 'auto'
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology color="primary" />
            AI Insights
          </Typography>
        </Box>

        <Box sx={{ px: 2, pb: 2 }}>
          {aiInsights.map((insight, index) => (
            <Alert
              key={index}
              icon={getInsightIcon(insight.type)}
              severity={getInsightColor(insight.type) as any}
              sx={{ mb: 1, fontSize: '0.75rem' }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {insight.title}
              </Typography>
              <Typography variant="caption" display="block">
                {insight.description}
              </Typography>
            </Alert>
          ))}
        </Box>
      </Box>

      {/* Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1
        }}
      >
        <Button
          variant="contained"
          onClick={handleApplyCode}
          startIcon={<PlayArrow />}
          size="small"
          fullWidth
          disabled={isGenerating}
        >
          Apply Code
        </Button>

        <Button
          variant="outlined"
          startIcon={<Download />}
          size="small"
          onClick={() => {
            const blob = new Blob([generatedCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `generated-${currentLevel}-code.${getFileExtension(currentLevel)}`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download
        </Button>
      </Box>
    </Paper>
  );
};

// Helper functions
function getLanguageForLevel(level: GraphLevel): string {
  switch (level) {
    case 'system': return 'yaml';
    case 'business': return 'markdown';
    case 'component': return 'typescript';
    case 'implementation': return 'typescript';
    default: return 'javascript';
  }
}

function getFileExtension(level: GraphLevel): string {
  switch (level) {
    case 'system': return 'yaml';
    case 'business': return 'md';
    case 'component': return 'tsx';
    case 'implementation': return 'ts';
    default: return 'js';
  }
}

function generateTypesCode(level: GraphLevel): string {
  switch (level) {
    case 'system':
      return `interface SystemComponent {
  id: string;
  name: string;
  type: 'microservice' | 'database' | 'api' | 'queue';
  endpoints: Endpoint[];
  dependencies: string[];
}

interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
}`;

    case 'business':
      return `interface BusinessProcess {
  id: string;
  name: string;
  steps: ProcessStep[];
  actors: Actor[];
  dataInputs: DataInput[];
  dataOutputs: DataOutput[];
}

interface ProcessStep {
  id: string;
  name: string;
  type: 'manual' | 'automated' | 'decision';
  duration: number;
  dependencies: string[];
}`;

    case 'component':
      return `interface ComponentProps {
  id: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

interface ComponentState {
  isLoading: boolean;
  data: any[];
  error: string | null;
}`;

    case 'implementation':
      return `interface FunctionConfig {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
  complexity: number;
}

interface Parameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: any;
}`;

    default:
      return '// No types generated for this level';
  }
}

function generateTestsCode(level: GraphLevel): string {
  return `import { describe, it, expect } from '@jest/globals';

describe('Generated ${level} code', () => {
  it('should initialize correctly', () => {
    // Test initialization
    expect(true).toBe(true);
  });

  it('should handle data flow', () => {
    // Test data processing
    expect(true).toBe(true);
  });

  it('should integrate with other components', () => {
    // Test integration
    expect(true).toBe(true);
  });
});`;
}

function generateConfigCode(level: GraphLevel): string {
  return `{
  "level": "${level}",
  "generated": "${new Date().toISOString()}",
  "configuration": {
    "enableLiveReload": true,
    "optimizeForProduction": false,
    "includeSourceMaps": true
  },
  "dependencies": [],
  "metadata": {
    "version": "1.0.0",
    "author": "AI Code Generator",
    "description": "Generated ${level} level code"
  }
}`;
}

export default LivePreviewPanel;