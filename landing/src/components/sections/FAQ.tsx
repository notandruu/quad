"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import HoverText from "@/components/HoverText";
import { MonoLabel } from "@/components/ui";

const ITEMS = [
  {
    q: "What does Quad actually do?",
    a: "Quad is a company-aware AI employee for enterprise trust work. It finds the evidence, grounds an answer, validates it, ships through approval, and leaves a receipt for every step.",
  },
  {
    q: "Do I need to train it myself?",
    a: "No. Quad learns from your existing systems as it works. It writes back only facts it has verified, with the source attached, so the brain gets smarter without ever learning a guess.",
  },
  {
    q: "What integrations do you support?",
    a: "Quad connects to major helpdesks, CRMs, doc stores, and code hosts out of the box, plus 150+ more. New connectors install through the registry without touching the runtime.",
  },
  {
    q: "Can I control what Quad does?",
    a: "Yes. Every write action runs through an autonomy tier. Routine work auto-executes, sensitive actions wait for the right human, and nothing ships outside your policy.",
  },
  {
    q: "Is my company data safe?",
    a: "Quad minimizes what leaves your tenant and proves what did. SOC 2 Type II, tenant isolation, redaction, and a receipt showing exactly what context each model call used.",
  },
  {
    q: "How does Quad prove its work?",
    a: "Every answer cites its source, every run is traced step by step, and every compressed handoff ships with a QuadChain receipt. You can replay any decision end to end.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section
      id="faq"
      data-spy="faq"
      className="scroll-mt-24 grid grid-cols-1 gap-10 bg-paper px-6 py-12 text-ink md:px-14 md:py-16 lg:grid-cols-2 lg:gap-16"
      style={{
        clipPath:
          "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
      }}
    >
      {/* left */}
      <div className="flex flex-col justify-between">
        <Reveal>
          <h2 className="max-w-[12ch] text-[32px] font-normal leading-[1.05] tracking-[-0.015em] md:text-[40px]">
            Frequently asked questions
          </h2>
        </Reveal>
        <div className="mt-10 lg:mt-0">
          <MonoLabel className="block leading-relaxed text-ink/60">
            Want to see it run?
            <br />
            Open the dashboard
          </MonoLabel>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink/15 pt-5">
            <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-soft">
              Watch Quad run a real trust workflow end to end, with evidence,
              approval, and a receipt.
            </p>
            <button
              className="dashboard-cta flex items-center px-6 py-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors"
              style={{
                clipPath:
                  "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              }}
            >
              <HoverText text="Open Dashboard" />
            </button>
          </div>
        </div>
      </div>

      {/* right accordion */}
      <div className="flex flex-col gap-2.5">
        {ITEMS.map((it, i) => {
          const isOpen = open === i;
          return (
            <div
              key={it.q}
              className="p-[5px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(28,28,28,0.16) 0 1px, transparent 1px 5px)",
              }}
            >
              <div className="bg-paper px-6 py-5">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="group flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-[16px] text-ink">{it.q}</span>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${
                      isOpen ? "bg-ink text-paper" : "bg-cream text-ink group-hover:bg-cream-2"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? "rotate-[135deg]" : ""}`}
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                      <path d="M6 1v10M1 6h10" />
                    </svg>
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p
                      className={`pt-4 text-[14px] leading-relaxed text-ink-soft transition-opacity duration-500 ${
                        isOpen ? "opacity-100 delay-150" : "opacity-0"
                      }`}
                    >
                      {it.a}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
