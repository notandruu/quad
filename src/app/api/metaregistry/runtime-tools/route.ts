import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { buildRuntimeToolRoutingPlan } from "@/lib/metaregistry";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

const IntentSchema = z.enum([
  "general_chat",
  "company_question",
  "website_audit",
  "audit_follow_up",
  "draft_content",
  "create_task",
  "summarize_meeting",
  "save_memory",
  "send_email",
  "post_slack",
  "update_crm",
  "schedule_meeting",
]);

const SurfaceSchema = z.enum(["dashboard", "chat", "voice", "fetch_agent", "worker"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
    requiredScopes: ["tools:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const intent = IntentSchema.catch("general_chat").parse(url.searchParams.get("intent") ?? "general_chat");
  const surface = SurfaceSchema.catch("dashboard").parse(url.searchParams.get("surface") ?? "dashboard");
  const plan = buildRuntimeToolRoutingPlan({
    intent,
    surface,
    env: process.env,
    orgId: auth.orgId,
  });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    plan: {
      ...plan,
      blockedCapabilities: plan.blockedCapabilities.map((capability) => ({
        id: capability.id,
        reason: safeBlockedReason(capability.missingEnv.length, capability.disabled, capability.allowlisted),
        missingEnvCount: capability.missingEnv.length,
        allowlisted: capability.allowlisted,
        disabled: capability.disabled,
      })),
    },
  });
}

function safeBlockedReason(missingEnvCount: number, disabled: boolean, allowlisted: boolean): string {
  if (disabled) return "Capability is disabled by policy.";
  if (!allowlisted) return "Capability is not allowlisted for this org.";
  if (missingEnvCount > 0) {
    return `Capability is missing ${missingEnvCount} required configuration ${missingEnvCount === 1 ? "setting" : "settings"}.`;
  }
  return "Capability is not active for this runtime turn.";
}
