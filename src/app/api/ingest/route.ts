import { NextRequest, NextResponse } from "next/server";
import { ingestMemory } from "@/lib/brain";
import { DEMO_ORG_ID } from "@/data/seed";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";

const VALID_SOURCE_TYPES: SourceType[] = ["doc", "meeting", "website", "slack", "email", "manual", "audit"];

function coerceSourceType(raw: unknown): SourceType {
  if (typeof raw === "string" && (VALID_SOURCE_TYPES as string[]).includes(raw)) {
    return raw as SourceType;
  }
  // Graceful aliases
  if (raw === "internal_doc" || raw === "document" || raw === "note") return "doc";
  if (raw === "transcript") return "meeting";
  return "manual";
}

/**
 * Ingest a doc, note, meeting transcript, or manual profile into the company
 * brain. Embeds and persists the memory.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }

  try {
    const memory = await ingestMemory({
      orgId: body.orgId ?? DEMO_ORG_ID,
      sourceId: body.sourceId ?? `manual_${Date.now()}`,
      sourceType: coerceSourceType(body.sourceType),
      title: body.title,
      content: body.content,
      summary: body.summary,
      entities: body.entities,
      confidence: body.confidence,
      permissions: body.permissions,
      evidence: body.evidence,
    });
    return NextResponse.json({ id: memory.id, ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
