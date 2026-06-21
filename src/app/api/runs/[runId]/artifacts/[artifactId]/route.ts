import { NextRequest, NextResponse } from "next/server";
import { getHostedArtifactDetail, loadRunSnapshot } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string; artifactId: string } }
) {
  const snapshot = await loadRunSnapshot(params.runId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "run not found" }, { status: 404 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: snapshot.run.orgId,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const artifact = getHostedArtifactDetail(snapshot, params.artifactId);
  if (!artifact) {
    return NextResponse.json({ ok: false, error: "artifact not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, artifact });
}
