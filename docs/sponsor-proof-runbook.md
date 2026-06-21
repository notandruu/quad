# Sponsor proof runbook

## Goal

Use this as the source of truth before talking to sponsor judges. Quad should only claim integrations that are live in the current environment.

## Commands

```bash
npm run sponsor:proof
```

Or open:

```text
GET /api/sponsor/proof
```

## How to demo

1. Start with `/api/sponsor/proof`.
2. Read from `safeToClaim` when talking to judges.
3. Read from `doNotClaim` before editing slides or booth copy.
4. Use `demoRunbook.sequence` as the booth order.
5. For fallback rows, show the product surface but say the hosted credential is not live in this environment.

## Booth rules

- Do not show env values, api keys, dsns, service tokens, cookies, or connector credentials.
- Do not claim Arize, Sentry, Browserbase, Redis, Deepgram, Fetch.ai, or OpenAI unless the sponsor row is `live`.
- If a sponsor asks how it works, show the listed `routeOrSurface` and `demoMoment`.
- If wifi is bad, use the backup video and the saved output from `npm run sponsor:proof`.

## What judges should see

- A live product moment for every claimed sponsor.
- A safe manifest that separates live, fallback, and planned integrations.
- No secret leakage in the manifest or terminal output.
- Clear proof that sponsor tech is part of the actual product flow, not a decorative add-on.
