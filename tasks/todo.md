# quad product + hackathon alignment

## checklist

- [x] read `/Users/stephenhung/Downloads/HACKATHON_PLAN.md`
- [x] search gmail for ai hackathon 2026 logistics and sponsor emails
- [x] research current public sponsor/event pages
- [x] identify sponsor-aligned demo strategy for quad

## review

quad is not a throwaway hackathon build. quad should be designed as a production product that happens to have a hackathon launch/demo deadline.

the core product is a company-aware ai employee platform: it audits a company's website against an internal company brain, streams the work live, and turns evidence-backed gaps into approved work. the hackathon constraint should force focus and polish, not lower the bar.

the product bar:

1. real users can onboard an org, add sources, and run repeatable audits.
2. every claim is source-backed, permission-aware, and replayable.
3. failures are visible, recoverable, and debuggable.
4. memory is durable, scoped by org, and safe to update only after approval.
5. the system can keep improving after the hackathon without a rewrite.

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
- [ ] company brain ingestion for docs, notes, urls, and transcripts
- [ ] durable memory store with source provenance, confidence, permissions, and embeddings
- [ ] audit run model with lifecycle states, retries, and resumability
- [ ] redis event stream and replay for every run
- [ ] browserbase rendered evidence capture
- [ ] grounded finding schema with citations and screenshots/selectors where possible
- [ ] approval workflow before memory writeback or external action
- [ ] post-audit chat that can cite audit evidence and company memory
- [ ] arize tracing/evals for retrieval, page analysis, and final findings
- [ ] sentry monitoring for api routes, workers, browser sessions, redis calls, and model calls
- [ ] billing/usage posture, even if only internal metering at first
- [ ] seed demo org that feels like a real nonprofit/smb customer, not fake hackathon filler

## next build plan

- [ ] implement real redis streams for audit events and replay
- [ ] use browserbase for rendered page capture, screenshots, visible text, selectors, buttons, images, and forms
- [ ] require every finding to include url, quote/dom snippet, confidence, severity, and recommended fix
- [ ] add arize phoenix tracing/evals for page analysis, retrieval, and final findings
- [ ] add sentry traces/errors for api routes, audit worker, browser sessions, model calls, and redis calls
- [ ] build the launch demo around one nonprofit/smb scenario with internal docs that disagree with the public website
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
