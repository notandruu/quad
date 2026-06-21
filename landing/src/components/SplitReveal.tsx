"use client";

import { useRef, useEffect, Fragment, type ElementType } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * GSAP typewriter for the Intro headings: characters type out left-to-right
 * with a blinking caret that follows the cursor, triggered on scroll-in.
 */
export default function SplitReveal({
  text,
  as: Tag = "p",
  className = "",
  speed = 0.026,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = gsap.utils.toArray<HTMLElement>(el.querySelectorAll("[data-c]"));
    const caret = el.querySelector<HTMLElement>("[data-caret]");

    const ctx = gsap.context(() => {
      gsap.set(chars, { opacity: 0 });
      gsap.set(caret, { opacity: 0 });

      const moveCaret = (ch: HTMLElement) => {
        const pr = el.getBoundingClientRect();
        const r = ch.getBoundingClientRect();
        gsap.set(caret, {
          x: r.right - pr.left,
          y: r.top - pr.top,
          height: r.height,
        });
      };

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
      });
      tl.set(caret, { opacity: 1 });
      chars.forEach((ch, i) => {
        const t = i * speed;
        tl.set(ch, { opacity: 1 }, t);
        tl.add(() => moveCaret(ch), t);
      });
      // once typing is done, stop the blink animation and remove the caret
      tl.call(
        () => {
          if (caret) {
            caret.style.animation = "none";
            caret.style.opacity = "0";
          }
        },
        undefined,
        "+=0.6",
      );
    }, el);

    return () => ctx.revert();
  }, [text, speed]);

  const Tag2 = Tag as ElementType;
  const words = text.split(" ");
  return (
    <Tag2 ref={ref as never} className={`relative ${className}`}>
      {words.map((w, wi) => (
        <Fragment key={wi}>
          <span className="inline-block whitespace-nowrap">
            {w.split("").map((ch, ci) => (
              <span key={ci} data-c className="inline-block">
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
      <span
        data-caret
        aria-hidden
        className="tw-caret pointer-events-none absolute left-0 top-0"
      />
    </Tag2>
  );
}
