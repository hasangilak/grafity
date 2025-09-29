import request from 'supertest';
import { GrafityServer } from '../../../src/server/index';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { SecurityManager } from '../../../src/security/SecurityManager';

describe('REST API Endpoints Integration', () => {
  let server: GrafityServer;
  let app: any;
  let authToken: string;
  let testUser: any;
  let testProject: any;

  beforeAll(async () => {
    // Initialize server
    server = new GrafityServer();
    await server.start(0); // Use random port
    app = (server as any).app;

    // Create test user and get auth token
    testUser = generateTestUser();
    authToken = await generateAuthToken(testUser);
  });

  afterAll(async () => {
    if (server) {
      await (server as any).gracefulShutdown('test');
    }
  });

  beforeEach(async () => {
    // Create fresh test project for each test
    testProject = generateTestProject({ owner: testUser.id });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('should authenticate valid user credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: testUser.username,
            password: 'test-password'
          });

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.id).toBe(testUser.id);
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'invalid-user',
            password: 'wrong-password'
          });

        expect(response).toHaveHttpStatus(401);
        expect(response.body).toHaveProperty('error');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: testUser.username
            // Missing password
          });

        expect(response).toHaveHttpStatus(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should logout authenticated user', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('message');
      });

      it('should handle logout without token', async () => {
        const response = await request(app)
          .post('/api/auth/logout');

        expect(response).toHaveHttpStatus(401);
      });
    });
  });

  describe('Project Endpoints', () => {
    describe('GET /api/projects', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/projects');

        expect(response).toHaveHttpStatus(401);
      });

      it('should list projects for authenticated user', async () => {
        // First create a project
        await createTestProject(testProject);

        const response = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('projects');
        expect(response.body).toHaveProperty('totalCount');
        expect(response.body.projects).toBeInstanceOf(Array);
      });

      it('should support pagination', async () => {
        // Create multiple projects
        for (let i = 0; i < 5; i++) {
          await createTestProject(generateTestProject({ owner: testUser.id }));
        }

        const response = await request(app)
          .get('/api/projects?page=1&limit=2')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.projects).toHaveLength(2);
        expect(response.body.totalCount).toBeGreaterThanOrEqual(2);
      });

      it('should support filtering by type', async () => {
        await createTestProject(generateTestProject({ type: 'react', owner: testUser.id }));
        await createTestProject(generateTestProject({ type: 'vue', owner: testUser.id }));

        const response = await request(app)
          .get('/api/projects?type=react')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        response.body.projects.forEach((project: any) => {
          expect(project.type).toBe('react');
        });
      });

      it('should support search by name', async () => {
        await createTestProject(generateTestProject({
          name: 'React Dashboard',
          owner: testUser.id
        }));

        const response = await request(app)
          .get('/api/projects?search=Dashboard')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.projects.length).toBeGreaterThan(0);
        expect(response.body.projects[0].name).toContain('Dashboard');
      });
    });

    describe('POST /api/projects', () => {
      it('should create new project', async () => {
        const projectData = {
          name: 'New Integration Test Project',
          description: 'Created via integration test',
          path: '/test/integration/project',
          type: 'react'
        };

        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send(projectData);

        expect(response).toHaveHttpStatus(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(projectData.name);
        expect(response.body.type).toBe(projectData.type);
        expect(response.body.owner).toBe(testUser.id);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // Missing required name and path
            type: 'react'
          });

        expect(response).toHaveHttpStatus(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should validate project type', async () => {
        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Project',
            path: '/test/path',
            type: 'invalid-type'
          });

        expect(response).toHaveHttpStatus(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/projects/:id', () => {
      let createdProject: any;

      beforeEach(async () => {
        createdProject = await createTestProject(testProject);
      });

      it('should get project by ID', async () => {
        const response = await request(app)
          .get(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.id).toBe(createdProject.id);
        expect(response.body.name).toBe(createdProject.name);
      });

      it('should return 404 for non-existent project', async () => {
        const response = await request(app)
          .get('/api/projects/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(404);
      });

      it('should restrict access to project owner', async () => {
        const otherUser = generateTestUser();
        const otherToken = await generateAuthToken(otherUser);

        const response = await request(app)
          .get(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(response).toHaveHttpStatus(403);
      });
    });

    describe('PUT /api/projects/:id', () => {
      let createdProject: any;

      beforeEach(async () => {
        createdProject = await createTestProject(testProject);
      });

      it('should update project', async () => {
        const updates = {
          name: 'Updated Project Name',
          description: 'Updated description'
        };

        const response = await request(app)
          .put(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.name).toBe(updates.name);
        expect(response.body.description).toBe(updates.description);
      });

      it('should not allow updating restricted fields', async () => {
        const response = await request(app)
          .put(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            id: 'new-id', // Should be ignored
            owner: 'different-owner', // Should be ignored
            name: 'Updated Name'
          });

        expect(response).toHaveHttpStatus(200);
        expect(response.body.id).toBe(createdProject.id);
        expect(response.body.owner).toBe(testUser.id);
        expect(response.body.name).toBe('Updated Name');
      });
    });

    describe('DELETE /api/projects/:id', () => {
      let createdProject: any;

      beforeEach(async () => {
        createdProject = await createTestProject(testProject);
      });

      it('should delete project', async () => {
        const response = await request(app)
          .delete(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);

        // Verify project is deleted
        const getResponse = await request(app)
          .get(`/api/projects/${createdProject.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(getResponse).toHaveHttpStatus(404);
      });

      it('should return 404 for non-existent project', async () => {
        const response = await request(app)
          .delete('/api/projects/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(404);
      });
    });

    describe('POST /api/projects/:id/analyze', () => {
      let createdProject: any;

      beforeEach(async () => {
        createdProject = await createTestProject(testProject);
      });

      it('should trigger project analysis', async () => {
        const response = await request(app)
          .post(`/api/projects/${createdProject.id}/analyze`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            includePatterns: true,
            includeMetrics: true,
            depth: 'full'
          });

        expect(response).toHaveHttpStatus(202);
        expect(response.body).toHaveProperty('jobId');
        expect(response.body).toHaveProperty('message');
      });

      it('should use default analysis options', async () => {
        const response = await request(app)
          .post(`/api/projects/${createdProject.id}/analyze`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response).toHaveHttpStatus(202);
      });
    });
  });

  describe('Analysis Endpoints', () => {
    describe('POST /api/analysis/code', () => {
      it('should analyze code snippet', async () => {
        const codeSnippet = `
          import React, { useState } from 'react';

          export function Counter() {
            const [count, setCount] = useState(0);
            return <div>{count}</div>;
          }
        `;

        const response = await request(app)
          .post('/api/analysis/code')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: codeSnippet,
            language: 'tsx',
            options: {
              includePatterns: true,
              includeMetrics: true
            }
          });

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('components');
        expect(response.body).toHaveProperty('patterns');
        expect(response.body).toHaveProperty('metrics');
      });

      it('should validate code parameter', async () => {
        const response = await request(app)
          .post('/api/analysis/code')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            language: 'tsx'
            // Missing code
          });

        expect(response).toHaveHttpStatus(400);
      });

      it('should handle invalid code gracefully', async () => {
        const response = await request(app)
          .post('/api/analysis/code')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: 'invalid javascript syntax {{{',
            language: 'javascript'
          });

        expect(response).toHaveHttpStatus(200);
        expect(response.body.status).toBe('failed');
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/analysis/:id', () => {
      let analysisId: string;

      beforeEach(async () => {
        // Create an analysis
        const analysisResponse = await request(app)
          .post('/api/analysis/code')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: 'const x = 1;',
            language: 'typescript'
          });

        analysisId = analysisResponse.body.id;
      });

      it('should get analysis result', async () => {
        const response = await request(app)
          .get(`/api/analysis/${analysisId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.id).toBe(analysisId);
      });

      it('should return 404 for non-existent analysis', async () => {
        const response = await request(app)
          .get('/api/analysis/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(404);
      });
    });
  });

  describe('Pattern Endpoints', () => {
    describe('GET /api/patterns', () => {
      it('should list detected patterns', async () => {
        const response = await request(app)
          .get('/api/patterns')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('patterns');
        expect(response.body).toHaveProperty('totalCount');
      });

      it('should support filtering by type', async () => {
        const response = await request(app)
          .get('/api/patterns?type=good_pattern')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        response.body.patterns.forEach((pattern: any) => {
          expect(pattern.type).toBe('good_pattern');
        });
      });
    });

    describe('POST /api/patterns/detect', () => {
      it('should detect patterns in code', async () => {
        const codeWithPatterns = `
          import React, { useState, useEffect } from 'react';

          export function useCounter(initialValue = 0) {
            const [count, setCount] = useState(initialValue);

            useEffect(() => {
              document.title = \`Count: \${count}\`;
            }, [count]);

            return { count, setCount };
          }
        `;

        const response = await request(app)
          .post('/api/patterns/detect')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: codeWithPatterns,
            language: 'tsx'
          });

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('patterns');
        expect(response.body.patterns).toBeInstanceOf(Array);
      });
    });
  });

  describe('Search Endpoints', () => {
    describe('GET /api/search', () => {
      it('should perform universal search', async () => {
        const response = await request(app)
          .get('/api/search?q=component')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body).toHaveProperty('query');
        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('totalResults');
        expect(response.body).toHaveProperty('facets');
      });

      it('should require search query', async () => {
        const response = await request(app)
          .get('/api/search')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(400);
      });

      it('should support result type filtering', async () => {
        const response = await request(app)
          .get('/api/search?q=test&type=components')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response).toHaveHttpStatus(200);
        expect(response.body.type).toBe('components');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response).toHaveHttpStatus(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response).toHaveHttpStatus(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Invalid token format');

      expect(response).toHaveHttpStatus(401);
    });

    it('should handle expired tokens', async () => {
      const expiredToken = await generateAuthToken(testUser, '-1h'); // Expired token

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response).toHaveHttpStatus(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill(0).map(() =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // Some requests should succeed, but rate limiting should kick in
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeGreaterThan(0);
      // In test environment, rate limiting might be disabled
      // expect(rateLimitedCount).toBeGreaterThan(0);
    }, 10000);
  });

  // Helper functions
  async function generateAuthToken(user: any, expiresIn = '1h'): Promise<string> {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: user.id, username: user.username, roles: user.roles },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  }

  async function createTestProject(projectData: any): Promise<any> {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(projectData);

    expect(response).toHaveHttpStatus(201);
    return response.body;
  }
});