import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import {
  Code,
  AccountTree,
  Timeline,
  Assessment,
  Folder,
  Functions,
  Extension,
  ImportExport
} from '@mui/icons-material'
import { ProjectGraph } from '../types'

interface DashboardProps {
  graph: ProjectGraph | null
  isAnalyzing: boolean
  onAnalysisStart: () => void
  onAnalysisComplete: (graph: ProjectGraph) => void
}

const Dashboard: React.FC<DashboardProps> = ({
  graph,
  isAnalyzing,
  onAnalysisStart,
  onAnalysisComplete
}) => {
  const stats = graph ? {
    totalFiles: graph.files.length,
    totalComponents: graph.components.length,
    totalFunctions: graph.functions.length,
    totalDependencies: graph.dependencies.edges.length,
    componentsByType: graph.components.reduce((acc, comp) => {
      acc[comp.type] = (acc[comp.type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    filesByExtension: graph.files.reduce((acc, file) => {
      acc[file.extension] = (acc[file.extension] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  } : null

  return (
    <Box>
      {isAnalyzing && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Analyzing project...
          </Typography>
          <LinearProgress />
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  component={RouterLink}
                  to="/analyze"
                  variant="contained"
                  startIcon={<Code />}
                  fullWidth
                >
                  Analyze New Project
                </Button>
                <Button
                  component={RouterLink}
                  to="/graph"
                  variant="outlined"
                  startIcon={<AccountTree />}
                  fullWidth
                  disabled={!graph}
                >
                  View Dependency Graph
                </Button>
                <Button
                  component={RouterLink}
                  to="/dataflow"
                  variant="outlined"
                  startIcon={<Timeline />}
                  fullWidth
                  disabled={!graph}
                >
                  View Data Flow
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Project Statistics */}
        {stats && (
          <Grid item xs={12} md={6} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {stats.totalFiles}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Files
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="secondary">
                        {stats.totalComponents}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Components
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {stats.totalFunctions}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Functions
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {stats.totalDependencies}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Dependencies
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Component Breakdown */}
        {stats && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Component Types
                </Typography>
                <List dense>
                  {Object.entries(stats.componentsByType).map(([type, count]) => (
                    <ListItem key={type}>
                      <ListItemIcon>
                        <Extension />
                      </ListItemIcon>
                      <ListItemText
                        primary={type}
                        secondary={`${count} components`}
                      />
                      <Chip label={count} size="small" />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* File Types */}
        {stats && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  File Types
                </Typography>
                <List dense>
                  {Object.entries(stats.filesByExtension).map(([ext, count]) => (
                    <ListItem key={ext}>
                      <ListItemIcon>
                        <Folder />
                      </ListItemIcon>
                      <ListItemText
                        primary={ext}
                        secondary={`${count} files`}
                      />
                      <Chip label={count} size="small" />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* User Journeys */}
        {graph && graph.userJourneys.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Detected User Journeys
                </Typography>
                <Grid container spacing={2}>
                  {graph.userJourneys.map((journey) => (
                    <Grid item xs={12} sm={6} md={4} key={journey.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {journey.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {journey.steps.length} steps
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                            {journey.steps.slice(0, 3).map((step) => (
                              <Chip
                                key={step.id}
                                label={step.type}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                            {journey.steps.length > 3 && (
                              <Chip
                                label={`+${journey.steps.length - 3} more`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Getting Started */}
        {!graph && !isAnalyzing && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Welcome to Grafity!
                </Typography>
                <Typography variant="body1" paragraph>
                  Grafity helps you visualize and understand your TypeScript/React/Node.js codebase
                  by generating interactive graphs and diagrams.
                </Typography>
                <Typography variant="body1" paragraph>
                  Get started by analyzing your project to see:
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <AccountTree />
                    </ListItemIcon>
                    <ListItemText
                      primary="Component Dependencies"
                      secondary="See how your React components relate to each other"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Timeline />
                    </ListItemIcon>
                    <ListItemText
                      primary="Data Flow"
                      secondary="Track props, state, and context throughout your app"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ImportExport />
                    </ListItemIcon>
                    <ListItemText
                      primary="Import/Export Relationships"
                      secondary="Understand your module dependency graph"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Assessment />
                    </ListItemIcon>
                    <ListItemText
                      primary="User Journey Analysis"
                      secondary="Inferred user interaction patterns from your code"
                    />
                  </ListItem>
                </List>
              </CardContent>
              <CardActions>
                <Button
                  component={RouterLink}
                  to="/analyze"
                  variant="contained"
                  size="large"
                  startIcon={<Code />}
                >
                  Analyze Your First Project
                </Button>
              </CardActions>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default Dashboard