import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import logger from '../utils/logger';
import type { AuthRequest } from '../middleware/auth';

function resolveOAuthUrls(req: Request) {
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const isRemoteHost = Boolean(host && !host.includes('localhost') && !host.includes('127.0.0.1'));

  const callbackUrl =
    isRemoteHost && env.GOOGLE_CALLBACK_URL.includes('localhost')
      ? `${proto}://${host}/api/auth/google/callback`
      : env.GOOGLE_CALLBACK_URL;

  const frontendUrl =
    isRemoteHost && env.FRONTEND_URL.includes('localhost')
      ? 'https://outbox-steel.vercel.app'
      : env.FRONTEND_URL;

  const isHttps = proto === 'https' || env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

  return { callbackUrl, frontendUrl, isHttps };
}

export async function googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { callbackUrl } = resolveOAuthUrls(req);
    const authUrl = await authService.getGoogleAuthUrl(callbackUrl);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { callbackUrl, frontendUrl, isHttps } = resolveOAuthUrls(req);
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error('Google OAuth error from callback', { error: oauthError });
      res.redirect(`${frontendUrl}/?error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      res.redirect(`${frontendUrl}/?error=missing_code_or_state`);
      return;
    }

    const { token } = await authService.handleGoogleCallback(code, state, callbackUrl);

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${frontendUrl}/dashboard`);
  } catch (error: any) {
    logger.error('Google OAuth callback handling error', { error: error.message });
    res.redirect(`${frontendUrl}/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function devLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'No users found. Run npm run db:seed first.', code: 'USER_NOT_FOUND' },
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully' });
}
