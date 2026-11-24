# Outbox Backend API & Queue Worker

The core backend service for **Outbox** — a production-grade, distributed Email Scheduling and Sending Platform inspired by ReachInbox. Designed and built with a fault-tolerant architecture utilizing **Express.js**, **TypeScript**, **BullMQ + Redis**, **PostgreSQL (Prisma ORM)**, **Elasticsearch**, and **Ethereal Fake SMTP**.

---

## 1. Architecture & Core Guarantees

```
                             +------------------------+
                             |   Frontend Dashboard   |
                             |  (React + Tailwind UI) |
                             +-----------+------------+
                                         |  HTTP / REST API
                                         v
                             +------------------------+
                             |    Express API Server  |
                             | (Auth, Validate, Rate) |
                             +---+--------+--------+--+
                                 |        |        |
         +-----------------------+        |        +---------------------+
         |                                |                              |
         v                                v                              v
+------------------+             +-----------------+            +-------------------+
|  PostgreSQL 16   |             |   Redis v7.0    |            | Elasticsearch 8.x |
|  (Prisma ORM)    |             | - BullMQ Delayed|            | - Full-text       |
|  - Source of     |             |   Job Queues    |            |   Search Index    |
|    Truth         |             | - Hourly Rate   |            +-------------------+
+------------------+             |   Limit Window  |
         ^                       | - Min-Delay     |
         |                       |   Cooldowns     |
         |                       +--------+--------+
         |                                |
         |                                v
         |                       +-----------------+
         +-----------------------|  BullMQ Worker  |
         | (Status & Audit)      |   (Concurrency) |
                                 +--------+--------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             +--------------------+               +--------------------+
             |  Ethereal Fake SMTP|               |  Slack Web API     |
             |  (Email & Attaches)|               |  (Quota Alerts)    |
             +--------------------+               +--------------------+
```

### Non-Negotiable Engineering Guarantees
1. **Zero Cron Jobs**: Strictly 100% powered by persistent BullMQ delayed jobs enqueued in Redis. No `node-cron`, `cron`, `agenda`, or OS-level crontab.
2. **Distributed Hourly Rate Limiting**: Atomically enforced sliding-window counters in Redis (`ratelimit:sender:{senderId}:{hourWindow}`). When a limit is reached, jobs are smoothly rescheduled to the next available hourly window rather than dropped or permanently failed.
3. **Throttling & Minimum Delay**: Enforces a configurable cooldown period (default `2000ms`) between consecutive email sends across all distributed worker instances.
4. **Crash & Restart Persistence**:
   - PostgreSQL serves as the persistent source of truth.
   - BullMQ delayed jobs persist in Redis disk snapshots.
   - On server startup, the **Startup Reconciliation Service** checks for any pending emails in PostgreSQL not currently queued in Redis and re-enqueues them with exact remaining delay intervals.
   - Deterministic job IDs (`email-${id}`) and atomic SQL row locking (`status: scheduled -> processing`) prevent double sends.
5. **Dynamic Personalization**: Performs case-insensitive merge variable replacements (`{{Name}}`, `{{Company}}`, `{{Role}}`, `{{email}}`, etc.) dynamically per recipient.
6. **File Attachments Pipeline**: Full support for arbitrary file attachments (PDFs, images, datasets, spreadsheets, documents) serialized as base64 buffers, passed to BullMQ, and delivered via Nodemailer with MIME-type preservation across job retries.
7. **Slack Alerting**: Live OAuth 2.0 workspace integration delivering instant Slack notifications the moment a sender exceeds their hourly quota (with 1-hour Redis alert deduplication).
8. **Live BullMQ Queue Monitor**: Real-time queue observability dashboard powered by Bull Board at `/api/admin/queues`.

---

## 2. Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime & Language** | Node.js v20+ & TypeScript 5 | Strictly typed backend service and worker processes. |
| **Framework** | Express.js 4 | HTTP server with Helmet security, CORS, and cookie parsing. |
| **Queue Engine** | BullMQ 5 + Redis (ioredis) | Delayed email dispatching, worker concurrency, and job retries. |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM 5 | Relational data persistence with strict schema migrations and relations. |
| **Search Engine** | Elasticsearch 8.12 | Full-text indexing of emails, subjects, bodies, and statuses. |
| **SMTP Delivery** | Nodemailer + Ethereal Email | Real fake-SMTP transport generating live preview URLs for auditing. |
| **Monitoring** | Bull Board (`@bull-board/express`) | Real-time queue management (active, delayed, completed, failed). |
| **Authentication** | Google OAuth 2.0 & JWT | OAuth 2.0 PKCE flow with signed HTTP-only cookies. |
| **Alerting** | `@slack/web-api` | Live Slack bot notifications on rate-limit triggers. |
| **Validation** | Zod | Runtime request payload validation via middleware. |
| **Testing** | Vitest | Comprehensive test suite covering scheduling, rate limits, reconciliation, and Slack. |

---

## 3. Directory Structure

```
backend/
├── prisma/
│   ├── schema.prisma       # Prisma data models & relations
│   └── seed.ts             # Default sender & user seed script
├── src/
│   ├── config/             # Environment, Database, Redis, and Elasticsearch connections
│   │   ├── database.ts     # Prisma client singleton
│   │   ├── elasticsearch.ts# Elasticsearch client
│   │   ├── env.ts          # Zod-validated environment config
│   │   └── redis.ts        # ioredis connection factory
│   ├── controllers/        # Express route handlers
│   │   ├── auth.controller.ts
│   │   ├── campaign.controller.ts
│   │   ├── email.controller.ts
│   │   ├── health.controller.ts
│   │   ├── search.controller.ts
│   │   └── slack.controller.ts
│   ├── integrations/       # External API integrations
│   │   ├── google/oauth.ts # Google OAuth 2.0 exchange
│   │   ├── slack/oauth.ts  # Slack OAuth 2.0 token storage
│   │   └── smtp/ethereal.ts# Nodemailer Ethereal SMTP transport
│   ├── middleware/         # Express middlewares
│   │   ├── auth.ts         # JWT cookie authentication
│   │   ├── errorHandler.ts # Centralized JSON error responder
│   │   └── validate.ts     # Zod request validation wrapper
│   ├── queues/             # BullMQ queue & worker definitions
│   │   ├── email.queue.ts  # Queue creation & initialization
│   │   └── email.worker.ts # Job processor with rate limit & min delay logic
│   ├── routes/             # Express API route modules
│   │   ├── auth.routes.ts
│   │   ├── campaign.routes.ts
│   │   ├── email.routes.ts
│   │   ├── health.routes.ts
│   │   ├── search.routes.ts
│   │   ├── slack.routes.ts
│   │   └── index.ts        # Root API router
│   ├── services/           # Core business logic services
│   │   ├── auth.service.ts
│   │   ├── elasticsearch.service.ts
│   │   ├── email.service.ts
│   │   ├── rate-limit.service.ts
│   │   ├── scheduler.service.ts
│   │   ├── slack.service.ts
│   │   └── storage.service.ts
│   ├── types/              # TypeScript interface definitions
│   ├── utils/              # Utilities (encryption, logger)
│   ├── app.ts              # Express application factory & middleware setup
│   ├── server.ts           # HTTP server entry point & startup reconciliation
│   └── worker.ts           # Standalone worker process runner
├── tests/                  # Vitest test suites
│   ├── email-scheduling.test.ts
│   ├── rate-limit.test.ts
│   ├── reconciliation.test.ts
│   ├── slack-integration.test.ts
│   └── smtp.test.ts
├── .env.example            # Environment configuration template
├── package.json            # Scripts & dependencies
└── tsconfig.json           # TypeScript compilation settings
```

---

## 4. API Reference

All API routes are mounted under `/api`.

### 1. Root & Health
- `GET /` — Welcome landing page (browser HTML) or service metadata JSON.
- `GET /api/health` — Readiness probe reporting PostgreSQL, Redis, Elasticsearch, and Queue statuses.
- `GET /api/admin/queues` — Live Bull Board monitoring interface (authenticated).

### 2. Authentication (`/api/auth`)
- `GET /api/auth/google` — Initiates Google OAuth 2.0 login redirect.
- `GET /api/auth/google/callback` — Google OAuth redirect handler; issues JWT in an HTTP-only cookie.
- `POST /api/auth/login` — Direct email and password login.
- `GET /api/auth/me` — Returns the authenticated user session profile.
- `POST /api/auth/logout` — Clears authentication cookies and invalidates session.

### 3. Email Scheduling (`/api/emails`)
- `POST /api/emails/schedule` — Schedules a new campaign with batch recipients, custom merge parameters, file attachments, start time, delay, and hourly limit.
- `GET /api/emails/scheduled` — Paginated list of currently scheduled, processing, and retrying emails.
- `GET /api/emails/sent` — Paginated list of dispatched emails with sent timestamp and Ethereal preview links.
- `GET /api/emails/:id` — Details of a specific email record.
- `POST /api/emails/:id/cancel` — Cancels a scheduled email and removes its job from BullMQ.

### 4. Campaigns (`/api/campaigns`)
- `GET /api/campaigns` — Lists all email campaigns created by the user.
- `GET /api/campaigns/:id` — Specific campaign metrics (total, sent, failed, status).
- `POST /api/campaigns/:id/cancel` — Cancels all pending emails belonging to a campaign.

### 5. Search (`/api/search`)
- `GET /api/search?q=query` — Full-text Elasticsearch query across recipients, subjects, bodies, and statuses.

### 6. Slack Integration (`/api/slack`)
- `GET /api/slack/authorize` — Generates Slack OAuth authorization URL.
- `GET /api/slack/callback` — Slack OAuth callback; exchanges authorization code for bot token and persists it.
- `GET /api/slack/status` — Checks if user has an active connected Slack workspace.
- `POST /api/slack/disconnect` — Disconnects Slack workspace integration.

---

## 5. Environment Configuration

Create a `.env` file in the `backend` directory matching `.env.example`:

```env
NODE_ENV=development
PORT=5000

# PostgreSQL Database (Neon or local Docker)
DATABASE_URL=postgresql://neondb_owner:npg_...@ep-....aws.neon.tech/neondb?sslmode=require

# Redis Connection (Redis Cloud or local Docker)
REDIS_HOST=your-redis-host.db.redis.io
REDIS_PORT=10947
REDIS_PASSWORD=your-redis-password

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Worker & Scheduling Defaults
EMAIL_WORKER_CONCURRENCY=10
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
RATE_LIMIT_WINDOW_SECONDS=3600

# Ethereal Fake SMTP
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your-user@ethereal.email
ETHEREAL_PASS=your-ethereal-password

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack OAuth 2.0
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_CALLBACK_URL=http://localhost:5000/api/slack/callback

# Security & Secrets
JWT_SECRET=production-grade-jwt-secret-key-32-chars
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

---

## 6. Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Synchronize Database Schema
```bash
# Push schema to PostgreSQL
npm run db:push

# Generate Prisma Client
npm run db:generate

# Seed default test user & sender
npm run db:seed
```

### 3. Start Development Server
```bash
# Starts Express server + integrated BullMQ worker with auto-reload (tsx watch)
npm run dev
```

### 4. (Optional) Run Worker Standalone
In high-throughput or containerized deployments, you can scale workers independently:
```bash
npm run dev:worker
```

### 5. Build & Run for Production
```bash
npm run build
npm run start
```

---

## 7. Testing

The backend includes a comprehensive test suite powered by **Vitest** (15 tests across 5 suites).

### Run Test Suite
```bash
npm run test
```

### Test Coverage Highlights
- **`email-scheduling.test.ts`**: Verifies transactional creation of campaigns, scheduled emails, and BullMQ delayed jobs with attachment forwarding.
- **`rate-limit.test.ts`**: Verifies sliding-window hourly rate limits and minimum delay cooldown enforcement in Redis.
- **`reconciliation.test.ts`**: Verifies that server restarts automatically recover pending emails from PostgreSQL and re-enqueues them without duplication.
- **`slack-integration.test.ts`**: Verifies OAuth token persistence, notification delivery on quota exhaustion, and hourly alert deduplication.
- **`smtp.test.ts`**: Verifies Nodemailer Ethereal SMTP transport initialization, preview URL extraction, and MIME attachment delivery.
#
