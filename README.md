# Outbox Email Scheduling & Sending Platform

A production-grade, distributed Email Scheduling and Sending Platform inspired by ReachInbox. Designed and built with a scalable micro-architecture utilizing BullMQ delayed jobs, Redis atomic rate limiting, PostgreSQL with Prisma ORM, Elasticsearch search indexing, Ethereal SMTP delivery, Google OAuth 2.0, Slack OAuth alerts, and a modern minimalist light-themed React frontend.

> **Component Documentation:**
> - [📘 **Backend Documentation (API, Queues & Worker)**](backend/README.md)
> - [🎨 **Frontend Documentation (Dashboard UI & Components)**](frontend/README.md)

---

## 1. Project Overview

Outbox provides high-throughput, fault-tolerant email scheduling and dispatching capabilities. Built from the ground up to guarantee:
- **No Cron Jobs:** 100% powered by persistent BullMQ delayed jobs in Redis.
- **Distributed Hourly Rate Limiting:** Atomic Redis Lua sliding-window counter per sender.
- **Enforced Minimum Send Delays:** Shared atomic cooldowns (default 2,000ms) between consecutive sends across multiple workers.
- **Fail-Safe Persistence & Startup Recovery:** Guaranteed restart survival across server, worker, or Redis restarts.
- **Real-Time Observability:** Protected Bull Board dashboard at `/api/admin/queues`.
- **Real External Integrations:** Google OAuth 2.0 PKCE authentication, Slack OAuth 2.0 bot notifications on rate limit exhaustion, and Ethereal SMTP with test preview links.

---

## 2. Key Features

- **Distributed Queue Processing:** BullMQ delayed jobs with deterministic database IDs.
- **Atomic Concurrency Control:** Worker pool (configurable concurrency, default 10) preventing double sends.
- **Automatic Job Rescheduling:** When rate limits are reached, jobs are smoothly postponed to the next hourly window without being dropped or failing.
- **Slack Alerting:** Instant webhook or Web API notifications sent to the user's Slack workspace when a sender reaches their quota (deduplicated per hourly window).
- **Elasticsearch Full-Text Search:** Query recipients, subjects, bodies, and statuses at scale.
- **Client-Side CSV & TXT Parsing:** Instant drag-and-drop file processing with duplicate deduplication and format validation.
- **Bull Board Queue Monitor:** Live inspection of active, delayed, waiting, and failed jobs.

---

## 3. Technology Stack

### Backend
- **Runtime:** Node.js v20+ / v24+ & TypeScript
- **Framework:** Express.js
- **Queue & Scheduling:** BullMQ & Redis (ioredis)
- **Database & ORM:** PostgreSQL 16 & Prisma ORM
- **Search Engine:** Elasticsearch 8.12
- **Email Delivery:** Nodemailer with Ethereal SMTP
- **Monitoring:** Bull Board (`@bull-board/api` & `@bull-board/express`)
- **Authentication:** Google OAuth 2.0 & JWT in secure HTTP-only cookies
- **Integrations:** Slack OAuth 2.0 (`@slack/web-api`)
- **Validation:** Zod

### Frontend
- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Minimalist Light Theme Design System)
- **State & Data Fetching:** TanStack Query v5
- **Routing:** React Router v7
- **Forms:** React Hook Form + Zod resolvers
- **Icons:** Lucide React

### Infrastructure
- Docker & Docker Compose (PostgreSQL, Redis, Elasticsearch)

---

## 4. Architecture Diagram

```
                             +------------------------+
                             |   React + Vite Client  |
                             | (Minimalist Light UI)  |
                             +-----------+------------+
                                         |  HTTPS (Cookies)
                                         v
                             +------------------------+
                             |   Express REST API     |
                             | (Auth, Validate, Rate) |
                             +---+--------+--------+--+
                                 |        |        |
         +-----------------------+        |        +---------------------+
         |                                |                              |
         v                                v                              v
+------------------+             +-----------------+            +-------------------+
|  PostgreSQL 16   |             |   Redis v7.0    |            | Elasticsearch 8.x |
|  (Source of      |             | - BullMQ Queue  |            | - Full-text       |
|   Truth: Prisma) |             | - Lua Limiter   |            |   Email Index     |
+------------------+             | - State Cache   |            +-------------------+
                                 +--------+--------+
                                          |
                                          | Job Pick-up
                                          v
                             +------------------------+
                             | BullMQ Concurrency     |
                             | Worker Pool (N=10)     |
                             +---+----------------+---+
                                 |                |
             Rate Limit Exceeded |                | SMTP Delivery
                                 v                v
                       +--------------+    +---------------+
                       |  Slack OAuth |    | Ethereal SMTP |
                       | Notification |    | Nodemailer    |
                       +--------------+    +---------------+
```

---

## 5. Folder Structure

```text
Outbox/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Normalized database models
│   │   └── seed.ts               # Test user & sender seed
│   ├── src/
│   │   ├── config/               # Env, database, redis, elasticsearch
│   │   ├── controllers/          # Express route controllers
│   │   ├── middleware/           # Auth, errorHandler, validate
│   │   ├── queues/               # BullMQ queue & worker
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Email, scheduler, rate-limit, slack, ES, auth
│   │   ├── integrations/         # SMTP (Ethereal), Google OAuth, Slack OAuth
│   │   ├── utils/                # AES-256 encryption, winston logger
│   │   ├── types/                # Shared TypeScript declarations
│   │   ├── app.ts                # Express app setup & Bull Board
│   │   ├── server.ts             # API server bootstrap & startup recovery
│   │   └── worker.ts             # Dedicated standalone worker entry point
│   ├── tests/                    # Vitest unit & integration tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # Button, Input, Modal, Table, Badge, etc.
│   │   │   ├── layout/           # Sidebar, Header, DashboardLayout, ProtectedRoute
│   │   │   ├── dashboard/        # StatsCards, RecentEmails, QuickActions
│   │   │   ├── emails/           # ScheduledEmailsTable, SentEmailsTable
│   │   │   └── modals/           # ComposeEmailModal, ConfirmModal
│   │   ├── pages/                # Login, Dashboard, Scheduled, Sent, Settings
│   │   ├── hooks/                # TanStack queries & mutations
│   │   ├── services/             # API client calls
│   │   ├── context/              # AuthContext
│   │   ├── utils/                # CSV parser, date formatters, cn
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/                    # Vitest frontend tests
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docker-compose.yml            # PostgreSQL, Redis, Elasticsearch
├── package.json
└── README.md
```

---

## 6. Prerequisites

- **Node.js**: v20+ or v24+
- **Docker & Docker Compose**: For containerized databases and queue storage
- **npm**: v10+

---

## 7. Installation Instructions

Clone the repository and install root and package dependencies:

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Install frontend dependencies
cd ../frontend
npm install
```

---

## 8. Docker Setup

Spin up the containerized infrastructure (PostgreSQL, Redis, and Elasticsearch):

```bash
# From the project root
docker-compose up -d
```

Verify all three containers are healthy:
```bash
docker ps
```

---

## 9. PostgreSQL Configuration

The PostgreSQL instance runs on port `5432` with database name `outbox`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/outbox
```

---

## 10. Redis Configuration

Redis runs on port `6379` with Append-Only File (AOF) persistence enabled:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 11. Elasticsearch Configuration

Elasticsearch runs on port `9200`:
```env
ELASTICSEARCH_URL=http://localhost:9200
```
Mappings for the `emails` index are auto-created on application bootstrap.

---

## 12. Ethereal Email Account Setup

Ethereal is a fake SMTP service that captures emails for testing without delivering to real inboxes.
1. Visit https://ethereal.email/create
2. Copy the generated Username and Password into `backend/.env`:
```env
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your_user@ethereal.email
ETHEREAL_PASS=your_password
```
Every sent email logs an interactive test preview URL accessible via the frontend and Ethereal mailbox.

---

## 13. Google OAuth 2.0 Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web Application).
3. Set **Authorized redirect URIs** to:
   `http://localhost:5000/api/auth/google/callback`
4. Set credentials in `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

---

## 14. Slack OAuth 2.0 Setup

1. Create an app at https://api.slack.com/apps.
2. In **OAuth & Permissions**, add the following Bot Scopes:
   - `chat:write`
   - `channels:read`
3. Set **Redirect URLs** to:
   `http://localhost:5000/api/slack/callback`
4. Copy Client ID and Secret to `backend/.env`:
```env
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_CALLBACK_URL=http://localhost:5000/api/slack/callback
```

---

## 15. Environment Variables Reference

Copy `.env.example` in `backend/` and `frontend/`:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Key security parameters:
- `ENCRYPTION_KEY`: A 32-byte hex string (64 hex characters) used for AES-256-GCM encryption of SMTP passwords and Slack access tokens.
- `JWT_SECRET`: A secure signing string for user session tokens.

---

## 16. Database Migrations & Seeding

Run Prisma schema migrations and seed initial records:

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Push schema to PostgreSQL
npx prisma db push

# Seed sample user & test sender account
npm run db:seed
```

---

## 17. Starting the Backend API

Start the Express API server:

```bash
cd backend
npm run dev
```
The server will start at `http://localhost:5000`.

---

## 18. Starting the BullMQ Worker Process

The BullMQ email worker can run embedded inside the API process or as an independent, scalable standalone worker process:

```bash
cd backend
npm run dev:worker
```

---

## 19. Starting the Frontend UI

Start the Vite development server:

```bash
cd frontend
npm run dev
```
The application will be accessible at `http://localhost:5173`.

---

## 20. API Documentation

### Authentication
- `GET  /api/auth/google` - Initiate Google OAuth flow
- `GET  /api/auth/google/callback` - OAuth callback handler & JWT cookie issuance
- `GET  /api/auth/me` - Authenticated user profile
- `POST /api/auth/logout` - Clear session cookie

### Email Scheduling
- `POST /api/emails/schedule` - Schedule campaign and recipient batch
- `GET  /api/emails/scheduled` - Paginated scheduled queue items with filters
- `GET  /api/emails/sent` - Paginated sent and failed history
- `GET  /api/emails/:id` - Detailed email record
- `POST /api/emails/:id/cancel` - Cancel delayed BullMQ job

### Campaigns
- `GET  /api/campaigns` - List user campaigns with metrics
- `GET  /api/campaigns/:id` - Single campaign details

### Slack Integration
- `GET  /api/slack/connect` - Initiate Slack OAuth
- `GET  /api/slack/callback` - Slack OAuth redirect callback
- `GET  /api/slack/status` - Workspace connection status
- `POST /api/slack/disconnect` - Revoke token and remove integration

### Search & Health
- `GET  /api/search/emails?q=...` - Full-text Elasticsearch search
- `GET  /api/health` - Health check (DB, Redis, Elasticsearch status)
- `GET  /api/admin/queues` - Bull Board dashboard

---

## 21. Bull Board Live Monitoring

Access the protected Bull Board queue interface:
`http://localhost:5000/api/admin/queues`
Inspect waiting, active, delayed, completed, and failed jobs.

---

## 22. Distributed Hourly Rate-Limiting Algorithm

Rate limits are enforced before initiating SMTP delivery using an atomic Redis Lua script:
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  return {0, current, tonumber(redis.call('TTL', key))}
end
local newCount = redis.call('INCR', key)
if newCount == 1 then
  redis.call('EXPIRE', key, windowSec)
end
return {1, newCount, tonumber(redis.call('TTL', key))}
```
- **Trade-offs:** Sliding-window per hour provides high throughput while preventing quota bursts across all worker instances.
- **Rescheduling:** If the limit is reached, jobs are moved to the next available window (`resetAt`) without exhausting BullMQ attempts.

---

## 23. Concurrency Configuration

Configured via `EMAIL_WORKER_CONCURRENCY`:
```env
EMAIL_WORKER_CONCURRENCY=10
```
Workers utilize atomic database transitions:
```sql
UPDATE "ScheduledEmail"
SET "status" = 'processing'
WHERE "id" = :id AND "status" IN ('scheduled', 'retrying')
```
If two workers attempt to process the same job, exactly one acquires the record.

---

## 24. Minimum Send Delay

Configured via `MIN_EMAIL_DELAY_MS` (default 2,000ms). Enforced using Redis PXAT cooldown timestamps, ensuring that even under high concurrency, consecutive emails for the same sender maintain the mandatory interval.

---

## 25. Persistence & Restart Recovery

- **Redis AOF:** Redis retains all delayed and waiting jobs across server reboots.
- **PostgreSQL Source of Truth:** All email and campaign statuses reside in PostgreSQL.
- **Startup Reconciliation (`reconcileOnStartup`):** Identifies scheduled emails without active BullMQ jobs and recreates them with deterministic IDs (`email-${emailId}`) and accurate delays without resetting original timestamps.

---

## 26. Idempotency Strategy & SMTP Limitations

SMTP does not natively support end-to-end idempotent delivery keys. To ensure **effectively-once** delivery:
1. Deterministic job IDs (`email-${email.id}`) in BullMQ prevent duplicate job addition.
2. Unique database constraint on `idempotencyKey` prevents duplicate campaign scheduling requests.
3. Atomic DB updates ensure only one worker delivers a given email.

---

## 27. Elasticsearch Indexing Strategy

- PostgreSQL is the authoritative system of record.
- Elasticsearch receives updates asynchronously upon scheduling and completion.
- Indexing failures are caught and logged without failing successful SMTP deliveries.

---

## 28. Testing Instructions

Run backend unit and integration test suites:
```bash
cd backend
npm test
```

Run frontend test suites:
```bash
cd frontend
npm test
```

---

## 29. Load Handling (1,000+ Emails)

- Tested with batches of 1,000+ recipients.
- Distributed across BullMQ delayed jobs with calculated offsets (`startTime + index * delay`).
- Controlled concurrency and minimum delays ensure smooth delivery without server degradation.

---

## 30. Known Limitations

- **Ethereal Previews:** Ethereal is intended for staging and testing; for production, replace SMTP credentials with AWS SES, SendGrid, or Google Workspace SMTP.
- **OAuth Credentials:** Valid Google Cloud and Slack Developer credentials are required for live OAuth exchanges.
#   o u t b o x  
 