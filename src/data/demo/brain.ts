import type { IngestInput } from "@/lib/brain/ingest";

export const DEMO_BRAIN_MEMORIES: IngestInput[] = [
  {
    orgId: "org_redcross",
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
    summary: "O-negative at 2.1-day supply (critical). Blood drive Saturday June 22, Oakland Convention Center 8am–4pm.",
    entities: ["O-negative", "blood supply", "blood drive", "Oakland Convention Center", "AB plasma"],
    confidence: 0.98,
    permissions: ["read"],
    evidence: [{ documentId: "doc_blood_supply_june_2026", quote: "O-negative inventory is at a 2.1-day supply" }],
  },
  {
    orgId: "org_redcross",
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
  },
  {
    orgId: "org_redcross",
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
    summary: "New program July 15: free home assessments, 72-hour kits, planning sessions. 10,000 household target.",
    entities: ["Disaster Ready Homes", "FEMA grant", "emergency kits", "Alameda County", "Contra Costa County"],
    confidence: 0.96,
    permissions: ["read"],
    evidence: [{ quote: "Disaster Ready Homes on July 15, 2026" }],
  },
  {
    orgId: "org_redcross",
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
    summary: "Virtual CPR/AED cert now live (May 2026): 2 hours, $29.99, 2,400 completions. Website shows in-person only.",
    entities: ["CPR", "AED", "virtual certification", "first aid", "corporate training"],
    confidence: 0.95,
    permissions: ["read"],
    evidence: [{ quote: "fully virtual CPR and AED certification course" }],
  },
  {
    orgId: "org_redcross",
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
    summary: "340 volunteer shortfall heading into hurricane season. Shelter ops, blood coordinators, mental health most needed.",
    entities: ["volunteer shortage", "shelter operations", "hurricane season", "blood drive coordinators", "mental health"],
    confidence: 0.94,
    permissions: ["read"],
    evidence: [{ quote: "340 more trained volunteers to meet hurricane season demand" }],
  },
];
