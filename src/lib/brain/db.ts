import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function isBrainConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

// Schema is applied via MCP at project setup — no runtime migration needed.
export async function ensureSchema(): Promise<void> {
  return;
}

export async function pingBrain(): Promise<{ ok: boolean; latencyMs?: number }> {
  const db = getClient();
  if (!db) return { ok: false };
  const start = Date.now();
  try {
    const { error } = await db.from("brain_memory").select("id").limit(1);
    if (error) return { ok: false };
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}
