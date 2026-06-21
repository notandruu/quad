import { getClient } from "./db";
import { deleteMemoryStore, listMemoryStore } from "./store";

export async function countBrainMemories(input: { orgId: string; sourceId?: string }): Promise<number> {
  const db = getClient();
  if (db) {
    try {
      let query = db
        .from("brain_memory")
        .select("id", { count: "exact", head: true })
        .eq("org_id", input.orgId);
      if (input.sourceId) query = query.eq("source_id", input.sourceId);
      const { count, error } = await query;
      if (!error) return count ?? 0;
    } catch {
      // Fall through to memory count.
    }
  }

  return listMemoryStore(input).length;
}

export async function deleteBrainMemories(input: { orgId: string; sourceId?: string }): Promise<number> {
  const memoryDeleted = deleteMemoryStore(input);
  const db = getClient();
  if (!db) return memoryDeleted;

  try {
    const before = await countBrainMemories(input);
    let query = db.from("brain_memory").delete().eq("org_id", input.orgId);
    if (input.sourceId) query = query.eq("source_id", input.sourceId);
    const { error } = await query;
    if (error) return memoryDeleted;
    return Math.max(memoryDeleted, before);
  } catch {
    return memoryDeleted;
  }
}
