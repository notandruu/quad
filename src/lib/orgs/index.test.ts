import { describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { addWorkspaceMembership, canRole, ensureOrgWorkspace, getOrgWorkspaceContext, listOrgWorkspaceContexts } from ".";

vi.mock("@/lib/brain/db", () => ({
  getClient: vi.fn(() => null),
}));

describe("org workspace registry", () => {
  it("returns a seeded workspace context for the demo org", async () => {
    const context = await getOrgWorkspaceContext({ orgId: DEMO_ORG_ID });

    expect(context.org).toMatchObject({
      id: DEMO_ORG_ID,
      name: "American Red Cross Bay Area",
      status: "active",
    });
    expect(context.workspace).toMatchObject({
      orgId: DEMO_ORG_ID,
      status: "active",
      defaultVisibility: "company",
    });
    expect(context.boundary).toMatchObject({
      tenantKeyPrefix: `org:${DEMO_ORG_ID}`,
      defaultVisibility: "company",
      region: "us",
    });
    expect(context.requester).toMatchObject({
      role: "service",
      canRead: true,
      canWrite: true,
      canApprove: true,
    });
  });

  it("creates durable-shaped orgs and resolves requester roles", async () => {
    const created = await ensureOrgWorkspace({
      orgId: " org_alpha ",
      name: "Alpha Labs",
      workspaceName: "Compliance",
      region: "EU",
      retentionDays: 90,
      now: "2026-06-21T12:00:00.000Z",
    });
    const membership = await addWorkspaceMembership({
      orgId: "org_alpha",
      userId: "user_1",
      email: "USER@EXAMPLE.COM",
      role: "admin",
      now: "2026-06-21T12:01:00.000Z",
    });
    const context = await getOrgWorkspaceContext({ orgId: "org_alpha", userId: "user_1" });

    expect(created.org.slug).toBe("alpha-labs");
    expect(created.workspace).toMatchObject({
      name: "Compliance",
      region: "eu",
      retentionDays: 90,
    });
    expect(membership.email).toBe("user@example.com");
    expect(context.requester).toMatchObject({
      role: "admin",
      canRead: true,
      canWrite: true,
      canApprove: true,
      canAdmin: false,
    });
  });

  it("lists memory-backed org contexts without exposing membership secrets", async () => {
    await ensureOrgWorkspace({ orgId: "org_listed", name: "Listed Org" });
    const contexts = await listOrgWorkspaceContexts({ orgIds: ["org_listed"], limit: 5 });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.org.name).toBe("Listed Org");
    expect(JSON.stringify(contexts)).not.toMatch(/token|secret|password/i);
  });

  it("maps roles to workspace actions", () => {
    expect(canRole("viewer", "read")).toBe(true);
    expect(canRole("viewer", "write")).toBe(false);
    expect(canRole("member", "write")).toBe(true);
    expect(canRole("admin", "approve")).toBe(true);
    expect(canRole("admin", "admin")).toBe(false);
    expect(canRole("owner", "admin")).toBe(true);
    expect(canRole("service", "admin")).toBe(true);
  });
});
