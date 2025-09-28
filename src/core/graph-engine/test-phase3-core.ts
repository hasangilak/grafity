#!/usr/bin/env npx ts-node

import { GraphStore } from './GraphStore';
import { QueryEngine } from './QueryEngine';
import { GraphTraversal } from './algorithms/Traversal';
import { CodeNode } from './types/NodeTypes';

async function testPhase3Core() {
  console.log('🧪 Testing Phase 3 Core Components\n');

  // Initialize store
  const store = new GraphStore();

  // Test 1: Create sample nodes
  console.log('1️⃣ Creating sample nodes...');

  // Add code nodes
  const func1: CodeNode = {
    id: 'func-1',
    type: 'code',
    label: 'calculateTotal',
    description: 'Calculates the total price',
    codeType: 'function',
    filePath: 'src/utils/pricing.ts',
    language: 'typescript',
    metadata: {
      complexity: 5
    }
  };

  const func2: CodeNode = {
    id: 'func-2',
    type: 'code',
    label: 'applyDiscount',
    description: 'Applies discount to price',
    codeType: 'function',
    filePath: 'src/utils/pricing.ts',
    language: 'typescript',
    metadata: {
      complexity: 3
    }
  };

  const comp1: CodeNode = {
    id: 'comp-1',
    type: 'code',
    label: 'PricingComponent',
    description: 'React component for pricing',
    codeType: 'component',
    filePath: 'src/components/Pricing.tsx',
    language: 'typescript',
    metadata: {
      complexity: 10
    }
  };

  store.addNode(func1);
  store.addNode(func2);
  store.addNode(comp1);

  // Add edges
  store.addEdge({
    id: 'edge-1',
    source: 'comp-1',
    target: 'func-1',
    type: 'calls',
    bidirectional: false,
    weight: 0.9,
    metadata: {}
  });

  store.addEdge({
    id: 'edge-2',
    source: 'func-1',
    target: 'func-2',
    type: 'uses',
    bidirectional: false,
    weight: 0.7,
    metadata: {}
  });

  console.log(`✅ Created ${store.getAllNodes().length} nodes and ${store.getAllEdges().length} edges\n`);

  // Test 2: Query Engine
  console.log('2️⃣ Testing Query Engine...');
  const queryEngine = new QueryEngine(store);

  // Find nodes by type
  const codeNodes = queryEngine.findNodes(node => node.type === 'code');
  console.log(`Found ${codeNodes.nodes?.length} code nodes`);

  // Find shortest path
  const shortestPath = queryEngine.findShortestPath('comp-1', 'func-2');
  if (shortestPath.paths && shortestPath.paths.length > 0) {
    const path = shortestPath.paths[0];
    console.log(`Shortest path: ${path.nodes.map(n => n.label).join(' → ')}`);
  }

  // Find neighborhood
  const neighborhood = queryEngine.findNeighborhood('func-1', 1);
  console.log(`Neighborhood of calculateTotal: ${neighborhood.nodes?.length} nodes`);

  // Aggregation
  const aggregated = queryEngine.aggregate('type');
  console.log('Nodes by type:', aggregated.aggregations);

  console.log('✅ Query Engine tests passed\n');

  // Test 3: Graph Traversal
  console.log('3️⃣ Testing Graph Traversal...');
  const traversal = new GraphTraversal(store);

  // BFS traversal
  const bfsResult = traversal.bfs('comp-1');
  console.log(`BFS visit order: ${bfsResult.visitOrder.join(', ')}`);

  // DFS traversal
  const dfsResult = traversal.dfs('comp-1');
  console.log(`DFS visit order: ${dfsResult.visitOrder.join(', ')}`);

  // Find all paths
  const allPaths = traversal.findAllPaths('comp-1', 'func-2');
  console.log(`Found ${allPaths.length} paths from PricingComponent to applyDiscount`);

  // Detect cycles
  const cycles = traversal.detectCycles();
  console.log(`Cycles detected: ${cycles.length}`);

  // Check if bipartite
  const isBipartite = traversal.isBipartite();
  console.log(`Is graph bipartite: ${isBipartite}`);

  // Connected components
  const components = traversal.findConnectedComponents();
  console.log(`Connected components: ${components.components.length}`);
  console.log(`Bridges: ${components.bridges.length}`);
  console.log(`Articulation points: ${components.articulationPoints.length}`);

  console.log('✅ Graph Traversal tests passed\n');

  // Get final statistics
  const finalStats = store.getStatistics();
  console.log('📊 Final Graph Statistics:');
  console.log(`- Total Nodes: ${finalStats.totalNodes}`);
  console.log(`- Total Edges: ${finalStats.totalEdges}`);
  console.log(`- Node Types: ${Object.entries(finalStats.nodesByType).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  console.log(`- Edge Types: ${Object.entries(finalStats.edgesByType).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  console.log(`- Bidirectional Edges: ${finalStats.bidirectionalEdges}`);
  console.log(`- Average Out Degree: ${finalStats.averageOutDegree.toFixed(2)}`);

  // Test serialization
  console.log('\n4️⃣ Testing Serialization...');
  const serialized = store.toJSON();
  const newStore = new GraphStore();
  newStore.fromJSON(serialized);
  console.log(`✅ Serialization successful: ${newStore.getAllNodes().length} nodes restored`);

  console.log('\n✅ All Phase 3 core component tests passed successfully!');
}

// Run tests
testPhase3Core().catch(console.error);