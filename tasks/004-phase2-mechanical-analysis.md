# Phase 2: Mechanical Analysis Pipeline
**Duration**: 1.5 weeks
**Priority**: Critical

## Overview
Build the mechanical analysis layer using Nx and TypeScript AST for 100% accurate structural data extraction.

## Tasks

### 2.1 Nx Project Graph Integration
**File**: `src/core/nx-integration/NxGraphProcessor.ts`

- [ ] Import @nx/devkit dependencies
- [ ] Implement createProjectGraphAsync wrapper
- [ ] Extract project nodes and dependencies
- [ ] Parse nx.json configuration
- [ ] Handle workspace.json/project.json

### 2.2 Nx Graph Data Transformer
**File**: `src/core/nx-integration/NxGraphTransformer.ts`

- [ ] Convert Nx nodes to internal format
- [ ] Transform dependency edges
- [ ] Extract file lists from projects
- [ ] Identify entry points
- [ ] Map build targets to components

### 2.3 Nx Cache Integration
**File**: `src/core/nx-integration/NxCacheManager.ts`

- [ ] Connect to Nx cache system
- [ ] Implement cache invalidation
- [ ] Track file changes
- [ ] Optimize incremental updates
- [ ] Handle cache misses

### 2.4 TypeScript Program Builder
**File**: `src/core/ast-mechanical/ProgramBuilder.ts`

- [ ] Create ts.createProgram wrapper
- [ ] Configure compiler options
- [ ] Handle tsconfig.json parsing
- [ ] Implement file resolution
- [ ] Add source map support

### 2.5 AST Visitor Implementation
**File**: `src/core/ast-mechanical/ASTVisitor.ts`

- [ ] Implement base visitor class
- [ ] Create visit methods for each node type
- [ ] Add depth tracking
- [ ] Implement node filtering
- [ ] Add visitor composition

### 2.6 Component Extractor
**File**: `src/core/ast-mechanical/extractors/ComponentExtractor.ts`

- [ ] Detect React functional components
- [ ] Detect React class components
- [ ] Extract component props
- [ ] Find hooks usage
- [ ] Identify component children

### 2.7 Function Analyzer
**File**: `src/core/ast-mechanical/extractors/FunctionAnalyzer.ts`

- [ ] Extract function declarations
- [ ] Analyze function parameters
- [ ] Detect return types
- [ ] Track function calls
- [ ] Build call graph

### 2.8 Import/Export Tracker
**File**: `src/core/ast-mechanical/extractors/ImportExportTracker.ts`

- [ ] Parse import statements
- [ ] Track export declarations
- [ ] Resolve module paths
- [ ] Handle dynamic imports
- [ ] Build dependency tree

### 2.9 Type Information Extractor
**File**: `src/core/ast-mechanical/extractors/TypeExtractor.ts`

- [ ] Extract interface definitions
- [ ] Parse type aliases
- [ ] Track generic types
- [ ] Resolve type references
- [ ] Build type hierarchy

### 2.10 Data Flow Analyzer
**File**: `src/core/ast-mechanical/DataFlowAnalyzer.ts`

- [ ] Track variable assignments
- [ ] Follow prop passing
- [ ] Analyze state mutations
- [ ] Detect data transformations
- [ ] Build data flow graph

### 2.11 Pattern Detector
**File**: `src/core/ast-mechanical/PatternDetector.ts`

- [ ] Implement pattern matching rules
- [ ] Detect common React patterns
- [ ] Find anti-patterns
- [ ] Calculate pattern confidence
- [ ] Generate pattern reports

### 2.12 Mechanical Pipeline Orchestrator
**File**: `src/core/pipeline/MechanicalPipeline.ts`

- [ ] Coordinate Nx and AST analysis
- [ ] Implement parallel processing
- [ ] Handle error aggregation
- [ ] Generate unified output
- [ ] Add progress tracking

### 2.13 Testing Framework
**File**: `src/core/ast-mechanical/__tests__/`

- [ ] Create sample TypeScript files
- [ ] Test AST parsing accuracy
- [ ] Verify visitor patterns
- [ ] Test edge cases
- [ ] Benchmark performance

## Success Criteria
- [ ] Can extract complete project structure from Nx
- [ ] AST parser identifies all code elements correctly
- [ ] Data flow tracking works across files
- [ ] Pattern detection has >90% accuracy
- [ ] Pipeline processes large codebases efficiently

## Dependencies
- @nx/devkit
- TypeScript Compiler API
- Previous AST parser implementation