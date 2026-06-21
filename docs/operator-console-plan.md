# Operator console plan

Last updated: 2026-06-21

## Goal

Make quad feel like a production ai employee platform by showing the work queue, approvals, receipts, and installed capabilities in one visible surface.

## What ships in this slice

- `/api/operator` aggregates safe operator state:
  - recent workflow runs
  - pending approvals
  - active capabilities
  - degraded or blocked capabilities
  - starter bundle coverage
  - safe artifact summaries
- dashboard operator console:
  - visual run cards
  - sidecar artifact panel with preview, data, and proof tabs
  - approval queue
  - capability grid
  - ascii workline
  - links from runs to `/quadchain?runId=...`
- playwright coverage for the visible operator surface.

## Artifact research

Claude-style artifacts are a sidecar pattern: the chat or operator work stays on the left while the generated artifact renders in a dedicated panel on the right.

Useful references:

- assistant-ui has an open-source Claude artifacts example for React side panels: https://www.assistant-ui.com/examples/artifacts
- LibreChat documents an artifacts feature for generated React, HTML, and Mermaid outputs: https://www.librechat.ai/docs/features/artifacts
- CodeSandbox Sandpack is the right later dependency if we want live-running code previews inside the artifact panel: https://sandpack.codesandbox.io/docs/advanced-usage/components

Decision for this ship: build the sidecar natively first because quad artifacts are run receipts, approvals, and proof summaries, not arbitrary untrusted user code yet. Add Sandpack only when the product needs executable artifact previews.

## Demo artifact

The dashboard should show a panel titled `Operator console`.

The visual story:

```text
audit --> packet --> approval --> publish
```

What judges should see:

- which run is live or waiting for approval
- whether the trust packet is ready or blocked
- which sponsor-backed capabilities are active
- where the proof trail lives
- what work should happen next
- what artifact is being produced by the ai employee

## Acceptance criteria

- after a mocked audit, the operator console is visible.
- pending approvals render without opening devtools.
- active and blocked capabilities are visible.
- a run links to its quadchain proof trail.
- artifact sidecar renders preview, data, and proof tabs.
- no raw packet content or env secrets are exposed.
- e2e tests cover the panel.

## Next after this

1. build dry-run publisher workbench.
2. add post-ship verification receipts.
3. add row-level tenant checks for artifact drilldown.
4. add booth-ready sponsor proof panels.
