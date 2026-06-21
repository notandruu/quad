# Quad — Pitch deck

A standalone 10-slide pitch deck (1920×1080), rebuilt from the Claude Design
file `Quad Pitch.dc.html` as plain HTML/CSS/JS — no build step, no framework.

## How to view it

- **Easiest:** double-click `index.html` to open it in your browser.
- **With the app running:** it's served at **`/pitch/`** (e.g. `http://localhost:3000/pitch/`),
  because everything under `public/` is served as-is by Next.js.

## How to present

- **→ / Space / Page Down** — next slide
- **← / Page Up** — previous slide
- **Click** the right or left half of the screen — next / previous
- **1–9** — jump to a slide  ·  **Home / End** — first / last  ·  **R** — restart
- **Print → Save as PDF** also works for a quick PDF export.

## Adding the real team photos (slide 2)

The four team headshots were too large to pull through the design connector, so
slide 2 currently shows branded initials tiles (SH / AL / SW / MZ). To swap in
the real photos, just drop these files into the `assets/` folder — the deck picks
them up automatically, no code change needed:

| File to add                 | Person        |
|-----------------------------|---------------|
| `assets/team-stephen.png`   | Stephen Hung  |
| `assets/team-andrew.png`    | Andrew Liu    |
| `assets/team-silas.png`     | Silas Wu      |
| `assets/team-madison.png`   | Madison Zhan  |

(Square-ish images look best; they're shown in a 380px-tall rounded frame.)

## What's in here

- `index.html` — all 10 slides (each is a `<section class="slide">` you can edit directly)
- `deck.js`    — the tiny presentation engine (scaling, navigation, photo fallback)
- `assets/`    — `mascot-hero.png` (the Quad character). Sparkles are drawn with CSS,
  so there are no sprite images to manage.

## Notes vs. the original design

- The original used Claude Design's runtime (`deck-stage.js`, `image-slot`, `<x-dc>`).
  That doesn't run as a normal website, so it was rebuilt as the clean code above.
- The little sparkle decorations are now inline SVG (identical look, nothing to download).
- The secondary mascot poses on slides 3–4 reuse `mascot-hero.png`.
