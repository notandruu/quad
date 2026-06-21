# Quad — 2-minute YC Demo Day Script

## Setup (before the room)

```bash
npm run dev          # starts Next.js on :3000
npm run demo         # seeds BrightPath brain, verifies all services
```

Open `http://localhost:3000` in a browser. Keep `http://localhost:3000/demo` as a second tab so the audience can see the "thin" website.

---

## The Story (say this out loud)

> "Companies spend weeks manually reviewing their websites against internal documents.
> Marketing decks, board meeting notes, brand guides — none of it ever makes it onto the public site.
> Quad is a company-aware AI employee that audits your website for you, in real time.
> It knows what your company knows, and tells you what your public site is missing."

---

## Live Demo (90 seconds)

### Step 1 — Show the "thin" website (15 sec)

Switch to the `/demo` tab. Point out what is visible:
- Two programs listed (tutoring, college prep)
- Generic stats: "1,000+ students," "10+ years"
- No acceptance rate. No Summer Camp. No Fremont location.

> "This is BrightPath's public website. Looks fine, right?"

### Step 2 — Load the demo (5 sec)

Switch back to `http://localhost:3000`. Click **Load Demo**.

> "Quad already knows their internal brain: board notes, brand guidelines, program details, impact reports."

The brain seeds instantly. The audit starts automatically.

### Step 3 — Watch the live log (30 sec)

The right panel streams in real time:

- `audit.started` — Quad begins crawling
- `page.rendered` — Browserbase renders each page in a real cloud browser
- `page.analyzed` — Quad compares each page against the brain
- `finding.created` — gaps surface one by one

> "Every event is real. Browserbase renders a live browser session. Claude reads the actual page text
> and cross-references it against the internal knowledge base."

### Step 4 — The holy-shit moment (20 sec)

Point to the findings panel as they appear:

**Finding 1**
> "Your website never mentions Summer Leadership Camp — which, per your board notes, is sold out for 2026
> and waitlisted 3 weeks early. That's your hottest program. It doesn't exist on your public site."

**Finding 2**
> "Your 92% college acceptance rate — the highest of any Bay Area nonprofit — appears zero times on your
> website. Your own brand guide says it must be on every page."

**Finding 3**
> "Your brand guidelines require emergency hotline 510-555-0192 on all program pages. It's missing everywhere."

**Finding 4**
> "Fremont expansion is board-approved, lease signed, Q4 2026. The website still says Oakland and Berkeley only."

### Step 5 — One-click action (10 sec)

Click **Approve** on a finding.

> "Quad drafts the copy fix. One click sends it to Slack, Linear, or GitHub — your choice.
> Nothing goes out without a human approving it first."

### Step 6 — Ask a follow-up (10 sec)

Type in the chat: *"Which finding should we fix first?"*

> "Quad is grounded in what it actually found. It can answer questions about the audit, rank priorities,
> and draft copy — all from the same session."

---

## Closing Line

> "Every company has a gap between what they know and what they publish.
> Quad closes that gap, automatically, in minutes.
> We're in beta with three nonprofits. Pricing starts at $200/month per domain."

---

## If Something Goes Wrong

| Problem | Fix |
|---|---|
| Findings panel is empty | Brain may not have seeded — run `npm run demo` again |
| Audit stalls at `page.rendered` | Browserbase session limit hit; wait 30 sec and retry |
| `Load Demo` button shows error | Check server is running: `npm run dev` |
| No live events streaming | Check Redis credentials in `.env.local` |

---

## Key Numbers to Drop

- **5 memories** in the brain (programs overview, board notes, brand guide, impact report, web brief)
- **4 critical gaps** found on the demo site
- **92%** college acceptance rate — BrightPath's top differentiator, invisible online
- **200-student waitlist** for After-School Tutoring — not mentioned anywhere
- **$0** spent on consultants to find these gaps

## Sponsor Claim Check

Before the sponsor booth pass, open `GET /api/sponsor/proof`.

- Use `safeToClaim` for the deck and live explanation.
- Use `doNotClaim` as the no-bullshit guardrail.
- If a sponsor row is `fallback`, show the product surface but say the hosted credential is not live.
- If a sponsor row is `live`, show the listed route or surface as proof.
