"use client";

import Reveal from "@/components/Reveal";
import HoverText from "@/components/HoverText";
import { MonoLabel, CountUp } from "@/components/ui";
import { DASHBOARD_URL, NAV_LINKS } from "@/lib/links";

const SITE = [
  ...NAV_LINKS,
  { label: "Dashboard", href: DASHBOARD_URL },
];

const SOCIAL = [
  { label: "GitHub", href: "https://github.com/notandruu/quad" },
  { label: "Email", href: "mailto:hello@quad.dev" },
];

const CHAMFER =
  "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)";

function Emblem({ label }: { label: string }) {
  const c = "rgba(255,182,214,0.6)";
  if (label === "GDPR") {
    // EU circle of 12 stars
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke={c} strokeWidth="1" opacity="0.5" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = (24 + Math.cos(a) * 14).toFixed(2);
          const y = (24 + Math.sin(a) * 14 - 2).toFixed(2);
          return <path key={i} d={`M${x} ${y} l0.6 1.4 1.5 0 -1.2 1 0.5 1.5 -1.4 -0.9 -1.4 0.9 0.5 -1.5 -1.2 -1 1.5 0z`} fill={c} />;
        })}
      </svg>
    );
  }
  if (label === "SOC 2") {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke={c} strokeWidth="1" opacity="0.5" />
        <circle cx="24" cy="24" r="16" stroke={c} strokeWidth="0.8" opacity="0.35" />
        <text x="24" y="21" textAnchor="middle" fill={c} fontSize="7" fontFamily="var(--font-mono),monospace" letterSpacing="0.5">AICPA</text>
        <line x1="12" y1="24" x2="36" y2="24" stroke={c} strokeWidth="0.6" opacity="0.5" />
        <text x="24" y="33" textAnchor="middle" fill={c} fontSize="8" fontFamily="var(--font-mono),monospace" letterSpacing="1">SOC</text>
      </svg>
    );
  }
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke={c} strokeWidth="1" opacity="0.5" />
      <circle cx="24" cy="24" r="17" stroke={c} strokeWidth="0.7" opacity="0.3" />
      <circle cx="24" cy="24" r="11" stroke={c} strokeWidth="0.7" opacity="0.3" />
      <text x="24" y="22" textAnchor="middle" fill={c} fontSize="8" fontFamily="var(--font-mono),monospace" letterSpacing="1">ISO</text>
      <text x="24" y="31" textAnchor="middle" fill={c} fontSize="5.5" fontFamily="var(--font-mono),monospace">27001</text>
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
              <a
                href={DASHBOARD_URL}
                className="mt-9 flex items-center justify-center bg-cream px-12 py-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-paper-2"
                style={{ clipPath: CHAMFER }}
              >
                <HoverText text="Open dashboard" />
              </a>
            </div>

            <FooterCol title="Pages" links={SITE} />
            <FooterCol title="Social" links={SOCIAL} />
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
              <div>
                <div className="tnum text-[20px] font-semibold">
                  <CountUp value={12745012} />
                </div>
                <span className="text-[13px] text-ink/70">Answers Verified</span>
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

          {/* wordmark — Didone serif, halftone dissolve at the foot of the letters */}
          <div className="relative select-none py-10">
            <span
              className="block leading-[0.78] tracking-[-0.03em] text-ink"
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontWeight: 800,
                fontSize: "clamp(110px, 26vw, 400px)",
              }}
            >
              Quad
            </span>
            {/* halftone overlay — orange dots punch through the lower part of the glyphs */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 block py-10 leading-[0.78] tracking-[-0.03em]"
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontWeight: 800,
                fontSize: "clamp(110px, 26vw, 400px)",
                backgroundImage:
                  "radial-gradient(circle, #FF5CAB 36%, transparent 39%)",
                backgroundSize: "7px 7px",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 48%, black 92%)",
                maskImage: "linear-gradient(to bottom, transparent 48%, black 92%)",
              }}
            >
              Quad
            </span>
          </div>

          {/* legal bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink/20 py-6 text-[13px] text-ink/80">
            <span>© Quad, 2026</span>
            <div className="flex flex-wrap gap-8">
              <span>All rights reserved</span>
              <a href="#" className="hover:text-ink">Terms of use</a>
              <a href="#" className="hover:text-ink">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex min-w-[140px] flex-col">
      {title && <MonoLabel className="mb-4 text-tan/40">{title}</MonoLabel>}
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          className="border-b border-white/[0.08] py-3 text-[14px] text-tan/80 transition-colors hover:text-bone"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
