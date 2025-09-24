# 🎨 Grafity - Code Visualization Platform

**Grafity** is a powerful code visualization and analysis platform designed specifically for TypeScript, React, and Node.js projects. It generates interactive graphs and diagrams to help developers understand code structure, dependencies, data flow, and user journeys.

## 🚀 Features

### Core Analysis Engine
- **AST Parsing**: Deep analysis using TypeScript Compiler API
- **Dependency Tracking**: Import/export relationships and module dependencies
- **Component Analysis**: React component hierarchy and relationships
- **Function Analysis**: Parameter tracking, return types, and call graphs

### Data Flow Analysis
- **State Management**: Track useState, useReducer, and custom hooks
- **Props Flow**: Parent-child component data passing
- **Context Flow**: React Context providers and consumers
- **Event Flow**: User interaction patterns and handlers
- **API Flow**: External data fetching and integration

### Interactive Visualizations
- **Dependency Graphs**: Interactive node-based dependency visualization
- **Component Trees**: Hierarchical component relationships
- **Data Flow Diagrams**: Visual representation of data movement
- **User Journey Maps**: Inferred user interaction patterns

### Export Capabilities
- **Multiple Formats**: JSON, DOT (Graphviz), CSV, Markdown
- **Customizable Layouts**: Hierarchical, force-directed, circular
- **Bulk Export**: Generate all formats simultaneously
- **Visual Customization**: Color schemes, clustering, and labeling options

## 📋 Prerequisites

- Node.js 18+
- TypeScript 5+
- npm or yarn

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd grafity
   ```

2. **Install server dependencies**
   ```bash
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## 🏃‍♂️ Getting Started

### 1. Start the Server
```bash
npm run dev
```
This starts the backend server on `http://localhost:3001`

### 2. Start the Client (in a separate terminal)
```bash
npm run client:dev
```
This starts the React frontend on `http://localhost:3000`

### 3. Analyze Your Project
1. Navigate to `http://localhost:3000`
2. Click "Analyze New Project"
3. Enter the path to your TypeScript/React/Node.js project
4. Configure analysis options (optional)
5. Click "Analyze Project"

## 📊 Usage Examples

### Analyzing the Sample Project
```bash
# The repository includes a sample React app for testing
/Users/hassangilak/Work/grafity/examples/sample-react-app
```

### API Usage
```javascript
// Direct API calls to the backend
POST /api/analyze
{
  "projectPath": "/path/to/your/project",
  "options": {
    "includeNodeModules": false,
    "includeTests": false,
    "maxDepth": 10
  }
}

GET /api/graph
GET /api/components
GET /api/dependencies
GET /api/dataflow

POST /api/export
{
  "format": "json|dot|csv|markdown",
  "config": {
    "layout": "hierarchical",
    "showLabels": true,
    "colorScheme": "default"
  }
}
```

### Programmatic Usage
```typescript
import { GraphGenerator } from './src/core/graph/graph-generator';
import { DataFlowAnalyzer } from './src/core/analysis/data-flow-analyzer';

const generator = new GraphGenerator({
  includeNodeModules: false,
  includeTests: false
});

const graph = await generator.generateProjectGraph('/path/to/project');

const dataFlowAnalyzer = new DataFlowAnalyzer();
const dataFlow = dataFlowAnalyzer.analyze(graph.components, graph.functions);
```

## 🏗 Architecture

### Backend Components
```
src/
├── core/
│   ├── ast/           # AST parsing and file scanning
│   ├── analysis/      # Dependency and data flow analysis
│   └── graph/         # Graph generation and processing
├── server/            # Express API server
├── types/             # TypeScript type definitions
└── utils/             # Export utilities
```

### Frontend Components
```
client/src/
├── components/        # React UI components
├── hooks/            # Custom React hooks
├── utils/            # Client-side utilities
└── types.ts          # Frontend type definitions
```

### Key Classes

**ASTParser**: Analyzes TypeScript/JavaScript files using the TypeScript Compiler API
- Extracts imports, exports, components, functions
- Identifies React patterns and hooks
- Analyzes function calls and dependencies

**DependencyAnalyzer**: Builds dependency graphs and detects patterns
- Creates nodes and edges for visualization
- Detects circular dependencies
- Identifies orphaned files and components

**GraphGenerator**: Orchestrates the analysis pipeline
- Coordinates file scanning, parsing, and analysis
- Generates comprehensive project graphs
- Supports real-time file watching

**DataFlowAnalyzer**: Tracks data movement through the application
- Analyzes state management patterns
- Maps prop flows between components
- Identifies API integration points

## 📈 What Grafity Can Detect

### Component Analysis
- ✅ Functional components (arrow functions, declarations)
- ✅ Class components extending React.Component
- ✅ Component props and their types
- ✅ React hooks usage (useState, useEffect, custom hooks)
- ✅ Component composition and children

### Dependency Analysis
- ✅ Import/export relationships
- ✅ Module dependency graphs
- ✅ Circular dependency detection
- ✅ External package dependencies
- ✅ File-level coupling metrics

### Data Flow Analysis
- ✅ State management (useState, useReducer)
- ✅ Props passing between components
- ✅ Context providers and consumers
- ✅ Event handlers and user interactions
- ✅ API calls and data fetching patterns

### User Journey Inference
- ✅ Navigation patterns from routing
- ✅ Form interaction flows
- ✅ Event-driven user actions
- ✅ Component interaction sequences

## 🎛 Configuration Options

### Analysis Options
```typescript
interface AnalysisOptions {
  includeNodeModules: boolean;     // Include node_modules in analysis
  maxDepth: number;                // Maximum directory traversal depth
  followSymlinks: boolean;         // Follow symbolic links
  includeTests: boolean;           // Include test files
  patterns: {
    include: string[];             // Glob patterns to include
    exclude: string[];             // Glob patterns to exclude
  };
}
```

### Visualization Config
```typescript
interface VisualizationConfig {
  layout: 'hierarchical' | 'force' | 'circular' | 'dagre';
  showLabels: boolean;
  showTypes: boolean;
  colorScheme: string;
  clustering: boolean;
  exportFormat: 'svg' | 'png' | 'json' | 'dot';
}
```

## 🔧 Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

### Development Mode
```bash
# Terminal 1: Backend with hot reload
npm run dev

# Terminal 2: Frontend with hot reload
npm run client:dev
```

## 📝 API Reference

### Core Endpoints

**POST /api/analyze**
- Analyzes a project directory
- Returns complete project graph with components, dependencies, and data flows

**GET /api/graph**
- Returns the current analyzed project graph
- Includes all components, functions, and dependencies

**GET /api/components**
- Returns filtered component information
- Supports filtering by component type

**GET /api/dependencies**
- Returns dependency graph data
- Supports excluding external dependencies

**GET /api/dataflow**
- Returns data flow analysis results
- Includes state, props, context, event, and API flows

**POST /api/export**
- Exports graphs in various formats
- Supports JSON, DOT, CSV, and Markdown

## 🎯 Use Cases

### Code Review and Quality
- Identify overly complex components
- Find circular dependencies
- Detect unused or orphaned files
- Analyze coupling between modules

### Architecture Documentation
- Generate up-to-date architecture diagrams
- Document component hierarchies
- Visualize data flow patterns
- Create technical documentation

### Refactoring Planning
- Identify refactoring opportunities
- Understand impact of changes
- Plan component extraction or merging
- Optimize dependency structures

### Team Onboarding
- Help new developers understand codebase
- Visualize application structure
- Document user interaction flows
- Create interactive code maps

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- TypeScript Compiler API for robust AST parsing
- React Flow for interactive graph visualization
- Material-UI for beautiful React components
- D3.js for advanced graph layout algorithms
- Dagre for hierarchical graph layouts

## 🔮 Future Enhancements

- [ ] Support for Vue.js and Angular projects
- [ ] Integration with popular IDEs and editors
- [ ] Performance metrics and bundle analysis
- [ ] Test coverage visualization
- [ ] Git history integration for code evolution
- [ ] Team collaboration features
- [ ] Plugin system for custom analyzers
- [ ] Real-time collaborative editing
- [ ] Integration with CI/CD pipelines