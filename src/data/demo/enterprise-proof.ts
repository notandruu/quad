import type { IngestInput } from "@/lib/brain/ingest";
import type { ConnectorDocument } from "@/lib/connectors/documents";

export const ENTERPRISE_PROOF_ORG_ID = "org_acme";

const NOW = "2026-06-21T00:00:00.000Z";

/**
 * Sparse starting brain for Acme Software. A customer is asking security
 * questionnaire questions. Some answers are here; others require human review.
 * That gap is the enterprise proof demo story.
 */
export const ENTERPRISE_PROOF_BRAIN: IngestInput[] = [
  {
    orgId: ENTERPRISE_PROOF_ORG_ID,
    sourceId: "doc_incident_response_policy",
    sourceType: "doc",
    title: "Incident Response Policy v2.1",
    content:
      "Acme Software maintains a documented incident response plan last reviewed January 2025. " +
      "The plan defines four severity levels (P0-P3) with escalation paths and SLA targets. " +
      "P0 incidents require executive notification within 30 minutes and a post-mortem within 5 business days. " +
      "All incidents are tracked in Jira under the IR project. " +
      "The response team is on-call 24/7 via PagerDuty. " +
      "Acme has not experienced a data breach or P0 security incident in the past 24 months. " +
      "The most recent incident (IR-2024-03) was a misconfigured S3 bucket discovered internally, " +
      "remediated within 4 hours with no customer data exposed.",
    summary:
      "Documented IR plan (Jan 2025), P0-P3 severity levels, 24/7 on-call, last incident IR-2024-03 resolved internally.",
    entities: ["incident response", "PagerDuty", "Jira", "IR-2024-03", "P0", "S3"],
    confidence: 0.95,
    permissions: ["read"],
    evidence: [{ documentId: "doc_incident_response_policy", quote: "not experienced a data breach or P0 security incident in the past 24 months" }],
  },
  {
    orgId: ENTERPRISE_PROOF_ORG_ID,
    sourceId: "doc_access_control_policy",
    sourceType: "doc",
    title: "Access Control Policy v3.0",
    content:
      "Acme enforces role-based access control (RBAC) across all production systems. " +
      "Multi-factor authentication (MFA) is mandatory for all employees and contractors with access to production. " +
      "Access is provisioned through an approval workflow in Okta and reviewed quarterly. " +
      "Principle of least privilege is applied; engineers access only the systems required for their role. " +
      "Customer data is accessible only to the support team under explicit ticket authorization. " +
      "All privileged access sessions are logged and retained for 12 months. " +
      "The Q4 2025 access review (SEC-2025-01) confirmed all active accounts were authorized and stale accounts removed.",
    summary:
      "RBAC, mandatory MFA, Okta provisioning, quarterly access reviews, least privilege, 12-month session logs.",
    entities: ["RBAC", "MFA", "Okta", "least privilege", "SEC-2025-01", "quarterly access review"],
    confidence: 0.95,
    permissions: ["read"],
    evidence: [
      { documentId: "doc_access_control_policy", quote: "MFA is mandatory for all employees and contractors" },
      { quote: "access reviewed quarterly" },
    ],
  },
  {
    orgId: ENTERPRISE_PROOF_ORG_ID,
    sourceId: "doc_data_handling_overview",
    sourceType: "doc",
    title: "Data Handling and Classification Overview",
    content:
      "Acme classifies data into three tiers: Public, Internal, and Confidential. " +
      "Customer data is always Confidential. " +
      "Confidential data at rest is encrypted with AES-256; in transit with TLS 1.2+. " +
      "Data is processed in AWS us-east-1 and eu-west-1 regions with customer data isolated by tenant. " +
      "Acme does not sell or share customer data with third parties for marketing purposes. " +
      "Subprocessors are listed in Acme's DPA and reviewed annually. " +
      "Customer data deletion requests are fulfilled within 30 days.",
    summary:
      "3-tier classification, AES-256 at rest, TLS 1.2+ in transit, AWS us-east-1/eu-west-1, 30-day deletion.",
    entities: ["AES-256", "TLS 1.2", "AWS", "tenant isolation", "DPA", "data classification"],
    confidence: 0.92,
    permissions: ["read"],
    evidence: [
      { documentId: "doc_data_handling_overview", quote: "Customer data is always Confidential" },
      { quote: "encrypted with AES-256" },
    ],
  },
];

/**
 * Connector artifacts: simulated Jira tickets and access logs that Quad can
 * collect during the enterprise proof workflow. These normalize to the same
 * ConnectorDocument interface that future Jira, Confluence, and GitHub
 * connectors will implement.
 */
export const ENTERPRISE_PROOF_CONNECTOR_DOCS: ConnectorDocument[] = [
  {
    id: "jira_IR_2024_03",
    connectorId: "jira",
    orgId: ENTERPRISE_PROOF_ORG_ID,
    kind: "ticket",
    title: "IR-2024-03: Misconfigured S3 bucket - RESOLVED",
    content:
      "Incident type: misconfigured S3 bucket (public read ACL applied inadvertently during infrastructure change). " +
      "Discovered: 2024-09-14 by internal security scan. " +
      "Remediated: 2024-09-14 within 4 hours of discovery. " +
      "Impact: no customer data was in the affected bucket; it contained only static build artifacts. " +
      "Root cause: missing policy enforcement in Terraform module. " +
      "Resolution: bucket policy corrected, Terraform module updated to block public access by default, " +
      "automated S3 ACL scanner added to CI pipeline. " +
      "Status: CLOSED. No customer notification required.",
    url: "https://acme.atlassian.net/browse/IR-2024-03",
    metadata: { project: "IR", status: "CLOSED", severity: "P2", resolvedAt: "2024-09-14" },
    retrievedAt: NOW,
  },
  {
    id: "jira_SEC_2025_01",
    connectorId: "jira",
    orgId: ENTERPRISE_PROOF_ORG_ID,
    kind: "ticket",
    title: "SEC-2025-01: Q4 2025 Access Review - COMPLETED",
    content:
      "Quarterly access review completed for Q4 2025. " +
      "Scope: all production systems, Okta directory, AWS IAM, GitHub, Jira, Salesforce. " +
      "Total accounts reviewed: 203. " +
      "Accounts deprovisioned: 8 (all were offboarded employees whose accounts were not yet removed). " +
      "Accounts with excessive permissions corrected: 4 (downscoped per least-privilege policy). " +
      "MFA compliance: 100% of active employees and contractors. " +
      "No anomalies found. Review certified by VP Engineering and VP Security. " +
      "Status: CLOSED. Next review scheduled Q1 2026.",
    url: "https://acme.atlassian.net/browse/SEC-2025-01",
    metadata: { project: "SEC", status: "CLOSED", completedAt: "2025-12-30", reviewedBy: "VP Engineering, VP Security" },
    retrievedAt: NOW,
  },
  {
    id: "access_log_Q4_2025",
    connectorId: "local",
    orgId: ENTERPRISE_PROOF_ORG_ID,
    kind: "log",
    title: "Access Review Summary - Q4 2025",
    content:
      "Summary of Q4 2025 quarterly access review (referenced in SEC-2025-01). " +
      "Review date: December 30, 2025. " +
      "Systems in scope: production databases, AWS console, GitHub repos (private), Jira, Salesforce, PagerDuty. " +
      "Finding: 8 stale accounts deprovisioned; 4 accounts downscoped. " +
      "MFA enforcement: 100% (203 of 203 accounts). " +
      "Privileged access holders: 12 engineers with production DB access, all with individual named accounts. " +
      "No shared credentials in use. " +
      "Session log retention: 12 months confirmed in AWS CloudTrail and Okta system logs.",
    metadata: { quarter: "Q4 2025", mfaCompliance: "100%", accountsReviewed: 203, staleRemoved: 8 },
    retrievedAt: NOW,
  },
];
