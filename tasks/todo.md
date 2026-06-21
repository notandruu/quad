# quad product + hackathon alignment

## checklist

- [x] read `/Users/stephenhung/Downloads/HACKATHON_PLAN.md`
- [x] search gmail for ai hackathon 2026 logistics and sponsor emails
- [x] research current public sponsor/event pages
- [x] identify sponsor-aligned demo strategy for quad

## review

quad is not a throwaway hackathon build. quad should be designed as a production product that happens to have a hackathon launch/demo deadline.

the core product is a company-aware ai employee platform: it understands a business goal, retrieves and collects missing context, uses tools, validates its own work, learns only verified knowledge, executes approved actions, and leaves a replayable evidence trail. website audits and security questionnaires are product workflows on top of that runtime, not the whole company.

the hackathon constraint should force focus and polish, not lower the bar. every shipped slice should be a production-shaped slice of the larger autonomous employee system.

enterprise devex inspiration: `docs/enterprise-devex-runtime.md`. quad should follow the proven internal-platform pattern: one core runtime, many equal surfaces, dynamic tool catalog, allowlisted connectors, skill/playbook wrappers over raw tools, specialist agents with capability cards, and one normalized task stream powering every surface.

ai-native company inspiration: the company brain must become a scoped context graph, not one shared memory bucket. company, team, and personal context have different access rules, write policies, retention, and trust expectations. the moat is live, accurate, permission-aware context that compounds over time without creeping users out.

first-market wedge: enterprise proof work. quad helps companies turn scattered internal evidence into customer-ready trust packets, security questionnaire answers, rfp responses, approved website updates, and reusable organizational memory. nonprofit public-trust remains a secondary market note in `docs/nonprofit-first-thesis.md`, not the primary direction.

trust primitive: quad chain, documented in `docs/proof-carrying-handoffs.md`. compact summaries, customer trust packets, approval receipts, and future agent handoffs should carry verifiable certificates proving which claims, sources, omitted ranges, and open obligations survived compression.

shipping primitive: `docs/fde-shipping-workflows.md`. quad should ship like a forward-deployed engineer: find the gap, build the fix, verify context, ask for approval, execute through the right hosted connector, verify the result, and leave a receipt.

capability primitive: `docs/metaregistry-plugin-system.md`. orgs should be able to one-click install capabilities that update what their ai employee can do: connectors, publishers, skills, specialist agents, approval policies, eval policies, and surfaces.

security primitive: `docs/security-data-governance.md`. enterprise ai deals require customer data controls: tenant isolation, context minimization, provider routing, connector scopes, redacted observability, approval gates, retention controls, and proof of what context left the tenant.

the product bar:

1. real users can onboard an org, add sources, and run repeatable audits.
2. every claim is source-backed, permission-aware, and replayable.
3. failures are visible, recoverable, and debuggable.
4. memory is durable, scoped by org, and safe to update only after approval.
5. the system can keep improving after the hackathon without a rewrite.
6. every agent action has an operator-visible intent, input, tool trace, output, approval state, and rollback or escalation path.
7. the runtime supports multiple workflows through shared primitives: memory, retrieval, collection, grounding, evals, writeback, browser action, publishers, and observability.
8. every surface is a peer client over the same runtime stream: dashboard, fetch/agentverse, future cli, ide, slack/email, and voice.
9. connectors and specialist agents are registered, health-checked, scoped, and allowlisted before the model can route to them.
10. context is scoped as company, team, or personal, with manager/admin visibility constrained to aggregate or explicitly consented views.
11. every action is assigned an autonomy tier, approval requirement, reversibility state, and audit receipt.
12. compressed packets and agent handoffs use quad chain certificates: verifiable before another agent, surface, customer, auditor, or human reviewer trusts them.
13. every high-value workflow ends in a hosted artifact, connector action, or verified receipt, not just advice.
14. capabilities are registered, scoped, health-checked, allowlisted, and observable before the model can use them.
15. private company data is minimized before model calls, routed by classification, redacted in telemetry, and auditable through quad chain receipts.

the strongest production-aligned sponsor stack is:

1. redis as the live agent state, memory, queue-ish coordination, progress, and replay layer.
2. browserbase as rendered browser evidence for website audits.
3. claude as the judgment and synthesis layer, with claude code clearly used in the build.
4. arize as the quality/eval layer that proves findings are grounded.
5. sentry as the production reliability layer for agent/tool/model failures.

secondary sponsor/prize lanes:

- fetch ai if we can package the audit employee as a discoverable agent on agentverse / asi:one.
- the token company if we can compress page evidence and company brain context with a visible before/after token count.
- the interaction company if we can expose quad as a poke miniapp or background workflow.
- deepgram if voice ingestion is easy enough to turn meetings into company brain memory.

avoid pivots into hardware, video, image generation, or chip/physical-ai tracks unless the production product spine is already done.

## production spine

- [ ] org/workspace model with durable ids and permission boundaries
- [x] tenant key helpers for redis/cache namespaces without leaking raw org formatting
- [x] data classification on model payloads, telemetry attributes, and security gateway inputs
- [x] model gateway with provider policy, payload minimization, and redaction hooks
- [ ] company brain ingestion for docs, notes, urls, and transcripts
- [ ] scoped context graph for company, team, and personal memories
- [ ] durable memory store with source provenance, confidence, permissions, and embeddings
- [ ] memory freshness/staleness metadata with explicit refresh paths
- [ ] event-driven context capture pipeline with signal/noise extraction before writeback
- [ ] audit run model with lifecycle states, retries, and resumability
- [ ] redis event stream and replay for every run
- [ ] normalized task stream schema shared by dashboard, fetch agent, future cli, and replay
- [ ] quad chain certificate schema for audit briefs, customer trust packets, learned memory receipts, and agent handoffs
- [ ] dynamic tool catalog with eager hot tools, deferred cold tools, health state, and allowlist filtering
- [ ] metaregistry catalog for installable connectors, publishers, skills, agents, approval policies, eval policies, and surfaces
- [ ] connector auth/security model with encrypted tokens, scopes, per-user oauth where possible, and service-account audit logs
- [ ] skill/playbook layer so workflows wrap raw tools with guardrails and synthesis rules
- [ ] connector registry for source systems, publishers, browser actions, and specialist agents
- [ ] autonomy tier policy for read, draft, confirm, explicit approve, and irreversible actions
- [ ] browserbase rendered evidence capture
- [ ] grounded finding schema with citations and screenshots/selectors where possible
- [ ] approval workflow before memory writeback or external action
- [ ] persistent approval ledger with approver, artifact hash, evidence visible, edit/reject state, and receipt id
- [x] post-ship verification step for browser, publisher, task, and team actions
- [ ] post-audit chat that can cite audit evidence and company memory
- [ ] arize tracing/evals for retrieval, page analysis, and final findings
- [ ] sentry monitoring for api routes, workers, browser sessions, redis calls, and model calls
- [ ] telemetry redaction policy for sentry, arize, replay events, and logs
- [ ] retention/deletion controls for runs, artifacts, learned memories, connector tokens, and personal context
- [ ] billing/usage posture, even if only internal metering at first
- [ ] seed demo org that feels like a real b2b startup customer, not fake hackathon filler

## current repo audit delta, 2026-06-20

subagent audit summary:

- current product surface already exists: dashboard, demo target site, chat, voice transport gate, audit sse stream, findings, proof scores, screenshot viewer, live logs, backend drawer, settings, sessions, redis/brain/browserbase/llm/eval helpers.
- current runtime is still audit-shaped, not platform-shaped: runs are thin, approval is mostly ui/draft state, browser evidence is read-only, replay is run-scoped, and there is no hosted workflow ledger.
- current enterprise proof gap: no durable trust packet builder, no approval ledger, no `/api/agent/run`, no fetch/uagent wrapper, no controlled questionnaire workflow, no publisher connectors, no post-ship verification, no tenant-grade security gateway.
- current org/security gap: brain has `orgId`, but redis keys, telemetry, connector tokens, retention, model routing, scoped company/team/personal context, and data classification are not production hardened.
- current ownership risk: `src/app/page.tsx` is the merge-conflict hotspot because it owns both dashboard presentation and runtime wiring. split visual shells only after the backend contracts stabilize.

shipped first substrate slice:

- [x] add `src/lib/quad-chain/**` with proof-carrying compression certificates and adversarial verifier tests
- [x] add `src/lib/metaregistry/**` with capability manifests, approval-policy validation, starter bundle, and active tool catalog
- [x] add `src/lib/fde/**` with trust-packet workflow planner, connector readiness, open obligations, receipt preview, and quad chain certificate attachment
- [x] add `docs/workstream-ownership.md` to keep silas, maddy, stephen, and andrew out of each other's merge paths

next functional slice:

- [x] add `src/lib/runs/**` durable run/task/artifact/approval/receipt contracts
- [x] add `/api/agent/run` thin hosted bridge returning normalized task summaries
- [ ] add enterprise proof fixture and `answerTrustQuestion()` workflow
- [ ] add persistent approval ledger before any real external write action
- [ ] add dry-run publisher connectors behind metaregistry capability ids
- [ ] route all future customer-mutating writes through approval receipts

## enterprise proof fetch pivot

sources: `tasks/fde-fetch-plan-audit.md`, `docs/proof-carrying-handoffs.md`

the next product move is not "more website audit polish." it is the first production-grade enterprise proof workflow on the quad ai employee runtime:

1. fetch-eligible uagent wrapper around the current working product.
2. sparse-brain security questionnaire / customer-trust loop that collects evidence, grounds answers, validates them, and writes back only judge-passed organizational memories.
3. approved browser action path that fills customer-facing forms or prepares trust packets with human approval before submit or publish.

hard constraints:

- keep the existing dashboard audit path working at every step.
- lead with enterprise proof work: security questionnaires, rfps, customer trust packets, vendor diligence, and approved public proof updates.
- do not persist unsupported or failed answers into the brain.
- do not build payments or multi-agent orchestration until phases 0 to 2 are green and rehearsed, but design the runtime boundaries so those become natural production capabilities later.
- make the ui prove causality: collected source -> grounded answer -> judge pass -> learned memory -> later reuse.
- do not hard-code demo-only flows where a reusable runtime primitive belongs.
- preserve production concerns while moving fast: org scope, provenance, validation metadata, idempotency, replay, approval receipts, rate limits, and failure states.
- preserve security concerns while moving fast: context minimization, tenant isolation, connector scopes, redacted telemetry, and model-routing policy.
- treat fetch/agentverse as one surface over the runtime, not the runtime itself.
- design the enterprise proof flow as a skill/playbook over primitives, not a bespoke route full of hidden logic.
- keep enterprise proof writeback in organization/team memory, not personal context, unless the user explicitly creates private notes or preferences.
- make context scope visible in the ui wherever a memory is read, learned, or proposed for writeback.
- every workflow should end in a hosted artifact, connector dry run, shipped action, or explicit needs-human receipt.

### phase 0 fetch eligibility

- [ ] add `agent/` python uagent using agent chat protocol, mailbox mode, manifest publishing, and acknowledgements
- [ ] add `/api/agent/run` as the thin next.js bridge to the existing product backend
- [ ] add agent readme with capability, handle/address, innovation lab badge, and run instructions
- [ ] prove direct asi:one handle call reaches quad and returns a real run summary
- [ ] verify existing dashboard demo still works after the agent bridge
- [ ] keep agent bridge stateless except for task/session ids; all durable state stays in the quad runtime
- [ ] return normalized task summaries so agentverse, dashboard, and future cli can share one contract

### phase 1 enterprise proof learn loop

- [ ] create enterprise proof/security-questionnaire fixture with sparse starting brain and collectible local artifacts
- [ ] implement `answerTrustQuestion()` with retrieve, collect, ground, evaluate, and validated writeback
- [ ] emit redis events for question progress, context collection, evaluation, learning, and needs-human states
- [ ] test that failed or unsupported enterprise proof answers are never persisted
- [ ] show brain growth and at least one learned organizational fact reused later in the dashboard
- [ ] model learned organizational facts with stable ids, org scope, source references, validation metadata, and idempotent writeback
- [ ] include context scope on every learned fact and block writeback when the target scope is ambiguous
- [ ] expose the enterprise proof workflow as a skill/playbook over reusable retrieve, collect, ground, evaluate, writeback, and action primitives
- [ ] normalize local artifacts as connector documents so future github, confluence, jira, slack, and email connectors can plug into the same retrieval path

### phase 2 approved customer action path

- [ ] add controlled `/demo-security-questionnaire` or `/demo-trust-packet` form
- [ ] fill validated security/customer-trust answers through browserbase/playwright with per-field action events
- [ ] require human approval before submit or publish
- [ ] show final outcome summary and save a fallback screen capture
- [ ] build verified customer trust packet with preserved claims, source refs, omitted ranges, and open obligations
- [ ] show quad chain verification status, tokens saved, preserved evidence, omitted ranges, and open obligations in the packet ui
- [ ] record every browser action with intent, selector, value summary, source answer id, approval state, and replay metadata
- [ ] register browser action capability as an allowlisted tool with health and permission metadata
- [ ] encode form fill as tier 2 draft-and-confirm, and submit as tier 3 explicit approve with a receipt

### phase 3 hosted fde shipping layer

- [ ] create hosted trust packet builder with approval and quad chain verification
- [ ] create fix workbench as execution center for website, task, team, memory, and trust-packet work
- [ ] add dry-run publisher connectors for cms, task, team, and memory writeback
- [ ] add persistent approval ledger and receipt generation
- [x] add post-ship verification and retry/escalation states
- [x] add backend readiness endpoint and platform schema for durable Supabase tables
- [x] add worker retry, dead-letter, and queue health semantics
- [x] expose hosted run artifacts under stable run/task ids

### phase 4 metaregistry capability layer

- [ ] define capability manifest types for connectors, publishers, skills, agents, policies, and surfaces
- [ ] create static metaregistry catalog for existing services and dry-run publishers
- [ ] derive debug/operator capability rows from the metaregistry instead of hard-coded backend lists
- [ ] derive validation checks from capability manifests where practical
- [ ] add install states: available, installing, installed, allowlisted, degraded, disabled, revoked
- [ ] show one-click install mock for enterprise proof starter bundle

### phase 5 security and data governance layer

- [x] add security gateway primitives for classification, redaction, tenant keys, and provider policy
- [x] wire model and embedding calls through payload minimization
- [x] add hosted request auth guard for org-owned api routes with zero-key demo fallback
- [x] add mutation rate limits and idempotency-key replay for high-risk hosted routes
- [x] add security rows to operator panel for tenant isolation, telemetry redaction, connector scopes, and model routing
- [ ] add validation checks for unsafe telemetry env/config where practical
- [x] add security packet for quad itself: what data is sent to models, what is stored, what is redacted, what can be deleted
- [x] add protected deletion dry-run and execution receipts for org/run data
- [x] add encrypted connector credential install/list/revoke substrate

## next build plan

- [x] add `src/lib/core/**` as the shared backend runtime spine for chat, voice, fetch, dashboard, and workers
- [x] centralize runtime context loading: intent, verified brain memories, active capability catalog, approval policy, and run ids
- [x] centralize quadchain receipt creation for runtime outputs so surfaces do not hand-roll packet logic
- [x] make `/api/chat` use the core runtime context and receipt helper as the first live surface on the new substrate
- [ ] keep the route-specific audit/worker execution paths working while the rest of the app migrates onto core
- [x] verify the slice with unit tests, typecheck, and no changes to frozen `src/lib/types`

- [ ] implement real redis streams for audit events and replay
- [ ] use browserbase for rendered page capture, screenshots, visible text, selectors, buttons, images, and forms
- [ ] require every finding to include url, quote/dom snippet, confidence, severity, and recommended fix
- [ ] add arize phoenix tracing/evals for page analysis, retrieval, and final findings
- [ ] add sentry traces/errors for api routes, audit worker, browser sessions, model calls, and redis calls
- [ ] build the launch demo around one enterprise proof scenario with internal docs that prove more than the public website or customer-facing answers show
- [ ] prepare sponsor-specific judging scripts for redis, browserbase, claude, arize, and sentry

## lane b execution

- [x] polish live logs with animated counters, readable event labels, empty state, and auto-scroll
- [x] add screenshot evidence viewer to finding cards
- [x] settle moshi voice transport as self-hosted websocket, disabled until explicit server urls are configured
- [x] add readiness/debug drawer summary for production wiring, demo spine, fallback mode, and next action
- [x] add approval draft previews so external actions are visibly gated by human approval
- [x] apply light cherry/pink ascii visual direction with decorative ascii animations and sentence-case ui copy
- [x] add proof scoring to findings so evidence quality is visible before approval
- [x] verify with typecheck, unit tests, production build, and playwright smoke screenshots
- [ ] fix missing fallback event replay in `/api/audit/stream` once lane a edit scope is available
- [x] add live eval/trace affordance for Arize Phoenix once real tracing payloads are wired
- [x] add proof-aware approval gating so weak or risky findings require review before approval
- [x] document how Quad maps to eve without forcing a rewrite during the demo push
- [x] add a copyable audit brief for sharing run state with teammates, judges, or a durable agent session
