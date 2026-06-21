import type { Intent } from "@/lib/types";

export type CapabilityKind =
  | "connector"
  | "publisher"
  | "agent"
  | "policy"
  | "surface"
  | "verifier";

export type CapabilityStatus = "available" | "degraded" | "unavailable";

export type ApprovalMode = "none" | "dry_run" | "human_approval" | "admin_approval";

export type CapabilityLifecycleState =
  | "available"
  | "installing"
  | "installed"
  | "allowlisted"
  | "degraded"
  | "disabled"
  | "revoked";

export type CapabilityValidationStatus = "pass" | "warning" | "fail";

export type CapabilityValidationCheck = {
  id: string;
  capabilityId: string;
  label: string;
  status: CapabilityValidationStatus;
  detail: string;
};

export type CapabilityManifest = {
  id: string;
  name: string;
  kind: CapabilityKind;
  description: string;
  owner: "stephen" | "andrew" | "silas" | "maddy" | "shared";
  sponsor?: "Arize" | "Browserbase" | "Deepgram" | "Fetch.ai" | "Redis" | "Sentry" | "OpenAI";
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
  allowlisted: boolean;
  disabled: boolean;
  installSource: "default" | "forced" | "manual";
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
  policy: CapabilityPolicy;
};

export type CapabilityCatalogEntry = {
  id: string;
  name: string;
  kind: CapabilityKind;
  description: string;
  owner: CapabilityManifest["owner"];
  sponsor?: CapabilityManifest["sponsor"];
  tags: string[];
  scopes: string[];
  writes: boolean;
  approvalMode: ApprovalMode;
  installed: boolean;
  status: CapabilityStatus;
  lifecycleState: CapabilityLifecycleState;
  active: boolean;
  allowlisted: boolean;
  disabled: boolean;
  installSource: CapabilityInstallState["installSource"];
  missingEnvCount: number;
  stateLabel: "active" | "needs_env" | "needs_install" | "blocked" | "disabled";
  nextAction: string;
  validation: {
    total: number;
    passing: number;
    warnings: number;
    failing: number;
  };
};

export type CapabilityKindSummary = {
  kind: CapabilityKind;
  total: number;
  active: number;
  installed: number;
  blocked: number;
  writes: number;
};

export type CapabilitySponsorSummary = {
  sponsor: NonNullable<CapabilityManifest["sponsor"]> | "Quad";
  total: number;
  active: number;
  blocked: number;
  missingEnv: number;
};

export type CapabilityCatalogSummary = {
  total: number;
  active: number;
  installed: number;
  blocked: number;
  writeCapable: number;
  approvalGated: number;
  missingEnv: number;
  starterBundle: {
    total: number;
    active: number;
    blocked: number;
    ids: string[];
  };
  kinds: CapabilityKindSummary[];
  sponsors: CapabilitySponsorSummary[];
  validation: {
    total: number;
    passing: number;
    warnings: number;
    failing: number;
    checks: CapabilityValidationCheck[];
  };
  entries: CapabilityCatalogEntry[];
};

export type RuntimeToolSurface = "dashboard" | "chat" | "voice" | "fetch_agent" | "worker";

export type RuntimeToolLoadMode = "eager" | "deferred";

export type RuntimeToolRoute = {
  tool: ActiveTool;
  loadMode: RuntimeToolLoadMode;
  reason: string;
};

export type RuntimeToolBlockedCapability = {
  id: string;
  reason: string;
  missingEnv: string[];
  allowlisted: boolean;
  disabled: boolean;
};

export type RuntimeToolRoutingPlan = {
  intent: Intent;
  surface: RuntimeToolSurface;
  requiredCapabilityIds: string[];
  eagerTools: RuntimeToolRoute[];
  deferredTools: RuntimeToolRoute[];
  selectedTools: ActiveTool[];
  blockedCapabilities: RuntimeToolBlockedCapability[];
  policy: CapabilityPolicy;
};

export type CapabilityInstallPlan = {
  orgId?: string;
  bundleId: "enterprise_proof_starter" | "custom";
  requestedIds: string[];
  knownIds: string[];
  unknownIds: string[];
  alreadyActive: string[];
  newlyAllowlisted: string[];
  newlyForceInstalled: string[];
  envRequired: Array<{
    id: string;
    missingEnv: string[];
  }>;
  blockedAfterInstall: Array<{
    id: string;
    reason: string;
    missingEnv: string[];
  }>;
  activeAfterInstall: ActiveTool[];
  policyPreview: CapabilityPolicy;
};

export type CapabilityPolicy = {
  orgId?: string;
  allowlist: string[];
  disabled: string[];
  forceInstalled: string[];
  requireWriteAllowlist: boolean;
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
    writes: true,
    approvalMode: "human_approval",
    enabledByDefault: false,
    tags: ["fde", "browser", "customer-write"],
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
    env: ["SENTRY_DSN"],
    scopes: ["telemetry:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["observability", "reliability"],
  },
  {
    id: "deepgram.voice_memory",
    name: "Deepgram voice memory",
    kind: "surface",
    description: "Turns spoken buyer-readiness answers into verified company memory.",
    owner: "stephen",
    sponsor: "Deepgram",
    env: ["DEEPGRAM_API_KEY"],
    scopes: ["voice:transcribe", "memory:write"],
    writes: false,
    approvalMode: "none",
    enabledByDefault: true,
    tags: ["voice", "memory"],
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
  "deepgram.voice_memory",
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

export function summarizeCapabilities(
  env: Record<string, string | undefined>,
  input: { orgId?: string; policy?: Partial<CapabilityPolicy> } = {}
): CapabilitySummary {
  const policy = resolveCapabilityPolicy(env, input);
  const installed = CAPABILITY_CATALOG.map((manifest) => buildInstallState(manifest, env, policy));
  const activeTools = buildActiveToolCatalog(installed);
  const blockers = installed
    .filter((state) => state.installed && !state.active)
    .map((state) => `${state.id}: ${state.reason}`);

  return {
    installed,
    activeTools,
    starterBundle: ENTERPRISE_PROOF_STARTER_BUNDLE,
    blockers,
    policy,
  };
}

export function summarizeCapabilityCatalog(
  capabilities: CapabilitySummary,
  input: { includeEntries?: boolean; entryLimit?: number } = {}
): CapabilityCatalogSummary {
  const byState = new Map(capabilities.installed.map((state) => [state.id, state]));
  const entries = CAPABILITY_CATALOG.map((manifest) => {
    const state = byState.get(manifest.id) ?? buildInstallState(manifest, {}, capabilities.policy);
    return buildCatalogEntry(manifest, state);
  });
  const starterEntries = entries.filter((entry) => capabilities.starterBundle.includes(entry.id));
  const validationChecks = buildCapabilityValidationChecks(capabilities);
  const entryLimit = input.entryLimit ?? entries.length;

  return {
    total: entries.length,
    active: entries.filter((entry) => entry.active).length,
    installed: entries.filter((entry) => entry.installed).length,
    blocked: entries.filter((entry) => entry.installed && !entry.active).length,
    writeCapable: entries.filter((entry) => entry.writes).length,
    approvalGated: entries.filter((entry) => entry.approvalMode !== "none").length,
    missingEnv: entries.reduce((total, entry) => total + entry.missingEnvCount, 0),
    starterBundle: {
      total: starterEntries.length,
      active: starterEntries.filter((entry) => entry.active).length,
      blocked: starterEntries.filter((entry) => entry.installed && !entry.active).length,
      ids: capabilities.starterBundle,
    },
    kinds: summarizeByKind(entries),
    sponsors: summarizeBySponsor(entries),
    validation: summarizeValidationChecks(validationChecks),
    entries: input.includeEntries === false ? [] : entries.slice(0, entryLimit),
  };
}

export function buildCapabilityValidationChecks(capabilities: CapabilitySummary): CapabilityValidationCheck[] {
  const byState = new Map(capabilities.installed.map((state) => [state.id, state]));

  return CAPABILITY_CATALOG.flatMap((manifest) => {
    const state = byState.get(manifest.id) ?? buildInstallState(manifest, {}, capabilities.policy);
    return validationChecksForCapability(manifest, state);
  });
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

export function buildRuntimeToolRoutingPlan(input: {
  intent: Intent;
  surface: RuntimeToolSurface;
  env?: Record<string, string | undefined>;
  orgId?: string;
  capabilities?: CapabilitySummary;
  policy?: Partial<CapabilityPolicy>;
}): RuntimeToolRoutingPlan {
  const capabilities = input.capabilities ?? summarizeCapabilities(input.env ?? process.env, {
    orgId: input.orgId,
    policy: input.policy,
  });
  const requiredCapabilityIds = uniqueIds([
    ...capabilityIdsForIntent(input.intent),
    ...capabilityIdsForSurface(input.surface),
  ]);
  const required = new Set(requiredCapabilityIds);
  const activeRoutes = capabilities.activeTools
    .filter((tool) => required.has(tool.id))
    .map((tool): RuntimeToolRoute => ({
      tool,
      loadMode: loadModeForTool(tool, input.intent, input.surface),
      reason: routeReasonForTool(tool, input.intent, input.surface),
    }));
  const blockedCapabilities = capabilities.installed
    .filter((state) => required.has(state.id) && !capabilities.activeTools.some((tool) => tool.id === state.id))
    .map((state) => ({
      id: state.id,
      reason: state.reason,
      missingEnv: state.missingEnv,
      allowlisted: state.allowlisted,
      disabled: state.disabled,
    }));

  return {
    intent: input.intent,
    surface: input.surface,
    requiredCapabilityIds,
    eagerTools: activeRoutes.filter((route) => route.loadMode === "eager"),
    deferredTools: activeRoutes.filter((route) => route.loadMode === "deferred"),
    selectedTools: activeRoutes.map((route) => route.tool),
    blockedCapabilities,
    policy: capabilities.policy,
  };
}

export function getCapability(id: string): CapabilityManifest | undefined {
  return CAPABILITY_CATALOG.find((manifest) => manifest.id === id);
}

export function buildCapabilityInstallPlan(input: {
  env: Record<string, string | undefined>;
  orgId?: string;
  capabilityIds?: string[];
  bundleId?: CapabilityInstallPlan["bundleId"];
  includeWriteTools?: boolean;
}): CapabilityInstallPlan {
  const requestedIds = uniqueIds(
    input.capabilityIds?.length
      ? input.capabilityIds
      : [
          ...ENTERPRISE_PROOF_STARTER_BUNDLE,
          ...(input.includeWriteTools ? ["cms.publisher", "task.publisher", "browserbase.write_browser"] : []),
        ]
  );
  const currentPolicy = resolveCapabilityPolicy(input.env, { orgId: input.orgId });
  const knownIds = requestedIds.filter((id) => Boolean(getCapability(id)));
  const unknownIds = requestedIds.filter((id) => !getCapability(id));
  const currentSummary = summarizeCapabilities(input.env, { orgId: input.orgId });
  const activeNow = new Set(currentSummary.activeTools.map((tool) => tool.id));
  const forceNeeded = knownIds.filter((id) => {
    const manifest = getCapability(id);
    return manifest && !manifest.enabledByDefault && !currentPolicy.forceInstalled.includes(id);
  });
  const allowlistNeeded = knownIds.filter((id) => !currentPolicy.allowlist.includes(id));
  const policyPreview: CapabilityPolicy = {
    ...currentPolicy,
    allowlist: uniqueIds([...currentPolicy.allowlist, ...allowlistNeeded]),
    forceInstalled: uniqueIds([...currentPolicy.forceInstalled, ...forceNeeded]),
  };
  const preview = summarizeCapabilities(input.env, {
    orgId: input.orgId,
    policy: policyPreview,
  });
  const requestedStates = preview.installed.filter((state) => knownIds.includes(state.id));

  return {
    orgId: input.orgId,
    bundleId: input.bundleId ?? (input.capabilityIds?.length ? "custom" : "enterprise_proof_starter"),
    requestedIds,
    knownIds,
    unknownIds,
    alreadyActive: knownIds.filter((id) => activeNow.has(id)),
    newlyAllowlisted: allowlistNeeded,
    newlyForceInstalled: forceNeeded,
    envRequired: requestedStates
      .filter((state) => state.missingEnv.length > 0)
      .map((state) => ({ id: state.id, missingEnv: state.missingEnv })),
    blockedAfterInstall: requestedStates
      .filter((state) => !state.active)
      .map((state) => ({ id: state.id, reason: state.reason, missingEnv: state.missingEnv })),
    activeAfterInstall: preview.activeTools.filter((tool) => knownIds.includes(tool.id)),
    policyPreview,
  };
}

function buildInstallState(
  manifest: CapabilityManifest,
  env: Record<string, string | undefined>,
  policy: CapabilityPolicy
): CapabilityInstallState {
  const missingEnv = manifest.env.filter((key) => !env[key]);
  const manifestFailures = validateCapabilityManifest(manifest);
  const forced = policy.forceInstalled.includes(manifest.id);
  const disabled = policy.disabled.includes(manifest.id);
  const allowlistConfigured = policy.allowlist.length > 0;
  const allowlisted = !allowlistConfigured || policy.allowlist.includes(manifest.id);
  const installed = manifest.enabledByDefault || forced;
  const installSource = forced ? "forced" : manifest.enabledByDefault ? "default" : "manual";

  if (disabled) {
    return {
      id: manifest.id,
      installed,
      status: "unavailable",
      missingEnv,
      active: false,
      allowlisted,
      disabled: true,
      installSource,
      reason: "Capability is disabled by org policy.",
    };
  }

  if (!installed) {
    return {
      id: manifest.id,
      installed: false,
      status: "unavailable",
      missingEnv,
      active: false,
      allowlisted,
      disabled: false,
      installSource,
      reason: "Capability is available in the registry but not enabled by default.",
    };
  }

  if (!allowlisted) {
    return {
      id: manifest.id,
      installed: true,
      status: "unavailable",
      missingEnv,
      active: false,
      allowlisted: false,
      disabled: false,
      installSource,
      reason: "Capability is not allowlisted for this org.",
    };
  }

  if (policy.requireWriteAllowlist && manifest.writes && !policy.allowlist.includes(manifest.id)) {
    return {
      id: manifest.id,
      installed: true,
      status: "unavailable",
      missingEnv,
      active: false,
      allowlisted,
      disabled: false,
      installSource,
      reason: "Write capability requires explicit org allowlisting.",
    };
  }

  if (manifestFailures.length > 0) {
    return {
      id: manifest.id,
      installed: false,
      status: "unavailable",
      missingEnv,
      active: false,
      allowlisted,
      disabled: false,
      installSource,
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
      allowlisted,
      disabled: false,
      installSource,
      reason: `Missing ${missingEnv.join(", ")}.`,
    };
  }

  return {
    id: manifest.id,
    installed: true,
    status: "available",
    missingEnv: [],
    active: true,
    allowlisted,
    disabled: false,
    installSource,
    reason: "Ready.",
  };
}

function buildCatalogEntry(manifest: CapabilityManifest, state: CapabilityInstallState): CapabilityCatalogEntry {
  const checks = validationChecksForCapability(manifest, state);

  return {
    id: manifest.id,
    name: manifest.name,
    kind: manifest.kind,
    description: manifest.description,
    owner: manifest.owner,
    sponsor: manifest.sponsor,
    tags: manifest.tags,
    scopes: manifest.scopes,
    writes: manifest.writes,
    approvalMode: manifest.approvalMode,
    installed: state.installed,
    status: state.status,
    lifecycleState: capabilityLifecycleState(state),
    active: state.active,
    allowlisted: state.allowlisted,
    disabled: state.disabled,
    installSource: state.installSource,
    missingEnvCount: state.missingEnv.length,
    stateLabel: catalogStateLabel(state),
    nextAction: catalogNextAction(manifest, state),
    validation: summarizeEntryValidationChecks(checks),
  };
}

function catalogStateLabel(state: CapabilityInstallState): CapabilityCatalogEntry["stateLabel"] {
  if (state.active) return "active";
  if (state.disabled) return "disabled";
  if (!state.installed) return "needs_install";
  if (!state.allowlisted) return "blocked";
  if (state.missingEnv.length > 0) return "needs_env";
  return "blocked";
}

function catalogNextAction(manifest: CapabilityManifest, state: CapabilityInstallState): string {
  if (state.active) return "ready for routing.";
  if (state.disabled) return "remove it from the disabled policy before use.";
  if (!state.installed) return manifest.writes ? "request install and explicit write allowlist." : "request install.";
  if (!state.allowlisted) return "allowlist this capability for the org.";
  if (state.missingEnv.length > 0) return `configure ${state.missingEnv.length} required env key${state.missingEnv.length === 1 ? "" : "s"}.`;
  if (manifest.writes) return "open a human approval gate before execution.";
  return "review policy blocker.";
}

function capabilityLifecycleState(state: CapabilityInstallState): CapabilityLifecycleState {
  if (state.disabled) return "disabled";
  if (!state.installed) return "available";
  if (state.missingEnv.length > 0) return "degraded";
  if (state.allowlisted) return "allowlisted";
  return "installed";
}

function validationChecksForCapability(
  manifest: CapabilityManifest,
  state: CapabilityInstallState
): CapabilityValidationCheck[] {
  const manifestFailures = validateCapabilityManifest(manifest);
  const checks: CapabilityValidationCheck[] = [
    {
      id: `${manifest.id}:manifest`,
      capabilityId: manifest.id,
      label: "Manifest schema",
      status: manifestFailures.length === 0 ? "pass" : "fail",
      detail: manifestFailures.length === 0
        ? "Capability manifest is namespaced, scoped, and internally valid."
        : `Manifest fails ${manifestFailures.length} validation rule${manifestFailures.length === 1 ? "" : "s"}.`,
    },
    {
      id: `${manifest.id}:install`,
      capabilityId: manifest.id,
      label: "Install state",
      status: state.installed ? "pass" : "warning",
      detail: state.installed
        ? `Capability is installed from ${state.installSource}.`
        : "Capability exists in the catalog but is not installed for this org.",
    },
    {
      id: `${manifest.id}:allowlist`,
      capabilityId: manifest.id,
      label: "Org allowlist",
      status: state.allowlisted ? "pass" : "fail",
      detail: state.allowlisted
        ? "Capability is allowed by org policy."
        : "Capability is blocked by org allowlist policy.",
    },
    {
      id: `${manifest.id}:env`,
      capabilityId: manifest.id,
      label: "Runtime configuration",
      status: state.missingEnv.length === 0 ? "pass" : state.installed ? "fail" : "warning",
      detail: state.missingEnv.length === 0
        ? "Required runtime configuration is present."
        : `Missing ${state.missingEnv.length} required env key${state.missingEnv.length === 1 ? "" : "s"}.`,
    },
    {
      id: `${manifest.id}:approval`,
      capabilityId: manifest.id,
      label: "Approval gate",
      status: !manifest.writes || manifest.approvalMode !== "none" ? "pass" : "fail",
      detail: !manifest.writes
        ? "Capability is read-only or internal."
        : `Write capability uses ${manifest.approvalMode} approval.`,
    },
    {
      id: `${manifest.id}:active`,
      capabilityId: manifest.id,
      label: "Runtime routing",
      status: state.active ? "pass" : state.disabled || !state.allowlisted ? "fail" : "warning",
      detail: runtimeRoutingValidationDetail(manifest, state),
    },
  ];

  return checks;
}

function runtimeRoutingValidationDetail(
  manifest: CapabilityManifest,
  state: CapabilityInstallState
): string {
  if (state.active) return "Capability can be routed by the runtime.";
  if (state.disabled) return "Capability is disabled by org policy.";
  if (!state.installed) return "Capability exists in the catalog but is not installed for this org.";
  if (!state.allowlisted) return "Capability is blocked by org allowlist policy.";
  if (state.missingEnv.length > 0) {
    return `Capability is missing ${state.missingEnv.length} required env key${state.missingEnv.length === 1 ? "" : "s"}.`;
  }
  if (manifest.writes) return "Capability is waiting for a write approval gate.";
  return "Capability is blocked by policy.";
}

function summarizeEntryValidationChecks(checks: CapabilityValidationCheck[]): CapabilityCatalogEntry["validation"] {
  return {
    total: checks.length,
    passing: checks.filter((check) => check.status === "pass").length,
    warnings: checks.filter((check) => check.status === "warning").length,
    failing: checks.filter((check) => check.status === "fail").length,
  };
}

function summarizeValidationChecks(checks: CapabilityValidationCheck[]): CapabilityCatalogSummary["validation"] {
  return {
    ...summarizeEntryValidationChecks(checks),
    checks: checks.filter((check) => check.status !== "pass").slice(0, 20),
  };
}

function summarizeByKind(entries: CapabilityCatalogEntry[]): CapabilityKindSummary[] {
  return allKinds().map((kind) => {
    const items = entries.filter((entry) => entry.kind === kind);
    return {
      kind,
      total: items.length,
      active: items.filter((entry) => entry.active).length,
      installed: items.filter((entry) => entry.installed).length,
      blocked: items.filter((entry) => entry.installed && !entry.active).length,
      writes: items.filter((entry) => entry.writes).length,
    };
  });
}

function summarizeBySponsor(entries: CapabilityCatalogEntry[]): CapabilitySponsorSummary[] {
  const sponsors = uniqueIds(entries.map((entry) => entry.sponsor ?? "Quad")).sort();
  return sponsors.map((sponsor) => {
    const items = entries.filter((entry) => (entry.sponsor ?? "Quad") === sponsor);
    return {
      sponsor: sponsor as CapabilitySponsorSummary["sponsor"],
      total: items.length,
      active: items.filter((entry) => entry.active).length,
      blocked: items.filter((entry) => entry.installed && !entry.active).length,
      missingEnv: items.reduce((total, entry) => total + entry.missingEnvCount, 0),
    };
  });
}

function allKinds(): CapabilityKind[] {
  return ["connector", "publisher", "agent", "policy", "surface", "verifier"];
}

export function resolveCapabilityPolicy(
  env: Record<string, string | undefined>,
  input: { orgId?: string; policy?: Partial<CapabilityPolicy> } = {}
): CapabilityPolicy {
  return {
    orgId: input.orgId,
    allowlist: uniqueIds([
      ...parseCapabilityList(env.QUAD_CAPABILITY_ALLOWLIST),
      ...parseCapabilityList(input.policy?.allowlist?.join(",")),
    ]),
    disabled: uniqueIds([
      ...parseCapabilityList(env.QUAD_CAPABILITY_DISABLED),
      ...parseCapabilityList(input.policy?.disabled?.join(",")),
    ]),
    forceInstalled: uniqueIds([
      ...parseCapabilityList(env.QUAD_CAPABILITY_FORCE_INSTALLED),
      ...parseCapabilityList(input.policy?.forceInstalled?.join(",")),
    ]),
    requireWriteAllowlist: input.policy?.requireWriteAllowlist ?? env.QUAD_REQUIRE_WRITE_CAPABILITY_ALLOWLIST !== "false",
  };
}

function parseCapabilityList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function capabilityIdsForIntent(intent: Intent): string[] {
  switch (intent) {
    case "website_audit":
      return ["quad.company_brain", "browserbase.read_browser", "quad.chain_verifier", "arize.phoenix", "sentry.reliability"];
    case "audit_follow_up":
      return ["quad.company_brain", "quad.chain_verifier", "trust_packet.exporter"];
    case "draft_content":
      return ["quad.company_brain", "quad.chain_verifier", "cms.publisher"];
    case "create_task":
      return ["quad.company_brain", "quad.chain_verifier", "task.publisher"];
    case "save_memory":
    case "summarize_meeting":
      return ["quad.company_brain", "quad.chain_verifier"];
    case "send_email":
    case "post_slack":
    case "update_crm":
    case "schedule_meeting":
      return ["quad.company_brain", "quad.chain_verifier"];
    case "company_question":
    case "general_chat":
    default:
      return ["quad.company_brain", "quad.chain_verifier"];
  }
}

function capabilityIdsForSurface(surface: RuntimeToolSurface): string[] {
  switch (surface) {
    case "fetch_agent":
      return ["fetch.agent_bridge"];
    case "voice":
      return ["deepgram.voice_memory"];
    case "worker":
      return ["redis.event_spine"];
    case "dashboard":
    case "chat":
    default:
      return [];
  }
}

function loadModeForTool(tool: ActiveTool, intent: Intent, surface: RuntimeToolSurface): RuntimeToolLoadMode {
  if (tool.approvalMode === "human_approval" || tool.approvalMode === "admin_approval") return "deferred";
  if (tool.id === "arize.phoenix" || tool.id === "sentry.reliability") return "deferred";
  if (tool.kind === "publisher" && intent !== "audit_follow_up") return "deferred";
  if (surface === "worker" && tool.id === "redis.event_spine") return "eager";
  if (surface === "voice" && tool.id === "deepgram.voice_memory") return "eager";
  if (surface === "fetch_agent" && tool.id === "fetch.agent_bridge") return "eager";
  return "eager";
}

function routeReasonForTool(tool: ActiveTool, intent: Intent, surface: RuntimeToolSurface): string {
  if (tool.approvalMode === "human_approval" || tool.approvalMode === "admin_approval") {
    return "write-capable capability is deferred until an approval gate opens.";
  }
  if (tool.id === "arize.phoenix" || tool.id === "sentry.reliability") {
    return "observability capability remains deferred until a trace or error event is emitted.";
  }
  if (tool.kind === "publisher" && intent !== "audit_follow_up") {
    return "publisher capability is available but deferred until a draft artifact exists.";
  }
  if (surface === "voice" && tool.id === "deepgram.voice_memory") return "voice surface requires live transcription.";
  if (surface === "fetch_agent" && tool.id === "fetch.agent_bridge") return "external agent surface requires the fetch bridge.";
  if (surface === "worker" && tool.id === "redis.event_spine") return "worker surface requires the event spine for replay and queue state.";
  return "capability is hot for this intent and surface.";
}
