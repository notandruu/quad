# quadchain frontier benchmark report

this report turns the quadchain demo into a research methodology: paired downstream scoring, budget-matched baselines, role evidence audits, executable receiver tasks, bootstrap confidence intervals, and explicit provenance for public-benchmark-style adapters.

## headline

- eval cases: 20 across 4 dataset adapters.
- benchmark rows: 2,880 = cases x methods x budgets x seeds.
- quadchain mean task score: 0.6350 with ci95 [0.5987, 0.6782].
- raw all-budget upper-bound task score: 0.8679; quadchain all-budget stress delta vs raw: -0.2329.
- quadchain-native budget delta vs raw at the same budget gate: 0.0500.
- quadchain mean token reduction: 57.85%.
- role evidence audit: payload 144/144, final prompt 144/144, leakage delta 0.
- executable role task success: raw 50.0%, quadchain 75.0%, workflow savings 74.22%.

## method frontier

| method | rows | mean task score | ci95 | mean output tokens | mean reduction | accepted |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| `bm25_keyword` | 240 | 0.8645 | [0.8404, 0.886] | 1347.59 | 57.66% | 90/240 |
| `embedding_topk_proxy` | 240 | 0.8638 | [0.8398, 0.8857] | 1348.68 | 57.65% | 87/240 |
| `head_truncation` | 240 | 0.6005 | [0.5641, 0.6439] | 1342.76 | 57.85% | 27/240 |
| `llm_summary_proxy` | 240 | 0.8787 | [0.8533, 0.9035] | 62.12 | 92.08% | 69/240 |
| `llmlingua2_proxy` | 240 | 0.6350 | [0.5987, 0.6782] | 1342.78 | 57.85% | 42/240 |
| `middle_truncation` | 240 | 0.5703 | [0.5371, 0.609] | 1337.30 | 58.68% | 27/240 |
| `protected_span_only` | 240 | 0.8950 | [0.8723, 0.9186] | 75.86 | 91.84% | 75/240 |
| `quadchain` | 240 | 0.6350 | [0.5987, 0.6782] | 1342.78 | 57.85% | 42/240 |
| `random_deletion` | 240 | 0.4994 | [0.4667, 0.5472] | 1369.64 | 57.19% | 29/240 |
| `raw` | 240 | 0.8679 | [0.8562, 0.8772] | 3221.85 | 0.0% | 240/240 |
| `selective_context_proxy` | 240 | 0.6249 | [0.5881, 0.6653] | 1256.01 | 59.23% | 27/240 |
| `tail_truncation` | 240 | 0.5942 | [0.5537, 0.6399] | 1342.70 | 57.85% | 39/240 |

## paired baseline comparisons

| baseline | wins | losses | ties | mean score delta | ci95 |
| --- | ---: | ---: | ---: | ---: | --- |
| `head_truncation` | 51 | 0 | 189 | 0.0345 | [0.025, 0.0466] |
| `middle_truncation` | 111 | 69 | 60 | 0.0647 | [0.0228, 0.1055] |
| `tail_truncation` | 108 | 69 | 63 | 0.0408 | [-0.0084, 0.0903] |
| `random_deletion` | 120 | 40 | 80 | 0.1356 | [0.0984, 0.1771] |
| `bm25_keyword` | 48 | 141 | 51 | -0.2295 | [-0.2649, -0.1909] |
| `embedding_topk_proxy` | 48 | 141 | 51 | -0.2288 | [-0.2647, -0.1894] |
| `llm_summary_proxy` | 54 | 135 | 51 | -0.2438 | [-0.2775, -0.2023] |
| `protected_span_only` | 9 | 141 | 90 | -0.2600 | [-0.2933, -0.2216] |
| `llmlingua2_proxy` | 0 | 0 | 240 | 0.0000 | [0.0, 0.0] |
| `selective_context_proxy` | 33 | 15 | 192 | 0.0101 | [-0.0001, 0.0209] |

## role evidence audit

| target | role | payload | certificate | final prompt | leakage delta | pass |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 1,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 1,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 1,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 3,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 3,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 3,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 3,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 10,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 10,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 10,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 10,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 30,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 30,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 30,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 30,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 100,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 100,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 100,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 100,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 300,000 | `researcher` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 300,000 | `implementer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 300,000 | `reviewer` | 6/6 | 6/6 | 6/6 | 0 | `true` |
| 300,000 | `judge_presenter` | 6/6 | 6/6 | 6/6 | 0 | `true` |

## executable receiver tasks

| role | method | tokens | fields recovered | success |
| --- | --- | ---: | ---: | --- |
| `researcher` | `raw` | 392 | 3/3 | `true` |
| `researcher` | `quadchain` | 339 | 3/3 | `true` |
| `implementer` | `raw` | 1858 | 4/4 | `true` |
| `implementer` | `quadchain` | 1156 | 4/4 | `true` |
| `reviewer` | `raw` | 2250 | 0/3 | `false` |
| `reviewer` | `quadchain` | 113 | 1/3 | `false` |
| `judge_presenter` | `raw` | 2250 | 0/4 | `false` |
| `judge_presenter` | `quadchain` | 132 | 4/4 | `true` |

## validity notes

- this is an offline deterministic harness, not a claim that full swe-bench, longbench, ruler, or needle-in-haystack were downloaded and run.
- public-benchmark-style adapters are labeled in every case file so we do not overclaim.
- exact evidence scoring is intentionally paired with receiver task success; future api runs should add solver outputs and blinded llm judges.
- proxy rows for llmlingua-2 and selective context are placeholders for apples-to-apples adapters, not official package results.

## why this is better

the old eval proved that one curated packet could preserve known facts. this methodology asks the harder question: at the same token budget, across multiple task families and role routes, does quadchain preserve enough verified evidence for downstream work while rejecting unsafe handoffs? that is the research-grade version of the claim.
