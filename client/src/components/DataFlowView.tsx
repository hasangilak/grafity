import React, { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Paper
} from '@mui/material'
import {
  ExpandMore,
  TrendingUp,
  AccountTree,
  SwapHoriz,
  Event,
  Api,
  Storage
} from '@mui/icons-material'
import axios from 'axios'
import { ProjectGraph } from '../types'

interface DataFlowViewProps {
  graph: ProjectGraph | null
}

interface DataFlowAnalysis {
  stateFlows: Array<{
    id: string
    componentId: string
    hookName: string
    hookType: string
    readers: string[]
    writers: string[]
  }>
  propFlows: Array<{
    id: string
    fromComponent: string
    toComponent: string
    propName: string
    propType: string
    isRequired: boolean
  }>
  contextFlows: Array<{
    id: string
    contextName: string
    provider: string
    consumers: string[]
  }>
  eventFlows: Array<{
    id: string
    eventType: string
    source: string
    handlers: string[]
  }>
  apiFlows: Array<{
    id: string
    endpoint?: string
    method?: string
    component: string
    dataState?: string
  }>
}

const DataFlowView: React.FC<DataFlowViewProps> = ({ graph }) => {
  const [dataFlowAnalysis, setDataFlowAnalysis] = useState<DataFlowAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    if (graph) {
      fetchDataFlowAnalysis()
    }
  }, [graph])

  const fetchDataFlowAnalysis = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get('/api/dataflow')
      setDataFlowAnalysis(response.data.analysis)
    } catch (err) {
      setError('Failed to fetch data flow analysis')
      console.error('Data flow analysis error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  if (!graph) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Data Flow Analysis
          </Typography>
          <Typography variant="body2" color="textSecondary">
            No project analyzed yet. Please analyze a project first.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Analyzing data flows...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    )
  }

  if (!dataFlowAnalysis) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No data flow analysis available.
      </Alert>
    )
  }

  const getComponentName = (componentId: string) => {
    const parts = componentId.split('#')
    return parts.length > 1 ? parts[1] : parts[0]
  }

  const getFileName = (filePath: string) => {
    const parts = filePath.split('/')
    return parts[parts.length - 1]
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Data Flow Analysis
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="data flow tabs">
          <Tab label="State Flows" icon={<Storage />} />
          <Tab label="Prop Flows" icon={<SwapHoriz />} />
          <Tab label="Context Flows" icon={<AccountTree />} />
          <Tab label="Event Flows" icon={<Event />} />
          <Tab label="API Flows" icon={<Api />} />
        </Tabs>
      </Paper>

      {/* State Flows Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  State Management ({dataFlowAnalysis.stateFlows.length} flows)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  State flows show how data moves through React hooks like useState and useReducer.
                </Typography>

                {dataFlowAnalysis.stateFlows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No state flows detected in this project.
                  </Typography>
                ) : (
                  dataFlowAnalysis.stateFlows.map((flow) => (
                    <Accordion key={flow.id}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={flow.hookType} size="small" color="primary" />
                          <Typography>
                            {getComponentName(flow.componentId)} - {flow.hookName}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" gutterBottom>
                              Readers ({flow.readers.length})
                            </Typography>
                            <List dense>
                              {flow.readers.map((reader, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <TrendingUp fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText primary={getComponentName(reader)} />
                                </ListItem>
                              ))}
                            </List>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" gutterBottom>
                              Writers ({flow.writers.length})
                            </Typography>
                            <List dense>
                              {flow.writers.map((writer, index) => (
                                <ListItem key={index}>
                                  <ListItemIcon>
                                    <TrendingUp fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText primary={getComponentName(writer)} />
                                </ListItem>
                              ))}
                            </List>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Prop Flows Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Component Props ({dataFlowAnalysis.propFlows.length} flows)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Prop flows show how data is passed between parent and child components.
                </Typography>

                {dataFlowAnalysis.propFlows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No prop flows detected in this project.
                  </Typography>
                ) : (
                  <List>
                    {dataFlowAnalysis.propFlows.map((flow) => (
                      <ListItem key={flow.id} divider>
                        <ListItemIcon>
                          <SwapHoriz />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">
                                {getComponentName(flow.fromComponent)} → {getComponentName(flow.toComponent)}
                              </Typography>
                              <Chip
                                label={flow.propName}
                                size="small"
                                color={flow.isRequired ? "error" : "default"}
                                variant="outlined"
                              />
                              <Chip label={flow.propType} size="small" />
                            </Box>
                          }
                          secondary={flow.isRequired ? "Required prop" : "Optional prop"}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Context Flows Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Context Flows ({dataFlowAnalysis.contextFlows.length} flows)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Context flows show how React Context provides data to consuming components.
                </Typography>

                {dataFlowAnalysis.contextFlows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No context flows detected in this project.
                  </Typography>
                ) : (
                  dataFlowAnalysis.contextFlows.map((flow) => (
                    <Accordion key={flow.id}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Context" size="small" color="secondary" />
                          <Typography>{flow.contextName}</Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" gutterBottom>
                              Provider
                            </Typography>
                            <Typography variant="body2">
                              {getComponentName(flow.provider)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={8}>
                            <Typography variant="subtitle2" gutterBottom>
                              Consumers ({flow.consumers.length})
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {flow.consumers.map((consumer) => (
                                <Chip
                                  key={consumer}
                                  label={getComponentName(consumer)}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Event Flows Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Event Flows ({dataFlowAnalysis.eventFlows.length} flows)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Event flows show user interactions and their handlers throughout your application.
                </Typography>

                {dataFlowAnalysis.eventFlows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No event flows detected in this project.
                  </Typography>
                ) : (
                  <List>
                    {dataFlowAnalysis.eventFlows.map((flow) => (
                      <ListItem key={flow.id} divider>
                        <ListItemIcon>
                          <Event />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">
                                {getComponentName(flow.source)}
                              </Typography>
                              <Chip label={flow.eventType} size="small" color="info" />
                            </Box>
                          }
                          secondary={`Handlers: ${flow.handlers.join(', ')}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* API Flows Tab */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  API Flows ({dataFlowAnalysis.apiFlows.length} flows)
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  API flows show external data fetching and how it integrates with your components.
                </Typography>

                {dataFlowAnalysis.apiFlows.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No API flows detected in this project.
                  </Typography>
                ) : (
                  <List>
                    {dataFlowAnalysis.apiFlows.map((flow) => (
                      <ListItem key={flow.id} divider>
                        <ListItemIcon>
                          <Api />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">
                                {getComponentName(flow.component)}
                              </Typography>
                              {flow.method && (
                                <Chip label={flow.method} size="small" color="success" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              {flow.endpoint && (
                                <Typography variant="body2" component="div">
                                  Endpoint: {flow.endpoint}
                                </Typography>
                              )}
                              {flow.dataState && (
                                <Typography variant="body2" component="div">
                                  Updates: {getComponentName(flow.dataState)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}

export default DataFlowView