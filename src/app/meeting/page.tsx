import Link from "next/link";
import { MeetingPanel } from "@/components/MeetingPanel";

export default function MeetingPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">quad meeting agent</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink">send quad into a live google meet</h1>
          </div>
          <Link
            href="/app"
            className="rounded border border-edge bg-panel px-3 py-2 text-xs font-semibold text-accent transition-colors hover:border-accent/50 hover:bg-panel-strong"
          >
            back to dashboard
          </Link>
        </header>

        <section className="rounded border border-edge bg-panel p-4 shadow-sm">
          <MeetingPanel />
        </section>
      </div>
    </main>
  );
}
