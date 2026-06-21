import { describe, expect, it } from "vitest";
import { selectVoiceInterviewQuestion, VOICE_INTERVIEW_QUESTIONS } from "./interview";

describe("selectVoiceInterviewQuestion", () => {
  it("starts with the buyer trust proof question", () => {
    const selection = selectVoiceInterviewQuestion();

    expect(selection.mode).toBe("voice_interview");
    expect(selection.question.id).toBe("buyer_trust_proof");
    expect(selection.remaining).toBe(VOICE_INTERVIEW_QUESTIONS.length - 1);
  });

  it("skips answered questions", () => {
    const selection = selectVoiceInterviewQuestion({
      answeredIds: ["buyer_trust_proof", "security_and_compliance"],
    });

    expect(selection.question.id).toBe("best_customer_fit");
    expect(selection.remaining).toBe(VOICE_INTERVIEW_QUESTIONS.length - 3);
  });

  it("cycles through the question pool with a cursor", () => {
    const selection = selectVoiceInterviewQuestion({ cursor: 6 });

    expect(selection.question.id).toBe("security_and_compliance");
  });
});
