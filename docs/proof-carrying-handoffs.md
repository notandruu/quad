# quad chain: proof-carrying context compression

## thesis

multiagent systems do not just need smaller context windows. they need trustworthy memory handoffs.

today, one agent can compress or summarize its trace and pass it to another agent, but the receiver has no reliable way to know what was deleted, whether critical evidence survived, or whether the handoff was tampered with.

quad chain is a proof-carrying context compression layer for multiagent llm workflows. it reduces the amount of information sent to an llm by compressing agent traces, code context, logs, conversations, evidence packets, and handoff memory while preserving the evidence needed for high-quality downstream outputs.

the core idea:

> compression should not just make context shorter. it should prove that the compressed context is still safe to use.

most compression systems output a shorter prompt and ask the next llm call to trust it. quad chain outputs a shorter prompt plus a proof certificate. that certificate verifies what source context the compression came from, what was deleted, what evidence survived, and whether the compressed packet still satisfies task-specific quality checks.

one-line pitch:

> quad chain compresses llm context and proves the compressed memory is still safe to trust.

## why this matters for quad

quad is becoming the runtime for company-aware ai employees. that runtime has many agents, tools, surfaces, and receipts:

- dashboard
- fetch/agentverse
- future cli
- browser action worker
- evidence collector
- enterprise proof agent
- publisher agent
- supervisor or evaluator agent
- future customer/auditor-facing verification surface

these agents constantly need to pass compact context to one another:

- a research agent hands evidence to an answer agent
- an answer agent hands verified answers to a browser action agent
- a browser action agent hands executed fields to a supervisor
- the dashboard hands a compressed run summary to fetch/agentverse
- a learned-memory receipt is stored for future retrieval
- a customer trust packet compresses many sources into one shareable artifact

if those handoffs are just summaries, important facts can disappear silently. quad chain turns compressed handoffs into verifiable artifacts.

## where it fits in the grand architecture

```text
quad
  = ai employee runtime

enterprise proof workflows
  = first wedge: security questionnaires, rfps, customer trust packets

agentverse / a2a
  = external agent surface and communication path

quad chain
  = proof-carrying compression and handoff trust layer

anchor registry
  = optional future tamper-evidence for cross-org verification
```

a2a lets agents communicate.

quad chain lets agents trust compressed memory.

## the four chains

quad chain is built around four linked chains of compression trust.

### 1. source chain

the source chain commits to the original context before compression.

it records hashes of:

- source trace
- live log events
- code snippets
- tool outputs
- browser evidence
- screenshots or screenshot refs
- retrieved brain memories
- source quotes
- eval outputs
- approval events

this creates a stable origin for the compressed packet without exposing private data.

in quad today, source-chain inputs map to:

- `PublishedEvent` redis events
- `AuditReport`
- `AuditFinding`
- finding evidence quotes/selectors/screenshots
- replay packet stats
- sponsor proof packet rows
- approval receipts
- browser render evidence
- future learned-memory receipts

### 2. compression chain

the compression chain commits to the compressed output.

it records:

- compressed context hash
- token estimate before compression
- token estimate after compression
- estimated tokens saved
- compression ratio
- omitted source ranges
- omitted event ids
- omitted evidence ids
- why each omission is safe or irrelevant

this shows exactly what information was removed and how much token budget was saved.

in quad today, this should attach to:

- audit brief copy text
- replay packet copy text
- sponsor proof packet copy text
- fix approval receipts
- future customer trust packet summary
- fetch/agentverse result summary

### 3. proof chain

the proof chain checks whether the compressed context is still useful for the downstream task.

it verifies:

- required evidence survived
- answer-critical concepts remain present
- source quotes still map to source hashes
- open obligations were not dropped
- needs-human items remain visible
- approval state was preserved
- task-specific quality checks pass

if the compressed context drops critical facts, the handoff is rejected instead of being sent blindly to the next llm call.

in quad today, proof-chain checks map to existing product logic:

- finding proof score
- approval gate
- hallucination-risk eval
- grounded/useful/duplicate eval
- proof packet sponsor rows
- workbench ready/blocked state
- publisher connected/dry-run/blocked state

### 4. anchor chain

the anchor chain makes the proof tamper-evident.

private context stays off-chain. only commitments can be anchored:

- certificate merkle root
- input hash
- output hash
- verifier version hash
- producer id
- handoff id
- timestamp

in the current product, this should start as a local registry or deterministic receipt. on-chain anchoring is future optional, useful only for cross-org, customer-facing, auditor-facing, or smart-contract workflows.

do not make blockchain core to the demo.

## certificate shape

every compressed run summary, proof packet, learned-memory receipt, or agent-to-agent handoff should be able to include a quad chain certificate:

```json
{
  "certificateId": "qchain_cert_...",
  "handoffId": "handoff_...",
  "runId": "run_...",
  "producer": "quad.enterprise_proof_agent",
  "consumer": "quad.publisher_agent",
  "createdAt": "2026-06-20T00:00:00.000Z",
  "sourceChain": {
    "inputHash": "sha256:...",
    "sourceHashes": ["sha256:..."],
    "eventIds": ["event_1", "event_2"],
    "artifactIds": ["artifact_1"]
  },
  "compressionChain": {
    "outputHash": "sha256:...",
    "tokensBefore": 4200,
    "tokensAfter": 1200,
    "tokensSaved": 3000,
    "compressionRatio": 0.286,
    "omittedRanges": [
      {
        "sourceId": "source_...",
        "rangeHash": "sha256:...",
        "reason": "not relevant to requested customer trust answer"
      }
    ]
  },
  "proofChain": {
    "answerReadinessScore": 1,
    "requiredEvidencePreserved": [
      {
        "evidenceId": "evidence_...",
        "sourceId": "source_...",
        "quoteHash": "sha256:...",
        "required": true
      }
    ],
    "answerConceptsPreserved": ["mfa", "encryption_at_rest", "access_review"],
    "openObligations": [
      {
        "kind": "needs_human",
        "claimId": "claim_...",
        "reason": "no supporting source found"
      }
    ],
    "accepted": true
  },
  "anchorChain": {
    "merkleRoot": "sha256:...",
    "registryReceipt": "local:qchain_receipt_...",
    "anchoredAt": null
  },
  "validator": {
    "name": "quad.chain.verifier",
    "version": "0.1.0",
    "policyHash": "sha256:..."
  }
}
```

## verifier rules

the local verifier should reject a handoff when:

- input hash does not match the original artifact bundle
- output hash does not match the compressed packet
- merkle root does not match the certificate bundle
- required evidence is missing
- answer-critical concepts are missing
- a preserved claim lacks a source or quote hash
- omitted ranges are undeclared
- validator policy version is unknown or stale
- open obligations were silently dropped
- producer or intended consumer does not match the task
- registry receipt is stale or missing when required

## alignment with what quad already has

quad already has most of the ingredients.

### live event spine

quad streams work through redis events and can replay runs. quad chain uses that stream as source-chain input.

integration:

- hash event payloads deterministically
- include event ids in certificates
- let replay packet show certificate id and accepted/rejected status

### evidence-backed findings

findings already include quotes, selectors, screenshots, comparisons, evals, confidence, severity, and approval gates.

integration:

- turn finding evidence into required evidence obligations
- hash quotes and screenshot refs
- reject compressed packets that drop required finding evidence

### finding proof score and approval gate

quad already blocks weak findings from approval. quad chain makes this portable across handoffs.

integration:

- convert approval gate result into proof-chain acceptance
- include proof score in answer-readiness score
- preserve blocked and needs-human states as open obligations

### replay packet

the replay packet is already a compact artifact summary. quad chain makes it verifiable.

integration:

- add `certificateId`, `tokensSaved`, `accepted`, and `openObligations` to replay packet output
- add tests that tampered packet hashes fail verification

### sponsor proof packet

the sponsor proof packet already summarizes Browserbase, Arize, Redis, Sentry, and Fetch proof. quad chain makes the sponsor packet itself auditable.

integration:

- source-chain hashes include proof rows and backend states
- proof-chain obligations require not claiming live integrations when fallback mode is active
- compressed sponsor proof summary must preserve missing-service caveats

### fix workbench and approval receipts

the workbench already turns findings into platform-native fixes and local approval receipts.

integration:

- every approval receipt gets a quad chain certificate
- browser action agent verifies the receipt before executing
- publisher agent rejects receipts missing approval state or evidence obligations

### fetch/agentverse bridge

fetch/a2a is an external surface over quad. it needs compact summaries, but compact summaries are risky.

integration:

- `/api/agent/run` returns a compressed run result plus quad chain certificate
- the uagent can report: "verified handoff accepted"
- later multiagent flow can reject bad handoffs before continuing

## integration plan

### phase 1: local schema and verifier

ship pure TypeScript logic first:

- `QuadChainCertificate`
- deterministic hash helper
- certificate builder for replay packets
- certificate verifier
- adversarial fixtures

tests:

- accepts valid compressed packet
- rejects tampered output hash
- rejects missing required evidence
- rejects stale verifier version
- rejects dropped needs-human obligation

### phase 2: attach to existing packets

attach certificates to:

- `buildReplayPacket`
- `buildSponsorProofPacket`
- `buildFixApprovalReceipt`
- future customer trust packet

ui:

- show "Verified by quad chain"
- show tokens saved
- show preserved evidence count
- show omitted ranges count
- show open obligations count
- copy certificate json

### phase 3: fetch and multiagent handoff

add quad chain to external handoffs:

- `/api/agent/run` returns certificate summary
- uagent response includes verified status
- future evidence agent -> action agent handoff requires certificate acceptance

### phase 4: optional registry / anchor

keep private context off-chain.

start with local registry:

- certificate id
- merkle root
- verifier version
- timestamp
- run id

future optional:

- external registry
- blockchain anchoring of roots only
- customer/auditor verification portal

## prototype metrics to preserve

current prototype claims:

- 867 estimated tokens saved across best compressed packets
- 41/41 required evidence items preserved
- 38/38 answer concepts preserved
- 1.000 answer-readiness score
- 5/5 proof certificates accepted
- 31 omitted source ranges recorded
- 4/4 multiagent verifier cases passed
- 3/3 adversarial handoffs rejected

these map directly to product proof:

- token savings proves efficiency
- required evidence preserved proves safety
- answer concepts preserved proves usefulness
- accepted certificates prove valid handoffs
- omitted ranges prove transparency
- adversarial rejects prove trust boundary

## product language

say:

- quad chain
- proof-carrying compression
- verified handoffs
- compressed context you can audit
- portable evidence receipts
- chain of custody for ai memory

do not lead with:

- blockchain
- token compression alone
- trustless ai
- merkle roots as the product

## killer lines

> compression without proof is just lossy memory.

> quad chain gives ai employees a chain of custody for context.

> a2a lets agents communicate. quad chain lets agents trust compressed memory.

> every compressed handoff says what survived, what was omitted, and why the next agent can trust it.

