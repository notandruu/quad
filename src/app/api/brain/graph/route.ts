import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { buildScopedContextGraph, summarizeScopedContextGraph } from "@/lib/brain";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestedOrgId = url.searchParams.get("orgId") ?? DEMO_ORG_ID;
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId,
    requiredScopes: ["brain:read"],
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const graph = await buildScopedContextGraph({
    orgId: auth.orgId,
    limit: numberParam(url.searchParams.get("limit"), 25),
    includeRelationshipEdges: url.searchParams.get("edges") !== "0",
    requester: {
      userId: url.searchParams.get("userId") ?? undefined,
      teamIds: listParam(url.searchParams.get("teamIds") ?? url.searchParams.get("teamId")),
      includePersonal: truthy(url.searchParams.get("includePersonal")),
    },
  });

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    summary: summarizeScopedContextGraph(graph),
    graph,
  });
}

function numberParam(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function listParam(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function truthy(raw: string | null): boolean {
  return raw === "1" || raw === "true" || raw === "yes";
}
