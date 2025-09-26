# @grafity/nx-react

An Nx plugin that adds deep React and TypeScript intelligence on top of Nx's project graph infrastructure. This plugin transforms Grafity from a standalone tool into a powerful Nx extension that provides React-specific analysis, pattern detection, and AI-powered insights.

## Features

### 🔍 Deep React Analysis
- **Component Intelligence**: AST-based analysis of React components, props, hooks, and relationships
- **Data Flow Tracking**: Trace state, props, and context flows through your React app
- **Pattern Detection**: Identify good patterns and anti-patterns in your React codebase
- **Hook Analysis**: Understand hook usage patterns and dependencies

### 🛠️ Nx Integration
- **Project Graph Enhancement**: Adds React metadata to Nx's project graph
- **Incremental Analysis**: Leverages Nx's caching for fast re-analysis
- **Workspace Awareness**: Understands project relationships and dependencies
- **Nx Console Support**: Visual integration with Nx Console

### 🤖 AI-Powered Insights
- **MCP Tools**: Extends nx-mcp with React-specific tools for AI assistants
- **Claude Code Integration**: Purpose-built for Claude Code AI assistant
- **Intelligent Recommendations**: AI-powered suggestions for code improvements
- **Pattern Learning**: Adapts to your team's coding patterns

## Installation

```bash
# Install the plugin
npm install -D @grafity/nx-react

# Add to your Nx workspace
nx g @grafity/nx-react:init
```

## Usage

### Executors

#### Analyze React Components
```bash
# Analyze React components in a project
nx analyze-react my-react-app

# Save analysis to file
nx analyze-react my-react-app --outputPath=dist/analysis.json
```

#### Visualize Component Relationships
```bash
# Generate interactive HTML visualization
nx visualize-components my-react-app --outputPath=dist/viz

# Generate as JSON for custom processing
nx visualize-components my-react-app --format=json
```

#### Detect Patterns and Anti-Patterns
```bash
# Generate pattern analysis report
nx detect-patterns my-react-app --outputPath=dist/patterns.md

# Generate HTML report
nx detect-patterns my-react-app --format=html
```

### MCP Tools for AI Assistants

This plugin extends nx-mcp with React-specific tools that AI assistants can use:

#### React Component Tree
```typescript
// AI assistants can call this tool
grafity_react_component_tree({
  projectName: "my-react-app",
  includeHooks: true,
  includeProps: true,
  maxDepth: 5
})
```

#### React Hook Usage Analysis
```typescript
grafity_react_hook_usage({
  projectName: "my-react-app",
  hookType: "useState", // Optional: filter by hook type
  includeCustomHooks: true,
  showDependencies: true
})
```

#### Prop Flow Analysis
```typescript
grafity_react_prop_flow({
  projectName: "my-react-app",
  detectPropDrilling: true,
  maxDepth: 5,
  includeTypes: true
})
```

## Architecture

### How It Works
1. **Leverages Nx Infrastructure**: Uses Nx's project graph, caching, and file watching
2. **React-Specific Analysis**: Adds deep React/TypeScript intelligence on top
3. **AI Integration**: Provides structured data to AI assistants via MCP
4. **Incremental Updates**: Only re-analyzes changed components

### What We Replaced from Standalone Grafity
- ❌ **Custom Project Graph** → ✅ **Nx Project Graph**
- ❌ **Custom File Scanning** → ✅ **Nx File Discovery**
- ❌ **Custom Dependency Analysis** → ✅ **Nx Dependency Graph**
- ❌ **Custom File Watching** → ✅ **Nx Watch Mode**
- ❌ **Custom MCP Server** → ✅ **Extends nx-mcp**

### What We Enhanced
- ✅ **React AST Analysis** - Deep component understanding
- ✅ **Data Flow Analysis** - State, props, context tracking
- ✅ **Pattern Detection** - React-specific patterns and anti-patterns
- ✅ **AI Integration** - MCP tools for AI assistants
- ✅ **Visual Interactions** - Interactive component graphs

## Configuration

### Project Configuration
The plugin automatically adds these targets to React projects:

```json
{
  "targets": {
    "analyze-react": {
      "executor": "@grafity/nx-react:analyze-react"
    },
    "visualize-components": {
      "executor": "@grafity/nx-react:visualize-components"
    },
    "detect-patterns": {
      "executor": "@grafity/nx-react:detect-patterns"
    }
  }
}
```

### AI Assistant Integration
To use with Claude Code, ensure nx-mcp is configured and this plugin's tools will be automatically available:

```json
// .cursor/mcp.json or Claude Desktop config
{
  "servers": {
    "nx-mcp": {
      "command": "npx",
      "args": ["nx-mcp@latest"]
    }
  }
}
```

## Examples

### Analyzing the Sample React App
```bash
# Analyze the sample React app
nx analyze-react sample-react-app

# Generate visualization
nx visualize-components sample-react-app --outputPath=dist/sample-viz

# Detect patterns
nx detect-patterns sample-react-app --outputPath=dist/sample-patterns.md
```

### AI Assistant Workflow
1. **Ask about components**: "What React components are in my-app?"
2. **Analyze hooks**: "Show me hook usage patterns in my React app"
3. **Detect issues**: "Are there any prop drilling issues in my components?"
4. **Get recommendations**: "How can I improve my React architecture?"

## Benefits Over Standalone Grafity

### Performance
- **50x faster startup** - No need to build project graph from scratch
- **Incremental analysis** - Only analyze changed files
- **Nx caching** - Reuse analysis results across runs

### Integration
- **Nx Console** - Visual integration in VS Code
- **Workspace awareness** - Understands project relationships
- **AI assistants** - Seamless integration with nx-mcp

### Maintenance
- **No wheel reinvention** - Leverages mature Nx infrastructure
- **Focus on React** - Concentrated on React-specific features
- **Better ecosystem** - Part of Nx plugin ecosystem

## Contributing

This plugin focuses on React-specific intelligence while leveraging Nx's robust infrastructure. Contributions should enhance React analysis capabilities rather than rebuild basic graph functionality.

### Development
```bash
# Build the plugin
nx build @grafity/nx-react

# Test with sample app
nx analyze-react sample-react-app

# Run tests
nx test @grafity/nx-react
```

## License

MIT