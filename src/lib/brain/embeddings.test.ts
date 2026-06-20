import { describe, it, expect } from "vitest";
import { embed, cosineSimilarity, EMBEDDING_DIM, isEmbeddingConfigured } from "./embeddings";

describe("embed (pseudo mode)", () => {
  it("returns a vector of the correct dimensionality", async () => {
    const v = await embed("hello world");
    expect(v).toHaveLength(EMBEDDING_DIM);
  });

  it("returns a unit vector (cosine norm ≈ 1)", async () => {
    const v = await embed("some text about programs");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 3);
  });

  it("is deterministic for the same input", async () => {
    const a = await embed("deterministic test");
    const b = await embed("deterministic test");
    expect(a).toEqual(b);
  });

  it("produces different vectors for different inputs", async () => {
    const a = await embed("youth mentorship");
    const b = await embed("scholarship support");
    expect(a).not.toEqual(b);
  });

  it("semantically similar texts score higher than unrelated ones (rough sanity)", async () => {
    const base = await embed("nonprofit youth programs");
    const similar = await embed("youth nonprofit organization");
    const unrelated = await embed("blockchain cryptocurrency defi");
    expect(cosineSimilarity(base, similar)).toBeGreaterThan(
      cosineSimilarity(base, unrelated)
    );
  });
});

describe("isEmbeddingConfigured", () => {
  it("returns false when OPENAI_API_KEY is not set", () => {
    expect(isEmbeddingConfigured()).toBe(false);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
