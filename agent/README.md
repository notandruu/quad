![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# Quad trust agent

**Agent address:** `agent1qv3cw8tnar5jcgx4d35sxnvr48qtkw7z3cx8wng3rvph3pqrcqnq2evq4z4`

A Fetch.ai uAgent that exposes Quad as an ASI:One-callable enterprise trust worker.
Send it a company URL and it runs Quad's full pipeline: browser evidence collection,
brain retrieval, grounded findings, trust packet assembly, and approval gating — then
returns a normalized task summary in chat.

## Capability

**Name:** Quad trust agent  
**Handle:** `@quad-trust-agent`  
**Keywords:** enterprise trust, security questionnaire, website audit, trust packet, compliance evidence, company brain  
**Category:** Innovation Lab

**What it does:**  
Receives a natural-language request (e.g. "audit brightpath.org for trust gaps") via
ASI:One or direct Agentverse handle. Extracts the target URL, calls the Quad backend
(`/api/agent/run`), runs the full audit + enterprise proof workflow, and returns a
concise summary of findings, approval state, and next action.

**Workflows exposed:**
- `website_audit` — discover pages, render in Browserbase, cross-reference brain, surface grounded findings
- `enterprise_proof` — website audit + trust packet assembly with quad-chain certificate and approval gate

## Demo prompt

```
Audit https://kali-audit.vercel.app/demo and prepare an enterprise trust packet.
```

## Run locally

```bash
cd agent
bash run.sh          # macOS (handles libexpat path fix automatically)
```

In a separate terminal:

```bash
npm run dev          # starts the Quad Next.js app on :3000
```

The agent will print its address on startup and register with Agentverse via mailbox.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `QUAD_FETCH_AGENT_SEED` | Stable private seed — do not change after registering |
| `QUAD_AGENT_RUN_URL` | Public URL for `/api/agent/run` (use Vercel URL in prod) |
| `QUAD_AGENT_RUN_SECRET` | Shared secret matching `QUAD_AGENT_RUN_SECRET` on the Next.js app |
| `QUAD_AGENT_DEFAULT_TARGET_URL` | Fallback demo URL when no URL is in the message |

## Agentverse registration

1. Start the agent: `bash run.sh`
2. Copy the printed address
3. Go to [Agentverse](https://agentverse.ai) → My Agents → Connect → Mailbox
4. Paste the address and configure the profile with the capability description above
5. Verify via ASI:One: `@quad-trust-agent audit https://kali-audit.vercel.app/demo`
