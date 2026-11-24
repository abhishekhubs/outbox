import { Request, Response } from 'express';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { getElasticsearchClient } from '../config/elasticsearch';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
      database: string;
      redis: string;
      elasticsearch: string;
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      elasticsearch: 'unknown',
    },
  };

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error: any) {
    health.services.database = `error: ${error.message}`;
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    health.services.redis = pong === 'PONG' ? 'connected' : pong;
  } catch (error: any) {
    health.services.redis = `error: ${error.message}`;
    health.status = 'degraded';
  }

  // Check Elasticsearch
  try {
    const es = getElasticsearchClient();
    const clusterHealth = await es.cluster.health({});
    health.services.elasticsearch = clusterHealth.status;
  } catch (error: any) {
    health.services.elasticsearch = `error: ${error.message}`;
    // Elasticsearch failure does not bring down the main app, marks as degraded
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
}
