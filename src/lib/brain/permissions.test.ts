import { describe, expect, it } from "vitest";
import { canReadMemory, normalizeMemoryPermissions } from "./permissions";

describe("brain memory permissions", () => {
  it("keeps legacy memories company-readable", () => {
    const access = canReadMemory({ permissions: ["read", "internal"] });

    expect(access).toMatchObject({
      visibility: "company",
      readable: true,
      reason: "company",
    });
  });

  it("requires a team match for team memories", () => {
    const permissions = normalizeMemoryPermissions({
      visibility: "team",
      teamId: "security",
    });

    expect(canReadMemory({ permissions }).readable).toBe(false);
    expect(canReadMemory({ permissions }, { teamIds: ["sales"] }).readable).toBe(false);
    expect(canReadMemory({ permissions }, { teamIds: ["security"] })).toMatchObject({
      visibility: "team",
      readable: true,
      reason: "team_match",
    });
  });

  it("requires owner and explicit personal opt-in for personal memories", () => {
    const permissions = normalizeMemoryPermissions({
      visibility: "personal",
      userId: "maddy",
    });

    expect(canReadMemory({ permissions }, { userId: "maddy" }).readable).toBe(false);
    expect(canReadMemory({ permissions }, { userId: "andrew", includePersonal: true }).readable).toBe(false);
    expect(canReadMemory({ permissions }, { userId: "maddy", includePersonal: true })).toMatchObject({
      visibility: "personal",
      readable: true,
      reason: "personal_owner",
    });
  });
});
