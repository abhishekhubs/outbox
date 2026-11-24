import type { Request, Response } from 'express';

let cachedApp: ((req: Request, res: Response) => void) | null = null;

export default function handler(req: Request, res: Response) {
  try {
    if (!cachedApp) {
      // Lazy-load app so any env/config error returns a clear JSON message instead of crashing Vercel startup
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cachedApp = require('../src/app').default;
    }
    return cachedApp!(req, res);
  } catch (err: any) {
    console.error('Serverless function initialization error:', err);
    return res.status(500).json({
      success: false,
      error: {
        message: err?.message || 'Backend initialization failed',
        hint: 'Verify all required Environment Variables are configured in Vercel Project Settings.',
      },
    });
  }
}
