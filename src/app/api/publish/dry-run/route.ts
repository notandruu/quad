import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_ORG_ID } from "@/data/seed";
import { DryRunPublishError, dryRunPublish } from "@/lib/fde/publisher";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

const DryRunBody = z.object({
  runId: z.string().min(1),
  orgId: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof DryRunBody>;
  try {
    body = DryRunBody.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "runId is required." }, { status: 400 });
  }

  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: body.orgId ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  try {
    const result = await dryRunPublish({
      runId: body.runId,
      orgId: auth.orgId,
      actor: body.actor,
    });

    return NextResponse.json({
      ok: true,
      task: result.task,
      staged: result.staged.map((item) => ({
        artifact: {
          id: item.artifact.id,
          kind: item.artifact.kind,
          title: item.artifact.title,
          hash: item.artifact.hash,
        },
        receiptId: item.receiptId,
        packet: item.packet,
      })),
    });
  } catch (error) {
    if (error instanceof DryRunPublishError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Dry-run publish failed." }, { status: 500 });
  }
}
