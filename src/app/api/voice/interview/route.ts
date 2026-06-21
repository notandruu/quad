import { NextRequest, NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import { selectVoiceInterviewQuestion } from "@/lib/voice/interview";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: typeof body.orgId === "string" ? body.orgId : DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const answeredIds = Array.isArray(body.answeredIds)
    ? body.answeredIds.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const cursor = typeof body.cursor === "number" ? body.cursor : undefined;

  return NextResponse.json({
    ok: true,
    orgId: auth.orgId,
    runId: typeof body.runId === "string" ? body.runId : null,
    ...selectVoiceInterviewQuestion({ answeredIds, cursor }),
  });
}
