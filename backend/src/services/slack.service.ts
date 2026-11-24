import axios from 'axios';
import { randomUUID as uuidv4 } from 'crypto';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { encrypt, decrypt } from '../utils/encryption';
import { buildSlackAuthUrl, exchangeSlackCode } from '../integrations/slack/oauth';
import type { SlackStatus } from '../types';
import logger from '../utils/logger';

const SLACK_STATE_TTL = 600; // 10 minutes
const SLACK_REVOKE_URL = 'https://slack.com/api/auth.revoke';
const SLACK_CHAT_POST_URL = 'https://slack.com/api/chat.postMessage';

/**
 * Generate Slack OAuth URL with state for a user.
 */
export async function getSlackAuthUrl(userId: string): Promise<string> {
  const state = uuidv4();
  const redis = getRedis();
  await redis.set(`slack:state:${state}`, userId, 'EX', SLACK_STATE_TTL);
  return buildSlackAuthUrl(state);
}

/**
 * Retrieve userId associated with a Slack state from Redis.
 */
export async function getUserIdBySlackState(state: string): Promise<string | null> {
  const redis = getRedis();
  return redis.get(`slack:state:${state}`);
}

/**
 * Handle Slack OAuth callback: exchange code, store encrypted token.
 */
export async function handleSlackCallback(
  code: string,
  state: string,
  userId: string
): Promise<void> {
  // Validate state
  const redis = getRedis();
  const stateKey = `slack:state:${state}`;
  const storedUserId = await redis.get(stateKey);

  if (!storedUserId || storedUserId !== userId) {
    throw Object.assign(new Error('Invalid or expired Slack OAuth state'), {
      statusCode: 400,
      code: 'INVALID_STATE',
    });
  }

  await redis.del(stateKey);

  // Exchange code for token
  const tokenData = await exchangeSlackCode(code);

  // Encrypt the access token
  const encryptedAccessToken = encrypt(tokenData.access_token);
  const encryptedWebhookUrl = tokenData.incoming_webhook?.url
    ? encrypt(tokenData.incoming_webhook.url)
    : null;

  // Upsert Slack integration
  await prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      workspaceId: tokenData.team.id,
      workspaceName: tokenData.team.name,
      botUserId: tokenData.bot_user_id || null,
      channelId: tokenData.incoming_webhook?.channel_id || null,
      channelName: tokenData.incoming_webhook?.channel || null,
      encryptedAccessToken,
      encryptedWebhookUrl,
    },
    create: {
      userId,
      workspaceId: tokenData.team.id,
      workspaceName: tokenData.team.name,
      botUserId: tokenData.bot_user_id || null,
      channelId: tokenData.incoming_webhook?.channel_id || null,
      channelName: tokenData.incoming_webhook?.channel || null,
      encryptedAccessToken,
      encryptedWebhookUrl,
    },
  });

  logger.info(`Slack connected for user ${userId}`, {
    workspace: tokenData.team.name,
  });
}

/**
 * Send a Slack notification about rate limiting.
 * Uses deduplication to avoid spamming users.
 */
export async function sendRateLimitNotification(
  userId: string,
  senderEmail: string,
  hourlyLimit: number,
  pendingCount: number,
  nextWindow: Date
): Promise<void> {
  const redis = getRedis();

  // Dedup: only send once per sender per window
  const windowKey = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-${String(new Date().getUTCDate()).padStart(2, '0')}-${String(new Date().getUTCHours()).padStart(2, '0')}`;
  const dedupKey = `slack:notif:${senderEmail}:${windowKey}`;
  const alreadySent = await redis.get(dedupKey);

  if (alreadySent) {
    logger.debug(`Slack rate-limit notification already sent for ${senderEmail} in window ${windowKey}`);
    return;
  }

  // Get Slack integration (or fallback to env.SLACK_BOT_TOKEN)
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
  });

  const accessToken = integration
    ? decrypt(integration.encryptedAccessToken)
    : env.SLACK_BOT_TOKEN || null;

  if (!accessToken) {
    logger.debug(`No Slack token configured for rate-limit alert`);
    return;
  }

  try {
    let targetChannel = integration?.channelId || integration?.botUserId || '';

    // If channel not set, find first public channel the bot can post to
    if (!targetChannel) {
      try {
        const listRes = await axios.get('https://slack.com/api/conversations.list', {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { types: 'public_channel', limit: 5 },
        });
        if (listRes.data?.ok && listRes.data.channels?.length > 0) {
          targetChannel = listRes.data.channels[0].id;
        }
      } catch (err) {
        logger.debug('Could not list Slack channels, will attempt direct post', { err });
      }
    }

    if (!targetChannel) {
      targetChannel = 'general';
    }

    const message = {
      channel: targetChannel,
      text: `⚠️ *Rate Limit Reached* for \`${senderEmail}\``,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Rate Limit Reached',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${hourlyLimit}`,
            },
            {
              type: 'mrkdwn',
              text: `*Pending Emails:*\n${pendingCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Window:*\n${nextWindow.toISOString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Emails will resume automatically at the next rate limit window.`,
            },
          ],
        },
      ],
    };

    await axios.post(SLACK_CHAT_POST_URL, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Set dedup key with 1-hour TTL
    await redis.set(dedupKey, '1', 'EX', 3600);

    logger.info(`Slack rate-limit notification sent for ${senderEmail}`, { userId });
  } catch (error) {
    logger.error(`Failed to send Slack notification for user ${userId}`, { error });
  }
}

/**
 * Disconnect Slack integration: revoke token and delete record.
 */
export async function disconnectSlack(userId: string): Promise<void> {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
  });

  if (!integration) {
    throw Object.assign(new Error('Slack is not connected'), {
      statusCode: 404,
      code: 'SLACK_NOT_CONNECTED',
    });
  }

  try {
    const accessToken = decrypt(integration.encryptedAccessToken);
    await axios.post(
      SLACK_REVOKE_URL,
      new URLSearchParams({ token: accessToken }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
  } catch (error) {
    logger.warn('Failed to revoke Slack token (continuing with deletion)', { error });
  }

  await prisma.slackIntegration.delete({ where: { userId } });
  logger.info(`Slack disconnected for user ${userId}`);
}

/**
 * Get Slack connection status for a user.
 */
export async function getSlackStatus(userId: string): Promise<SlackStatus> {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: {
      workspaceName: true,
      channelName: true,
      connectedAt: true,
    },
  });

  if (!integration) {
    return { connected: false };
  }

  return {
    connected: true,
    workspaceName: integration.workspaceName,
    channelName: integration.channelName || undefined,
    connectedAt: integration.connectedAt,
  };
}
