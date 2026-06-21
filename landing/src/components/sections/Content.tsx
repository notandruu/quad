"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// full 8-item index (matches the original rail; Pricing/Testimonials/Insights
// have no section here but stay in the rail for visual fidelity)
const NAV = [
  { id: "capabilities", label: "How it works" },
  { id: "numbers", label: "Proof" },
  { id: "features", label: "Platform" },
  { id: "integrations", label: "Integrations" },
  { id: "trustgaps", label: "Trust gaps" },
  { id: "security", label: "Security" },
  { id: "quadchain", label: "QuadChain" },
  { id: "faq", label: "FAQ" },
];

/**
 * Dark content shell. The left rail is a single PINNED bordered column —
 * the logo banner stays fixed above it (Header), the 01-08 index is frozen
 * while the cream panels scroll past, and the vertical borders + cells run
 * unbroken down to the footer (matching the live site).
 */
export default function Content({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("capabilities");
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.spy!);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    document.querySelectorAll("[data-spy]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // per-section scroll progress fills each nav underline as you move through it
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const line = window.scrollY + vh * 0.5;
      NAV.forEach((n, i) => {
        const el = document.getElementById(n.id);
        const bar = bars.current[i];
        if (!el || !bar) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const p = (line - top) / (el.offsetHeight || 1);
        // only the section you're currently inside fills; the rest stay empty
        const v = p >= 0 && p < 1 ? p : 0;
        bar.style.transform = `scaleX(${v.toFixed(3)})`;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative bg-coal" data-section="content">
      <div className="mx-auto max-w-[1512px] px-5 md:px-10">
        {/* section-divider line — connects the vertical grid */}
        <div className="border-t border-white/[0.07] -mx-5 md:-mx-10" />
        <div className="flex">
        {/* PINNED left rail */}
        <div className="hidden w-[180px] shrink-0 lg:block">
          <div className="sticky top-0 flex h-screen flex-col border-x border-white/[0.07]">
            {/* space behind the pinned logo banner */}
            <div className="h-[150px] shrink-0 border-b border-white/[0.07]" />
            {/* index */}
            {NAV.map((n, i) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="group relative flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-5"
              >
                <span className="font-mono text-[11px] text-tan/35">
                  0{i + 1}
                </span>
                <span
                  className={`text-[13px] transition-colors ${
                    active === n.id ? "text-bone" : "text-tan/45 group-hover:text-tan/80"
                  }`}
                >
                  {n.label}
                </span>
                {/* scroll-progress fill for this section */}
                <span
                  ref={(el) => { bars.current[i] = el; }}
                  aria-hidden
                  className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-flame"
                  style={{ transform: "scaleX(0)", willChange: "transform" }}
                />
              </a>
            ))}
            {/* empty cells continue down to the footer */}
            <div className="flex-1 border-b border-white/[0.07]" />
          </div>
        </div>

        {/* panels */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 py-5 lg:ml-[38px] lg:border-l lg:border-white/[0.07] lg:pl-9">
          {children}
        </div>
        </div>
      </div>
    </section>
  );
}
