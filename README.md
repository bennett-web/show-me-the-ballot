# Show Me The Ballot

**A civic information tool that makes ballot data accessible to every voter — regardless of English proficiency, prior voting experience, or technical literacy.**

Built by Marie-France Han and Eric Bolton. Won second prize at the Media Party Hackathon at the Brown Institute for Media Innovation, Columbia University (September 2024).

Live site: [showmetheballot.org](https://showmetheballot.org)

---

## What This Is

Show Me The Ballot has two distinct audiences with two distinct interfaces — built on the same data spine.

**Voters** get a search-first experience: type a county, state, or zip code and get your actual ballot, explained in plain language, at a grade 5–6 reading level, in your language. No map required. No civic literacy assumed.

**Journalists** get a map-first dashboard: a national state map with battleground prioritization, drill-down to county-level ballot data, coverage aggregation from news outlets and content creators, and access to exportable datasets.

These are two front doors to the same Airtable-backed data layer.

---

## Architecture Overview

```
showmetheballot.org/          → Voter search homepage
showmetheballot.org/#/az      → Arizona state view (journalist map OR voter county list)
showmetheballot.org/#/az/maricopa → Maricopa County ballot view

/journalist                   → Password-protected journalist dashboard (map-first)
```

Navigation uses **URL hash routing** (`#/state/county`) so:
- Browser back button works at every level
- Individual county ballot views are shareable via direct URL
- No server-side routing required for v1

---

## Two Front Doors

### 1. Voter Homepage (Public)

**Design direction:** Refined minimalism. Confident, civic, accessible. Not a government form — not a startup landing page. Somewhere between the two.

The entry point is a single search bar. Large, centered, uncluttered. The user types a county name, state, or zip code and gets routed directly to their ballot view.

**Below the search bar:**
- Brief plain-language explanation of what the tool does (3 sentences max)
- Two example links: one high-complexity ballot, one low-complexity ballot — to show range
- Language switcher (EN / ES / 中文 / Tiếng Việt / Tohono O'odham) — applies globally
- "First time voting?" help link → brief explainer modal

**What the voter search flow looks like:**
1. User types "Maricopa" or "85001" or "Arizona"
2. Autocomplete surfaces matching counties
3. User selects → routed to `#/az/maricopa`
4. County ballot view loads: proposition cards, plain-language summaries, reading grade tags, language switcher, progress bar

**Voter ballot card UI (per proposition):**
- Proposition ID + title
- Type badge: Statewide / Local measure / Candidate race
- Plain-language summary (3–5 sentences, grade 5–6 reading level, AI-generated + human-reviewed)
- Reading grade tag
- Yes / No preference markers (local only — not a real vote, just a review tool)
- "Learn more & see coverage" link → opens coverage panel
- Expand/collapse per card
- Progress bar: "X of Y items reviewed"

**Accessibility requirements:**
- WCAG 2.1 AA minimum
- All text content translatable via language switcher
- Touch targets minimum 44px (mobile-first)
- Screen reader compatible labels on all interactive elements

---

### 2. Journalist Dashboard (Password-Protected)

**Route:** `/journalist` — login required. Separate credentials from voter-facing site.

**Design direction:** Data-dense but legible. Editorial intelligence layer. Think newsroom tool, not consumer product.

**Entry view: National state map**

- D3.js + TopoJSON (`us-atlas@3/states-10m.json`)
- AlbersUSA projection, scales to container
- Three-tier color coding:
  - `#C94A22` — Priority battleground
  - `#C07A12` — Watch state
  - `#1D9E75` — Data ready
  - `#E8E5DE` — Not yet covered
- Hover tooltip: state name, tier, prop count, source count, active alerts
- Click state → drill to state county view
- Filter buttons: Battleground / All states / By coverage
- Sidebar: ranked priority state list + live alert feed

**Stats bar (top of map):**
- States with ballot data
- Propositions indexed
- Coverage alerts today
- Priority battleground count

**State drill-down view (`#/az`)**

- County-level map using `us-atlas@3/counties-10m.json`, filtered by state FIPS code
- Load county topology **on demand** when state is selected — not all upfront
- Arizona FIPS: `04` — 15 counties
- County color = activity tier (same color system as national map)
- Click county → ballot sidebar opens
- Searchable county list in sidebar
- Breadcrumb navigation: All states › Arizona › [County]

**County ballot sidebar:**
- Lists all propositions for selected county
- Each card shows: ID, type badge, plain-language summary, reading grade
- "View full ballot" CTA → routes to voter ballot view for that county
- Journalist-only: stance signal field (Pro / Against / Neutral / Unclear), coverage count, source links

**Alert feed (sidebar):**
- Coverage spike alerts (X new articles on proposition Y)
- Ballot finalization notices (state ballot locked, N props added)
- Creator signal alerts (N posts tagged #PropHashtag)
- New filing notices

---

## Data Layer

All ballot data is managed in **Airtable**. The public site pulls from the Airtable API. No manual publishing step — status field drives what's live.

### Tables

**Propositions** (core table)
| Field | Type | Notes |
|---|---|---|
| Prop ID | Auto number | URL slug component |
| Title | Single line | Official short name |
| State | Link → States | |
| County / district | Single line | Blank = statewide |
| Measure type | Single select | Constitutional amendment · Bond · Statute · Candidate race |
| Official text | Long text | Raw legal language, never edited |
| Plain-language summary | Long text | AI-generated, human-reviewed |
| Reading grade | Number | Flesch-Kincaid, target ≤ 6 |
| Status | Single select | Raw → AI draft → Needs review → Approved → Translating → Live → Archived |
| ES summary | Long text | Spanish |
| ZH summary | Long text | Simplified Chinese |
| VI summary | Long text | Vietnamese |
| TO summary | Long text | Tohono O'odham |
| Coverage count | Rollup | Auto-counts linked Coverage rows |
| Public URL | Formula | `showmetheballot.org/#/{state}/{county}/{prop-id}` |

**States**
- Name, abbreviation, tier, election date, ballot finalized checkbox, prop count (rollup), live prop count (rollup), source count (rollup), state API endpoint

**Coverage tracker** (journalist-only)
- Headline, URL, linked proposition(s), source, content type, stance signal, published date, verified checkbox

**Sources**
- Source name, type, states covered, RSS/feed URL, credibility tier, active monitoring checkbox, coverage count (rollup)

### Proposition Status Flow
```
Raw → AI draft → Needs review → Approved → Translating → Live → Archived
```
Views in Airtable are filtered by Status. The "Ingestion queue," "Needs review," and "Live" views are the primary editorial workflow surfaces.

---

## Aggregation & Alerts

Coverage aggregation runs via **Make (formerly Integromat)** or **Zapier**:
- Watches RSS feeds from sources in the Sources table where `Active monitoring = true`
- Creates new rows in Coverage tracker on match
- Fires Slack or email alert when coverage count for a proposition crosses a threshold (configurable per prop)

Real-time is a v2 problem. v1 is near-real-time (hourly pull) with alerts.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Map rendering | D3.js v7 + TopoJSON v3 | CDN via cdnjs.cloudflare.com |
| Topology data | us-atlas@3 | cdn.jsdelivr.net — needs network access in dev |
| Data backend | Airtable | API key scoped to read-only for public site |
| Routing | Hash routing | `#/state/county` — no server config needed |
| Hosting | GitHub Pages | Static HTML, no build step |
| Aggregation | Make / Zapier | RSS → Airtable Coverage tracker |
| Auth (journalist) | Password protect via Netlify or Cloudflare | Simple for v1 |
| Framework | Vanilla HTML/CSS/JS | No frameworks — keep it portable |

---

## File Structure

```
/
├── index.html                  → Voter search homepage
├── show-me-the-ballot-dashboard.html → Journalist map dashboard
├── /js
│   ├── map.js                  → D3 national + state map logic
│   ├── router.js               → Hash routing
│   ├── ballot.js               → Ballot card rendering + language switcher
│   └── airtable.js             → Airtable API fetch layer
├── /css
│   └── styles.css              → Shared design tokens + component styles
├── /data
│   └── states-meta.json        → Static tier/priority data for map coloring
└── README.md                   → This file
```

---

## Design Tokens

```css
:root {
  --color-priority:    #C94A22;   /* Battleground states */
  --color-watch:       #C07A12;   /* Watch states */
  --color-ready:       #1D9E75;   /* Data ready */
  --color-uncovered:   #E8E5DE;   /* Not yet covered */
  --color-teal-light:  #E1F5EE;
  --color-teal-dark:   #085041;
  --color-text:        #1A1A18;
  --color-text-2:      #6B6B65;
  --color-text-3:      #9E9E96;
  --color-bg:          #F7F5F0;
  --color-surface:     #FFFFFF;
  --color-surface-2:   #F0EDE6;
  --color-border:      rgba(0,0,0,0.10);

  --font-display: 'Libre Baskerville', serif;   /* Headers */
  --font-body:    'DM Sans', sans-serif;         /* UI text */
  --font-mono:    'DM Mono', monospace;          /* Labels, metadata, grades */
}
```

---

## Priority Build Order (2026 Midterms)

**Phase 1 — Core voter experience (now)**
- [ ] Voter homepage with search bar and autocomplete
- [ ] Hash router (`#/state`, `#/state/county`)
- [ ] County ballot card view with language switcher (EN/ES/中文/VI)
- [ ] Airtable read-only API integration
- [ ] GitHub Pages deploy with custom domain

**Phase 2 — Journalist dashboard**
- [ ] Password-protected `/journalist` route
- [ ] National state map with tier coloring
- [ ] State → county drill-down (on-demand topology load)
- [ ] Alert feed in sidebar
- [ ] Coverage tracker view per proposition

**Phase 3 — Scale**
- [ ] All 50 states (currently 8–10 priority battlegrounds)
- [ ] Tohono O'odham + additional language support
- [ ] Creator signal aggregation (YouTube, TikTok tags)
- [ ] Exportable datasets for journalist view
- [ ] First-time voter explainer flow

---

## Battleground State Priority (2026)

| State | Tier | FIPS | Status |
|---|---|---|---|
| Pennsylvania | Priority | 42 | Data ready |
| Arizona | Priority | 04 | Data ready |
| Georgia | Priority | 13 | Data ready |
| North Carolina | Priority | 37 | Data ready |
| Wisconsin | Watch | 55 | In progress |
| Nevada | Watch | 32 | In progress |
| Florida | Watch | 12 | In progress |
| Michigan | Ready | 26 | Data ready |

---

## Mobile QA Checklist

The voter-facing experience is mobile-first. The primary user is on a phone — likely a budget Android, possibly on a slow connection, possibly in a language other than English. Every voter-facing view must pass this checklist before shipping.

### Viewport targets
Test at all three breakpoints:
- `375px` — iPhone SE / older iPhones (smallest common viewport)
- `390px` — iPhone 14 / modern iPhones
- `360px` — typical mid-range Android (Moto G, Samsung A-series)

### Search bar (homepage)
- [ ] Search bar is the dominant element — centered, full-width with padding, large tap target
- [ ] Tapping the search bar triggers the native mobile keyboard without layout shift
- [ ] When the keyboard opens, the search bar and autocomplete results remain visible above the keyboard — use `visualViewport` resize handler to prevent keyboard obscuring the input
- [ ] Autocomplete dropdown is scrollable and tappable at all three viewport sizes
- [ ] Each autocomplete result has a minimum 44px tap target height
- [ ] Search bar is tagged with `autocomplete="off"` and `inputmode="search"` for correct mobile keyboard type

### Language switcher
- [ ] All five language buttons (EN / ES / 中文 / Tiếng Việt / Tohono O'odham) fit without horizontal scroll at 375px — wrap gracefully to a second row if needed
- [ ] Active language state is visually clear at a glance (color + weight, not color alone)
- [ ] Switching language re-renders all visible text instantly — no page reload
- [ ] Language preference persists across navigation within the session (store in `sessionStorage`)

### Ballot card view
- [ ] Cards are full-width with 16px horizontal padding minimum
- [ ] Card tap area for expand/collapse covers the full card header — not just the chevron icon
- [ ] Yes / No buttons are minimum 44px tall and have at least 8px gap between them
- [ ] Expanded card summary text is readable at 16px minimum — no smaller
- [ ] Reading grade tag is visible without scrolling when a card first expands
- [ ] "Learn more & see coverage" link has a minimum 44px tap target height
- [ ] Progress bar updates immediately on vote — no lag
- [ ] Cards do not expand off-screen — expanded state scrolls into view automatically (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`)

### Performance on slow connections
- [ ] First meaningful paint under 3 seconds on a simulated 3G connection (use Chrome DevTools throttling)
- [ ] Airtable API fetch has a visible loading state — spinner or skeleton card — so users on slow connections don't see a blank screen
- [ ] If the API fetch fails, show a graceful error message with a retry option — not a blank screen or console error
- [ ] Topology JSON for maps loads on demand — never block the voter ballot view on map data

### Navigation & routing
- [ ] Browser back button returns to the previous view correctly at every level (homepage → state → county → ballot)
- [ ] Direct URL to a county ballot view (`#/az/maricopa`) loads correctly on mobile without requiring homepage first
- [ ] Breadcrumb navigation is tappable and accurate at all viewport sizes
- [ ] No horizontal scroll at any viewport — if content overflows, it wraps or truncates with ellipsis

### Accessibility (WCAG 2.1 AA)
- [ ] All interactive elements have visible focus states (important for users who switch between touch and keyboard)
- [ ] Color is never the only means of conveying information (tier badges use text labels, not just color dots)
- [ ] All images and icons have `aria-hidden="true"` or descriptive `aria-label` where appropriate
- [ ] Language switcher updates the `lang` attribute on the `<html>` element when switched — screen readers need this to use the correct pronunciation engine
- [ ] Form inputs (search bar) have associated `<label>` elements — visually hidden is fine, but present in the DOM
- [ ] Proposition cards use semantic HTML — `<button>` for interactive elements, not `<div onclick>`

### Real-device final check
After Claude Code passes all of the above in DevTools simulation, open the GitHub Pages URL on a physical device:
- An actual iPhone (Safari)
- An actual Android (Chrome)

Look specifically for: keyboard behavior on the search bar, font rendering differences, tap target accuracy, and any layout shifts on page load. DevTools simulation does not catch everything.

---

## Notes for Claude Code

- Load county topology on demand per state — not all counties upfront. Filter by state FIPS prefix (e.g. Arizona = `04`).
- Hash routing is the routing layer. No server config. Every view is a hash state.
- The voter homepage and journalist dashboard are separate HTML files sharing a CSS file and JS modules.
- Airtable API key lives in a `.env` file — never committed to the repo. Use a read-only scoped key for the public voter site.
- Network access required in dev for CDN map data (`cdn.jsdelivr.net`).
- The journalist dashboard (`show-me-the-ballot-dashboard.html`) is the existing prototype — extend it, don't rewrite it.
- Mobile-first for all voter-facing views. Desktop-first for journalist dashboard.
- WCAG 2.1 AA for all voter-facing views.
