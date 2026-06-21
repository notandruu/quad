import { describe, expect, it } from "vitest";
import {
  createEvidenceBundle,
  getEvidenceBundles,
  summarizeEvidenceBundle,
  summarizeEvidenceBundles,
} from "./evidence";

describe("evidence bundles", () => {
  it("creates hash-bound evidence without exposing raw bytes or text in summaries", async () => {
    const bundle = await createEvidenceBundle({
      orgId: "org_evidence_test",
      runId: "run_evidence_test",
      kind: "trust_packet_export",
      storageMode: "artifact_payload",
      mimeType: "text/markdown",
      byteLength: 21,
      text: "private packet content",
      storageKey: "run_evidence_test/export.md",
      visibility: "internal",
      classification: "internal",
      metadata: {
        filename: "export.md",
        ignored: undefined,
        long: "x".repeat(400),
      },
      now: "2026-06-21T00:00:00.000Z",
    });

    const summary = summarizeEvidenceBundle(bundle);
    expect(summary).toMatchObject({
      orgId: "org_evidence_test",
      runId: "run_evidence_test",
      kind: "trust_packet_export",
      storageMode: "artifact_payload",
      visibility: "internal",
      classification: "internal",
      mimeType: "text/markdown",
      byteLength: 21,
      storageKey: "run_evidence_test/export.md",
    });
    expect(summary.hash).toMatch(/^fnv1a:/);
    expect(summary.metadataKeys).toEqual(["filename", "long"]);
    expect(JSON.stringify(summary)).not.toContain("private packet content");
    expect(JSON.stringify(bundle)).not.toContain("private packet content");
  });

  it("keeps inline fallback evidence private while preserving retrieval summaries", async () => {
    const bundle = await createEvidenceBundle({
      orgId: "org_evidence_inline",
      runId: "run_evidence_inline",
      kind: "screenshot",
      storageMode: "inline_fallback",
      mimeType: "image/png",
      byteLength: 9,
      bytes: Buffer.from("fakeimage"),
      publicUrl: "data:image/png;base64,ZmFrZWltYWdl",
      storageKey: "run_evidence_inline/page.png",
      sourceUrl: "https://example.com",
      metadata: {
        fallback: true,
      },
      now: "2026-06-21T00:00:01.000Z",
    });

    const listed = await getEvidenceBundles({ orgId: "org_evidence_inline", runId: "run_evidence_inline" });
    const aggregate = summarizeEvidenceBundles(listed);

    expect(bundle.publicUrl).toBeNull();
    expect(listed).toHaveLength(1);
    expect(aggregate).toMatchObject({
      total: 1,
      internal: 1,
      restricted: 0,
      byKind: {
        screenshot: 1,
      },
    });
    expect(JSON.stringify(aggregate)).not.toContain("data:image");
  });

  it("defaults voice audio to restricted confidential evidence", async () => {
    const bundle = await createEvidenceBundle({
      orgId: "org_voice_evidence",
      runId: "run_voice_evidence",
      kind: "voice_audio",
      storageMode: "external_provider",
      mimeType: "audio/webm",
      byteLength: 4,
      bytes: Buffer.from([1, 2, 3, 4]),
    });

    expect(summarizeEvidenceBundle(bundle)).toMatchObject({
      kind: "voice_audio",
      visibility: "restricted",
      classification: "confidential",
      publicUrl: null,
    });
  });
});
