import { NextResponse } from "next/server";
import { complete, chatModel } from "@/lib/llm/anthropic";
import {
  buildQuadChainComparison,
  buildQuadChainModelPrompt,
  parseQuadChainModelPlan,
} from "@/lib/quad-chain/workbench";

export const runtime = "nodejs";
// Comparison runs a model call; avoid the platform's short default timeout.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    rawTrace?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 4000) : "";
  const rawTrace = typeof body?.rawTrace === "string" ? body.rawTrace.slice(0, 16000) : undefined;
  const seed = buildQuadChainComparison({ prompt, rawTrace });
  const modelText = await complete({
    model: chatModel(),
    system:
      "You are Quadchain, a proof-carrying compression agent. Compress traces conservatively. Preserve exact evidence quotes. Return only valid JSON.",
    prompt: buildQuadChainModelPrompt({ prompt: seed.prompt, rawTrace: seed.rawTrace }),
    maxTokens: 1200,
    purpose: "trust_packet",
  }).catch(() => null);
  const modelPlan = parseQuadChainModelPlan(modelText);

  return NextResponse.json(buildQuadChainComparison({ prompt, rawTrace, modelPlan }));
}
