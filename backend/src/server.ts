import app from './app';
import { env } from './config/env';
import prisma from './config/database';
import { getRedis } from './config/redis';
import { createEmailIndex } from './config/elasticsearch';
import { reconcileOnStartup } from './services/email.service';
import { startWorker, stopWorker } from './queues/email.worker';
import logger from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting Outbox Email Scheduler API Server...');

    // 1. Verify Database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // 2. Verify Redis connection
    const redis = getRedis();
    const ping = await redis.ping();
    logger.info(`Redis connected successfully (${ping})`);

    // 3. Initialize Elasticsearch Index
    try {
      await createEmailIndex();
      logger.info('Elasticsearch index verified/created');
    } catch (esError: any) {
      logger.warn(`Elasticsearch initialization note: ${esError.message}`);
    }

    // 4. Run startup reconciliation (recovers orphaned jobs)
    try {
      await reconcileOnStartup();
    } catch (recError: any) {
      logger.error('Startup reconciliation failed', { error: recError });
    }

    // 5. In single-process development mode, also run the worker
    if (process.env.RUN_EMBEDDED_WORKER === 'true' || env.NODE_ENV === 'development') {
      startWorker();
      logger.info('Embedded email worker started');
    }

    // 6. Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`API Server running at http://localhost:${env.PORT}`);
      logger.info(`Bull Board UI accessible at http://localhost:${env.PORT}/api/admin/queues`);
    });

    // Graceful shutdown
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await stopWorker();
          await prisma.$disconnect();
          const r = getRedis();
          await r.quit();
          logger.info('All connections closed cleanly. Exiting.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', { error: err });
          process.exit(1);
        }
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error: any) {
    logger.error('Fatal bootstrap error', { error: error.message });
    process.exit(1);
  }
}

bootstrap();
