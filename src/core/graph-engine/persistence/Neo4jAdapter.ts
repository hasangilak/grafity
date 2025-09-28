import neo4j, { Driver, Session, Result, Transaction } from 'neo4j-driver';
import { AnyGraphNode, CodeNode, BusinessNode, DocumentNode, ConversationNode } from '../types/NodeTypes';
import { GraphEdge, EdgeRelationType } from '../types/EdgeTypes';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
}

export interface Neo4jQueryResult {
  records: any[];
  summary: any;
  keys: string[];
}

/**
 * Neo4j database adapter for graph persistence
 */
export class Neo4jAdapter {
  private driver: Driver;
  private database: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      {
        maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
        connectionTimeout: config.connectionTimeout || 30000
      }
    );
    this.database = config.database || 'neo4j';
  }

  /**
   * Test connection to Neo4j
   */
  async testConnection(): Promise<boolean> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run('RETURN 1 as test');
      return result.records.length > 0;
    } catch (error) {
      console.error('Neo4j connection failed:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Initialize database schema and indexes
   */
  async initializeSchema(): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      // Create constraints for unique IDs
      await session.run(
        'CREATE CONSTRAINT IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE'
      );

      // Create indexes for common queries
      const indexes = [
        'CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.type)',
        'CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.label)',
        'CREATE INDEX IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath)',
        'CREATE INDEX IF NOT EXISTS FOR (n:CodeNode) ON (n.codeType)',
        'CREATE INDEX IF NOT EXISTS FOR (n:BusinessNode) ON (n.businessType)',
        'CREATE INDEX IF NOT EXISTS FOR (n:DocumentNode) ON (n.documentType)',
        'CREATE INDEX IF NOT EXISTS FOR (n:ConversationNode) ON (n.timestamp)',
        'CREATE INDEX IF NOT EXISTS FOR ()-[r:EDGE]-() ON (r.type)',
        'CREATE INDEX IF NOT EXISTS FOR ()-[r:EDGE]-() ON (r.weight)'
      ];

      for (const index of indexes) {
        await session.run(index);
      }

      console.log('Neo4j schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Neo4j schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update a node in Neo4j
   */
  async upsertNode(node: AnyGraphNode): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      const labels = this.getNodeLabels(node);
      const properties = this.nodeToProperties(node);

      const query = `
        MERGE (n:Node {id: $id})
        SET n = $properties
        SET n:${labels.join(':')}
        RETURN n
      `;

      await session.run(query, {
        id: node.id,
        properties
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update multiple nodes in batch
   */
  async upsertNodes(nodes: AnyGraphNode[]): Promise<void> {
    const session = this.driver.session({ database: this.database });
    const tx = session.beginTransaction();

    try {
      for (const node of nodes) {
        const labels = this.getNodeLabels(node);
        const properties = this.nodeToProperties(node);

        const query = `
          MERGE (n:Node {id: $id})
          SET n = $properties
          SET n:${labels.join(':')}
        `;

        await tx.run(query, {
          id: node.id,
          properties
        });
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update an edge in Neo4j
   */
  async upsertEdge(edge: GraphEdge): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      const properties = this.edgeToProperties(edge);

      const query = `
        MATCH (source:Node {id: $sourceId})
        MATCH (target:Node {id: $targetId})
        MERGE (source)-[r:EDGE {id: $id}]->(target)
        SET r = $properties
        RETURN r
      `;

      await session.run(query, {
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        properties
      });

      // Create reverse edge if bidirectional
      if (edge.bidirectional) {
        const reverseQuery = `
          MATCH (source:Node {id: $targetId})
          MATCH (target:Node {id: $sourceId})
          MERGE (source)-[r:EDGE {id: $reverseId}]->(target)
          SET r = $properties
          SET r.isReverse = true
        `;

        await session.run(reverseQuery, {
          reverseId: `${edge.id}_reverse`,
          sourceId: edge.source,
          targetId: edge.target,
          properties
        });
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update multiple edges in batch
   */
  async upsertEdges(edges: GraphEdge[]): Promise<void> {
    const session = this.driver.session({ database: this.database });
    const tx = session.beginTransaction();

    try {
      for (const edge of edges) {
        const properties = this.edgeToProperties(edge);

        const query = `
          MATCH (source:Node {id: $sourceId})
          MATCH (target:Node {id: $targetId})
          MERGE (source)-[r:EDGE {id: $id}]->(target)
          SET r = $properties
        `;

        await tx.run(query, {
          id: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          properties
        });

        // Handle bidirectional edges
        if (edge.bidirectional) {
          const reverseQuery = `
            MATCH (source:Node {id: $targetId})
            MATCH (target:Node {id: $sourceId})
            MERGE (source)-[r:EDGE {id: $reverseId}]->(target)
            SET r = $properties
            SET r.isReverse = true
          `;

          await tx.run(reverseQuery, {
            reverseId: `${edge.id}_reverse`,
            sourceId: edge.source,
            targetId: edge.target,
            properties
          });
        }
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<AnyGraphNode | undefined> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (n:Node {id: $id}) RETURN n',
        { id }
      );

      if (result.records.length === 0) {
        return undefined;
      }

      const nodeData = result.records[0].get('n');
      return this.propertiesToNode(nodeData.properties, nodeData.labels);
    } finally {
      await session.close();
    }
  }

  /**
   * Get all nodes
   */
  async getAllNodes(): Promise<AnyGraphNode[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run('MATCH (n:Node) RETURN n');
      return result.records.map(record => {
        const nodeData = record.get('n');
        return this.propertiesToNode(nodeData.properties, nodeData.labels);
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get nodes by type
   */
  async getNodesByType(type: string): Promise<AnyGraphNode[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (n:Node {type: $type}) RETURN n',
        { type }
      );

      return result.records.map(record => {
        const nodeData = record.get('n');
        return this.propertiesToNode(nodeData.properties, nodeData.labels);
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get an edge by ID
   */
  async getEdge(id: string): Promise<GraphEdge | undefined> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH ()-[r:EDGE {id: $id}]->() RETURN r',
        { id }
      );

      if (result.records.length === 0) {
        return undefined;
      }

      const edgeData = result.records[0].get('r');
      return this.propertiesToEdge(edgeData.properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Get all edges
   */
  async getAllEdges(): Promise<GraphEdge[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH ()-[r:EDGE]->() WHERE r.isReverse IS NULL OR r.isReverse = false RETURN r'
      );

      return result.records.map(record => {
        const edgeData = record.get('r');
        return this.propertiesToEdge(edgeData.properties);
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get outgoing edges for a node
   */
  async getOutgoingEdges(nodeId: string): Promise<GraphEdge[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH (:Node {id: $nodeId})-[r:EDGE]->() WHERE r.isReverse IS NULL OR r.isReverse = false RETURN r',
        { nodeId }
      );

      return result.records.map(record => {
        const edgeData = record.get('r');
        return this.propertiesToEdge(edgeData.properties);
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get incoming edges for a node
   */
  async getIncomingEdges(nodeId: string): Promise<GraphEdge[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(
        'MATCH ()-[r:EDGE]->(:Node {id: $nodeId}) WHERE r.isReverse IS NULL OR r.isReverse = false RETURN r',
        { nodeId }
      );

      return result.records.map(record => {
        const edgeData = record.get('r');
        return this.propertiesToEdge(edgeData.properties);
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      await session.run(
        'MATCH (n:Node {id: $id}) DETACH DELETE n',
        { id }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Delete an edge
   */
  async deleteEdge(id: string): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      // Delete both the edge and its reverse if it exists
      await session.run(
        'MATCH ()-[r:EDGE]->() WHERE r.id = $id OR r.id = $reverseId DELETE r',
        { id, reverseId: `${id}_reverse` }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    const session = this.driver.session({ database: this.database });
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a custom Cypher query
   */
  async query(cypher: string, params?: Record<string, any>): Promise<Neo4jQueryResult> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(cypher, params);
      return {
        records: result.records,
        summary: result.summary,
        keys: (result.records[0]?.keys || []) as string[]
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get graph statistics
   */
  async getStatistics(): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  }> {
    const session = this.driver.session({ database: this.database });
    try {
      // Get node count
      const nodeCountResult = await session.run(
        'MATCH (n:Node) RETURN count(n) as count'
      );
      const nodeCount = nodeCountResult.records[0].get('count').toNumber();

      // Get edge count
      const edgeCountResult = await session.run(
        'MATCH ()-[r:EDGE]->() WHERE r.isReverse IS NULL OR r.isReverse = false RETURN count(r) as count'
      );
      const edgeCount = edgeCountResult.records[0].get('count').toNumber();

      // Get nodes by type
      const nodesByTypeResult = await session.run(
        'MATCH (n:Node) RETURN n.type as type, count(n) as count'
      );
      const nodesByType: Record<string, number> = {};
      nodesByTypeResult.records.forEach(record => {
        nodesByType[record.get('type')] = record.get('count').toNumber();
      });

      // Get edges by type
      const edgesByTypeResult = await session.run(
        'MATCH ()-[r:EDGE]->() WHERE r.isReverse IS NULL OR r.isReverse = false RETURN r.type as type, count(r) as count'
      );
      const edgesByType: Record<string, number> = {};
      edgesByTypeResult.records.forEach(record => {
        edgesByType[record.get('type')] = record.get('count').toNumber();
      });

      return {
        nodeCount,
        edgeCount,
        nodesByType,
        edgesByType
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.driver.close();
  }

  /**
   * Helper: Get node labels based on type
   */
  private getNodeLabels(node: AnyGraphNode): string[] {
    const labels = ['Node'];

    switch (node.type) {
      case 'code':
        labels.push('CodeNode');
        break;
      case 'business':
        labels.push('BusinessNode');
        break;
      case 'document':
        labels.push('DocumentNode');
        break;
      case 'conversation':
        labels.push('ConversationNode');
        break;
    }

    return labels;
  }

  /**
   * Helper: Convert node to Neo4j properties
   */
  private nodeToProperties(node: AnyGraphNode): Record<string, any> {
    const properties: Record<string, any> = {
      id: node.id,
      type: node.type,
      label: node.label,
      description: node.description || null
    };

    // Add type-specific properties
    switch (node.type) {
      case 'code':
        const codeNode = node as CodeNode;
        properties.codeType = codeNode.codeType;
        properties.filePath = codeNode.filePath;
        properties.language = codeNode.language;
        break;

      case 'business':
        const businessNode = node as BusinessNode;
        properties.businessType = businessNode.businessType;
        properties.priority = businessNode.priority || null;
        properties.status = businessNode.status || null;
        break;

      case 'document':
        const docNode = node as DocumentNode;
        properties.documentType = docNode.documentType || null;
        properties.filePath = docNode.filePath || null;
        properties.author = docNode.author || null;
        break;

      case 'conversation':
        const convNode = node as ConversationNode;
        properties.conversationType = convNode.conversationType || null;
        properties.participant = convNode.participant || null;
        properties.timestamp = convNode.timestamp || null;
        break;
    }

    // Add metadata as JSON string
    if (node.metadata) {
      properties.metadata = JSON.stringify(node.metadata);
    }

    return properties;
  }

  /**
   * Helper: Convert Neo4j properties to node
   */
  private propertiesToNode(properties: any, labels: string[]): AnyGraphNode {
    const baseNode = {
      id: properties.id,
      type: properties.type,
      label: properties.label,
      description: properties.description,
      metadata: properties.metadata ? JSON.parse(properties.metadata) : {}
    };

    // Create specific node type based on labels
    if (labels.includes('CodeNode')) {
      return {
        ...baseNode,
        type: 'code',
        codeType: properties.codeType,
        filePath: properties.filePath,
        language: properties.language
      } as CodeNode;
    }

    if (labels.includes('BusinessNode')) {
      return {
        ...baseNode,
        type: 'business',
        businessType: properties.businessType,
        priority: properties.priority,
        status: properties.status
      } as BusinessNode;
    }

    if (labels.includes('DocumentNode')) {
      return {
        ...baseNode,
        type: 'document',
        documentType: properties.documentType,
        filePath: properties.filePath,
        author: properties.author
      } as DocumentNode;
    }

    if (labels.includes('ConversationNode')) {
      return {
        ...baseNode,
        type: 'conversation',
        conversationType: properties.conversationType,
        participant: properties.participant,
        timestamp: properties.timestamp
      } as ConversationNode;
    }

    return baseNode as AnyGraphNode;
  }

  /**
   * Helper: Convert edge to Neo4j properties
   */
  private edgeToProperties(edge: GraphEdge): Record<string, any> {
    const properties: Record<string, any> = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label || null,
      weight: edge.weight || 1,
      bidirectional: edge.bidirectional
    };

    // Add metadata as JSON string
    if (edge.metadata) {
      properties.metadata = JSON.stringify(edge.metadata);
    }

    return properties;
  }

  /**
   * Helper: Convert Neo4j properties to edge
   */
  private propertiesToEdge(properties: any): GraphEdge {
    return {
      id: properties.id,
      source: properties.source,
      target: properties.target,
      type: properties.type as EdgeRelationType,
      label: properties.label,
      weight: properties.weight,
      bidirectional: properties.bidirectional,
      metadata: properties.metadata ? JSON.parse(properties.metadata) : {}
    };
  }
}