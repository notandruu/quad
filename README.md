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

The migration applies `docs/backend/platform-schema.sql`, which creates the org/workspace boundary, brain memory, workflow ledger, quadchain packet, approval, receipt, and connector credential tables with `IF NOT EXISTS` guards. `npm run db:status` checks the required tables and pgvector extension without printing database credentials.

Hosted API routes accept `Authorization: Bearer $QUAD_API_SECRET` or `x-quad-api-key: $QUAD_API_SECRET`. In zero-key mode, org-owned routes only allow the seeded demo org. Set `QUAD_ALLOWED_ORGS` to a comma-separated allowlist before hosting customer data.

`GET /api/security/packet` returns an org-scoped security posture packet: data flows, model routing, storage posture, retention/deletion gaps, connector scopes, redaction guarantees, and warnings. It is protected by the same hosted API guard and never includes raw env secret values.

The security packet also includes a `registryBoundary` policy. It states that v1 uses local receipts only, blockchain anchoring is optional future work, and public anchors can contain only packet ids, certificate ids, hashes, Merkle roots, verifier versions, and handoff ids. Raw context, evidence quotes, audio bytes, screenshots, prompts, responses, credentials, and customer documents stay off-chain and out of public registries.

`GET /api/orgs?orgId=...` returns the authorized organization, default workspace, requester role, and tenant boundary summary for the current org. Zero-key demo mode returns only the seeded demo org; hosted mode requires the existing API secret or a service token with `orgs:read`.

Public summary routes are covered by secret-leak tests. `src/lib/security/publicPayload.ts` scans nested response payloads against configured secret env values, and the settings, sponsor-proof, and public agent descriptor routes prove they expose statuses and env key names without returning API keys, DSNs, service tokens, connector secrets, or database credentials.

High-risk mutation routes are protected by org-scoped rate limits and optional `Idempotency-Key` replay. Configure `QUAD_MUTATION_RATE_LIMIT`, `QUAD_MUTATION_RATE_WINDOW_SECONDS`, and `QUAD_IDEMPOTENCY_TTL_SECONDS` for hosted deployments.

`GET /api/security/data` returns the org-scoped retention policy, store-by-store deletion behavior, and safe deletion request examples. Configure global retention with `QUAD_RETENTION_DAYS`, and per-org overrides with `QUAD_ORG_RETENTION_DAYS='{"org_enterprise":7}'`. `POST /api/security/data` supports protected deletion dry-runs and execution receipts for org-scoped or run-scoped data. Execute mode requires the confirmation string returned by the dry-run receipt, such as `delete:demo_org:run_123`.

`/api/connectors/credentials` installs, lists, and revokes connector credentials. Stored credentials are encrypted with `QUAD_CONNECTOR_ENCRYPTION_KEY` and list responses return only metadata, scopes, status, credential hashes, and restricted quadchain packet summaries.

`GET /api/metaregistry/install-plan` returns a dry-run capability install plan for the enterprise proof starter bundle. It reports allowlist changes, force-installed tools, missing env key names, blockers, and active-after-install tools without mutating connector state or exposing secret values.

`POST /api/metaregistry/install-request` turns that dry-run plan into an approval-backed run ledger entry. It creates a capability-install workflow, an approval artifact, task stream events, and a receipt, but still does not install secrets or enable write tools without operator review.

`GET /api/metaregistry/runtime-tools?intent=website_audit&surface=fetch_agent` returns the runtime tool routing plan for a specific intent and surface: required capability ids, eager hot tools, deferred cold or approval-gated tools, blocked capabilities, and the active org policy. The shared core runtime uses the same plan before building agent-loop traces, so dashboard, voice, fetch, worker, and future cli surfaces do not duplicate tool selection logic.

`POST /api/publish/dry-run` stages approved connector artifacts only when the metaregistry says the target connector is active for the org. `cms.publisher` and `task.publisher` must be configured, force-installed if disabled by default, and explicitly allowlisted because they are write-capable tools. Blocked connector attempts create blocked task stream events instead of ready artifacts. Successful dry runs create `quad.connector_draft.v1` payloads with target metadata, action type, approval requirement, proof binding, and validation checks.

`POST /api/publish/execute` consumes those approved staged drafts and records `quad.connector_execution.v1` artifacts with executed receipts, rollback plans, post-execution verifier requirements, and quadchain `connector_action` packets. CMS executions also create `quad.browser_action.v1` artifacts that bind the Browserbase-style controlled selector, hash-only field values, before/after browser evidence summaries, and a no-submit pause state. v1 execution records the approved customer-write and browser-action proof in quad's ledger; live third-party CMS/task adapters remain connector-specific follow-on work.

`POST /api/verify-fix` runs post-ship verification over staged, executed, and browser-action artifacts, emits verification reports, creates executed or blocked receipts, and attaches quadchain `connector_action` packets to the run.

`GET /api/health/backend` reports whether Supabase platform tables, Redis, hosted API auth, credential encryption, the backend worker, Browserbase, voice, Sentry, and Phoenix are configured and reachable. The required table set includes `quad_orgs`, `quad_workspaces`, and `quad_workspace_memberships`, so production readiness does not ignore tenant-boundary storage. Run `docs/backend/platform-schema.sql` in Supabase before relying on durable runs.

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

`POST /api/core/run` is the shared runtime facade for surfaces. It currently supports `chat` and `queue_audit` commands, returns quadchain receipts, runtime trace receipts, and a visible `agentLoop` trace, and is the path `/api/chat`, `/api/agent/run`, and voice follow-up answers use internally. Future CLI and IDE surfaces should call this contract instead of duplicating route-specific orchestration.

Core runtime responses include a compact plan, tool-dispatch, observation, and final step trace. The trace shows selected tools, blocked capabilities, turn budget usage, and an `agent_handoff` quadchain receipt without exposing hidden chain-of-thought. The dashboard renders that trace under chat and voice answers.

For hosted monitors or cron, call `POST /api/jobs/canary?scheduled=1&minIntervalSeconds=300` or the Vercel Cron friendly `GET /api/cron/worker-canary`. Scheduled mode skips safely when a fresh canary receipt already exists and returns `scheduled`, `skipped`, `reason`, and `nextAllowedAt` for uptime tooling. The checked-in `vercel.json` runs `/api/cron/worker-canary` every five minutes; set `CRON_SECRET` in Vercel so scheduled calls arrive with `Authorization: Bearer $CRON_SECRET`.

Set `QUAD_WORKER_SECRET` for protected worker processing calls. When it is configured, `POST /api/jobs/process` requires the same bearer/api-key auth shape as the rest of the hosted API. Set `QUAD_WORKER_ENABLED=true` on hosted environments that expect a long-running worker; backend readiness will stay degraded until a fresh heartbeat appears. Worker claims use a short Redis-backed lease so duplicate queue ids or multiple worker processes do not execute the same job at once; tune it with `QUAD_WORKER_JOB_LEASE_SECONDS`.

`GET /api/agent/describe` exposes Quad as a public external-agent card for Fetch.ai/Agentverse-style discovery. The descriptor includes workflows, endpoints, protocol readiness, keywords, sponsor alignment, and quadchain receipt guarantees, but deliberately omits raw env keys, secrets, and tenant data. External agent surfaces should call `POST /api/agent/run` after discovery; that route now delegates to `/api/core/run` so Fetch-style agents and dashboard flows share the same queued runtime contract and agent loop trace.

`POST /api/voice/transcribe` uses Deepgram when configured, emits a `voice_transcript` packet, and writes the transcript into the company brain as verified meeting memory by default. It also sends non-empty transcripts through the shared core chat runtime with `surface: "voice"`, returning an assistant answer, `chat_answer` packet, and verified context in the same response. Pass `remember=false` in the multipart form for one-off voice commands that should not become durable context. The dashboard voice button forwards the active `orgId` and `runId`, so spoken facts and spoken commands land in the same trust trail as the visible audit.

`POST /api/voice/interview` returns the next buyer-readiness question for voice mode. The dashboard uses it to prompt the operator for trust proof, compliance claims, customer fit, approved execution workflows, and differentiated claims before saving the spoken answer as verified memory.

Chat answers also carry trust context. `/api/chat` emits a `chat_answer` packet and returns `verifiedContext` summaries for any retrieved memories that already have `brain_memory_write` receipts, so the dashboard can show when an answer used verified memory instead of free-floating text.

Brain memory is scoped before retrieval. `/api/ingest` defaults to an approval-backed memory proposal and accepts `visibility`, `userId`, `teamId`, and `teamIds`; retrieval only returns company-readable memory unless the caller supplies matching team context or explicit personal context. Memory writes also carry sidecar metadata for owner, validation status, source freshness, stale-after, and related source ids without changing the frozen memory contract.

`GET /api/brain/graph?orgId=...` returns the scoped context graph that other surfaces should build on: readable company/team/personal memory nodes, freshness and validation state, relationship edges, evidence counts, and latest `brain_memory_write` quadchain receipt ids. The graph is intentionally safe by default; it summarizes memory and proof state without returning raw memory content, evidence quotes, prompts, credentials, or packet source bodies.

`POST /api/context/capture` is the event-driven context capture pipeline. It accepts normalized events from meetings, voice, chat, docs, or future connectors, separates durable company signals from noise, emits safe summaries, and can stage approval-backed memory proposals with `proposeWrites: true`. Captured context does not write directly into the shared brain; it follows the same approval and quadchain receipt path as other memory writes.

`POST /api/enterprise-proof` runs the security-questionnaire trust loop over brain memory plus connector documents. It is protected by the same hosted auth, mutation rate-limit, and idempotency replay path as the other write routes, while zero-key demo fallback remains available for the seeded enterprise-proof org.

Enterprise-proof learned facts are written with explicit target scope. Company scope is the default; team scope requires a team id, and personal scope requires an owner user id. Ambiguous scoped writeback escalates to human review instead of creating memory.

The main chat surface detects security-questionnaire and trust-question prompts and runs the enterprise-proof loop directly. The response shows whether quad learned a company memory, reused verified memory, or needs human evidence before writing anything.

`GET /api/operator` exposes the current workspace boundary plus the memory trail and context graph summary for the dashboard: latest readable memories, freshness counts, company/team/personal scope counts, relationship edges, and confidence/evidence metadata. The operator console renders this so stale or narrowly scoped context is visible before agents rely on it.

`POST /api/brain/refresh` turns stale context into an approval-backed memory refresh proposal. It preserves the original scope, evidence, freshness metadata, and relationship trail, and the refreshed memory is not retrievable until the proposal is approved.

Evidence artifacts are now summarized through a shared evidence bundle layer. Screenshots, Deepgram voice uploads, and trust packet exports get tenant-scoped hashes, storage mode, classification, retention, source refs, and metadata keys. `/api/operator` returns evidence counts and latest safe summaries without exposing raw audio, markdown, or inline screenshot data.

The operator console also shows worker uptime from the same backend health surface: latest canary age, canary duration, heartbeat state, queue depth, retrying jobs, dead-letter count, processed count, and latest job age.

`/api/operator` also includes an internal usage meter derived from receipts, not raw payloads: runs, approvals, artifacts, connector actions, quadchain packets, evidence bytes, model calls, token counts, runtime traces, and estimated cost when metering rates are configured.

Audit and enterprise-proof progress events use the shared Redis event spine. Hosted runs write org-scoped stream, counter, and run-meta keys; zero-key local mode keeps bounded in-memory replay so live-log restoration and tests still work without Upstash.

`GET /api/sponsor/proof` returns a booth-safe sponsor proof manifest: live/fallback/planned status, product claim, demo moment, route or surface, and explicit `safeToClaim` / `doNotClaim` lists. It never returns secret values.

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
