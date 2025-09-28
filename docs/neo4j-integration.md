# Neo4j Integration Guide

## Overview

Grafity now supports Neo4j as a persistent graph database backend, enabling:
- Scalable storage for millions of nodes and edges
- Powerful Cypher query language
- ACID transactions and data consistency
- Interactive graph visualization via Neo4j Browser
- Real-time graph analytics

## Quick Start

### 1. Start Neo4j

```bash
# Start Neo4j container
npm run neo4j:start

# Check status
npm run neo4j:status
```

Neo4j will be available at:
- Browser: http://localhost:7474
- Bolt: bolt://localhost:7687
- Credentials: neo4j / grafity123

### 2. Run Tests

```bash
# Test Neo4j integration
npm run neo4j:test

# Import sample data
npm run neo4j:import
```

### 3. Explore in Neo4j Browser

Open http://localhost:7474 and run:

```cypher
// Show all nodes and relationships
MATCH (n) RETURN n LIMIT 100

// Find code components
MATCH (n:CodeNode {codeType: 'component'})
RETURN n

// Find call relationships
MATCH (a:CodeNode)-[r:EDGE {type: 'calls'}]->(b:CodeNode)
RETURN a, r, b

// Find shortest path
MATCH p = shortestPath(
  (a:Node {id: 'comp-1'})-[:EDGE*]-(b:Node {id: 'func-2'})
)
RETURN p
```

## Architecture

### Neo4jAdapter
Low-level Neo4j driver wrapper that handles:
- Connection management
- Schema initialization
- CRUD operations for nodes and edges
- Cypher query execution

### Neo4jGraphStore
Extends the in-memory GraphStore with persistence:
- Automatic synchronization to Neo4j
- Caching for performance
- Batch operations
- Hybrid memory/database storage

### Neo4jQueryTranslator
Translates QueryEngine operations to Cypher:
- Path finding algorithms
- Pattern matching
- Aggregations
- Complex queries

## Configuration

### Environment Variables

Create a `.env` file:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=grafity123
GRAPH_STORAGE_MODE=neo4j
GRAPH_CACHE_TTL=3600
GRAPH_BATCH_SIZE=1000
```

### Docker Compose

The `docker-compose.yml` includes:
- Neo4j Community Edition
- Memory configuration
- Volume persistence
- APOC plugin support

## Usage Examples

### Using Neo4jGraphStore

```typescript
import { Neo4jGraphStore } from './persistence/Neo4jGraphStore';

// Create store
const store = new Neo4jGraphStore({
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'grafity123',
  cacheEnabled: true,
  autoSync: true
});

// Initialize
await store.initialize();

// Add nodes
store.addNode({
  id: 'node-1',
  type: 'code',
  label: 'MyComponent',
  // ...
});

// Sync to Neo4j
await store.sync();

// Query with Cypher
const result = await store.query(`
  MATCH (n:CodeNode)-[:EDGE]->(m)
  RETURN n, m
`);
```

### Direct Cypher Queries

```typescript
import { Neo4jAdapter } from './persistence/Neo4jAdapter';

const neo4j = new Neo4jAdapter({
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'grafity123'
});

// Custom query
const result = await neo4j.query(`
  MATCH (n:CodeNode)
  WHERE n.complexity > $threshold
  RETURN n.label, n.complexity
  ORDER BY n.complexity DESC
`, { threshold: 10 });
```

## Performance Optimization

### Batch Operations

```typescript
// Batch insert nodes
await store.upsertNodes(largeNodeArray);

// Batch insert edges
await store.upsertEdges(largeEdgeArray);
```

### Caching Strategy

```typescript
const store = new Neo4jGraphStore({
  cacheEnabled: true,     // Keep nodes in memory
  cacheTTL: 3600000,      // 1 hour TTL
  batchSize: 1000,        // Batch size for sync
  autoSync: true          // Auto-sync every 30s
});
```

### Indexes

The schema automatically creates indexes for:
- Node IDs (unique constraint)
- Node types
- Node labels
- File paths
- Edge types
- Edge weights

## Graph Analytics

### Connected Components

```cypher
CALL gds.graph.project(
  'myGraph',
  'Node',
  'EDGE'
)

CALL gds.wcc.stream('myGraph')
YIELD nodeId, componentId
RETURN gds.util.asNode(nodeId).label AS node, componentId
ORDER BY componentId
```

### PageRank

```cypher
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).label AS node, score
ORDER BY score DESC
LIMIT 10
```

### Community Detection

```cypher
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).label) AS community
ORDER BY size(community) DESC
```

## Backup and Restore

### Create Backup

```bash
# Using script
./scripts/neo4j.sh backup

# Manual backup
docker exec grafity-neo4j neo4j-admin database dump neo4j --to-stdout > backup.dump
```

### Restore from Backup

```bash
# Stop Neo4j
docker-compose stop neo4j

# Restore
docker exec -i grafity-neo4j neo4j-admin database load --from-stdin neo4j < backup.dump

# Start Neo4j
docker-compose start neo4j
```

## Troubleshooting

### Connection Issues

```bash
# Check if Neo4j is running
npm run neo4j:status

# View logs
docker-compose logs -f neo4j

# Restart Neo4j
npm run neo4j:stop && npm run neo4j:start
```

### Memory Issues

Adjust memory in `docker-compose.yml`:

```yaml
environment:
  NEO4J_server_memory_heap_max__size: 4G
  NEO4J_server_memory_pagecache__size: 2G
```

### Clear Data

```bash
# Clear all data (CAUTION!)
npm run neo4j:clear

# Or via Cypher
MATCH (n) DETACH DELETE n
```

## Best Practices

1. **Use Batch Operations**: For large datasets, use batch insert/update methods
2. **Enable Caching**: Keep frequently accessed nodes in memory
3. **Create Indexes**: Add indexes for properties you query frequently
4. **Monitor Performance**: Use Neo4j metrics and query profiling
5. **Regular Backups**: Schedule automated backups of critical data
6. **Connection Pooling**: Neo4j driver handles connection pooling automatically
7. **Transaction Management**: Use transactions for multi-operation consistency

## Advanced Features

### Stored Procedures

Create custom procedures for complex operations:

```cypher
CALL apoc.custom.asProcedure(
  'findCodeClusters',
  'MATCH (n:CodeNode)-[:EDGE*1..2]-(m:CodeNode)
   WITH n, collect(distinct m) as cluster
   WHERE size(cluster) > $minSize
   RETURN n.label as root, cluster',
  'read',
  [['root', 'STRING'], ['cluster', 'LIST OF NODE']],
  [['minSize', 'INTEGER', 3]]
)
```

### Graph Algorithms

Use Neo4j Graph Data Science library:

```bash
# Install GDS plugin
docker exec -it grafity-neo4j bash
neo4j-admin plugin install gds
```

### Real-time Updates

Subscribe to graph changes:

```typescript
// Coming soon: WebSocket support for real-time updates
const subscription = store.subscribe('node-changes', (event) => {
  console.log('Node changed:', event);
});
```

## Resources

- [Neo4j Documentation](https://neo4j.com/docs/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/)
- [Neo4j JavaScript Driver](https://neo4j.com/docs/javascript-manual/)
- [Graph Data Science Library](https://neo4j.com/docs/graph-data-science/)
- [APOC Procedures](https://neo4j.com/labs/apoc/)