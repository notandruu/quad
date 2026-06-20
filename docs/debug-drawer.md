# Debug drawer

The "prove it's real" panel. A floating control (bottom-right) that polls
`GET /api/settings` and shows which backends are live, so judges can see the
stack is wired and not faked.

## How it works

- [`src/lib/debug/status.ts`](../src/lib/debug/status.ts) holds all presentation
  logic as pure functions: `summarizeBackends` maps the settings payload into
  ordered rows (live first), `isDemoReady` checks the demo-critical set
  (Redis + Browserbase), and `liveCount` powers the badge. Pure so it is
  unit-tested without rendering (`status.test.ts`).
- [`src/components/DebugDrawer.tsx`](../src/components/DebugDrawer.tsx) renders
  those rows, refreshes on open, and shows the active chat/audit model ids.

## What each row tells you

Every backend shows a live dot, the sponsor it proves out, and, when offline,
the fallback currently in play:

| Backend | Sponsor | Offline fallback |
| --- | --- | --- |
| Redis Streams | Redis | events stream inline, no replay |
| Browserbase render | Browserbase | static fetch, no screenshots |
| Postgres + pgvector | — | in-memory seed brain |
| Arize Phoenix | Arize | traces computed, not exported |
| Sentry | Sentry | spans no-op, no error reports |
| Moshi voice | Kyutai | voice disabled, text chat |

Because every backend has a working fallback, the app is fully usable with zero
keys; the drawer makes the difference between "demo-ready" and "running on
fallbacks" obvious at a glance.

## Extending

Add a backend by appending one entry to `ROWS` in `status.ts` and returning the
matching boolean from `app/api/settings/route.ts`. The drawer and tests pick it
up automatically.
