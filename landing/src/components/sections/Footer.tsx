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
  const shield = "M24 5 L39 11 V25 C39 33.5 32.4 39.2 24 43 C15.6 39.2 9 33.5 9 25 V11 Z";
  if (label === "GDPR") {
    // privacy shield with a lock
    return (
      <svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d={shield} />
        <rect x="18.5" y="23.5" width="11" height="9" rx="1.5" />
        <path d="M21 23.5 V20.2 A3 3 0 0 1 27 20.2 V23.5" />
      </svg>
    );
  }
  if (label === "SOC 2") {
    // audited shield with a check
    return (
      <svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d={shield} />
        <path d="M17.5 24.5 l4.4 4.4 8.8 -10.8" strokeWidth="1.9" />
      </svg>
    );
  }
  // ISO — rosette seal with a check
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="11.5" y="11.5" width="25" height="25" rx="3.5" />
      <rect x="11.5" y="11.5" width="25" height="25" rx="3.5" transform="rotate(45 24 24)" strokeOpacity="0.4" />
      <path d="M18.5 24 l3.9 3.9 7.4 -9" strokeWidth="1.7" />
    </svg>
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
        <aside className="hidden w-[180px] shrink-0 flex-col items-center gap-8 self-stretch border-x border-white/[0.07] pt-24 lg:flex">
          <Badge label="GDPR" />
          <Badge label="SOC 2" />
          <Badge label="ISO" />
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
                className="mt-9 flex items-center justify-center bg-cream px-12 py-4 text-[12px] font-medium tracking-[0.01em] text-ink transition-colors hover:bg-paper-2"
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
