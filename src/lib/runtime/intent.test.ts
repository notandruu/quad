import { describe, it, expect } from "vitest";
import { classifyIntent, extractUrl } from "./intent";

describe("classifyIntent", () => {
  it("detects an audit request with a URL", () => {
    expect(classifyIntent("start an audit of https://acme.org")).toBe("website_audit");
    expect(classifyIntent("run a scan on our site")).toBe("website_audit");
  });

  it("routes follow-ups when an audit is active", () => {
    expect(
      classifyIntent("what should I fix first?", { hasActiveAudit: true })
    ).toBe("audit_follow_up");
  });

  it("does not treat a fix question as a follow-up without an active audit", () => {
    expect(classifyIntent("what should I fix first?")).not.toBe("audit_follow_up");
  });

  it("detects content drafting and task creation", () => {
    expect(classifyIntent("draft the missing FAQ")).toBe("draft_content");
    expect(classifyIntent("create a task for the team")).toBe("create_task");
  });

  it("detects meeting summarization and memory saves", () => {
    expect(classifyIntent("summarize the meeting transcript")).toBe("summarize_meeting");
    expect(classifyIntent("save this to the brain")).toBe("save_memory");
  });

  it("treats questions as company questions and falls back to general chat", () => {
    expect(classifyIntent("what programs do we offer?")).toBe("company_question");
    expect(classifyIntent("hello there")).toBe("general_chat");
  });
});

describe("extractUrl", () => {
  it("pulls the first url out of text", () => {
    expect(extractUrl("see https://a.com/x and http://b.org")).toBe("https://a.com/x");
  });
  it("returns null when there is no url", () => {
    expect(extractUrl("no links here")).toBeNull();
  });
});
