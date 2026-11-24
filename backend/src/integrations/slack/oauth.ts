import axios from 'axios';
import { env } from '../../config/env';
import type { SlackOAuthResponse } from '../../types';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

const SCOPES = ['chat:write', 'channels:read'];

/**
 * Build Slack OAuth2 authorization URL.
 */
export function buildSlackAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: SCOPES.join(','),
    redirect_uri: env.SLACK_CALLBACK_URL,
    state,
  });

  return `${SLACK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for Slack access token.
 */
export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const { data } = await axios.post<SlackOAuthResponse>(
    SLACK_TOKEN_URL,
    new URLSearchParams({
      code,
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      redirect_uri: env.SLACK_CALLBACK_URL,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'unknown error'}`);
  }

  return data;
}
