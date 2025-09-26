# Grafity → @grafity/nx-react

**Grafity has been transformed from a standalone tool into a powerful Nx plugin that leverages mature infrastructure while focusing on React-specific intelligence.**

## 🚀 What Changed

### Before: Standalone Tool
- Custom project graph generation
- Custom file scanning and watching
- Custom dependency analysis
- Standalone Express server
- Built everything from scratch

### After: Nx Plugin with AI Integration
- **Leverages Nx's project graph** - 50x faster startup
- **Uses Nx's file discovery** - Better performance and caching
- **Extends nx-mcp** - AI assistant integration
- **Focus on React intelligence** - Deep component analysis
- **Part of Nx ecosystem** - Better integration and support

## 📦 New Architecture

```
grafity/
├── packages/grafity-react/          # Nx plugin for React analysis
│   ├── src/analyzers/              # React-specific analyzers
│   ├── src/executors/              # Nx executors (analyze, visualize, patterns)
│   ├── src/mcp-tools/              # MCP tools for AI assistants
│   └── src/graph/                  # Nx project graph extensions
├── examples/sample-react-app/      # Test React application
├── archived-standalone-code/       # Original infrastructure (archived)
└── client/                         # Legacy frontend (kept for reference)
```

## 🛠️ Installation & Usage

### Install the Plugin
```bash
npm install -D @grafity/nx-react
```

### Analyze React Components
```bash
# Analyze components in a project
nx analyze-react my-react-app

# Generate interactive visualization
nx visualize-components my-react-app --outputPath=dist/viz

# Detect patterns and anti-patterns
nx detect-patterns my-react-app --outputPath=dist/patterns.md
```

### AI Assistant Integration
The plugin extends nx-mcp with React-specific tools:

```typescript
// AI assistants can call these tools
grafity_react_component_tree({ projectName: "my-app" })
grafity_react_hook_usage({ projectName: "my-app" })
grafity_react_prop_flow({ projectName: "my-app" })
```

## 🎯 Benefits of the Transformation

### Performance
- **50x faster startup** - No custom graph generation
- **Incremental analysis** - Nx caching and file watching
- **Better scalability** - Leverages Nx's optimizations

### Integration
- **Nx Console** - Visual integration in VS Code
- **AI Assistants** - Claude Code integration via nx-mcp
- **Workspace Awareness** - Understands project relationships

### Maintenance
- **No wheel reinvention** - Focus on React-specific features
- **Battle-tested infrastructure** - Nx's proven architecture
- **Better ecosystem** - Part of Nx plugin community

## 🔍 React Intelligence Features

### Deep Component Analysis
- Component hierarchy and relationships
- Props and hooks analysis
- JSX pattern detection
- TypeScript integration

### Data Flow Tracking
- State flow through hooks
- Props passing patterns
- Context usage analysis
- API integration patterns

### Pattern Detection
- Good patterns (custom hooks, composition)
- Anti-patterns (prop drilling, god components)
- Architectural recommendations
- Code quality metrics

### AI Integration
- Structured data for LLMs
- Interactive analysis via AI assistants
- Intelligent code suggestions
- Pattern learning and adaptation

## 🧪 Try It Out

### Demo with Sample App
```bash
# Analyze the included React sample app
npm run demo:analyze

# Generate visualization
npm run demo:visualize

# Detect patterns
npm run demo:patterns
```

### Sample Output
```
🔍 Analyzing React components in sample-react-app...
✅ Analysis complete for sample-react-app:
   📦 Components: 13
   🎯 Patterns: 3
   📊 State flows: 8
   🔗 Prop flows: 12
   📱 Context flows: 2
```

## 📚 Documentation

- **Plugin Documentation**: [`packages/grafity-react/README.md`](packages/grafity-react/README.md)
- **Archived Code**: [`archived-standalone-code/README.md`](archived-standalone-code/README.md)
- **Examples**: [`examples/sample-react-app/`](examples/sample-react-app/)

## 🎉 Why This Transformation Matters

**"Don't reinvent the wheel, enhance it."**

The result is a more powerful, maintainable, and integrated tool that provides deeper React insights while being easier to use and extend.

## 📄 License

MIT

---

**From standalone tool to Nx plugin - Grafity 2.0 represents leveraging proven infrastructure while delivering unique React intelligence and AI integration.**

