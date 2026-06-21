# quadchain eval report

quadchain is not summarization. it is compression with measurable downstream preservation and cryptographic handoff verification.

## headline metrics

| eval | raw tokens | quadchain tokens | saved | reduction | evidence | answer concepts | safety |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| single-context compression | 2,250 | 1,383 | 867 | 38.53% | 41/41 | 38/38 | answer-ready 1.000 |
| multiagent workflow | 9,000 | 2,283 | 6,717 | 74.63% | 41/41 | 38/38 | route proof enforced |
| measured large-context compression | 115,038 | 74,813 | 40,225 | 34.97% | 12/12 | n/a | 10k + 100k traces |
| scale ladder aggregate | 1,858,850 | 605,450 | 1,253,400 | 67.43% | 36/36 | n/a | actual role prompts |
| frontier benchmark harness | n/a | n/a | n/a | 57.85% mean | 144/144 | task score 0.6350 | 2,880 paired rows |

## baseline comparison

- quadchain/token diet preserves 41/41 evidence and 38/38 answer concepts.
- strongest same-budget naive baselines preserve 41/41 evidence and 36/38 answer concepts.
- baseline failure rows: 20/25.
- tested methods: `naive_even_lines`, `naive_head`, `naive_middle`, `naive_random_lines`, `naive_tail`, `token_diet`.

| input | best naive method | evidence | concepts | answer-ready |
| --- | --- | ---: | ---: | ---: |
| `agent-trace.md` | `naive_head` | 8/8 | 7/8 | 0.956 |
| `failing-test.log` | `naive_random_lines` | 7/7 | 8/8 | 1.000 |
| `long-agent-history.md` | `naive_head` | 12/12 | 8/9 | 0.961 |
| `noisy-issue.md` | `naive_random_lines` | 7/7 | 7/7 | 1.000 |
| `research-notes.md` | `naive_middle` | 7/7 | 6/6 | 1.000 |

## multiagent workflow eval

| role | raw monolithic | quadchain routed | saved | reduction | evidence | mode |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `researcher` | 2,250 | 487 | 1,763 | 78.36% | 14/14 | compressed packets plus proof envelope |
| `implementer` | 2,250 | 1,376 | 874 | 38.84% | 27/27 | compressed packets plus proof envelope |
| `reviewer` | 2,250 | 240 | 2,010 | 89.33% | 41/41 | certificate summaries for all packets |
| `judge_presenter` | 2,250 | 180 | 2,070 | 92.0% | 41/41 | aggregate certificate plus registry receipt |

## proof-carrying handoff eval

- valid handoff accepted: `true`.
- handoff verifier cases passed: 4/4.
- adversarial rejection rate: 4/4 (100.0%).
- invalid route case: `implementer route missing failing-test.log` -> `rejected` because `failing-test.log` removes 7 required evidence items.
- registry payload raw context bytes: 0.

## measured large context

- measured large-context input: 115,038 tokens.
- measured compressed large-context output: 74,813 tokens.
- measured large-context saved tokens: 40,225.
- evidence preserved: 12/12.

## scale ladder

- magnitudes tested: 6.
- smallest input: 1,126 tokens.
- largest input: 313,554 tokens.
- aggregate raw 4-agent fanout: 1,858,850 tokens.
- aggregate quadchain actual routed prompts: 605,450 tokens.
- aggregate workflow savings: 1,253,400 tokens (67.43%).
- evidence preserved across ladder: 36/36.
- actual role prompts measured: 24 (144/144 role-prompt evidence).

| target | input | compressed | evidence | raw role prompts | quadchain role prompts | workflow reduction |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 1,126 | 765 | 6/6 | 4,659 | 2,127 | 54.35% |
| 3,000 | 3,203 | 2,122 | 6/6 | 12,967 | 4,849 | 62.61% |
| 10,000 | 10,534 | 6,909 | 6/6 | 42,291 | 14,419 | 65.91% |
| 30,000 | 31,431 | 20,558 | 6/6 | 125,879 | 41,733 | 66.85% |
| 100,000 | 104,632 | 68,030 | 6/6 | 418,683 | 136,664 | 67.36% |
| 300,000 | 313,554 | 202,527 | 6/6 | 1,254,371 | 405,658 | 67.66% |

## frontier benchmark harness

- eval cases: 20.
- paired benchmark rows: 2,880.
- dataset adapters: `longbench_style_qa`, `needle_in_haystack_style`, `ruler_style_multihop`, `token_diet_local_fixture`.
- methods compared: 12.
- quadchain mean task score: 0.6350 (ci95 [0.5987, 0.6782]).
- raw mean task score: 0.8679; delta -0.2329.
- executable role task success: raw 50.0%, quadchain 75.0%, workflow reduction 74.22%.
- role evidence audit separates payload evidence (144/144) from final prompt evidence (144/144); leakage delta is 0.

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
## readout

the quantitative story is simple: compress once, route by role, verify before trust. that is why quadchain saves more than single-call compression in multiagent systems while keeping the evidence contract explicit.
