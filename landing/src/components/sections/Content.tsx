"use client";

import { useEffect, useState, type ReactNode } from "react";

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
                className="group flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-5"
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
