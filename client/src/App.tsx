import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Box, AppBar, Toolbar, Typography, Container } from '@mui/material'
import Dashboard from './components/Dashboard'
import GraphVisualization from './components/GraphVisualization'
import ProjectAnalyzer from './components/ProjectAnalyzer'
import DataFlowView from './components/DataFlowView'
import { ProjectGraph } from './types'

function App() {
  const [currentGraph, setCurrentGraph] = useState<ProjectGraph | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalysisComplete = useCallback((graph: ProjectGraph) => {
    setCurrentGraph(graph)
    setIsAnalyzing(false)
  }, [])

  const handleAnalysisStart = useCallback(() => {
    setIsAnalyzing(true)
  }, [])

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🎨 Grafity - Code Visualization Platform
          </Typography>
          <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
            {currentGraph ? `${currentGraph.files.length} files analyzed` : 'No project loaded'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 3, height: 'calc(100vh - 64px)' }}>
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                graph={currentGraph}
                isAnalyzing={isAnalyzing}
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
              />
            }
          />
          <Route
            path="/analyze"
            element={
              <ProjectAnalyzer
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
              />
            }
          />
          <Route
            path="/graph"
            element={
              <GraphVisualization graph={currentGraph} />
            }
          />
          <Route
            path="/dataflow"
            element={
              <DataFlowView graph={currentGraph} />
            }
          />
        </Routes>
      </Container>
    </Box>
  )
}

export default App