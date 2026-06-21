#!/usr/bin/env node
/**
 * End-to-end smoke test against the running app.
 *
 * Usage:
 *   BASE_URL=http://localhost:3001 npm run e2e
 *
 * Exit code 0 if all steps pass, 1 if any fail.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const ORG_ID = 'org_brightpath';

let allPassed = true;
const runId = `e2e_${Date.now()}`;

function pass(step, detail) {
  console.log(`  PASS  ${step}${detail ? `  — ${detail}` : ''}`);
}

function fail(step, detail) {
  allPassed = false;
  console.log(`  FAIL  ${step}${detail ? `  — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Step 1: GET /api/settings
// ---------------------------------------------------------------------------
async function step1() {
  try {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const backends = json.backends ?? json;
    const live = Object.entries(backends)
      .filter(([, v]) => v === true || v?.ok === true || v?.configured === true)
      .map(([k]) => k);
    pass('GET /api/settings', `live backends: [${live.join(', ') || 'none — fallback mode'}]`);
  } catch (e) {
    fail('GET /api/settings', e.message);
  }
}

// ---------------------------------------------------------------------------
// Step 2: POST /api/ingest
// ---------------------------------------------------------------------------
async function step2() {
  try {
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: ORG_ID,
        title: 'e2e test doc',
        content: 'This is an automated end-to-end test document.',
        entities: ['e2e', 'test'],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(`ok=false: ${JSON.stringify(json)}`);
    pass('POST /api/ingest', `id=${json.id ?? '(no id)'}`);
  } catch (e) {
    fail('POST /api/ingest', e.message);
  }
}

// ---------------------------------------------------------------------------
// Step 3: POST /api/audit/stream  (SSE)
// ---------------------------------------------------------------------------
let auditRunId = runId;
async function step3() {
  try {
    const res = await fetch(`${BASE_URL}/api/audit/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: ORG_ID,
        runId: auditRunId,
        targetUrl: 'https://example.com',
        limit: 1,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Consume the SSE stream.
    const eventTypes = [];
    let findingCount = 0;
    let reportReceived = false;

    const text = await res.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        eventTypes.push(event.type);
        if (event.type === 'finding.created') findingCount++;
        if (event.type === 'audit.report') {
          reportReceived = true;
          // Capture the actual runId from the report if provided
          if (event.report?.runId) auditRunId = event.report.runId;
          if (event.runId) auditRunId = event.runId;
        }
        if (event.type === 'run.created' && event.runId) auditRunId = event.runId;
      } catch {
        // ignore malformed lines
      }
    }

    if (!reportReceived) throw new Error('audit.report event never received');
    pass(
      'POST /api/audit/stream',
      `events=[${[...new Set(eventTypes)].join(', ')}]  findings=${findingCount}`
    );
  } catch (e) {
    fail('POST /api/audit/stream', e.message);
  }
}

// ---------------------------------------------------------------------------
// Step 4: POST /api/chat
// ---------------------------------------------------------------------------
async function step4() {
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'What did the audit find?',
        runId: auditRunId,
        orgId: ORG_ID,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const intent = json.intent ?? '(none)';
    const message = (json.message ?? json.text ?? '').slice(0, 200);
    pass('POST /api/chat', `intent=${intent}  msg=${message || '(empty)'}`);
  } catch (e) {
    fail('POST /api/chat', e.message);
  }
}

// ---------------------------------------------------------------------------
// Step 5: GET /api/audit/events/:runId  (redis only)
// ---------------------------------------------------------------------------
async function step5() {
  const redisConfigured =
    process.env.QUAD_REDIS_REST_URL && process.env.QUAD_REDIS_REST_TOKEN;
  if (!redisConfigured) {
    console.log(`  SKIP  GET /api/audit/events/:runId  — redis not configured`);
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/audit/events/${auditRunId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const count = json.events?.length ?? json.count ?? '?';
    pass(`GET /api/audit/events/:runId`, `event count=${count}`);
  } catch (e) {
    fail(`GET /api/audit/events/:runId`, e.message);
  }
}

// ---------------------------------------------------------------------------
// Run all steps
// ---------------------------------------------------------------------------
console.log(`\nQuad e2e smoke test  —  ${BASE_URL}\n`);

await step1();
await step2();
await step3();
await step4();
await step5();

console.log(`\n${allPassed ? 'All steps passed.' : 'One or more steps failed.'}\n`);
process.exit(allPassed ? 0 : 1);
