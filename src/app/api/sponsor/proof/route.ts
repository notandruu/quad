import { NextResponse } from "next/server";
import { buildSponsorProofManifest } from "@/lib/sponsors/proof";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(buildSponsorProofManifest());
}
