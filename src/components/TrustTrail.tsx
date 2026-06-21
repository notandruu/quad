"use client";

import { useEffect, useState } from "react";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";

type TrustTrailResponse = {
  summary: {
    total: number;
    accepted: number;
    rejected: number;
    tokensSaved: number;
    evidencePreserved: number;
    evidenceRequired: number;
    latest: QuadChainPacketSummary[];
  };
  packets: QuadChainPacketSummary[];
};

export function TrustTrail({ runId }: { runId: string | null }) {
  const [data, setData] = useState<TrustTrailResponse | null>(null);

  useEffect(() => {
    if (!runId) {
      setData(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/quadchain/packets?runId=${encodeURIComponent(runId)}&limit=12`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setData(json as TrustTrailResponse);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!runId || !data || data.summary.total === 0) return null;

  return (
    <section className="rounded-lg border border-edge bg-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-100">Trust trail</h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            Quadchain receipts for this run.
          </p>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
          {data.summary.accepted}/{data.summary.total} accepted
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="tokens saved" value={String(data.summary.tokensSaved)} />
        <Stat
          label="evidence"
          value={`${data.summary.evidencePreserved}/${data.summary.evidenceRequired}`}
        />
        <Stat label="rejected" value={String(data.summary.rejected)} />
      </div>

      <div className="mt-3 space-y-1.5">
        {data.packets.slice(0, 5).map((packet) => (
          <div key={packet.id} className="rounded border border-edge bg-ink/50 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] text-neutral-300">{packet.type}</span>
              <span className={packet.accepted ? "text-[10px] text-accent" : "text-[10px] text-red-300"}>
                {packet.accepted ? "accepted" : "rejected"}
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[9px] text-neutral-600">
              {packet.certificateId}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-edge bg-ink/50 p-2">
      <div className="text-sm font-semibold text-neutral-100">{value}</div>
      <div className="mt-1 text-[9px] text-neutral-600">{label}</div>
    </div>
  );
}
