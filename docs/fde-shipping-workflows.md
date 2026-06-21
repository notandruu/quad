# fde shipping workflows

## thesis

quad should ship like a forward-deployed engineer.

that means it should not stop at finding gaps, drafting summaries, or handing work to another tool. quad should run an end-to-end hosted workflow:

1. detect a business gap
2. collect missing evidence
3. draft the fix
4. prove the fix is grounded
5. run checks
6. request approval
7. execute through a connector or browser action
8. verify the shipped result
9. produce a receipt
10. learn the validated outcome

the product promise:

> quad does the implementation loop, not just the analysis loop.

## current state

the repo already has useful pieces:

- website audit flow
- browser/static render fallback
- findings with evidence
- proof scoring and approval gates
- live event stream
- replay-oriented event model
- audit brief
- action draft concepts
- settings and validation scripts
- sentry/arize/redis/browserbase direction
- quad chain thesis for proof-carrying handoffs

but it does not yet fully ship like an fde.

## biggest gaps

### 1. no hosted run model

quad needs a durable run/task object beyond a transient audit result.

required:

- `runId`
- `orgId`
- `workflow`
- lifecycle state
- owner
- approvals
- artifacts
- events
- retry state
- final receipt

without this, the app can demo a run but cannot operate like a hosted employee.

### 2. no fix workbench as execution center

findings exist, but the user needs a central place where every proposed fix becomes a tracked work item.

required:

- fix title
- target destination
- source finding
- evidence obligations
- approval tier
- publisher state
- dry-run preview
- execution status
- shipped verification
- receipt

### 3. no publisher connectors

quad can draft, but shipping requires destinations.

minimum hosted connectors:

- `cms.publish_draft`
- `task.create`
- `team.send_update`
- `brain.write_memory`
- `browser.fill_form`
- `trust_packet.export`

these can start as webhook connectors or dry-run connectors. the key is that each connector is first-class, health-checked, scoped, and approval-gated.

### 4. no browser write path

browserbase is currently read-oriented. the fde moment requires write actions:

- open controlled form
- fill validated fields
- preserve selectors and values
- pause before submit
- submit on approval
- screenshot the result
- emit action events

### 5. no customer trust packet

enterprise proof needs a shippable artifact:

- security questionnaire answer packet
- rfp response packet
- trust center update packet
- website proof update packet

the packet should be downloadable, copyable, and verifiable by quad chain.

### 6. no quad chain implementation

the thesis exists, but the code needs:

- certificate schema
- deterministic hashes
- certificate builder
- verifier
- adversarial tests
- ui verification state

quad chain should attach to replay packets, trust packets, learned-memory receipts, and agent handoffs.

### 7. no approval ledger

approval cannot be transient ui state.

required:

- who approved
- when approved
- what artifact was approved
- what evidence was visible
- what action tier
- whether it was edited
- whether it was rejected
- receipt id

### 8. no post-ship verification

an fde does not just click submit. it checks the result.

required:

- reload target page or form confirmation
- compare expected text/value to observed result
- screenshot final state
- mark shipped or failed
- open retry/escalation if failed

### 9. no external agent entrypoint

fetch/agentverse should call the same hosted workflow.

required:

- `/api/agent/run`
- normalized task summary response
- run status polling
- compact quad chain certificate summary
- no business logic inside the python uagent

### 10. no production operator panel

debug drawer should evolve into an operator console:

- services
- connector health
- run state
- queue/replay state
- failed action
- last sentry issue
- arize trace link
- fallback mode caveats
- approval blockers

## workflows we can automate and ship

### workflow 1: trust packet builder

user intent:

> build a customer trust packet for this company from the current audit and company brain.

agent workflow:

1. retrieve company memories
2. inspect website/public claims
3. collect missing evidence from local fixtures or connectors
4. draft trust packet sections
5. run evals on every claim
6. build quad chain certificate
7. request approval
8. export packet
9. write validated facts back to memory

hosted artifact:

- `/runs/{runId}/trust-packet`
- copyable markdown
- json packet
- quad chain certificate

why it wins:

- clear enterprise value
- sponsor proof friendly
- can be shipped without fragile live third-party writes

### workflow 2: security questionnaire autopilot

user intent:

> complete this vendor security questionnaire from our evidence.

agent workflow:

1. parse questionnaire
2. answer each question from memory when possible
3. collect missing source artifacts
4. ground answer in quotes
5. mark unsupported as needs-human
6. validate answer
7. learn validated control
8. fill controlled browser form
9. pause for approval
10. submit and verify

hosted artifact:

- answered questionnaire
- evidence map
- needs-human list
- submit receipt
- quad chain certificate

why it wins:

- the clearest enterprise proof wedge
- browserbase write path gets a real job
- shows the brain getting smarter during work

### workflow 3: website proof publisher

user intent:

> update our trust page with the approved facts from this audit.

agent workflow:

1. select ready findings
2. draft page section or faq
3. preserve source quotes and caveats
4. run proof gate
5. preview before/after copy
6. request approval
7. publish draft through webhook/cms connector
8. verify published preview
9. issue receipt

hosted artifact:

- draft patch
- before/after preview
- publisher dry-run
- shipped receipt

why it wins:

- turns audit into action
- connects directly to “approved fixes”
- can start with dry-run webhooks

### workflow 4: issue and team update shipper

user intent:

> turn approved gaps into tasks and tell the team what changed.

agent workflow:

1. group findings by owner/destination
2. create task drafts
3. create team update draft
4. request approval
5. call task/team connectors
6. verify connector responses
7. produce receipt

hosted artifact:

- task list
- team update
- connector responses
- approval receipt

why it wins:

- very shippable
- low risk
- makes the platform feel real immediately

### workflow 5: quad chain verifier

user intent:

> verify this compressed handoff before using it.

agent workflow:

1. load compressed packet
2. verify source hash
3. verify output hash
4. check preserved evidence obligations
5. check omitted ranges
6. check open obligations
7. accept or reject

hosted artifact:

- verification result
- failed checks
- certificate json

why it wins:

- differentiates quad from normal agents
- gives token/trust sponsor angle
- easy to test adversarially

## recommended build sequence

### ship 1: hosted run + trust packet

build the smallest hosted fde loop:

- durable run summary
- trust packet builder
- proof-gated claims
- quad chain certificate
- approval card
- copy/export packet

this gives us a complete product artifact before risky browser writes.

### ship 2: fix workbench + approval ledger

turn findings into executable work items:

- website fix
- task
- team update
- memory writeback
- trust packet section

approval becomes persistent and receipt-backed.

### ship 3: dry-run publishers

add connector abstractions without external risk:

- cms webhook dry run
- task webhook dry run
- team webhook dry run
- brain writeback dry run

demo can show exactly what would ship.

### ship 4: browser write path

add browserbase write actions against controlled forms:

- security questionnaire
- trust packet form
- submit with explicit approval

### ship 5: external agent bridge

add fetch/uagent only after hosted workflows exist:

- uagent calls `/api/agent/run`
- returns verified packet summary
- links back to hosted run

## hosted platform requirements

every workflow needs:

- run id
- org id
- workflow id
- event stream
- artifacts
- approvals
- connector health
- fallback state
- quad chain certificate
- final receipt

every action needs:

- autonomy tier
- source evidence
- preview
- approver
- execution result
- verification result
- rollback or escalation state

## what to avoid

do not build:

- one-off demo scripts that bypass run state
- browser submit without persistent approval
- connector calls without dry-run preview
- memory writeback without validation
- compressed summaries without quad chain certificate
- fetch agent logic that reimplements the app
- multiagent split before one hosted workflow works

## strongest immediate demo

1. user starts enterprise proof run.
2. quad audits current public site and company brain.
3. quad builds a customer trust packet.
4. quad chain verifies the compressed packet.
5. user approves the packet.
6. quad turns approved gaps into website/task/team/memory work items.
7. dry-run publishers show exactly what would ship.
8. final receipt proves what happened.

then the pitch is real:

> quad ships proof work like an fde: it finds the gap, builds the fix, verifies the context, asks for approval, executes through the right connector, and leaves the receipt.

