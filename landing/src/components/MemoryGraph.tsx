"use client";

import { useEffect, useRef } from "react";

/**
 * Company brain as a rotating 3D memory sphere (Obsidian map energy).
 * Dense clustered nodes + uniform field nodes fill a sphere shell; prominent
 * nodes carry tags/labels that fade by depth so only the front face reads.
 * Canvas + batched edges so it stays smooth with ~650 nodes.
 */

const CLUSTERS = [
  { name: "Security", hue: 330, tags: ["SOC 2", "MFA", "Encryption", "Access reviews", "Pen test"] },
  { name: "Compliance", hue: 320, tags: ["GDPR", "ISO 27001", "SOC 2 report", "DPA register", "Data residency"] },
  { name: "Support", hue: 345, tags: ["Tickets", "Macros", "SLAs", "Escalations", "Refunds"] },
  { name: "Code", hue: 352, tags: ["Repos", "Pull requests", "CI", "Secrets", "On-call"] },
  { name: "Infra", hue: 310, tags: ["Cloud", "Regions", "Backups", "DR plan", "Monitoring"] },
  { name: "Docs", hue: 338, tags: ["Policies", "Wiki", "Handbook", "Decisions", "Specs"] },
  { name: "Sales", hue: 356, tags: ["RFPs", "Trust center", "Prior Q&A", "Pricing", "MSAs"] },
  { name: "Product", hue: 316, tags: ["Features", "Status page", "Uptime", "Roadmap", "Releases"] },
  { name: "People", hue: 342, tags: ["Org chart", "Access matrix", "Offboarding", "Training", "Roles"] },
  { name: "Finance", hue: 326, tags: ["Invoices", "Contracts", "Revenue", "Forecasts", "Budgets"] },
  { name: "Legal", hue: 300, tags: ["NDAs", "Terms", "Privacy", "IP", "Disputes"] },
  { name: "Data", hue: 334, tags: ["Schemas", "Pipelines", "Lineage", "PII map", "Catalog"] },
  { name: "Ops", hue: 306, tags: ["Vendors", "Procurement", "Assets", "Incidents", "Runbooks"] },
  { name: "Marketing", hue: 348, tags: ["Website", "Blog", "Claims", "Brand", "SEO"] },
];

const PER = 32; // cluster nodes
const FIELD = 170; // uniform fill nodes

type Node = { bx: number; by: number; bz: number; r: number; hue: number; light: number; lab: string | null; hub: boolean };

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

    let W = 0, H = 0, CX = 0, CY = 0, R = 1, persp = 1;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const nodes: Node[] = [];
    const edges: [number, number][] = [];
    const norm = (v: number[]) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
    const golden = Math.PI * (3 - Math.sqrt(5));

    // clustered nodes
    CLUSTERS.forEach((c, ci) => {
      const yy = 1 - (ci / (CLUSTERS.length - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = ci * golden;
      const center = [Math.cos(th) * rad, yy, Math.sin(th) * rad];
      const up = Math.abs(center[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = norm([center[1] * up[2] - center[2] * up[1], center[2] * up[0] - center[0] * up[2], center[0] * up[1] - center[1] * up[0]]);
      const w = norm([center[1] * u[2] - center[2] * u[1], center[2] * u[0] - center[0] * u[2], center[0] * u[1] - center[1] * u[0]]);
      const base = nodes.length;
      nodes.push({ bx: center[0], by: center[1], bz: center[2], r: 4, hue: c.hue, light: 72, lab: c.name, hub: true });
      for (let k = 0; k < PER; k++) {
        const sp = 0.5;
        const g1 = ((Math.random() - 0.5) + (Math.random() - 0.5)) * sp;
        const g2 = ((Math.random() - 0.5) + (Math.random() - 0.5)) * sp;
        const dir = norm([center[0] + u[0] * g1 + w[0] * g2, center[1] + u[1] * g1 + w[1] * g2, center[2] + u[2] * g1 + w[2] * g2]);
        const named = k < c.tags.length;
        const shell = 0.9 + Math.random() * 0.12;
        nodes.push({
          bx: dir[0] * shell, by: dir[1] * shell, bz: dir[2] * shell,
          r: named ? 2.3 : 1.0 + Math.random() * 1.1,
          hue: c.hue, light: named ? 64 : 52 + Math.random() * 12,
          lab: named ? c.tags[k] : null, hub: false,
        });
        edges.push([base + 1 + k, k % 4 === 0 ? base : base + 1 + Math.floor(Math.random() * (k + 1))]);
      }
    });
    // cross-cluster hub ring
    let hubIdx: number[] = [];
    let acc = 0;
    CLUSTERS.forEach(() => { hubIdx.push(acc); acc += PER + 1; });
    for (let i = 0; i < hubIdx.length; i++) edges.push([hubIdx[i], hubIdx[(i + 1) % hubIdx.length]]);

    // uniform field nodes (fill the sphere)
    for (let i = 0; i < FIELD; i++) {
      const yy = 1 - (i / (FIELD - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th = i * golden;
      const shell = 0.95 + Math.random() * 0.08;
      nodes.push({
        bx: Math.cos(th) * rad * shell, by: yy * shell, bz: Math.sin(th) * rad * shell,
        r: 0.8 + Math.random() * 0.8, hue: CLUSTERS[i % CLUSTERS.length].hue, light: 48 + Math.random() * 10, lab: null, hub: false,
      });
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      W = rect.width; H = rect.height; CX = W / 2; CY = H / 2;
      R = Math.min(W, H) * 0.47; persp = R * 2.6;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let angleY = 0.5, tilt = 0.42, drag = false, lx = 0, ly = 0, vY = 0;
    const onDown = (e: PointerEvent) => { drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      vY = (e.clientX - lx) * 0.006; angleY += vY;
      tilt = Math.max(-1.2, Math.min(1.2, tilt + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY;
    };
    const onUp = () => { drag = false; };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);

    const N = nodes.length;
    const order = nodes.map((_, i) => i);
    const sx = new Float32Array(N), sy = new Float32Array(N), ss = new Float32Array(N), sa = new Float32Array(N), sz = new Float32Array(N);

    const frame = () => {
      if (!drag) { angleY += 0.0022 + vY; vY *= 0.94; }
      const ca = Math.cos(angleY), sA = Math.sin(angleY), ct = Math.cos(tilt), st = Math.sin(tilt);
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        const x1 = n.bx * ca + n.bz * sA;
        const z1 = -n.bx * sA + n.bz * ca;
        const y2 = n.by * ct - z1 * st;
        const z2 = n.by * st + z1 * ct;
        const zr = z2 * R;
        const s = persp / (persp + zr);
        sx[i] = CX + x1 * R * s; sy[i] = CY + y2 * R * s; ss[i] = s; sz[i] = zr;
        sa[i] = 0.22 + 0.78 * ((R - zr) / (2 * R));
      }

      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 1.2);
      g.addColorStop(0, "rgba(255,92,171,0.06)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,150,200,0.045)"; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let e = 0; e < edges.length; e++) { const a = edges[e][0], b = edges[e][1]; ctx.moveTo(sx[a], sy[a]); ctx.lineTo(sx[b], sy[b]); }
      ctx.stroke();

      order.sort((a, b) => sz[b] - sz[a]);
      for (let o = 0; o < N; o++) {
        const i = order[o]; const n = nodes[i];
        ctx.globalAlpha = sa[i];
        ctx.fillStyle = `hsl(${n.hue}, 78%, ${n.light}%)`;
        ctx.beginPath(); ctx.arc(sx[i], sy[i], Math.max(0.4, n.r * ss[i]), 0, Math.PI * 2); ctx.fill();
      }

      // labels (front-facing prominent nodes only)
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      let drawn = 0;
      for (let o = N - 1; o >= 0 && drawn < 48; o--) {
        const i = order[o]; const n = nodes[i];
        if (!n.lab || sa[i] < 0.72) continue;
        ctx.globalAlpha = Math.min(1, (sa[i] - 0.6) * 2.4);
        ctx.fillStyle = n.hub ? "rgba(255,255,255,0.92)" : "rgba(243,239,243,0.7)";
        ctx.font = `${n.hub ? 10 : 8.5}px var(--font-mono), ui-monospace, monospace`;
        ctx.fillText(n.lab, sx[i], sy[i] + n.r * ss[i] + 3);
        drawn++;
      }
      ctx.globalAlpha = 1;
      canvas.style.cursor = drag ? "grabbing" : "grab";
    };

    let raf = 0, running = false;
    const loop = () => { frame(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    let io: IntersectionObserver | null = null;
    if (reduce) frame();
    else { io = new IntersectionObserver((ents) => ents.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0 }); io.observe(wrap); }

    return () => {
      io?.disconnect(); stop(); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={cvsRef} className="block h-full w-full" />
    </div>
  );
}
