import { NextResponse } from "next/server";
import { ENTERPRISE_PROOF_ORG_ID, ENTERPRISE_PROOF_BRAIN, ENTERPRISE_PROOF_CONNECTOR_DOCS } from "@/data/demo/enterprise-proof";
import { deleteMemoryStore } from "@/lib/brain/store";
import { ingestMemory } from "@/lib/brain/ingest";
import { registerLocalDocuments } from "@/lib/connectors/documents";

export const runtime = "nodejs";

/**
 * POST /api/demo/enterprise-proof/reset
 *
 * Wipe and reseed the enterprise proof org brain so every demo run starts
 * from the same sparse state. Also registers the local connector fixture.
 */
export async function POST() {
  deleteMemoryStore({ orgId: ENTERPRISE_PROOF_ORG_ID });

  const memories = await Promise.allSettled(
    ENTERPRISE_PROOF_BRAIN.map((input) => ingestMemory(input))
  );

  registerLocalDocuments(ENTERPRISE_PROOF_CONNECTOR_DOCS);

  const succeeded = memories.filter((r) => r.status === "fulfilled").length;
  const failed = memories.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    orgId: ENTERPRISE_PROOF_ORG_ID,
    brainMemoriesSeeded: succeeded,
    brainMemoriesFailed: failed,
    connectorDocsRegistered: ENTERPRISE_PROOF_CONNECTOR_DOCS.length,
  });
}
