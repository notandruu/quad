import { DEMO_ORG_ID } from "@/data/seed";

export type MeetingUtterance = {
  speaker: string;
  text: string;
  carriesFact?: boolean;
};

export type ScriptedMeeting = {
  orgId: string;
  title: string;
  context: string;
  utterances: MeetingUtterance[];
};

/**
 * Demo meeting: Red Cross Bay Area quick weekly sync.
 * Four people, natural, fast — the kind of meeting where real decisions
 * get made but nothing gets written down. Quad sits in and changes that.
 */
export const DEMO_MEETING: ScriptedMeeting = {
  orgId: DEMO_ORG_ID,
  title: "Red Cross Bay Area — weekly sync",
  context:
    "Quick weekly check-in for Red Cross Bay Area chapter. " +
    "Four team members covering blood services, disaster relief, training, and volunteers.",
  utterances: [
    {
      speaker: "Andrew",
      text: "Okay quick sync. Blood supply — we're at a two day supply of O-negative, which is critical. National minimum is five days. We have a drive this Saturday at the Oakland Convention Center, eight to four. That's not on the website yet.",
      carriesFact: true,
    },
    {
      speaker: "Stephen",
      text: "Houston is still active. Two forty seven workers on the ground, fourteen thousand meals, four shelters running. We need eighty more certified shelter volunteers through July fourth or we can't maintain round the clock operations.",
      carriesFact: true,
    },
    {
      speaker: "Maddy",
      text: "Virtual CPR launched in May. Two hours, thirty bucks, fully online. We've had twenty four hundred people complete it. The website still only lists the in-person forty five dollar class. Nobody outside this room knows the virtual option exists.",
      carriesFact: true,
    },
    {
      speaker: "Silas",
      text: "Volunteer gap is three forty heading into hurricane season. We're targeting nine fifty certified and we have six twelve. The board approved forty five thousand for a recruitment push July first but the website volunteer page is completely generic. No urgency, no specific roles.",
      carriesFact: true,
    },
    {
      speaker: "Andrew",
      text: "Okay. Three things that need to go on the website today: Saturday drive, virtual CPR, and volunteer roles. Let's close.",
    },
  ],
};

export function meetingTranscriptText(meeting: ScriptedMeeting = DEMO_MEETING): string {
  return meeting.utterances.map((u) => `${u.speaker}: ${u.text}`).join("\n");
}
