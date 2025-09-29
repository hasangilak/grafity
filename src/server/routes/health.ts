import { Router } from 'express';
import { MonitoringService } from '../monitoring/service';
import { DatabaseConnection } from '../database/connection';

export function healthRoutes(
  monitoringService: MonitoringService,
  databaseConnection: DatabaseConnection
): Router {
  const router = Router();

  // Basic health check - lightweight endpoint for load balancers
  router.get('/', async (req, res) => {
    try {
      const healthStatus = await monitoringService.getHealthStatus();

      res.status(healthStatus.healthy ? 200 : 503).json({
        status: healthStatus.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });

    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Detailed health check with all service status
  router.get('/detailed', async (req, res) => {
    try {
      const [
        appHealth,
        dbHealth,
        monitoringStats
      ] = await Promise.all([
        monitoringService.getHealthStatus(),
        databaseConnection.getHealthStatus(),
        monitoringService.getStats()
      ]);

      const overallHealthy = appHealth.healthy &&
        Object.values(dbHealth).every(db => db.healthy);

      res.status(overallHealthy ? 200 : 503).json({
        status: overallHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          application: appHealth,
          databases: dbHealth,
          monitoring: {
            healthy: true,
            uptime: monitoringStats.uptime,
            stats: monitoringStats
          }
        }
      });

    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed'
      });
    }
  });

  // Readiness check - indicates if service is ready to accept traffic
  router.get('/ready', async (req, res) => {
    try {
      const dbHealthy = await databaseConnection.isHealthy();
      const appHealthy = (await monitoringService.getHealthStatus()).healthy;

      const ready = dbHealthy && appHealthy;

      res.status(ready ? 200 : 503).json({
        ready,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy,
          application: appHealthy
        }
      });

    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  });

  // Liveness check - indicates if service is alive (for Kubernetes)
  router.get('/live', (req, res) => {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid
    });
  });

  return router;
}