import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import type { EmailJobData } from '../types';
import logger from '../utils/logger';

const QUEUE_NAME = 'email-queue';

let _queue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!_queue) {
    const connection = createRedisConnection('bullmq-queue');
    _queue = new Queue<EmailJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    _queue.on('error', (error) => {
      logger.error('Email queue error', { error: error.message });
    });

    logger.info('Email queue initialized');
  }

  return _queue;
}

/**
 * Add an email job to the queue with optional delay.
 */
export async function addEmailJob(
  emailId: string,
  delay: number,
  attachments?: import('../types').EmailAttachment[]
): Promise<string> {
  const queue = getEmailQueue();
  const jobId = `email-${emailId}`;

  const job = await queue.add(
    'send-email',
    { emailId, attachments },
    {
      jobId,
      delay: Math.max(0, delay),
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.debug(`Added email job ${jobId} with delay ${delay}ms`);
  return job.id!;
}

/**
 * Remove a job from the queue by jobId.
 */
export async function removeJob(jobId: string): Promise<boolean> {
  const queue = getEmailQueue();
  try {
    const job = await queue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      if (state === 'delayed' || state === 'waiting') {
        await job.remove();
        logger.info(`Removed job ${jobId}`);
        return true;
      }
      logger.warn(`Cannot remove job ${jobId} in state ${state}`);
      return false;
    }
    return true; // Job doesn't exist, treat as already removed
  } catch (error) {
    logger.error(`Failed to remove job ${jobId}`, { error });
    return false;
  }
}

/**
 * Get the status of a job by jobId.
 */
export async function getJobStatus(jobId: string): Promise<string | null> {
  const queue = getEmailQueue();
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return await job.getState();
  } catch (error) {
    logger.error(`Failed to get job status for ${jobId}`, { error });
    return null;
  }
}

export { QUEUE_NAME };
