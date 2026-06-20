import { traced, SPAN } from "@/lib/observability/phoenix";

export const EMBEDDING_DIM = 1536;

/**
 * Create an embedding for a chunk of text.
 *
 * TODO: call OpenAI text-embedding-3-small (or Gemini) here. For now this
 * returns a deterministic pseudo-embedding so retrieval can be exercised
 * locally without an API key. Do not ship the fallback to production.
 */
export async function embed(text: string): Promise<number[]> {
  return traced(SPAN.embeddingCreate, { "text.length": text.length }, async () => {
    if (process.env.OPENAI_API_KEY) {
      // Replace with a real embeddings call.
      // const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
      // return res.data[0].embedding;
    }
    return pseudoEmbedding(text);
  });
}

/** Hash-based deterministic vector. Stable for the same input, dev only. */
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
