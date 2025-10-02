# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 **MAJOR TRANSFORMATION COMPLETE**

**Grafity has been transformed from a standalone tool into `@grafity/nx-react` - an Nx plugin that provides deep React intelligence while leveraging proven infrastructure.**

## New Architecture Overview

This is now an **Nx workspace** with a focus on the React analysis plugin:

### Primary Plugin: `@grafity/nx-react` (`packages/grafity-react/`)
- **React AST Analysis**: Enhanced TypeScript/React component parsing with hooks, props, and JSX patterns
- **Data Flow Analysis**: Tracks state (useState, useContext), props, context, and API integration patterns
- **Pattern Detection**: React-specific patterns and anti-patterns (prop drilling, god components, custom hooks)
- **Nx Integration**: Extends Nx project graph with React metadata and incremental caching
- **MCP Tools**: AI assistant integration via nx-mcp with React-specific analysis tools

### Replaced Infrastructure (Archived: `archived-standalone-code/`)
- ❌ **Custom Project Graph** → ✅ **Nx Project Graph** (50x faster)
- ❌ **Custom File Scanning** → ✅ **Nx File Discovery** (incremental, cached)
- ❌ **Custom Dependency Analysis** → ✅ **Nx Dependency Graph** (proven, scalable)
- ❌ **Standalone Express Server** → ✅ **Nx Executors + MCP Integration** (better CLI/IDE integration)

### Enhanced Features (Retained & Improved)
- ✅ **React Intelligence**: Deep component, hook, and pattern analysis
- ✅ **AI Integration**: MCP tools for Claude Code and other AI assistants
- ✅ **Data Flow Analysis**: Enhanced state, props, and context tracking
- ✅ **Pattern Detection**: React-specific architectural patterns and anti-patterns
- ✅ **Visual Generation**: Interactive HTML/SVG graph generation

### Legacy Components (For Reference)
- `client/` - Original React frontend (kept for reference)
- `examples/sample-react-app/` - Test React application (13 components)

## Development Commands

### Nx Plugin Development
```bash
npm run build        # Build the @grafity/nx-react plugin
npm run test         # Run plugin tests
npm run lint         # Lint the plugin code
```

### Demo & Testing
```bash
npm run demo:analyze    # Analyze sample React app
npm run demo:visualize  # Generate component visualization
npm run demo:patterns   # Detect React patterns
npm run demo:graph-chat # Graph-based conversation with branching
```

## 🧪 QA Testing & Local Verification

### Prerequisites for Testing
Before running any tests, ensure:
1. **Docker is running** and accessible
2. **Node.js 18+** is installed
3. **npm dependencies** are installed (`npm install`)

### Complete QA Test Workflow

#### Step 1: Environment Setup
```bash
# Verify Node.js version
node --version  # Should be 18+

# Install dependencies
npm install

# Verify Docker is running
docker ps

# Start Neo4j database (required for graph engine)
docker-compose up -d

# Verify Neo4j is running
docker ps | grep neo4j
# Should show neo4j container running on ports 7474 and 7687

# Check Neo4j logs for errors
docker-compose logs neo4j | tail -20
```

#### Step 2: Core Functionality Tests
```bash
# Test graph engine core
npm run test:graph-engine
# Expected: All graph operations (CRUD, traversal) pass

# Test Neo4j integration
npm run test:neo4j
# Expected: Database operations and persistence work correctly

# Test with large dataset
npm run demo:large-graph
# Expected: 100+ nodes handled efficiently
```

#### Step 3: Graph Chat Interface Testing
```bash
# Start graph chat demo
npm run demo:graph-chat

# The demo should demonstrate:
# ✅ Conversation nodes in graph structure
# ✅ Bidirectional message connections
# ✅ Branching conversation paths
# ✅ Links between chat, code, and document nodes

# Verify in Neo4j Browser:
# 1. Open http://localhost:7474
# 2. Login: neo4j / password
# 3. Run query: MATCH (n:ConversationNode) RETURN n LIMIT 25
# 4. Should see conversation nodes with relationships
```

#### Step 4: React Analysis Demo
```bash
# Analyze sample React app (13 components)
npm run demo:analyze
# Expected: JSON output with component analysis

# Generate visualization
npm run demo:visualize
# Expected: HTML file created in dist/visualizations/

# Open visualization
open dist/visualizations/component-tree.html
# Expected: Interactive graph in browser

# Detect patterns
npm run demo:patterns
# Expected: Markdown report with patterns/anti-patterns
```

#### Step 5: E2E Testing with Playwright
```bash
# Run comprehensive E2E test suite
npx playwright test tests/e2e/new-developer-journey.spec.ts

# Run with visual HTML reporter
npx playwright test tests/e2e/new-developer-journey.spec.ts --reporter=html

# View test results
npx playwright show-report

# Run in Docker (isolated environment)
docker compose -f docker-compose.test.yml --profile e2e up
```

#### Step 6: Nx Integration Testing
```bash
# Test Nx executors on sample app
npx nx analyze-react sample-react-app
npx nx visualize-components sample-react-app --outputPath=dist/test-viz
npx nx detect-patterns sample-react-app --outputPath=dist/test-patterns.md

# Verify outputs exist
ls -la dist/test-viz/
ls -la dist/test-patterns.md
```

### Docker Container Management for QA

```bash
# Check all running containers
docker ps

# View Neo4j logs (for debugging)
docker-compose logs -f neo4j

# Restart Neo4j (if issues occur)
docker-compose restart neo4j

# Stop all services
docker-compose down

# Clean restart (removes all data)
docker-compose down -v
docker-compose up -d

# Access Neo4j Browser for manual verification
# URL: http://localhost:7474
# Username: neo4j
# Password: password
```

### Verification Checklist for QA Agent

**Before running tests:**
- [ ] Docker daemon is running
- [ ] Neo4j container is healthy (`docker ps` shows "healthy" status)
- [ ] Node modules are installed (`node_modules/` exists)
- [ ] Port 7474 and 7687 are available (not in use by other processes)

**During testing:**
- [ ] All demo scripts execute without errors
- [ ] Visualizations are generated correctly
- [ ] Neo4j contains expected nodes and relationships
- [ ] Playwright tests pass (>90% success rate)
- [ ] No error logs in Docker containers

**After testing:**
- [ ] Verify output files exist in expected locations
- [ ] Check Neo4j database has test data (via Browser UI)
- [ ] Review generated visualizations for correctness
- [ ] Confirm pattern detection reports are accurate

### Troubleshooting Common Issues

```bash
# If Neo4j connection fails
docker-compose restart neo4j
docker-compose logs neo4j

# If port conflicts occur
lsof -i :7474  # Find process using port
lsof -i :7687
# Kill conflicting process or change ports in docker-compose.yml

# If tests fail due to missing dependencies
npm ci  # Clean install
npm run build

# If visualization doesn't open
ls -la dist/visualizations/
# Manually open file: dist/visualizations/component-tree.html

# Check Docker disk space
docker system df
docker system prune  # Clean up if needed
```

### Nx Executors (for React projects)
```bash
nx analyze-react my-react-app                    # Analyze React components
nx visualize-components my-react-app             # Generate interactive visualization
nx detect-patterns my-react-app                  # Detect patterns and anti-patterns
```

### Installation (for other Nx workspaces)
```bash
npm install -D @grafity/nx-react  # Install the plugin
```

## Core Data Structures (Plugin Focus)

The **@grafity/nx-react** plugin focuses on React-specific analysis:

### React Intelligence Types (`packages/grafity-react/src/types/`)
- **ComponentInfo**: React component metadata (props, hooks, children, type: function/class/arrow)
- **HookInfo**: Hook usage patterns (useState, useEffect, useContext, custom hooks)
- **PropInfo**: Component props with types, requirements, and default values
- **ReactPattern**: Detected patterns and anti-patterns with confidence scores
- **PropFlowGraph**: Component prop relationships and drilling detection
- **HookUsageGraph**: Hook dependencies and usage patterns

### Nx Integration Types
- **NxReactProjectData**: React metadata attached to Nx project nodes
- **ReactMetrics**: Component count, complexity, hook usage statistics
- **ReactAnalysisResult**: Complete analysis with components, patterns, data flows

## Nx Plugin Analysis Pipeline

The **@grafity/nx-react** plugin enhances Nx's project graph with React intelligence:

1. **Nx Project Discovery**: Leverages Nx's optimized file discovery and project identification
2. **React AST Analysis**: `ReactASTParser` analyzes TypeScript/React files to extract:
   - React components (functional, class, arrow) with props and hooks
   - Hook usage patterns (useState, useEffect, useContext, custom)
   - Component relationships and children
3. **Data Flow Analysis**: `ReactDataFlowAnalyzer` traces:
   - State flows through hooks and components
   - Props passing between parent-child components
   - Context provider-consumer relationships
4. **Pattern Detection**: `ReactPatternAnalyzer` identifies:
   - Good patterns (custom hooks, composition, context usage)
   - Anti-patterns (prop drilling, god components, hook overuse)
5. **Nx Integration**: `ReactProjectGraphProcessor` extends Nx project graph with React metadata
6. **AI Tools**: MCP tools provide structured data to AI assistants via nx-mcp integration

## Key Integration Points

- **Nx Project Graph**: Leverages Nx's battle-tested project graph infrastructure (50x performance improvement)
- **Nx Caching**: Incremental analysis with intelligent caching and invalidation
- **TypeScript Compiler API**: Enhanced React-focused parsing using `ts.createProgram()` and `ts.TypeChecker`
- **MCP Integration**: Extends nx-mcp with React-specific tools for AI assistants
- **Nx Executors**: CLI integration via Nx executor system
- **Nx Console**: Visual integration in VS Code and other IDEs

## AI Assistant Integration (MCP Tools)

### Available MCP Tools (extends nx-mcp)
- **`grafity_react_component_tree`**: Hierarchical component analysis with props and hooks
- **`grafity_react_hook_usage`**: Hook usage patterns, dependencies, and potential issues
- **`grafity_react_prop_flow`**: Prop flow analysis and prop drilling detection

### Usage with Claude Code
```bash
# Ensure nx-mcp is configured, then ask:
"What React components are in my project?"
"Show me hook usage patterns in my React app"
"Are there any prop drilling issues in my components?"
```

## Testing Strategy

### E2E Testing with Playwright (NEW ✅)
- **Comprehensive test suite**: 22 tests covering new developer journey
- **Test file**: `tests/e2e/new-developer-journey.spec.ts`
- **Pass rate**: 91% (20/22 tests)
- **Phases tested**: Documentation, Installation, Demo Execution, Visualization, Pattern Detection, Nx Integration

```bash
# Run E2E tests
npx playwright test tests/e2e/new-developer-journey.spec.ts

# Run with HTML reporter
npx playwright test tests/e2e/new-developer-journey.spec.ts --reporter=html

# Run in Docker
docker compose -f docker-compose.test.yml --profile e2e up
```

### Demo Scripts (Complete Set)
```bash
# All demo scripts now working!
npm run demo:analyze      # Analyze 13 React components
npm run demo:visualize    # Generate interactive HTML visualization
npm run demo:patterns     # Detect patterns and anti-patterns

# Open generated visualization
open dist/visualizations/component-tree.html
```

### Sample React App (`examples/sample-react-app/`)
- **13 TypeScript React files** with various patterns
- **Context usage**, custom hooks, API services, component composition
- **Hook patterns**: useState, useEffect, props flow, event handling
- **Test Analysis**: `npm run demo:analyze`

### Plugin Development Testing
```bash
# Test the plugin on sample app
npx nx analyze-react sample-react-app
npx nx visualize-components sample-react-app --outputPath=dist/test-viz
npx nx detect-patterns sample-react-app --outputPath=dist/test-patterns.md
```

### Test Documentation
- **Test Report**: See `NEW-DEVELOPER-JOURNEY-REPORT.md` for comprehensive results
- **UX Roadmap**: See `UX-IMPROVEMENTS-ROADMAP.md` for actionable improvements
- **Test Summary**: See `PLAYWRIGHT-MCP-TEST-SUMMARY.md` for infrastructure details

## Migration from Standalone Grafity

### What Changed
- ❌ **Removed**: Custom infrastructure (graph generation, file scanning, servers)
- ✅ **Enhanced**: React-specific analysis, AI integration, pattern detection
- ✅ **Added**: Nx integration, MCP tools, better performance

### Benefits
- **50x faster startup** with Nx infrastructure
- **Better IDE integration** via Nx Console
- **AI assistant support** via nx-mcp
- **Focus on React intelligence** instead of infrastructure maintenance