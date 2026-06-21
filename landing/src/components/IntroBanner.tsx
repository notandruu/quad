"use client";

import { useEffect, useRef } from "react";

/**
 * Bespoke cinematic banner for the Intro section (replaces the old stock clip).
 * A flow-field current of "company knowledge" streams left-to-right and emerges
 * brighter / verified (pink -> white sparks) on the right. Canvas, trailed,
 * reduced-motion aware, paused when offscreen.
 */
export default function IntroBanner({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = cvsRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const BG = "#121212";

    let W = 0, H = 0;
    type P = { x: number; y: number; px: number; py: number; sp: number; b: number; size: number };
    let parts: P[] = [];

    const spawn = (anywhere: boolean): P => ({
      x: anywhere ? Math.random() * W : -8 - Math.random() * 40,
      y: Math.random() * H,
      px: 0, py: 0,
      sp: 0.45 + Math.random() * 1.0,
      b: Math.random(),
      size: 0.5 + Math.random() * 1.4,
    });
    // cheap layered-sine flow field
    const field = (x: number, y: number, t: number) =>
      Math.sin(x * 0.0075 + t * 0.00045) * 1.1 +
      Math.cos(y * 0.013 - t * 0.0004) * 0.9 +
      Math.sin((x + y) * 0.006 + t * 0.0006) * 0.5;

    const init = () => { parts = Array.from({ length: Math.min(560, Math.floor(W / 2.6)) }, () => spawn(true)); };
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      init();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let t = 0;
    const step = () => {
      t += 16;
      // trail: fade previous frame toward bg (long motion-blur streaks)
      ctx.fillStyle = "rgba(18,18,18,0.085)";
      ctx.fillRect(0, 0, W, H);
      for (const p of parts) {
        p.px = p.x; p.py = p.y;
        const a = field(p.x, p.y, t);
        p.x += p.sp * 1.8 + Math.cos(a) * 0.5;
        p.y += Math.sin(a) * 1.0;
        if (p.x > W + 8 || p.y < -8 || p.y > H + 8) { Object.assign(p, spawn(false)); continue; }
        const prog = p.x / W; // 0 (raw, left) -> 1 (verified, right)
        const alpha = 0.2 + 0.62 * p.b * (0.4 + prog);
        const lw = p.size * (0.8 + prog * 1.1);
        let col: string;
        if (prog > 0.76 && p.b > 0.62) col = `rgba(255,255,255,${Math.min(0.96, alpha + 0.22)})`; // verified spark
        else col = `rgba(255,${92 + Math.floor(72 * prog)},${171 + Math.floor(46 * prog)},${alpha})`;
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };

    const staticFrame = () => {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) step();
    };

    let raf = 0, running = false;
    const loop = () => { step(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    let io: IntersectionObserver | null = null;
    if (reduce) staticFrame();
    else {
      io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0 });
      io.observe(wrap);
    }

    return () => { io?.disconnect(); stop(); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ background: "#121212" }}>
      <canvas ref={cvsRef} className="block h-full w-full" />
    </div>
  );
}
