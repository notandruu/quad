# Audit engine

How a URL becomes a set of trustworthy, source-backed findings, a grounded
executive summary, and recommended actions the user can approve.

## Pipeline

`runAudit` in [`src/lib/tools/auditAnalyzer.ts`](../src/lib/tools/auditAnalyzer.ts):

```
discoverPages        sitemap.xml, then same-origin homepage links (capped by limit)
  -> renderPage      Browserbase CDP render + screenshot; static fetch fallback
  -> retrieveMemories  internal brain context (top-k by cosine similarity)
  -> analyzePage     Claude returns JSON findings; ungrounded quotes stripped
  -> evaluateFinding LLM-as-judge (heuristic fallback) -> FindingEval
  -> quality gate    checkFinding hides anything ungrounded/useless/stale
  -> synthesize      rank top 5, model writes executive summary, derive actions
  -> persist report  AuditReport stored in Redis (runId:report) for chat follow-up
```

Every step emits a real Redis event and bumps a counter. The live log is never
faked and survives a refresh via the replay route.

## Embeddings

[`src/lib/brain/embeddings.ts`](../src/lib/brain/embeddings.ts) calls
`text-embedding-3-small` (1536-dim) via the OpenAI REST API when `OPENAI_API_KEY`
is set. Without it, a deterministic pseudo-embedding keeps retrieval exercisable
locally. Set the key; ship the real path.

## Database

[`src/lib/brain/db.ts`](../src/lib/brain/db.ts) lazily creates a `pg` pool and
exposes `ensureSchema()`, which idempotently runs
[`schema.sql`](../src/lib/brain/schema.sql) on first use. `ingestMemory` calls it
automatically.

`pingBrain()` checks liveness and returns latency. Surfaced by `/api/settings`.

## Audit prompt

[`src/lib/runtime/prompts.ts`](../src/lib/runtime/prompts.ts) builds three prompts:

| Function | Used by | Purpose |
| --- | --- | --- |
| `buildAnalyzePrompt` | `analyzePage` | Per-page: all 14 categories, brain context, headings, date rules, exact JSON schema |
| `buildSynthesisPrompt` | `synthesize` | Cross-findings executive summary |
| `buildAuditChatSystemPrompt` | `/api/chat` | Post-audit follow-up system prompt, grounded in stored report + brain |

## Grounding, twice

1. **At parse time** (`coerceFinding`): a model quote is kept only if it literally
   appears in the rendered page text. Stripped if absent, downgrading evidence to `comparison`.
2. **At eval time** (`evaluateFinding`): LLM-as-judge re-checks. `heuristicJudge` fallback.

The quality gate drops anything that fails either pass.

## The current-date rule

An `outdated_information` finding is rejected when its most recent referenced year
is the current year or later. See `contradictsCurrentDate` in `quality.ts` and its test.

## Post-audit chat

`/api/chat` checks for a `runId`. If present, it loads the `AuditReport` from Redis
(`audit:run:{runId}:report`) and injects it via `buildAuditChatSystemPrompt`, grounding
follow-ups in actual findings rather than hallucinated summaries.

## Recommended actions

`synthesize` derives one `RecommendedAction` per unique category (max 5):

| Category | Action type |
| --- | --- |
| `missing_faq` | `draft_faq` |
| `thin_page`, `missing_public_explanation` | `draft_page` |
| `internal_external_mismatch` | `save_memory` |
| everything else | `create_task` |

All actions are `requiresApproval: true`.

## Models and fallbacks

| Step | With key | Without key |
| --- | --- | --- |
| Embed | `text-embedding-3-small` (OpenAI) | deterministic hash vector (dev only) |
| Render | Browserbase + Playwright | static `fetch` |
| Analyze | Claude (`KALI_AUDIT_MODEL`) | heuristic internal-vs-external comparison |
| Evaluate | Claude LLM-as-judge | `heuristicJudge` (pure, unit-tested) |
| Summarize | Claude | fallback string with counts |

## Tests

```bash
npm test  # 44 tests across 7 files
```

Covers: quality gates (incl. ESPN regression), intent classifier, heuristic judge,
JSON extraction, Redis keys, embedding dimensionality + determinism + cosine
similarity, all three prompt builders (14 categories, brain injection, date rule,
heading structure, synthesis, chat system prompt).
