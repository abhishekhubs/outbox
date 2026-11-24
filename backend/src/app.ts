import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { emailQueue } from './queues/email.queue';
import logger from './utils/logger';

export function createApp(): express.Application {
  const app = express();

  // Security headers (configure CSP to allow Bull-Board assets)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: [
        env.FRONTEND_URL,
        'https://outbox-steel.vercel.app',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      morgan('short', {
        stream: {
          write: (message: string) => logger.http(message.trim()),
        },
      })
    );
  }

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Bull Board for queue monitoring (mounted at /api/admin/queues, protected)
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/api/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(emailQueue as any) as any],
      serverAdapter,
      options: {
        uiConfig: {
          boardTitle: 'Queue Monitor',
          miscLinks: [
            { text: '← Outbox Dashboard', url: env.FRONTEND_URL || 'https://outbox-steel.vercel.app' },
          ],
        },
      },
    });

    // Protected Bull Board endpoint with Minimalist Light Theme injection
    app.use(
      '/api/admin/queues',
      authenticate,
      (req, res, next) => {
        const originalRender = res.render.bind(res);
        res.render = (view: string, options?: any, callback?: any) => {
          originalRender(view, options, (err: Error, html: string) => {
            if (err) {
              if (typeof callback === 'function') return callback(err);
              return next(err);
            }

            // Minimalist Light Theme CSS injection matching Outbox's #fafafa / #ffffff aesthetic
            const minimalistCss = `
              <style id="outbox-minimalist-theme">
                :root {
                  --menu-width: 230px !important;
                  --header-height: 56px !important;
                }
                body, #root, main {
                  background-color: #fafafa !important;
                  color: #171717 !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                }
                /* Animated minimalist loading state for Bull Board */
                body > #root:empty, #root:has(> *:only-child:not([class])) {
                  background-color: #fafafa !important;
                  color: #525252 !important;
                }
                /* Top Header Navigation Bar */
                .Qp5xkm {
                  background: #ffffff !important;
                  border-bottom: 1px solid #e5e7eb !important;
                  box-shadow: none !important;
                }
                /* Top-left Brand Logo box */
                .Qp5xkm > .KmtwbG {
                  background-color: #ffffff !important;
                  color: #111827 !important;
                  border-bottom: 1px solid #e5e7eb !important;
                  border-right: 1px solid #e5e7eb !important;
                  box-shadow: none !important;
                  font-size: 0.95rem !important;
                  font-weight: 600 !important;
                  letter-spacing: -0.01em !important;
                }
                .Qp5xkm > .KmtwbG > .hIscLx {
                  filter: grayscale(1) !important;
                  opacity: 0.75 !important;
                }
                /* Left Sidebar */
                .KM3iIV, aside, [class*="sidebar"], [class*="Sidebar"] {
                  background: #ffffff !important;
                  border-right: 1px solid #e5e7eb !important;
                  box-shadow: none !important;
                  color: #525252 !important;
                }
                /* QUEUES section heading */
                .KM3iIV ._SQRTj {
                  color: #9ca3af !important;
                  font-size: 10px !important;
                  font-weight: 600 !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.05em !important;
                  padding: 0 1rem 0.5rem !important;
                }
                /* Sidebar Queue Items */
                .KM3iIV a, .KM3iIV li, .KM3iIV [role="button"] {
                  color: #4b5563 !important;
                  font-size: 13px !important;
                  font-weight: 500 !important;
                  border-radius: 6px !important;
                  transition: all 0.15s ease !important;
                }
                .KM3iIV a:hover, .KM3iIV a[class*="active"], .KM3iIV [class*="selected"], .KM3iIV li:hover {
                  background-color: #f3f4f6 !important;
                  color: #111827 !important;
                  font-weight: 600 !important;
                }
                /* Queue Cards in main area */
                main > div, [class*="Card"], [class*="card"] {
                  background-color: #ffffff !important;
                  border: 1px solid #e5e7eb !important;
                  border-radius: 10px !important;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
                }
                /* Status pills and text */
                main, p, span, h1, h2, h3, h4 {
                  color: #171717 !important;
                }
                /* Misc Links (e.g. Back to Outbox Dashboard) */
                .Qp5xkm a {
                  color: #4b5563 !important;
                  font-size: 12px !important;
                  font-weight: 500 !important;
                  text-decoration: none !important;
                  padding: 4px 10px !important;
                  border-radius: 6px !important;
                  border: 1px solid #e5e7eb !important;
                  background: #ffffff !important;
                  transition: all 0.15s ease !important;
                }
                .Qp5xkm a:hover {
                  background: #f3f4f6 !important;
                  color: #111827 !important;
                }
              </style>
            `;

            const modifiedHtml = html.replace('</head>', `${minimalistCss}</head>`);
            if (typeof callback === 'function') {
              return callback(null, modifiedHtml);
            }
            return res.send(modifiedHtml);
          });
        };
        next();
      },
      serverAdapter.getRouter()
    );
  } catch (bullErr) {
    logger.warn('Bull Board UI could not be mounted in this environment', { error: bullErr });
  }
  app.get('/admin/queues', (_req, res) => res.redirect('/api/admin/queues'));

  // Root endpoint: friendly landing page & navigation
  app.get('/', (req, res) => {
    if (req.accepts('html')) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Outbox Email Scheduler API</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background-color: #fafafa;
              color: #171717;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: #ffffff;
              border: 1px solid #e5e5e5;
              border-radius: 12px;
              padding: 32px;
              max-width: 480px;
              width: 100%;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              background: #ecfdf5;
              color: #059669;
              font-size: 12px;
              font-weight: 600;
              border-radius: 9999px;
              margin-bottom: 16px;
            }
            .badge-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #10b981;
            }
            h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 8px 0;
              color: #111827;
            }
            p {
              font-size: 14px;
              color: #6b7280;
              margin: 0 0 24px 0;
              line-height: 1.5;
            }
            .btn {
              display: block;
              width: 100%;
              padding: 10px 16px;
              margin-bottom: 10px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              text-align: center;
              text-decoration: none;
              transition: all 0.15s ease;
              box-sizing: border-box;
            }
            .btn-primary {
              background: #00a84d;
              color: #ffffff;
            }
            .btn-primary:hover {
              background: #009243;
            }
            .btn-secondary {
              background: #f3f4f6;
              color: #374151;
              border: 1px solid #e5e7eb;
            }
            .btn-secondary:hover {
              background: #e5e7eb;
            }
            .footer {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 20px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">
              <span class="badge-dot"></span>
              API Server Online &amp; Healthy
            </div>
            <h1>Outbox Email Scheduler API</h1>
            <p>You have accessed the backend API server running on port 5000. To use the email campaign dashboard, compose emails, and view scheduled leads, open the frontend app below:</p>
            
            <a href="${env.FRONTEND_URL || 'http://localhost:5173'}" class="btn btn-primary">Open Frontend Dashboard (Port 5173) &rarr;</a>
            <a href="/api/health" class="btn btn-secondary">System Health Check (/api/health)</a>
            <a href="/api/admin/queues" class="btn btn-secondary">BullMQ Queue Monitor (/api/admin/queues)</a>
            
            <div class="footer">
              TypeScript &bull; Express &bull; BullMQ &bull; Redis &bull; PostgreSQL
            </div>
          </div>
        </body>
        </html>
      `);
    }

    res.json({
      name: 'Outbox Email Scheduler & Sending Platform API',
      status: 'online',
      version: '1.0.0',
      frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
      endpoints: {
        health: '/api/health',
        queues: '/api/admin/queues',
        emails: '/api/emails/scheduled',
        sentEmails: '/api/emails/sent',
        schedule: '/api/emails/schedule',
        slack: '/api/slack/authorize',
      },
    });
  });

  // Mount API routes
  app.use('/api', routes);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export default createApp();
