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
