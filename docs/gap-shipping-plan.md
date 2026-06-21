# Gap shipping plan

Last updated: 2026-06-21

## Product state

Quad currently ships the core loop:

1. ingest company context into the brain.
2. audit a public surface against that brain.
3. stream work live.
4. emit quadchain packets for provenance and verification.
5. turn findings into a trust packet.
6. create an approval request and receipt.
7. expose the workflow through dashboard, quadchain, and agent routes.

The remaining work is not about inventing a new product. It is about making the loop durable, governable, and capable of staging approved work.

## Gap 1: durable approval ledger

Status: shipped v1.

What was missing:

- workflow runs, approvals, artifacts, and receipts were process-memory only.
- deploys could erase approval state.
- operator console and publisher workbench had no durable source of truth.

Shipped v1:

- `workflow_run_snapshots` table in `src/lib/brain/schema.sql`.
- `saveRunSnapshot`, `loadRunSnapshot`, and `listRunSnapshots` in `src/lib/runs`.
- trust packet builder persists runs after creating approval receipts.
- agent bridge persists success and failure snapshots.
- `/api/runs` lists recent runs and pending approvals.
- memory fallback stays active for zero-key demos and ci.

Shipped v2:

- `POST /api/approvals/[approvalId]/decision` records approve/reject decisions.
- approval decisions emit `approval` quadchain packets.
- operator console can approve or reject pending packets.

Next:

- add row-level tenant checks before exposing raw artifacts.
- split snapshot storage into normalized tables once query needs exceed v1.

## Gap 2: operator console

Status: shipped v1.

Shipped v1:

- dashboard operator panel for recent runs, pending approvals, staged artifacts, active capabilities, connector credentials, security posture, and ship trail.
- reads from `/api/operator`.
- shows artifact summaries by default, with run/artifact links for hosted drilldown.
- includes proof/preview artifact sidecar controls.

Acceptance:

- user can see pending trust packets without opening logs.
- user can identify blocked connectors/env.
- user can click from a run to `/quadchain?runId=...`.

Next:

- add packet visibility filtering to hosted drilldowns.
- show sponsor badges only when the underlying capability is live.

## Gap 3: dry-run publisher workbench

Status: shipped v1.

Shipped v1:

- `POST /api/publish/dry-run` consumes an approved trust packet run.
- unapproved runs are blocked through `assertCustomerWriteAllowed`.
- generates staged CMS copy, task draft, and trust packet export artifacts.
- emits `connector_action` quadchain packets for every staged draft.
- operator console can stage approved fixes and show dry-run artifacts in the sidecar.

Next:

- show richer diffs in the operator console.
- add connector-specific fixture payloads for CMS, tasks, and browser write actions.
- never perform customer-facing writes without `assertCustomerWriteAllowed`.

Acceptance:

- unapproved run returns a blocked receipt.
- approved run can produce staged CMS/task artifacts.
- every staged action has a packet summary.

## Gap 4: post-ship verification

Status: shipped v1.

Shipped v1:

- `POST /api/verify-fix` verifies staged connector artifacts.
- verification emits a `verification_report` artifact.
- passed verification creates executed receipts and connector action packets.
- operator console can trigger verification after staging a fix.
- Playwright covers approve -> stage -> verify from the dashboard.

Acceptance:

- fix is not marked done just because a draft exists.
- verification includes page evidence, packet summary, and final receipt state.

Next:

- compare live before/after browser evidence for real customer writes.
- support per-finding verification targets.

## Gap 4.5: backend worker runtime

Status: shipped v1.

Shipped v1:

- `npm run worker` runs the long-lived backend worker loop for Railway.
- `npm run worker:once` processes one queued job locally.
- worker records runtime heartbeats with worker id, start time, last heartbeat, and processed count.
- `GET /api/jobs/health` reports queue health and worker runtime liveness.
- `GET /api/health/backend` marks production readiness degraded until a fresh worker heartbeat exists when workers are expected.

Shipped v2:

- worker claims attach lease metadata to running jobs.
- hosted workers use a Redis-backed `nx` lease before changing a job to `running`.
- leases release on retry, dead letter, completion, or deletion.
- `QUAD_WORKER_JOB_LEASE_SECONDS` tunes the duplicate-execution guard.

Shipped v3:

- `canary` job type exercises queue storage, claim lease, and worker processing without browser/model work.
- `POST /api/jobs/canary` runs the synthetic canary through the protected worker API surface.
- `GET /api/jobs/health`, `GET /api/health/backend`, and `/api/operator` expose the latest canary receipt.
- operator console shows a compact backend status derived from worker runtime and canary state.

Shipped v4:

- `npm run canary:worker` runs the worker canary against a local or hosted base URL.
- the script verifies both `/api/jobs/canary` and `/api/jobs/health`.
- the health check fails on stale canary receipts, failed canaries, or dead-lettered jobs.
- the README documents the Vercel app plus Railway worker deployment path.

Next:

- run the canary from a scheduled monitor after deploy.
- add an uptime dashboard or Railway cron that calls the same canary script.

## Gap 5: voice-led enterprise proof interview

Status: partial.

What exists:

- Deepgram configuration.
- voice transcription route.
- voice transcript quadchain packets.
- dashboard voice entrypoint.

Build:

- voice mode asks buyer-readiness questions.
- answers become brain memory writes.
- transcript, memory write, and chat answer all emit quadchain packets.
- next audit compares website against newly captured voice context.

Acceptance:

- user can speak company facts into quad.
- quad writes verified memory.
- audit finds website gaps based on the voice interview.

## Gap 6: sponsor proof

Status: partial.

Build:

- Arize: save a booth-ready trace and evaluator screenshot for audit, chat, and trust packet generation.
- Sentry: add a demo reliability view showing errors/logs/traces without secrets.
- Browserbase: ensure screenshot evidence path is visible in finding cards.
- Redis: show stream replay/counter status in debug/operator console.
- Fetch.ai: add `/api/agent/describe` and sample Agentverse payload.
- Deepgram: make voice essential through the proof interview flow.

Acceptance:

- each sponsor claim maps to a visible product moment and a real route/integration.
- slide/deck claims only mention integrations that are live.

## Gap 7: security and governance

Status: partial.

Shipped v1:

- hosted artifact list and detail payloads use preview data by default.
- preview data recursively redacts sensitive keys such as secret, token, credential, password, private, and internal.
- preview data summarizes raw-ish fields such as evidence, source, content, findings, transcripts, memory, output, raw, and quotes instead of copying their text.
- raw artifact detail access is opt-in with `?raw=1` and requires hosted secret auth.
- unauthenticated or demo-fallback artifact links remain booth-safe and shareable.

Shipped v2:

- quadchain packet detail uses redacted packet views by default.
- raw packet access is opt-in with `?raw=1` and requires hosted secret auth.
- non-public packet detail and packet verification require org-scoped route auth.
- packet lists are scoped to an authorized org instead of anonymously enumerating all org packet metadata.

Shipped v3:

- `GET /api/security/data` returns the current retention policy and deletion examples.
- the security packet embeds store-by-store retention policy for workflow runs, quadchain packets, jobs, brain memories, audit events, connector credentials, and external providers.
- retention policy warns when durable retention is missing, redis ttl is missing, or redis ttl exceeds the configured retention window.
- `QUAD_ORG_RETENTION_DAYS` supports per-org retention overrides on top of global `QUAD_RETENTION_DAYS`.

Build:

- enforce org-scoped access on durable run reads.
- document what stays off-chain/off-registry.
- add secret leak tests for all public settings and summaries.

Acceptance:

- public routes do not expose env secrets or raw restricted packet content.
- customer data has a deletion path.
- trust packet summaries can be shared without leaking private source text.

## Gap 8: repeatable backend migrations

Status: shipped v1.

Shipped v1:

- `npm run db:migrate:dry` validates that the platform schema can be loaded before deploy.
- `npm run db:migrate` applies `docs/backend/platform-schema.sql` against `DATABASE_URL`.
- `npm run db:status` checks required tables and the pgvector extension on the target database.
- the migration script redacts credentials in logs and runs the idempotent schema in one transaction.
- the README documents the durable backend migration path.

Next:

- split the monolithic schema into numbered migrations once schema churn increases.
- persist migration version history when the product has multiple deployed environments.

## Recommended next shipping order

1. post-ship verification.
2. voice-led proof interview.
3. sponsor proof fixtures and demo script.
4. security retention/deletion controls.
