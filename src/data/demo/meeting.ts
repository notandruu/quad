import { DEMO_ORG_ID } from "@/data/seed";

export type MeetingUtterance = {
  speaker: string;
  text: string;
  /** Whether this line carries a learnable company fact. Used to pace the demo. */
  carriesFact?: boolean;
};

export type ScriptedMeeting = {
  orgId: string;
  title: string;
  context: string;
  utterances: MeetingUtterance[];
};

/**
 * Scripted Red Cross Bay Area chapter staff meeting used as the reliable
 * fallback for the live meeting demo. Quad "sits in," transcribes, and
 * extracts verified facts into the company brain. The facts here are exactly
 * the gaps the website audit surfaces, so the two demos reinforce each other:
 * the brain learns it in the meeting, then proves the website is missing it.
 */
export const DEMO_MEETING: ScriptedMeeting = {
  orgId: DEMO_ORG_ID,
  title: "Red Cross Bay Area — weekly operations sync",
  context:
    "Weekly staff sync for the American Red Cross Bay Area chapter. " +
    "Attendees include the chapter director, blood services lead, disaster relief director, " +
    "training manager, and volunteer coordinator.",
  utterances: [
    {
      speaker: "Director Chen",
      text: "Let's get started. Blood supply first — Melissa, where are we?",
    },
    {
      speaker: "Melissa",
      text: "It's critical. O-negative is at a two-point-one day supply as of this morning. National minimum is five days. AB plasma is at one-point-eight. We need a forty percent increase in donations this week or we're asking partner hospitals to defer elective surgeries.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "When is the next drive?",
    },
    {
      speaker: "Melissa",
      text: "This Saturday. Oakland Convention Center, eight AM to four PM. We specifically need O-negative and O-positive donors. It's not on our website yet — that's an urgent fix.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "That goes live today. David, Houston update.",
    },
    {
      speaker: "David",
      text: "We have two hundred and forty-seven relief workers on the ground in Harris County. As of yesterday, fourteen thousand three hundred meals served, four emergency shelters open, eighteen forty people housed. This is our largest domestic deployment since Harvey.",
      carriesFact: true,
    },
    {
      speaker: "David",
      text: "We need eighty more certified shelter workers to maintain around-the-clock operations through July fourth. If any Bay Area volunteers have shelter ops certification, we need them now.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "Sandra, training — what's new on virtual CPR?",
    },
    {
      speaker: "Sandra",
      text: "We launched the fully virtual CPR and AED course in May. Two hours, completely online, twenty-nine ninety-nine. We've had twenty-four hundred completions already. The problem is our training page still only shows the in-person forty-five dollar course. Nobody knows the virtual option exists.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "That's leaving money on the table. Fix the page this week. Marcus, Disaster Ready Homes?",
    },
    {
      speaker: "Marcus",
      text: "Launching July fifteenth. Free in-home preparedness assessment, a seventy-two hour emergency kit, and a ninety-minute household planning session. FEMA grant covers it — one-point-two million dollars. Target is ten thousand Bay Area households, Alameda and Contra Costa first. Applications open July first at bayarea dot redcross dot org slash ready.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "And we haven't announced it publicly yet?",
    },
    {
      speaker: "Marcus",
      text: "Correct. Nothing on the website. That needs to go up before July first.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "Volunteers — Jamie?",
    },
    {
      speaker: "Jamie",
      text: "We're three hundred and forty short of our hurricane season target. We need nine-fifty certified volunteers by July. We have six-twelve. The biggest gaps are shelter operations — one eighty needed, blood drive coordinators — ninety-five needed, and disaster mental health counselors — sixty-five needed.",
      carriesFact: true,
    },
    {
      speaker: "Jamie",
      text: "Our website volunteer page is still showing generic 'get involved' copy. No urgency, no specific roles. Board approved forty-five thousand dollars for a recruitment campaign launching July first, but if the site doesn't reflect the need, the campaign will underperform.",
      carriesFact: true,
    },
    {
      speaker: "Director Chen",
      text: "Okay. Three clear website action items: blood drive Saturday, virtual CPR, and Disaster Ready Homes. Let's wrap. Good work everyone.",
    },
  ],
};

/** Flatten the meeting into a single transcript string. */
export function meetingTranscriptText(meeting: ScriptedMeeting = DEMO_MEETING): string {
  return meeting.utterances.map((u) => `${u.speaker}: ${u.text}`).join("\n");
}
