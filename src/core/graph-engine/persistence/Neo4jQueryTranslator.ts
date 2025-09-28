import { Neo4jAdapter } from './Neo4jAdapter';
import { QueryResult, QueryOptions, NodePredicate, EdgePredicate, Path } from '../QueryEngine';
import { AnyGraphNode } from '../types/NodeTypes';
import { GraphEdge } from '../types/EdgeTypes';

/**
 * Translates QueryEngine operations to Neo4j Cypher queries
 */
export class Neo4jQueryTranslator {
  constructor(private neo4j: Neo4jAdapter) {}

  /**
   * Find nodes matching a predicate
   */
  async findNodes(
    predicate: NodePredicate,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    // Convert predicate to Cypher WHERE clause
    // This is simplified - in production you'd parse the predicate function
    const whereClause = this.predicateToWhere(predicate);

    let query = `MATCH (n:Node) ${whereClause} RETURN n`;

    // Add sorting
    if (options.orderBy) {
      query += ` ORDER BY n.${options.orderBy}`;
      if (options.direction === 'desc') {
        query += ' DESC';
      }
    }

    // Add pagination
    if (options.offset !== undefined) {
      query += ` SKIP ${options.offset}`;
    }
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.neo4j.query(query);
    const nodes = result.records.map(r => this.recordToNode(r.get('n')));

    const queryResult: QueryResult = { nodes };

    // Include edges if requested
    if (options.includeEdges && nodes.length > 0) {
      const nodeIds = nodes.map(n => n.id);
      const edgesQuery = `
        MATCH (n:Node)-[r:EDGE]->(m:Node)
        WHERE n.id IN $nodeIds OR m.id IN $nodeIds
        AND (r.isReverse IS NULL OR r.isReverse = false)
        RETURN DISTINCT r
      `;

      const edgesResult = await this.neo4j.query(edgesQuery, { nodeIds });
      queryResult.edges = edgesResult.records.map(r => this.recordToEdge(r.get('r')));
    }

    return queryResult;
  }

  /**
   * Find shortest path between nodes
   */
  async findShortestPath(sourceId: string, targetId: string): Promise<QueryResult> {
    const query = `
      MATCH p = shortestPath((s:Node {id: $sourceId})-[:EDGE*]-(t:Node {id: $targetId}))
      RETURN p
    `;

    const result = await this.neo4j.query(query, { sourceId, targetId });

    if (result.records.length === 0) {
      return { paths: [] };
    }

    const pathRecord = result.records[0].get('p');
    const path = this.recordToPath(pathRecord);

    return { paths: [path] };
  }

  /**
   * Find all paths between nodes
   */
  async findPaths(
    sourceId: string,
    targetId: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const maxDepth = options.maxDepth || 10;
    const limit = options.limit || 10;

    const query = `
      MATCH p = (s:Node {id: $sourceId})-[:EDGE*1..${maxDepth}]-(t:Node {id: $targetId})
      RETURN p
      ORDER BY length(p)
      LIMIT ${limit}
    `;

    const result = await this.neo4j.query(query, { sourceId, targetId });
    const paths = result.records.map(r => this.recordToPath(r.get('p')));

    return { paths };
  }

  /**
   * Find neighborhood of a node
   */
  async findNeighborhood(
    sourceId: string,
    maxDistance: number = 2
  ): Promise<QueryResult> {
    const query = `
      MATCH path = (s:Node {id: $sourceId})-[:EDGE*1..${maxDistance}]-(n:Node)
      WITH DISTINCT n, min(length(path)) as distance
      RETURN n, distance
      ORDER BY distance
    `;

    const result = await this.neo4j.query(query, { sourceId });
    const nodes = result.records.map(r => this.recordToNode(r.get('n')));

    const distances: Record<string, number> = {};
    result.records.forEach(r => {
      const node = this.recordToNode(r.get('n'));
      distances[node.id] = r.get('distance').toNumber();
    });

    return {
      nodes,
      metadata: { distances }
    };
  }

  /**
   * Pattern matching
   */
  async findPattern(pattern: {
    nodes: Array<{ type?: string; predicate?: NodePredicate }>;
    edges: Array<{ type?: string; from: number; to: number }>;
  }): Promise<QueryResult> {
    // Build Cypher pattern
    let matchClauses: string[] = [];
    let whereClauses: string[] = [];

    // Create node patterns
    for (let i = 0; i < pattern.nodes.length; i++) {
      const nodePattern = pattern.nodes[i];
      let nodeMatch = `(n${i}:Node`;

      if (nodePattern.type) {
        whereClauses.push(`n${i}.type = '${nodePattern.type}'`);
      }

      nodeMatch += ')';
      matchClauses.push(nodeMatch);
    }

    // Create edge patterns
    for (const edgePattern of pattern.edges) {
      const edgeMatch = `(n${edgePattern.from})-[e${edgePattern.from}_${edgePattern.to}:EDGE`;

      if (edgePattern.type) {
        whereClauses.push(`e${edgePattern.from}_${edgePattern.to}.type = '${edgePattern.type}'`);
      }

      matchClauses.push(`${edgeMatch}]->(n${edgePattern.to})`);
    }

    const query = `
      MATCH ${matchClauses.join(', ')}
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      RETURN ${pattern.nodes.map((_, i) => `n${i}`).join(', ')},
             ${pattern.edges.map(e => `e${e.from}_${e.to}`).join(', ')}
    `;

    const result = await this.neo4j.query(query);

    const matches: Array<{ nodes: AnyGraphNode[]; edges: GraphEdge[] }> = [];

    for (const record of result.records) {
      const nodes: AnyGraphNode[] = [];
      const edges: GraphEdge[] = [];

      for (let i = 0; i < pattern.nodes.length; i++) {
        nodes.push(this.recordToNode(record.get(`n${i}`)));
      }

      for (const edgePattern of pattern.edges) {
        edges.push(this.recordToEdge(record.get(`e${edgePattern.from}_${edgePattern.to}`)));
      }

      matches.push({ nodes, edges });
    }

    return {
      nodes: matches.flatMap(m => m.nodes),
      edges: matches.flatMap(m => m.edges),
      metadata: { matchCount: matches.length }
    };
  }

  /**
   * Aggregate nodes
   */
  async aggregate<T = any>(
    groupBy: string | ((node: AnyGraphNode) => string),
    aggregator?: (nodes: AnyGraphNode[]) => T
  ): Promise<QueryResult<T>> {
    // Simple case: group by property
    if (typeof groupBy === 'string') {
      const query = `
        MATCH (n:Node)
        RETURN n.${groupBy} as key, collect(n) as nodes, count(n) as count
      `;

      const result = await this.neo4j.query(query);

      const aggregations: Record<string, T> = {};

      for (const record of result.records) {
        const key = record.get('key');
        const nodes = record.get('nodes').map((n: any) => this.recordToNode(n));

        if (aggregator) {
          aggregations[key] = aggregator(nodes);
        } else {
          aggregations[key] = record.get('count').toNumber() as any;
        }
      }

      return { aggregations };
    }

    // Complex case: custom grouping function
    // Would need to fetch all nodes and group in memory
    throw new Error('Custom grouping functions not yet supported for Neo4j queries');
  }

  /**
   * Complex query
   */
  async query(params: {
    where?: {
      nodes?: NodePredicate;
      edges?: EdgePredicate;
    };
    include?: {
      neighbors?: boolean;
      paths?: boolean;
      edges?: boolean;
    };
    aggregate?: {
      groupBy?: string;
      count?: boolean;
    };
    options?: QueryOptions;
  }): Promise<QueryResult> {
    let result: QueryResult = {};

    // Find matching nodes
    if (params.where?.nodes) {
      const nodeResult = await this.findNodes(params.where.nodes, params.options);
      result.nodes = nodeResult.nodes;

      // Include edges if requested
      if (params.include?.edges && result.nodes) {
        const nodeIds = result.nodes.map(n => n.id);
        const edgesQuery = `
          MATCH (n:Node)-[r:EDGE]-(m:Node)
          WHERE n.id IN $nodeIds
          AND (r.isReverse IS NULL OR r.isReverse = false)
          RETURN DISTINCT r
        `;

        const edgesResult = await this.neo4j.query(edgesQuery, { nodeIds });
        result.edges = edgesResult.records.map(r => this.recordToEdge(r.get('r')));
      }

      // Include neighbors if requested
      if (params.include?.neighbors && result.nodes) {
        const neighborQuery = `
          MATCH (n:Node)-[:EDGE]-(neighbor:Node)
          WHERE n.id IN $nodeIds
          RETURN DISTINCT neighbor
        `;

        const nodeIds = result.nodes.map(n => n.id);
        const neighborResult = await this.neo4j.query(neighborQuery, { nodeIds });
        const neighbors = neighborResult.records.map(r => this.recordToNode(r.get('neighbor')));

        // Merge with existing nodes
        const nodeMap = new Map<string, AnyGraphNode>();
        result.nodes.forEach(n => nodeMap.set(n.id, n));
        neighbors.forEach(n => nodeMap.set(n.id, n));
        result.nodes = Array.from(nodeMap.values());
      }
    }

    // Apply aggregation
    if (params.aggregate && result.nodes) {
      if (params.aggregate.groupBy) {
        const aggregateResult = await this.aggregate(params.aggregate.groupBy);
        result.aggregations = aggregateResult.aggregations;
      }

      if (params.aggregate.count) {
        result.metadata = {
          ...result.metadata,
          totalCount: result.nodes.length
        };
      }
    }

    return result;
  }

  /**
   * Helper: Convert predicate to WHERE clause (simplified)
   */
  private predicateToWhere(predicate: NodePredicate | EdgePredicate): string {
    // In a real implementation, you'd parse the function to extract conditions
    // For now, we'll use a simplified approach
    const predicateStr = predicate.toString();

    // Look for common patterns
    if (predicateStr.includes('type === ')) {
      const match = predicateStr.match(/type === ['"]([^'"]+)['"]/);
      if (match) {
        return `WHERE n.type = '${match[1]}'`;
      }
    }

    if (predicateStr.includes('label === ')) {
      const match = predicateStr.match(/label === ['"]([^'"]+)['"]/);
      if (match) {
        return `WHERE n.label = '${match[1]}'`;
      }
    }

    return '';
  }

  /**
   * Helper: Convert Neo4j record to Node
   */
  private recordToNode(nodeRecord: any): AnyGraphNode {
    const properties = nodeRecord.properties;
    const labels = nodeRecord.labels;

    return {
      id: properties.id,
      type: properties.type,
      label: properties.label,
      description: properties.description,
      metadata: properties.metadata ? JSON.parse(properties.metadata) : {}
    } as AnyGraphNode;
  }

  /**
   * Helper: Convert Neo4j record to Edge
   */
  private recordToEdge(edgeRecord: any): GraphEdge {
    const properties = edgeRecord.properties;

    return {
      id: properties.id,
      source: properties.source,
      target: properties.target,
      type: properties.type,
      label: properties.label,
      weight: properties.weight,
      bidirectional: properties.bidirectional,
      metadata: properties.metadata ? JSON.parse(properties.metadata) : {}
    };
  }

  /**
   * Helper: Convert Neo4j path to Path
   */
  private recordToPath(pathRecord: any): Path {
    const nodes: AnyGraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Extract segments from path
    if (pathRecord.segments) {
      // Path from shortestPath result
      for (const segment of pathRecord.segments) {
        if (!nodes.find(n => n.id === segment.start.properties.id)) {
          nodes.push(this.recordToNode(segment.start));
        }
        edges.push(this.recordToEdge(segment.relationship));
        if (!nodes.find(n => n.id === segment.end.properties.id)) {
          nodes.push(this.recordToNode(segment.end));
        }
      }
    } else if (pathRecord.start && pathRecord.end) {
      // Simple path with start and end
      nodes.push(this.recordToNode(pathRecord.start));
      if (pathRecord.segments) {
        for (const segment of pathRecord.segments) {
          edges.push(this.recordToEdge(segment.relationship));
        }
      }
      nodes.push(this.recordToNode(pathRecord.end));
    }

    // Calculate weight
    const weight = edges.reduce((sum, e) => sum + (e.weight || 1), 0);

    return {
      nodes,
      edges,
      length: nodes.length,
      weight
    };
  }
}