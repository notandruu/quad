# enterprise devex runtime

quad should borrow the proven enterprise pattern from mature internal ai developer platforms without copying private implementation details into the repo.

## core lesson

the product is not a single workflow. it is an orchestration platform:

- many equal surfaces: dashboard, cli, ide, slack, email, voice, and external agents
- one core runtime: identity, session state, memory, tool catalog, routing, execution, streaming, observability
- security gateway: tenant isolation, data classification, model routing, redaction, retention, and audit
- connector ecosystem: source systems become tools through registered adapters
- metaregistry: installable capabilities, tools, skills, agents, publishers, policies, and health
- specialist agents: domain agents expose capability cards and call back into the same runtime
- skills: playbooks wrap raw tools with guardrails, examples, and synthesis rules
- live stream everywhere: every surface consumes the same task event stream

the compliance questionnaire workflow should prove the runtime, not replace it.

## production architecture principles

### company, team, and personal context

quad should not collapse every memory into one shared company brain. production trust requires scoped context:

- company context: strategy, policies, public facts, security controls, roadmap, decisions; broadly readable, tightly governed writes
- team context: projects, blockers, sprint state, runbooks, ownership, recent decisions; readable by team members, aggregated upward
- personal context: user preferences, current focus, private notes, drafts, working style, personal agent history; private to the user and their agent

managers should see aggregate team signals, not private personal context. the product must make this boundary obvious in data models, retrieval filters, and ui.

### context capture pipeline

the long-term moat is live, accurate context. ingestion should be event-driven:

- source event arrives from a connector or webhook
- redis stream queues it for processing
- context extractor classifies whether it is signal or noise
- high-confidence signals update structured context or vector chunks
- weekly or scheduled synthesis catches patterns that individual events miss
- every update keeps source references, confidence, timestamps, and scope

start conservative. noisy memory is worse than sparse memory.

### one core, many surfaces

every surface should be a peer client over the same run/task stream:

- web dashboard for operators and demos
- cli for developers and forward-deployed engineers
- future ide extensions for codebase-grounded work
- slack/teams/email for ambient workflows
- fetch/agentverse for external agent discovery
- voice for live operator sessions

no surface gets its own hidden business logic. surfaces start runs, subscribe to events, render artifacts, collect approvals, and send follow-up input.

### dynamic tool catalog

quad should not hard-code every possible connector into prompts. the runtime should assemble available tools per org, user, workflow, and permission scope:

- metaregistry is the source of truth for installed capabilities
- eager tools for hot paths
- deferred tools for large or rarely used connector schemas
- explicit allowlist before any connector or agent is callable
- tool descriptions and examples treated as routing-critical product copy
- health state included in routing so broken tools are avoided

one click should be able to install a capability, attach scopes and approval policy, run a health check, and update the active tool catalog without changing the core runtime.

see `docs/metaregistry-plugin-system.md`.

### skills over raw tools

raw tools are dangerous when called directly. production workflows should expose skill/playbook wrappers that add:

- parameter validation
- retrieval and citation rules
- safety checks
- approval gates
- fallback behavior
- synthesis format

for quad, the security-questionnaire workflow should be a skill over reusable primitives: retrieve, collect, ground, evaluate, write back, fill browser, request approval.

### agent cards and capability registry

specialist agents should advertise capability cards with:

- name
- description
- endpoint
- version
- input and output modes
- skills with tags and examples
- health status
- allowlist status

the router should use deterministic matching for explicit calls, then semantic routing over descriptions/examples when intent is ambiguous.

### task stream as the product spine

every run should emit a normalized event stream:

- status update
- text delta
- tool use
- tool result
- artifact update
- approval requested
- approval resolved
- memory learned
- action executed
- complete or failed

the same stream should drive web, cli, agentverse responses, observability, replay, and demo artifacts.

### quad chain

compressed run summaries and agent handoffs should not be trusted just because another agent produced them.

quad should use quad chain proof-carrying compression for compressed packets:

- audit briefs
- customer trust packets
- approval receipts
- learned memory receipts
- fetch/agentverse result summaries
- future multi-agent handoffs

each handoff should carry hashes of the input artifact bundle and compressed output, preserved claim ids, source references, declared omitted ranges, open obligations, verifier version, producer id, and timestamp.

receiving agents or surfaces should be able to verify the packet before trusting it. this keeps summaries compact without turning the runtime into a lossy game of telephone.

### enterprise context retrieval

quad's company brain should become a permission-aware enterprise context layer:

- pre-index stable sources such as docs, repos, policies, and historical tickets
- live-query dynamic sources such as recent tickets, chat, email, and incidents
- normalize every result into a common document/chunk schema
- use content-aware chunking: code by function, docs by headings, tickets by issue, chat by thread
- combine dense vector search with sparse keyword/entity search
- apply per-user permission filtering before answers are shown or learned
- enrich chunks with related prs, tickets, owners, policies, and timestamps

### trust boundaries

production quad must treat these as hard boundaries:

- user and org identity
- tenant isolation
- data classification
- model provider routing
- permission-aware retrieval
- company/team/personal memory scope
- connector allowlists
- validation before writeback
- approval before external action
- idempotent memory mutation
- audit log for every tool and browser action
- no learned memory without source evidence and validation metadata
- no manager or admin access to personal context without explicit user consent and product-visible audit

see `docs/security-data-governance.md`.

### model and data security

quad should not send whole company brains to model providers by default.

the runtime should:

- classify source chunks and artifacts
- retrieve only the minimum evidence needed
- redact secrets and irrelevant personal data
- compress with quad chain before expensive model calls when possible
- route calls through a model gateway with per-org policy
- support customer-owned keys and dedicated/private deployment tiers
- keep raw payloads out of shared telemetry
- preserve audit receipts showing what context was used

### autonomy tiers

quad should encode action autonomy as product policy:

- tier 1, auto-execute: read, search, summarize, draft, create local artifacts, update private state
- tier 2, draft and confirm: send messages, update tickets, create assigned tasks, write shared docs, update shared team state
- tier 3, prepare and explicit approve: external-facing, legal, finance, hr, irreversible, delete/archive, customer commitments

every action should record reversibility:

- reversible actions include undo metadata and an undo window
- irreversible actions require stronger confirmation and a richer receipt
- approvals should be artifacts in the run ledger, not transient button clicks

### latency strategy

enterprise devex lives or dies on perceived speed:

- parallelize session, settings, tool catalog, and retrieval setup
- stream partial status immediately
- fan out to sources with deadlines
- return pre-indexed results before slow live connectors finish
- use entity fast paths for ticket ids, urls, file paths, and exact errors
- cache health, permissions, tool metadata, embeddings, and stable retrieval results

## quad implications

1. `/api/agent/run` should be a runtime entrypoint, not a one-off fetch hack.
2. the fde compliance loop should emit normalized task events that web and agentverse can both consume.
3. learned controls should be artifacts in the same run ledger as findings, approvals, and browser actions.
4. publisher connectors should become registered adapters with health, scopes, and allowlist status.
5. the debug drawer should evolve into an operator control plane: services, connectors, agents, permissions, queue health, eval health, and last failure.
6. a future cli should be a first-class surface for forward-deployed engineers, not a script wrapper.
7. every product workflow should be expressible as a skill/playbook over shared runtime primitives.
8. the company brain should become a scoped context graph, not a flat memory bucket.
9. the fde compliance workflow should learn company controls, while user-specific preferences and private work history stay personal.
10. every memory writeback should include scope, owner, source, confidence, validation status, and stale-after metadata.
11. compressed packets and agent handoffs should use quad chain certificates as described in `docs/proof-carrying-handoffs.md`.
12. installable capabilities should be managed through the metaregistry described in `docs/metaregistry-plugin-system.md`.
13. enterprise data security should follow `docs/security-data-governance.md`: minimize context, prove what left, isolate tenants, and gate every write.
