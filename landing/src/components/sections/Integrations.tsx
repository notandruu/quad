"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const CHAMFER =
  "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

const TOP: [string, string][] = [
  ["github", "GitHub"],
  ["salesforce", "Salesforce"],
  ["googlecloud", "Google Cloud"],
  ["snowflake", "Snowflake"],
  ["slack", "Slack"],
  ["notion", "Notion"],
  ["hubspot", "HubSpot"],
  ["zendesk", "Zendesk"],
];

const BOTTOM: [string, string][] = [
  ["amazonwebservices", "AWS"],
  ["dropbox", "Dropbox"],
  ["jira", "Jira"],
  ["linear", "Linear"],
  ["oracle", "Oracle"],
  ["databricks", "Databricks"],
  ["intercom", "Intercom"],
  ["gitlab", "GitLab"],
];

function Cell({ logo }: { logo: [string, string] }) {
  const [k, name] = logo;
  return (
    <div className="group flex h-[118px] flex-col items-center justify-center gap-2.5 bg-paper transition-colors duration-200 hover:bg-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/logos/${k}.svg`}
        alt={name}
        className="h-7 w-auto opacity-90 transition duration-300 group-hover:-translate-y-0.5 group-hover:opacity-100"
      />
      <span className="font-mono text-[11px] tracking-[0.02em] text-ink/55 transition-colors group-hover:text-ink">
        {name}
      </span>
    </div>
  );
}

export default function Integrations() {
  return (
    <Panel
      id="integrations"
      label="Integrations"
      desc="Quad reads from and acts in the systems your company already runs on. Retrieve evidence, trigger workflows, and ship updates in place."
      title="Connect to everything your company runs on"
    >
      <div className="mt-9 overflow-hidden rounded-xl border border-ink/12">
        <Reveal stagger className="grid grid-cols-2 gap-px bg-ink/[0.07] sm:grid-cols-4">
          {TOP.map((l) => (
            <Cell key={l[0]} logo={l} />
          ))}
        </Reveal>

        {/* centered title band */}
        <div className="flex flex-col items-center gap-5 border-y border-ink/[0.07] bg-paper px-6 py-12 text-center">
          <h3 className="serif text-[30px] leading-none text-ink md:text-[36px]">Connect anything</h3>
          <button
            className="border border-ink/20 px-6 py-3 text-[12px] font-medium uppercase tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-paper"
            style={{ clipPath: CHAMFER }}
          >
            Explore integrations
          </button>
        </div>

        <Reveal stagger className="grid grid-cols-2 gap-px bg-ink/[0.07] sm:grid-cols-4">
          {BOTTOM.map((l) => (
            <Cell key={l[0]} logo={l} />
          ))}
        </Reveal>

        <div className="border-t border-ink/[0.07] bg-paper py-4 text-center font-mono text-[12px] uppercase tracking-[0.08em] text-ink/45">
          connectors install through the registry · and 150+ more
        </div>
      </div>
    </Panel>
  );
}
