"use client";

import { useMemo, useState } from "react";

const BLOSSOMS = ["✿", "＊", "+", ".", "♡", "⌁", "˙"];

export function AsciiBlossoms() {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const petals = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        id: index,
        char: BLOSSOMS[index % BLOSSOMS.length],
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 9) * -1.7}s`,
        duration: `${14 + (index % 7)}s`,
        size: `${11 + (index % 5) * 2}px`,
      })),
    []
  );

  function bloom(event: React.PointerEvent<HTMLElement>) {
    const next = { id: Date.now(), x: event.clientX, y: event.clientY };
    setBursts((items) => [...items.slice(-5), next]);
    window.setTimeout(() => {
      setBursts((items) => items.filter((item) => item.id !== next.id));
    }, 900);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="ascii-grid" />
      <div className="ascii-ribbon top-16" data-text="+ + + Cherry audit mode + + +" />
      <div className="ascii-ribbon bottom-20" data-text="✿ Evidence first · Approval always · Ship softly ✿" />
      <div className="absolute inset-0">
        {petals.map((petal) => (
          <span
            key={petal.id}
            className="ascii-petal pointer-events-auto"
            onPointerEnter={bloom}
            data-char={petal.char}
            style={{
              left: petal.left,
              animationDelay: petal.delay,
              animationDuration: petal.duration,
              fontSize: petal.size,
            }}
          />
        ))}
        {bursts.map((burst) => (
          <span
            key={burst.id}
            className="ascii-burst"
            data-text="✿ + * ✿"
            style={{ left: burst.x, top: burst.y }}
          />
        ))}
      </div>
    </div>
  );
}
