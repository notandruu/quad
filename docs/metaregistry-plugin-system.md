# metaregistry plugin system

## thesis

quad needs a metaregistry.

the runtime should not hard-code every connector, skill, agent, publisher, policy, or workflow. an org should be able to open a capability marketplace, click install, approve scopes, and immediately update what its ai employee can do.

the product promise:

> one click upgrades your ai employee.

## what the metaregistry manages

the metaregistry is the source of truth for installable capabilities:

- connectors: github, slack, linear, jira, notion, confluence, google drive, cms, browserbase, sentry, arize
- publishers: cms draft, task create, team update, trust packet export, memory writeback
- skills: security questionnaire, rfp response, trust packet builder, website proof publisher, incident summary
- specialist agents: evidence collector, browser actor, publisher, verifier, supervisor
- approval policies: autonomy tier, required approver, edit/reject behavior, irreversible action rules
- eval policies: groundedness, usefulness, citation correctness, hallucination risk, quad chain verifier policy
- surfaces: dashboard, fetch/agentverse, future cli, ide, slack/email, voice

the metaregistry does not execute work. it tells the runtime what is installed, healthy, scoped, trusted, and allowed.

## capability model

every capability should have a manifest.

```json
{
  "id": "github",
  "kind": "connector",
  "displayName": "GitHub",
  "description": "Search repos, read code, inspect pull requests, and create draft issues.",
  "version": "0.1.0",
  "status": "available",
  "health": "unknown",
  "installState": "not_installed",
  "scopes": [
    "repo:read",
    "pull_request:read",
    "issue:write"
  ],
  "tools": [
    {
      "name": "github.search_code",
      "mode": "read",
      "eager": false,
      "description": "Search code in approved repos."
    },
    {
      "name": "github.create_issue_draft",
      "mode": "draft",
      "eager": false,
      "description": "Create an issue draft for approval before publishing."
    }
  ],
  "skillsUnlocked": ["enterprise_proof.collect_repo_evidence"],
  "approvalPolicy": {
    "defaultTier": 2,
    "requiresApprovalFor": ["issue:write"]
  },
  "auth": {
    "type": "oauth",
    "owner": "org_or_user"
  },
  "routingExamples": [
    "find evidence in the repo for our encryption policy",
    "create a task for this missing security control"
  ]
}
```

## install states

capabilities should move through explicit states:

- `available`: can be installed
- `installing`: auth/setup in progress
- `installed`: configured but not yet allowed for agent use
- `allowlisted`: visible to runtime and routing
- `degraded`: installed but health checks fail
- `disabled`: installed but not callable
- `revoked`: auth removed and tools hidden

this prevents a half-configured connector from silently appearing in the model's tool catalog.

## one-click install flow

the user experience should be dead simple:

1. user opens capabilities.
2. user clicks install.
3. quad shows scopes, action tiers, and data access.
4. user authorizes oauth or webhook secret.
5. quad runs health check.
6. quad marks capability installed.
7. admin allowlists capability for specific org/team/workflow.
8. active tool catalog updates.
9. debug/operator panel shows capability live.

the agent becomes more capable without a deploy.

## runtime integration

on every run, quad should build the active tool catalog from:

- org id
- user id
- workflow id
- installed capabilities
- health state
- allowlist state
- user permissions
- approval policy
- action mode

the model should only see tools it can actually call.

hot tools can be eager-loaded. cold tools should be deferred by name until a tool-search step or router decides they are needed. this keeps context smaller and makes quad chain even more valuable when handoffs need compression.

## fde shipping integration

the metaregistry is how quad ships like an fde.

example:

- install github connector
- install linear connector
- install browserbase action connector
- install security questionnaire skill
- install quad chain verifier policy
- install approval policy for tier 3 submissions

now the agent can:

1. search repo evidence
2. answer the questionnaire
3. create draft issues for gaps
4. fill the browser form
5. request approval
6. submit
7. verify
8. leave receipts

without custom code per customer.

## enterprise proof capability bundle

the first bundle should be:

### enterprise proof starter

includes:

- website/browser evidence connector
- local artifact connector
- memory writeback connector
- customer trust packet exporter
- security questionnaire skill
- trust packet builder skill
- quad chain verifier
- tiered approval policy
- sentry/arize observability hooks

this bundle lets quad ship the first hosted fde workflow even before real jira/github/slack integrations are live.

### enterprise proof pro

future bundle:

- github
- slack
- linear/jira
- notion/confluence
- google drive
- cms publisher
- team update publisher
- browserbase write action
- customer/auditor verification portal

## operator ui

debug drawer should evolve into a capabilities panel:

- installed capabilities
- health state
- auth state
- allowlist state
- scopes
- tools exposed
- workflows unlocked
- last failure
- last successful call
- fallback mode

for hackathon/demo, this can be a compact "capabilities" card.

for production, it becomes the control plane.

## safety rules

no capability should become callable until:

- auth is configured
- health check passes or fallback is explicit
- scopes are visible
- approval policy is attached
- allowlist is true
- audit logging is enabled
- capability manifest validates

write tools must never be eager-unlocked without an approval policy.

## database shape

minimum tables or durable records:

- `capability_catalog`
- `org_capability_install`
- `capability_health`
- `capability_tool`
- `capability_skill`
- `approval_policy`
- `capability_audit_log`

fallback mode can keep this in static fixtures first.

## first implementation slice

ship static metaregistry data before dynamic installs:

- define capability manifest types
- create static catalog for redis, browserbase, sentry, arize, brain, cms publisher, task publisher, team publisher, quad chain verifier
- derive debug drawer backend rows from the catalog
- derive validation script checks from the catalog
- show installed/not configured/blocked states

then add install flow.

## killer lines

> quad is the runtime. the metaregistry is how an ai employee learns new tools.

> one click installs a capability, updates the active tool catalog, attaches the approval policy, and makes the agent shippable.

> no hard-coded agents. no hidden tools. every capability is registered, scoped, health-checked, allowlisted, and observable.

