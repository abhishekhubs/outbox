import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import logger from '../utils/logger';
import type { AuthRequest } from '../middleware/auth';

export async function googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUrl = await authService.getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error('Google OAuth error from callback', { error: oauthError });
      res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(String(oauthError))}`);
      return;
    }

    if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
      res.redirect(`${env.FRONTEND_URL}/?error=missing_code_or_state`);
      return;
    }

    const { token } = await authService.handleGoogleCallback(code, state);

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error: any) {
    logger.error('Google OAuth callback handling error', { error: error.message });
    res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(error.message || 'Authentication failed')}`);
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
