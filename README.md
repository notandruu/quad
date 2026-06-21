# Quad

> An AI employee that audits a company's website against its company brain, streams the work live, and turns every gap into an approved fix.

**[quad.stephenhung.me](https://quad.stephenhung.me)** &nbsp;|&nbsp; AI Hackathon, Berkeley 2026.

Quad is not a chatbot. It is a company-aware AI employee with memory, browser-grounded work, live execution logs, quality evaluation, production observability, and a path to natural voice conversation.

## What it does

1. Learns the company from docs, meetings, notes, and website pages (the company brain).
2. Audits the public website with real browser evidence.
3. Streams every action live through Redis, and replays it on refresh.
4. Compares what the company internally knows against what the website explains.
5. Gates out low-quality findings before they reach the user.
6. Turns findings into source-backed fixes, FAQs, tasks, and Slack drafts, with approval first.

## Stack

| Concern | Tool |
| --- | --- |
| App | Next.js 14 (App Router), TypeScript, Tailwind |
| Live event spine | Redis Streams (Upstash REST) |
| Durable company brain | Postgres + pgvector |
| Browser-grounded audits | Browserbase (static fetch fallback) |
| Reasoning + synthesis | Anthropic Claude |
| LLM tracing + evals | Arize Phoenix (OpenTelemetry) |
| Reliability | Sentry |
| Voice | Deepgram push-to-talk, Kyutai Moshi scaffold |

## Architecture

```
src/
  app/
    api/            chat, audit/stream, audit/events/[runId], ingest, sessions, settings
    page.tsx        chat + live logs + findings UI
  components/       ChatBar, UrlChip, LiveLogs, FindingsPanel, FindingCard, ApprovalButtons
  lib/
    types/          core data contracts (brain, employee, tool, audit, voice, runtime)
    redis/          client, keys, events, publisher, replay, counters
    brain/          pgvector schema, embeddings, retrieve, ingest, in-memory store
    tools/          discover, browserbase render, audit worker, action drafts, registry
    runtime/        intent, permissions, quality gates, audit prompts, employee loop
    observability/  Sentry spans, Phoenix tracing, finding evals
    voice/          Moshi voice session scaffold
  data/seed/        demo org (BrightPath) company brain
```

The audit worker (`src/lib/tools/auditAnalyzer.ts`) discovers pages, renders each through Browserbase, analyzes against the brain, evaluates and gates findings, then synthesizes a report. Every step emits a real Redis event and counter, so the live log is never faked.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys; the app degrades gracefully without them
npm run dev
```

With no env keys set, the app still runs: Redis falls back to in-stream events, the brain falls back to the seeded demo org, and Browserbase falls back to static fetch. Wire the keys in `.env.local` to make each layer real.

To enable durable backend state, point `DATABASE_URL` at Postgres and run the platform schema:

```bash
npm run db:migrate:dry
npm run db:migrate
npm run db:status
```

The migration applies `docs/backend/platform-schema.sql`, which creates the brain memory, workflow ledger, quadchain packet, approval, receipt, and connector credential tables with `IF NOT EXISTS` guards. `npm run db:status` checks the required tables and pgvector extension without printing database credentials.

Hosted API routes accept `Authorization: Bearer $QUAD_API_SECRET` or `x-quad-api-key: $QUAD_API_SECRET`. In zero-key mode, org-owned routes only allow the seeded demo org. Set `QUAD_ALLOWED_ORGS` to a comma-separated allowlist before hosting customer data.

`GET /api/security/packet` returns an org-scoped security posture packet: data flows, model routing, storage posture, retention/deletion gaps, connector scopes, redaction guarantees, and warnings. It is protected by the same hosted API guard and never includes raw env secret values.

High-risk mutation routes are protected by org-scoped rate limits and optional `Idempotency-Key` replay. Configure `QUAD_MUTATION_RATE_LIMIT`, `QUAD_MUTATION_RATE_WINDOW_SECONDS`, and `QUAD_IDEMPOTENCY_TTL_SECONDS` for hosted deployments.

`GET /api/security/data` returns the org-scoped retention policy, store-by-store deletion behavior, and safe deletion request examples. Configure global retention with `QUAD_RETENTION_DAYS`, and per-org overrides with `QUAD_ORG_RETENTION_DAYS='{"org_enterprise":7}'`. `POST /api/security/data` supports protected deletion dry-runs and execution receipts for org-scoped or run-scoped data. Execute mode requires the confirmation string returned by the dry-run receipt, such as `delete:demo_org:run_123`.

`/api/connectors/credentials` installs, lists, and revokes connector credentials. Stored credentials are encrypted with `QUAD_CONNECTOR_ENCRYPTION_KEY` and list responses return only metadata, scopes, status, and credential hashes.

`POST /api/verify-fix` runs post-ship verification over staged connector artifacts, emits verification reports, creates executed or blocked receipts, and attaches quadchain `connector_action` packets to the run.

`GET /api/health/backend` reports whether Supabase platform tables, Redis, hosted API auth, credential encryption, the backend worker, Browserbase, voice, Sentry, and Phoenix are configured and reachable. Run `docs/backend/platform-schema.sql` in Supabase before relying on durable runs.

`GET /api/jobs/health` reports worker queue depth, running jobs, retrying jobs, completed jobs, failed jobs, dead-lettered jobs, the latest worker heartbeat, and the latest worker canary receipt. Worker failures retry up to `maxAttempts`, then move to `dead_letter` for operator review.

Hosted run artifacts are addressable after creation: `GET /api/runs/:runId`, `GET /api/runs/:runId/artifacts`, `GET /api/runs/:runId/artifacts/:artifactId`, `GET /api/runs/:runId/tasks`, and `GET /api/runs/:runId/tasks/:taskId`.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run e2e` runs the Playwright browser suite against a production Next server. In CI, GitHub Actions builds once, starts `next start`, and checks the audit workspace, debug drawer, quadchain reveal, quadchain API contract, and SSE audit stream. The older API-only smoke is still available as `npm run e2e:api`.

Railway is linked locally as project/service `quad-fetch-agent` in the `production` environment. Vercel serves the Next.js app at `quad.stephenhung.me`; Railway is ready for the long-running worker/runtime side when that path is split from the web app.

The async backend path is now available:

```bash
npm run worker       # long-running worker loop for Railway
npm run worker:preflight # fail fast when Railway worker env is incomplete
npm run worker:once  # process one queued job locally
npm run canary:worker # run the hosted worker canary and verify jobs health
```

`POST /api/jobs` queues a website audit or enterprise proof run, `GET /api/jobs` lists queued/running/completed jobs, `GET /api/jobs/:jobId` inspects a job, `POST /api/jobs/process` processes one job for cron-style or protected worker calls, and `POST /api/jobs/canary` enqueues, claims, and processes a synthetic worker canary. Redis is used when configured; local demos fall back to in-memory jobs.

Set `QUAD_WORKER_SECRET` for protected worker processing calls. When it is configured, `POST /api/jobs/process` requires the same bearer/api-key auth shape as the rest of the hosted API. Set `QUAD_WORKER_ENABLED=true` on hosted environments that expect a long-running worker; backend readiness will stay degraded until a fresh heartbeat appears. Worker claims use a short Redis-backed lease so duplicate queue ids or multiple worker processes do not execute the same job at once; tune it with `QUAD_WORKER_JOB_LEASE_SECONDS`.

For Vercel plus Railway:

1. Deploy the Next.js app on Vercel with the shared app env.
2. Run the Railway worker service with `npm run worker:preflight && npm run worker`. The checked-in `railway.json` uses this start command.
3. Set `QUAD_WORKER_ENABLED=true`, `QUAD_WORKER_SECRET`, `QUAD_REDIS_REST_URL`, and `QUAD_REDIS_REST_TOKEN` in both hosted environments.
4. Set `QUAD_SERVICE_TOKENS` with a worker token scoped to `worker`, `jobs:read`, `jobs:write`, `observability:read`, and `observability:write`.
5. Optionally point preflight at the hosted web backend:

```bash
QUAD_WORKER_PREFLIGHT_BASE_URL=https://quad.stephenhung.me npm run worker:preflight
```

6. After deploy, run:

```bash
QUAD_CANARY_BASE_URL=https://quad.stephenhung.me npm run canary:worker
```

The canary posts to `/api/jobs/canary`, verifies `/api/jobs/health`, checks that the latest canary receipt matches the job it just created, and fails if the queue has dead-lettered jobs. It never prints the worker secret.

## What is stubbed

The scaffold runs end to end with deterministic placeholders where a model or
external session is needed. Search for `TODO` to find the seams:

- `tools/browserbase.ts` -> real Browserbase render + screenshot
- `tools/auditAnalyzer.ts` -> model-driven page analysis
- `brain/embeddings.ts` -> real embeddings call
- `runtime/runtime.ts` -> model-driven response synthesis
- `voice/moshi.ts` -> Moshi websocket transport

## Demo org

Seeded with **BrightPath**, a youth nonprofit whose internal brain lists three
programs while its website only explains one. That gap drives the headline
audit moment: "Your internal brain says X, but your website only says Y."
