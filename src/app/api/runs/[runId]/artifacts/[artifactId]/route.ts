import { NextRequest, NextResponse } from "next/server";
import { authorizeRunAccess } from "@/lib/runs/access";
import { getHostedArtifactDetail } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string; artifactId: string } }
) {
  const access = await authorizeRunAccess({ runId: params.runId, headers: request.headers });
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });

  const includeRawData = new URL(request.url).searchParams.get("raw") === "1";
  if (includeRawData && access.auth.mode !== "secret") {
    return NextResponse.json(
      {
        ok: false,
        error: "Raw artifact access requires hosted API secret auth.",
        code: "raw_artifact_requires_secret",
      },
      { status: 403 }
    );
  }

  const artifact = getHostedArtifactDetail(access.snapshot, params.artifactId, { includeRawData });
  if (!artifact) {
    return NextResponse.json({ ok: false, error: "artifact not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, artifact });
}
