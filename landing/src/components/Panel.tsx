"use client";

import { type ReactNode } from "react";
import Reveal from "@/components/Reveal";

/**
 * The cream rounded content panel used by every block in the lower page.
 */
export default function Panel({
  id,
  label,
  desc,
  title,
  surface = "paper",
  children,
  className = "",
}: {
  id?: string;
  label: string;
  desc?: string;
  title?: ReactNode;
  surface?: "paper" | "cream";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-spy={id}
      className={`scroll-mt-24 ${
        surface === "paper" ? "bg-paper" : "bg-cream"
      } px-6 py-10 text-ink md:px-14 md:py-16 ${className}`}
      style={{
        clipPath:
          "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
      }}
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-ink/12 pb-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="font-mono text-[14px] text-ink/80">{label}</span>
        </div>
        {/* hatched rule fills the row, connecting label → description */}
        <span className="hatch-ink h-3 min-w-[40px] flex-1" />
        {desc && (
          <p className="max-w-[42ch] text-[13px] leading-relaxed text-ink-soft md:text-right">
            {desc}
          </p>
        )}
      </div>

      {title && (
        <Reveal>
          <h2 className="mt-8 max-w-[22ch] text-[32px] font-normal leading-[1.05] tracking-[-0.015em] text-ink md:text-[40px]">
            {title}
          </h2>
        </Reveal>
      )}

      {children}
    </section>
  );
}
