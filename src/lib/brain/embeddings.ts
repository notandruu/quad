import { traced, SPAN } from "@/lib/observability/phoenix";
import { assertModelCallAllowed, prepareModelPayload } from "@/lib/security";

export const EMBEDDING_DIM = 1536;

/**
 * Embed text using OpenAI text-embedding-3-small (1536-dim, fast, cheap).
 * Falls back to a deterministic pseudo-embedding when no API key is set so
 * retrieval still works in local dev. Do not ship the pseudo-embed to prod.
 */
export async function embed(text: string): Promise<number[]> {
  return traced(SPAN.embeddingCreate, { "text.length": text.length }, async (span) => {
    const decision = prepareModelPayload({
      purpose: "embedding",
      text,
    });
    assertModelCallAllowed(decision);

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: decision.payload.text, // model max is 8191 tokens
          dimensions: EMBEDDING_DIM,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`Embeddings API error ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
      };
      span.setAttribute("embedding.tokens", data.usage.total_tokens);
      return data.data[0].embedding;
    }

    span.setAttribute("embedding.mode", "pseudo");
    return pseudoEmbedding(decision.payload.text);
  });
}

/**
 * Hash-based deterministic unit vector. Stable across runs for the same input,
 * dimensionally correct, and cosine-similar inputs cluster loosely — good
 * enough to exercise retrieval paths without an API key. Dev only.
 */
function pseudoEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[(code * 31 + i) % EMBEDDING_DIM] += ((code % 13) - 6) / 100;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length && i < b.length; i++) dot += a[i] * b[i];
  return dot;
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
