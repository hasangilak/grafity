module.exports = async () => {
  console.log('🚀 Setting up Chat System Test Environment...');

  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CHAT_SYSTEM_TEST_MODE = 'true';
  process.env.CHAT_SYSTEM_LOG_LEVEL = 'error';

  // Mock database connections for integration tests
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'test';
  process.env.NEO4J_PASSWORD = 'test';

  // Mock external service endpoints
  process.env.CLAUDE_API_URL = 'http://localhost:8080/mock-claude';
  process.env.WEBSOCKET_URL = 'ws://localhost:8081/mock-ws';

  // Create test data directories
  const fs = require('fs');
  const path = require('path');

  const testDataDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const coverageDir = path.join(__dirname, 'coverage');
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }

  console.log('✅ Chat System Test Environment Ready');
};