import { describe, expect, it } from "vitest";
import type { PublishedEvent } from "@/lib/redis/publisher";
import { buildCounterRows, buildLogRows, progressPercent } from "./liveLogs";

function event(overrides: Partial<PublishedEvent>): PublishedEvent {
  return {
    type: "page.rendered",
    payload: {},
    sequence: 0,
    createdAt: "2026-06-20T20:30:45.000Z",
    ...overrides,
  };
}

describe("buildLogRows", () => {
  it("maps known events into readable labels and url details", () => {
    const rows = buildLogRows([
      event({
        type: "page.rendered",
        payload: { url: "https://example.com/programs/" },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      sequence: "#1",
      label: "Page rendered",
      detail: "example.com/programs",
      tone: "success",
    });
  });

  it("summarizes audit completion payloads", () => {
    const rows = buildLogRows([
      event({
        type: "audit.complete",
        payload: { findingsShown: 4, findingsFiltered: 2 },
      }),
    ]);

    expect(rows[0].detail).toBe("4 shown, 2 filtered");
  });

  it("falls back to list order when redis sequence is unavailable", () => {
    const rows = buildLogRows([event({ sequence: -1 })]);
    expect(rows[0].sequence).toBe("#1");
  });
});

describe("buildCounterRows", () => {
  it("builds stable rows with rendered fallback keys", () => {
    const rows = buildCounterRows({
      pagesDiscovered: 10,
      pagesRendered: 4,
      pagesAnalyzed: 2,
      findingsCreated: 1,
    });

    expect(rows.map((row) => row.label)).toEqual([
      "Discovered",
      "Rendered",
      "Analyzed",
      "Findings",
    ]);
    expect(rows[1].value).toBe(4);
    expect(progressPercent(rows[1])).toBe(40);
  });
});
