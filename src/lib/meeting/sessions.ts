/**
 * In-process meeting session registry. Tracks active Recall bots,
 * their run IDs (for the Redis event stream), and per-bot state.
 * Survives Next.js dev hot-reloads via globalThis pinning.
 */

import { eventTtlSeconds, getRedis } from "@/lib/redis";

export type MeetingSession = {
  runId: string;
  orgId: string;
  botId: string | null;
  meetingUrl: string | null;
  status: "idle" | "joining" | "live" | "ended" | "failed";
  title: string;
  startedAt: string;
  endedAt: string | null;
  learnedCount: number;
  rejectedCount: number;
  /** Accumulated transcript text, speaker-prefixed lines joined by \n. */
  transcript: string;
};

const g = globalThis as typeof globalThis & {
  __quadMeetingSessions?: Map<string, MeetingSession>;
};
if (!g.__quadMeetingSessions) g.__quadMeetingSessions = new Map();
const sessions = g.__quadMeetingSessions;

export function createMeetingSession(input: {
  runId: string;
  orgId: string;
  title?: string;
  meetingUrl?: string;
}): MeetingSession {
  const session: MeetingSession = {
    runId: input.runId,
    orgId: input.orgId,
    botId: null,
    meetingUrl: input.meetingUrl ?? null,
    status: "idle",
    title: input.title ?? "Live meeting",
    startedAt: new Date().toISOString(),
    endedAt: null,
    learnedCount: 0,
    rejectedCount: 0,
    transcript: "",
  };
  sessions.set(input.runId, session);
  pruneSessions();
  return session;
}

export function getMeetingSession(runId: string): MeetingSession | null {
  return sessions.get(runId) ?? null;
}

export function getMeetingSessionByBotId(botId: string): MeetingSession | null {
  for (const session of sessions.values()) {
    if (session.botId === botId) return session;
  }
  return null;
}

export function updateMeetingSession(
  runId: string,
  patch: Partial<Omit<MeetingSession, "runId">>
): MeetingSession | null {
  const session = sessions.get(runId);
  if (!session) return null;
  Object.assign(session, patch);
  return session;
}

export async function persistMeetingSession(session: MeetingSession): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(meetingSessionKey(session.runId), session, { ex: eventTtlSeconds() });
  if (session.botId) {
    await redis.set(meetingBotKey(session.botId), session.runId, { ex: eventTtlSeconds() });
  }
}

export async function getDurableMeetingSession(runId: string): Promise<MeetingSession | null> {
  const memory = getMeetingSession(runId);
  if (memory) return memory;

  const redis = getRedis();
  if (!redis) return null;
  const session = await redis.get<MeetingSession>(meetingSessionKey(runId)).catch(() => null);
  if (!session) return null;
  sessions.set(session.runId, session);
  return session;
}

export async function getDurableMeetingSessionByBotId(botId: string): Promise<MeetingSession | null> {
  const memory = getMeetingSessionByBotId(botId);
  if (memory) return memory;

  const redis = getRedis();
  if (!redis) return null;
  const runId = await redis.get<string>(meetingBotKey(botId)).catch(() => null);
  if (!runId) return null;
  return getDurableMeetingSession(runId);
}

export async function updateDurableMeetingSession(
  runId: string,
  patch: Partial<Omit<MeetingSession, "runId">>
): Promise<MeetingSession | null> {
  const existing = (await getDurableMeetingSession(runId)) ?? updateMeetingSession(runId, patch);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  sessions.set(runId, updated);
  await persistMeetingSession(updated);
  return updated;
}

export function listMeetingSessions(orgId?: string): MeetingSession[] {
  const all = [...sessions.values()];
  return orgId ? all.filter((s) => s.orgId === orgId) : all;
}

function pruneSessions() {
  if (sessions.size <= 50) return;
  const oldest = [...sessions.values()].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt)
  )[0];
  if (oldest) sessions.delete(oldest.runId);
}

function meetingSessionKey(runId: string) {
  return `meeting:session:${runId}`;
}

function meetingBotKey(botId: string) {
  return `meeting:bot:${botId}`;
}
