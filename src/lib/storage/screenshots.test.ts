import { describe, it, expect, vi, afterEach } from "vitest";
import { isStorageConfigured, screenshotPublicUrl, uploadScreenshot } from "./screenshots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isStorageConfigured", () => {
  it("returns false when env vars are absent", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    expect(isStorageConfigured()).toBe(false);
  });

  it("returns false when only URL is set", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    expect(isStorageConfigured()).toBe(false);
  });

  it("returns true when both vars are set", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "secret");
    expect(isStorageConfigured()).toBe(true);
  });
});

describe("screenshotPublicUrl", () => {
  it("returns the correct public URL for a given key", () => {
    vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co");
    const url = screenshotPublicUrl("run123/page-com-1234567890.png");
    expect(url).toBe(
      "https://proj.supabase.co/storage/v1/object/public/screenshots/run123/page-com-1234567890.png"
    );
  });
});

describe("uploadScreenshot", () => {
  it("returns data URI when storage is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    const png = Buffer.from("fakeimage");
    const result = await uploadScreenshot(png, "run1", "https://example.com");
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result).toContain(png.toString("base64"));
  });

  it("throws on non-ok response from Supabase", async () => {
    vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "secret");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    const png = Buffer.from("fakeimage");
    await expect(uploadScreenshot(png, "run1", "https://example.com")).rejects.toThrow(
      "Screenshot upload failed 401"
    );

    vi.restoreAllMocks();
  });

  it("returns permanent public URL on success", async () => {
    vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "secret");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ Key: "run1/example-com-123.png" }), { status: 200 })
    );

    const png = Buffer.from("fakeimage");
    const result = await uploadScreenshot(png, "run1", "https://example.com");
    expect(result).toMatch(
      /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/screenshots\/run1\//
    );
    expect(result).toMatch(/\.png$/);

    vi.restoreAllMocks();
  });

  it("url slug strips protocol and sanitizes characters", async () => {
    vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "secret");

    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementationOnce((url) => {
      capturedUrl = url as string;
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const png = Buffer.from("x");
    await uploadScreenshot(png, "r1", "https://acme.org/about?q=1");
    // The slug should strip the protocol — the key segment after /screenshots/ must not begin with "https-"
    const keySegment = capturedUrl.split("/screenshots/")[1] ?? "";
    expect(keySegment).toContain("acme-org-about-q-1");
    expect(keySegment).not.toMatch(/^https-/);

    vi.restoreAllMocks();
  });
});
