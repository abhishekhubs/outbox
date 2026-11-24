import prisma from './config/database';
import { getRedis } from './config/redis';
import { startWorker, stopWorker } from './queues/email.worker';
import logger from './utils/logger';

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

    const handleShutdown = async (signal: string) => {
      logger.info(`[Worker Process] Received ${signal}, closing worker gracefully...`);
      try {
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
