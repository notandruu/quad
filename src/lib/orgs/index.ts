import { DEMO_ORG_ID } from "@/data/seed";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { getClient } from "@/lib/brain/db";

export type OrgStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type MembershipStatus = "active" | "invited" | "revoked";

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRecord = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  region: string;
  retentionDays: number | null;
  defaultVisibility: "company" | "team" | "personal";
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMembershipRecord = {
  id: string;
  orgId: string;
  workspaceId: string;
  userId: string;
  email: string | null;
  role: WorkspaceRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrgWorkspaceContext = {
  org: OrganizationRecord;
  workspace: WorkspaceRecord;
  memberships: WorkspaceMembershipRecord[];
  requester: {
    userId: string | null;
    role: WorkspaceRole | "service" | "unknown";
    status: MembershipStatus | "service" | "unknown";
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canAdmin: boolean;
  };
  boundary: {
    tenantKeyPrefix: string;
    defaultVisibility: WorkspaceRecord["defaultVisibility"];
    region: string;
    retentionDays: number | null;
  };
};

export type EnsureOrgWorkspaceInput = {
  orgId: string;
  name?: string;
  slug?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceSlug?: string;
  region?: string;
  retentionDays?: number | null;
  defaultVisibility?: WorkspaceRecord["defaultVisibility"];
  now?: string;
};

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

const g = globalThis as typeof globalThis & {
  __quadOrganizations?: Map<string, OrganizationRecord>;
  __quadWorkspaces?: Map<string, WorkspaceRecord>;
  __quadWorkspaceMemberships?: Map<string, WorkspaceMembershipRecord>;
};
if (!g.__quadOrganizations) g.__quadOrganizations = new Map();
if (!g.__quadWorkspaces) g.__quadWorkspaces = new Map();
if (!g.__quadWorkspaceMemberships) g.__quadWorkspaceMemberships = new Map();

const organizations = g.__quadOrganizations;
const workspaces = g.__quadWorkspaces;
const memberships = g.__quadWorkspaceMemberships;

seedDefaultOrgs();

export async function ensureOrgWorkspace(
  input: EnsureOrgWorkspaceInput
): Promise<OrgWorkspaceContext> {
  const now = input.now ?? new Date().toISOString();
  const orgId = normalizeOrgId(input.orgId);
  const org = normalizeOrg({
    id: orgId,
    name: input.name ?? defaultOrgName(orgId),
    slug: input.slug ?? input.name ?? orgId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const workspace = normalizeWorkspace({
    id: input.workspaceId ?? `${orgId}_workspace`,
    orgId,
    name: input.workspaceName ?? "Default workspace",
    slug: input.workspaceSlug ?? "default",
    status: "active",
    region: input.region ?? "us",
    retentionDays: normalizeRetentionDays(input.retentionDays),
    defaultVisibility: input.defaultVisibility ?? "company",
    createdAt: now,
    updatedAt: now,
  });

  organizations.set(org.id, org);
  workspaces.set(workspace.id, workspace);
  const db = getClient();
  if (db) {
    try {
      await db.from("quad_orgs").upsert(toOrgRow(org), { onConflict: "id" });
      await db.from("quad_workspaces").upsert(toWorkspaceRow(workspace), { onConflict: "id" });
    } catch {
      // Memory fallback remains authoritative for zero-key demos.
    }
  }

  return buildContext(org, workspace, []);
}

export async function getOrgWorkspaceContext(input: {
  orgId: string;
  userId?: string | null;
}): Promise<OrgWorkspaceContext> {
  const orgId = normalizeOrgId(input.orgId);
  const loaded = await loadOrgWorkspace(orgId);
  if (loaded) return withRequester(loaded, input.userId ?? null);
  const ensured = await ensureOrgWorkspace({ orgId });
  return withRequester(ensured, input.userId ?? null);
}

export async function listOrgWorkspaceContexts(input: {
  orgIds?: string[];
  userId?: string | null;
  limit?: number;
} = {}): Promise<OrgWorkspaceContext[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const requested = input.orgIds?.map(normalizeOrgId).filter(Boolean);
  const db = getClient();
  if (db) {
    try {
      let query = db
        .from("quad_orgs")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (requested && requested.length > 0) query = query.in("id", requested);
      const { data, error } = await query;
      if (!error && data) {
        const contexts = await Promise.all(
          data.map((row) => getOrgWorkspaceContext({ orgId: String((row as { id: unknown }).id), userId: input.userId }))
        );
        return contexts.slice(0, limit);
      }
    } catch {
      // Fall back to memory below.
    }
  }

  const ids = requested && requested.length > 0 ? requested : [...organizations.keys()];
  const contexts = await Promise.all(
    ids.slice(0, limit).map((orgId) => getOrgWorkspaceContext({ orgId, userId: input.userId }))
  );
  return contexts;
}

export async function addWorkspaceMembership(input: {
  orgId: string;
  workspaceId?: string;
  userId: string;
  email?: string | null;
  role: WorkspaceRole;
  status?: MembershipStatus;
  now?: string;
}): Promise<WorkspaceMembershipRecord> {
  const context = await getOrgWorkspaceContext({ orgId: input.orgId });
  const now = input.now ?? new Date().toISOString();
  const membership = normalizeMembership({
    id: membershipId(context.org.id, input.workspaceId ?? context.workspace.id, input.userId),
    orgId: context.org.id,
    workspaceId: input.workspaceId ?? context.workspace.id,
    userId: input.userId,
    email: input.email ?? null,
    role: input.role,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
  memberships.set(membership.id, membership);

  const db = getClient();
  if (db) {
    try {
      await db.from("quad_workspace_memberships").upsert(toMembershipRow(membership), { onConflict: "id" });
    } catch {
      // Memory fallback remains authoritative for zero-key demos.
    }
  }

  return membership;
}

export function canRole(role: WorkspaceRole | "service" | "unknown", action: "read" | "write" | "approve" | "admin"): boolean {
  if (role === "service") return true;
  if (role === "unknown") return action === "read";
  const rank = ROLE_RANK[role];
  switch (action) {
    case "read":
      return rank >= ROLE_RANK.viewer;
    case "write":
      return rank >= ROLE_RANK.member;
    case "approve":
      return rank >= ROLE_RANK.admin;
    case "admin":
      return rank >= ROLE_RANK.owner;
  }
}

function seedDefaultOrgs(): void {
  if (organizations.size > 0) return;
  const now = "2026-06-21T00:00:00.000Z";
  for (const input of [
    {
      orgId: DEMO_ORG_ID,
      name: "American Red Cross Bay Area",
      slug: "redcross-bay-area",
      workspaceName: "Bay Area operations",
      retentionDays: 30,
    },
    {
      orgId: ENTERPRISE_PROOF_ORG_ID,
      name: "Acme Trust Operations",
      slug: "acme-trust",
      workspaceName: "Trust desk",
      retentionDays: 45,
    },
  ]) {
    const org = normalizeOrg({
      id: input.orgId,
      name: input.name,
      slug: input.slug,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const workspace = normalizeWorkspace({
      id: `${input.orgId}_workspace`,
      orgId: input.orgId,
      name: input.workspaceName,
      slug: "default",
      status: "active",
      region: "us",
      retentionDays: input.retentionDays,
      defaultVisibility: "company",
      createdAt: now,
      updatedAt: now,
    });
    organizations.set(org.id, org);
    workspaces.set(workspace.id, workspace);
  }
}

async function loadOrgWorkspace(orgId: string): Promise<OrgWorkspaceContext | null> {
  const memoryOrg = organizations.get(orgId);
  const memoryWorkspace = [...workspaces.values()].find((workspace) => workspace.orgId === orgId && workspace.status === "active");
  if (memoryOrg && memoryWorkspace) {
    return buildContext(memoryOrg, memoryWorkspace, memoryMemberships(orgId, memoryWorkspace.id));
  }

  const db = getClient();
  if (!db) return null;
  try {
    const { data: orgRow, error: orgError } = await db
      .from("quad_orgs")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();
    if (orgError || !orgRow) return null;
    const { data: workspaceRows, error: workspaceError } = await db
      .from("quad_workspaces")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);
    if (workspaceError || !workspaceRows?.[0]) return null;
    const workspace = fromWorkspaceRow(workspaceRows[0] as Record<string, unknown>);
    const { data: membershipRows } = await db
      .from("quad_workspace_memberships")
      .select("*")
      .eq("org_id", orgId)
      .eq("workspace_id", workspace.id)
      .eq("status", "active");
    const org = fromOrgRow(orgRow as Record<string, unknown>);
    const loadedMemberships = (membershipRows ?? []).map((row) => fromMembershipRow(row as Record<string, unknown>));
    organizations.set(org.id, org);
    workspaces.set(workspace.id, workspace);
    for (const membership of loadedMemberships) memberships.set(membership.id, membership);
    return buildContext(org, workspace, loadedMemberships);
  } catch {
    return null;
  }
}

function buildContext(
  org: OrganizationRecord,
  workspace: WorkspaceRecord,
  workspaceMemberships: WorkspaceMembershipRecord[]
): OrgWorkspaceContext {
  return {
    org,
    workspace,
    memberships: workspaceMemberships,
    requester: requesterFor(null, workspaceMemberships),
    boundary: {
      tenantKeyPrefix: `org:${org.id}`,
      defaultVisibility: workspace.defaultVisibility,
      region: workspace.region,
      retentionDays: workspace.retentionDays,
    },
  };
}

function withRequester(context: OrgWorkspaceContext, userId: string | null): OrgWorkspaceContext {
  return {
    ...context,
    requester: requesterFor(userId, context.memberships),
  };
}

function requesterFor(
  userId: string | null,
  workspaceMemberships: WorkspaceMembershipRecord[]
): OrgWorkspaceContext["requester"] {
  if (!userId) {
    return {
      userId: null,
      role: "service",
      status: "service",
      canRead: true,
      canWrite: true,
      canApprove: true,
      canAdmin: true,
    };
  }
  const membership = workspaceMemberships.find((item) => item.userId === userId && item.status === "active");
  const role = membership?.role ?? "unknown";
  const status = membership?.status ?? "unknown";
  return {
    userId,
    role,
    status,
    canRead: canRole(role, "read"),
    canWrite: canRole(role, "write"),
    canApprove: canRole(role, "approve"),
    canAdmin: canRole(role, "admin"),
  };
}

function memoryMemberships(orgId: string, workspaceId: string): WorkspaceMembershipRecord[] {
  return [...memberships.values()].filter((membership) =>
    membership.orgId === orgId &&
    membership.workspaceId === workspaceId &&
    membership.status === "active"
  );
}

function normalizeOrgId(value: string): string {
  return value.trim() || DEMO_ORG_ID;
}

function normalizeOrg(value: OrganizationRecord): OrganizationRecord {
  return {
    ...value,
    id: normalizeOrgId(value.id),
    name: value.name.trim() || defaultOrgName(value.id),
    slug: slugify(value.slug || value.name || value.id),
    status: value.status === "suspended" ? "suspended" : "active",
  };
}

function normalizeWorkspace(value: WorkspaceRecord): WorkspaceRecord {
  return {
    ...value,
    id: value.id.trim() || `${value.orgId}_workspace`,
    orgId: normalizeOrgId(value.orgId),
    name: value.name.trim() || "Default workspace",
    slug: slugify(value.slug || value.name || "default"),
    status: value.status === "archived" ? "archived" : "active",
    region: value.region.trim().toLowerCase() || "us",
    retentionDays: normalizeRetentionDays(value.retentionDays),
    defaultVisibility: isDefaultVisibility(value.defaultVisibility) ? value.defaultVisibility : "company",
  };
}

function normalizeMembership(value: WorkspaceMembershipRecord): WorkspaceMembershipRecord {
  return {
    ...value,
    id: value.id.trim() || membershipId(value.orgId, value.workspaceId, value.userId),
    orgId: normalizeOrgId(value.orgId),
    workspaceId: value.workspaceId.trim(),
    userId: value.userId.trim(),
    email: value.email?.trim().toLowerCase() || null,
    role: isRole(value.role) ? value.role : "viewer",
    status: isMembershipStatus(value.status) ? value.status : "active",
  };
}

function defaultOrgName(orgId: string): string {
  if (orgId === DEMO_ORG_ID) return "American Red Cross Bay Area";
  if (orgId === ENTERPRISE_PROOF_ORG_ID) return "Acme Trust Operations";
  return orgId.replace(/^org_/, "").replace(/[_-]+/g, " ") || "Quad organization";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "default";
}

function normalizeRetentionDays(value: number | null | undefined): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(3650, Math.floor(value ?? 0)));
}

function isDefaultVisibility(value: unknown): value is WorkspaceRecord["defaultVisibility"] {
  return value === "company" || value === "team" || value === "personal";
}

function isRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer";
}

function isMembershipStatus(value: unknown): value is MembershipStatus {
  return value === "active" || value === "invited" || value === "revoked";
}

function membershipId(orgId: string, workspaceId: string, userId: string): string {
  return `membership_${hashParts(orgId, workspaceId, userId)}`;
}

function hashParts(...parts: string[]): string {
  let hash = 2166136261;
  for (const part of parts.join(":")) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function toOrgRow(org: OrganizationRecord) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    created_at: org.createdAt,
    updated_at: org.updatedAt,
  };
}

function toWorkspaceRow(workspace: WorkspaceRecord) {
  return {
    id: workspace.id,
    org_id: workspace.orgId,
    name: workspace.name,
    slug: workspace.slug,
    status: workspace.status,
    region: workspace.region,
    retention_days: workspace.retentionDays,
    default_visibility: workspace.defaultVisibility,
    created_at: workspace.createdAt,
    updated_at: workspace.updatedAt,
  };
}

function toMembershipRow(membership: WorkspaceMembershipRecord) {
  return {
    id: membership.id,
    org_id: membership.orgId,
    workspace_id: membership.workspaceId,
    user_id: membership.userId,
    email: membership.email,
    role: membership.role,
    status: membership.status,
    created_at: membership.createdAt,
    updated_at: membership.updatedAt,
  };
}

function fromOrgRow(row: Record<string, unknown>): OrganizationRecord {
  return normalizeOrg({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as OrgStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function fromWorkspaceRow(row: Record<string, unknown>): WorkspaceRecord {
  return normalizeWorkspace({
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as WorkspaceStatus,
    region: String(row.region ?? "us"),
    retentionDays: typeof row.retention_days === "number" ? row.retention_days : null,
    defaultVisibility: row.default_visibility as WorkspaceRecord["defaultVisibility"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function fromMembershipRow(row: Record<string, unknown>): WorkspaceMembershipRecord {
  return normalizeMembership({
    id: String(row.id),
    orgId: String(row.org_id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    email: typeof row.email === "string" ? row.email : null,
    role: row.role as WorkspaceRole,
    status: row.status as MembershipStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}
