# Quad

> Knowledge infrastructure for every agent.

Quad is a company-aware AI employee that connects to systems of record, builds a scoped company brain, audits customer-facing surfaces against that brain, and turns gaps into approved work with verifiable receipts.

**Demo:** [quad.stephenhung.me](https://quad.stephenhung.me)
**Research:** [QuadChain paper](public/papers/quad-chain-research-paper.pdf)

## What Quad Does

1. Ingests company context from docs, websites, meetings, transcripts, and connector events.
2. Scopes memory by organization, workspace, team, user, freshness, visibility, and approval state.
3. Audits public claims, security answers, and customer-facing content against verified internal context.
4. Streams work live through the run event spine so dashboard, worker, and agent surfaces share the same trace.
5. Drafts fixes, answers, tasks, and connector actions, then gates writes behind approval.
6. Emits QuadChain packets for memory writes, agent handoffs, audit reports, trust packets, approvals, and connector actions.

Technically, Quad is a shared runtime for agents that need to know what the company knows, prove where it came from, and act only when the proof is good enough.

## Product Loop

```text
connect sources -> capture context -> retrieve scoped memory -> audit claims
  -> draft action -> verify evidence -> request approval -> execute or block
  -> write receipt -> learn back into the brain
```

The same loop is exposed through the dashboard, external agent routes, worker queue, chat, voice, meeting capture, and future connector surfaces.

## Architecture

| Layer | Implementation |
| --- | --- |
| Web app | Next.js App Router, React, TypeScript, Tailwind |
| Operator UI | `QuadWorkspaceDashboard`, operator console, live logs, trust trail, QuadChain workbench |
| Company brain | Postgres/Supabase + pgvector schema, metadata sidecars, permissions, seeded local fallback |
| Runtime facade | `/api/core/run` for chat and queued audits across dashboard, voice, worker, and external agents |
| Run/event spine | Redis streams when configured, bounded in-memory fallback for zero-key demos and tests |
| Jobs | Durable audit queue, worker loop, canary route, retry/dead-letter accounting |
| Browser/action layer | Browserbase render path with static fetch fallback, publish dry-run/execute contracts |
| Meeting and voice | Deepgram transcription, meeting intelligence, context capture, approval-backed memory proposals |
| External agents | Fetch/Agentverse-style descriptor and run handoff routes backed by the same core runtime |
| QuadChain | Hash-backed packets, evidence obligations, omission manifests, answer-readiness checks, optional anchoring metadata |
| Observability | OpenTelemetry/Phoenix traces, Sentry, runtime receipts, usage meter, eval surfaces |

## QuadChain

QuadChain is the verifiable memory layer behind Quad. It treats compressed context as an object with obligations, not just a shorter string.

Each packet can include:

- source hashes and packet hashes
- required evidence obligations
- answer concepts that must survive compression
- omitted span manifests
- token before/after accounting
- verifier version and policy hash
- handoff id and certificate id
- open obligations such as missing evidence, required approval, or blocked connectors

A downstream agent can accept or reject a packet based on declared evidence and concepts. When obligations are missing, QuadChain supports selective rehydration: fetch the minimum source spans needed for repair instead of blindly expanding the whole context.

The research paper frames the boundary clearly: QuadChain is not a proof of semantic faithfulness and does not claim state-of-the-art prompt compression. It is a systems primitive for accountable, rejectable, selectively repairable agent memory.

Measured results from the paper:

- 4-agent workflow: 9,000 raw tokens to 2,283 routed tokens, a 74.63% reduction, with 41/41 required evidence items and 38/38 answer concepts preserved.
- Verified selective rehydration: 0.9390 deterministic task score with 88.89% mean token reduction and 210/240 accepted packets under matched budgets.
- Handoff smoke checks reject tampered Merkle roots, dropped required evidence, stale registry receipts, and invalid routes.

Private raw context, evidence strings, transcripts, screenshots, prompts, responses, credentials, and customer documents stay off public registries. Optional anchoring is limited to ids, hashes, Merkle roots, verifier versions, policy metadata, and handoff records.

## Key API Surfaces

| Surface | Purpose |
| --- | --- |
| `POST /api/core/run` | Shared runtime command contract for chat and queued audits |
| `GET /api/agent/describe` | Public external-agent descriptor for discovery and handoff metadata |
| `POST /api/agent/run` | External-agent entrypoint that delegates into the same core queue path |
| `GET /api/operator` | Workspace, memory, run, approval, capability, evidence, worker, and usage summary |
| `POST /api/ingest` | Stage or write company memory with scope and approval metadata |
| `POST /api/context/capture` | Normalize meeting, voice, chat, docs, or connector events into durable context signals |
| `GET /api/brain/graph` | Safe context graph with freshness, scope, relationship, and receipt summaries |
| `GET /api/playbooks` | Safe skill/playbook registry with guardrails, evidence requirements, approval tiers, and verifier checks |
| `POST /api/enterprise-proof` | Answer trust/security questions from brain memory plus connector documents |
| `GET /api/quadchain/packets` | List packet summaries for runs and handoffs |
| `POST /api/quadchain/verify` | Verify a packet certificate and declared obligations |
| `POST /api/publish/dry-run` | Stage connector writes only when capabilities and approval gates allow it |
| `POST /api/publish/execute` | Record approved connector execution receipts |
| `POST /api/voice/transcribe` | Transcribe voice, optionally remember it, then route through the shared chat runtime |
| `POST /api/jobs` | Queue website audit and enterprise proof runs for the worker |
| `GET /api/jobs/health` | Report queue depth, retries, dead letters, heartbeat, and canary status |

Hosted routes use the same bearer/api-key auth shape: `Authorization: Bearer $QUAD_API_SECRET` or `x-quad-api-key: $QUAD_API_SECRET`. Service tokens can be scoped by org and capability. Zero-key local mode stays available for demos through seeded data and in-memory fallbacks.

## Repository Map

```text
src/app/                  Next.js pages and API routes
src/components/           Dashboard, operator console, live logs, voice, QuadChain UI
src/lib/core/             Shared runtime facade and agent-loop traces
src/lib/brain/            Memory schema, ingest, retrieval, permissions, refresh, graph
src/lib/context-capture/  Event-to-memory signal extraction
src/lib/quad-chain/       Packet construction, verification, registry, metrics, workbench
src/lib/runs/             Runs, tasks, artifacts, approvals, receipts, access checks
src/lib/jobs/             Queue, worker, scheduler, canary
src/lib/fde/              Trust packets, verification, publishing, execution receipts
src/lib/metaregistry/     Capability catalog, install plans, runtime tool routing
src/lib/meeting/          Meeting intelligence and sourced follow-ups
src/lib/observability/    Runtime traces, evals, status, Sentry/Phoenix wiring
landing/                  Public site and research paper assets
docs/                     Backend schema, readiness notes, runbooks, gap plan
```

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs without hosted keys. Redis falls back to in-memory streams, the brain falls back to seeded demo data, and Browserbase falls back to static fetch. Add keys in `.env.local` to turn on durable storage, hosted events, model calls, voice, Browserbase, Sentry, and Phoenix.

To enable durable backend state:

```bash
npm run db:migrate:dry
npm run db:migrate
npm run db:status
```

Worker path:

```bash
npm run worker:preflight
npm run worker
npm run canary:worker
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

For a faster local gate, run:

```bash
npm run check
```

`npm run check:full` adds the Playwright e2e suite. `npm run sponsor:proof` returns a booth-safe manifest of live, fallback, and planned sponsor proof claims without printing secrets.

## Status

Quad currently ships the core loop: company brain, scoped retrieval, browser-grounded audit, run/event replay, approval ledger, QuadChain receipts, operator console, capability registry, worker queue, meeting/voice capture, and connector staging contracts.

The important remaining work is integration depth: more production connectors, full public long-context benchmarks for QuadChain, receiver-side rehydration in more routes, and live third-party publisher adapters beyond the current approval-backed execution records.
