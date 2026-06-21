#!/usr/bin/env tsx
import { config } from "dotenv";
import { hostname } from "node:os";
import { resolve } from "node:path";
import { recordWorkerHeartbeat } from "../src/lib/jobs/queue";
import { processNextJob } from "../src/lib/jobs/worker";

config({ path: resolve(process.cwd(), ".env.local") });

const once = process.argv.includes("--once");
const intervalMs = Number.parseInt(process.env.QUAD_WORKER_POLL_MS ?? "2000", 10);
const startedAt = new Date().toISOString();
const workerId = process.env.QUAD_WORKER_ID ?? `${hostname()}:${process.pid}`;
let processed = 0;

async function tick() {
  await recordWorkerHeartbeat({ workerId, startedAt, processed });
  const result = await processNextJob();
  if (result.processed && result.job) {
    processed += 1;
    await recordWorkerHeartbeat({ workerId, startedAt, processed });
    console.log(`[worker] processed ${result.job.id} (${result.job.type}) -> ${result.job.status}`);
  } else if (once) {
    console.log("[worker] no queued job");
  }
}

async function main() {
  console.log(`[worker] quad worker started${once ? " (once)" : ""} as ${workerId}`);
  do {
    await tick().catch((error) => {
      console.error("[worker] tick failed", error);
      process.exitCode = 1;
    });
    if (once) break;
    await new Promise((resolveTick) => setTimeout(resolveTick, intervalMs));
  } while (true);
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
