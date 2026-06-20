import { NextResponse } from "next/server";
import { getClient } from "@/lib/brain/db";
import { ingestMemory } from "@/lib/brain/ingest";
import { DEMO_BRAIN_MEMORIES } from "@/data/demo/brain";

export const runtime = "nodejs";

const DEMO_ORG_ID = "org_brightpath";

/**
 * POST /api/demo/reset
 *
 * Wipes all brain memories for org_brightpath and reseeds from the demo
 * brain fixture. Call this before a live demo to get a clean, known state.
 */
export async function POST() {
  try {
    // Delete existing memories for the demo org.
    const db = getClient();
    if (db) {
      const { error } = await db
        .from("brain_memory")
        .delete()
        .eq("org_id", DEMO_ORG_ID);
      if (error) throw new Error(`Delete failed: ${error.message}`);
    }

    // Ingest each demo memory in sequence.
    for (const mem of DEMO_BRAIN_MEMORIES) {
      await ingestMemory(mem);
    }

    return NextResponse.json({ ok: true, memoriesLoaded: DEMO_BRAIN_MEMORIES.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
