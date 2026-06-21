"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Panel from "@/components/Panel";

const CATEGORIES = [
  "Helpdesk & Support",
  "CRM & Revenue",
  "Docs & Knowledge",
  "Code & Infra",
];

const TOOLS_BY_CAT = [
  [
    { name: "Zendesk", desc: "Ticket ingestion and write-back", logo: 2 },
    { name: "Intercom", desc: "Live conversation capture", logo: 0 },
    { name: "Freshdesk", desc: "Helpdesk webhook connector", logo: 1 },
    { name: "Help Scout", desc: "Inbound queue aggregation", logo: 5 },
    { name: "Front", desc: "Shared inbox orchestration", logo: 3 },
    { name: "Gorgias", desc: "Commerce support automation", logo: 4 },
  ],
  [
    { name: "Salesforce", desc: "CRM record read and write", logo: 3 },
    { name: "HubSpot", desc: "Pipeline and contact sync", logo: 0 },
    { name: "Pipedrive", desc: "Deal-stage automation", logo: 2 },
    { name: "Close", desc: "Revenue activity tracking", logo: 1 },
    { name: "Attio", desc: "Relationship graph context", logo: 5 },
    { name: "Outreach", desc: "Sequence and reply context", logo: 4 },
  ],
  [
    { name: "Notion", desc: "Workspace and wiki ingestion", logo: 1 },
    { name: "Confluence", desc: "Technical docs integration", logo: 2 },
    { name: "Google Drive", desc: "Secure document ingestion", logo: 4 },
    { name: "SharePoint", desc: "Enterprise file sync", logo: 0 },
    { name: "Slab", desc: "Internal knowledge base", logo: 5 },
    { name: "Guru", desc: "Verified card retrieval", logo: 3 },
  ],
  [
    { name: "GitHub", desc: "Repository and PR context", logo: 3 },
    { name: "GitLab", desc: "Pipeline and MR evidence", logo: 0 },
    { name: "Jira", desc: "Issue tracking and updates", logo: 2 },
    { name: "Linear", desc: "Project and cycle context", logo: 1 },
    { name: "Datadog", desc: "Infra config and alerts", logo: 4 },
    { name: "AWS", desc: "Access reviews and configs", logo: 5 },
  ],
];

function ToolLogo({ i }: { i: number }) {
  const c = "#3a3733";
  return (
    <svg width="46" height="30" viewBox="0 0 46 30" fill="none">
      {i === 0 && (
        <g fill={c}>
          <rect x="6" y="9" width="11" height="13" rx="2" transform="skewX(-12)" />
          <rect x="20" y="9" width="5" height="13" rx="1.5" />
        </g>
      )}
      {i === 1 && (
        <g fill={c}>
          <circle cx="12" cy="11" r="5" />
          <rect x="19" y="6" width="9" height="9" rx="2" />
          <circle cx="12" cy="22" r="5" />
          <rect x="19" y="17" width="9" height="9" rx="2" />
          <path d="M19 11h-2M24 15v2" stroke="#FAFBF6" strokeWidth="2" />
        </g>
      )}
      {i === 2 && (
        <text x="0" y="20" fontFamily="var(--font-geist)" fontWeight="700" fontSize="15" fill={c}>
          Logo<tspan fill="#E63E96">!</tspan>
        </text>
      )}
      {i === 3 && (
        <g>
          <circle cx="11" cy="15" r="8" fill="none" stroke={c} strokeWidth="1.4" />
          <line x1="11" y1="7" x2="11" y2="23" stroke={c} strokeWidth="1" />
          <line x1="3" y1="15" x2="19" y2="15" stroke={c} strokeWidth="1" />
          <text x="22" y="19" fontFamily="var(--font-geist)" fontSize="11" fill={c}>logo</text>
        </g>
      )}
      {i === 4 && (
        <g stroke={c} strokeWidth="1.6" fill="none">
          <path d="M8 20c0-6 5-10 10-8 4 1 5 6 1 8-3 1-6-1-5-4" />
          <path d="M14 20c0-4 3-6 6-5" />
        </g>
      )}
      {i === 5 && (
        <g fill={c}>
          <path d="M8 13l8-4 8 4-8 4z" />
          <path d="M8 18l8 4 8-4" fill="none" stroke={c} strokeWidth="1.6" />
        </g>
      )}
    </svg>
  );
}

const CYCLE_MS = 4200;

export default function Integrations() {
  const [cat, setCat] = useState(0);
  const paused = useRef(false);

  // auto-cycle categories (pauses on hover)
  useEffect(() => {
    const id = setInterval(() => {
      if (!paused.current) setCat((c) => (c + 1) % CATEGORIES.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const tools = TOOLS_BY_CAT[cat];

  return (
    <Panel
      id="integrations"
      label="Integrations"
      desc="Quad reads from and acts in the systems your company already runs on. Retrieve evidence, trigger workflows, and ship updates in place."
      title="Connect to everything your company runs on"
    >
      <div
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/15 bg-ink/15 lg:grid-cols-[260px_1fr]"
      >
        {/* category rail */}
        <div className="flex flex-col bg-paper p-6">
          <div className="flex-1">
            {CATEGORIES.map((c, i) => (
              <button
                key={c}
                onClick={() => setCat(i)}
                className="relative flex w-full items-center justify-between border-b border-ink/12 py-4 text-left"
              >
                <span
                  className={`text-[13px] font-medium uppercase tracking-[0.06em] transition-colors ${
                    cat === i ? "text-ink" : "text-ink/45 hover:text-ink/70"
                  }`}
                >
                  {c}
                </span>
                <span
                  className={`h-2 w-2 rounded-full transition-colors ${
                    cat === i ? "bg-flame" : "border border-ink/25"
                  }`}
                />
                {/* progress underline that fills over the cycle */}
                {cat === i && (
                  <motion.span
                    key={`p${i}-${cat}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: CYCLE_MS / 1000, ease: "linear" }}
                    style={{ transformOrigin: "left" }}
                    className="absolute bottom-0 left-0 h-px w-full bg-flame"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between rounded-md border border-ink/12 px-3 py-2.5">
            <span className="text-[12px] text-ink-soft">Secured by default</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#111111" strokeWidth="1.3">
              <path d="M8 1l6 2.5v4C14 11 11 13.5 8 14.5 5 13.5 2 11 2 7.5v-4z" />
              <path d="M5.5 8l1.8 1.8L11 6" />
            </svg>
          </div>
        </div>

        {/* tool grid — crossfades + restaggers on category change */}
        <div className="grid grid-cols-1 gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tools.map((t, i) => (
              <motion.div
                key={`${cat}-${t.name}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                className="flex min-h-[220px] flex-col justify-between bg-paper p-6 transition-colors duration-200 hover:bg-cream"
              >
                <ToolLogo i={t.logo} />
                <div>
                  <h4 className="text-[14px] font-medium uppercase tracking-[0.04em] text-ink">
                    {t.name}
                  </h4>
                  <p className="mt-1 text-[13px] text-ink-soft">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-5 text-center font-mono text-[12px] uppercase tracking-[0.08em] text-ink/45">
        and 150+ more
      </p>
    </Panel>
  );
}
