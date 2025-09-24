# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Grafity is a full-stack TypeScript application that analyzes code structure and generates interactive visualizations with AI-powered collaboration features. The architecture consists of four main layers:

### Backend Analysis Engine (`src/`)
- **ASTParser**: Uses TypeScript Compiler API to parse `.ts/.tsx/.js/.jsx` files and extract components, functions, imports/exports, and React patterns
- **FileScanner**: Discovers and filters project files using glob patterns with configurable options (include/exclude patterns, depth limits, symlinks)
- **DependencyAnalyzer**: Builds dependency graphs, detects circular dependencies, and calculates metrics from parsed AST data
- **DataFlowAnalyzer**: Tracks data movement through React hooks (useState, useEffect, useContext), props, and API calls
- **PatternAnalyzer**: Detects architectural patterns (MVC, Observer, Factory, etc.) and anti-patterns (God Objects, circular deps, dead code)
- **GraphGenerator**: Orchestrates the analysis pipeline and coordinates file scanning, parsing, and graph generation
- **ExportManager**: Handles multiple export formats including AI-optimized formats (LLM, GNN, embeddings, semantic data)

### AI Integration Layer (`src/core/`)
- **AI Plugin System**: Extensible architecture supporting multiple AI models (OpenAI, local models, custom fine-tuning)
- **Bidirectional Sync Engine**: Real-time synchronization between visual graph changes and code modifications
- **Change Event System**: WebSocket-based real-time collaboration with conflict detection and resolution
- **Pattern Recognition**: AI-powered analysis of architectural patterns, anti-patterns, and code quality metrics
- **Learning System**: Captures team patterns, user feedback, and adapts AI behavior to team preferences

### Frontend Visualization (`client/src/`)
- **React Flow Integration**: Interactive node-based dependency graphs with draggable nodes and zoom/pan controls
- **Material-UI Components**: Dashboard with project statistics, analysis controls, and tabbed data flow views
- **Real-time Updates**: WebSocket support for live graph updates during development (via file watching)

### API Server (`src/server/index.ts`)
Express server with REST endpoints:
- `POST /api/analyze` - Analyzes project directory and returns complete graph with AI enhancements
- `GET /api/graph` - Returns current analyzed project graph
- `GET /api/dependencies` - Filtered dependency data
- `GET /api/dataflow` - Data flow analysis results
- `POST /api/export` - Export graphs in various formats (including AI-optimized formats)
- `POST /api/ai/analyze` - AI analysis of current graph with pattern recognition
- `POST /api/ai/suggest` - Get AI suggestions for architectural improvements
- `POST /api/ai/apply` - Apply AI-generated code changes
- `GET /api/ai/patterns` - Get learned patterns and team preferences
- `POST /api/visual/change` - Handle visual manipulations and sync to code
- `WebSocket /api/realtime` - Real-time collaboration updates and conflict resolution

## Development Commands

### Backend Development
```bash
npm run dev          # Start backend server with hot reload (port 3001)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build
npm run lint         # ESLint on src/**/*.ts
npm test             # Run Jest tests
```

### Frontend Development
```bash
npm run client:dev   # Start React dev server (port 3000)
npm run client:build # Build React app for production
cd client && npm run lint  # ESLint on client TypeScript
```

### Full Development Setup
1. `npm install` (install backend deps)
2. `cd client && npm install` (install frontend deps)
3. `npm run dev` (terminal 1 - backend)
4. `npm run client:dev` (terminal 2 - frontend)

## Core Data Structures

The analysis pipeline transforms source code through these key interfaces:

- **ProjectGraph**: Complete analysis result with AI enhancements including semantic data, business context, and AI metrics
- **SemanticData**: AI-analyzed architectural patterns, anti-patterns, complexity metrics, and quality indicators
- **BusinessContext**: User personas, business processes, data models, and compliance requirements
- **AIMetrics**: Node embeddings, adjacency matrices, feature vectors, and similarity data for ML models
- **DependencyGraph**: Nodes (files/components/functions) and edges (imports/calls/renders/props) for visualization
- **ComponentInfo**: React component metadata including props, hooks, children relationships, and type (function/class/arrow)
- **DataFlow**: State management, props passing, context usage, and API integration patterns
- **VisualChange**: User interactions with visual graphs that trigger code generation
- **AIResponse**: AI-generated code modifications, impact analysis, and suggestions

## Analysis Pipeline Flow

1. **FileScanner** discovers TypeScript/React files using configurable glob patterns
2. **ASTParser** creates TypeScript Program and parses each file's AST to extract:
   - Import/export declarations with specifiers and location info
   - React components (functional, class, arrow functions) with props and hooks
   - Function definitions with parameters, return types, and call sites
3. **DependencyAnalyzer** builds graph relationships and detects circular dependencies
4. **DataFlowAnalyzer** traces data movement through useState, props, context, and API calls
5. **PatternAnalyzer** detects architectural patterns, anti-patterns, and calculates quality metrics
6. **GraphGenerator** coordinates the pipeline and generates the final ProjectGraph with AI enhancements
7. **ExportManager** formats results for visualization, external consumption, and AI model ingestion
8. **AI Integration** enables bidirectional sync between visual changes and code modifications

## Key Integration Points

- **TypeScript Compiler API**: Core parsing engine using `ts.createProgram()` and `ts.TypeChecker`
- **AI Plugin System**: Modular architecture supporting OpenAI, local models, and custom AI integrations
- **WebSocket Server**: Real-time collaboration with change event broadcasting and conflict resolution
- **React Flow**: Frontend graph visualization with custom node types and layout algorithms (Dagre)
- **Express + CORS**: RESTful API with cross-origin support for frontend-backend communication
- **Glob Pattern Matching**: File discovery with include/exclude patterns and depth limits
- **Chokidar**: File watching for real-time analysis updates during development

## Testing Strategy

Use the sample React app at `examples/sample-react-app/` for testing analysis features:
- Contains 13 TypeScript React files with various patterns
- Includes Context usage, custom hooks, API services, and component composition
- Demonstrates useState, useEffect, props flow, and event handling patterns

Analysis path: `/Users/hassangilak/Work/grafity/examples/sample-react-app`