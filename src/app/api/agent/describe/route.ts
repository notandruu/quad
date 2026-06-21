import { NextResponse } from "next/server";
import { buildQuadAgentDescription } from "@/lib/agent/describe";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(buildQuadAgentDescription());
}
