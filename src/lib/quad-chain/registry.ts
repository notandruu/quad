import { getClient } from "@/lib/brain/db";
import { eventTtlSeconds, getRedis } from "@/lib/redis";
import {
  summarizeQuadChainPacket,
  type QuadChainPacket,
  type QuadChainPacketSummary,
  type QuadChainPacketType,
} from ".";

export type SaveQuadChainPacketResult = {
  durable: boolean;
  summary: QuadChainPacketSummary;
};

export type GetQuadChainPacketsInput = {
  orgId?: string;
  runId?: string;
  sourceId?: string;
  type?: QuadChainPacketType;
  limit?: number;
};

const g = globalThis as typeof globalThis & {
  __quadChainPackets?: Map<string, QuadChainPacket>;
};
if (!g.__quadChainPackets) g.__quadChainPackets = new Map();
const memoryPackets = g.__quadChainPackets;

export async function saveQuadChainPacket(packet: QuadChainPacket): Promise<SaveQuadChainPacketResult> {
  memoryPackets.set(packet.id, packet);
  pruneMemoryPackets();

  const summary = summarizeQuadChainPacket(packet);
  await saveRedisPacket(packet);
  const db = getClient();
  if (!db) return { durable: false, summary };

  try {
    const { error } = await db.from("quadchain_packets").upsert({
      id: packet.id,
      org_id: packet.orgId,
      run_id: packet.runId,
      packet_type: packet.type,
      producer: packet.producer,
      consumer: packet.consumer,
      accepted: packet.verification.accepted,
      visibility: packet.visibility,
      source_ids: packet.sources.map((source) => source.id),
      certificate_id: packet.certificate.certificateId,
      packet,
      certificate: packet.certificate,
      summary,
      created_at: packet.createdAt,
    });
    if (error) return { durable: false, summary };
    return { durable: true, summary };
  } catch {
    return { durable: false, summary };
  }
}

export async function getQuadChainPackets(input: GetQuadChainPacketsInput): Promise<QuadChainPacket[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const db = getClient();

  if (db) {
    try {
      let query = db
        .from("quadchain_packets")
        .select("packet")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (input.orgId) query = query.eq("org_id", input.orgId);
      if (input.runId) query = query.eq("run_id", input.runId);
      if (input.type) query = query.eq("packet_type", input.type);
      if (input.sourceId) query = query.contains("source_ids", [input.sourceId]);

      const { data, error } = await query;
      if (!error && data) {
        return data
          .map((row) => (row as { packet?: unknown }).packet)
          .filter(isQuadChainPacket);
      }
    } catch {
      // Fall back to memory below.
    }
  }

  const redisPackets = await getRedisPackets(input, limit);
  if (redisPackets.length > 0) return redisPackets;

  return filterMemoryPackets(input).slice(0, limit);
}

export async function getQuadChainPacket(packetId: string): Promise<QuadChainPacket | null> {
  const memoryPacket = memoryPackets.get(packetId);
  if (memoryPacket) return memoryPacket;

  const redis = getRedis();
  if (redis) {
    try {
      const packet = await redis.get<QuadChainPacket>(redisPacketKey(packetId));
      if (isQuadChainPacket(packet)) return packet;
    } catch {
      // Fall through to Supabase.
    }
  }

  const db = getClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("quadchain_packets")
      .select("packet")
      .eq("id", packetId)
      .maybeSingle();
    if (error || !data) return null;
    const packet = (data as { packet?: unknown }).packet;
    return isQuadChainPacket(packet) ? packet : null;
  } catch {
    return null;
  }
}

export async function getLatestQuadChainPacket(input: GetQuadChainPacketsInput): Promise<QuadChainPacket | null> {
  const [packet] = await getQuadChainPackets({ ...input, limit: 1 });
  return packet ?? null;
}

export function summarizeQuadChainPackets(packets: QuadChainPacket[]): {
  total: number;
  accepted: number;
  rejected: number;
  tokensSaved: number;
  evidencePreserved: number;
  evidenceRequired: number;
  latest: QuadChainPacketSummary[];
} {
  const summaries = packets.map(summarizeQuadChainPacket);
  return {
    total: summaries.length,
    accepted: summaries.filter((packet) => packet.accepted).length,
    rejected: summaries.filter((packet) => !packet.accepted).length,
    tokensSaved: summaries.reduce((total, packet) => total + packet.tokensSaved, 0),
    evidencePreserved: summaries.reduce((total, packet) => total + packet.evidencePreserved, 0),
    evidenceRequired: summaries.reduce((total, packet) => total + packet.evidenceRequired, 0),
    latest: summaries.slice(0, 10),
  };
}

function filterMemoryPackets(input: GetQuadChainPacketsInput): QuadChainPacket[] {
  return [...memoryPackets.values()]
    .filter((packet) => !input.orgId || packet.orgId === input.orgId)
    .filter((packet) => !input.runId || packet.runId === input.runId)
    .filter((packet) => !input.type || packet.type === input.type)
    .filter((packet) => !input.sourceId || packet.sources.some((source) => source.id === input.sourceId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveRedisPacket(packet: QuadChainPacket): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const ttl = eventTtlSeconds();
    await redis.set(redisPacketKey(packet.id), packet, { ex: ttl });
    await redis.lpush(redisRunKey(packet.runId), packet.id);
    await redis.expire(redisRunKey(packet.runId), ttl);
  } catch {
    // Redis is a durability bridge, not a hard dependency for packet creation.
  }
}

async function getRedisPackets(input: GetQuadChainPacketsInput, limit: number): Promise<QuadChainPacket[]> {
  if (!input.runId) return [];
  const redis = getRedis();
  if (!redis) return [];
  try {
    const ids = await redis.lrange<string>(redisRunKey(input.runId), 0, limit * 3);
    const packets: QuadChainPacket[] = [];
    for (const id of [...new Set(ids)]) {
      const packet = await redis.get<QuadChainPacket>(redisPacketKey(id));
      if (isQuadChainPacket(packet)) packets.push(packet);
      if (packets.length >= limit * 2) break;
    }
    return packets
      .filter((packet) => !input.orgId || packet.orgId === input.orgId)
      .filter((packet) => !input.type || packet.type === input.type)
      .filter((packet) => !input.sourceId || packet.sources.some((source) => source.id === input.sourceId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function redisPacketKey(packetId: string): string {
  return `quadchain:packet:${packetId}`;
}

function redisRunKey(runId: string): string {
  return `quadchain:run:${runId}:packets`;
}

function isQuadChainPacket(value: unknown): value is QuadChainPacket {
  if (!value || typeof value !== "object") return false;
  const packet = value as Partial<QuadChainPacket>;
  return Boolean(packet.id && packet.type && packet.certificate && packet.verification);
}

function pruneMemoryPackets(): void {
  if (memoryPackets.size <= 250) return;
  const oldest = [...memoryPackets.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (oldest) memoryPackets.delete(oldest.id);
}
