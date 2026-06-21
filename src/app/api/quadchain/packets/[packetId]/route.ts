import { NextResponse } from "next/server";
import { getQuadChainPacket } from "@/lib/quad-chain/registry";
import { buildQuadChainPacketDetail, summarizeQuadChainPacket } from "@/lib/quad-chain";
import { authorizeRequest, requestAuthError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { packetId: string } }
) {
  const packet = await getQuadChainPacket(params.packetId);
  if (!packet) {
    return NextResponse.json({ error: "packet not found" }, { status: 404 });
  }

  const includeRawPacket = new URL(request.url).searchParams.get("raw") === "1";
  const requiresAuth = includeRawPacket || packet.visibility !== "public";
  const auth = requiresAuth
    ? authorizeRequest({
        headers: request.headers,
        requestedOrgId: packet.orgId,
      })
    : null;
  if (auth && !auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }
  if (includeRawPacket && auth?.mode !== "secret") {
    return NextResponse.json(
      {
        ok: false,
        error: "Raw packet access requires hosted API secret auth.",
        code: "raw_packet_requires_secret",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    summary: summarizeQuadChainPacket(packet),
    packet: buildQuadChainPacketDetail(packet, { includeRawPacket }),
  });
}
