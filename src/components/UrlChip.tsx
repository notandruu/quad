"use client";

/** The pinned audit target. Shows "General" when no URL is detected. */
export function UrlChip({ url }: { url: string | null }) {
  return (
    <div className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1 text-xs">
      <span className={url ? "text-accent" : "text-neutral-500"}>●</span>
      <span className="max-w-[40ch] truncate text-neutral-300">
        {url ?? "General"}
      </span>
    </div>
  );
}
