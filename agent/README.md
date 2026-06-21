# Quad fetch agent

This wraps Quad as an ASI:One-compatible Fetch.ai uAgent.

## What it does

The agent receives a chat request from Agentverse or ASI:One, extracts a target URL, calls Quad's `/api/agent/run` bridge, and returns a short enterprise trust workflow summary.

## Run locally

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python quad_agent.py
```

In another terminal, run the Quad app:

```bash
npm run dev
```

## Production env

Set these before registering the agent:

- `QUAD_FETCH_AGENT_SEED`: stable private seed for the uAgent identity.
- `QUAD_AGENT_RUN_URL`: public URL for Quad's Next.js bridge, ending in `/api/agent/run`.
- `QUAD_AGENT_RUN_SECRET`: shared secret also configured on the Next.js app.
- `QUAD_AGENT_DEFAULT_TARGET_URL`: safe fallback demo URL.

On the Next.js side, also set:

- `QUAD_AGENT_RUN_SECRET`
- `QUAD_AGENT_ALLOWED_HOSTS`
- `QUAD_AGENT_ALLOWED_ORGS`

## Agentverse profile

Recommended profile:

- name: `Quad trust agent`
- handle: `@quad-trust`
- keywords: `enterprise trust`, `security questionnaire`, `website audit`, `trust packet`, `compliance evidence`, `company brain`
- description: `Quad audits company trust surfaces against internal knowledge and returns evidence-backed findings, approval gates, and trust packet receipts.`

## Demo prompt

```text
Audit https://your-demo-domain.com/demo and prepare an enterprise trust packet.
```
