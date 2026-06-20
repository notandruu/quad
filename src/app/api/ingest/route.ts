import { NextRequest, NextResponse } from "next/server";
import { ingestMemory } from "@/lib/brain";
import { DEMO_ORG_ID } from "@/data/seed";

export const runtime = "nodejs";

/**
 * Ingest a doc, note, meeting transcript, or manual profile into the company
 * brain. Embeds and persists the memory.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }

  const memory = await ingestMemory({
    orgId: body.orgId ?? DEMO_ORG_ID,
    sourceId: body.sourceId ?? `manual_${Date.now()}`,
    sourceType: body.sourceType ?? "manual",
    title: body.title,
    content: body.content,
    summary: body.summary,
    entities: body.entities,
    confidence: body.confidence,
    permissions: body.permissions,
    evidence: body.evidence,
  });

  return NextResponse.json({ id: memory.id, ok: true });
}
