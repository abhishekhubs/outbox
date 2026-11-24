import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import type { EmailJobData } from '../types';
import logger from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-queue';

let queueInstance: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!queueInstance) {
    const connection = createRedisConnection('bullmq-queue');
    queueInstance = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600 * 24, // Keep for 24h for inspection
          count: 1000,
        },
        removeOnFail: {
          age: 3600 * 24 * 7, // Keep failed for 7 days
        },
      },
    });

    queueInstance.on('error', (error) => {
      logger.error('BullMQ Email Queue error', { error: error.message });
    });

    logger.info('Email queue initialized');
  }

  return queueInstance;
}

export const emailQueue = getEmailQueue();
