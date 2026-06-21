import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { GET } from "./route";

describe("GET /api/playbooks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a safe playbook catalog filtered by intent", async () => {
    vi.stubEnv("QUAD_API_SECRET", "");
    vi.stubEnv("QUAD_SERVICE_TOKENS", "");
    vi.stubEnv("QUAD_ALLOWED_ORGS", DEMO_ORG_ID);
    vi.stubEnv("SUPABASE_URL", "https://supabase-secret.example");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-secret");

    const response = await GET(new NextRequest(`http://localhost/api/playbooks?orgId=${DEMO_ORG_ID}&intent=audit_follow_up`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      orgId: DEMO_ORG_ID,
      playbooks: {
        total: 2,
        approvalGated: 2,
        verifierRequired: 2,
      },
    });
    expect(body.playbooks.playbooks.map((playbook: { id: string }) => playbook.id)).toEqual(
      expect.arrayContaining(["enterprise_proof.answer_question", "trust_packet.build_and_stage"])
    );
    expect(JSON.stringify(body)).not.toContain("service-secret");
    expect(JSON.stringify(body)).not.toContain("supabase-secret");
  });
});
