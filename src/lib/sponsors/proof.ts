import { CAPABILITY_CATALOG, summarizeCapabilities, type CapabilityManifest } from "@/lib/metaregistry";

export type SponsorProofStatus = "live" | "fallback" | "planned";

export type SponsorProofRow = {
  sponsor: NonNullable<CapabilityManifest["sponsor"]>;
  status: SponsorProofStatus;
  capabilities: string[];
  claim: string;
  demoMoment: string;
  routeOrSurface: string;
  caveat: string | null;
};

export type SponsorProofManifest = {
  generatedAt: string;
  liveCount: number;
  total: number;
  rows: SponsorProofRow[];
  safeToClaim: string[];
  doNotClaim: string[];
};

const SPONSOR_PROOF_COPY: Record<SponsorProofRow["sponsor"], Omit<SponsorProofRow, "sponsor" | "status" | "capabilities" | "caveat">> = {
  Arize: {
    claim: "Quad can export LLM/tool traces and eval signals through Phoenix.",
    demoMoment: "Show audit, chat, or trust-packet trace/evaluator evidence in the Arize environment.",
    routeOrSurface: "/api/observability/probe",
  },
  Browserbase: {
    claim: "Quad uses browser-rendered evidence and screenshots for website audits when configured.",
    demoMoment: "Open a finding card and show browser evidence or screenshot proof.",
    routeOrSurface: "Finding card proof viewer",
  },
  Deepgram: {
    claim: "Quad uses voice as an essential memory-capture surface, not a tacked-on command input.",
    demoMoment: "Use the voice prompt, speak an answer, save it as verified memory, then rerun the audit.",
    routeOrSurface: "/api/voice/interview + /api/voice/transcribe",
  },
  "Fetch.ai": {
    claim: "Quad exposes a discoverable external agent card and normalized run endpoint.",
    demoMoment: "Open the agent descriptor and run an enterprise proof workflow through the external-agent bridge.",
    routeOrSurface: "/api/agent/describe + /api/agent/run",
  },
  Redis: {
    claim: "Quad streams live run events, counters, worker state, and packet cache through Redis when configured.",
    demoMoment: "Show live logs, debug drawer Redis status, and worker/job health.",
    routeOrSurface: "Live logs + /api/jobs/health",
  },
  Sentry: {
    claim: "Quad has reliability instrumentation and a safe observability probe for demo validation.",
    demoMoment: "Show the Sentry probe receipt and backend readiness status without exposing DSNs.",
    routeOrSurface: "/api/observability/probe",
  },
  OpenAI: {
    claim: "Quad uses embeddings for company-brain retrieval when configured.",
    demoMoment: "Show backend settings proving embeddings are live, then ask a memory-grounded follow-up.",
    routeOrSurface: "/api/settings + /api/chat",
  },
};

export function buildSponsorProofManifest(input: {
  env?: Record<string, string | undefined>;
  generatedAt?: string;
} = {}): SponsorProofManifest {
  const env = input.env ?? process.env;
  const capabilities = summarizeCapabilities(env);
  const stateById = new Map(capabilities.installed.map((state) => [state.id, state]));
  const sponsors = uniqueSponsors();
  const rows = sponsors.map((sponsor) => {
    const manifests = CAPABILITY_CATALOG.filter((manifest) => manifest.sponsor === sponsor);
    const states = manifests.map((manifest) => stateById.get(manifest.id)).filter(Boolean);
    const live = states.some((state) => state?.active && state.status === "available");
    const configuredFallback = states.some((state) => state?.installed);
    const status: SponsorProofStatus = live ? "live" : configuredFallback ? "fallback" : "planned";
    const missing = states.flatMap((state) => state?.missingEnv ?? []);
    return {
      sponsor,
      status,
      capabilities: manifests.map((manifest) => manifest.id),
      ...SPONSOR_PROOF_COPY[sponsor],
      caveat:
        status === "live"
          ? null
          : missing.length > 0
            ? `Missing ${[...new Set(missing)].join(", ")}.`
            : "Capability is present in the product but not active in this environment.",
    };
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    liveCount: rows.filter((row) => row.status === "live").length,
    total: rows.length,
    rows,
    safeToClaim: rows
      .filter((row) => row.status === "live")
      .map((row) => `${row.sponsor}: ${row.claim}`),
    doNotClaim: rows
      .filter((row) => row.status !== "live")
      .map((row) => `${row.sponsor}: do not claim live integration. ${row.caveat}`),
  };
}

function uniqueSponsors(): SponsorProofRow["sponsor"][] {
  return [...new Set(CAPABILITY_CATALOG.map((manifest) => manifest.sponsor).filter(Boolean))] as SponsorProofRow["sponsor"][];
}
