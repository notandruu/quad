import { describe, it, expect } from "vitest";
import { extractJsonArray, extractJsonObject } from "./anthropic";

describe("extractJsonArray", () => {
  it("pulls an array out of prose", () => {
    expect(extractJsonArray('Here you go: [{"a":1}] thanks')).toEqual([{ a: 1 }]);
  });
  it("returns [] when there is no array or it is malformed", () => {
    expect(extractJsonArray("no json here")).toEqual([]);
    expect(extractJsonArray("[broken")).toEqual([]);
  });
});

describe("extractJsonObject", () => {
  it("pulls an object out of prose", () => {
    expect(extractJsonObject('result: {"grounded":true} done')).toEqual({ grounded: true });
  });
  it("returns null when there is no object or it is malformed", () => {
    expect(extractJsonObject("nothing")).toBeNull();
    expect(extractJsonObject("{oops")).toBeNull();
  });
});
