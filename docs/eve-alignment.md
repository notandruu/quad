# Eve alignment

Quad should stay on the current Next.js 14 app for this branch. The product already has a working App Router surface, lane-owned UI, api routes, observability hooks, and fallback backends. Eve is useful as a near-term architecture target, not as a rewrite during the demo push.

Source read: https://eve.dev/docs/introduction.md

## What matters from eve

Eve is a filesystem-first framework for durable TypeScript agents. Its core ideas map cleanly onto Quad:

| Eve concept | Quad equivalent today | Good next shape |
| --- | --- | --- |
| `agent/instructions.md` | `src/lib/runtime/prompts.ts` and employee framing | Move the stable Quad employee contract into a readable instruction file |
| `agent/agent.ts` | api route orchestration and model settings | Declare model, runtime options, and approval posture in one agent config |
| `agent/tools/` | `src/lib/tools/` | Keep audit actions as typed tools with narrow inputs and outputs |
| `agent/channels/` | chat bar, future Slack/email/voice entry points | Treat web, Slack, email, and voice as channels over the same employee |
| durable sessions | `src/app/api/sessions/`, Redis streams, run ids | Make every audit resumable after approval, refresh, or crash |
| approval pause | current proof-aware approval gate | Convert approval gates into true durable pauses when the backend lane is ready |
| hooks | Sentry, Phoenix, live logs | Emit lifecycle events once and fan out to logs, traces, evals, and dashboards |
| schedules | not built yet | Add recurring website drift checks after the live audit loop is stable |
| subagents | not built yet | Split research, browser evidence, copy drafting, and qa into specialist workers later |

## Product call

Do not migrate the app to eve in this PR. The best move is to make Quad eve-compatible by design:

1. Keep presentation and proof logic pure and tested.
2. Keep tools typed and narrow.
3. Keep sessions durable and replayable.
4. Keep human approval as an explicit pause before external actions.
5. Keep logs, evals, and traces emitted from one lifecycle stream.

That gives Quad a credible path to an eve agent without breaking the current demo.

## What to build next

1. Add an `agent/` mirror only when the app has stable backend contracts.
2. Start with `agent/instructions.md`, `agent/agent.ts`, and typed wrappers around existing audit tools.
3. Map the current web app to an eve web channel instead of duplicating business logic.
4. Turn the approval gate into a durable pause/resume state.
5. Add schedules for recurring drift audits.

The strongest framing: Quad is already an AI employee product. Eve can become the durable agent packaging layer once the product spine is proven.
