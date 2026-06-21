"use client";

import { useState } from "react";
import HoverText from "@/components/HoverText";

// ribbon/tab shape: full-width top, bottom corners chamfered inward
const BANNER_CLIP =
  "polygon(0 0, 100% 0, 100% 80%, 87% 100%, 13% 100%, 0 80%)";

/** Quad mark — four outlined shapes (rounded-square, diamond, circle, hexagon) */
export function QuadMark({ size = 34, color = "#FF5CAB", strokeWidth = 2.2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="14" height="14" rx="4.5" />
      <path d="M29.5 3 L37 10.5 L29.5 18 L22 10.5 Z" />
      <circle cx="10.5" cy="29.5" r="7.2" />
      <path d="M37.2 29.5 L33.35 36.2 L25.65 36.2 L21.8 29.5 L25.65 22.8 L33.35 22.8 Z" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative flex h-[98px] w-[160px] items-start justify-center bg-flame pt-[20px] ${className}`}
      style={{ clipPath: BANNER_CLIP }}
    >
      {/* halftone texture — fades in toward the bottom only */}
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(17,17,17,0.85) 1px, transparent 1.5px)",
          backgroundSize: "7px 7px",
          maskImage: "linear-gradient(to bottom, transparent 40%, black 92%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 40%, black 92%)",
        }}
      />
      {/* four-shape Quad mark, dark on the pink banner */}
      <QuadMark size={42} color="#161616" strokeWidth={2.6} />
    </div>
  );
}

const NAV = ["Platform", "Security", "Customers", "Docs"];

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* solid black nav bar, full width edge-to-edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[64px] bg-ink" aria-hidden />
      {/* horizontal line separating the nav — full-bleed to screen edges */}
      <div className="pointer-events-none absolute inset-x-0 top-[64px] hidden border-b border-white/[0.07] lg:block" />
      <div className="mx-auto flex max-w-[1512px] items-start px-5 md:px-10">
        {/* Quad logo banner — centered in the rail column */}
        <div className="flex w-[160px] shrink-0 justify-start lg:w-[180px] lg:justify-center">
          <Logo />
        </div>

        {/* nav bar — runs to the right edge */}
        <div className="relative flex h-[64px] flex-1 items-center justify-end self-start bg-ink lg:pl-14">
          {/* subtle halftone texture on the right portion */}
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.5px)",
              backgroundSize: "8px 8px",
              maskImage: "linear-gradient(to right, transparent 45%, black 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 45%, black 100%)",
            }}
          />
          <nav className="relative mr-10 hidden items-center gap-9 md:flex">
            {NAV.map((n, i) => (
              <a
                key={n}
                href="#"
                className={`navlink text-[14px] tracking-[0.01em] transition-colors ${
                  i === 0 ? "text-bone" : "text-bone/55 hover:text-bone"
                }`}
              >
                {n}
              </a>
            ))}
          </nav>

          {/* hamburger (mobile) */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="relative mr-5 flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          >
            <span className="h-px w-6 bg-bone" />
            <span className="h-px w-6 bg-bone" />
          </button>

          {/* GET STARTED orange block — flush right */}
          <a
            href="#"
            className="relative -mr-5 hidden h-[64px] items-center justify-center bg-flame px-10 text-[13px] font-semibold tracking-[0.01em] text-ink transition-colors hover:bg-flame-2 md:-mr-10 md:flex"
          >
            <HoverText text="Open Dashboard" />
          </a>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 bg-[rgba(20,20,20,0.95)] px-6 py-4 backdrop-blur-md md:hidden">
          {NAV.map((n) => (
            <a key={n} href="#" className="py-2 text-[15px] text-bone/85">
              {n}
            </a>
          ))}
          <a
            href="#"
            className="mt-2 rounded-full bg-flame px-5 py-2.5 text-center text-[12px] font-medium tracking-[0.01em] text-ink"
          >
            Open Dashboard
          </a>
        </div>
      )}
    </header>
  );
}
