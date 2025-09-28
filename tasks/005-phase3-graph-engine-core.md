# Phase 3: Graph Engine Core
**Duration**: 2 weeks
**Priority**: Critical

## Overview
Build the core graph engine that connects all data sources with bi-directional relationships.

## Tasks

### 3.1 Graph Node Types Definition
**File**: `src/core/graph-engine/types/NodeTypes.ts`

- [ ] Define base GraphNode interface
- [ ] Create CodeNode type
- [ ] Create BusinessNode type
- [ ] Create DocumentNode type
- [ ] Create ConversationNode type
- [ ] Add metadata fields

### 3.2 Graph Edge Types Definition
**File**: `src/core/graph-engine/types/EdgeTypes.ts`

- [ ] Define base GraphEdge interface
- [ ] Create relationship types enum
- [ ] Add bi-directional flag
- [ ] Define edge weight/strength
- [ ] Add edge metadata

### 3.3 Graph Store Implementation
**File**: `src/core/graph-engine/GraphStore.ts`

- [ ] Implement in-memory graph storage
- [ ] Create node CRUD operations
- [ ] Create edge CRUD operations
- [ ] Add indexing by node type
- [ ] Implement search capabilities

### 3.4 Graph Builder Base Class
**File**: `src/core/graph-engine/builders/GraphBuilder.ts`

- [ ] Create abstract builder class
- [ ] Define builder interface
- [ ] Implement node creation helpers
- [ ] Implement edge creation helpers
- [ ] Add validation methods

### 3.5 Code Graph Builder
**File**: `src/core/graph-engine/builders/CodeGraphBuilder.ts`

- [ ] Extend GraphBuilder class
- [ ] Convert AST nodes to graph nodes
- [ ] Create component relationships
- [ ] Map function dependencies
- [ ] Link data flows

### 3.6 Business Graph Builder Enhancement
**File**: `src/core/graph-engine/builders/BusinessGraphBuilder.ts`

- [ ] Integrate with existing BusinessGraphBuilder
- [ ] Add bi-directional edge support
- [ ] Connect to code nodes
- [ ] Link user stories to components
- [ ] Map features to functions

### 3.7 Document Graph Builder
**File**: `src/core/graph-engine/builders/DocumentGraphBuilder.ts`

- [ ] Parse markdown documents
- [ ] Extract document structure
- [ ] Create section nodes
- [ ] Link related documents
- [ ] Connect to code references

### 3.8 Conversation Graph Builder
**File**: `src/core/graph-engine/builders/ConversationGraphBuilder.ts`

- [ ] Parse conversation history
- [ ] Create message nodes
- [ ] Extract code references
- [ ] Link to documentation
- [ ] Build conversation flow

### 3.9 Graph Connector Service
**File**: `src/core/graph-engine/GraphConnector.ts`

- [ ] Implement cross-graph linking
- [ ] Find related nodes across types
- [ ] Create bi-directional edges
- [ ] Calculate connection strength
- [ ] Handle edge conflicts

### 3.10 Graph Query Engine
**File**: `src/core/graph-engine/QueryEngine.ts`

- [ ] Implement node queries
- [ ] Add path finding algorithms
- [ ] Create traversal methods
- [ ] Add filtering capabilities
- [ ] Implement aggregations

### 3.11 Graph Traversal Algorithms
**File**: `src/core/graph-engine/algorithms/Traversal.ts`

- [ ] Implement BFS traversal
- [ ] Implement DFS traversal
- [ ] Add shortest path finding
- [ ] Create connected components detection
- [ ] Add cycle detection

### 3.12 Graph Analytics Engine
**File**: `src/core/graph-engine/Analytics.ts`

- [ ] Calculate node centrality
- [ ] Find clusters/communities
- [ ] Detect patterns
- [ ] Measure graph density
- [ ] Generate statistics

### 3.13 Graph Persistence Layer
**File**: `src/core/graph-engine/persistence/GraphPersistence.ts`

- [ ] Implement JSON serialization
- [ ] Add GraphQL schema generation
- [ ] Create database adapter interface
- [ ] Handle incremental saves
- [ ] Add versioning support

### 3.14 Graph Event System
**File**: `src/core/graph-engine/events/GraphEvents.ts`

- [ ] Create event emitter
- [ ] Define event types
- [ ] Implement node change events
- [ ] Add edge change events
- [ ] Create subscription mechanism

### 3.15 Graph Validation
**File**: `src/core/graph-engine/validation/GraphValidator.ts`

- [ ] Validate node structures
- [ ] Check edge consistency
- [ ] Detect orphan nodes
- [ ] Verify bi-directional edges
- [ ] Report validation errors

### 3.16 Testing Framework
**File**: `src/core/graph-engine/__tests__/`

- [ ] Create graph test utilities
- [ ] Test node operations
- [ ] Test edge operations
- [ ] Test traversal algorithms
- [ ] Performance benchmarks

## Success Criteria
- [ ] Graph can store 10k+ nodes efficiently
- [ ] Bi-directional edges work correctly
- [ ] Query engine returns results < 100ms
- [ ] All node types are connected
- [ ] Graph persists and loads correctly

## Dependencies
- Phase 1: Claude Code CLI
- Phase 2: Mechanical Analysis
- Existing reverse-engineering code