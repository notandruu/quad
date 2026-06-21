import { summarizeCapabilities } from "@/lib/metaregistry";

export type QuadAgentDescription = {
  id: "quad.enterprise-trust-agent";
  name: "Quad";
  version: string;
  status: "online";
  description: string;
  provider: {
    name: "Quad";
    url: string;
  };
  endpoints: {
    describe: string;
    run: string;
    health: string;
    quadchainPackets: string;
  };
  protocols: Array<"https_json" | "agent_chat_protocol_ready" | "a2a_ready">;
  keywords: string[];
  workflows: Array<{
    id: "enterprise_proof" | "website_audit";
    name: string;
    description: string;
    input: {
      required: string[];
      properties: Record<string, string>;
    };
    output: string[];
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    kind: string;
    status: "active" | "configured" | "needs_config" | "available";
    approvalMode: string;
    sponsor?: string;
  }>;
  trust: {
    quadchain: {
      emitsPackets: boolean;
      packetTypes: string[];
      receiptGuarantees: string[];
    };
    security: {
      publicDescriptor: true;
      exposesSecrets: false;
      customerWritesRequireApproval: true;
    };
  };
  sponsorAlignment: Array<{
    sponsor: string;
    proof: string;
  }>;
};

export function buildQuadAgentDescription(input: {
  env?: Record<string, string | undefined>;
  baseUrl?: string;
  version?: string;
} = {}): QuadAgentDescription {
  const env = input.env ?? process.env;
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? inferBaseUrl(env));
  const capabilitySummary = summarizeCapabilities(env);
  const installedById = new Map(capabilitySummary.installed.map((state) => [state.id, state]));
  const activeById = new Set(capabilitySummary.activeTools.map((tool) => tool.id));

  return {
    id: "quad.enterprise-trust-agent",
    name: "Quad",
    version: input.version ?? env.npm_package_version ?? "0.1.0",
    status: "online",
    description:
      "Company-aware ai employee that audits public surfaces, builds trust packets, and proves each handoff with quadchain receipts.",
    provider: {
      name: "Quad",
      url: baseUrl,
    },
    endpoints: {
      describe: `${baseUrl}/api/agent/describe`,
      run: `${baseUrl}/api/agent/run`,
      health: `${baseUrl}/api/health/backend`,
      quadchainPackets: `${baseUrl}/api/quadchain/packets`,
    },
    protocols: ["https_json", "agent_chat_protocol_ready", "a2a_ready"],
    keywords: [
      "enterprise trust",
      "website audit",
      "compliance automation",
      "quadchain",
      "proof carrying handoffs",
      "browser evidence",
      "approval workflow",
    ],
    workflows: [
      {
        id: "enterprise_proof",
        name: "Enterprise proof run",
        description:
          "Audit a company site against the company brain, create findings, assemble a trust packet, and request approval before customer-facing work.",
        input: {
          required: ["targetUrl"],
          properties: {
            targetUrl: "Public website or page to audit.",
            orgId: "Tenant or demo organization id.",
            limit: "Maximum pages to inspect, clamped by the backend.",
          },
        },
        output: ["run summary", "audit report artifact", "trust packet artifact", "approval request", "quadchain packet summaries"],
      },
      {
        id: "website_audit",
        name: "Website audit",
        description:
          "Collect browser evidence, compare it with company memory, and return prioritized gaps without creating customer-facing write drafts.",
        input: {
          required: ["targetUrl"],
          properties: {
            targetUrl: "Public website or page to audit.",
            orgId: "Tenant or demo organization id.",
            limit: "Maximum pages to inspect, clamped by the backend.",
          },
        },
        output: ["run summary", "audit report artifact", "finding packet summaries"],
      },
    ],
    capabilities: capabilitySummary.installed
      .filter((state) => state.id !== "cms.publisher" && state.id !== "task.publisher")
      .map((state) => {
        const manifest = capabilitySummary.activeTools.find((tool) => tool.id === state.id);
        return {
          id: state.id,
          name: manifest?.name ?? titleFromCapabilityId(state.id),
          kind: manifest?.kind ?? "connector",
          status: activeById.has(state.id) ? "active" : state.installed ? "needs_config" : "available",
          approvalMode: manifest?.approvalMode ?? "none",
          sponsor: manifest?.sponsor,
        };
      }),
    trust: {
      quadchain: {
        emitsPackets: true,
        packetTypes: ["audit_report", "finding", "agent_handoff", "trust_packet", "approval", "connector_action"],
        receiptGuarantees: [
          "source and output hashes",
          "evidence preservation checks",
          "omitted context accounting",
          "tamper-evident packet ids",
        ],
      },
      security: {
        publicDescriptor: true,
        exposesSecrets: false,
        customerWritesRequireApproval: true,
      },
    },
    sponsorAlignment: [
      {
        sponsor: "Fetch.ai",
        proof:
          "Quad exposes a discoverable agent card and a normalized run endpoint for external agent ecosystems.",
      },
      {
        sponsor: "Browserbase",
        proof: "Audits use browser-rendered evidence and screenshots when Browserbase credentials are configured.",
      },
      {
        sponsor: "Arize",
        proof: "Audit, answer, and trust packet flows can emit evaluator and trace evidence through Phoenix.",
      },
      {
        sponsor: "Sentry",
        proof: "Backend readiness and observability probes show production reliability posture without leaking secrets.",
      },
      {
        sponsor: "Redis",
        proof: "Live logs, job state, worker canaries, and packet cache use Redis when configured.",
      },
      {
        sponsor: "Deepgram",
        proof: "Voice transcripts can become verified memory and downstream audit context.",
      },
    ],
  };
}

function inferBaseUrl(env: Record<string, string | undefined>): string {
  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function titleFromCapabilityId(id: string): string {
  return id
    .split(".")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
