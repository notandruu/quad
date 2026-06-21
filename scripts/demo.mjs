#!/usr/bin/env node
/**
 * One-command demo setup. Seeds the BrightPath brain and verifies services.
 *
 * Usage:
 *   npm run demo
 *   BASE_URL=http://localhost:3001 npm run demo
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

console.log(`\nQuad demo setup  —  ${BASE_URL}\n`);

// ---------------------------------------------------------------------------
// 1. Verify server is running
// ---------------------------------------------------------------------------
async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const live = Object.entries(json)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    console.log(`  ✓  server up        backends live: [${live.join(', ') || 'fallback mode'}]`);
    return true;
  } catch (e) {
    console.log(`  ✗  server not running at ${BASE_URL}`);
    console.log(`     Start it first: npm run dev\n`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Seed demo brain
// ---------------------------------------------------------------------------
async function seedBrain() {
  try {
    const res = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? 'reset failed');
    console.log(`  ✓  brain seeded     ${json.memoriesLoaded} BrightPath memories loaded`);
    return true;
  } catch (e) {
    console.log(`  ✗  brain seed failed: ${e.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 3. Verify demo page is accessible
// ---------------------------------------------------------------------------
async function checkDemoPage() {
  try {
    const res = await fetch(`${BASE_URL}/demo`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(`  ✓  demo page        ${BASE_URL}/demo`);
    return true;
  } catch (e) {
    console.log(`  ✗  demo page not reachable: ${e.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const serverOk = await checkServer();
if (!serverOk) process.exit(1);

await seedBrain();
await checkDemoPage();

console.log(`
Demo ready. Open ${BASE_URL} and click "Load Demo".
Quad will seed BrightPath's brain and immediately audit ${BASE_URL}/demo.

Key findings to expect:
  - Summer Leadership Camp (sold out, 2026 waitlisted) not on website
  - 92% college acceptance rate missing from all pages
  - Emergency hotline 510-555-0192 absent from program/contact pages
  - Fremont expansion (Q4 2026, board-approved) not mentioned
  - Website stats are vague (no 1,200 students served, no +0.8 GPA)
`);
