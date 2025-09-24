import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material'
import { ExpandMore, FolderOpen, Analytics } from '@mui/icons-material'
import axios from 'axios'
import { ProjectGraph, AnalysisOptions } from '../types'

interface ProjectAnalyzerProps {
  onAnalysisStart: () => void
  onAnalysisComplete: (graph: ProjectGraph) => void
}

const ProjectAnalyzer: React.FC<ProjectAnalyzerProps> = ({
  onAnalysisStart,
  onAnalysisComplete
}) => {
  const navigate = useNavigate()
  const [projectPath, setProjectPath] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Partial<AnalysisOptions>>({
    includeNodeModules: false,
    includeTests: false,
    maxDepth: 10,
    followSymlinks: false,
    patterns: {
      include: ['**/*.{ts,tsx,js,jsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/build/**']
    }
  })

  const handleAnalyze = useCallback(async () => {
    if (!projectPath.trim()) {
      setError('Please enter a project path')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    onAnalysisStart()

    try {
      const response = await axios.post('/api/analyze', {
        projectPath: projectPath.trim(),
        options
      })

      const { graph } = response.data
      onAnalysisComplete(graph)

      // Navigate to dashboard to show results
      navigate('/')
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Failed to analyze project. Please check the path and try again.'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [projectPath, options, onAnalysisStart, onAnalysisComplete, navigate])

  const handleOptionChange = (key: keyof AnalysisOptions) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setOptions(prev => ({
      ...prev,
      [key]: event.target.checked
    }))
  }

  const handlePatternChange = (type: 'include' | 'exclude') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const patterns = event.target.value.split(',').map(p => p.trim()).filter(Boolean)
    setOptions(prev => ({
      ...prev,
      patterns: {
        ...prev.patterns,
        [type]: patterns
      }
    }))
  }

  const examplePaths = [
    '/Users/username/my-react-app',
    '/Users/username/Projects/my-typescript-project',
    './relative/path/to/project',
    '../parent-directory/project'
  ]

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Analyze Project
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Enter the path to your TypeScript/React/Node.js project to generate
            visualizations and insights about your codebase.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Project Path"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/your/project"
              disabled={isAnalyzing}
              error={!!error}
              helperText={error || "Enter the absolute or relative path to your project directory"}
              InputProps={{
                startAdornment: <FolderOpen sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Box>

          {/* Example paths */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Example paths:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {examplePaths.map((path) => (
                <Chip
                  key={path}
                  label={path}
                  variant="outlined"
                  size="small"
                  onClick={() => setProjectPath(path)}
                  disabled={isAnalyzing}
                />
              ))}
            </Box>
          </Box>

          {/* Analysis Options */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Analysis Options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeNodeModules || false}
                      onChange={handleOptionChange('includeNodeModules')}
                      disabled={isAnalyzing}
                    />
                  }
                  label="Include node_modules"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeTests || false}
                      onChange={handleOptionChange('includeTests')}
                      disabled={isAnalyzing}
                    />
                  }
                  label="Include test files"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.followSymlinks || false}
                      onChange={handleOptionChange('followSymlinks')}
                      disabled={isAnalyzing}
                    />
                  }
                  label="Follow symbolic links"
                />
              </FormGroup>

              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Max Directory Depth"
                  type="number"
                  value={options.maxDepth || 10}
                  onChange={(e) => setOptions(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
                  disabled={isAnalyzing}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Include Patterns"
                  value={options.patterns?.include?.join(', ') || ''}
                  onChange={handlePatternChange('include')}
                  disabled={isAnalyzing}
                  helperText="Comma-separated glob patterns for files to include"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Exclude Patterns"
                  value={options.patterns?.exclude?.join(', ') || ''}
                  onChange={handlePatternChange('exclude')}
                  disabled={isAnalyzing}
                  helperText="Comma-separated glob patterns for files to exclude"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            onClick={() => navigate('/')}
            disabled={isAnalyzing}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !projectPath.trim()}
            startIcon={isAnalyzing ? <CircularProgress size={20} /> : <Analytics />}
            size="large"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Project'}
          </Button>
        </CardActions>
      </Card>

      {/* Tips */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💡 Tips for Best Results
          </Typography>
          <ul>
            <li>Make sure the path points to the root of your project (where package.json is located)</li>
            <li>For large projects, consider excluding node_modules to improve performance</li>
            <li>Test files can provide insights into usage patterns, but may clutter the visualization</li>
            <li>Use include/exclude patterns to focus on specific parts of your codebase</li>
          </ul>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ProjectAnalyzer