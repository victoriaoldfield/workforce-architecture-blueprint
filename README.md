# Workforce Architecture — Blueprint Session

A prototype onboarding experience for mapping workforce architecture: business
units, functions, and role levels, tagged with soft skills and checked
against simulated market data before anything is approved.

Standalone — plain HTML, CSS, and vanilla JS. No build step, no dependencies,
no ties to any other app.

## Running it

Just open `index.html` in a browser:

```
open index.html
```

Or double-click it in Finder. There's no server, no `npm install`, nothing to
build — it's a single file.

## Structure

Everything lives in `index.html`:
- `<style>` — design tokens (light = paper drafting table, dark = an actual
  cyanotype blueprint) and component styles
- `<script>` — a small state machine (`S`) driving the wizard: business units
  → functions (per BU) → role levels → soft skills (per function) →
  simulated market-data "redline" review → approval

## Editing

Since it's one file, open it in any editor and edit `<style>` or `<script>`
directly, then refresh the browser — no rebuild needed.
