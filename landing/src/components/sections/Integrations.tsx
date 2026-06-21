"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import IntegrationsOrbit from "@/components/IntegrationsOrbit";

export default function Integrations() {
  return (
    <Panel
      id="integrations"
      label="Integrations"
      desc="Quad reads from and acts in the systems your company already runs on. Retrieve evidence, trigger workflows, and ship updates in place."
      title="Connect to everything your company runs on"
    >
      <Reveal className="mt-9">
        <div className="overflow-hidden rounded-xl border border-ink/12 bg-ink">
          <IntegrationsOrbit className="h-auto w-full" />
        </div>
      </Reveal>
      <p className="mt-5 text-center font-mono text-[12px] uppercase tracking-[0.08em] text-ink/45">
        connectors install through the registry · and 150+ more
      </p>
    </Panel>
  );
}
