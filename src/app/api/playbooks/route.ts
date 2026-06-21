import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { summarizeCapabilities } from "@/lib/metaregistry";
import { summarizePlaybookCatalog } from "@/lib/playbooks";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import { MVP_INTENTS, type Intent } from "@/lib/types/runtime";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const intent = url.searchParams.get("intent");
  const normalizedIntent = intent && MVP_INTENTS.includes(intent as Intent)
    ? intent as Intent
    : undefined;
  const capabilities = summarizeCapabilities(process.env, { orgId: auth.orgId });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    playbooks: summarizePlaybookCatalog({
      activeCapabilityIds: capabilities.activeTools.map((tool) => tool.id),
      intent: normalizedIntent,
    }),
  });
}
