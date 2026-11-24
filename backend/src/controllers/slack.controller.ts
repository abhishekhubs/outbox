import { Request, Response, NextFunction } from 'express';
import * as slackService from '../services/slack.service';
import { env } from '../config/env';
import type { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

function resolveSlackUrls(req: Request) {
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const isRemoteHost = Boolean(host && !host.includes('localhost') && !host.includes('127.0.0.1'));

  const callbackUrl =
    isRemoteHost && env.SLACK_CALLBACK_URL.includes('localhost')
      ? `${proto}://${host}/api/slack/callback`
      : env.SLACK_CALLBACK_URL;

  const frontendUrl =
    isRemoteHost && env.FRONTEND_URL.includes('localhost')
      ? 'https://outbox-steel.vercel.app'
      : env.FRONTEND_URL;

  return { callbackUrl, frontendUrl };
}

export async function connectSlack(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { callbackUrl } = resolveSlackUrls(req);
    const authUrl = await slackService.getSlackAuthUrl(userId, callbackUrl);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

export async function slackCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { callbackUrl, frontendUrl } = resolveSlackUrls(req);
  try {
    const { code, state, error: slackError } = req.query;

    if (slackError) {
      logger.error('Slack OAuth error from callback', { error: slackError });
      res.redirect(`${frontendUrl}/dashboard/settings?slack_error=${encodeURIComponent(String(slackError))}`);
      return;
    }

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      res.redirect(`${frontendUrl}/dashboard/settings?slack_error=invalid_callback_params`);
      return;
    }

    // Get userId associated with state
    const userId = await slackService.getUserIdBySlackState(state);
    if (!userId) {
      res.redirect(`${frontendUrl}/dashboard/settings?slack_error=expired_state`);
      return;
    }

    await slackService.handleSlackCallback(code, state, userId, callbackUrl);
    res.redirect(`${frontendUrl}/dashboard/settings?slack=connected`);
  } catch (error: any) {
    logger.error('Slack OAuth callback error', { error: error.message });
    res.redirect(`${frontendUrl}/dashboard/settings?slack_error=${encodeURIComponent(error.message || 'Connection failed')}`);
  }
}

export async function getSlackStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const status = await slackService.getSlackStatus(userId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function disconnectSlack(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    await slackService.disconnectSlack(userId);
    res.json({ success: true, message: 'Slack workspace disconnected successfully' });
  } catch (error) {
    next(error);
  }
}
