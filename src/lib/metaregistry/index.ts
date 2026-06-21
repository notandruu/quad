export type CapabilityKind =
  | "connector"
  | "publisher"
  | "agent"
  | "policy"
  | "surface"
  | "verifier";

export type CapabilityStatus = "available" | "degraded" | "unavailable";

export type ApprovalMode = "none" | "dry_run" | "human_approval" | "admin_approval";

export type CapabilityManifest = {
  id: string;
  name: string;
  kind: CapabilityKind;
  description: string;
  owner: "stephen" | "andrew" | "silas" | "maddy" | "shared";
  sponsor?: "Arize" | "Browserbase" | "Fetch.ai" | "Redis" | "Sentry" | "OpenAI";
  env: string[];
  scopes: string[];
  /** True only when this capability can mutate customer-facing state. */
  writes: boolean;
  approvalMode: ApprovalMode;
  enabledByDefault: boolean;
  tags: string[];
};

export type CapabilityInstallState = {
  id: string;
  installed: boolean;
  status: CapabilityStatus;
  missingEnv: string[];
  active: boolean;
  reason: string;
};

export type ActiveTool = {
  id: string;
  name: string;
  kind: CapabilityKind;
  approvalMode: ApprovalMode;
  scopes: string[];
  sponsor?: CapabilityManifest["sponsor"];
};

export type CapabilitySummary = {
  installed: CapabilityInstallState[];
  activeTools: ActiveTool[];
  starterBundle: string[];
  blockers: string[];
};

export const CAPABILITY_CATALOG: CapabilityManifest[] = [
  {
    id: "redis.event_spine",
    name: "Redis event spine",
    kind: "connector",
    description: "Streams run events, counters, and replayable work logs.",
    owner: "stephen",
    sponsor: "Redis",
    env: ["QUAD_REDIS_REST_URL", "QUAD_REDIS_REST_TOKEN"],
    scopes: ["events:read", "events:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["runtime", "replay"],
  },
  {
    id: "browserbase.read_browser",
    name: "Browserbase read browser",
    kind: "connector",
    description: "Renders customer pages and captures evidence screenshots.",
    owner: "andrew",
    sponsor: "Browserbase",
    env: ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"],
    scopes: ["browser:read", "screenshots:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["evidence", "browser"],
  },
  {
    id: "browserbase.write_browser",
    name: "Browserbase write browser",
    kind: "connector",
    description: "Fills controlled forms and stages browser actions before approval.",
    owner: "andrew",
    sponsor: "Browserbase",
    env: ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"],
    scopes: ["browser:write", "forms:stage"],
    writes: false,
    approvalMode: "human_approval",
    enabledByDefault: false,
    tags: ["fde", "browser"],
  },
  {
    id: "quad.company_brain",
    name: "Company brain",
    kind: "connector",
    description: "Retrieves tenant-scoped memory and stores approved learnings.",
    owner: "stephen",
    env: ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"],
    scopes: ["brain:read", "brain:write"],
    writes: false,
    approvalMode: "human_approval",
    enabledByDefault: true,
    tags: ["memory", "tenant"],
  },
  {
    id: "openai.embeddings",
    name: "OpenAI embeddings",
    kind: "connector",
    description: "Embeds company memory for semantic retrieval.",
    owner: "stephen",
    sponsor: "OpenAI",
    env: ["OPENAI_API_KEY"],
    scopes: ["embeddings:create"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["memory", "retrieval"],
  },
  {
    id: "sentry.reliability",
    name: "Sentry reliability",
    kind: "connector",
    description: "Captures production errors, traces, and demo reliability proof.",
    owner: "stephen",
    sponsor: "Sentry",
    env: ["NEXT_PUBLIC_SENTRY_DSN"],
    scopes: ["telemetry:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["observability", "reliability"],
  },
  {
    id: "arize.phoenix",
    name: "Arize Phoenix",
    kind: "connector",
    description: "Exports LLM traces and eval signals for auditability.",
    owner: "stephen",
    sponsor: "Arize",
    env: ["PHOENIX_COLLECTOR_ENDPOINT"],
    scopes: ["evals:write", "traces:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["observability", "evals"],
  },
  {
    id: "quad.chain_verifier",
    name: "Quad chain verifier",
    kind: "verifier",
    description: "Builds and verifies proof-carrying compressed handoffs.",
    owner: "stephen",
    env: [],
    scopes: ["handoffs:verify", "certificates:create"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["trust", "compression"],
  },
  {
    id: "trust_packet.exporter",
    name: "Trust packet exporter",
    kind: "publisher",
    description: "Builds customer-ready proof packets from findings and certificates.",
    owner: "andrew",
    env: [],
    scopes: ["artifacts:create", "packets:export"],
    writes: false,
    approvalMode: "dry_run",
    enabledByDefault: true,
    tags: ["fde", "proof"],
  },
  {
    id: "cms.publisher",
    name: "Cms publisher",
    kind: "publisher",
    description: "Stages website updates for approved missing trust content.",
    owner: "andrew",
    env: ["CMS_API_KEY"],
    scopes: ["cms:draft", "cms:publish"],
    writes: true,
    approvalMode: "human_approval",
    enabledByDefault: false,
    tags: ["fde", "website"],
  },
  {
    id: "task.publisher",
    name: "Task publisher",
    kind: "publisher",
    description: "Creates implementation tasks from approved gaps.",
    owner: "andrew",
    env: ["LINEAR_API_KEY"],
    scopes: ["tasks:create"],
    writes: true,
    approvalMode: "human_approval",
    enabledByDefault: false,
    tags: ["fde", "ops"],
  },
  {
    id: "fetch.agent_bridge",
    name: "Fetch agent bridge",
    kind: "surface",
    description: "Exposes quad as an external agent with a normalized run response.",
    owner: "andrew",
    sponsor: "Fetch.ai",
    env: [],
    scopes: ["agent:run", "agent:describe"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["agentverse", "distribution"],
  },
];

const ENTERPRISE_PROOF_STARTER_BUNDLE = [
  "quad.chain_verifier",
  "trust_packet.exporter",
  "quad.company_brain",
  "browserbase.read_browser",
  "arize.phoenix",
  "sentry.reliability",
  "fetch.agent_bridge",
];

export function validateCapabilityManifest(manifest: CapabilityManifest): string[] {
  const failures: string[] = [];

  if (!manifest.id.includes(".")) failures.push("id_must_be_namespaced");
  if (!manifest.name.trim()) failures.push("name_required");
  if (!manifest.description.trim()) failures.push("description_required");
  if (manifest.writes && manifest.approvalMode === "none") failures.push("write_capability_needs_approval_mode");
  if (manifest.scopes.length === 0) failures.push("scope_required");
  if (manifest.env.some((key) => !/^[A-Z0-9_]+$/.test(key))) failures.push("env_key_invalid");

  return failures;
}

export function getEnterpriseProofStarterBundle(): CapabilityManifest[] {
  return ENTERPRISE_PROOF_STARTER_BUNDLE.map((id) => getCapability(id)).filter(
    (manifest): manifest is CapabilityManifest => Boolean(manifest)
  );
}

export function summarizeCapabilities(env: Record<string, string | undefined>): CapabilitySummary {
  const installed = CAPABILITY_CATALOG.map((manifest) => buildInstallState(manifest, env));
  const activeTools = buildActiveToolCatalog(installed);
  const blockers = installed
    .filter((state) => state.installed && state.status === "degraded")
    .map((state) => `${state.id}: ${state.reason}`);

  return {
    installed,
    activeTools,
    starterBundle: ENTERPRISE_PROOF_STARTER_BUNDLE,
    blockers,
  };
}

export function buildActiveToolCatalog(states: CapabilityInstallState[]): ActiveTool[] {
  const byId = new Map(CAPABILITY_CATALOG.map((manifest) => [manifest.id, manifest]));

  return states
    .filter((state) => state.active)
    .map((state) => byId.get(state.id))
    .filter((manifest): manifest is CapabilityManifest => Boolean(manifest))
    .map((manifest) => ({
      id: manifest.id,
      name: manifest.name,
      kind: manifest.kind,
      approvalMode: manifest.approvalMode,
      scopes: manifest.scopes,
      sponsor: manifest.sponsor,
    }));
}

export function getCapability(id: string): CapabilityManifest | undefined {
  return CAPABILITY_CATALOG.find((manifest) => manifest.id === id);
}

function buildInstallState(
  manifest: CapabilityManifest,
  env: Record<string, string | undefined>
): CapabilityInstallState {
  const missingEnv = manifest.env.filter((key) => !env[key]);
  const manifestFailures = validateCapabilityManifest(manifest);

  if (!manifest.enabledByDefault) {
    return {
      id: manifest.id,
      installed: false,
      status: "unavailable",
      missingEnv,
      active: false,
      reason: "Capability is available in the registry but not enabled by default.",
    };
  }

  if (manifestFailures.length > 0) {
    return {
      id: manifest.id,
      installed: false,
      status: "unavailable",
      missingEnv,
      active: false,
      reason: manifestFailures.join(", "),
    };
  }

  if (missingEnv.length > 0) {
    return {
      id: manifest.id,
      installed: true,
      status: "degraded",
      missingEnv,
      active: manifest.env.length === 0,
      reason: `Missing ${missingEnv.join(", ")}.`,
    };
  }

  return {
    id: manifest.id,
    installed: true,
    status: "available",
    missingEnv: [],
    active: true,
    reason: "Ready.",
  };
}
