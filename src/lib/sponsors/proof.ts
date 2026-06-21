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
  demoRunbook: SponsorProofDemoRunbook;
};

export type SponsorProofDemoStep = {
  id: string;
  sponsor: SponsorProofRow["sponsor"];
  status: SponsorProofStatus;
  label: string;
  routeOrSurface: string;
  demoMoment: string;
  boothLine: string;
  proofCheck: string;
  safeToSay: boolean;
};

export type SponsorProofDemoRunbook = {
  headline: string;
  sequence: SponsorProofDemoStep[];
  liveRows: SponsorProofRow[];
  fallbackRows: SponsorProofRow[];
  plannedRows: SponsorProofRow[];
  judgeScript: string[];
  boothChecklist: string[];
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

const SPONSOR_DEMO_ORDER: SponsorProofRow["sponsor"][] = [
  "Redis",
  "Browserbase",
  "Deepgram",
  "Arize",
  "Sentry",
  "Fetch.ai",
  "OpenAI",
];

export function buildSponsorProofManifest(input: {
  env?: Record<string, string | undefined>;
  generatedAt?: string;
} = {}): SponsorProofManifest {
  const env = input.env ?? process.env;
  const capabilities = summarizeCapabilities(env);
  const stateById = new Map(capabilities.installed.map((state) => [state.id, state]));
  const sponsors = uniqueSponsors();
  const rows = sponsors
    .map((sponsor) => {
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
    })
    .sort((a, b) => sponsorOrder(a.sponsor) - sponsorOrder(b.sponsor));
  const safeToClaim = rows
    .filter((row) => row.status === "live")
    .map((row) => `${row.sponsor}: ${row.claim}`);
  const doNotClaim = rows
    .filter((row) => row.status !== "live")
    .map((row) => `${row.sponsor}: do not claim live integration. ${row.caveat}`);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    liveCount: rows.filter((row) => row.status === "live").length,
    total: rows.length,
    rows,
    safeToClaim,
    doNotClaim,
    demoRunbook: buildSponsorProofDemoRunbook(rows, safeToClaim, doNotClaim),
  };
}

function uniqueSponsors(): SponsorProofRow["sponsor"][] {
  return [...new Set(CAPABILITY_CATALOG.map((manifest) => manifest.sponsor).filter(Boolean))] as SponsorProofRow["sponsor"][];
}

function buildSponsorProofDemoRunbook(
  rows: SponsorProofRow[],
  safeToClaim: string[],
  doNotClaim: string[]
): SponsorProofDemoRunbook {
  const liveRows = rows.filter((row) => row.status === "live");
  const fallbackRows = rows.filter((row) => row.status === "fallback");
  const plannedRows = rows.filter((row) => row.status === "planned");
  const sequence = rows.map((row, index) => ({
    id: `${index + 1}-${slug(row.sponsor)}`,
    sponsor: row.sponsor,
    status: row.status,
    label: `${index + 1}. ${row.sponsor}`,
    routeOrSurface: row.routeOrSurface,
    demoMoment: row.demoMoment,
    boothLine: boothLine(row),
    proofCheck: `Open ${row.routeOrSurface} and verify: ${row.demoMoment}`,
    safeToSay: row.status === "live",
  }));

  return {
    headline: "Sponsor proof runbook: claim only live rows, show fallback surfaces honestly.",
    sequence,
    liveRows,
    fallbackRows,
    plannedRows,
    judgeScript: [
      "Start at GET /api/sponsor/proof or run npm run sponsor:proof.",
      safeToClaim.length > 0
        ? `Lead with live proof: ${safeToClaim.slice(0, 3).join(" | ")}.`
        : "No sponsor rows are live in this environment; show product surfaces and say credentials are not live.",
      doNotClaim.length > 0
        ? "Do not claim fallback rows as live integrations. Use their caveats verbatim."
        : "All sponsor rows are live in this environment.",
      "For Arize and Sentry, show the external sponsor environment or safe probe receipt if judging asks for proof.",
      "For Deepgram, voice must create memory that changes a later audit answer.",
    ],
    boothChecklist: [
      "Open the product surface listed in each live row.",
      "Keep /api/sponsor/proof visible as the source of truth for sponsor claims.",
      "Never show env values, api keys, dsns, service tokens, cookies, or raw connector credentials.",
      "If a row is fallback or planned, say the product surface exists but hosted credentials are not live here.",
      "Record a short backup video of the exact live rows before going to sponsor booths.",
    ],
  };
}

function boothLine(row: SponsorProofRow): string {
  if (row.status === "live") return `${row.sponsor} is live: ${row.claim}`;
  if (row.status === "fallback") {
    return `${row.sponsor} has a product surface, but do not claim hosted live integration: ${row.caveat}`;
  }
  return `${row.sponsor} is planned for this environment: ${row.caveat}`;
}

function sponsorOrder(sponsor: SponsorProofRow["sponsor"]): number {
  const index = SPONSOR_DEMO_ORDER.indexOf(sponsor);
  return index === -1 ? SPONSOR_DEMO_ORDER.length : index;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
