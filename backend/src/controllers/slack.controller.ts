import { Request, Response, NextFunction } from 'express';
import * as slackService from '../services/slack.service';
import { env } from '../config/env';
import type { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

export async function connectSlack(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const authUrl = await slackService.getSlackAuthUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

export async function slackCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error: slackError } = req.query;

    if (slackError) {
      logger.error('Slack OAuth error from callback', { error: slackError });
      res.redirect(`${env.FRONTEND_URL}/dashboard/settings?slack_error=${encodeURIComponent(String(slackError))}`);
      return;
    }

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      res.redirect(`${env.FRONTEND_URL}/dashboard/settings?slack_error=invalid_callback_params`);
      return;
    }

    // Get userId associated with state
    const userId = await slackService.getUserIdBySlackState(state);
    if (!userId) {
      res.redirect(`${env.FRONTEND_URL}/dashboard/settings?slack_error=expired_state`);
      return;
    }

    await slackService.handleSlackCallback(code, state, userId);
    res.redirect(`${env.FRONTEND_URL}/dashboard/settings?slack=connected`);
  } catch (error: any) {
    logger.error('Slack OAuth callback error', { error: error.message });
    res.redirect(`${env.FRONTEND_URL}/dashboard/settings?slack_error=${encodeURIComponent(error.message || 'Connection failed')}`);
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
