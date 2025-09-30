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