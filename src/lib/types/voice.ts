export type VoiceSessionStatus =
  | "starting"
  | "active"
  | "ending"
  | "ended"
  | "failed";

export type VoiceMode = "meeting" | "assistant" | "audit";

export type VoiceTurn = {
  id: string;
  speaker: "user" | "employee";
  text: string;
  startedAt: string;
  endedAt?: string;
  confidence?: number;
};

export type VoiceSession = {
  id: string;
  orgId: string;
  employeeId: string;
  status: VoiceSessionStatus;
  mode: VoiceMode;
  transcript: VoiceTurn[];
  currentIntent?: string;
  startedAt: string;
  endedAt?: string;
};
