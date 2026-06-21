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

Next:

- add row-level tenant checks before exposing raw artifacts.
- split snapshot storage into normalized tables once query needs exceed v1.
- add approval decision route that emits an `approval` quadchain packet.

## Gap 2: operator console

Status: next.

Build:

- add `/operator` or dashboard panel for recent runs, pending approvals, receipts, and active capabilities.
- read from `/api/runs`.
- show only summaries by default.
- drill into artifacts only when packet visibility allows it.
- include sponsor badges for Arize, Sentry, Browserbase, Redis, Fetch.ai, and Deepgram where the capability is live.

Acceptance:

- user can see pending trust packets without opening logs.
- user can identify blocked connectors/env.
- user can click from a run to `/quadchain?runId=...`.

## Gap 3: dry-run publisher workbench

Status: planned.

Build:

- add publisher service that consumes an approved or approval-pending trust packet artifact.
- generate staged CMS copy and task drafts.
- never perform customer-facing writes without `assertCustomerWriteAllowed`.
- emit `connector_action` quadchain packets for staged drafts.
- show diffs in the operator console.

Acceptance:

- unapproved run returns a blocked receipt.
- approved run can produce staged CMS/task artifacts.
- every staged action has a packet summary.

## Gap 4: post-ship verification

Status: planned.

Build:

- add targeted verification route for a finding or receipt.
- rerun the relevant audit page with the original evidence obligation.
- compare before/after evidence.
- emit `approval` or `connector_action` packets for the verification result.
- close the receipt as `executed` only after evidence passes.

Acceptance:

- fix is not marked done just because a draft exists.
- verification includes page evidence, packet summary, and final receipt state.

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

Build:

- enforce org-scoped access on durable run reads.
- add packet visibility filtering to `/api/runs` drilldowns.
- add data retention settings per org.
- add deletion route for demo/customer data.
- document what stays off-chain/off-registry.
- add secret leak tests for all public settings and summaries.

Acceptance:

- public routes do not expose env secrets or raw restricted packet content.
- customer data has a deletion path.
- trust packet summaries can be shared without leaking private source text.

## Recommended next shipping order

1. operator console on top of `/api/runs`.
2. approval decision route plus `approval` quadchain packet.
3. dry-run publisher workbench.
4. post-ship verification.
5. voice-led proof interview.
6. sponsor proof fixtures and demo script.
7. security retention/deletion controls.
