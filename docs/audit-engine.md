# Audit engine

How a URL becomes a set of trustworthy, source-backed findings.

## Pipeline

`runAudit` in [`src/lib/tools/auditAnalyzer.ts`](../src/lib/tools/auditAnalyzer.ts) drives the run:

```
discoverPages        sitemap.xml, then same-origin homepage links (capped by limit)
  -> renderPage      Browserbase CDP render + screenshot, static fetch fallback
  -> retrieveMemories  internal brain context for this page
  -> analyzePage     Claude returns JSON findings; ungrounded quotes are dropped
  -> evaluateFinding LLM-as-judge (heuristic fallback) -> FindingEval
  -> quality gate    checkFinding hides anything ungrounded/useless/stale
  -> synthesize      rank, take top 5, compute metrics -> AuditReport
```

Every step emits a real Redis event (`audit.*`, `page.*`, `finding.*`) and bumps a
counter, so the live log is never faked and survives a refresh via the replay route.

## Grounding, twice

Findings are checked for grounding in two independent places, by design:

1. **At parse time** (`coerceFinding`): a model-supplied quote is kept only if it
   literally appears in the rendered page text. A hallucinated quote is stripped,
   which downgrades the finding's evidence to `comparison`.
2. **At eval time** (`evaluateFinding`): the judge re-checks groundedness and
   usefulness and assigns a hallucination risk.

The quality gate (`checkFinding`) then drops anything that fails either pass.

## The current-date rule

The single most important correctness guarantee. An `outdated_information` finding
whose most recent referenced year is the current year or later is rejected, because
that is the failure mode where an audit calls current or future content "stale"
(for example, flagging a 2026 copyright as outdated in 2026, or suggesting a
downgrade to 2024). A genuinely stale finding points at a year older than now.

See `contradictsCurrentDate` in [`src/lib/runtime/quality.ts`](../src/lib/runtime/quality.ts)
and its tests in `quality.test.ts`.

## Models and fallbacks

Each external dependency has a working fallback so the pipeline runs with zero keys:

| Step | With key | Without key |
| --- | --- | --- |
| Render | Browserbase + Playwright | static `fetch` + regex extraction |
| Analyze | Claude (`KALI_AUDIT_MODEL`) | deterministic internal-vs-external comparison |
| Evaluate | Claude LLM-as-judge | `heuristicJudge` (pure, unit-tested) |
| Embed | embeddings API | deterministic hash vector (dev only) |

## Tests

```bash
npm test
```

Covers the quality gates (including the ESPN regression), the intent classifier,
the heuristic judge, JSON extraction tolerance, and Redis key namespacing.
