"use client";

import { useRef } from "react";
import Reveal from "@/components/Reveal";
import SplitReveal from "@/components/SplitReveal";
import HoverText from "@/components/HoverText";
import { MonoLabel } from "@/components/ui";

const WORKFLOW = [
  { n: "01", label: "RETRIEVE EVIDENCE" },
  { n: "02", label: "GROUND ANSWER" },
  { n: "03", label: "REQUIRE APPROVAL" },
  { n: "04", label: "SHIP + RECEIPT" },
];

const FEATURES = [
  { title: "GROUNDED IN EVIDENCE", body: "Every answer cites the source it came from." },
  { title: "SELF-VALIDATED", body: "Quad evaluates its own work before it ships." },
  { title: "APPROVAL-GATED", body: "Sensitive actions wait for a human." },
  { title: "FULLY REPLAYABLE", body: "Replay any run, step by step, with receipts." },
];

function Glyph({ i }: { i: number }) {
  const paths = [
    "M4 8h12M4 12h12M4 16h7", // connect
    "M6 4l10 8-10 8z", // runner (play)
    "M10 3l7 4v6c0 4-3 6-7 7-4-1-7-3-7-7V7z", // shield
    "M4 16l4-5 3 3 5-7", // chart
  ];
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#FFB6D6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[i]} />
    </svg>
  );
}

export default function Intro() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <section className="relative overflow-x-clip bg-ink-2 text-bone" data-section="intro">
      <div className="mx-auto max-w-[1512px] px-5 md:px-10">
        {/* section-divider line — connects to the vertical rail lines */}
        <div className="border-t border-white/[0.07] -mx-5 md:-mx-10" />
        <div className="flex">
        {/* rail column — continues the left rail border */}
        <div className="hidden w-[180px] shrink-0 border-x border-white/[0.07] lg:block" />
        <div className="min-w-0 flex-1 py-20 md:py-28 lg:ml-[38px] lg:border-l lg:border-white/[0.07] lg:pl-9">
        {/* video — boxed in a line */}
        <Reveal className="relative overflow-hidden border border-white/[0.1]">
          <video
            ref={videoRef}
            src="/assets/video/viaduct.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="aspect-[16/8] w-full object-cover [filter:saturate(0.18)_brightness(0.66)_contrast(1.06)_sepia(0.22)]"
          />
          <div className="pointer-events-none absolute inset-0 bg-ink/30" />
          <button
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.paused ? v.play() : v.pause();
            }}
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center bg-cream px-6 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-2"
            style={{
              clipPath:
                "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
            }}
          >
            <span className="mr-1.5">▶</span>
            <HoverText text="Play video" />
          </button>
        </Reveal>

        {/* two-column body */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
          {/* left — overview copy */}
          <div className="min-w-0">
            <div className="mb-7 flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-tan" />
              <MonoLabel className="text-tan/70">Overview</MonoLabel>
            </div>
            <SplitReveal
              as="h4"
              className="text-[22px] font-normal leading-[1.4] text-paper-2 md:text-[24px]"
              text="Quad is a company-aware AI employee that turns customer and trust questions into completed, verified work."
            />
            <SplitReveal
              as="h4"
              className="mt-7 text-[22px] font-normal leading-[1.4] text-paper-2 md:text-[24px]"
              text="It connects your helpdesk, docs, CRM, and code, grounds every answer in evidence, ships through approval, and learns only what it can prove. The brain you see at the end was built during the work."
            />
          </div>

          {/* right — workflow card */}
          <Reveal className="min-w-0">
            <div className="rounded-xl border border-white/[0.08] bg-[#161616] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-flame/20 text-flame">↺</span>
                  <span className="text-[14px] text-bone">Security questionnaire</span>
                </div>
                <MonoLabel className="text-tan/50">Live run</MonoLabel>
              </div>
              <div className="space-y-0">
                {WORKFLOW.map((w, i) => (
                  <div key={w.n}>
                    <div className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                      <span className="font-mono text-[12px] text-tan/40">{w.n}</span>
                      <span className="flex-1 font-mono text-[12px] uppercase tracking-[0.08em] text-tan">
                        {w.label}
                      </span>
                      <span className="text-tan/40">
                        <Glyph i={i} />
                      </span>
                    </div>
                    {i < WORKFLOW.length - 1 && (
                      <div className="flex justify-center py-1.5 text-tan/30">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* feature row */}
        <Reveal
          stagger
          className="mt-20 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-white/[0.08] pt-12 lg:grid-cols-4"
        >
          {FEATURES.map((f, i) => (
            <div key={f.title}>
              <span className="mb-4 inline-block text-tan/50">
                <Glyph i={i} />
              </span>
              <MonoLabel className="block text-bone">{f.title}</MonoLabel>
              <p className="mt-2 max-w-[22ch] text-[13px] leading-relaxed text-tan/70">
                {f.body}
              </p>
            </div>
          ))}
        </Reveal>
        </div>
        </div>
      </div>
    </section>
  );
}
