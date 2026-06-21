import type { BrainMemory } from "@/lib/types";
import { demoBrainSeed } from "@/data/seed";

/**
 * In-memory brain used when DATABASE_URL is not set. Seeded with the demo org
 * so the product is explorable without Postgres. Writes here are not durable;
 * configure pgvector for real persistence.
 */
export const seedMemories: BrainMemory[] = [...demoBrainSeed];

export function addMemory(memory: BrainMemory): void {
  seedMemories.push(memory);
}

export function listMemoryStore(input: { orgId?: string; sourceId?: string } = {}): BrainMemory[] {
  return seedMemories
    .filter((memory) => !input.orgId || memory.orgId === input.orgId)
    .filter((memory) => !input.sourceId || memory.sourceId === input.sourceId)
    .map((memory) => ({ ...memory }));
}

export function deleteMemoryStore(input: { orgId: string; sourceId?: string }): number {
  let deleted = 0;
  for (let index = seedMemories.length - 1; index >= 0; index -= 1) {
    const memory = seedMemories[index];
    if (memory.orgId !== input.orgId) continue;
    if (input.sourceId && memory.sourceId !== input.sourceId) continue;
    seedMemories.splice(index, 1);
    deleted += 1;
  }
  return deleted;
}
