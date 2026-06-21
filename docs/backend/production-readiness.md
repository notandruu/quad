# Backend production readiness

Last updated: 2026-06-21

Quad can run with zero keys for demos, but the production backend is only green when the durable stores, worker runtime, auth guardrails, and observability are all live.

## What exists now

- Next.js API routes for audits, chat, voice transcription, agent runs, workflow runs, approvals, trust packets, quadchain packets, jobs, security, and backend health.
- Public agent discovery at `GET /api/agent/describe`, with no secret values or raw tenant data.
- Voice transcription writes verified company memory by default, with `voice_transcript` and `brain_memory_write` quadchain packet summaries returned to the caller.
- Chat retrieval returns verified memory packet summaries when available, and `chat_answer` receipts record the memory receipt ids used to ground the answer.
- Post-audit chat loads audit reports from Redis or durable run artifacts, returns audit/finding packet summaries as verified context, and keeps org boundaries enforced.
- Redis-backed job queue with memory fallback.
- Long-running worker command for Railway: `npm run worker`.
- Worker canary route: `POST /api/jobs/canary`.
- Queue/runtime health route: `GET /api/jobs/health`.
- Backend readiness route: `GET /api/health/backend`.
- Retention and deletion policy route: `GET /api/security/data`.
- Retention sweep route: `POST /api/security/retention/sweep`. Dry-run returns expired run candidates and deletion receipts; execute requires a sweep confirmation string.
- Observability readiness validates telemetry safety: raw prompt, response, or payload logging flags are blockers, and Phoenix collector endpoints must use HTTPS.
- Supabase-backed workflow ledger and quadchain packet registry, with Redis/memory fallback.
- Normalized task stream events in run snapshots for run lifecycle changes, tasks, artifacts, approvals, decisions, and receipts. The hosted run detail and task endpoints expose the same stream for dashboard, external agents, workers, and future CLI or Slack surfaces.
- Hosted run, task, and artifact reads are org-scoped. Tokens scoped to another org receive `404` for run detail routes so run ids do not become an existence oracle.
- Raw artifact data is opt-in and requires admin secret auth; service tokens only receive redacted previews.
- Metaregistry capability policy for runtime tool exposure. `QUAD_CAPABILITY_ALLOWLIST`, `QUAD_CAPABILITY_DISABLED`, and `QUAD_CAPABILITY_FORCE_INSTALLED` control which capabilities an org can route to; write-capable tools require explicit allowlisting unless `QUAD_REQUIRE_WRITE_CAPABILITY_ALLOWLIST=false`.
- Safe metaregistry install planning at `GET /api/metaregistry/install-plan`. The route is read-only and returns planned allowlist/force-install changes plus missing env key names for the enterprise proof starter bundle.
- Approval-backed metaregistry install requests at `POST /api/metaregistry/install-request`. The route creates a `capability_install` run with approval artifacts, task events, receipts, and a quadchain packet instead of mutating connector secrets directly.
- Connector credential install/revoke mutations emit restricted quadchain `connector_action` packet summaries while omitting encrypted credential bytes and plaintext secrets.
- Platform schema SQL in `docs/backend/platform-schema.sql`.

## Production gates

Run these before claiming the hosted backend is ready:

```bash
npm run check
npm run db:status
QUAD_SMOKE_BASE_URL=https://quad.example.com npm run smoke:prod
```

For the full browser gate, run:

```bash
npm run check:full
```

GitHub Actions is manual-only during the hackathon push. Trigger `ci` from the Actions tab; leave `run_e2e` off for a fast typecheck/test/build run, or turn it on when you need Playwright proof before a demo/deploy.

`npm run smoke:prod` checks:

- unauthenticated worker canary calls are blocked when worker auth is configured.
- authenticated worker canary completes.
- jobs health reports the latest canary receipt.
- backend readiness exposes component status for Supabase, Redis, worker, auth, service tokens, encryption, observability, voice, and Browserbase.
- retention policy is readable through the authenticated security route.

Manual observability booth check:

```bash
curl -sS \
  -H "Authorization: Bearer $QUAD_API_SECRET" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"orgId":"org_brightpath","runId":"demo-observability"}' \
  "$QUAD_SMOKE_BASE_URL/api/observability/probe"
```

This emits a safe Sentry info event and Phoenix span when those sinks are configured. The response includes probe ids, labels, and booleans only; it does not include DSNs, API keys, or raw org ids.

Required environment:

- `QUAD_SMOKE_BASE_URL`
- `QUAD_API_SECRET`
- `QUAD_WORKER_SECRET`
- `QUAD_SMOKE_ORG_ID` if testing a non-demo org.

The smoke script prints whether auth is configured, but never prints secrets.

## Service tokens

`QUAD_API_SECRET` remains the all-access admin secret for demos and operator use. Production services can use scoped tokens through `QUAD_SERVICE_TOKENS`:

```json
[
  {
    "label": "railway-worker",
    "token": "replace-with-random-token",
    "orgs": ["org_brightpath"],
    "scopes": ["worker", "jobs:read", "jobs:write"]
  },
  {
    "label": "readonly-ops",
    "token": "replace-with-random-token",
    "orgs": ["org_brightpath"],
    "scopes": ["jobs:read"]
  }
]
```

Current route scopes:

- `worker`: process jobs, run worker canaries, and read worker health.
- `jobs:read`: list or read queued jobs.
- `jobs:write`: enqueue jobs.
- `observability:read`: read redacted observability configuration state.
- `observability:write`: emit safe Sentry/Phoenix probe receipts.

If a request uses `QUAD_API_SECRET`, it is treated as admin and bypasses per-route scopes. If it uses a service token, both org and scope must match.
Backend readiness and security packets only expose token labels, scopes, counts, and org-scoped status. Raw token values are never returned.

## Current blockers to a fully green backend

1. Apply the platform schema in Supabase.

   The backend readiness route expects these tables:

   - `brain_memory`
   - `workflow_run_snapshots`
   - `workflow_runs`
   - `workflow_tasks`
   - `workflow_artifacts`
   - `workflow_approvals`
   - `workflow_receipts`
   - `quadchain_packets`
   - `connector_credentials`

   If `npm run db:status` fails with DNS or connection errors, use the Supabase SQL editor to run `docs/backend/platform-schema.sql`, or replace `DATABASE_URL` with the correct Supabase direct or pooler connection string.

2. Run the worker on Railway.

   The web app can enqueue jobs, but production readiness remains degraded until a long-running worker is heartbeating against the same Redis instance.

   Railway command:

   ```bash
   npm run worker:preflight && npm run worker
   ```

   Required Railway env must match Vercel:

   - `QUAD_REDIS_REST_URL`
   - `QUAD_REDIS_REST_TOKEN`
   - `QUAD_WORKER_SECRET`
   - `QUAD_API_SECRET` or a service token that can call protected web routes
   - `QUAD_SERVICE_TOKENS` with `worker`, `jobs:read`, `jobs:write`, `observability:read`, and `observability:write` scopes
   - model/provider keys used by audit and agent jobs
   - Supabase env if the worker persists run state

   The checked-in `railway.json` starts the worker with the preflight first:

   ```bash
   npm run worker:preflight && npm run worker
   ```

   Optional hosted health preflight:

   ```bash
   QUAD_WORKER_PREFLIGHT_BASE_URL=https://quad.stephenhung.me npm run worker:preflight
   ```

   The preflight checks required worker env, validates scoped service token shape, warns when model/observability/browser/voice env is missing, and verifies that the hosted web backend can see Redis when `QUAD_WORKER_PREFLIGHT_BASE_URL` is set.

3. Configure observability.

   Sentry and Phoenix are part of the sponsor-visible proof. Backend readiness is not fully production-ready until both are configured:

   - `SENTRY_DSN`
   - `PHOENIX_COLLECTOR_ENDPOINT`

4. Keep customer writes behind approvals.

   Backend routes may stage draft artifacts, but customer-facing mutation paths must keep using approval checks and quadchain receipts. Real connector writes should stay blocked until a run has an approved trust packet and a verification receipt.
   Dry-run publishing also respects metaregistry policy: write-capable connector capabilities such as `cms.publisher` and `task.publisher` must be configured and explicitly allowlisted before staging artifacts.
   Route-level tests assert that `/api/publish/dry-run` returns `capability_blocked` and records blocked task events when those connector capabilities are not active.

5. Keep unsafe telemetry disabled.

   Backend readiness and the security packet treat these flags as blockers:

   - `QUAD_TELEMETRY_LOG_RAW_PAYLOADS`
   - `QUAD_TELEMETRY_LOG_RAW_PROMPTS`
   - `QUAD_TELEMETRY_LOG_RAW_RESPONSES`

   Phoenix collector endpoints must use HTTPS before traces leave the runtime.

6. Upgrade auth before enterprise use.

   `QUAD_API_SECRET` plus `QUAD_SERVICE_TOKENS` is enough for hackathon-hosted protected routes and service-to-service separation. Enterprise use still needs real org membership, rbac, audit logs for access, token rotation, and scoped user sessions.

## Backend ownership map

- external agent descriptor: `src/lib/agent/describe.ts` and `src/app/api/agent/describe/route.ts`
- durable workflow ledger: `src/lib/runs`
- normalized task stream: `src/lib/runs`
- worker queue and canary: `src/lib/jobs`
- worker runtime command: `scripts/worker.ts`
- worker preflight: `scripts/worker-preflight.mjs`
- Railway worker config: `railway.json`
- quadchain packet registry: `src/lib/quad-chain/registry.ts`
- metaregistry runtime gate: `src/lib/metaregistry`
- backend readiness: `src/lib/backend/readiness.ts`
- security and retention: `src/lib/security`
- retention sweep route: `src/app/api/security/retention/sweep/route.ts`
- platform schema: `docs/backend/platform-schema.sql`
- production smoke: `scripts/prod-smoke.mjs`

## Demo-safe claim

The accurate claim right now is:

> Quad has a production-shaped backend with durable schema support, protected worker APIs, Redis queueing, quadchain receipts, retention controls, and a repeatable production smoke test. The remaining production blockers are applying the Supabase schema, running the Railway worker continuously, and turning on Sentry/Phoenix observability.
