import { describe, it, expect } from "vitest";
import { streamKeys, metaKeys, counterKeys, tenantScopedKeys } from "./keys";

describe("redis key builders", () => {
  it("namespaces audit streams by run id", () => {
    expect(streamKeys.auditEvents("r1")).toBe("audit:run:r1:events");
    expect(metaKeys.auditRun("r1")).toBe("audit:run:r1:meta");
  });

  it("builds every progress counter under the run namespace", () => {
    for (const build of Object.values(counterKeys)) {
      expect(build("r1").startsWith("audit:run:r1:")).toBe(true);
    }
  });

  it("keeps employee and voice streams on separate namespaces", () => {
    expect(streamKeys.employeeEvents("e1")).toBe("employee:e1:events");
    expect(streamKeys.voiceEvents("s1")).toBe("voice:session:s1:events");
  });

  it("builds tenant-scoped keys without leaking raw org formatting", () => {
    expect(tenantScopedKeys.auditEvents("Acme Inc.", "Run 1")).toBe("org:acme_inc:audit:run:run_1:events");
    expect(tenantScopedKeys.approval("Acme Inc.", "Approval 1")).toBe("org:acme_inc:approval:approval_1");
  });
});
