import { NextRequest, NextResponse } from "next/server";
import { authorizeRunAccess } from "@/lib/runs/access";
import { buildReplayableHostedTaskStream } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const access = await authorizeRunAccess({ runId: params.runId, headers: request.headers });
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });

  const url = new URL(request.url);
  const stream = await buildReplayableHostedTaskStream(access.snapshot, {
    afterSequence: Number(url.searchParams.get("after") ?? 0),
    limit: Number(url.searchParams.get("limit") ?? 50),
  });

  return NextResponse.json({ ok: true, stream });
}
