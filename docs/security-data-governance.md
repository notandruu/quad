# security and data governance

## thesis

enterprise ai deals are blocked by data security before they are blocked by model quality.

quad's security posture should be:

> minimize what leaves the tenant, prove what left, isolate every customer, and make every action auditable.

large labs are expensive and sensitive. quad should not blindly send entire company brains, raw logs, source code, tickets, transcripts, or private messages to frontier models. the runtime should route only the minimum evidence needed for the task, redact sensitive material when possible, and attach receipts showing what context was used.

## security goals

1. protect customer data from cross-tenant leakage.
2. minimize data sent to model providers.
3. let enterprises choose the deployment/control level they need.
4. preserve provenance so outputs are auditable.
5. enforce permission-aware retrieval and action execution.
6. keep observability useful without leaking raw secrets or private content.
7. support enterprise diligence: soc 2 path, security questionnaires, audit logs, retention controls, and incident response.

## deployment tiers

quad should support multiple enterprise control levels.

### tier 1: shared cloud

best for early customers and demos.

- multi-tenant hosted quad
- strict org ids and row-level isolation
- encrypted storage
- provider api calls through quad gateway
- logs redacted by default

### tier 2: dedicated tenant

best for mid-market and serious security buyers.

- dedicated database/schema
- dedicated redis namespace or instance
- customer-specific secrets
- isolated background workers
- stricter data retention policies
- optional customer-managed model keys

### tier 3: customer vpc / private deployment

best for enterprise buyers.

- deployed in customer cloud or private vpc
- private network access to internal systems
- customer-owned keys
- customer-selected model providers
- no raw context leaves customer boundary unless explicitly configured
- optional private model or bedrock/azure/openai private endpoint

### tier 4: on-prem / air-gapped subset

future.

- local connectors
- local embeddings
- local or customer-hosted model
- no external model provider calls by default
- exportable proof packets only

## model provider strategy

quad should treat model providers as replaceable execution backends, not the system of record.

required controls:

- model gateway in front of every provider call
- per-org model routing policy
- per-workflow model allowlist
- no provider training on customer data
- configurable retention / zero-retention mode when provider supports it
- customer-owned api keys as an option
- prompt and response logging disabled or redacted by default
- strict payload size limits
- source minimization before model calls

the default should be:

> send the smallest verified evidence packet needed to answer the task, not the whole company brain.

## context minimization

quad chain is central to security.

instead of sending raw context, quad should:

1. retrieve candidate context.
2. filter by user/org permissions.
3. select the smallest evidence set needed.
4. redact secrets and irrelevant pii.
5. compress with quad chain.
6. verify required evidence survived.
7. send the compressed packet to the model.
8. store a certificate proving what was included and omitted.

this lowers cost and lowers blast radius.

## data classification

every source chunk and artifact should carry a classification:

- public
- internal
- confidential
- restricted
- secret
- personal
- regulated

model routing should depend on classification:

- public/internal can use standard hosted providers.
- confidential may require zero-retention or customer key.
- restricted/secret requires customer-approved provider or private deployment.
- personal requires explicit user scope and strong redaction.
- regulated requires customer policy and audit logging.

classification should flow into:

- retrieval filters
- prompt construction
- logging policy
- retention policy
- connector action policy
- approval policy

## tenant isolation

minimum requirements:

- every record has `orgId`
- every query scopes by `orgId`
- row-level security where possible
- per-org redis key prefixes
- per-org object storage prefixes
- per-org secret namespaces
- no cross-org cache keys
- no global vector search without permission filtering

vector retrieval must be permission-aware. retrieve broad candidates only inside the org boundary, then filter by source permissions before results are shown, learned, or sent to a model.

## connector security

connectors are the highest-risk surface.

metaregistry rules:

- no connector callable until installed, healthy, allowlisted, and scoped
- every connector declares scopes
- every tool declares autonomy tier
- write tools require approval policy
- per-user oauth is preferred for user-owned systems
- service accounts require explicit admin install and audit logs
- tokens are encrypted at rest
- token use is logged by connector, action, run id, and user id

for browser actions:

- sessions are ephemeral
- no persistent browser profile unless explicitly configured
- secrets are never typed into pages unless a connector policy allows it
- screenshots are classified and scoped
- final submit requires tier 3 approval

## prompt injection and tool safety

quad will read untrusted websites, docs, tickets, and files. all retrieved content should be treated as data, not instructions.

rules:

- source content cannot override system or developer policy
- tools are selected from metaregistry, not from page text
- connector write actions require structured intent and approval
- browser actions use declared selectors and previews
- suspicious page instructions are logged as risk signals
- model outputs that propose unsafe actions are blocked by policy

## observability without leakage

sentry, arize, logs, and replay are essential, but they must not leak raw customer data.

default logging policy:

- log run ids, org ids, event types, tool names, timings, status, error class
- redact secrets, tokens, api keys, auth headers, cookies
- avoid raw prompts/responses in shared telemetry
- store sensitive payloads only in customer-scoped storage
- use hashes and artifact ids in global logs
- allow per-org telemetry settings

arize traces should prefer:

- span names
- model/provider metadata
- token counts
- eval labels
- evidence ids
- certificate ids
- redacted snippets only when allowed

sentry should prefer:

- handled errors
- stack traces
- run context
- connector name
- no raw customer payloads by default

## approval and action security

every write/action needs:

- autonomy tier
- source evidence
- preview
- approver identity
- timestamp
- receipt id
- reversibility metadata
- post-ship verification

tier 3 actions require explicit approval:

- submit browser form
- send external message
- publish public content
- write to trust center
- modify shared company memory with high confidence impact
- delete/archive
- finance/legal/hr

## retention and deletion

enterprise customers need control:

- configurable retention by org and artifact type
- delete run artifacts
- delete or revoke learned memories
- disconnect connector and delete tokens
- export audit logs
- export memory receipts
- purge personal context on offboarding

quad chain certificates can remain as hashes/receipts even when raw context is deleted, as long as customer policy allows it.

## cost control is security control

large lab calls are expensive, but cost control also reduces data exposure.

strategies:

- retrieve less
- compress with quad chain
- use embeddings and cached evidence
- use small models for extraction/classification
- use frontier models only for high-value reasoning
- route by data classification
- cache stable trust packets
- pre-index sources
- stream and stop early when enough evidence exists

## enterprise security checklist

near-term:

- org-scoped data model
- secret redaction
- provider gateway
- model payload minimization
- connector allowlist
- approval policy for write tools
- audit logs
- telemetry redaction
- quad chain certificates

mid-term:

- dedicated tenant mode
- customer-managed keys
- per-org retention policy
- soc 2 controls
- sso/scim
- role-based admin console
- security questionnaire packet for quad itself

long-term:

- customer vpc deployment
- private model support
- external verification portal
- certificate root anchoring
- advanced dlp/classification

## killer line

> quad does not ask enterprises to trust a black-box agent with their company brain. it minimizes context, proves what was used, gates every write, and leaves an audit trail.

