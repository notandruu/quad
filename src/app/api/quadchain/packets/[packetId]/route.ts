import { NextResponse } from "next/server";
import { getQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeQuadChainPacket } from "@/lib/quad-chain";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { packetId: string } }
) {
  const packet = await getQuadChainPacket(params.packetId);
  if (!packet) {
    return NextResponse.json({ error: "packet not found" }, { status: 404 });
  }

  const publicPacket = packet.visibility === "public"
    ? packet
    : {
        ...packet,
        sources: packet.sources.map((source) => ({
          id: source.id,
          kind: source.kind,
          content: "[redacted]",
        })),
        output: "[redacted]",
      };

  return NextResponse.json({
    ok: true,
    summary: summarizeQuadChainPacket(packet),
    packet: publicPacket,
  });
}
