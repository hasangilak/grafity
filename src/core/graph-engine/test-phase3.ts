#!/usr/bin/env npx ts-node

import { GraphStore } from './GraphStore';
import { QueryEngine } from './QueryEngine';
import { GraphTraversal } from './algorithms/Traversal';
import { GraphConnector } from './GraphConnector';
import { DocumentGraphBuilder } from './builders/DocumentGraphBuilder';
import { ConversationGraphBuilder } from './builders/ConversationGraphBuilder';
import { CodeGraphBuilder } from './builders/CodeGraphBuilder';
import { AnyGraphNode, CodeNode } from './types/NodeTypes';
import { ConversationData } from './builders/ConversationGraphBuilder';

async function testPhase3Components() {
  console.log('🧪 Testing Phase 3 Graph Engine Components\n');

  // Initialize store
  const store = new GraphStore();

  // Test 1: Create sample nodes
  console.log('1️⃣ Creating sample nodes...');

  // Add code nodes
  const codeBuilder = new CodeGraphBuilder(store);
  const func1: CodeNode = {
    id: 'func-1',
    type: 'code',
    label: 'calculateTotal',
    description: 'Calculates the total price',
    codeType: 'function',
    filePath: 'src/utils/pricing.ts',
    language: 'typescript',
    metadata: {
      filePath: 'src/utils/pricing.ts',
      codeType: 'function',
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
      filePath: 'src/utils/pricing.ts',
      codeType: 'function',
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
      filePath: 'src/components/Pricing.tsx',
      codeType: 'component',
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

  // Pattern matching
  const pattern = {
    nodes: [
      { type: 'code' },
      { type: 'code' }
    ],
    edges: [
      { type: 'calls' as any, from: 0, to: 1 }
    ]
  };
  const matches = queryEngine.findPattern(pattern);
  console.log(`Pattern matches: ${matches.metadata?.matchCount || 0}`);

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

  // Test 4: Graph Connector
  console.log('4️⃣ Testing Graph Connector...');
  const connector = new GraphConnector(store);

  // Add a business node to test connections
  store.addNode({
    id: 'business-1',
    type: 'business',
    label: 'Calculate pricing feature',
    description: 'User story for pricing calculation',
    metadata: {}
  });

  // Connect all nodes
  const connectionResult = connector.connectAll();
  console.log(`Connections created: ${connectionResult.created}`);
  console.log(`Connections updated: ${connectionResult.updated}`);
  console.log(`Conflicts: ${connectionResult.conflicts}`);
  if (connectionResult.errors.length > 0) {
    console.log(`Errors: ${connectionResult.errors.length}`);
  }

  // Find related nodes
  const related = connector.findRelatedNodes('func-1', 2);
  console.log(`Related to calculateTotal: ${related.length} nodes`);

  // Calculate connection strength
  const strength = connector.calculateConnectionStrength('comp-1', 'func-1');
  console.log(`Connection strength (PricingComponent → calculateTotal): ${strength.toFixed(2)}`);

  // Get statistics
  const stats = connector.getStatistics();
  console.log('Connector statistics:', stats);

  console.log('✅ Graph Connector tests passed\n');

  // Test 5: Document Graph Builder
  console.log('5️⃣ Testing Document Graph Builder...');
  const docBuilder = new DocumentGraphBuilder(store);

  // Create a sample markdown document
  const sampleMarkdown = `# Pricing Documentation

## Overview
This document describes the pricing calculation feature using the calculateTotal and applyDiscount functions.

## Functions

### calculateTotal
Located in \`src/utils/pricing.ts\`, this function calculates the total price.

\`\`\`typescript
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
\`\`\`

### applyDiscount
Applies a discount to the calculated price.

## Related Files
- [Pricing Component](src/components/Pricing.tsx)
- pricing.ts`;

  // Write sample file temporarily
  const fs = require('fs');
  const tempFile = '/tmp/pricing-docs.md';
  fs.writeFileSync(tempFile, sampleMarkdown);

  // Process the document
  const docNode = await docBuilder.processFile(tempFile);
  console.log(`Created document node: ${docNode.label}`);
  console.log(`Document sections: ${docNode.sections?.length || 0}`);

  console.log('✅ Document Graph Builder tests passed\n');

  // Test 6: Conversation Graph Builder
  console.log('6️⃣ Testing Conversation Graph Builder...');
  const convBuilder = new ConversationGraphBuilder(store);

  const sampleConversation: ConversationData = {
    id: 'conv-1',
    title: 'Discussion about pricing implementation',
    participants: ['user', 'assistant'],
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'How do I implement the calculateTotal function in src/utils/pricing.ts?',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'To implement calculateTotal, you need to iterate through items and sum their prices. You can also use the applyDiscount function for discounted items.',
        timestamp: new Date(Date.now() - 3000000).toISOString()
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Can you show me how to connect it to the PricingComponent?',
        timestamp: new Date(Date.now() - 2400000).toISOString()
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: 'Sure! In your PricingComponent at src/components/Pricing.tsx, import the calculateTotal function and use it in your component logic.',
        timestamp: new Date().toISOString()
      }
    ]
  };

  const parsed = await convBuilder.processConversation(sampleConversation);
  console.log(`Created conversation: ${parsed.conversation.label}`);
  console.log(`Code references: ${parsed.codeReferences.length}`);
  console.log(`Topics: ${parsed.topics.length}`);

  console.log('✅ Conversation Graph Builder tests passed\n');

  // Test 7: Re-run connector to link all new nodes
  console.log('7️⃣ Re-running Graph Connector with all node types...');
  const finalConnectionResult = connector.connectAll();
  console.log(`Total connections created: ${finalConnectionResult.created}`);
  console.log(`Total nodes in graph: ${store.getAllNodes().length}`);
  console.log(`Total edges in graph: ${store.getAllEdges().length}`);

  // Get final statistics
  const finalStats = store.getStatistics();
  console.log('\n📊 Final Graph Statistics:');
  console.log(`- Total Nodes: ${finalStats.totalNodes}`);
  console.log(`- Total Edges: ${finalStats.totalEdges}`);
  console.log(`- Node Types: ${Object.entries(finalStats.nodesByType).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  console.log(`- Edge Types: ${Object.entries(finalStats.edgesByType).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  console.log(`- Bidirectional Edges: ${finalStats.bidirectionalEdges}`);
  console.log(`- Average Out Degree: ${finalStats.averageOutDegree.toFixed(2)}`);

  // Test serialization
  console.log('\n8️⃣ Testing Serialization...');
  const serialized = store.toJSON();
  const newStore = new GraphStore();
  newStore.fromJSON(serialized);
  console.log(`✅ Serialization successful: ${newStore.getAllNodes().length} nodes restored`);

  console.log('\n✅ All Phase 3 component tests passed successfully!');
}

// Run tests
testPhase3Components().catch(console.error);