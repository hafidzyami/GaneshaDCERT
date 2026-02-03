/**
 * Health Check Routes
 * Comprehensive health check endpoints for load balancer and monitoring
 * Task: A2.6 - Health check endpoint for load balancer
 */

import { Router, Request, Response } from 'express';
import {
  DatabaseService,
  DIDBlockchainConfig,
  VCBlockchainConfig,
  CredentialsHistoryBlockchainConfig,
  PaymentBlockchainConfig,
  logger,
  isRedisHealthy,
} from '../config';
import distributedLockService from '../services/distributedLock.service';
import blockchainTransactionQueueService from '../services/blockchain/blockchainTransactionQueue.service';
import cacheService from '../services/cache.service';
import sessionService from '../services/session.service';

const router = Router();

/**
 * Health check response interfaces
 */
interface LivenessResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
  };
}

interface DeepHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  instance: {
    id: string;
    startedAt: string;
  };
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    blockchain: {
      did: ServiceHealth;
      vc: ServiceHealth;
      credentialsHistory: ServiceHealth;
      payment: ServiceHealth;
    };
  };
  memory: MemoryUsage;
}

interface ServiceHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

interface MemoryUsage {
  heapUsed: string;
  heapTotal: string;
  external: string;
  rss: string;
}

interface InstanceStatusResponse {
  instanceId: string;
  uptime: number;
  startedAt: string;
  leader: {
    isLeader: boolean;
    leaderId: string | null;
    workerType: string;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  sessions: {
    totalUserSessions: number;
    totalAdminSessions: number;
  };
  cache: {
    keys: number;
    memory: string;
    redisUptime: number;
  };
}

// Track server start time
const serverStartTime = new Date();

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness Probe
 *     description: |
 *       Simple liveness check for Kubernetes/load balancer.
 *       Returns 200 if the application is running.
 *       Used to detect if the application needs to be restarted.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/live', (req: Request, res: Response) => {
  const response: LivenessResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness Probe
 *     description: |
 *       Readiness check for Kubernetes/load balancer.
 *       Returns 200 if the application is ready to serve traffic.
 *       Checks database and Redis connectivity.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Application is ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: boolean
 *                     redis:
 *                       type: boolean
 *       503:
 *         description: Application is not ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      DatabaseService.isConnected(),
      isRedisHealthy(),
    ]);

    const isReady = dbHealth && redisHealth;

    const response: ReadinessResponse = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: redisHealth,
      },
    };

    res.status(isReady ? 200 : 503).json(response);
  } catch (error) {
    logger.error('[HealthCheck] Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: false,
        redis: false,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Deep Health Check
 *     description: |
 *       Comprehensive health check with detailed service status.
 *       Checks all services including database, Redis, and blockchain connections.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 services:
 *                   type: object
 *       503:
 *         description: One or more critical services are unhealthy
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check all services with timing
    const checks = await Promise.all([
      checkServiceHealth('database', async () => DatabaseService.isConnected()),
      checkServiceHealth('redis', async () => isRedisHealthy()),
      checkServiceHealth('blockchain:did', async () => DIDBlockchainConfig.isConnected()),
      checkServiceHealth('blockchain:vc', async () => VCBlockchainConfig.isConnected()),
      checkServiceHealth('blockchain:credentialsHistory', async () =>
        CredentialsHistoryBlockchainConfig.isConnected()
      ),
      checkServiceHealth('blockchain:payment', async () => PaymentBlockchainConfig.isConnected()),
    ]);

    const [dbHealth, redisHealth, didHealth, vcHealth, credHistoryHealth, paymentHealth] = checks;

    // Determine overall status
    const criticalServicesUp = dbHealth.status === 'up' && redisHealth.status === 'up';
    const blockchainServicesUp =
      didHealth.status === 'up' &&
      vcHealth.status === 'up' &&
      credHistoryHealth.status === 'up' &&
      paymentHealth.status === 'up';

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (criticalServicesUp && blockchainServicesUp) {
      status = 'healthy';
    } else if (criticalServicesUp) {
      status = 'degraded'; // Critical services up, but blockchain issues
    } else {
      status = 'unhealthy';
    }

    const memUsage = process.memoryUsage();
    const response: DeepHealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      instance: {
        id: distributedLockService.getInstanceId(),
        startedAt: serverStartTime.toISOString(),
      },
      services: {
        database: dbHealth,
        redis: redisHealth,
        blockchain: {
          did: didHealth,
          vc: vcHealth,
          credentialsHistory: credHistoryHealth,
          payment: paymentHealth,
        },
      },
      memory: {
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external),
        rss: formatBytes(memUsage.rss),
      },
    };

    const httpStatus = status === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(response);
  } catch (error) {
    logger.error('[HealthCheck] Deep health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /health/instance:
 *   get:
 *     summary: Instance Status
 *     description: |
 *       Get detailed status of this instance including leader election status,
 *       queue statistics, and session counts. Useful for monitoring multi-instance deployments.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Instance status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 instanceId:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 leader:
 *                   type: object
 *                   properties:
 *                     isLeader:
 *                       type: boolean
 *                     leaderId:
 *                       type: string
 *                 queue:
 *                   type: object
 *                 sessions:
 *                   type: object
 *                 cache:
 *                   type: object
 */
router.get('/instance', async (req: Request, res: Response) => {
  try {
    const [leaderInfo, queueStatus, sessionStats, cacheStats] = await Promise.all([
      distributedLockService.getLeaderInfo('blockchain-worker').catch(() => ({
        leaderId: null,
        isLeader: false,
        ttlSeconds: 0,
      })),
      blockchainTransactionQueueService.getMultiInstanceStatus().catch(() => null),
      sessionService.getStats().catch(() => ({ totalUserSessions: 0, totalAdminSessions: 0 })),
      cacheService.getStats().catch(() => ({ keys: 0, memory: 'unknown', uptime: 0 })),
    ]);

    const response: InstanceStatusResponse = {
      instanceId: distributedLockService.getInstanceId(),
      uptime: process.uptime(),
      startedAt: serverStartTime.toISOString(),
      leader: {
        isLeader: leaderInfo?.isLeader ?? false,
        leaderId: leaderInfo?.leaderId ?? null,
        workerType: 'blockchain-worker',
      },
      queue: queueStatus ? {
        waiting: queueStatus.queueStats.waiting,
        active: queueStatus.queueStats.active,
        completed: queueStatus.queueStats.completed,
        failed: queueStatus.queueStats.failed,
      } : {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
      sessions: sessionStats,
      cache: {
        keys: cacheStats.keys,
        memory: cacheStats.memory,
        redisUptime: cacheStats.uptime,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('[HealthCheck] Instance status check failed:', error);
    res.status(500).json({
      error: 'Failed to get instance status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: System Metrics
 *     description: |
 *       Get system metrics including CPU, memory, and event loop stats.
 *       Useful for monitoring and alerting.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: System metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  const response = {
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: process.uptime(),
      formatted: formatUptime(process.uptime()),
    },
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      formatted: {
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external),
        rss: formatBytes(memUsage.rss),
      },
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
      userMs: (cpuUsage.user / 1000).toFixed(2),
      systemMs: (cpuUsage.system / 1000).toFixed(2),
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      arch: process.arch,
    },
  };

  res.status(200).json(response);
});

/**
 * Helper function to check service health with timing
 */
async function checkServiceHealth(
  name: string,
  checker: () => Promise<boolean>
): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const isHealthy = await checker();
    return {
      status: isHealthy ? 'up' : 'down',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format uptime to human readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
