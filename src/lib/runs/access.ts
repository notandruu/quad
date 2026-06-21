import { loadRunSnapshot, type RunLedgerSnapshot } from "@/lib/runs";
import { authorizeRequest, requestAuthError, type RequestAuthContext } from "@/lib/security";

export type AuthorizedRunAccess =
  | {
      ok: true;
      auth: RequestAuthContext;
      snapshot: RunLedgerSnapshot;
    }
  | {
      ok: false;
      status: 401 | 403 | 404;
      body: {
        ok: false;
        error: string;
        code?: string;
      };
    };

export async function authorizeRunAccess(input: {
  runId: string;
  headers: Headers;
  env?: Record<string, string | undefined>;
}): Promise<AuthorizedRunAccess> {
  const snapshot = await loadRunSnapshot(input.runId);
  if (!snapshot) return runNotFound();

  const auth = authorizeRequest({
    headers: input.headers,
    requestedOrgId: snapshot.run.orgId,
    env: input.env,
  });
  if (!auth.ok) {
    if (auth.code === "org_not_allowed") return runNotFound();
    const body = requestAuthError(auth);
    return {
      ok: false,
      status: auth.status,
      body: {
        ok: false,
        error: body.error,
        code: body.code,
      },
    };
  }

  return { ok: true, auth, snapshot };
}

function runNotFound(): AuthorizedRunAccess {
  return {
    ok: false,
    status: 404,
    body: {
      ok: false,
      error: "run not found",
      code: "run_not_found",
    },
  };
}
