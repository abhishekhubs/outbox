import jwt from 'jsonwebtoken';
import { randomUUID as uuidv4 } from 'crypto';
import prisma from '../config/database';
import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { buildGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserProfile } from '../integrations/google/oauth';
import type { AuthResult, JwtPayload } from '../types';
import logger from '../utils/logger';

const OAUTH_STATE_TTL = 600; // 10 minutes

/**
 * Generate Google OAuth2 consent URL with CSRF state parameter.
 */
export async function getGoogleAuthUrl(): Promise<string> {
  const state = uuidv4();
  const redis = getRedis();
  await redis.set(`oauth:state:${state}`, '1', 'EX', OAUTH_STATE_TTL);

  return buildGoogleAuthUrl(state);
}

/**
 * Handle Google OAuth2 callback.
 * Verifies state, exchanges code for tokens, upserts user, generates JWT.
 */
export async function handleGoogleCallback(code: string, state: string): Promise<AuthResult> {
  // Validate state
  const redis = getRedis();
  const stateKey = `oauth:state:${state}`;
  const storedState = await redis.get(stateKey);

  if (!storedState) {
    throw Object.assign(new Error('Invalid or expired OAuth state'), {
      statusCode: 400,
      code: 'INVALID_STATE',
    });
  }

  // Delete state to prevent replay
  await redis.del(stateKey);

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  // Get user profile
  const profile = await getGoogleUserProfile(tokens.access_token);

  if (!profile.email || !profile.verified_email) {
    throw Object.assign(new Error('Google account must have a verified email'), {
      statusCode: 400,
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { googleId: profile.id },
    update: {
      email: profile.email,
      name: profile.name,
      avatar: profile.picture || null,
    },
    create: {
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      avatar: profile.picture || null,
    },
  });

  // Automatically provision default sender account if none exists
  const existingSender = await prisma.sender.findFirst({
    where: { userId: user.id },
  });

  if (!existingSender) {
    const { encrypt } = await import('../utils/encryption');
    const encryptedPass = encrypt(env.ETHEREAL_PASS || 'ethereal_pass');
    await prisma.sender.create({
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.name,
        smtpHost: env.ETHEREAL_HOST,
        smtpPort: env.ETHEREAL_PORT,
        smtpUser: env.ETHEREAL_USER || user.email,
        encryptedSmtpPass: encryptedPass,
        hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        minimumSendDelay: env.MIN_EMAIL_DELAY_MS,
      },
    });
  }

  // Generate JWT
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

  logger.info(`User authenticated: ${user.email}`, { userId: user.id });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  };
}

/**
 * Get user by ID.
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * Verify JWT and return payload.
 */
export function verifyAndRefreshAuth(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  return decoded;
}
