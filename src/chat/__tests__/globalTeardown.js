module.exports = async () => {
  console.log('🧹 Cleaning up Chat System Test Environment...');

  // Clean up test data
  const fs = require('fs');
  const path = require('path');

  const testDataDir = path.join(__dirname, 'test-data');
  if (fs.existsSync(testDataDir)) {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
      console.log('✅ Test data directory cleaned');
    } catch (error) {
      console.warn('⚠️  Failed to clean test data directory:', error.message);
    }
  }

  // Generate test summary
  const summaryPath = path.join(__dirname, 'coverage', 'test-summary.json');
  const testSummary = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    testMode: process.env.CHAT_SYSTEM_TEST_MODE,
    components: [
      'MessageNode',
      'ChatGraphStructure',
      'MessageParser',
      'ContextExtractor',
      'ResponseGenerator',
      'ConversationStorage',
      'ConversationSearch',
      'ChatAnalytics',
      'ConversationMerger',
      'RealtimeChat'
    ],
    testTypes: [
      'unit',
      'integration',
      'performance',
      'error-handling'
    ]
  };

  try {
    const coverageDir = path.dirname(summaryPath);
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    console.log('✅ Test summary generated');
  } catch (error) {
    console.warn('⚠️  Failed to generate test summary:', error.message);
  }

  console.log('✅ Chat System Test Environment Cleaned');
};