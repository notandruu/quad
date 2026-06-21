#!/usr/bin/env node
/**
 * Validates that every external service the app depends on is reachable.
 * Reads credentials from .env.local via dotenv.
 *
 * Usage:
 *   npm run validate
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const results = [];

function ok(name, detail, ms) {
  results.push({ name, ok: true, detail, ms });
  console.log(`  ✓  ${name.padEnd(16)} ${detail}  (${ms}ms)`);
}

function fail(name, err) {
  results.push({ name, ok: false });
  console.log(`  ✗  ${name.padEnd(16)} ${err}`);
}

function skip(name) {
  results.push({ name, ok: null });
  console.log(`  -  ${name.padEnd(16)} NOT CONFIGURED`);
}

// ---------------------------------------------------------------------------
// 1. brain (Supabase)
// ---------------------------------------------------------------------------
async function checkBrain() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { skip('brain'); return; }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key);
    const t0 = Date.now();
    const { error } = await client.from('brain_memory').select('id').limit(1);
    const ms = Date.now() - t0;
    if (error) throw new Error(error.message);
    ok('brain', 'brain_memory reachable', ms);
  } catch (e) {
    fail('brain', e.message);
  }
}

// ---------------------------------------------------------------------------
// 2. embeddings (OpenAI)
// ---------------------------------------------------------------------------
async function checkEmbeddings() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { skip('embeddings'); return; }
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: ['test'] }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const dim = json.data?.[0]?.embedding?.length ?? '?';
    ok('embeddings', `dim=${dim}`, ms);
  } catch (e) {
    fail('embeddings', e.message);
  }
}

// ---------------------------------------------------------------------------
// 3. llm (Anthropic)
// ---------------------------------------------------------------------------
async function checkLlm() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { skip('llm'); return; }
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const text = json.content?.[0]?.text ?? '(no text)';
    ok('llm', text.slice(0, 60).replace(/\n/g, ' '), ms);
  } catch (e) {
    fail('llm', e.message);
  }
}

// ---------------------------------------------------------------------------
// 4. redis (Upstash)
// ---------------------------------------------------------------------------
async function checkRedis() {
  const url = process.env.QUAD_REDIS_REST_URL;
  const token = process.env.QUAD_REDIS_REST_TOKEN;
  if (!url || !token) { skip('redis'); return; }
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    const t0 = Date.now();
    await redis.ping();
    const id = await redis.xadd('quad:validate', '*', { data: 'test' });
    await redis.del('quad:validate');
    const ms = Date.now() - t0;
    ok('redis', `xadd id=${id}`, ms);
  } catch (e) {
    fail('redis', e.message);
  }
}

// ---------------------------------------------------------------------------
// 5. browserbase
// ---------------------------------------------------------------------------
async function checkBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) { skip('browserbase'); return; }
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bb-api-key': apiKey,
      },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const session = await res.json();
    const sessionId = session.id;

    // Immediately stop/complete the session so it doesn't linger.
    await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bb-api-key': apiKey,
      },
      body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
    });

    const ms = Date.now() - t0;
    ok('browserbase', `session=${sessionId.slice(0, 8)}...`, ms);
  } catch (e) {
    fail('browserbase', e.message);
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------
console.log('\nQuad service validation\n');

await checkBrain();
await checkEmbeddings();
await checkLlm();
await checkRedis();
await checkBrowserbase();

const live = results.filter((r) => r.ok === true).length;
const configured = results.filter((r) => r.ok !== null).length;
const total = results.length;

console.log(`\nSummary: ${live}/${configured} configured services live  (${total - configured} not configured)`);
if (live === configured && configured > 0) {
  console.log('Status: demo-ready\n');
} else if (live === 0 && configured === 0) {
  console.log('Status: no external services configured (fallback mode)\n');
} else {
  console.log(`Status: partial (${configured - live} configured but unreachable)\n`);
}
