import { NextRequest, NextResponse } from "next/server";
import { authorizeRunAccess } from "@/lib/runs/access";
import { buildHostedRunDetail, type ArtifactKind } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const access = await authorizeRunAccess({ runId: params.runId, headers: request.headers });
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });

  const kind = new URL(request.url).searchParams.get("kind") as ArtifactKind | null;
  const artifacts = buildHostedRunDetail(access.snapshot).artifacts
    .filter((artifact) => !kind || artifact.kind === kind);

  return NextResponse.json({ ok: true, runId: access.snapshot.run.id, artifacts });
}
