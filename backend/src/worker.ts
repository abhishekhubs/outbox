import http from 'http';
import fs from 'fs';
import prisma from './config/database';
import { getRedis } from './config/redis';
import { startWorker, stopWorker } from './queues/email.worker';
import logger from './utils/logger';

/** Tiny HTTP server for Railway / Docker healthcheck at GET /healthz */
function startHealthServer(port = 9090): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' && req.method === 'GET') {
      // Write alive marker for HEALTHCHECK CMD
      try { fs.writeFileSync('/tmp/worker-alive', Date.now().toString()); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', worker: 'bullmq-email-worker', ts: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  server.listen(port, () => logger.info(`[Worker] Health server listening on :${port}/healthz`));
  return server;
}

async function runWorkerProcess(): Promise<void> {
  logger.info('Starting Outbox Standalone Worker Process...');

  try {
    // 1. Verify DB
    await prisma.$connect();
    logger.info('[Worker Process] Database connected');

    // 2. Verify Redis
    const redis = getRedis();
    await redis.ping();
    logger.info('[Worker Process] Redis connected');

    // 3. Start BullMQ worker
    const worker = startWorker();
    logger.info('[Worker Process] Email worker is running and listening for jobs...');

    // 4. Start health server (Railway / Docker healthcheck)
    const healthPort = parseInt(process.env.PORT || process.env.WORKER_HEALTH_PORT || '9090', 10);
    const healthServer = startHealthServer(healthPort);
    // Write initial alive marker
    try { fs.writeFileSync('/tmp/worker-alive', Date.now().toString()); } catch {}

    const handleShutdown = async (signal: string) => {
      logger.info(`[Worker Process] Received ${signal}, closing worker gracefully...`);
      try {
        healthServer.close();
        await stopWorker();
        await prisma.$disconnect();
        const r = getRedis();
        await r.quit();
        logger.info('[Worker Process] Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('[Worker Process] Error during worker shutdown', { error: err });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error: any) {
    logger.error('[Worker Process] Fatal worker startup error', { error: error.message });
    process.exit(1);
  }
}

runWorkerProcess();
