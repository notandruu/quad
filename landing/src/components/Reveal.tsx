"use client";

import { useRef, useEffect, type ElementType, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** stagger between direct children when true */
  stagger?: boolean;
  delay?: number;
  y?: number;
  blur?: boolean;
  once?: boolean;
};

/**
 * Entry animation that mirrors Framer's appear effects:
 * opacity 0 + translateY -> resting, on scroll into view.
 * Uses the site's smooth curve (0.16,1,0.3,1).
 */
export default function Reveal({
  children,
  as: Tag = "div",
  className,
  stagger = false,
  delay = 0,
  y = 24,
  blur = false,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = stagger ? Array.from(el.children) : [el];

    gsap.set(targets, {
      opacity: 0,
      y,
      filter: blur ? "blur(6px)" : "none",
    });

    const tween = gsap.to(targets, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.6,
      delay,
      ease: "power3.out",
      stagger: stagger ? 0.08 : 0,
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: once ? "play none none none" : "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [stagger, delay, y, blur, once]);

  const Tag2 = Tag as ElementType;
  return (
    <Tag2 ref={ref as never} className={className}>
      {children}
    </Tag2>
  );
}
