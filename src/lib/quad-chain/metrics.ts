export type QuadChainMetric = {
  label: string;
  value: string;
  detail: string;
};

export type QuadChainRouteMetric = {
  role: string;
  mode: string;
  rawTokens: number;
  quadChainTokens: number;
  tokensSaved: number;
  reduction: number;
  evidence: string;
};

export const quadChainThesis =
  "Quadchain compresses agent context and proves the compressed memory is still safe to trust.";

export const quadChainHeadlineMetrics: QuadChainMetric[] = [
  {
    label: "Single-context reduction",
    value: "38.53%",
    detail: "2,250 raw tokens became 1,383 verified tokens.",
  },
  {
    label: "Evidence preserved",
    value: "41/41",
    detail: "Required evidence survived the compressed packet.",
  },
  {
    label: "Concepts preserved",
    value: "38/38",
    detail: "Answer-critical concepts stayed present.",
  },
  {
    label: "Workflow reduction",
    value: "74.63%",
    detail: "9,000 raw multiagent tokens became 2,283 routed tokens.",
  },
  {
    label: "Adversarial rejection",
    value: "4/4",
    detail: "Tampered, stale, and unsafe handoffs were rejected.",
  },
  {
    label: "Benchmark rows",
    value: "2,880",
    detail: "Paired offline rows across methods, budgets, and seeds.",
  },
];

export const quadChainRouteMetrics: QuadChainRouteMetric[] = [
  {
    role: "Researcher",
    mode: "Compressed packets plus proof envelope",
    rawTokens: 2250,
    quadChainTokens: 487,
    tokensSaved: 1763,
    reduction: 78.36,
    evidence: "14/14",
  },
  {
    role: "Implementer",
    mode: "Compressed packets plus proof envelope",
    rawTokens: 2250,
    quadChainTokens: 1376,
    tokensSaved: 874,
    reduction: 38.84,
    evidence: "27/27",
  },
  {
    role: "Reviewer",
    mode: "Certificate summaries for all packets",
    rawTokens: 2250,
    quadChainTokens: 240,
    tokensSaved: 2010,
    reduction: 89.33,
    evidence: "41/41",
  },
  {
    role: "Judge presenter",
    mode: "Aggregate certificate plus registry receipt",
    rawTokens: 2250,
    quadChainTokens: 180,
    tokensSaved: 2070,
    reduction: 92,
    evidence: "41/41",
  },
];

export const quadChainArtifactLinks = [
  {
    label: "Eval report",
    href: "https://github.com/notandruu/quad/blob/main/docs/quadchain-token-compression/reports/eval-report.md",
    detail: "Judge-facing compression, routing, and handoff summary.",
  },
  {
    label: "Benchmark report",
    href: "https://github.com/notandruu/quad/blob/main/docs/quadchain-token-compression/reports/benchmark-report.md",
    detail: "Offline paired benchmark methodology and caveats.",
  },
  {
    label: "Whitepaper",
    href: "https://github.com/notandruu/quad/blob/main/docs/quadchain-token-compression/papers/whitepaper.md",
    detail: "Product thesis for proof-carrying context compression.",
  },
  {
    label: "Research paper",
    href: "https://github.com/notandruu/quad/blob/main/docs/quadchain-token-compression/papers/research-paper.md",
    detail: "Research framing and benchmark details.",
  },
];

export function totalRouteSavings(routes: QuadChainRouteMetric[] = quadChainRouteMetrics) {
  const rawTokens = routes.reduce((sum, route) => sum + route.rawTokens, 0);
  const quadChainTokens = routes.reduce((sum, route) => sum + route.quadChainTokens, 0);
  const tokensSaved = rawTokens - quadChainTokens;
  const reduction = rawTokens === 0 ? 0 : Math.round((tokensSaved / rawTokens) * 10000) / 100;
  return { rawTokens, quadChainTokens, tokensSaved, reduction };
}
