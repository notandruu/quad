import { NextResponse } from "next/server";
import { getQuadChainPacket } from "@/lib/quad-chain/registry";
import { verifyQuadChainPacket } from "@/lib/quad-chain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { packetId?: unknown } | null;
  const packetId = typeof body?.packetId === "string" ? body.packetId : "";
  if (!packetId) return NextResponse.json({ error: "packetId required" }, { status: 400 });

  const packet = await getQuadChainPacket(packetId);
  if (!packet) return NextResponse.json({ error: "packet not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    verification: verifyQuadChainPacket(packet),
  });
}
