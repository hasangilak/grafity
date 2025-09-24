# Task: Create Grafity MCP Server for Claude Code Integration

## Objective
Make a local MCP (Model Context Protocol) server for Grafity so people can use it with npx and add it to Claude Code.

## Implementation Plan

### Phase 1: Setup and Dependencies
- Install `@anthropic-ai/claude-code` and `zod` dependencies
- Create MCP module structure in `src/mcp/`
- Update package.json with MCP-specific scripts and bin entry

### Phase 2: Tool Definitions
Create MCP tools using `tool()` function from Claude Code SDK:
1. **analyze_project** - Analyze TypeScript/React project structure
2. **get_dependencies** - Get filtered dependency graphs
3. **analyze_dataflow** - Trace data flow through components
4. **detect_patterns** - Find architectural patterns and anti-patterns
5. **export_graph** - Export graphs in various formats (json, dot, markdown, AI-optimized)

### Phase 3: MCP Server Implementation
- Use `createSdkMcpServer()` to create in-process SDK server
- Register all tools with proper Zod schemas
- Leverage existing Grafity analyzers (GraphGenerator, DataFlowAnalyzer, etc.)

### Phase 4: NPX Support
- Create CLI entry point at `src/mcp/cli.ts`
- Support both stdio and SSE transport modes
- Add bin entry: `"grafity-mcp": "./dist/mcp/cli.js"`
- Enable usage via `npx grafity-mcp`

### Phase 5: Claude Code Integration
- Users can add via: `claude mcp add grafity`
- Support commands:
  - `npx grafity-mcp --stdio` (recommended)
  - `npx grafity-mcp --sse` (alternative transport)

### Phase 6: Testing and Publishing
- Unit tests for each tool
- Integration tests with Claude Code SDK
- Publish to npm as `grafity-mcp`

## Key Technical Details
- Use TypeScript with `@anthropic-ai/claude-code` SDK
- Each tool returns `{ content: [{ type: 'text', text: result }] }`
- Tools should be granular and focused for better Claude integration
- Maintain compatibility with existing Grafity REST API

## Resources
- Claude Code SDK Docs: https://docs.claude.com/en/docs/claude-code/sdk/sdk-typescript
- Examples: https://github.com/hasangilak/anthropics-claude-code-sdk-typescript-examples
- Reference implementations found in:
  - ben-vargas/ai-sdk-provider-claude-code
  - ceedaragents/cyrus (packages/claude-runner)

## Status
**Planning Phase** - Research completed, ready for implementation