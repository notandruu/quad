# fde fetch plan adversarial audit

## verdict

the plan has one winning idea: quad learns while doing real work. the sparse brain -> collect evidence -> grounded answer -> judge -> writeback loop is genuinely stronger than the current website gap demo.

the product ambition should be much bigger than a hackathon demo: quad is a production ai employee platform. the demo slice exists to prove the operating system: goal intake, scoped memory, tool use, evidence collection, self-improving validated knowledge, approvals, browser execution, observability, and replayable accountability.

the plan still tries to ship too many proof surfaces at once: fetch eligibility, security questionnaire automation, browser form writing, multi-agent orchestration, payment protocol, devpost packaging, and a new b2b narrative. that is how the production story gets diluted. the right move is to preserve the existing audit product, add the smallest fetch-compatible entrypoint, then build the fde learning loop as the first production-grade workflow on top of durable platform primitives.

the bar is not "working demo." the bar is "credible autonomous employee substrate with one complete, shippable compliance workflow."

## production north star

quad should become the runtime for company-aware ai employees:

- durable org-scoped memory with provenance, permissions, confidence, embeddings, and writeback policy
- tool execution runtime with browser, repo, docs, ticket, policy, and publisher connectors
- evidence ledger where every answer, action, and learned memory is replayable
- validation gates before memory mutation or external action
- human approval controls with receipts, edits, rejects, and audit trails
- multi-agent orchestration as a runtime capability, not a hackathon-only wrapper
- observability for every model call, tool call, browser session, retry, failure, and quality eval
- secure tenant isolation, secret handling, rate limits, and permission-aware retrieval
- production deployment posture: background jobs, resumability, idempotency, retries, queues, metrics, and incident visibility
- usable operator experience: dashboard, live logs, run history, diffable brain changes, and clear escalation states

the compliance questionnaire is the first serious wedge because it exercises the whole system. later workflows should reuse the same substrate: website audits, rfp responses, customer security reviews, sales engineering packets, onboarding checklists, policy updates, and support operations.

enterprise devex reference: `docs/enterprise-devex-runtime.md`.

production quad should follow the mature internal-platform pattern:

- one core runtime, many equal surfaces
- dynamic tool catalog assembled per user, org, workflow, connector health, and permission scope
- registered connector and agent catalog with allowlist gates
- skill/playbook wrappers over raw tools so guardrails are not bypassed
- normalized task stream consumed by dashboard, external agents, future cli, ide, chat, and voice
- specialist agents with capability cards, descriptions, examples, health, and versioning
- permission-aware enterprise context retrieval across pre-indexed and live-queried sources

fetch/agentverse is one surface. the dashboard is one surface. a future cli is one surface. none of them should own hidden product logic.

## highest-risk assumptions

1. fetch eligibility is not the same as winning fetch.
   a mailbox uagent with chat protocol may make the project eligible, but judges will still look for a useful agent that turns intent into an executed outcome. a thin wrapper over the existing website audit is a safety net, not a final story.

2. asi:one discovery is a live external dependency.
   direct handle invocation is a necessary fallback. discovery can fail for reasons outside the app. the demo must have a recorded proof path and profile urls ready.

3. "everything real, nothing faked" needs production scoping.
   real agentverse registration plus real browser write path plus real writeback plus real approval plus live form submit is fine. three registered agents and payments are production roadmap capabilities, but they should not destabilize the core workflow until phases 0 to 2 are proven.

4. the customer/narrative pivot is expensive.
   the current repo is brightpath nonprofit website audit. the proposed plan says b2b startup security questionnaire but also calls the customer "brightpath". that naming collision will confuse judges and code. either rename the fde demo org to a b2b startup or explicitly make brightpath a b2b company. do not mix nonprofit impact copy with vendor-security compliance.

5. "brain grows from 3 to 12" is only credible if the ui proves causality.
   a graph with more dots is not proof. each learned node needs source id, quote, validation status, and reuse evidence. at least one later question must visibly say it reused a memory learned earlier in the run.

6. writeback is the trust boundary.
   if failed or unsupported answers can enter memory, the product becomes a hallucination amplifier. this must be enforced in code, tested, logged, and shown in the ui.

7. browser form fill is the riskiest sponsor beat.
   if browserbase live view is unstable, the demo still needs a local controlled form, event logs for every field fill, a pre-recorded fallback, and a dashboard outcome card.

8. payment protocol is not the product core.
   monetization matters, but the product moat is trusted autonomous work. payments should come after the learning loop, action layer, and governance layer are credible.

## required reframing

quad should not become "a compliance chatbot." it should become:

> a forward-deployed ai employee that completes customer-facing operational work, collects missing evidence as it goes, learns only validated controls, and executes approved actions in the browser.

security questionnaires are the demo wedge because the roi is obvious:

- painful, repetitive enterprise-sales blocker
- evidence scattered across repo, infra, policies, and tickets
- answers must be grounded and auditable
- completed output has a clear done state
- learned controls compound across future questionnaires

## revised execution order

### phase 0, fetch wrapper around the current product

do this first, but keep it intentionally thin as an integration adapter. the next.js app remains the production control plane.

must ship:

- `agent/` python uagent process
- chat protocol messages and acknowledgements
- mailbox mode and manifest publishing
- `/api/agent/run` in next.js that calls existing audit flow or returns a run handle
- agent readme with name, address, capability, and innovation lab badge
- proof that direct handle invocation from asi:one reaches the app
- normalized task summary contract that future surfaces can reuse

do not ship:

- multi-agent split
- payments
- new compliance logic
- browser write path

done means fetch-eligible safety net exists while the current dashboard still works and the agent boundary is ready to call future production workflows.

### phase 1, first production fde learning workflow

build a focused security questionnaire runner on top of reusable platform primitives. do not hard-code it as a one-off demo script.

must ship:

- sparse b2b startup seed brain with no more than three memories
- 8 to 10 local evidence artifacts under repo-owned data
- deterministic questionnaire fixture
- `answerQuestion()` loop with retrieve, collect, ground, evaluate, writeback
- redis events: `question.started`, `brain.retrieved`, `context.collected`, `answer.drafted`, `answer.evaluated`, `brain.learned`, `answer.needs_human`
- tests proving failed answers do not persist
- ui proof that a later question reused a learned control
- workflow represented as a skill/playbook over shared runtime primitives, not a bespoke demo route
- evidence artifacts normalized as connector documents so real enterprise connectors can replace fixtures later

done means the product visibly learns during one run without poisoning memory.

production-grade acceptance means:

- learned controls have stable ids, source references, validation metadata, timestamps, and org scope
- writeback is idempotent and can be replayed or rejected
- retrieval can distinguish seed memories from learned memories
- failures produce needs-human states instead of hidden nulls
- the same loop can later support another workflow without rewriting the runtime

### phase 2, controlled browser write path

only after phase 1 is stable. this is the action layer for the ai employee, not a form-filling trick.

must ship:

- `/demo-questionnaire` controlled form
- browserbase/playwright fill path for validated answers only
- field-level action events
- human approval gate before submit
- dashboard summary with answered count, evidence sources, needs-human count, brain growth
- recorded fallback capture

done means the audience watches quad do real browser work after learning real evidence.

production-grade acceptance means:

- every browser action has an intent, selector, value summary, source answer id, approval state, and replay event
- submit is impossible without approval
- failed fields are recoverable and visible
- the action API can support future websites, not only the controlled demo form

### phase 3, multi-agent split

only if phases 0 to 2 are already green. this should become production orchestration, not theater.

acceptable implementation:

- orchestrator agent facing asi:one
- evidence agent wrapping the fde loop
- action agent wrapping browser fill

do not duplicate business logic. agents call the same next.js api.

### phase 4, payment

defer by default. add only if it proves a real commercial workflow without compromising trust, action reliability, or submission readiness.

### phase 5, submission

this is not last-minute polish. it is eligibility work.

must ship:

- shared asi:one chat url
- agentverse profile urls
- public repo instructions
- demo video
- concise writeup
- badges and agent addresses
- rehearsed dashboard and asi:one paths

## kill criteria

cut multi-agent if phase 0 direct asi:one handle is not reliable.

defer payment unless phases 0 to 2 are complete and rehearsed.

cut live external integrations beyond browserbase, redis, supabase, anthropic, openai, sentry, and arize.

cut any feature that does not strengthen one of these claims:

- fetch can invoke quad as an agent
- quad learns validated knowledge during work
- every learned memory has evidence
- quad executes approved browser work
- the existing dashboard still works
- the same runtime can support many future ai employee workflows

## minimum winning demo

1. judge asks asi:one to complete a vendor questionnaire for a startup.
2. asi:one calls quad's registered agent.
3. quad starts with sparse memory.
4. dashboard shows questions, evidence collection, validation, and new learned controls.
5. one later question reuses a learned memory.
6. browserbase fills a controlled questionnaire form.
7. human approves submit.
8. asi:one receives the completed outcome summary.

this is enough. everything else is garnish.
