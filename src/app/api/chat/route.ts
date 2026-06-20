import { NextRequest, NextResponse } from "next/server";
import { runEmployee } from "@/lib/runtime/runtime";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";
import { withSpan } from "@/lib/observability/sentry";

export const runtime = "nodejs";

/** Chat entrypoint. Classifies intent, retrieves brain context, replies. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = body.text ?? "";
  const orgId: string = body.orgId ?? DEMO_ORG_ID;
  const runId: string = body.runId ?? crypto.randomUUID();
  const employee = getEmployee(body.employeeId);

  return withSpan("chat.request", { orgId, runId, employeeId: employee.id }, async () => {
    const result = await runEmployee({
      orgId,
      employee,
      runId,
      text,
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit,
    });
    return NextResponse.json(result);
  });
}
