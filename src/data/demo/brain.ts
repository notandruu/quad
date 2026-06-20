import type { IngestInput } from "@/lib/brain/ingest";

export const DEMO_BRAIN_MEMORIES: IngestInput[] = [
  {
    orgId: "org_brightpath",
    sourceId: "doc_programs_overview",
    sourceType: "doc",
    title: "BrightPath Program Overview",
    content:
      "BrightPath Foundation runs three core programs serving the East Bay. " +
      "After-School Tutoring serves 450 students; average GPA has improved by 0.8 points since enrollment. " +
      "Summer Leadership Camp is a 6-week residential program serving 320 students each summer; " +
      "the 2026 camp is fully waitlisted with applications closed 3 weeks early. " +
      "College Prep Coaching serves 430 students and has achieved a 92% college acceptance rate, " +
      "the highest of any Bay Area nonprofit program of comparable size.",
    summary:
      "Three programs: After-School Tutoring (450 students, +0.8 GPA), Summer Leadership Camp " +
      "(320 students, 6-week residential, 2026 waitlisted), College Prep Coaching (430 students, 92% acceptance rate).",
    entities: [
      "After-School Tutoring",
      "Summer Leadership Camp",
      "College Prep Coaching",
      "92% college acceptance rate",
      "East Bay",
    ],
    confidence: 0.95,
    permissions: ["read"],
  },
  {
    orgId: "org_brightpath",
    sourceId: "meeting_q2_2026_board",
    sourceType: "meeting",
    title: "Q2 Board Planning Meeting Notes",
    content:
      "Board approved expansion into Fremont — lease signed, opening target Q4 2026. " +
      "Two new College Prep counselors hired to support growing demand. " +
      "Summer Leadership Camp sold out three weeks early; demand exceeds capacity by 60%. " +
      "After-School Tutoring currently has a 200-student waitlist, demonstrating significant unmet demand. " +
      "Action item: web team to update site with Fremont location, Summer Camp details, and 92% acceptance stat.",
    summary:
      "Board approved Fremont expansion (Q4 2026). Summer Camp sold out early. " +
      "200-student waitlist for After-School Tutoring. Web update action item overdue.",
    entities: [
      "Fremont expansion",
      "200-student waitlist",
      "Summer Leadership Camp",
      "After-School Tutoring",
      "web team",
    ],
    confidence: 0.92,
    permissions: ["read"],
  },
  {
    orgId: "org_brightpath",
    sourceId: "doc_brand_voice_guide",
    sourceType: "doc",
    title: "Brand Voice and Messaging Guide",
    content:
      "BrightPath brand voice: lead with student stories, not raw statistics. " +
      "Tagline: 'Brighter Futures, Together.' " +
      "Key differentiator to always mention on public-facing pages: 92% college acceptance rate " +
      "(compare to 67% national average for similar demographics). " +
      "Never use jargon. Write for families, not foundations. Keep sentences short. " +
      "Emergency support hotline for students in crisis: 510-555-0192. " +
      "This number must appear on every program page and the contact page.",
    summary:
      "Tagline 'Brighter Futures, Together.' Always lead with 92% acceptance rate. " +
      "Emergency hotline 510-555-0192 required on all program and contact pages.",
    entities: [
      "92% college acceptance rate",
      "brand voice",
      "510-555-0192",
      "emergency support hotline",
      "tagline",
    ],
    confidence: 0.9,
    permissions: ["read"],
  },
  {
    orgId: "org_brightpath",
    sourceId: "doc_impact_report_2025",
    sourceType: "doc",
    title: "BrightPath Impact Report 2025",
    content:
      "Total students served in 2025: 1,200. Average GPA improvement: +0.8 points. " +
      "College acceptance rate: 92% (national average for comparable demographics: 67%). " +
      "Operating budget: $2.1M. Donor renewal rate: 94%. " +
      "Programs operating in Oakland and Berkeley; Fremont site approved for 2026. " +
      "Summer Leadership Camp reached 320 students; waitlist opened for the first time in program history.",
    summary:
      "1,200 students, 92% college acceptance, 94% donor renewal, $2.1M budget, Fremont expansion approved.",
    entities: [
      "1,200 students",
      "92% college acceptance rate",
      "94% donor renewal",
      "$2.1M budget",
      "Fremont",
    ],
    confidence: 0.97,
    permissions: ["read"],
  },
  {
    orgId: "org_brightpath",
    sourceId: "doc_website_copy_brief",
    sourceType: "doc",
    title: "Website Copy Update Brief (March 2026)",
    content:
      "Approved by leadership in March 2026. Web team was tasked with three updates that have not yet shipped: " +
      "(1) Programs page: add Summer Leadership Camp section with enrollment info and waitlist details. " +
      "(2) Programs page: prominently feature the 92% college acceptance rate with comparison to 67% national average. " +
      "(3) About / Locations section: add the new Fremont location approved by the board in Q1 2026. " +
      "These updates were marked high priority because they directly address donor and prospective family questions. " +
      "The omissions are causing confusion; several donors have asked about Summer Camp at events " +
      "and were surprised it was not on the website.",
    summary:
      "Three overdue web updates: add Summer Leadership Camp, feature 92% acceptance rate, add Fremont location.",
    entities: [
      "Summer Leadership Camp",
      "92% college acceptance rate",
      "Fremont location",
      "Programs page",
      "web team",
    ],
    confidence: 0.93,
    permissions: ["read"],
  },
];
