import mongoose from 'mongoose';
import { MongoClient, Db } from 'mongodb';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { Pool as PostgresPool } from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { Database as SqliteDB, open as openSqlite } from 'sqlite';

export interface DatabaseConfig {
  type: 'mongodb' | 'neo4j' | 'postgres' | 'mysql' | 'sqlite';
  connectionString?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  options?: any;
}

export interface ConnectionPool {
  mongodb?: typeof mongoose;
  mongodbNative?: MongoClient;
  neo4j?: Driver;
  postgres?: PostgresPool;
  mysql?: mysql.Pool;
  sqlite?: SqliteDB;
}

export class DatabaseConnection {
  private pools: ConnectionPool = {};
  private configs: Map<string, DatabaseConfig> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  async initialize(): Promise<void> {
    console.log('🔧 Initializing database connections...');

    // Get database configurations from environment
    const configs = this.loadDatabaseConfigs();

    // Initialize each configured database
    for (const [name, config] of configs) {
      try {
        await this.connectToDatabase(name, config);
        console.log(`✅ Connected to ${config.type} database: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${config.type} database ${name}:`, error);
        // Don't throw here - allow other databases to connect
      }
    }

    // Start health checks
    this.startHealthChecks();

    console.log('✅ Database connection manager initialized');
  }

  private loadDatabaseConfigs(): Map<string, DatabaseConfig> {
    const configs = new Map<string, DatabaseConfig>();

    // MongoDB (Mongoose) - Primary database for application data
    if (process.env.MONGODB_URI || process.env.MONGO_URI) {
      configs.set('mongodb', {
        type: 'mongodb',
        connectionString: process.env.MONGODB_URI || process.env.MONGO_URI,
        options: {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          bufferCommands: false,
          bufferMaxEntries: 0
        }
      });
      this.configs.set('mongodb', configs.get('mongodb')!);
    }

    // Neo4j - Graph database for dependency and component relationships
    if (process.env.NEO4J_URI) {
      configs.set('neo4j', {
        type: 'neo4j',
        connectionString: process.env.NEO4J_URI,
        username: process.env.NEO4J_USERNAME || 'neo4j',
        password: process.env.NEO4J_PASSWORD,
        options: {
          maxConnectionPoolSize: 50,
          connectionTimeout: 30000,
          maxTransactionRetryTime: 30000
        }
      });
      this.configs.set('neo4j', configs.get('neo4j')!);
    }

    // PostgreSQL - Alternative SQL database
    if (process.env.POSTGRES_URI || process.env.DATABASE_URL) {
      configs.set('postgres', {
        type: 'postgres',
        connectionString: process.env.POSTGRES_URI || process.env.DATABASE_URL,
        options: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        }
      });
      this.configs.set('postgres', configs.get('postgres')!);
    }

    // MySQL - Alternative SQL database
    if (process.env.MYSQL_URI) {
      configs.set('mysql', {
        type: 'mysql',
        connectionString: process.env.MYSQL_URI,
        options: {
          connectionLimit: 10,
          acquireTimeout: 60000,
          timeout: 60000,
          reconnect: true
        }
      });
      this.configs.set('mysql', configs.get('mysql')!);
    }

    // SQLite - Development/testing database
    if (process.env.SQLITE_PATH || process.env.NODE_ENV === 'development') {
      configs.set('sqlite', {
        type: 'sqlite',
        database: process.env.SQLITE_PATH || './data/grafity.db',
        options: {
          verbose: process.env.NODE_ENV === 'development'
        }
      });
      this.configs.set('sqlite', configs.get('sqlite')!);
    }

    return configs;
  }

  private async connectToDatabase(name: string, config: DatabaseConfig): Promise<void> {
    switch (config.type) {
      case 'mongodb':
        await this.connectMongoDB(config);
        break;
      case 'neo4j':
        await this.connectNeo4j(config);
        break;
      case 'postgres':
        await this.connectPostgreSQL(config);
        break;
      case 'mysql':
        await this.connectMySQL(config);
        break;
      case 'sqlite':
        await this.connectSQLite(config);
        break;
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  private async connectMongoDB(config: DatabaseConfig): Promise<void> {
    if (!config.connectionString) {
      throw new Error('MongoDB connection string is required');
    }

    // Set up Mongoose connection
    mongoose.set('strictQuery', false);

    const connection = await mongoose.connect(config.connectionString, config.options);
    this.pools.mongodb = mongoose;

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Also set up native MongoDB client for advanced operations
    const mongoClient = new MongoClient(config.connectionString, {
      maxPoolSize: config.options?.maxPoolSize || 10
    });
    await mongoClient.connect();
    this.pools.mongodbNative = mongoClient;
  }

  private async connectNeo4j(config: DatabaseConfig): Promise<void> {
    if (!config.connectionString) {
      throw new Error('Neo4j connection string is required');
    }

    const driver = neo4j.driver(
      config.connectionString,
      neo4j.auth.basic(config.username || 'neo4j', config.password || ''),
      config.options
    );

    // Test connection
    const session = driver.session();
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }

    this.pools.neo4j = driver;
  }

  private async connectPostgreSQL(config: DatabaseConfig): Promise<void> {
    if (!config.connectionString) {
      throw new Error('PostgreSQL connection string is required');
    }

    const pool = new PostgresPool({
      connectionString: config.connectionString,
      ...config.options
    });

    // Test connection
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }

    this.pools.postgres = pool;
  }

  private async connectMySQL(config: DatabaseConfig): Promise<void> {
    if (!config.connectionString) {
      throw new Error('MySQL connection string is required');
    }

    const pool = mysql.createPool({
      uri: config.connectionString,
      ...config.options
    });

    // Test connection
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1');
    } finally {
      connection.release();
    }

    this.pools.mysql = pool;
  }

  private async connectSQLite(config: DatabaseConfig): Promise<void> {
    if (!config.database) {
      throw new Error('SQLite database path is required');
    }

    // Ensure directory exists
    const path = require('path');
    const fs = require('fs/promises');
    const dbDir = path.dirname(config.database);
    await fs.mkdir(dbDir, { recursive: true });

    const db = await openSqlite({
      filename: config.database,
      driver: sqlite3.Database
    });

    // Test connection
    await db.get('SELECT 1');

    this.pools.sqlite = db;
  }

  private startHealthChecks(): void {
    // Check connections every 30 seconds
    const interval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    this.healthCheckIntervals.set('global', interval);
  }

  private async performHealthChecks(): Promise<void> {
    const results: Record<string, boolean> = {};

    for (const [name, config] of this.configs) {
      try {
        switch (config.type) {
          case 'mongodb':
            if (this.pools.mongodb) {
              results[name] = mongoose.connection.readyState === 1;
            }
            break;

          case 'neo4j':
            if (this.pools.neo4j) {
              const session = this.pools.neo4j.session();
              try {
                await session.run('RETURN 1');
                results[name] = true;
              } catch {
                results[name] = false;
              } finally {
                await session.close();
              }
            }
            break;

          case 'postgres':
            if (this.pools.postgres) {
              const client = await this.pools.postgres.connect();
              try {
                await client.query('SELECT 1');
                results[name] = true;
              } catch {
                results[name] = false;
              } finally {
                client.release();
              }
            }
            break;

          case 'mysql':
            if (this.pools.mysql) {
              const connection = await this.pools.mysql.getConnection();
              try {
                await connection.query('SELECT 1');
                results[name] = true;
              } catch {
                results[name] = false;
              } finally {
                connection.release();
              }
            }
            break;

          case 'sqlite':
            if (this.pools.sqlite) {
              await this.pools.sqlite.get('SELECT 1');
              results[name] = true;
            }
            break;
        }
      } catch (error) {
        results[name] = false;
        console.warn(`Database health check failed for ${name}:`, error);
      }
    }

    // Log unhealthy connections
    for (const [name, healthy] of Object.entries(results)) {
      if (!healthy) {
        console.warn(`⚠️ Database ${name} is unhealthy`);
      }
    }
  }

  // Getter methods for database connections

  getMongoose(): typeof mongoose | undefined {
    return this.pools.mongodb;
  }

  getMongoClient(): MongoClient | undefined {
    return this.pools.mongodbNative;
  }

  getNeo4jDriver(): Driver | undefined {
    return this.pools.neo4j;
  }

  createNeo4jSession(): Session | undefined {
    return this.pools.neo4j?.session();
  }

  getPostgresPool(): PostgresPool | undefined {
    return this.pools.postgres;
  }

  getMySQLPool(): mysql.Pool | undefined {
    return this.pools.mysql;
  }

  getSQLiteDB(): SqliteDB | undefined {
    return this.pools.sqlite;
  }

  // Health check methods

  async isHealthy(): Promise<boolean> {
    const checks = await this.getHealthStatus();
    return Object.values(checks).every(status => status.healthy);
  }

  async getHealthStatus(): Promise<Record<string, { healthy: boolean; error?: string }>> {
    const status: Record<string, { healthy: boolean; error?: string }> = {};

    for (const [name, config] of this.configs) {
      try {
        switch (config.type) {
          case 'mongodb':
            status[name] = {
              healthy: mongoose.connection.readyState === 1
            };
            break;

          case 'neo4j':
            if (this.pools.neo4j) {
              const session = this.pools.neo4j.session();
              try {
                await session.run('RETURN 1');
                status[name] = { healthy: true };
              } catch (error) {
                status[name] = { healthy: false, error: (error as Error).message };
              } finally {
                await session.close();
              }
            } else {
              status[name] = { healthy: false, error: 'No connection' };
            }
            break;

          case 'postgres':
            if (this.pools.postgres) {
              const client = await this.pools.postgres.connect();
              try {
                await client.query('SELECT 1');
                status[name] = { healthy: true };
              } catch (error) {
                status[name] = { healthy: false, error: (error as Error).message };
              } finally {
                client.release();
              }
            } else {
              status[name] = { healthy: false, error: 'No connection' };
            }
            break;

          case 'mysql':
            if (this.pools.mysql) {
              const connection = await this.pools.mysql.getConnection();
              try {
                await connection.query('SELECT 1');
                status[name] = { healthy: true };
              } catch (error) {
                status[name] = { healthy: false, error: (error as Error).message };
              } finally {
                connection.release();
              }
            } else {
              status[name] = { healthy: false, error: 'No connection' };
            }
            break;

          case 'sqlite':
            if (this.pools.sqlite) {
              await this.pools.sqlite.get('SELECT 1');
              status[name] = { healthy: true };
            } else {
              status[name] = { healthy: false, error: 'No connection' };
            }
            break;
        }
      } catch (error) {
        status[name] = { healthy: false, error: (error as Error).message };
      }
    }

    return status;
  }

  // Shutdown method

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down database connections...');

    // Clear health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Close all connections
    const closePromises: Promise<void>[] = [];

    if (this.pools.mongodb) {
      closePromises.push(mongoose.connection.close());
    }

    if (this.pools.mongodbNative) {
      closePromises.push(this.pools.mongodbNative.close());
    }

    if (this.pools.neo4j) {
      closePromises.push(this.pools.neo4j.close());
    }

    if (this.pools.postgres) {
      closePromises.push(this.pools.postgres.end());
    }

    if (this.pools.mysql) {
      closePromises.push(this.pools.mysql.end());
    }

    if (this.pools.sqlite) {
      closePromises.push(this.pools.sqlite.close());
    }

    await Promise.all(closePromises);

    console.log('✅ Database connections closed');
  }

  // Utility methods

  getConnectionInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    for (const [name, config] of this.configs) {
      info[name] = {
        type: config.type,
        connected: this.isConnectionActive(name),
        host: config.host,
        database: config.database
      };
    }

    return info;
  }

  private isConnectionActive(name: string): boolean {
    const config = this.configs.get(name);
    if (!config) return false;

    switch (config.type) {
      case 'mongodb':
        return mongoose.connection.readyState === 1;
      case 'neo4j':
        return !!this.pools.neo4j;
      case 'postgres':
        return !!this.pools.postgres;
      case 'mysql':
        return !!this.pools.mysql;
      case 'sqlite':
        return !!this.pools.sqlite;
      default:
        return false;
    }
  }
}