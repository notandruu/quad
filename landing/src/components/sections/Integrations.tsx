"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const LOGOS: [string, string][] = [
  ["github", "GitHub"],
  ["salesforce", "Salesforce"],
  ["googlecloud", "Google Cloud"],
  ["snowflake", "Snowflake"],
  ["slack", "Slack"],
  ["notion", "Notion"],
  ["hubspot", "HubSpot"],
  ["zendesk", "Zendesk"],
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
    <div className="flex h-[118px] flex-col items-center justify-center gap-2.5 bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/assets/logos/${k}.svg`} alt={name} className="h-7 w-auto" />
      <span className="font-mono text-[11px] tracking-[0.02em] text-ink/55">{name}</span>
    </div>
  );
}

export default function Integrations() {
  return (
    <Panel
      id="integrations"
      label="Integrations"
      desc="Quad reads from and acts in the systems your company already runs on. Retrieve evidence, trigger workflows, and ship updates in place."
      title="Works with your stack"
    >
      <div className="mt-9 overflow-hidden rounded-xl border border-ink/12">
        <Reveal stagger className="grid grid-cols-2 gap-px bg-ink/[0.07] sm:grid-cols-4">
          {LOGOS.map((l) => (
            <Cell key={l[0]} logo={l} />
          ))}
        </Reveal>
        <div className="border-t border-ink/[0.07] bg-paper py-4 text-center font-mono text-[12px] uppercase tracking-[0.08em] text-ink/45">
          Connectors install through the registry · and 150+ more
        </div>
      </div>
    </Panel>
  );
}
