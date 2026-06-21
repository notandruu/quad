import { NextResponse } from "next/server";
import { getQuadChainPackets, summarizeQuadChainPackets } from "@/lib/quad-chain/registry";
import { summarizeQuadChainPacket, type QuadChainPacketType } from "@/lib/quad-chain";

export const runtime = "nodejs";

const PACKET_TYPES: QuadChainPacketType[] = [
  "audit_event",
  "audit_report",
  "finding",
  "brain_memory_write",
  "chat_answer",
  "voice_transcript",
  "agent_handoff",
  "trust_packet",
  "approval",
  "connector_action",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const packets = await getQuadChainPackets({
    orgId: url.searchParams.get("orgId") ?? undefined,
    runId: url.searchParams.get("runId") ?? undefined,
    sourceId: url.searchParams.get("sourceId") ?? undefined,
    type: type && PACKET_TYPES.includes(type as QuadChainPacketType) ? (type as QuadChainPacketType) : undefined,
    limit: Number(url.searchParams.get("limit") ?? 25),
  });

  return NextResponse.json({
    ok: true,
    summary: summarizeQuadChainPackets(packets),
    packets: packets.map(summarizeQuadChainPacket),
  });
}
