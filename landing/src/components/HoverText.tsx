"use client";

/**
 * Per-letter vertical slide-swap on hover, matching the Framer buttons
 * (the captured "GGEETT SSTTAARRTTEEDD" doubled-letter labels).
 * Each glyph has two stacked copies; on hover (of any ancestor button/link)
 * the pair slides up one line, staggered left-to-right. Driven by CSS in
 * globals.css (.ht-top / .ht-bot).
 */
export default function HoverText({
  text,
  className = "",
  stagger = 0.022,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const chars = [...text];
  return (
    <span className={`hovertext relative inline-flex ${className}`}>
      {chars.map((ch, i) => (
        <span key={i} className="relative inline-block overflow-hidden align-bottom">
          <span
            className="ht-top block whitespace-pre"
            style={{ transitionDelay: `${i * stagger}s` }}
          >
            {ch === " " ? " " : ch}
          </span>
          <span
            aria-hidden
            className="ht-bot absolute left-0 top-full block whitespace-pre"
            style={{ transitionDelay: `${i * stagger}s` }}
          >
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </span>
  );
}
