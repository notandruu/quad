import { describe, expect, it } from "vitest";
import { normalizeMemoryMetadata, parseMemoryMetadata, refreshMemoryMetadata } from "./metadata";

describe("brain memory metadata", () => {
  it("normalizes owner, teams, stale-after, and relationships", () => {
    const metadata = normalizeMemoryMetadata({
      visibility: "team",
      userId: "Stephen",
      teamIds: ["Security", "security"],
      staleAfter: "2026-06-22T00:00:00.000Z",
      sourceUpdatedAt: "2026-06-21T00:00:00.000Z",
      relationships: [
        { kind: "supports", sourceId: "policy_1", label: "policy" },
      ],
      relatedSourceIds: ["meeting_1"],
    }, "2026-06-21T12:00:00.000Z");

    expect(metadata).toMatchObject({
      visibility: "team",
      ownerUserId: "stephen",
      teamIds: ["security"],
      validationStatus: "approved",
      freshness: "fresh",
    });
    expect(metadata.relationships).toEqual([
      { kind: "supports", sourceId: "policy_1", label: "policy" },
      { kind: "derived_from", sourceId: "meeting_1" },
    ]);
  });

  it("marks stale memories after staleAfter", () => {
    const metadata = normalizeMemoryMetadata({
      staleAfter: "2026-06-21T00:00:00.000Z",
    }, "2026-06-21T12:00:00.000Z");

    expect(metadata.freshness).toBe("stale");
    expect(refreshMemoryMetadata({ ...metadata, staleAfter: null }).freshness).toBe("unknown");
  });

  it("parses stored metadata defensively", () => {
    const metadata = parseMemoryMetadata({
      visibility: "personal",
      ownerUserId: "Maddy",
      validationStatus: "verified",
      staleAfter: "bad-date",
      relationships: [{ kind: "updates", sourceId: "note_1" }, { kind: "bad", sourceId: "nope" }],
    });

    expect(metadata).toMatchObject({
      visibility: "personal",
      ownerUserId: "maddy",
      validationStatus: "verified",
      staleAfter: null,
    });
    expect(metadata?.relationships).toEqual([{ kind: "updates", sourceId: "note_1" }]);
  });
});
