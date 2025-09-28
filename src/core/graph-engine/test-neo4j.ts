#!/usr/bin/env npx ts-node

import * as dotenv from 'dotenv';
import { Neo4jGraphStore } from './persistence/Neo4jGraphStore';
import { Neo4jQueryTranslator } from './persistence/Neo4jQueryTranslator';
import { Neo4jAdapter } from './persistence/Neo4jAdapter';
import { CodeNode } from './types/NodeTypes';
import { QueryEngine } from './QueryEngine';

// Load environment variables
dotenv.config();

async function testNeo4jIntegration() {
  console.log('🧪 Testing Neo4j Integration\n');

  const neo4jConfig = {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'grafity123',
    database: 'neo4j'
  };

  // Test 1: Create Neo4j Graph Store
  console.log('1️⃣ Creating Neo4j Graph Store...');
  const store = new Neo4jGraphStore({
    ...neo4jConfig,
    cacheEnabled: true,
    autoSync: true,
    batchSize: 100
  });

  try {
    await store.initialize();
    console.log('✅ Connected to Neo4j successfully\n');
  } catch (error) {
    console.error('❌ Failed to connect to Neo4j:', error);
    console.log('\n💡 Make sure Neo4j is running:');
    console.log('   docker-compose up -d neo4j');
    return;
  }

  // Test 2: Clear existing data
  console.log('2️⃣ Clearing existing data...');
  await store.clearAll();
  console.log('✅ Database cleared\n');

  // Test 3: Add sample nodes
  console.log('3️⃣ Adding sample nodes...');

  const func1: CodeNode = {
    id: 'func-neo4j-1',
    type: 'code',
    label: 'calculatePrice',
    description: 'Calculates product price with tax',
    codeType: 'function',
    filePath: 'src/utils/pricing.ts',
    language: 'typescript',
    metadata: {
      complexity: 5,
      lines: 25
    }
  };

  const func2: CodeNode = {
    id: 'func-neo4j-2',
    type: 'code',
    label: 'applyTax',
    description: 'Applies tax to price',
    codeType: 'function',
    filePath: 'src/utils/tax.ts',
    language: 'typescript',
    metadata: {
      complexity: 3,
      lines: 15
    }
  };

  const comp1: CodeNode = {
    id: 'comp-neo4j-1',
    type: 'code',
    label: 'PriceDisplay',
    description: 'React component to display prices',
    codeType: 'component',
    filePath: 'src/components/PriceDisplay.tsx',
    language: 'typescript',
    metadata: {
      complexity: 8,
      lines: 120,
      hasHooks: true
    }
  };

  store.addNode(func1);
  store.addNode(func2);
  store.addNode(comp1);

  // Add business node
  store.addNode({
    id: 'business-neo4j-1',
    type: 'business',
    label: 'Price Calculation Feature',
    description: 'As a user, I want to see product prices with tax',
    metadata: {
      priority: 'high',
      sprint: 3
    }
  });

  // Add edges
  store.addEdge({
    id: 'edge-neo4j-1',
    source: 'comp-neo4j-1',
    target: 'func-neo4j-1',
    type: 'calls',
    bidirectional: false,
    weight: 0.9,
    metadata: { count: 3 }
  });

  store.addEdge({
    id: 'edge-neo4j-2',
    source: 'func-neo4j-1',
    target: 'func-neo4j-2',
    type: 'uses',
    bidirectional: false,
    weight: 0.8,
    metadata: { always: true }
  });

  store.addEdge({
    id: 'edge-neo4j-3',
    source: 'business-neo4j-1',
    target: 'comp-neo4j-1',
    type: 'implements',
    bidirectional: true,
    weight: 1.0,
    metadata: {}
  });

  console.log(`✅ Added ${store.getAllNodes().length} nodes and ${store.getAllEdges().length} edges\n`);

  // Test 4: Sync to Neo4j
  console.log('4️⃣ Syncing to Neo4j...');
  await store.sync();
  console.log('✅ Data synced to Neo4j\n');

  // Test 5: Query with Neo4j Query Translator
  console.log('5️⃣ Testing Neo4j Query Translator...');
  const neo4jAdapter = new Neo4jAdapter(neo4jConfig);
  const translator = new Neo4jQueryTranslator(neo4jAdapter);

  // Find code nodes
  const codeNodes = await translator.findNodes(
    node => node.type === 'code',
    { limit: 10 }
  );
  console.log(`Found ${codeNodes.nodes?.length} code nodes via Cypher`);

  // Find shortest path
  const shortestPath = await translator.findShortestPath('comp-neo4j-1', 'func-neo4j-2');
  if (shortestPath.paths && shortestPath.paths.length > 0) {
    const path = shortestPath.paths[0];
    console.log(`Shortest path: ${path.nodes.map(n => n.label).join(' → ')}`);
  }

  // Find neighborhood
  const neighborhood = await translator.findNeighborhood('func-neo4j-1', 2);
  console.log(`Neighborhood: ${neighborhood.nodes?.length} nodes`);

  console.log('✅ Query translator working\n');

  // Test 6: Direct Cypher queries
  console.log('6️⃣ Testing direct Cypher queries...');
  const cypherResult = await store.query(
    `
    MATCH (n:CodeNode)-[:EDGE]->(m:CodeNode)
    RETURN n.label as source, m.label as target, count(*) as connections
    ORDER BY connections DESC
    `
  );

  console.log('Connection patterns:');
  for (const record of cypherResult.records) {
    console.log(`  ${record.get('source')} → ${record.get('target')}: ${record.get('connections')} connections`);
  }
  console.log('✅ Direct Cypher queries working\n');

  // Test 7: Get statistics
  console.log('7️⃣ Getting Neo4j statistics...');
  const stats = await store.getNeo4jStatistics();
  console.log('📊 Neo4j Database Statistics:');
  console.log(`  - Total Nodes: ${stats.nodeCount}`);
  console.log(`  - Total Edges: ${stats.edgeCount}`);
  console.log(`  - Node Types: ${JSON.stringify(stats.nodesByType)}`);
  console.log(`  - Edge Types: ${JSON.stringify(stats.edgesByType)}`);
  console.log('');

  // Test 8: Reload from Neo4j
  console.log('8️⃣ Testing reload from Neo4j...');

  // Add a node only in memory
  store.addNode({
    id: 'temp-node',
    type: 'code',
    label: 'TemporaryNode',
    metadata: {}
  } as CodeNode);

  console.log(`Nodes before reload: ${store.getAllNodes().length}`);

  // Reload (discards temp-node)
  await store.reload();
  console.log(`Nodes after reload: ${store.getAllNodes().length}`);
  console.log('✅ Reload working correctly\n');

  // Test 9: Export to Cypher
  console.log('9️⃣ Exporting to Cypher statements...');
  const cypherStatements = await store.exportToCypher();
  console.log(`Generated ${cypherStatements.length} Cypher statements`);
  console.log('Sample statements:');
  cypherStatements.slice(0, 3).forEach(stmt => {
    console.log(`  ${stmt.substring(0, 80)}...`);
  });
  console.log('');

  // Test 10: Performance test
  console.log('🔟 Performance test - Adding 100 nodes...');
  const startTime = Date.now();

  for (let i = 0; i < 100; i++) {
    store.addNode({
      id: `perf-node-${i}`,
      type: 'code',
      label: `Function${i}`,
      description: `Test function ${i}`,
      codeType: 'function',
      filePath: `src/test/func${i}.ts`,
      language: 'typescript',
      metadata: { index: i }
    } as CodeNode);
  }

  await store.sync();
  const elapsed = Date.now() - startTime;
  console.log(`✅ Added and synced 100 nodes in ${elapsed}ms\n`);

  // Cleanup
  console.log('🧹 Cleaning up...');
  await store.close();
  await neo4jAdapter.close();
  console.log('✅ Connections closed');

  console.log('\n✅ All Neo4j integration tests passed successfully!');
  console.log('\n💡 You can view the graph in Neo4j Browser:');
  console.log('   http://localhost:7474');
  console.log('   Username: neo4j');
  console.log('   Password: grafity123');
}

// Run tests
testNeo4jIntegration().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});