import { describe, it, expect } from "vitest";
import { currentDateRule, buildAnalyzePrompt, buildSynthesisPrompt, buildAuditChatSystemPrompt } from "./prompts";
import type { BrainMemory, RenderedPageEvidence } from "@/lib/types";

const TODAY = new Date("2026-06-20T00:00:00Z");

function makePage(overrides: Partial<RenderedPageEvidence> = {}): RenderedPageEvidence {
  return {
    url: "https://example.org",
    title: "Home",
    status: 200,
    text: "Welcome to BrightPath. We offer youth mentorship.",
    headings: [{ level: 1, text: "Welcome" }],
    links: [],
    buttons: [],
    images: [],
    forms: [],
    selectors: [],
    metadata: { description: "We help kids" },
    ...overrides,
  };
}

function makeMem(overrides: Partial<BrainMemory> = {}): BrainMemory {
  return {
    id: "m1",
    orgId: "org1",
    sourceId: "s1",
    sourceType: "doc",
    title: "Programs overview",
    content: "We run youth mentorship, parent workshops, and scholarship support.",
    summary: "Three programs: mentorship, workshops, scholarships.",
    entities: ["youth mentorship", "parent workshops", "scholarship support"],
    embedding: [],
    confidence: 0.9,
    permissions: [],
    createdAt: "",
    updatedAt: "",
    evidence: [],
    ...overrides,
  };
}

describe("currentDateRule", () => {
  it("includes the ISO date and the current year", () => {
    const rule = currentDateRule(TODAY);
    expect(rule).toContain("2026-06-20");
    expect(rule).toContain("2026");
  });
});

describe("buildAnalyzePrompt", () => {
  it("includes the page URL, title, and visible text", () => {
    const prompt = buildAnalyzePrompt(makePage(), []);
    expect(prompt).toContain("https://example.org");
    expect(prompt).toContain("Home");
    expect(prompt).toContain("Welcome to BrightPath");
  });

  it("includes all brain context titles and summaries", () => {
    const prompt = buildAnalyzePrompt(makePage(), [makeMem()]);
    expect(prompt).toContain("Programs overview");
    expect(prompt).toContain("mentorship, workshops, scholarships");
  });

  it("includes the date rule", () => {
    const prompt = buildAnalyzePrompt(makePage(), []);
    expect(prompt).toContain("2026");
  });

  it("includes the evidence requirement instruction", () => {
    const prompt = buildAnalyzePrompt(makePage(), []);
    expect(prompt).toContain("ground");
  });

  it("includes all 14 category names", () => {
    const prompt = buildAnalyzePrompt(makePage(), []);
    expect(prompt).toContain("missing_public_explanation");
    expect(prompt).toContain("internal_external_mismatch");
    expect(prompt).toContain("brand_voice_mismatch");
  });

  it("renders heading structure", () => {
    const prompt = buildAnalyzePrompt(
      makePage({ headings: [{ level: 2, text: "Programs" }] }),
      []
    );
    expect(prompt).toContain("## Programs");
  });

  it("handles empty brain gracefully", () => {
    const prompt = buildAnalyzePrompt(makePage(), []);
    expect(prompt).toContain("no brain context retrieved");
  });
});

describe("buildSynthesisPrompt", () => {
  it("includes the target URL and findings", () => {
    const prompt = buildSynthesisPrompt(
      "https://example.org",
      [{ title: "Missing FAQ", severity: "high", businessImpact: "Users confused", recommendedFix: "Add FAQ", pageUrl: "https://example.org/about" }],
      "We run three programs"
    );
    expect(prompt).toContain("https://example.org");
    expect(prompt).toContain("Missing FAQ");
    expect(prompt).toContain("We run three programs");
  });
});

describe("buildAuditChatSystemPrompt", () => {
  it("includes employee name, tone, summary, and findings", () => {
    const prompt = buildAuditChatSystemPrompt(
      "Quad",
      "warm, direct",
      [makeMem()],
      "Found 3 issues",
      [{ title: "Missing page", severity: "high", recommendedFix: "Add page", pageUrl: "https://example.org" }]
    );
    expect(prompt).toContain("Quad");
    expect(prompt).toContain("warm, direct");
    expect(prompt).toContain("Found 3 issues");
    expect(prompt).toContain("Missing page");
    expect(prompt).toContain("Programs overview");
  });
});
