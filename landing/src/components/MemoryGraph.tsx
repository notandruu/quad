"use client";

import { useEffect, useRef } from "react";

/**
 * Company-brain graph in the spirit of Obsidian's graph view.
 * ~85 memory nodes across knowledge clusters, force-directed on canvas:
 * degree-sized nodes, per-cluster pink-family hues, soft glow, drag-to-fling,
 * and hover-to-focus (the hovered node + its neighbors light up, the rest dims).
 */

const CLUSTERS: { name: string; hue: number; leaves: string[] }[] = [
  { name: "Security", hue: 330, leaves: ["SOC 2", "MFA", "Encryption at rest", "Encryption in transit", "Access reviews", "Pen test", "Vuln scans", "Key rotation", "SSO / SAML", "RBAC", "Audit logs", "Incident response"] },
  { name: "Compliance", hue: 320, leaves: ["GDPR", "ISO 27001", "SOC 2 report", "DPA register", "Data residency", "Retention policy", "Subprocessors", "Risk register"] },
  { name: "Support", hue: 345, leaves: ["Tickets", "Macros", "Support SLAs", "CSAT", "Escalations", "Knowledge base", "Refund policy", "Onboarding"] },
  { name: "Code", hue: 352, leaves: ["Repos", "Pull requests", "CI pipeline", "Secrets mgmt", "Service map", "On-call", "Service runbooks", "Postmortems"] },
  { name: "Infra", hue: 310, leaves: ["Cloud accounts", "Regions", "Backups", "DR plan", "Monitoring", "Infra config"] },
  { name: "Docs", hue: 338, leaves: ["Policies", "Wiki", "Handbook", "Decisions", "Specs", "Changelog"] },
  { name: "Sales", hue: 356, leaves: ["RFPs", "Trust center", "Prior Q&A", "Questionnaires", "Pricing", "MSAs", "DPAs", "Case studies"] },
  { name: "Product", hue: 316, leaves: ["Features", "Limits", "Status page", "Uptime", "Release notes", "Roadmap", "Beta flags"] },
  { name: "People", hue: 342, leaves: ["Org chart", "Access matrix", "Offboarding", "Background checks", "Training"] },
  { name: "Finance", hue: 326, leaves: ["Invoices", "Contracts", "Tax filings", "Revenue", "Forecasts"] },
];

const CROSS: [string, string][] = [
  ["SOC 2", "SOC 2 report"], ["SOC 2 report", "Trust center"], ["Questionnaires", "Trust center"],
  ["GDPR", "Data residency"], ["Data residency", "Regions"], ["DPA register", "Subprocessors"],
  ["Access reviews", "Access matrix"], ["Incident response", "Postmortems"], ["Status page", "Uptime"],
  ["Monitoring", "On-call"], ["Backups", "DR plan"], ["Pricing", "MSAs"], ["Roadmap", "Release notes"],
  ["Risk register", "Pen test"], ["Audit logs", "Access reviews"], ["Secrets mgmt", "Key rotation"],
  ["Onboarding", "Training"], ["Prior Q&A", "Knowledge base"], ["Questionnaires", "SOC 2 report"],
  ["DPAs", "DPA register"], ["Specs", "Roadmap"], ["Contracts", "MSAs"],
];

type N = {
  x: number; y: number; vx: number; vy: number;
  r: number; hue: number; type: "hub" | "anchor" | "leaf";
  label: string; deg: number;
};
type E = { a: number; b: number; l: number };

export default function MemoryGraph({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = cvsRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // ---- build graph ----
    const nodes: N[] = [];
    const edges: E[] = [];
    const idx: Record<string, number> = {};
    nodes.push({ x: 0, y: 0, vx: 0, vy: 0, r: 17, hue: 333, type: "hub", label: "company brain", deg: 0 });
    CLUSTERS.forEach((c) => {
      const ai = nodes.length;
      nodes.push({ x: 0, y: 0, vx: 0, vy: 0, r: 8, hue: c.hue, type: "anchor", label: c.name, deg: 0 });
      idx[c.name] = ai;
      edges.push({ a: 0, b: ai, l: 150 });
      c.leaves.forEach((l) => {
        const li = nodes.length;
        nodes.push({ x: 0, y: 0, vx: 0, vy: 0, r: 4, hue: c.hue, type: "leaf", label: l, deg: 0 });
        idx[l] = li;
        edges.push({ a: ai, b: li, l: 46 });
      });
    });
    CROSS.forEach(([a, b]) => {
      if (idx[a] != null && idx[b] != null) edges.push({ a: idx[a], b: idx[b], l: 120 });
    });

    const neighbors: Set<number>[] = nodes.map(() => new Set());
    edges.forEach((e) => {
      nodes[e.a].deg++; nodes[e.b].deg++;
      neighbors[e.a].add(e.b); neighbors[e.b].add(e.a);
    });
    nodes.forEach((n) => {
      if (n.type === "hub") n.r = 17;
      else if (n.type === "anchor") n.r = 7 + Math.min(6, n.deg) * 0.55;
      else n.r = 3.4 + Math.min(5, n.deg) * 0.7;
    });

    // ---- sizing ----
    let W = 0, H = 0, CX = 0, CY = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let seeded = false;
    const seed = () => {
      // hub at center; anchors in an ellipse; leaves scattered around anchors
      nodes[0].x = CX; nodes[0].y = CY;
      let ai = 1;
      CLUSTERS.forEach((c, ci) => {
        const ang = (ci / CLUSTERS.length) * Math.PI * 2;
        const ax = CX + Math.cos(ang) * W * 0.26;
        const ay = CY + Math.sin(ang) * H * 0.3;
        nodes[ai].x = ax; nodes[ai].y = ay;
        const a0 = ai; ai++;
        for (let k = 0; k < c.leaves.length; k++) {
          const a2 = Math.random() * Math.PI * 2;
          nodes[ai].x = ax + Math.cos(a2) * 50 * (0.5 + Math.random());
          nodes[ai].y = ay + Math.sin(a2) * 50 * (0.5 + Math.random());
          ai++;
        }
        void a0;
      });
      seeded = true;
    };
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      W = rect.width; H = rect.height; CX = W / 2; CY = H / 2;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded && W > 0) seed();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ---- interaction ----
    let mx = -1, my = -1, hover = -1, drag = -1;
    const pick = () => {
      let best = -1, bd = 16 * 16;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - mx, dy = nodes[i].y - my;
        const d = dx * dx + dy * dy;
        const rr = (nodes[i].r + 7) * (nodes[i].r + 7);
        if (d < rr && d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = e.clientX - rect.left; my = e.clientY - rect.top;
    };
    const onMove = (e: PointerEvent) => { toLocal(e); hover = drag >= 0 ? drag : pick(); };
    const onDown = (e: PointerEvent) => { toLocal(e); const p = pick(); if (p > 0) { drag = p; canvas.setPointerCapture(e.pointerId); } };
    const onUp = () => { drag = -1; };
    const onLeave = () => { mx = -1; my = -1; hover = -1; };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    // ---- physics ----
    const step = () => {
      const REP = 820, DAMP = 0.9, GRAV = 0.012;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        let fx = (CX - a.x) * GRAV * (a.type === "leaf" ? 0.4 : 1);
        let fy = (CY - a.y) * GRAV * (a.type === "leaf" ? 0.4 : 1);
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = REP / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f; fy += (dy / d) * f;
        }
        a.vx = (a.vx + fx) * DAMP;
        a.vy = (a.vy + fy) * DAMP;
      }
      for (const e of edges) {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const k = ((d - e.l) / d) * 0.02;
        a.vx += dx * k; a.vy += dy * k;
        b.vx -= dx * k; b.vy -= dy * k;
      }
      const pad = 14;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (i === 0) { n.x = CX; n.y = CY; n.vx = 0; n.vy = 0; continue; }
        if (i === drag) { n.x = mx; n.y = my; n.vx = 0; n.vy = 0; continue; }
        // gentle perpetual wander
        n.vx += Math.sin(t * 0.6 + i) * 0.02;
        n.vy += Math.cos(t * 0.5 + i * 1.3) * 0.02;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 6) { n.vx *= 6 / sp; n.vy *= 6 / sp; }
        n.x = Math.max(pad, Math.min(W - pad, n.x + n.vx));
        n.y = Math.max(pad, Math.min(H - pad, n.y + n.vy));
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // ambient center glow
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.55);
      g.addColorStop(0, "rgba(255,92,171,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const hov = hover >= 0;
      const lit = (i: number) => !hov || i === hover || neighbors[hover].has(i);

      // edges
      for (const e of edges) {
        const on = !hov || e.a === hover || e.b === hover;
        ctx.strokeStyle = `hsla(${nodes[e.a].hue}, 75%, 66%, ${on ? (hov ? 0.55 : 0.13) : 0.03})`;
        ctx.lineWidth = on && hov ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
        ctx.stroke();
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const L = lit(i);
        ctx.globalAlpha = L ? 1 : 0.12;
        const glow = n.type !== "leaf" || (hov && L);
        ctx.shadowBlur = glow ? n.r * 1.7 : 0;
        ctx.shadowColor = `hsl(${n.hue}, 90%, 62%)`;
        ctx.fillStyle =
          n.type === "hub" ? "#FF5CAB"
            : `hsl(${n.hue}, ${n.type === "anchor" ? 88 : 74}%, ${n.type === "anchor" ? 65 : 60}%)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        if (n.type === "hub") {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#1a0b14";
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const showLeaf = hov && lit(i);
        if (n.type === "leaf" && !showLeaf) continue;
        const L = lit(i);
        ctx.globalAlpha = L ? 0.95 : 0.1;
        ctx.fillStyle = n.type === "hub" ? "rgba(255,255,255,0.95)" : "rgba(243,239,243,0.92)";
        ctx.font = `${n.type === "hub" ? 12 : n.type === "anchor" ? 11 : 10}px var(--font-mono), ui-monospace, monospace`;
        ctx.fillText(n.label, n.x, n.y + n.r + 4);
      }
      ctx.globalAlpha = 1;
      canvas.style.cursor = hover > 0 ? (drag >= 0 ? "grabbing" : "grab") : "default";
    };

    let t = 0;
    let raf = 0;
    let running = false;
    const loop = () => {
      t += 0.016;
      step();
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    if (reduce) {
      for (let k = 0; k < 500; k++) step();
      draw();
    } else {
      const io = new IntersectionObserver(
        (ents) => { ents.forEach((e) => (e.isIntersecting ? start() : stop())); },
        { threshold: 0 },
      );
      io.observe(wrap);
      return () => {
        io.disconnect(); stop(); ro.disconnect();
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointerleave", onLeave);
      };
    }

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={cvsRef} className="block h-full w-full" />
    </div>
  );
}
