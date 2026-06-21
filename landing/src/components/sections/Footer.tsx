"use client";

import Reveal from "@/components/Reveal";
import HoverText from "@/components/HoverText";
import { MonoLabel } from "@/components/ui";

const REPO = "https://github.com/notandruu/quad";
const EXPLORE: [string, string][] = [
  ["How it works", "#capabilities"],
  ["Platform", "#features"],
  ["Proof", "#numbers"],
  ["Integrations", "#integrations"],
];
const MORE: [string, string][] = [
  ["Trust gaps", "#trustgaps"],
  ["Security", "#security"],
  ["QuadChain", "#quadchain"],
  ["GitHub", REPO],
];

const CHAMFER =
  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)";

function Emblem({ label }: { label: string }) {
  const c = "rgba(255,182,214,0.85)";
  const svg = (children: React.ReactNode, sw = 1.6) => (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </svg>
  );
  if (label === "Reliable") {
    // uptime pulse — centered spike
    return svg(
      <>
        <circle cx="24" cy="24" r="18" strokeOpacity="0.35" />
        <path d="M10 24 H19 L23 13 L25 35 L29 24 H38" strokeWidth="1.9" />
      </>,
    );
  }
  if (label === "Intelligent") {
    // spark of insight — centered four-point star
    return svg(
      <path d="M24 8 L27.2 20.8 L40 24 L27.2 27.2 L24 40 L20.8 27.2 L8 24 L20.8 20.8 Z" />,
      1.5,
    );
  }
  // Verifiable — double-ring seal + check
  return svg(
    <>
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="13" strokeOpacity="0.4" />
      <path d="M18.5 24 l3.8 3.8 7.4 -9" strokeWidth="1.9" />
    </>,
  );
}

function Badge({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.02]">
        <Emblem label={label} />
      </div>
      <span className="font-mono text-[11px] tracking-wide text-tan/55">{label}</span>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-ink text-bone">
      {/* CTA */}
      <div className="mx-auto max-w-[1512px] px-5 md:px-10">
        {/* section-divider line — grid continues to the footer */}
        <div className="border-t border-white/[0.07] -mx-5 md:-mx-10" />
        <div className="flex">
        <aside className="hidden w-[180px] shrink-0 flex-col items-center justify-center gap-10 self-stretch border-x border-white/[0.07] lg:flex">
          <Badge label="Reliable" />
          <Badge label="Intelligent" />
          <Badge label="Verifiable" />
        </aside>

        <div className="min-w-0 flex-1 py-20 lg:ml-[38px] lg:border-l lg:border-white/[0.07] lg:pl-9">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_auto_auto] lg:gap-20">
            <div>
              <Reveal>
                <h2 className="max-w-[15ch] text-[36px] font-normal leading-[1.05] tracking-[-0.02em] text-paper-2 md:text-[44px]">
                  See what your AI employee can prove.
                </h2>
              </Reveal>
              <p className="mt-6 max-w-[44ch] text-[14px] leading-relaxed text-tan">
                Connect your stack, set the guardrails, and let Quad turn company
                knowledge into verified, customer-ready work.
              </p>
              <button
                className="dashboard-cta mt-9 flex items-center justify-center px-12 py-4 text-[12px] font-medium tracking-[0.01em] transition-colors"
                style={{ clipPath: CHAMFER }}
              >
                <HoverText text="Open Dashboard" />
              </button>
            </div>

            <FooterCol title="Explore" links={EXPLORE} />
            <FooterCol title="More" links={MORE} />
          </div>
        </div>
        </div>
      </div>

      {/* orange block */}
      <div className="relative overflow-hidden bg-flame text-ink">
        {/* halftone */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(20,20,20,0.9) 1px, transparent 1.4px)",
            backgroundSize: "7px 7px",
          }}
        />
        <div className="relative mx-auto max-w-[1512px] px-5 md:px-10">
          {/* stats row */}
          <div className="grid grid-cols-1 gap-8 border-b border-ink/20 py-10 md:grid-cols-3">
            <div className="flex gap-12">
              <div>
                <div className="text-[20px] font-semibold uppercase tracking-wide">Active</div>
                <span className="text-[13px] text-ink/70">Employee Status</span>
              </div>
            </div>
            <div className="md:col-span-1 md:col-start-3">
              <p className="font-mono text-[13px] leading-relaxed text-ink/80">
                Quad is the runtime for company-aware AI employees. It grounds
                every answer in evidence, ships through approval, and leaves a
                replayable receipt for the work.
              </p>
            </div>
          </div>

          {/* wordmark — centered, no entrance animation */}
          <div
            className="flex select-none items-center justify-center py-10"
            style={{ fontSize: "clamp(96px, 23vw, 360px)" }}
          >
            <div className="relative leading-[0.78] tracking-[-0.03em]">
              <span
                className="block text-ink"
                style={{ fontFamily: "var(--font-canela), Georgia, serif", fontWeight: 400 }}
              >
                Quad
              </span>
              {/* halftone overlay punching through the lower part of the glyphs */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 block leading-[0.78] tracking-[-0.03em]"
                style={{
                  fontFamily: "var(--font-canela), Georgia, serif",
                  fontWeight: 400,
                  backgroundImage: "radial-gradient(circle, #FF5CAB 36%, transparent 39%)",
                  backgroundSize: "7px 7px",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 48%, black 92%)",
                  maskImage: "linear-gradient(to bottom, transparent 48%, black 92%)",
                }}
              >
                Quad
              </span>
            </div>
          </div>

          {/* legal bar */}
          <div className="flex flex-wrap items-center gap-4 border-t border-ink/20 py-6 text-[13px] text-ink/80">
            <span>© Quad, 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex min-w-[140px] flex-col">
      {title && <MonoLabel className="mb-4 text-tan/40">{title}</MonoLabel>}
      {links.map(([label, href]) => {
        const ext = href.startsWith("http");
        return (
          <a
            key={label}
            href={href}
            {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}
            className="border-b border-white/[0.08] py-3 text-[14px] text-tan/80 transition-colors hover:text-bone"
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
