"use client";

import { useState, useRef, useEffect, useLayoutEffect, Fragment } from "react";
import { gsap } from "gsap";
import IsoDiagram from "@/components/IsoDiagram";
import HoverText from "@/components/HoverText";
import Parallax from "@/components/Parallax";
import { SPONSORS, SponsorMark } from "@/components/SponsorLogos";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TITLE: { w: string; dim?: boolean; serif?: boolean; br?: boolean }[] = [
  { w: "Quad.", serif: true, br: true },
  { w: "Leading", dim: true },
  { w: "agentic", dim: true, br: true },
  { w: "trust", dim: false },
  { w: "work.", dim: false },
];

const LAYERS = [
  {
    title: "Find the gap",
    items: [
      "Audit public claims against your company brain.",
      "Catch missing, stale, or conflicting answers.",
      "Flag the exact source that caused each gap.",
    ],
  },
  {
    title: "Gather evidence",
    items: [
      "Pull proof from docs, tickets, code, and infra.",
      "Collect only what the answer actually needs.",
      "Cite the source behind every fact.",
    ],
  },
  {
    title: "Validate",
    items: [
      "Ground each answer in real evidence.",
      "Block weak or unsupported claims.",
      "Learn back only what it can prove.",
    ],
  },
  {
    title: "Approve & ship",
    items: [
      "Route sensitive actions to a human.",
      "Ship the fix, packet, or update in place.",
      "Leave a replayable QuadChain receipt.",
    ],
  },
];

const CHAMFER =
  "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";

export default function Hero() {
  const [open, setOpen] = useState(0);
  const root = useRef<HTMLElement>(null);

  // choreographed GSAP entrance — the dopamine moment
  useIso(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 });
      tl.from('[data-h="label"]', {
        y: 18,
        autoAlpha: 0,
        filter: "blur(8px)",
        duration: 0.7,
        ease: "power3.out",
      })
        .from(
          '[data-h="word"]',
          {
            yPercent: 60,
            autoAlpha: 0,
            filter: "blur(12px)",
            rotateX: -38,
            transformOrigin: "50% 100%",
            transformPerspective: 700,
            duration: 0.95,
            stagger: 0.075,
          },
          "-=0.35",
        )
        .from(
          '[data-h="sub"]',
          { y: 22, autoAlpha: 0, filter: "blur(6px)", duration: 0.7, ease: "power3.out" },
          "-=0.55",
        )
        .from(
          '[data-h="cta"]',
          { y: 16, autoAlpha: 0, scale: 0.96, duration: 0.6, ease: "back.out(1.7)" },
          "-=0.4",
        )
        .from(
          '[data-h="acc"]',
          { x: -18, autoAlpha: 0, filter: "blur(4px)", duration: 0.6, stagger: 0.08, ease: "power3.out" },
          "-=0.35",
        )
        .from(
          '[data-h="rail"]',
          { x: -12, autoAlpha: 0, duration: 0.5, stagger: 0.045, ease: "power3.out" },
          "<",
        );
    }, el);
    return () => ctx.revert();
  }, []);

  const accordion = (
    <div className="mt-auto border-t border-white/[0.07]">
      {LAYERS.map((layer, i) => {
        const isOpen = open === i;
        return (
          <div
            key={layer.title}
            data-h="acc"
            className={i < LAYERS.length - 1 ? "border-b border-white/[0.07]" : ""}
          >
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center gap-5 py-[18px] text-left lg:pl-9 lg:pr-9"
            >
              <span className="font-mono text-[13px] text-tan/50">0{i + 1}</span>
              <span className="flex-1 text-[17px] text-bone">{layer.title}</span>
              <span
                className={`text-tan/60 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                ⌄
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="space-y-3 pb-6 pl-9 pr-9 lg:pl-9">
                  {layer.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-start gap-4 text-[15px] leading-relaxed text-tan/80"
                    >
                      <span className="mt-px font-mono text-[15px] leading-none text-tan/40">
                        +
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <section
      ref={root}
      className="relative min-h-screen overflow-x-clip bg-ink text-bone"
      data-section="hero"
    >
      <div className="mx-auto flex min-h-screen max-w-[1512px] px-5 md:px-10">
        {/* LEFT RAIL — full-height bordered column */}
        <aside className="hidden w-[180px] shrink-0 flex-col self-start border-x border-white/[0.07] lg:flex lg:h-screen">
          <div className="h-[98px] shrink-0" />
          <div className="flex-1" />
          <p
            data-h="rail"
            className="border-b border-white/[0.07] px-6 pb-4 pt-5 font-mono text-[12px] uppercase tracking-[0.14em] text-tan/55"
          >
            Runs on
          </p>
          {SPONSORS.map((s, i) => (
            <div
              key={s.name}
              data-h="rail"
              className="flex items-center gap-3.5 border-b border-white/[0.07] px-6 py-[14px] text-tan/70 transition-colors hover:bg-white/[0.02] hover:text-bone"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <SponsorMark i={i} size={22} />
              </span>
              <span className="text-[13px] font-medium tracking-[-0.01em]">{s.name}</span>
            </div>
          ))}
        </aside>

        {/* RIGHT AREA — content + diagram grid; content carries the left grid-line */}
        <div className="grid min-w-0 flex-1 grid-cols-1 pb-16 pt-[88px] lg:grid-cols-[minmax(0,600px)_1fr] lg:pb-0 lg:pl-[38px] lg:pt-0">
          {/* CONTENT column — border-l runs full height (meets nav line at top); text padded down */}
          <div className="order-1 flex min-w-0 flex-col lg:border-l lg:border-white/[0.07] lg:pt-[64px]">
            {/* label row — centered in its cell; underline spans full column, connecting both verticals */}
            <div
              data-h="label"
              className="flex items-center gap-3 overflow-hidden border-b border-white/[0.07] py-6 lg:pl-9"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tan" />
              <span className="shrink-0 font-mono text-[13px] tracking-[0.04em] text-tan">
                Enterprise trust work, automated
              </span>
              <span
                className="ml-2 h-3 flex-1 min-w-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(115deg, rgba(255,182,214,0.25) 0 1px, transparent 1px 6px)",
                }}
              />
            </div>

            <h1 className="mt-12 max-w-[640px] lg:pl-9 text-[42px] font-normal leading-[1.04] tracking-[-0.02em] text-paper-2 md:text-[54px] lg:text-[62px]">
              {TITLE.map((t, i) => (
                <Fragment key={i}>
                  <span
                    data-h="word"
                    className={`inline-block ${t.dim ? "text-tan" : ""}`}
                    style={t.serif ? { fontFamily: "var(--font-canela), Georgia, serif", fontWeight: 500 } : undefined}
                  >
                    {t.w}
                  </span>
                  {t.br ? <br /> : i < TITLE.length - 1 ? " " : ""}
                </Fragment>
              ))}
            </h1>
            <p
              data-h="sub"
              className="mt-7 max-w-[516px] lg:pl-9 text-[16px] leading-[1.5] text-tan"
            >
              Quad turns scattered company knowledge into verified, customer-ready
              work. Every answer is grounded in evidence, gated by approval, and
              replayable end to end.
            </p>

            <a
              data-h="cta"
              href="https://app.quad.stephenhung.me"
              className="mt-9 flex w-full max-w-[514px] items-center justify-center bg-cream lg:ml-9 py-4 text-[12px] font-medium tracking-[0.01em] text-ink transition-colors hover:bg-paper-2"
              style={{ clipPath: CHAMFER }}
            >
              <HoverText text="Open Dashboard" />
            </a>

            {accordion}

            {/* mobile "runs on" */}
            <div className="mt-12 lg:hidden">
              <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.14em] text-tan/70">
                Runs on
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SPONSORS.map((s, i) => (
                  <div
                    key={s.name}
                    className="flex h-20 flex-col items-center justify-center gap-2 border border-white/[0.06] text-tan/70"
                  >
                    <SponsorMark i={i} size={24} />
                    <span className="text-[11px] font-medium">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DIAGRAM column — separated by its own left grid-line; draws itself in */}
          <div className="order-2 flex items-center justify-center pt-12 lg:justify-end lg:border-l lg:border-white/[0.07] lg:pl-10 lg:pt-[64px]">
            <Parallax amount={26} className="w-full max-w-[560px]">
              <IsoDiagram className="h-auto w-full" />
            </Parallax>
          </div>
        </div>
      </div>
    </section>
  );
}
