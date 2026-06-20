import type { BrainMemory } from "@/lib/types";

export const DEMO_ORG_ID = "org_brightpath";

/**
 * Demo organization: BrightPath, a small youth nonprofit. The internal brain
 * lists three programs; the demo website only clearly explains one. That gap
 * is the core "internal vs external" moment in the audit demo.
 */
const now = "2026-06-20T00:00:00.000Z";

function memory(
  partial: Omit<BrainMemory, "embedding" | "createdAt" | "updatedAt" | "orgId">
): BrainMemory {
  return {
    orgId: DEMO_ORG_ID,
    embedding: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const demoBrainSeed: BrainMemory[] = [
  memory({
    id: "mem_overview",
    sourceId: "doc_overview",
    sourceType: "doc",
    title: "BrightPath company overview",
    content:
      "BrightPath is a youth-focused nonprofit serving families in East Oakland. We run three programs: youth mentorship, parent workshops, and scholarship support. Our voice is warm, plainspoken, and hopeful.",
    summary: "Nonprofit with three programs and a warm brand voice.",
    entities: ["BrightPath", "youth mentorship", "parent workshops", "scholarship support"],
    confidence: 0.95,
    permissions: ["read"],
    evidence: [{ documentId: "doc_overview", quote: "We run three programs" }],
  }),
  memory({
    id: "mem_meeting",
    sourceId: "meeting_2026_06_10",
    sourceType: "meeting",
    title: "Program sync, June 10 2026",
    content:
      "Team confirmed the fall scholarship deadline is October 1, 2026. Parent workshops move to a monthly cadence. Action item: publish a scholarship FAQ on the website.",
    summary: "Scholarship deadline Oct 1 2026; publish scholarship FAQ.",
    entities: ["scholarship support", "parent workshops", "FAQ"],
    confidence: 0.9,
    permissions: ["read"],
    evidence: [{ quote: "publish a scholarship FAQ on the website" }],
  }),
  memory({
    id: "mem_brand_voice",
    sourceId: "note_brand_voice",
    sourceType: "manual",
    title: "Brand voice rules",
    content:
      "Write to parents, not at them. Short sentences. No jargon. Always name the concrete benefit to a child or family.",
    summary: "Warm, concrete, parent-facing tone.",
    entities: ["brand voice rules"],
    confidence: 0.85,
    permissions: ["read"],
    evidence: [],
  }),
  memory({
    id: "mem_website_snapshot",
    sourceId: "website_home",
    sourceType: "website",
    title: "Current homepage claims",
    content:
      "The public homepage describes youth mentorship in detail. It does not mention parent workshops or scholarship support. No FAQ section. Footer copyright reads 2026.",
    summary: "Website only explains youth mentorship; missing two programs.",
    entities: ["youth mentorship", "website pages"],
    confidence: 0.8,
    permissions: ["read"],
    evidence: [{ url: "https://example.org", quote: "youth mentorship" }],
  }),
];
