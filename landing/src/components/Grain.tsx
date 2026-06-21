/**
 * Subtle film-grain / noise overlay across the whole page.
 * Fixed, non-interactive, blended for a premium printed texture.
 */
export default function Grain() {
  const noise =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.04] mix-blend-overlay"
      style={{ backgroundImage: `url("${noise}")`, backgroundSize: "160px 160px" }}
    />
  );
}
