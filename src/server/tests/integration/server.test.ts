import request from 'supertest';
import { GrafityServer } from '../../index';
import { ConfigManager } from '../../../config/ConfigManager';

describe('Grafity Server Integration Tests', () => {
  let server: GrafityServer;
  let app: any;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use test DB

    server = new GrafityServer();
    await new Promise((resolve) => {
      server.start(0).then(() => {
        app = (server as any).app;
        resolve(void 0);
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await (server as any).gracefulShutdown('test');
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GraphQL Endpoint', () => {
    it('should handle GraphQL introspection query', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: introspectionQuery })
        .expect(200);

      expect(response.body.data).toHaveProperty('__schema');
      expect(response.body.data.__schema.types).toBeInstanceOf(Array);
    });

    it('should handle project creation mutation', async () => {
      const createProjectMutation = `
        mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) {
            success
            project {
              id
              name
              type
              path
            }
            errors {
              message
              code
            }
          }
        }
      `;

      const variables = {
        input: {
          name: 'Test Project',
          description: 'A test project for integration testing',
          path: '/test/path',
          type: 'REACT'
        }
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: createProjectMutation, variables })
        .expect(200);

      expect(response.body.data.createProject.success).toBe(true);
      expect(response.body.data.createProject.project).toHaveProperty('id');
      expect(response.body.data.createProject.project.name).toBe('Test Project');
    });
  });

  describe('REST API Endpoints', () => {
    describe('Projects API', () => {
      it('should list projects', async () => {
        const response = await request(app)
          .get('/api/projects')
          .expect(401); // Should require authentication

        expect(response.body).toHaveProperty('error');
      });

      it('should require authentication for protected endpoints', async () => {
        const endpoints = [
          '/api/projects',
          '/api/analysis',
          '/api/patterns',
          '/api/components',
          '/api/metrics'
        ];

        for (const endpoint of endpoints) {
          const response = await request(app)
            .get(endpoint)
            .expect(401);

          expect(response.body).toHaveProperty('error');
        }
      });
    });

    describe('Search API', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/search?q=test')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('System API', () => {
      it('should require admin role for system endpoints', async () => {
        const response = await request(app)
          .get('/api/system/status')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});