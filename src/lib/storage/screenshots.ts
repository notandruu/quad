/**
 * Screenshot storage via Supabase Storage.
 *
 * Why Supabase Storage:
 * - Already in the stack, no extra service or account
 * - Public bucket = stable permanent URLs, no signed URL expiry to manage
 * - REST upload is a single fetch call, no SDK needed
 * - Free tier: 1 GB storage, generous for a hackathon
 *
 * URL pattern: https://{project}.supabase.co/storage/v1/object/public/screenshots/{key}
 */
import { createEvidenceBundle, summarizeEvidenceBundle, type EvidenceBundleSummary } from "./evidence";

const BUCKET = "screenshots";

export type ScreenshotUploadResult = {
  url: string;
  evidence: EvidenceBundleSummary;
};

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Upload a PNG buffer to Supabase Storage and return the permanent public URL.
 * Falls back to a data URI when storage is not configured so Browserbase
 * renders still work locally without any env vars set.
 *
 * Key format: {runId}/{urlHash}-{timestamp}.png
 * This keeps screenshots grouped by audit run and avoids collisions.
 */
export async function uploadScreenshot(
  png: Buffer,
  runId: string,
  pageUrl: string
): Promise<string> {
  const result = await uploadScreenshotWithEvidence({
    png,
    orgId: "org_unknown",
    runId,
    pageUrl,
  });
  return result.url;
}

export async function uploadScreenshotWithEvidence(input: {
  png: Buffer;
  orgId: string;
  runId: string;
  pageUrl: string;
}): Promise<ScreenshotUploadResult> {
  const storageKey = `${input.runId}/${urlSlug(input.pageUrl)}-${Date.now()}.png`;
  if (!isStorageConfigured()) {
    const evidence = await createEvidenceBundle({
      orgId: input.orgId,
      runId: input.runId,
      kind: "screenshot",
      storageMode: "inline_fallback",
      mimeType: "image/png",
      byteLength: input.png.byteLength,
      bytes: input.png,
      storageKey,
      sourceUrl: input.pageUrl,
      metadata: {
        fallback: true,
      },
    });
    return {
      url: `data:image/png;base64,${input.png.toString("base64")}`,
      evidence: summarizeEvidenceBundle(evidence),
    };
  }

  const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${storageKey}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "content-type": "image/png",
      "x-upsert": "true",
    },
    body: new Blob([new Uint8Array(input.png)], { type: "image/png" }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Screenshot upload failed ${res.status}: ${err}`);
  }

  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
  const evidence = await createEvidenceBundle({
    orgId: input.orgId,
    runId: input.runId,
    kind: "screenshot",
    storageMode: "supabase_storage",
    mimeType: "image/png",
    byteLength: input.png.byteLength,
    bytes: input.png,
    publicUrl,
    storageKey,
    sourceUrl: input.pageUrl,
  });

  return {
    url: publicUrl,
    evidence: summarizeEvidenceBundle(evidence),
  };
}

/** Public URL for an already-uploaded screenshot key. */
export function screenshotPublicUrl(key: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
}

function urlSlug(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]/gi, "-")
    .slice(0, 60);
}
