"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Kind = "minimize" | "isolate" | "proof" | "own";
const PINK = "#FF5CAB";
const pink = (a: number) => `rgba(255,182,214,${a})`;

export default function SecurityViz({ kind, className = "" }: { kind: Kind; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const vp = { trigger: el, start: "top 92%", end: "bottom 8%", toggleActions: "play pause resume pause" };
    const q = <T extends Element>(s: string) => gsap.utils.toArray<T>(el.querySelectorAll(s));

    const ctx = gsap.context(() => {
      q<SVGElement>("[data-float]").forEach((d, i) => {
        if (reduce) return;
        gsap.to(d, { x: i % 2 ? 4 : -4, y: i % 3 ? -3 : 3, duration: 2 + (i % 4) * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      if (reduce) {
        gsap.set("[data-ev],[data-rcpt],[data-mask],[data-row],[data-rc]", { opacity: 1 });
        return;
      }

      if (kind === "minimize") {
        q<SVGCircleElement>("[data-ev]").forEach((p, i) => {
          gsap.set(p, { attr: { cx: 66, cy: 75, r: 3.4 }, opacity: 0 });
          gsap.timeline({ repeat: -1, delay: i * 1.3, repeatDelay: 1.6, scrollTrigger: vp })
            .to(p, { opacity: 1, duration: 0.3 })
            .to(p, { attr: { cx: 182, cy: 75 + (i % 2 ? -6 : 6) }, duration: 1.0, ease: "power2.inOut" })
            .to(p, { attr: { r: 2.1 }, duration: 0.25 })
            .to(p, { attr: { cx: 270, cy: 75 }, duration: 1.0, ease: "power2.inOut" })
            .to({}, { duration: 0.3 })
            .to(p, { opacity: 0, duration: 0.35 });
        });
        q<SVGCircleElement>("[data-bl]").forEach((p, i) => {
          gsap.set(p, { attr: { cx: 62 + (i % 3) * 8, cy: 60 + i * 9, r: 2.6 }, opacity: 0 });
          gsap.timeline({ repeat: -1, delay: 0.8 + i * 0.8, repeatDelay: 1.0, scrollTrigger: vp })
            .to(p, { opacity: 0.7, duration: 0.3 })
            .to(p, { attr: { cx: 156, cy: 75 + (i % 2 ? 12 : -12) }, duration: 0.9, ease: "power2.inOut" })
            .to(p, { attr: { cx: 62 + (i % 3) * 8, cy: 60 + i * 9 }, duration: 1.1, ease: "power2.inOut" })
            .to(p, { opacity: 0, duration: 0.3 });
        });
        gsap.fromTo("[data-rcpt]", { opacity: 0.4 }, { opacity: 1, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1, scrollTrigger: vp });
      }

      if (kind === "isolate") {
        [0, 1, 2].forEach((i) => {
          const cx = 60 + i * 98;
          gsap.to(`[data-orbit="${i}"]`, { rotation: 360, svgOrigin: `${cx} 82`, duration: 9 + i * 2, ease: "none", repeat: -1 });
        });
        q<SVGCircleElement>("[data-probe]").forEach((p, i) => {
          const cx = 60 + i * 98;
          const wall = i < 2 ? cx + 46 : cx - 46;
          gsap.set(p, { attr: { cx, cy: 82 }, opacity: 0 });
          gsap.timeline({ repeat: -1, delay: i * 0.7, repeatDelay: 0.9, scrollTrigger: vp })
            .to(p, { opacity: 1, duration: 0.2 })
            .to(p, { attr: { cx: wall }, duration: 0.85, ease: "power2.in" })
            .to(el.querySelectorAll(`[data-wall="${i}"]`), { opacity: 0.95, duration: 0.16, yoyo: true, repeat: 1 }, "<0.65")
            .to(el.querySelectorAll(`[data-x="${i}"]`), { opacity: 1, duration: 0.16, yoyo: true, repeat: 1 }, "<")
            .to(p, { attr: { cx }, duration: 1.0, ease: "power2.out" })
            .to(p, { opacity: 0, duration: 0.2 });
        });
      }

      if (kind === "proof") {
        gsap.set("[data-rc]", { transformOrigin: "center", transformBox: "fill-box" });
        gsap.set('[data-row="0"],[data-row="1"],[data-row="2"]', { opacity: 0 });
        gsap.set("[data-src]", { opacity: 0.4 });
        const tl = gsap.timeline({ repeat: -1, scrollTrigger: vp });
        [0, 1, 2].forEach((n) => {
          tl.to("[data-src]", { opacity: 1, duration: 0.22, stagger: 0.12 })
            .fromTo("[data-flow]", { attr: { cx: 44, cy: 75 }, opacity: 0 }, { opacity: 1, duration: 0.2 }, "<")
            .to("[data-flow]", { attr: { cx: 150, cy: 75 }, duration: 0.7, ease: "power2.inOut" })
            .to("[data-model]", { attr: { r: 22 }, duration: 0.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<0.4")
            .to("[data-flow]", { opacity: 0, duration: 0.15 })
            .to("[data-src]", { opacity: 0.4, duration: 0.2 }, "<")
            .to(`[data-row="${n}"]`, { opacity: 1, duration: 0.25 })
            .fromTo(`[data-rc="${n}"]`, { scale: 0 }, { scale: 1, duration: 0.32, ease: "back.out(2)" }, "<")
            .to({}, { duration: 0.5 });
        });
        tl.to({}, { duration: 1.1 }).to('[data-row="0"],[data-row="1"],[data-row="2"]', { opacity: 0, duration: 0.4 });
      }

      if (kind === "own") {
        const masks = q<SVGRectElement>("[data-mask]");
        gsap.set(masks, { scaleX: 0, transformOrigin: "left center", transformBox: "fill-box" });
        gsap.set("[data-out]", { opacity: 0 });
        gsap.set("[data-lock]", { opacity: 0 });
        gsap.set("[data-shred]", { opacity: 0 });
        const C = 2 * Math.PI * 7;
        gsap.fromTo("[data-ret]", { strokeDashoffset: 0 }, { strokeDashoffset: C, duration: 3.4, ease: "none", repeat: -1, scrollTrigger: vp });
        gsap.to("[data-key]", { y: -3, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1, scrollTrigger: vp });

        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, scrollTrigger: vp });
        // permission-aware retrieval: allowed rows flow out, PII is denied
        tl.fromTo("[data-out]", { attr: { cx: 150 }, opacity: 0 }, { attr: { cx: 250 }, opacity: 1, duration: 0.85, stagger: 0.18, ease: "power1.in" })
          .to("[data-out]", { opacity: 0, duration: 0.2 })
          .to("[data-lock]", { opacity: 1, duration: 0.18, yoyo: true, repeat: 3 }, "<1.0")
          // redaction sweep over PII
          .to("[data-sweep]", { attr: { x: 214 }, duration: 1.3, ease: "sine.inOut" }, ">-0.3")
          .to(masks, { scaleX: 1, duration: 0.3, ease: "power2.out" }, "<0.25")
          .to({}, { duration: 0.5 })
          // shred-delete the bottom row
          .to("[data-delrow]", { opacity: 0.16, duration: 0.3 })
          .set("[data-shred]", { opacity: 1 }, "<")
          .to("[data-shred]", { x: () => gsap.utils.random(-16, 24), y: () => gsap.utils.random(-12, 12), opacity: 0, duration: 0.6, stagger: 0.03, ease: "power1.out" }, "<")
          .to({}, { duration: 0.45 })
          .set("[data-shred]", { x: 0, y: 0 })
          .set("[data-sweep]", { attr: { x: 46 } })
          .to(masks, { scaleX: 0, duration: 0.3 })
          .to("[data-delrow]", { opacity: 1, duration: 0.3 }, "<");
      }
    }, el);
    return () => ctx.revert();
  }, [kind]);

  return (
    <svg ref={ref} viewBox="0 0 320 150" className={className} fill="none">
      {kind === "minimize" && (
        <>
          <rect x="10" y="24" width="172" height="102" rx="10" stroke={pink(0.3)} strokeWidth="1.1" strokeDasharray="4 5" />
          <text x="20" y="42" fill={pink(0.6)} fontSize="9" fontFamily="var(--font-mono),monospace">Tenant</text>
          {[[52, 56], [80, 64], [48, 92], [86, 100], [64, 78], [40, 72]].map(([x, y], i) => (
            <circle key={i} data-float cx={x} cy={y} r="3" fill={pink(0.45)} />
          ))}
          <circle cx="66" cy="75" r="16" fill={PINK} opacity="0.14" />
          <circle cx="66" cy="75" r="11" fill={PINK} />
          <circle cx="66" cy="75" r="4" fill="#160a11" />
          <line x1="84" y1="75" x2="182" y2="75" stroke={pink(0.16)} />
          <line x1="182" y1="75" x2="256" y2="75" stroke={pink(0.16)} />
          {[0, 1, 2].map((i) => <circle key={`e${i}`} data-ev cx="66" cy="75" r="3.4" fill={PINK} />)}
          {[0, 1, 2].map((i) => <circle key={`b${i}`} data-bl cx="62" cy="60" r="2.6" fill="rgba(180,170,185,0.7)" />)}
          <path d="M182 60 L194 67 V86 C194 94 188 98 182 100 C176 98 170 94 170 86 V67 Z" fill="#161616" stroke={PINK} strokeWidth="1.2" />
          <path d="M176 76 l4 4 8 -9" stroke={PINK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="270" cy="75" r="14" fill="#1c1c1c" stroke={pink(0.6)} strokeWidth="1.2" />
          <text x="270" y="78" textAnchor="middle" fill={pink(0.85)} fontSize="8" fontFamily="var(--font-mono),monospace">Model</text>
          <text data-rcpt x="270" y="112" textAnchor="middle" fill={PINK} fontSize="9" fontFamily="var(--font-mono),monospace">✓ Receipt</text>
        </>
      )}

      {kind === "isolate" && (
        <>
          {[14, 112, 210].map((x, i) => {
            const cx = 60 + i * 98;
            return (
              <g key={i}>
                <rect data-wall={i} x={x} y="22" width="92" height="104" rx="10" stroke={PINK} strokeWidth="1.3" opacity="0.32" />
                <rect x={x + 8} y="30" width="13" height="10" rx="2" stroke={pink(0.55)} strokeWidth="1.1" />
                <path d={`M${x + 11} 30 v-2 a3.5 3.5 0 0 1 7 0 v2`} stroke={pink(0.55)} strokeWidth="1.1" fill="none" />
                <text x={x + 26} y="38" fill={pink(0.5)} fontSize="8" fontFamily="var(--font-mono),monospace">Tenant {String.fromCharCode(65 + i)}</text>
                <circle cx={cx} cy="82" r="5" fill={PINK} />
                <circle cx={cx} cy="82" r="2.2" fill="#160a11" />
                <g data-orbit={i}>
                  {[0, 1, 2, 3, 4].map((j) => {
                    const a = (j / 5) * Math.PI * 2;
                    return <circle key={j} cx={cx + Math.cos(a) * 17} cy={82 + Math.sin(a) * 17} r="2.2" fill={pink(0.6)} />;
                  })}
                </g>
                <circle data-probe={i} cx={cx} cy="82" r="3" fill={PINK} />
                <text data-x={i} x={i < 2 ? x + 80 : x + 12} y="120" fill={PINK} fontSize="9" opacity="0" fontFamily="var(--font-mono),monospace">✕</text>
              </g>
            );
          })}
        </>
      )}

      {kind === "proof" && (
        <>
          {/* question + retrieved sources */}
          <rect x="12" y="34" width="64" height="20" rx="10" stroke={pink(0.5)} strokeWidth="1.1" />
          <text x="44" y="48" textAnchor="middle" fill={pink(0.8)} fontSize="8.5" fontFamily="var(--font-mono),monospace">Question</text>
          {["SOC 2", "Policy", "Config"].map((s, i) => (
            <g key={s} data-src>
              <rect x="12" y={64 + i * 18} width="60" height="14" rx="4" fill="rgba(255,92,171,0.08)" stroke={pink(0.4)} strokeWidth="0.8" />
              <circle cx="20" cy={71 + i * 18} r="2" fill={PINK} />
              <text x="28" y={74 + i * 18} fill={pink(0.7)} fontSize="7.5" fontFamily="var(--font-mono),monospace">{s}</text>
            </g>
          ))}
          <line x1="76" y1="75" x2="132" y2="75" stroke={pink(0.14)} />
          <circle data-model cx="150" cy="75" r="18" fill="#1c1c1c" stroke={pink(0.6)} strokeWidth="1.2" />
          <text x="150" y="78" textAnchor="middle" fill={pink(0.85)} fontSize="8" fontFamily="var(--font-mono),monospace">Model</text>
          <circle data-flow cx="44" cy="75" r="3.2" fill={PINK} />
          <text x="252" y="36" textAnchor="middle" fill={pink(0.5)} fontSize="8" fontFamily="var(--font-mono),monospace">Audit log</text>
          {[0, 1, 2].map((n) => {
            const y = 44 + n * 33;
            const id = ["qc_1f93a4", "qc_7b20e5", "qc_3a9c1f"][n];
            return (
              <g key={n} data-row={n}>
                <rect x="188" y={y} width="124" height="28" rx="5" fill="#161616" stroke={pink(0.35)} strokeWidth="1" />
                <circle data-rc={n} cx="201" cy={y + 14} r="6" fill={PINK} />
                <path d={`M198 ${y + 14} l2 2 3.6 -4.6`} stroke="#160a11" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <text x="213" y={y + 11} fill={pink(0.85)} fontSize="8" fontFamily="var(--font-mono),monospace">{id}</text>
                <text x="213" y={y + 22} fill={pink(0.5)} fontSize="7" fontFamily="var(--font-mono),monospace">3 sources · grounded 0.96</text>
              </g>
            );
          })}
        </>
      )}

      {kind === "own" && (
        <>
          <rect x="10" y="22" width="246" height="106" rx="10" stroke={pink(0.3)} strokeWidth="1.1" />
          <text x="20" y="40" fill={pink(0.6)} fontSize="9" fontFamily="var(--font-mono),monospace">Your data</text>
          <g data-key transform="translate(268 28)">
            <circle cx="6" cy="6" r="6" stroke={PINK} strokeWidth="1.4" />
            <path d="M11 9 l9 9 m-3 0 l3 -3 m-6 0 l3 3" stroke={PINK} strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <circle cx="240" cy="58" r="7" stroke={pink(0.25)} strokeWidth="2" />
          <circle data-ret cx="240" cy="58" r="7" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeDasharray={2 * Math.PI * 7} transform="rotate(-90 240 58)" />
          {[
            { y: 56, cls: "PII", pii: true },
            { y: 80, cls: "Internal", pii: false },
            { y: 104, cls: "Public", pii: false, del: true },
          ].map((row, i) => (
            <g key={i} {...(row.del ? { "data-delrow": "" } : {})}>
              <rect x="22" y={row.y - 5} width="34" height="11" rx="3" fill={row.pii ? "rgba(255,92,171,0.25)" : "rgba(255,182,214,0.08)"} stroke={row.pii ? PINK : pink(0.35)} strokeWidth="0.8" />
              <text x="39" y={row.y + 3} textAnchor="middle" fill={pink(0.75)} fontSize="6.5" fontFamily="var(--font-mono),monospace">{row.cls}</text>
              <rect x="62" y={row.y - 4} width="44" height="8" rx="3" fill={pink(0.14)} />
              <rect x="112" y={row.y - 4} width="92" height="8" rx="3" fill={pink(0.1)} />
              {row.pii && <rect data-mask x="112" y={row.y - 4} width="92" height="8" rx="3" fill="rgba(120,110,125,0.65)" />}
              {row.pii && (
                <g data-lock transform={`translate(208 ${row.y - 5})`}>
                  <rect x="0" y="3" width="9" height="7" rx="1.5" stroke={PINK} strokeWidth="1" />
                  <path d="M2 3 V1.6 a2.5 2.5 0 0 1 5 0 V3" stroke={PINK} strokeWidth="1" fill="none" />
                </g>
              )}
              {!row.pii && <circle data-out cx="150" cy={row.y} r="2.6" fill={PINK} />}
              {row.del && [0, 1, 2, 3, 4, 5].map((s) => (
                <rect key={s} data-shred x={112 + s * 15} y={row.y - 4} width="13" height="8" rx="2" fill={pink(0.4)} />
              ))}
            </g>
          ))}
          <rect data-sweep x="46" y="48" width="3" height="64" rx="1.5" fill={PINK} opacity="0.85" />
          <text x="112" y="122" fill={pink(0.5)} fontSize="8" fontFamily="var(--font-mono),monospace">Permission-aware · redact · retain · delete</text>
        </>
      )}
    </svg>
  );
}
