# Workstream ownership

This is the repo split for shipping quad without everyone colliding in the same files.

## Silas: dashboard and landing

Silas owns the visual product surface:

- `src/app/page.tsx` visual layout only after runtime props are stable.
- Future `src/app/(marketing)/**` or `src/app/landing/**`.
- `src/components/marketing/**`.
- `src/components/ui/**` primitives.
- `src/app/globals.css`, `docs/brand.md`, ASCII blossom/animation system.

Silas should avoid changing API contracts, event semantics, approval logic, or runtime state wiring unless coordinated with Stephen and Andrew.

## Maddy: deck, demo, and video

Maddy owns the investor/judge narrative:

- `docs/demo-script.md`.
- Future `docs/decks/**`.
- Future `docs/video/**`.
- Future `public/demo-media/**`.
- Screenshots, recordings, storyboards, voiceover beats, and Devpost submission copy.

Maddy should pull proof from generated artifacts instead of editing runtime files for narrative changes.

## Stephen: trust substrate

Stephen owns the core product spine:

- `src/lib/quad-chain/**`.
- Future `src/lib/runs/**`.
- Future `src/lib/security/**`.
- `src/lib/runtime/**`.
- `src/lib/observability/**`.
- `src/lib/redis/**`.
- Tenant isolation, data classification, approval ledger, model gateway, and proof certificates.

Stephen owns contracts first, because Andrew's workflows need one coherent substrate.

## Andrew: workflow and connector layer

Andrew owns the functionality that turns proof into shipped work:

- `src/lib/fde/**`.
- `src/lib/metaregistry/**` after the first contract lands.
- Future `src/lib/connectors/**`.
- Future `src/lib/publishers/**`.
- Future `src/app/api/agent/run/**`.
- Browser write path, trust packet builder, dry-run publishers, task/CMS/team update connectors, and Fetch.ai bridge.

Andrew should consume Stephen-owned contracts instead of inventing parallel run, approval, or proof schemas.

## Shared freeze zones

- Do not refactor `src/lib/types/**` without coordination.
- Do not remove dependencies from `package.json`; additive only.
- Keep dashboard copy sentence case.
- Keep external write actions in dry-run or human approval mode until an approval ledger exists.
