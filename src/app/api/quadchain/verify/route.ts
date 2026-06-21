import { NextResponse } from "next/server";
import { getQuadChainPacket } from "@/lib/quad-chain/registry";
import { verifyQuadChainPacket } from "@/lib/quad-chain";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { packetId?: unknown } | null;
  const packetId = typeof body?.packetId === "string" ? body.packetId : "";
  if (!packetId) return NextResponse.json({ error: "packetId required" }, { status: 400 });

  const packet = await getQuadChainPacket(packetId);
  if (!packet) return NextResponse.json({ error: "packet not found" }, { status: 404 });
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: packet.orgId,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    verification: verifyQuadChainPacket(packet),
  });
}
