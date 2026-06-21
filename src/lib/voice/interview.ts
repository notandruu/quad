export type VoiceInterviewQuestion = {
  id: string;
  order: number;
  category: "trust" | "security" | "customer" | "operations" | "differentiation";
  question: string;
  memoryTitle: string;
  evidenceHint: string;
};

export type VoiceInterviewSelection = {
  mode: "voice_interview";
  question: VoiceInterviewQuestion;
  remaining: number;
};

export const VOICE_INTERVIEW_QUESTIONS: VoiceInterviewQuestion[] = [
  {
    id: "buyer_trust_proof",
    order: 1,
    category: "trust",
    question: "What proof do buyers or visitors usually need before they trust you?",
    memoryTitle: "Buyer trust proof",
    evidenceHint: "Certifications, outcomes, customer names, screenshots, reports, or policies.",
  },
  {
    id: "security_and_compliance",
    order: 2,
    category: "security",
    question: "What security, privacy, or compliance claims are true internally but missing from the website?",
    memoryTitle: "Security and compliance claims",
    evidenceHint: "Controls, audits, access policies, data retention, subprocessors, or certifications.",
  },
  {
    id: "best_customer_fit",
    order: 3,
    category: "customer",
    question: "Who is the best-fit customer, and what problem are they desperate to solve?",
    memoryTitle: "Best-fit customer profile",
    evidenceHint: "Buyer role, company size, painful workflow, urgency, and existing alternatives.",
  },
  {
    id: "operational_workflow",
    order: 4,
    category: "operations",
    question: "What workflow can Quad safely execute after approval instead of only recommending?",
    memoryTitle: "Approved execution workflow",
    evidenceHint: "Website updates, task creation, document updates, support replies, or browser actions.",
  },
  {
    id: "differentiated_claim",
    order: 5,
    category: "differentiation",
    question: "What is the strongest claim you can make that competitors cannot honestly copy?",
    memoryTitle: "Differentiated claim",
    evidenceHint: "Unique data, speed, trust guarantees, integrations, customer proof, or workflow ownership.",
  },
];

export function selectVoiceInterviewQuestion(input: {
  answeredIds?: string[];
  cursor?: number;
} = {}): VoiceInterviewSelection {
  const answered = new Set(input.answeredIds ?? []);
  const unanswered = VOICE_INTERVIEW_QUESTIONS.filter((question) => !answered.has(question.id));
  const pool = unanswered.length > 0 ? unanswered : VOICE_INTERVIEW_QUESTIONS;
  const cursor = Number.isFinite(input.cursor) ? Math.max(0, Math.floor(input.cursor ?? 0)) : 0;
  const question = pool[cursor % pool.length];

  return {
    mode: "voice_interview",
    question,
    remaining: Math.max(0, unanswered.length - 1),
  };
}
