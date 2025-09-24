# 🎨 Grafity - AI-Powered Code Visualization Platform

**Grafity** is a revolutionary code visualization and analysis platform that combines human intuition with AI intelligence. Designed for TypeScript, React, and Node.js projects, it creates interactive graphs where **humans can manipulate visual diagrams and AI implements the code changes**, while **AI modifies code and visual graphs update automatically**.

## 🚀 Features

### 🤖 AI-Human Collaboration
- **Visual-to-Code Generation**: Drag and drop components in graphs → AI generates/refactors code automatically
- **Code-to-Visual Sync**: Modify code → Visual graphs update in real-time with change highlighting
- **Intelligent Conflict Resolution**: AI detects and resolves simultaneous human/AI changes
- **Learning System**: AI adapts to team patterns and coding preferences over time
- **Plugin Architecture**: Support for OpenAI, local models, and custom AI integrations

### Core Analysis Engine
- **AST Parsing**: Deep analysis using TypeScript Compiler API
- **Dependency Tracking**: Import/export relationships and module dependencies
- **Component Analysis**: React component hierarchy and relationships
- **Function Analysis**: Parameter tracking, return types, and call graphs
- **Pattern Recognition**: AI-powered detection of architectural patterns and anti-patterns
- **Quality Metrics**: Cyclomatic complexity, maintainability index, technical debt analysis

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
- **Traditional Formats**: JSON, DOT (Graphviz), CSV, Markdown
- **AI-Optimized Formats**: LLM descriptions, GNN matrices, vector embeddings, semantic data
- **Business Context**: User personas, business processes, domain models, compliance data
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

### 🤖 AI-Powered Analysis
```javascript
// Initialize AI plugin (OpenAI example)
const aiPlugin = new OpenAIPlugin();
await aiPlugin.initialize({
  apiKey: 'your-openai-api-key',
  modelName: 'gpt-4',
  temperature: 0.1
});

// Register AI plugin
const pluginSystem = new AIPluginSystem();
await pluginSystem.registerPlugin(aiPlugin, config, { setAsDefault: true });

// Analyze project with AI enhancements
const graph = await generator.generateGraph('./src');
const aiAnalysis = await pluginSystem.analyzeGraph(graph);
const suggestions = await pluginSystem.suggestImprovements(graph);
```

### 🔄 Bidirectional Sync Usage
```javascript
// Initialize sync engine
const syncEngine = new BidirectionalSync(graphGenerator);
const eventSystem = new ChangeEventSystem();

// Handle visual changes → code generation
const visualChange = {
  type: 'connect',
  sourceComponent: 'UserList',
  targetComponent: 'UserCard',
  businessIntent: 'Display user cards in the user list'
};

const eventId = await syncEngine.handleVisualChange(visualChange);

// Handle code changes → visual updates
syncEngine.on('visual_updated', ({ updatedGraph, affectedComponents }) => {
  console.log('Graph updated:', affectedComponents);
});
```

### Analyzing the Sample Project
```bash
# The repository includes a sample React app for testing
/Users/hassangilak/Work/grafity/examples/sample-react-app
```

### API Usage
```javascript
// Traditional analysis
POST /api/analyze
{
  "projectPath": "/path/to/your/project",
  "options": {
    "includeNodeModules": false,
    "includeTests": false,
    "maxDepth": 10
  }
}

// AI-enhanced endpoints
POST /api/ai/analyze
{
  "graph": { /* ProjectGraph */ },
  "plugin": "openai"
}

POST /api/ai/suggest
{
  "graph": { /* ProjectGraph */ },
  "focusAreas": ["performance", "security", "architecture"]
}

POST /api/visual/change
{
  "change": {
    "type": "connect",
    "sourceComponent": "ComponentA",
    "targetComponent": "ComponentB",
    "businessIntent": "User clicks button to show modal"
  }
}

// Export with AI formats
POST /api/export
{
  "format": "llm|gnn|embeddings|semantic|business",
  "config": {
    "includePatterns": true,
    "includeMetrics": true,
    "businessContext": true
  }
}
```

### Programmatic Usage
```typescript
import { GraphGenerator } from './src/core/graph/graph-generator';
import { PatternAnalyzer } from './src/core/analysis/pattern-analyzer';
import { BidirectionalSync } from './src/core/sync/bidirectional-sync';
import { AIPluginSystem } from './src/core/ai/plugin-system';
import { OpenAIPlugin } from './src/core/ai/plugins/openai-plugin';

// Initialize components
const generator = new GraphGenerator({
  includeNodeModules: false,
  includeTests: false
});

const patternAnalyzer = new PatternAnalyzer();
const syncEngine = new BidirectionalSync(generator);

// Setup AI system
const aiSystem = new AIPluginSystem();
const openaiPlugin = new OpenAIPlugin();
await openaiPlugin.initialize({ apiKey: 'your-api-key' });
await aiSystem.registerPlugin(openaiPlugin, {}, { setAsDefault: true });

// Generate enhanced graph
const graph = await generator.generateProjectGraph('/path/to/project');
const semanticData = patternAnalyzer.analyzePatterns(graph);
const aiSuggestions = await aiSystem.suggestImprovements(graph);

// Enable bidirectional sync
syncEngine.setCurrentGraph(graph);
syncEngine.on('code_updated', ({ modifications }) => {
  console.log('AI generated code:', modifications);
});
```

## 🏗 Architecture

### Backend Components
```
src/
├── core/
│   ├── ai/            # AI plugin system and integrations
│   ├── ast/           # AST parsing and file scanning
│   ├── analysis/      # Dependency, data flow, and pattern analysis
│   ├── events/        # Real-time change event system
│   ├── graph/         # Graph generation and processing
│   └── sync/          # Bidirectional synchronization engine
├── server/            # Express API server with WebSocket support
├── types/             # TypeScript type definitions (AI-enhanced)
└── utils/             # Export utilities (including AI formats)
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

**PatternAnalyzer**: AI-powered architectural analysis
- Detects architectural patterns (MVC, Observer, Factory, etc.)
- Identifies anti-patterns and code smells
- Calculates quality metrics and technical debt

**BidirectionalSync**: Real-time code-visual synchronization
- Handles visual-to-code transformations
- Manages code-to-visual updates
- Provides conflict detection and resolution

**AIPluginSystem**: Extensible AI integration framework
- Supports multiple AI models and providers
- Manages plugin lifecycle and capabilities
- Enables consensus analysis across multiple AI systems

**DataFlowAnalyzer**: Tracks data movement through the application
- Analyzes state management patterns
- Maps prop flows between components
- Identifies API integration points

## 📈 What Grafity Can Detect

### 🤖 AI-Enhanced Analysis
- ✅ Architectural patterns (MVC, Observer, Factory, Singleton, Strategy, Decorator)
- ✅ Anti-patterns (God Objects, circular dependencies, dead code, duplicated code)
- ✅ Quality metrics (cyclomatic complexity, maintainability index, coupling)
- ✅ Business domain mapping and user persona relationships
- ✅ Performance bottlenecks and optimization opportunities
- ✅ Security vulnerabilities through data flow analysis

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

### AI Plugin Configuration
```typescript
interface AIPluginConfig {
  apiKey?: string;                 // API key for AI service
  modelName?: string;              // AI model to use (e.g., 'gpt-4')
  temperature?: number;            // AI creativity level (0-1)
  maxTokens?: number;              // Maximum response length
  baseUrl?: string;                // Custom API endpoint
  customSettings?: Record<string, any>; // Provider-specific settings
}

// Example: OpenAI Plugin Setup
const openaiConfig: AIPluginConfig = {
  apiKey: 'sk-...',
  modelName: 'gpt-4',
  temperature: 0.1,
  maxTokens: 2000
};
```

### Bidirectional Sync Options
```typescript
interface SyncOptions {
  debounceMs: number;              // Delay before processing changes
  enableConflictResolution: boolean; // Auto-resolve conflicts
  maxRetries: number;              // Retry attempts for failed operations
}
```

### Analysis Options
```typescript
interface AnalysisOptions {
  includeNodeModules: boolean;     // Include node_modules in analysis
  maxDepth: number;                // Maximum directory traversal depth
  followSymlinks: boolean;         // Follow symbolic links
  includeTests: boolean;           // Include test files
  enableAIAnalysis: boolean;       // Enable AI pattern recognition
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
  showAIInsights: boolean;         // Display AI-detected patterns
  colorScheme: string;
  clustering: boolean;
  exportFormat: 'svg' | 'png' | 'json' | 'dot' | 'llm' | 'gnn';
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

### 🤖 AI-Powered Development
- **Visual Architecture Design**: Business stakeholders design workflows visually → AI generates implementation code
- **Code-First Development**: Developers write code → AI updates architecture diagrams automatically
- **Intelligent Refactoring**: AI suggests and implements architectural improvements based on patterns
- **Quality Assurance**: AI continuously monitors code quality and suggests optimizations

### Code Review and Quality
- AI-powered identification of complex components and anti-patterns
- Automated detection of circular dependencies and code smells
- Intelligent analysis of coupling and cohesion metrics
- Predictive quality scoring and technical debt assessment

### Architecture Documentation
- AI-generated architecture descriptions and documentation
- Automatically updated component hierarchies and data flow diagrams
- Business context mapping with user personas and processes
- Living documentation that evolves with the codebase

### Refactoring Planning
- AI-recommended refactoring opportunities with impact analysis
- Visual planning of component extraction and merging
- Automated dependency optimization suggestions
- Risk assessment for architectural changes

### Team Collaboration
- Real-time collaborative visual editing with AI assistance
- AI-mediated conflict resolution for simultaneous changes
- Team pattern learning and preference adaptation
- Cross-functional communication through visual interfaces

### Team Onboarding
- AI-guided codebase exploration and explanation
- Interactive visual code maps with contextual information
- Automated user journey documentation and flow visualization
- Intelligent code navigation and discovery

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

### Phase 2: Interactive Visual Designer (In Planning)
- [ ] Multi-level graph views (system, business flow, component, implementation)
- [ ] Drag-and-drop architecture manipulation with live preview
- [ ] Real-time collaboration canvas for multiple users + AI
- [ ] Visual programming interfaces for business logic and data flows
- [ ] User story visualization and mapping to code components

### Phase 3: Intelligent Collaboration Features (In Planning)
- [ ] AI-powered architectural optimization recommendations
- [ ] Performance bottleneck prediction and resolution suggestions
- [ ] Business-code alignment validation and improvement proposals
- [ ] Security vulnerability detection through data flow analysis

### Phase 4: Production Integration (In Planning)
- [ ] Real-time performance metrics overlay on architecture graphs
- [ ] User behavior analytics feeding back into business flow optimization
- [ ] Error correlation and root cause visualization
- [ ] CI/CD integration with architectural validation gates

### Long-term Vision
- [ ] Support for Vue.js and Angular projects
- [ ] Integration with popular IDEs and editors
- [ ] Test coverage visualization
- [ ] Git history integration for code evolution