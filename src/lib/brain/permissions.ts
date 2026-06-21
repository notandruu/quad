import type { BrainMemory } from "@/lib/types";

export type BrainMemoryVisibility = "company" | "team" | "personal";

export type BrainMemoryRequester = {
  userId?: string | null;
  teamIds?: string[];
  includePersonal?: boolean;
};

export type BrainMemoryAccess = {
  visibility: BrainMemoryVisibility;
  ownerUserId: string | null;
  teamIds: string[];
  readable: boolean;
  reason: "company" | "team_match" | "personal_owner" | "missing_team" | "missing_owner";
};

export function normalizeMemoryPermissions(input: {
  permissions?: string[];
  visibility?: BrainMemoryVisibility;
  userId?: string | null;
  teamId?: string | null;
  teamIds?: string[];
}): string[] {
  const values = new Set((input.permissions ?? []).map(normalizeToken).filter(Boolean));
  const visibility = input.visibility ?? inferVisibility([...values]);
  values.add(`scope:${visibility}`);

  for (const teamId of input.teamIds ?? []) {
    const normalized = normalizeToken(teamId);
    if (normalized) values.add(`team:${normalized}`);
  }
  if (input.teamId) {
    const normalized = normalizeToken(input.teamId);
    if (normalized) values.add(`team:${normalized}`);
  }
  if (input.userId) {
    const normalized = normalizeToken(input.userId);
    if (normalized) values.add(`user:${normalized}`);
  }

  return [...values];
}

export function canReadMemory(memory: Pick<BrainMemory, "permissions">, requester: BrainMemoryRequester = {}): BrainMemoryAccess {
  const permissions = memory.permissions.map(normalizeToken);
  const visibility = inferVisibility(permissions);
  const ownerUserId = valueForPrefix(permissions, "user:");
  const teamIds = valuesForPrefix(permissions, "team:");

  if (visibility === "company") {
    return { visibility, ownerUserId, teamIds, readable: true, reason: "company" };
  }

  const requesterTeams = new Set((requester.teamIds ?? []).map(normalizeToken).filter(Boolean));
  if (visibility === "team") {
    const teamMatch = teamIds.some((teamId) => requesterTeams.has(teamId));
    return {
      visibility,
      ownerUserId,
      teamIds,
      readable: teamMatch,
      reason: teamMatch ? "team_match" : "missing_team",
    };
  }

  const requesterUserId = normalizeToken(requester.userId ?? "");
  const ownsMemory = Boolean(ownerUserId && requesterUserId && ownerUserId === requesterUserId);
  const readable = Boolean(requester.includePersonal && ownsMemory);
  return {
    visibility,
    ownerUserId,
    teamIds,
    readable,
    reason: readable ? "personal_owner" : "missing_owner",
  };
}

export function filterReadableMemories<T extends Pick<BrainMemory, "permissions">>(
  memories: T[],
  requester: BrainMemoryRequester = {}
): T[] {
  return memories.filter((memory) => canReadMemory(memory, requester).readable);
}

function inferVisibility(permissions: string[]): BrainMemoryVisibility {
  if (permissions.includes("scope:personal") || permissions.includes("personal")) return "personal";
  if (permissions.includes("scope:team") || permissions.includes("team")) return "team";
  return "company";
}

function valueForPrefix(values: string[], prefix: string): string | null {
  return values.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function valuesForPrefix(values: string[], prefix: string): string[] {
  return values
    .filter((value) => value.startsWith(prefix))
    .map((value) => value.slice(prefix.length))
    .filter(Boolean);
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}
