# quadchain token compression package

this folder contains the token compression research/demo package that should be handed into the quad repo as a self-contained artifact set.

## open first

- `demo/observability-demo.html`  
  plain black/white html. no css. shows raw trace vs quadchain packet, token counts, proof certificate, omitted spans, role routes, and a simulated sse stream.

- `reports/eval-report.md`  
  judge-facing summary of single-context compression, multiagent workflow savings, proof-carrying handoffs, large-context scale, and frontier benchmark metrics.

- `reports/benchmark-report.md`  
  research-methodology report with 2,880 paired benchmark rows across 20 cases, 12 methods, 4 budgets, and 3 seeds.

## headline metrics

| metric | value |
| --- | ---: |
| single-context input tokens | 2,250 |
| single-context quadchain tokens | 1,383 |
| single-context tokens saved | 867 |
| evidence preserved | 41/41 |
| answer concepts preserved | 38/38 |
| multiagent raw workflow tokens | 9,000 |
| multiagent quadchain routed tokens | 2,283 |
| multiagent workflow reduction | 74.63% |
| frontier benchmark rows | 2,880 |
| role payload evidence audit | 144/144 |
| receiver workflow reduction | 74.22% |

## directory map

| folder | contents |
| --- | --- |
| `demo/` | static observability demo |
| `papers/` | research paper and whitepaper, markdown + pdf |
| `reports/` | eval report and benchmark report |
| `results/` | machine-readable json/jsonl metrics |
| `scripts/` | source scripts that generated the observability demo and frontier benchmark |
| `assets/` | figures used by the papers |

## integration note

this is intentionally separate from the main next app. the next step, if we want it live inside quad, is to port `demo/observability-demo.html` into a route such as `src/app/quadchain/page.tsx` and stream real `PublishedEvent` records from the redis event spine instead of the current deterministic simulated sse log.

`src/app/quadchain/page.tsx` now ships the first live product surface: it renders the headline metrics and generates a verifier-backed trust packet using the app's `src/lib/quad-chain` implementation.

## reproducibility note

the generated reports and result files are included here. `scripts/frontier-benchmark.py` is archived as provenance, but it expects the original `token_diet*` research modules and `work/` fixture folders from the experiment workspace. it is not yet a standalone benchmark command inside this repo.

## honesty guardrail

the public benchmark-style adapters are local deterministic slices inspired by needle-in-haystack, ruler, and longbench-style tasks. they are not claims that the full external benchmark suites were downloaded and run.
