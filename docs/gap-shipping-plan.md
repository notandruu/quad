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

## Gap 0: org and workspace boundary

Status: shipped v1.

What was missing:

- `orgId` existed on records, but there was no first-class organization or workspace object.
- service tokens could be scoped to org ids, but the product could not show the tenant boundary, default visibility, region, retention window, or requester role.
- backend readiness could claim table durability without checking for org/workspace tables.

Shipped v1:

- `src/lib/orgs` adds organization, workspace, membership, requester role, and boundary records with in-memory fallback plus optional Supabase persistence.
- seeded demo orgs now resolve to workspace contexts for Red Cross and enterprise-proof demos.
- `GET /api/orgs` returns the current authorized workspace boundary without exposing token values.
- `/api/operator` includes workspace context beside runs, approvals, memory, model gateway, and worker state.
- platform schema and backend readiness now require `quad_orgs`, `quad_workspaces`, and `quad_workspace_memberships`.

Acceptance:

- every operator/demo surface can show which org/workspace boundary it is operating inside.
- scoped service tokens can read org workspace context only when they have `orgs:read`.
- production readiness no longer ignores missing tenant tables.

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

Shipped v1.5:

- `workflow_task_events` table makes the normalized run event stream durable beside tasks, artifacts, approvals, and receipts.
- `GET /api/runs/:runId/events` exposes cursorable hosted task-stream replay with org-scoped access control.
- hosted run details now link task-event replay to `/api/runs/:runId/events` instead of overloading the task list route.

Shipped v2:

- `POST /api/approvals/[approvalId]/decision` records approve/reject decisions.
- approval decisions emit `approval` quadchain packets.
- operator console can approve or reject pending packets.

Shipped v3:

- Metaregistry capability install requests emit `connector_action` quadchain packets tied to the approval run.
- Connector credential install and revoke mutations emit restricted `connector_action` packet summaries without storing secret values in packet sources.

Shipped v4:

- Hosted run, artifact, and task routes share one org-scoped access helper.
- Cross-org service tokens receive `404` for run detail routes so run ids do not reveal tenant existence.
- Raw artifact reads remain admin-secret-only; service tokens receive redacted previews.

Next:

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

## Gap 2.1: runtime observability receipts

Status: shipped v1.

Shipped v1:

- runtime operations now emit safe receipt summaries for workflow spans, worker jobs, tools, routes, models, connectors, and future surfaces.
- enterprise-proof question answering and backend worker job processing create runtime trace receipts with duration, status, run id, org id, and error class, without raw prompts or outputs.
- operator summary exposes runtime trace totals, failures, average duration, and latest receipts beside model gateway receipts.
- backend readiness now treats `workflow_task_events` as a required production table so task-stream replay is not silently missing.

## Gap 2.2: shared core runtime facade

Status: shipped v1.

Shipped v1:

- `runQuadCoreCommand()` gives chat, queued audit, and future voice/fetch/cli surfaces one shared runtime command contract.
- `POST /api/core/run` exposes that contract with auth, idempotency, mutation guards, runtime traces, quadchain receipts, and task/job summaries.
- `/api/chat` now calls the shared core facade instead of duplicating context loading, audit-follow-up grounding, employee runtime, and receipt creation logic.
- api-contract tests prove both chat and queued-audit commands work through the shared facade without leaking secrets.

Shipped v2:

- `/api/agent/run` now delegates to the shared `queue_audit` core command while preserving the external-agent response shape.
- Fetch/Agentverse-style runs return queued job state, task summary, runtime capability state, and an `agent_handoff` quadchain receipt from the same core substrate as dashboard queues.
- the old synchronous one-off agent route logic was removed; execution now belongs to the backend worker path.

Shipped v3:

- `POST /api/voice/transcribe` now turns a successful Deepgram transcript into a `chat` command on the shared core runtime.
- Voice returns the assistant answer, `chat_answer` packet summary, and verified context beside the existing transcript proof.
- Voice chat receipts bind the spoken transcript as required evidence while keeping retrieved memory evidence optional unless it is directly preserved in the answer.
- The dashboard renders one spoken turn as a user message plus a Quad answer instead of double-submitting the transcript through the text chat path.

Shipped v4:

- `buildQuadCoreAgentLoop()` creates a visible plan, tool-dispatch, observation, and final trace for every core runtime turn.
- Chat and voice answers now return `agentLoop` with selected tool ids, blocked capability ids, per-step tool calls, and an `agent_handoff` receipt.
- Fetch/Agentverse-style queued runs return the same agent loop trace beside job state and runtime capability state.
- The dashboard message bubble renders a compact agent loop strip so the product shows the work shape without exposing hidden reasoning.

## Gap 2.5: post-audit chat grounding

Status: shipped v1.

Shipped v1:

- post-audit chat loads cached audit reports and falls back to durable run artifacts when the cache is empty.
- chat answer receipts include audit report and finding sources beside company brain memory sources.
- chat responses return verified context from audit/finding quadchain packets and brain memory packets.

Acceptance:

- follow-up answers can cite both the completed audit evidence and verified company memory.
- audit report context does not cross org boundaries.

## Gap 2.6: approval-backed memory writeback

Status: shipped v1.

What was missing:

- `/api/ingest` wrote directly into the shared company brain after auth.
- memory writeback did not create a human approval artifact before durable persistence.
- approving a memory write did not have a concrete execution side effect.

Shipped v1:

- `POST /api/ingest` now defaults to proposal mode and returns a `memory_write` run with an approval request, blocked receipt, and restricted quadchain approval packet.
- callers that truly need the old trusted behavior can pass `mode: "write"` and still receive a `brain_memory_write` packet.
- approving a memory-write proposal through `POST /api/approvals/[approvalId]/decision` now commits the memory to the company brain and returns the memory-write side effect plus packet summary.
- proposal packets preserve verifier-visible evidence and keep raw memory content inside the protected run artifact path.

Acceptance:

- shared brain memory is not learned before approval when using the public ingest route.
- approval creates a real `brain_memory_write` receipt, not just a status flip.
- chat/retrieval can later cite the approved memory's quadchain packet.

## Gap 2.7: permission-aware memory scopes

Status: shipped v1.

What was missing:

- company, team, and personal memory were product concepts but not enforced in retrieval.
- chat and audit retrieval could accidentally treat every org memory as broadly readable.
- public memory ingest did not normalize the intended memory scope into durable permission tokens.

Shipped v1:

- brain permissions now have a compact grammar on the existing `permissions` array: `scope:company`, `scope:team`, `scope:personal`, `team:<id>`, and `user:<id>`.
- legacy `read` and `internal` memories remain company-readable for backward compatibility.
- retrieval filters ranked memories by requester context before returning them to chat, audit, tools, or model prompts.
- team memories require a matching `teamId`; personal memories require matching `userId` plus explicit `includePersonal`.
- `/api/ingest` accepts `visibility`, `userId`, `teamId`, and `teamIds`, and approval previews show the normalized permissions that will be written.
- platform schemas now include a `brain_memory_permissions_idx` GIN index for durable permission-aware retrieval.

Acceptance:

- no requester context sees only company-readable memory.
- team context can see matching team memory but not personal memory.
- personal context only appears for the owner with explicit personal opt-in.

## Gap 2.8: memory freshness and relationship metadata

Status: shipped v1.

What was missing:

- memory chunks had source ids and confidence, but no structured owner, freshness, validation, stale-after, or relationship metadata.
- retrieval could return a memory without telling downstream surfaces whether the source was stale or what other control/evidence it came from.
- approval previews did not show whether a proposed memory would age out or link to other sources.

Shipped v1:

- brain memory writes now normalize sidecar metadata without changing the frozen `BrainMemory` contract.
- metadata tracks visibility, owner user id, team ids, validation status, source updated time, stale-after time, freshness, and relationships.
- `retrieveMemoriesWithPackets` returns memory, latest quadchain packet summary, and metadata together.
- memory write proposals include metadata in the approval preview, so operators can review freshness and relationships before approving shared context.
- chat/core receipts include memory metadata in restricted packet sources, making model context receipts explain freshness and scope.
- Supabase schemas now include additive `memory_metadata JSONB` storage with `ALTER TABLE ... IF NOT EXISTS` for existing installs.

Acceptance:

- old memories still work by deriving metadata from permissions and timestamps.
- new memories can be marked stale/fresh and linked to source/control ids.
- downstream agent receipts can show what memory was used and whether it was stale.

Shipped v2:

- `/api/operator` now returns a memory trail summary with latest readable memories, freshness counts, scope counts, relationship counts, and metadata per memory.
- the dashboard operator console renders a memory trail panel beside backend and quadchain trust state.
- stale memory, company/team/personal scope, validation status, owner, confidence, evidence count, and relationship edges are now visible during demos and operator review.

Acceptance v2:

- operators can see stale memory without opening raw artifacts.
- scoped memory is visible as company/team/personal in the dashboard.
- relationship edges are surfaced as a product signal, not hidden storage metadata.

Shipped v3:

- `POST /api/brain/refresh` creates approval-backed memory refresh proposals for stale or questionable context.
- refresh proposals reuse the existing memory write approval ledger instead of mutating the brain directly.
- refresh previews preserve original memory scope, evidence, freshness metadata, and relationship edges while linking the proposed memory back to the prior source.
- the operator memory trail now shows a `Refresh` action on stale memories and reloads the approval queue after staging the proposal.

Acceptance v3:

- stale memory has a concrete operator action.
- refresh proposals do not become retrievable brain memory until approved.
- refreshed memory receipts explain which prior memory/source they update.

## Gap 2.9: scoped context graph

Status: shipped v1.

What was missing:

- company, team, and personal memory were scoped at retrieval time, but there was no graph object the rest of the platform could build on.
- operator surfaces could see a latest-memory trail, but agents could not ask for the visible memory topology, relationship edges, stale nodes, and proof receipts in one safe shape.
- the product story said "company brain" while the backend still exposed memory mostly as ranked chunks.

Shipped v1:

- `src/lib/brain/contextGraph` builds a permission-aware graph over readable memories with company/team/personal counts, validation state, freshness, evidence counts, relationship edges, and latest `brain_memory_write` quadchain packet summaries.
- `GET /api/brain/graph` exposes the graph through the hosted auth layer with `brain:read` scope support and zero-key demo fallback for the seeded org.
- `/api/operator` now includes a compact `contextGraph` summary beside memory trail, quadchain, evidence, model gateway, worker, and workspace state.
- graph nodes expose titles, summaries, counts, scopes, timestamps, and receipt ids, but not raw memory content, evidence quotes, prompts, credentials, or packet source bodies.

Acceptance:

- no requester context sees only company-readable graph nodes.
- matching team and explicit personal context can widen the graph without changing the raw memory contract.
- downstream agents and product surfaces can build from one scoped context substrate instead of re-implementing memory visibility rules.

## Gap 2.10: event-driven context capture

Status: shipped v1.

What was missing:

- meeting, voice, chat, and future connector events could write or propose memory, but there was no shared signal/noise filter before writeback.
- noisy lines, questions, speculation, and chit-chat were handled ad hoc inside individual workflows.
- the run task stream did not show which raw events became memory candidates and which were discarded as noise.

Shipped v1:

- `src/lib/context-capture` accepts normalized runtime events, classifies durable company signals versus noise, assigns source ids, confidence, category, suggested visibility, and source quotes, and summarizes the capture safely.
- `POST /api/context/capture` exposes the pipeline to dashboard, voice, connector, and future webhook surfaces. It can run classification only or stage approval-backed memory proposals with `proposeWrites: true`.
- run task streams now support `memory.candidate`, `memory.noise`, and `memory.proposed` event kinds for replayable context-capture decisions.
- meeting intelligence now includes a `context_capture` artifact before the meeting memory proposal, so the approval packet is backed by an explicit signal/noise pass.
- captured writes still route through the existing approval-backed memory proposal flow; no shared brain write happens directly from noisy events.

Acceptance:

- short lines, chit-chat, questions, speculation, and low-signal events are filtered before writeback.
- durable context candidates create visible memory-candidate task events when tied to a run.
- captured memory writes are approval-backed proposals, not blind durable writes.

## Gap 2.11: runtime tool routing

Status: shipped v1.

What was missing:

- the metaregistry knew capability health, env requirements, install state, and allowlist state, but the core runtime still kept its own hard-coded intent-to-tool map.
- runtime traces showed selected tools, but not which tools were eager, deferred, or blocked by policy/env.
- future dashboard, fetch, cli, and worker surfaces had no direct api for asking what quad would load for a given intent and surface.

Shipped v1:

- `buildRuntimeToolRoutingPlan()` now lives in `src/lib/metaregistry` and returns required capability ids, eager tools, deferred tools, selected tools, blocked capabilities, and active policy.
- `buildQuadCoreContext()` consumes that routing plan directly, emits eager/deferred/blocked ids in `core.capabilities_selected`, and stores the plan on the runtime context.
- visible agent-loop traces now distinguish eager hot tools, deferred cold/write/observability tools, and blocked capabilities.
- `GET /api/metaregistry/runtime-tools` exposes the read-only routing plan for dashboard, fetch, cli, worker, and future specialist-agent surfaces.

Shipped v2:

- the debug drawer now fetches the real website-audit/fetch-agent runtime plan and shows hot, deferred, and blocked counts beside the backend status.
- runtime route summaries use a pure debug helper so product surfaces do not render raw certificates, raw env names, or unfiltered api payloads.
- the drawer handles service-auth lock-down by showing that routing is unavailable instead of breaking the rest of the status panel.

Acceptance:

- allowlist, disabled, missing-env, and write-approval policy are applied before a tool reaches the runtime plan.
- write-capable tools stay deferred until an approval gate exists.
- observability tools can be installed and active without being stuffed into every prompt as eager context.
- judges can open the product and see which tools quad would route before a workflow runs.

## Gap 3: dry-run publisher workbench

Status: shipped v3.

Shipped v1:

- `POST /api/publish/dry-run` consumes an approved trust packet run.
- unapproved runs are blocked through `assertCustomerWriteAllowed`.
- generates staged CMS copy, task draft, and trust packet export artifacts.
- emits `connector_action` quadchain packets for every staged draft.
- operator console can stage approved fixes and show dry-run artifacts in the sidecar.

Next:

- show richer diffs in the operator console.
- replace browser-write fixture evidence with live Browserbase session screenshots once the target cms connector is available.
- never perform customer-facing writes without `assertCustomerWriteAllowed`.

Acceptance:

- unapproved run returns a blocked receipt.
- approved run can produce staged CMS/task artifacts.
- every staged action has a packet summary.

Shipped v2:

- dry-run publisher artifacts now use `quad.connector_draft.v1` payloads.
- CMS, task, and trust-packet export drafts include connector id, dry-run mode, target metadata, action type, reversibility, approval requirement, proof binding, and validation checks.
- operator artifacts show connector-specific destination, action, and validation preview while full payload detail stays behind the hosted artifact route.

Shipped v3:

- `POST /api/publish/execute` consumes approved staged drafts and creates `connector_execution` artifacts.
- execution artifacts use `quad.connector_execution.v1` payloads with source draft binding, connector id, approved execution mode, target metadata, rollback plan, post-execution verifier requirements, and `dryRun: false`.
- every execution creates an executed receipt plus a quadchain `connector_action` packet.
- execution re-checks metaregistry capability state at execution time, so disabled or unallowlisted write connectors block before a customer-write artifact is recorded.
- ship trail and operator artifact summaries now surface approved connector executions, not only staged drafts.

Shipped v4:

- approved CMS executions also create `browser_action` artifacts with `quad.browser_action.v1` payloads.
- browser action artifacts bind the source draft, connector execution artifact, Browserbase write capability id, target selector, hash-only field values, and no-submit pause state.
- before/after browser action evidence is stored as hash-bound evidence bundle summaries, not raw screenshots or form values.
- every browser action creates an executed receipt plus a quadchain `connector_action` packet.
- operator artifact summaries now prefer the latest publisher artifacts, so execution and browser-action proof is visible instead of being hidden behind older dry-run drafts.

Shipped v5:

- `POST /api/browserbase/questionnaire-step` now uses the same request auth boundary as the rest of the hosted platform, with a scoped `browser:write` permission and zero-key demo fallback.
- live Browserbase questionnaire sessions mirror session, field focus, field fill, screenshot, pause, close, and failure milestones into the durable run task stream when a known run id is supplied.
- field-fill stream output and ledger payloads carry answer hashes and lengths instead of raw answer text.
- browser action events use explicit task event kinds, so later dashboard, fetch, and replay surfaces can show per-field action history without parsing generic log strings.

Shipped v6:

- `browserbase.write_browser` is now treated as a real customer-write capability in the metaregistry, with `browser:write` and `forms:stage` scopes.
- install previews force-install and allowlist the browser write capability alongside cms/task publishers when write tools are requested.
- browser form fill remains deferred behind human approval and explicit org allowlisting even though final submit is paused.

## Gap 4: post-ship verification

Status: shipped v2.

Shipped v1:

- `POST /api/verify-fix` verifies staged connector artifacts.
- verification emits a `verification_report` artifact.
- passed verification creates executed receipts and connector action packets.
- operator console can trigger verification after staging a fix.
- Playwright covers approve -> stage -> verify from the dashboard.

Shipped v2:

- verification now covers `connector_execution` artifacts as well as staged drafts.
- executed artifacts must preserve the execution schema, executed receipt, source draft binding, target, and rollback plan.

Shipped v3:

- verification now covers `browser_action` artifacts.
- browser action verification checks the action schema, executed receipt, target selector, hash-bound field list, and before/after evidence summaries.

Acceptance:

- fix is not marked done just because a draft exists.
- verification includes page evidence, packet summary, and final receipt state.

Next:

- replace fixture before/after evidence with live Browserbase screenshots for real customer writes.
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

Shipped v5:

- `POST /api/jobs/canary?scheduled=1&minIntervalSeconds=300` supports cron-style worker canary checks.
- scheduled calls use the latest canary receipt and a short scheduler lock so overlapping monitors do not double-run the probe.
- scheduled responses expose `scheduled`, `skipped`, `reason`, and `nextAllowedAt` for external uptime tools.

Next:

- add Railway cron and external uptime check examples that call the scheduled POST path.

Shipped v7:

- `vercel.json` now configures Vercel Cron to call `/api/cron/worker-canary` every five minutes.
- `/api/cron/worker-canary` supports Vercel's `GET` cron invocation shape and requires `CRON_SECRET` when configured.
- local and manual calls still fall back to the existing worker auth path, so demo/e2e mode stays zero-key.

Shipped v6:

- the operator console now renders a `Worker uptime` panel.
- the panel shows latest canary age, canary duration, heartbeat state, queue depth, retrying jobs, dead-letter count, processed count, and latest job age.
- the panel uses existing safe `/api/operator` data and does not expose worker secrets or raw env.

Shipped v8:

- `POST /api/jobs/[jobId]/retry` lets an operator manually requeue dead-letter, failed, or retrying backend jobs.
- manual retry requires `jobs:write`, uses mutation idempotency guards, and refuses queued/running/completed jobs.
- retrying clears stale lease/dead-letter state, optionally resets attempts, pushes the job back onto the queue, and records an `Operator retried backend job` event in the run ledger.
- api and unit tests cover dead-letter recovery, non-retryable jobs, and secret-safe public responses.

Shipped v9:

- audit and enterprise-proof progress events now write through tenant-scoped redis stream keys when an org id is known.
- zero-key mode keeps a bounded in-memory run event stream, so replay can still be tested and demoed without Upstash.
- replay reads the same tenant-scoped event stream and requires the existing hosted auth guard when service tokens or api secrets are configured.
- progress counters and audit run metadata now use org-scoped redis keys for hosted runs.
- unit tests cover memory replay, sequence stability, and org isolation when run ids collide.

## Gap 4.6: durable evidence bundles

Status: shipped v1.

What was missing:

- screenshots, voice uploads, and trust packet exports existed as route-local payloads or urls.
- the backend did not have a common evidence object that could be summarized safely in the operator console.
- sensitive evidence could not be referenced without risking raw data leakage into receipts or telemetry.

Shipped v1:

- `src/lib/storage/evidence.ts` creates hash-bound evidence bundles for screenshots, voice audio, and trust packet exports.
- evidence bundles track org id, run id, kind, storage mode, byte length, hash, visibility, classification, retention, source url, and metadata keys.
- inline screenshot fallback keeps the old data-url compatibility path but stores only a private evidence summary, not the base64 data.
- Deepgram voice transcription registers the uploaded audio as restricted confidential evidence before transcription.
- dry-run trust packet exports attach an `artifact_payload` evidence bundle summary to the staged export artifact.
- `/api/operator` returns evidence counts and latest safe summaries beside backend readiness, quadchain, memory, and model gateway state.

Shipped v2:

- approved browser actions register before and after browser evidence bundles.
- browser evidence summaries include provider, phase, selector, and binding metadata keys while omitting raw screenshot bytes and field values.

Acceptance:

- raw audio, inline screenshot data, browser action values, and trust packet markdown do not appear in evidence summaries.
- every evidence summary is tenant-scoped and hash-bound.
- operator surfaces can answer “what proof artifacts exist for this run?” without opening raw artifacts.

## Gap 5: voice-led enterprise proof interview

Status: partial.

What exists:

- Deepgram configuration.
- voice transcription route.
- voice transcript quadchain packets.
- dashboard voice entrypoint.

Shipped v1:

- `POST /api/voice/transcribe` now treats voice as company context by default.
- A successful Deepgram transcript emits a `voice_transcript` quadchain packet and a `brain_memory_write` quadchain packet.
- The transcript is persisted as tenant-scoped meeting memory with internal permissions, confidence from Deepgram, and transcript evidence.
- Callers can opt out with `remember=false` for one-off commands.
- The response returns the created memory id plus both packet summaries.

Shipped v2:

- Brain retrieval can return the latest `brain_memory_write` packet summary beside each retrieved memory.
- Chat answers include `verifiedContext` packet summaries when retrieved memories have receipts.
- The `chat_answer` packet records the verified context receipt ids used to ground the answer.
- The dashboard chat badge shows when a response used verified memories.

Shipped v3:

- The dashboard voice button passes the active org id and run id into `POST /api/voice/transcribe`.
- Voice transcript memory now lands in the same tenant/run context as the visible audit when one is active.
- The chat surface shows a saved-memory acknowledgement with the memory-write receipt after Deepgram transcription.

Shipped v4:

- `POST /api/voice/interview` returns the next buyer-readiness question for the active org/run context.
- The dashboard shows a voice prompt with an evidence hint and a next control, so voice mode actively guides what to capture.
- The interview question set covers buyer trust proof, compliance claims, customer fit, approved execution workflows, and differentiated claims.

Shipped v5:

- After a voice answer is saved as memory, the dashboard shows a `Rerun audit` action on the memory receipt.
- The action reruns the same target URL and org, so the next audit compares the website against newly captured voice context.

Shipped v6:

- Deepgram voice mode is now a peer runtime surface, not only a capture tool.
- A spoken command creates a restricted audio evidence bundle, a `voice_transcript` packet, an optional `brain_memory_write` packet, and a core `chat_answer` packet in one response.
- The dashboard displays the spoken command and the assistant answer immediately when the backend returns a core voice response.

Shipped v7:

- Scripted meeting mode now runs `learnFromMeeting` in approval mode, so verified facts are staged instead of silently writing to the shared brain.
- `buildMeetingIntelligence()` turns a meeting transcript into a `meeting_agent` workflow with transcript, summary, memory proposal, follow-up, approval, and blocked receipt artifacts.
- Meeting intelligence emits accepted `voice_transcript`, `approval`, and `agent_handoff` quadchain packet summaries without putting raw transcript text in packet source content.
- Approving the meeting memory proposal uses the existing approval decision path and writes the derived meeting memory to the company brain as a real side effect.
- The meeting page now surfaces staged approvals, artifact count, and accepted packet count after the scripted run.

Acceptance:

- user can speak company facts into quad.
- quad stages verified memory for approval before shared-brain writeback.
- quad answers spoken commands through the same runtime as chat.
- audit finds website gaps based on the voice interview.
- meeting-derived follow-ups become governed artifacts instead of loose notes.

## Gap 6: sponsor proof

Status: partial.

Build:

- Arize: save a booth-ready trace and evaluator screenshot for audit, chat, and trust packet generation.
- Sentry: add a demo reliability view showing errors/logs/traces without secrets.
- Browserbase: ensure screenshot evidence path is visible in finding cards.
- Redis: show stream replay/counter status in debug/operator console.
- Deepgram: make voice essential through the proof interview flow.

Shipped v1:

- Fetch.ai: `GET /api/agent/describe` returns a public, secret-safe agent card with workflows, endpoint urls, protocols, keywords, sponsor alignment, and quadchain trust guarantees.
- The card points external agent surfaces at `POST /api/agent/run` for the actual enterprise proof or website audit workflow.
- The descriptor is shaped for Agentverse/ASI messaging: public endpoint, agent chat protocol readiness, a2a readiness, discoverability keywords, and a normalized run contract.

Shipped v2:

- `GET /api/sponsor/proof` returns a booth-safe sponsor proof manifest.
- The manifest maps each sponsor to live/fallback/planned status, product claim, demo moment, and route or surface to show.
- The manifest includes `safeToClaim` and `doNotClaim` lists so slide and booth claims match real configured capabilities.
- Deepgram is now first-class in the metaregistry, and Sentry readiness is keyed to the server-side DSN used by backend readiness.

Shipped v3:

- Sponsor proof now includes a `demoRunbook` with ordered booth steps, live/fallback/planned partitions, judge script lines, and a no-secrets booth checklist.
- `npm run sponsor:proof` prints the same booth-safe manifest locally from `.env.local`.
- `docs/sponsor-proof-runbook.md` gives the team exact instructions for what to claim, what to show, and what not to say.

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

Shipped v4:

- `POST /api/security/retention/sweep` plans expired run cleanup from the configured retention policy.
- dry-run sweep returns candidate runs plus the deletion receipts that would execute.
- execute sweep requires a deterministic confirmation string and then reuses the protected run deletion path.

Shipped v5:

- observability readiness includes a telemetry safety validator.
- raw prompt, response, and payload telemetry logging flags are security blockers.
- Phoenix collector endpoints must use HTTPS before traces leave the runtime.
- production-ready security posture now requires every control to pass, not only a high aggregate score.

Shipped v6:

- `complete()` now routes Anthropic text calls through a model gateway receipt layer.
- model receipts record provider, model, purpose, org/run ids, sanitized length, redaction count, attempts, duration, usage, status, and output hash without storing raw prompts or responses.
- unconfigured providers, blocked restricted payloads, retries, failures, and successful calls all produce safe receipts.
- `/api/operator` exposes a compact `modelGateway` summary so operators can see model-call health without leaking customer context.

Shipped v7:

- `POST /api/enterprise-proof` now uses the same hosted auth guard as other mutation routes while preserving zero-key demo fallback for the enterprise-proof demo org.
- enterprise-proof question answering is protected by mutation rate limits and idempotency replay.
- external callers can provide a deterministic run id for correlation, and duplicate run ids are rejected unless the request is an idempotency replay.
- route tests cover demo fallback, hosted secret enforcement, idempotency replay, and run-id conflict protection.

Shipped v8:

- enterprise-proof learned facts now default to explicit company-scoped memory instead of relying on implicit permission inference.
- team-scoped learned facts require a team id, and personal learned facts require an owner user id before writeback.
- judge-passing answers with ambiguous target scope escalate to `needs_human` and do not write memory.
- learned facts carry `verified` validation metadata plus derived source relationships for the memories and connector documents used.

Shipped v9:

- the main chat surface now routes security-questionnaire and trust-question prompts through `/api/enterprise-proof`.
- enterprise-proof responses include a compact `brainGrowth` summary with learned, reused, or needs-human state.
- chat replies show whether quad learned a company memory, reused verified memory, or needs more human evidence.
- pure runtime helpers classify enterprise-proof prompts and format the visible brain-growth response for tests and future surfaces.

Shipped v10:

- `src/lib/security/publicPayload.ts` provides a reusable scanner that checks public JSON payloads against configured secret env values.
- `/api/settings`, `/api/sponsor/proof`, and `/api/agent/describe` now have route tests that seed fake API keys, service tokens, DSNs, and connector secrets, then prove response bodies expose only booleans, statuses, env key names, or safe caveats.
- the scanner allows public readiness text and missing env key names, but fails if an actual configured secret value appears anywhere in a nested payload.

Shipped v11:

- the security packet now includes `registryBoundary`, a machine-readable policy for what can appear in public registries, private stores, and optional future anchors.
- v1 anchoring is explicitly `local_receipts_only`; blockchain anchoring remains optional future work, not a product dependency.
- public anchor data is limited to packet/certificate ids, hashes, merkle roots, verifier versions, and handoff ids.
- raw context, evidence quotes, audio bytes, screenshots, model prompts/responses, credentials, and customer documents are listed as never anchored.
- route and unit tests prove the boundary policy is present and still does not leak configured secret values.

Build:

- extend secret leak coverage to future public summary routes as they are added.

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

1. external uptime check examples for the scheduled worker canary path.
2. sponsor proof fixtures and demo script.
3. model gateway with redaction, org policy, retries, and llm cost receipts.
4. object storage evidence bundles for screenshots, voice uploads, and trust packet exports.
