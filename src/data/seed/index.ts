import type { BrainMemory } from "@/lib/types";

export const DEMO_ORG_ID = "org_redcross";

/**
 * Demo organization: American Red Cross Bay Area chapter. The internal brain
 * holds operational facts (blood supply levels, active deployments, new
 * programs, volunteer shortfalls) that the public website has not yet surfaced.
 * That gap is the core "internal vs external" moment in the audit demo.
 */
const now = "2026-06-21T00:00:00.000Z";

function memory(
  partial: Omit<BrainMemory, "embedding" | "createdAt" | "updatedAt" | "orgId">
): BrainMemory {
  return {
    orgId: DEMO_ORG_ID,
    embedding: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const demoBrainSeed: BrainMemory[] = [
  memory({
    id: "mem_blood_supply_alert",
    sourceId: "doc_blood_supply_june_2026",
    sourceType: "doc",
    title: "Blood supply alert — June 2026",
    content:
      "As of June 18, 2026, Bay Area O-negative inventory is at a 2.1-day supply. " +
      "The national minimum threshold is 5 days. Type AB plasma is also critically low at a 1.8-day supply. " +
      "A blood drive is scheduled this Saturday, June 22, at the Oakland Convention Center, 8am–4pm. " +
      "We specifically need O-negative and O-positive donors. Donors can schedule at redcrossblood.org. " +
      "If current donation rates do not increase by 40% this week, we will need to defer elective surgeries " +
      "at three partner hospitals.",
    summary: "O-negative at 2.1-day supply (critical). Blood drive Saturday June 22, Oakland Convention Center.",
    entities: ["O-negative", "blood supply", "blood drive", "Oakland Convention Center", "AB plasma"],
    confidence: 0.98,
    permissions: ["read"],
    evidence: [{ documentId: "doc_blood_supply_june_2026", quote: "O-negative inventory is at a 2.1-day supply" }],
  }),
  memory({
    id: "mem_houston_deployment",
    sourceId: "doc_houston_deployment_2026",
    sourceType: "doc",
    title: "Houston flood relief deployment — active",
    content:
      "Red Cross has 247 relief workers currently deployed to Harris County, TX for the June 2026 flooding response. " +
      "As of June 20, our teams have served 14,300 meals, opened 4 emergency shelters housing 1,840 people, " +
      "and distributed 6,200 relief supply kits. " +
      "We need 80 additional trained shelter workers to maintain 24/7 operations through July 4. " +
      "Bay Area volunteers with shelter operations certification can apply at redcross.org/deploy. " +
      "This is our largest domestic deployment since Hurricane Harvey.",
    summary:
      "247 relief workers in Houston, 1,840 sheltered, 14,300 meals served. Need 80 more shelter workers urgently.",
    entities: ["Houston", "flooding", "shelter workers", "emergency shelters", "Harris County", "deployment"],
    confidence: 0.97,
    permissions: ["read"],
    evidence: [{ quote: "247 relief workers currently deployed to Harris County" }],
  }),
  memory({
    id: "mem_disaster_ready_homes",
    sourceId: "doc_disaster_ready_homes_program",
    sourceType: "doc",
    title: "Disaster Ready Homes program — launching July 15",
    content:
      "Red Cross Bay Area is launching 'Disaster Ready Homes' on July 15, 2026. " +
      "The program provides free in-home preparedness assessments, a 72-hour emergency supply kit, " +
      "and a 90-minute household emergency planning session. " +
      "Target: 10,000 Bay Area households in the first year, prioritizing Alameda and Contra Costa counties. " +
      "Funded by a $1.2M FEMA preparedness grant. Applications open July 1 at bayarea.redcross.org/ready. " +
      "This program has not yet been announced publicly — website update is overdue.",
    summary: "New program launching July 15: free home assessments, 72-hour kits, planning sessions. 10,000 household target.",
    entities: ["Disaster Ready Homes", "FEMA grant", "emergency kits", "Alameda County", "Contra Costa County"],
    confidence: 0.96,
    permissions: ["read"],
    evidence: [{ quote: "Disaster Ready Homes on July 15, 2026" }],
  }),
  memory({
    id: "mem_virtual_cpr",
    sourceId: "doc_virtual_cpr_training",
    sourceType: "doc",
    title: "Virtual CPR/AED certification — now available",
    content:
      "As of May 2026, Red Cross Bay Area offers a fully virtual CPR and AED certification course. " +
      "The course is 2 hours, 100% online, and fully replaces the in-person classroom requirement. " +
      "Cost is $29.99, reduced from $45 for in-person. Valid for 2 years. " +
      "Corporate bulk pricing available: 20+ employees at $19.99 each. " +
      "The website training page still only lists in-person sessions — this is a known gap that needs updating. " +
      "Since launch, 2,400 people have completed the virtual course.",
    summary: "Virtual CPR/AED cert now live (May 2026): 2 hours, $29.99, 2,400 completions. Website still shows in-person only.",
    entities: ["CPR", "AED", "virtual certification", "first aid", "corporate training"],
    confidence: 0.95,
    permissions: ["read"],
    evidence: [{ quote: "fully virtual CPR and AED certification course" }, { quote: "2,400 people have completed the virtual course" }],
  }),
  memory({
    id: "mem_salesforce_partnership",
    sourceId: "doc_salesforce_partnership_2026",
    sourceType: "doc",
    title: "Salesforce partnership — $2M pledge for hurricane preparedness",
    content:
      "Salesforce signed a $2M multi-year giving and employee volunteer pledge on June 10, 2026, " +
      "designated for Red Cross Bay Area hurricane season preparedness. " +
      "Funds will support expanded shelter capacity, volunteer training stipends, and the Disaster Ready Homes launch. " +
      "Salesforce will also commit 500 employee volunteer hours this fiscal year. " +
      "Joint press release has not yet been issued — scheduled for June 30. " +
      "Reference contact: Jamie Chen, Salesforce Corporate Philanthropy.",
    summary: "$2M Salesforce pledge for hurricane preparedness, 500 volunteer hours. Press release June 30.",
    entities: ["Salesforce", "$2M pledge", "hurricane preparedness", "corporate partnership", "volunteer hours"],
    confidence: 0.93,
    permissions: ["read"],
    evidence: [{ quote: "Salesforce signed a $2M multi-year giving and employee volunteer pledge" }],
  }),
  memory({
    id: "mem_volunteer_shortage",
    sourceId: "doc_volunteer_shortage_q2_2026",
    sourceType: "doc",
    title: "Volunteer shortage — Q2 2026 status",
    content:
      "Red Cross Bay Area needs 340 more trained volunteers to meet hurricane season demand (July–October). " +
      "Current certified shelter volunteers: 612. Target: 950. " +
      "Highest urgency roles: shelter operations (180 needed), blood drive coordinators (95 needed), " +
      "disaster mental health counselors (65 needed). " +
      "Volunteer recruitment page on the website shows generic 'get involved' copy with no urgency signal. " +
      "Board approved a volunteer recruitment campaign with $45K marketing budget, launching July 1. " +
      "Specific ask: Bay Area residents with 8+ free hours/month.",
    summary:
      "340 volunteer shortfall heading into hurricane season. Shelter ops, blood coordinators, mental health counselors most needed.",
    entities: ["volunteer shortage", "shelter operations", "hurricane season", "blood drive coordinators", "mental health"],
    confidence: 0.94,
    permissions: ["read"],
    evidence: [{ quote: "340 more trained volunteers to meet hurricane season demand" }],
  }),
];
