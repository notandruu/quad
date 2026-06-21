"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ── Orange pill button (GET STARTED) ─────────────────────────── */
export function FlameButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`group relative overflow-hidden rounded-full bg-flame px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-flame-2 ${className}`}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ── Ghost / outline button ───────────────────────────────────── */
export function GhostButton({
  children,
  dark = false,
  className = "",
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`rounded-full border px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${
        dark
          ? "border-ink/15 text-ink hover:bg-ink hover:text-paper"
          : "border-white/15 text-bone hover:bg-white hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Mono section label (e.g. "01 / CAPABILITIES") ────────────── */
export function MonoLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.12em] ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Count-up number that animates when scrolled into view ────── */
export function CountUp({
  value,
  suffix = "",
  prefix = "",
  duration = 1.4,
  className = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { n: 0 };
    const decimals = value % 1 !== 0 ? 1 : 0;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          n: value,
          duration,
          ease: "power2.out",
          onUpdate: () =>
            setDisplay(parseFloat(obj.n.toFixed(decimals))),
        });
      },
    });
    return () => st.kill();
  }, [value, duration]);

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {display.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
