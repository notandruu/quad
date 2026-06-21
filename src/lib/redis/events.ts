/**
 * Canonical event type strings emitted onto Redis streams. The frontend
 * animates these; the audit worker emits the real thing. Never fake them.
 */

export const AUDIT_EVENTS = [
  "audit.started",
  "audit.pages_discovered",
  "page.queued",
  "page.rendering",
  "page.rendered",
  "page.fetched",
  "page.analyzing",
  "page.analyzed",
  "page.failed",
  "finding.created",
  "finding.evaluated",
  "audit.synthesizing",
  "audit.complete",
  "audit.failed",
] as const;

export const EMPLOYEE_EVENTS = [
  "employee.input_received",
  "employee.intent_classified",
  "employee.context_retrieved",
  "employee.plan_created",
  "employee.tool_selected",
  "employee.permission_checked",
  "employee.tool_started",
  "employee.tool_completed",
  "employee.response_started",
  "employee.response_completed",
  "employee.memory_saved",
  "employee.approval_requested",
] as const;

export const VOICE_EVENTS = [
  "voice.session_started",
  "voice.audio_received",
  "voice.partial_transcript",
  "voice.final_transcript",
  "voice.intent_detected",
  "voice.response_started",
  "voice.audio_sent",
  "voice.session_ended",
] as const;

export const PROOF_EVENTS = [
  "question.started",
  "brain.retrieved",
  "context.collected",
  "answer.drafted",
  "answer.evaluated",
  "brain.learned",
  "answer.needs_human",
] as const;

/**
 * Live-meeting capture pipeline. Quad sits in a meeting, transcribes it
 * (Deepgram), and extracts candidate facts. Each fact is grounded and judged
 * before it is written to the company brain — the UI streams every step so you
 * can watch the agent think and watch the brain grow.
 */
export const MEETING_EVENTS = [
  "meeting.started",
  "meeting.transcript",
  "meeting.thinking",
  "fact.extracted",
  "fact.evaluated",
  "fact.learned",
  "fact.rejected",
  "meeting.summarized",
  "meeting.ended",
  "meeting.failed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[number];
export type EmployeeEventType = (typeof EMPLOYEE_EVENTS)[number];
export type VoiceEventType = (typeof VOICE_EVENTS)[number];
export type ProofEventType = (typeof PROOF_EVENTS)[number];
export type MeetingEventType = (typeof MEETING_EVENTS)[number];
export type QuadEventType =
  | AuditEventType
  | EmployeeEventType
  | VoiceEventType
  | ProofEventType
  | MeetingEventType;
