import axios from 'axios';
import { env } from '../../config/env';
import type { GoogleTokenResponse, GoogleUserProfile } from '../../types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = ['openid', 'profile', 'email'];

/**
 * Build Google OAuth2 authorization URL.
 */
export function buildGoogleAuthUrl(state: string, redirectUri?: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri || env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string, redirectUri?: string): Promise<GoogleTokenResponse> {
  const { data } = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri || env.GOOGLE_CALLBACK_URL,
    grant_type: 'authorization_code',
  });

  return data;
}

/**
 * Fetch user profile from Google using access token.
 */
export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const { data } = await axios.get<GoogleUserProfile>(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return data;
}
