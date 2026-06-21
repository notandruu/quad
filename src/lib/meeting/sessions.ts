/**
 * In-process meeting session registry. Tracks active Recall bots,
 * their run IDs (for the Redis event stream), and per-bot state.
 * Survives Next.js dev hot-reloads via globalThis pinning.
 */

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
