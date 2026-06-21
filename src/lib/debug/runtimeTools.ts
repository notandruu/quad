export type RuntimeToolRouteView = {
  tool: {
    id: string;
    name?: string;
    kind?: string;
    sponsor?: string;
  };
  loadMode: "eager" | "deferred";
  reason: string;
};

export type RuntimeToolBlockedView = {
  id: string;
  reason: string;
  missingEnvCount?: number;
  allowlisted?: boolean;
  disabled?: boolean;
};

export type RuntimeToolPlanView = {
  intent: string;
  surface: string;
  requiredCapabilityIds: string[];
  eagerTools: RuntimeToolRouteView[];
  deferredTools: RuntimeToolRouteView[];
  blockedCapabilities: RuntimeToolBlockedView[];
};

export type RuntimeToolRoutingResponse = {
  ok: boolean;
  orgId?: string;
  plan?: RuntimeToolPlanView;
};

export type RuntimeToolRoutingSummary = {
  label: string;
  detail: string;
  hotCount: number;
  deferredCount: number;
  blockedCount: number;
  requiredCount: number;
  tone: "ready" | "partial" | "blocked";
};

export function summarizeRuntimeToolRouting(plan: RuntimeToolPlanView): RuntimeToolRoutingSummary {
  const hotCount = plan.eagerTools.length;
  const deferredCount = plan.deferredTools.length;
  const blockedCount = plan.blockedCapabilities.length;
  const requiredCount = plan.requiredCapabilityIds.length;

  if (blockedCount === 0) {
    return {
      label: "Runtime ready",
      detail: `Routing ${hotCount} hot ${plural("tool", hotCount)} and ${deferredCount} deferred ${plural("tool", deferredCount)} for ${plan.intent}.`,
      hotCount,
      deferredCount,
      blockedCount,
      requiredCount,
      tone: "ready",
    };
  }

  if (hotCount > 0 || deferredCount > 0) {
    return {
      label: "Runtime partially wired",
      detail: `${hotCount + deferredCount}/${requiredCount} required ${plural("capability", requiredCount)} can route; ${blockedCount} ${plural("blocker", blockedCount)} remain.`,
      hotCount,
      deferredCount,
      blockedCount,
      requiredCount,
      tone: "partial",
    };
  }

  return {
    label: "Runtime blocked",
    detail: `No required tools are active for ${plan.intent}; ${blockedCount} ${plural("blocker", blockedCount)} remain.`,
    hotCount,
    deferredCount,
    blockedCount,
    requiredCount,
    tone: "blocked",
  };
}

export function topRuntimeToolLabels(plan: RuntimeToolPlanView, limit = 4): string[] {
  return [
    ...plan.eagerTools.map((route) => `hot: ${route.tool.name ?? route.tool.id}`),
    ...plan.deferredTools.map((route) => `deferred: ${route.tool.name ?? route.tool.id}`),
    ...plan.blockedCapabilities.map((capability) => `blocked: ${capability.id}`),
  ].slice(0, limit);
}

function plural(noun: string, count: number): string {
  if (count === 1) return noun;
  if (noun.endsWith("y")) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}
