#!/usr/bin/env node

/**
 * Docker health check script for Grafity
 * This script performs comprehensive health checks to ensure the application is running properly
 */

const http = require('http');
const os = require('os');
const fs = require('fs');

const config = {
  port: process.env.PORT || 4000,
  host: process.env.HOST || 'localhost',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD) || 0.9, // 90%
  diskThreshold: parseFloat(process.env.DISK_THRESHOLD) || 0.9 // 90%
};

// Health check results
const results = {
  timestamp: new Date().toISOString(),
  status: 'healthy',
  checks: {},
  errors: []
};

// Utility function for HTTP requests with timeout
function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(config.timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Check if the main application is responding
async function checkApplication() {
  try {
    const response = await httpRequest({
      hostname: config.host,
      port: config.port,
      path: '/health',
      method: 'GET',
      timeout: config.timeout
    });

    if (response.statusCode === 200) {
      const healthData = JSON.parse(response.body);
      results.checks.application = {
        status: 'healthy',
        responseTime: healthData.responseTime,
        version: healthData.version
      };
    } else {
      throw new Error(`HTTP ${response.statusCode}`);
    }
  } catch (error) {
    results.checks.application = {
      status: 'unhealthy',
      error: error.message
    };
    results.errors.push(`Application check failed: ${error.message}`);
  }
}

// Check memory usage
function checkMemory() {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = usedMemory / totalMemory;

    const processMemory = process.memoryUsage();
    const heapUsage = processMemory.heapUsed / processMemory.heapTotal;

    results.checks.memory = {
      status: memoryUsage < config.memoryThreshold ? 'healthy' : 'unhealthy',
      system: {
        total: Math.round(totalMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        usage: Math.round(memoryUsage * 100)
      },
      process: {
        heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024),
        heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024),
        heapUsage: Math.round(heapUsage * 100)
      }
    };

    if (memoryUsage >= config.memoryThreshold) {
      results.errors.push(`High memory usage: ${Math.round(memoryUsage * 100)}%`);
    }
  } catch (error) {
    results.checks.memory = {
      status: 'unhealthy',
      error: error.message
    };
    results.errors.push(`Memory check failed: ${error.message}`);
  }
}

// Check disk usage
function checkDisk() {
  try {
    const stats = fs.statSync('/app');

    // Simple disk space check (this is basic, in real scenario you'd use statvfs)
    results.checks.disk = {
      status: 'healthy',
      note: 'Basic disk check - space validation would require additional tools'
    };

    // Check if log directory is writable
    try {
      fs.accessSync('/app/logs', fs.constants.W_OK);
      results.checks.disk.logsWritable = true;
    } catch (error) {
      results.checks.disk.logsWritable = false;
      results.errors.push('Logs directory not writable');
    }

    // Check if temp directory is writable
    try {
      fs.accessSync('/app/tmp', fs.constants.W_OK);
      results.checks.disk.tempWritable = true;
    } catch (error) {
      results.checks.disk.tempWritable = false;
      results.errors.push('Temp directory not writable');
    }

  } catch (error) {
    results.checks.disk = {
      status: 'unhealthy',
      error: error.message
    };
    results.errors.push(`Disk check failed: ${error.message}`);
  }
}

// Check database connections
async function checkDatabases() {
  // Neo4j health check
  try {
    const neo4jResponse = await httpRequest({
      hostname: config.host,
      port: config.port,
      path: '/api/health/neo4j',
      method: 'GET',
      timeout: config.timeout
    });

    if (neo4jResponse.statusCode === 200) {
      results.checks.neo4j = {
        status: 'healthy',
        connectionTime: JSON.parse(neo4jResponse.body).connectionTime
      };
    } else {
      throw new Error(`HTTP ${neo4jResponse.statusCode}`);
    }
  } catch (error) {
    results.checks.neo4j = {
      status: 'unhealthy',
      error: error.message
    };
    results.errors.push(`Neo4j check failed: ${error.message}`);
  }

  // Redis health check
  try {
    const redisResponse = await httpRequest({
      hostname: config.host,
      port: config.port,
      path: '/api/health/redis',
      method: 'GET',
      timeout: config.timeout
    });

    if (redisResponse.statusCode === 200) {
      results.checks.redis = {
        status: 'healthy',
        connectionTime: JSON.parse(redisResponse.body).connectionTime
      };
    } else {
      throw new Error(`HTTP ${redisResponse.statusCode}`);
    }
  } catch (error) {
    results.checks.redis = {
      status: 'unhealthy',
      error: error.message
    };
    results.errors.push(`Redis check failed: ${error.message}`);
  }
}

// Main health check function
async function runHealthCheck() {
  console.log('🏥 Starting health check...');

  // Run all checks
  await checkApplication();
  checkMemory();
  checkDisk();
  await checkDatabases();

  // Determine overall status
  const hasUnhealthyChecks = Object.values(results.checks).some(
    check => check.status === 'unhealthy'
  );

  if (hasUnhealthyChecks || results.errors.length > 0) {
    results.status = 'unhealthy';
  }

  // Output results
  console.log(JSON.stringify(results, null, 2));

  // Exit with appropriate code
  if (results.status === 'healthy') {
    console.log('✅ Health check passed');
    process.exit(0);
  } else {
    console.log('❌ Health check failed');
    console.log('Errors:', results.errors);
    process.exit(1);
  }
}

// Handle errors and timeouts
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception during health check:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection during health check:', reason);
  process.exit(1);
});

// Set overall timeout
setTimeout(() => {
  console.error('❌ Health check timeout');
  process.exit(1);
}, config.timeout * 2);

// Run the health check
runHealthCheck().catch((error) => {
  console.error('❌ Health check error:', error.message);
  process.exit(1);
});