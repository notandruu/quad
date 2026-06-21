# Grand master delta audit

Last updated: 2026-06-21

## Current product reality

Quad is now more than a website audit demo. The codebase has the beginning of a production agent platform:

- Audit workspace: a user can run a website audit, watch live events, review findings, chat against the completed report, and inspect quadchain receipts.
- Quadchain substrate: audit events, findings, reports, brain writes, chat answers, voice transcripts, agent handoffs, and trust packets can emit proof-carrying packets with verifier summaries.
- Registry fallback: quadchain packets persist through Redis when configured and fall back to in-memory storage for zero-key demos.
- Agent bridge: `/api/agent/run` exposes a normalized agent-style workflow response with artifacts, approval state, receipts, and quadchain summaries.
- Metaregistry: sponsor and platform capabilities are modeled as installable tools with env requirements, scopes, approval modes, and write flags.
- Voice surface: Deepgram-backed transcription is available when configured, with voice transcript packets.
- Observability and demo readiness: Sentry, Arize/Phoenix hooks, debug drawer, CI, Playwright e2e, and Vercel deployment are in place.

## Delta against the grand master doc

| Area | Current state | Gap | Ship plan |
| --- | --- | --- | --- |
| Hosted trust packet builder | Trust packet workflow exists in `src/lib/fde/workflows.ts`; agent bridge can emit packet summaries. | Dashboard users could not turn a completed audit into a customer-ready packet from the product surface. | Shipped `/api/trust-packet` and dashboard trust packet panel. |
| Approval ledger | In-memory run ledger supports artifacts, approval requests, and receipts. | Not durable across deploys and not queryable as a first-class customer history. | Add Supabase-backed run ledger tables with memory fallback. |
| Publisher connectors | Dry-run publisher route stages CMS, task, and trust packet export artifacts from approved runs, then `POST /api/publish/execute` records approved connector execution artifacts with receipts and quadchain packets. | Live third-party CMS/task mutation adapters are still connector-specific follow-on work. | Add targeted live adapters after the approved execution ledger is stable. |
| Post-ship verification | `POST /api/verify-fix` verifies staged drafts and approved execution artifacts, emits verification reports, and creates final receipts. | Needs live before/after browser evidence for real customer writes. | Add Browserbase-backed before/after checks per finding. |
| Enterprise proof questionnaire | Grand doc wants questionnaire answers to become memory and proof obligations. | Current main flow is audit-first; no questionnaire workflow. | Add focused trust questionnaire route that writes brain memory, emits `brain_memory_write`, and seeds the next audit. |
| Operator console | Debug drawer shows backend status; dashboard shows trust trail. | No metaregistry install/update panel, no approval queue, no run history. | Add operator panel with active capabilities, blocked connectors, approvals, and latest packets. |
| Security governance | Secrets are not exposed in settings; private data stays off anchor layer; packet summaries restrict raw content. | Need explicit retention, tenant deletion, data classification, and durable audit access controls. | Add org-scoped retention policy config and packet visibility checks before durable storage reads. |
| Fetch.ai track | Agent bridge and capability manifest exist. | Need a polished external-agent story and booth-ready payload examples. | Add `GET /api/agent/describe` docs and sample Agentverse prompt that returns trust packet summaries. |
| Deepgram track | Voice transcript route exists and Deepgram env is live. | Voice is still input plumbing, not essential to the workflow. | Make voice mode conduct the enterprise proof interview and produce verified memory/trust packets. |
| Arize/Sentry judging | Hooks and sponsor positioning exist. | Need live traces/evals and an obvious dashboard story during booth judging. | Save screenshots and fixture traces; add demo script that shows Arize trace, evaluator, and Sentry reliability path. |

## What shipped in this slice

The biggest user-flow gap was trust packet handoff. A completed audit now has a first-class product action:

1. User runs an audit.
2. Quad emits audit, finding, and report quadchain packets.
3. Dashboard shows the trust trail.
4. User clicks `Build packet`.
5. Quad builds an enterprise proof trust packet from the findings.
6. Quad saves a `trust_packet` quadchain packet.
7. Quad creates a workflow run, task records, packet artifact, certificate artifact, approval request, and receipt.
8. Dashboard shows readiness, blocked obligations, verifier status, and certificate id.

This turns the product narrative from "we found gaps" into "we generated a verifiable packet that can be approved and shipped."

## Next plans

### Plan a: durable approval ledger

- Add `workflow_runs`, `workflow_tasks`, `workflow_artifacts`, `workflow_approvals`, and `workflow_receipts` tables.
- Keep the current in-memory ledger as zero-key fallback.
- Add `getRunsForOrg`, `getApprovalsForOrg`, and `getRunByAuditRunId`.
- Add tests for fallback, durable save/load, approval decision, and write gating.

### Plan b: dry-run publisher workbench

- Shipped `POST /api/publish/dry-run`.
- Approved trust packet runs can stage CMS copy, task drafts, and trust packet exports.
- Every staged artifact emits a `connector_action` packet.
- Shipped `POST /api/publish/execute`.
- Approved staged drafts now become `connector_execution` artifacts with executed receipts, rollback plans, verifier requirements, and quadchain packets.
- Live external CMS/task writes still require connector adapters, but the approval-to-execution ledger is now real.

### Plan c: post-ship verification loop

- Shipped `POST /api/verify-fix`.
- Verification checks staged drafts and approved execution artifacts.
- Execution artifacts must preserve source draft binding, executed receipt, target metadata, and rollback plan.
- Next: re-run only the relevant page and evidence obligations through Browserbase.

### Plan d: voice-led enterprise proof interview

- Use Deepgram as the primary input for a buyer-readiness interview.
- Convert transcript answers into tenant-scoped brain memory.
- Emit `voice_transcript`, `brain_memory_write`, and `chat_answer` packets.
- Let the follow-up audit compare the website against newly captured memory.

### Plan e: operator console

- Show metaregistry capability status, active tools, blocked env, and write approval mode.
- Show latest runs, pending approvals, receipts, and trust packets.
- Keep raw private packet content hidden unless visibility allows it.

## Demo truth table

- Claim: quad is an ai employee that audits a website against company memory.
  - Real: yes.
- Claim: quad streams live work.
  - Real: yes.
- Claim: quad creates proof-carrying context packets.
  - Real: yes.
- Claim: quad turns gaps into an approval-ready trust packet.
  - Real: yes, shipped in this slice.
- Claim: quad stages approved fixes.
  - Real: yes. dry-run publisher artifacts are staged after approval.
- Claim: quad records approved connector execution.
  - Real: yes. approved staged drafts become execution artifacts with receipts, rollback plans, verification requirements, and quadchain packets.
- Claim: quad writes fixes directly to a CMS.
  - Real: not yet. current state is approved execution in quad's ledger, with live third-party adapters still to wire.
- Claim: quad has durable enterprise governance.
  - Real: partial. packet registry can persist, approval ledger still needs durable storage.
- Claim: quad is a full agent platform.
  - Real: credible foundation, but still needs operator console, durable ledger, publisher workbench, and post-ship verification.
