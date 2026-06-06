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

### Data spine (two sources)

```
Census TIGER / ZCTA crosswalk  → geospatial resolution (zip → county → state)
Ballotpedia (licensed or scraped) → all ballot content
         ↓
Airtable                       → editorial layer (summaries, translations, status)
         ↓
Public site API                → voter-facing ballot cards
```

This is intentionally a two-source architecture. The original multi-source approach — state-by-state election board scrapers, Google Civic API, deduplication logic — has been replaced with Ballotpedia as the single source of truth for ballot content. Simpler to build, simpler to maintain, simpler to debug.

**Important first step before building the data pipeline:** Contact Ballotpedia's partnerships team before writing a scraper. Frame it as a civic tech project (mention the Columbia hackathon win, the LEP voter focus). They have a formal data licensing program and frequently partner with nonprofits doing exactly this kind of work. Clean licensed API access beats brittle scraped HTML every time. If they say no, proceed with scraping knowingly — but ask first.

### URL structure

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

### Two separate pipelines

**Ballot data pipeline** (voter-facing): Ballotpedia → Airtable → public site. This is the simplified two-source architecture above.

**Coverage/media pipeline** (journalist-facing): RSS feeds + Surf monitoring → Make/Zapier → Airtable Coverage tracker → journalist dashboard. This is a separate system. The simplification above applies to ballot content only — media monitoring is still a multi-source aggregation problem.

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

### Two tools, two jobs

The aggregation workflow has two distinct layers — one for human editorial awareness, one for automated data pipeline.

**Surf (editorial monitoring — human layer)**

Surf is Flipboard's aggregation app, out of beta as of April 2026. It pulls from RSS, ActivityPub, AT Protocol, Bluesky, Threads, Mastodon, YouTube, and podcasts into a single customizable feed. For Marie-France, this is the daily monitoring tool — open it in the morning and see what's moving across sources, outlets, and creators in one place without algorithm interference.

This is particularly useful for the creator signal layer. A Bluesky creator posting about Georgia Prop 4 and an AP News article about the same measure can live in the same Surf feed — which is exactly the "aggregate from news sources AND content creators" goal from the original brief.

What Surf is not: a data pipeline. It won't push items into Airtable, count coverage spikes, or fire alerts automatically. It's a reading and discovery interface.

**How to use Surf as a source-building tool:**
1. Build custom Surf feeds per battleground state — mix local news RSS + relevant creator accounts on Bluesky/Threads
2. When a new source surfaces that's worth monitoring long-term, add its RSS feed to the Airtable Sources table
3. Surf handles the daily human scan; Airtable + Make handles the automated ingestion

**Make / Zapier (automated pipeline — machine layer)**

- Watches RSS feeds from sources in the Sources table where `Active monitoring = true`
- Runs on a scheduled pull (hourly for priority states, every 4 hours for watch states)
- Creates new rows in Coverage tracker automatically on match
- Fires Slack or email alert when coverage count for a proposition crosses a configurable threshold
- Tags each ingested item with source, state, and proposition link where detectable

Real-time is a v2 problem. v1 is near-real-time with alerts — sufficient for the editorial workflow.

### Recommended Surf feed structure for SMTB

Build one feed per Priority state, mixing:
- State's dominant newspaper RSS
- Local TV station RSS (e.g. 12News AZ, 11Alive GA, WXYZ Detroit)
- AP News state tag RSS
- 3–5 creator accounts per state on Bluesky/Threads covering local politics
- County elections office accounts where they exist

This gives Marie-France a morning scan covering both institutional coverage and creator signal across priority states in under 10 minutes each.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Map rendering | D3.js v7 + TopoJSON v3 | CDN via cdnjs.cloudflare.com |
| Topology data | us-atlas@3 | cdn.jsdelivr.net — needs network access in dev |
| Ballot data source | Ballotpedia | Licensed API (preferred) or scraper — single source of truth |
| Geospatial | Census TIGER / ZCTA crosswalk | Zip → county → state FIPS resolution |
| Data backend | Airtable | Editorial layer; API key scoped to read-only for public site |
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

2026 is a midterm cycle, not a presidential year — the battleground map shifts accordingly. Priority is determined by which states have the most competitive Senate and/or Governor races, per current ratings from Cook Political Report, Sabato's Crystal Ball, and Inside Elections (as of June 2026).

**Note:** Pennsylvania and Arizona were on our original priority list based on presidential-cycle logic. In 2026, neither has a competitive Senate race — but both have competitive Governor races, so they stay on the map.

### Senate battlegrounds

| State | FIPS | Race | Current rating | Why it matters |
|---|---|---|---|---|
| Georgia | 13 | Senate (D-held) | Toss-up | Jon Ossoff defending; Brian Kemp potential challenger |
| Michigan | 26 | Senate (D-held) | Toss-up | Open seat; Gary Peters not running |
| North Carolina | 37 | Senate (R-held) | Lean D | Thom Tillis retiring; Roy Cooper running for Dems |
| New Hampshire | 33 | Senate (D-held) | Lean D | Open seat; Jeanne Shaheen retired |
| Maine | 23 | Senate (R-held) | Tilt R | Susan Collins only R senator in Harris-won state |
| Iowa | 19 | Senate (R-held) | Leans R | Joni Ernst negatives; newly competitive |
| Texas | 48 | Senate (R-held) | Leans R | Cornyn may lose primary to Ken Paxton |
| Alaska | 02 | Senate (R-held) | Competitive | Mary Peltola running; won statewide in 2022 |
| Ohio | 39 | Senate (R-held) | Competitive | Sherrod Brown vs. appointed Sen. Jon Husted |
| Florida | 12 | Senate (R-held) | Watch | Special election; historically tough for Dems |

### Governor battlegrounds

| State | FIPS | Race | Current rating | Why it matters |
|---|---|---|---|---|
| Michigan | 26 | Governor (D-held) | Toss-up | Gretchen Whitmer term-limited; trifecta control at stake |
| Wisconsin | 55 | Governor (D-held) | Toss-up | Highly competitive; trifecta control at stake |
| Arizona | 04 | Governor (D-held) | Lean D | Katie Hobbs won 2022 by 17K votes; approval underwater |
| Georgia | 13 | Governor (R-held) | Competitive | Kemp term-limited; open race |
| Nevada | 32 | Governor (R-held) | Competitive | Gov. Lombardo has strong approvals but Dems recruiting |
| New Hampshire | 33 | Governor (R-held) | Competitive | Gov. Ayotte strong but Dems competitive statewide |
| Pennsylvania | 42 | Governor (D-held) | Lean D | Josh Shapiro reelection; potential 2028 contender |
| Iowa | 19 | Governor (R-held) | Competitive | Kim Reynolds not running; open seat; tariff impact |
| Kansas | 20 | Governor (D-held) | Competitive | Dems defending in a red-leaning state |

### Combined priority list for SMTB data collection

Ranked by number of competitive races + population weight:

| State | FIPS | Competitive races | Priority tier |
|---|---|---|---|
| Michigan | 26 | Senate (toss-up) + Governor (toss-up) | **Priority** |
| Georgia | 13 | Senate (toss-up) + Governor (competitive) | **Priority** |
| Wisconsin | 55 | Governor (toss-up) | **Priority** |
| North Carolina | 37 | Senate (Lean D) | **Priority** |
| Arizona | 04 | Governor (Lean D) | **Priority** |
| Pennsylvania | 42 | Governor (Lean D) | **Priority** |
| Nevada | 32 | Governor (competitive) | Watch |
| New Hampshire | 33 | Senate (Lean D) + Governor (competitive) | Watch |
| Ohio | 39 | Senate (competitive) | Watch |
| Iowa | 19 | Senate (Leans R) + Governor (competitive) | Watch |
| Alaska | 02 | Senate (competitive) | Watch |
| Maine | 23 | Senate (Tilt R) | Watch |
| Texas | 48 | Senate (Leans R) | Watch |
| Florida | 12 | Senate special election | Watch |
| Kansas | 20 | Governor (competitive) | Watch |

---

## Data Strategy

### The core problem — and the simplification

Local ballot data is decentralized by design. In November 2024, approximately 1,300 local ballot initiatives were voted on across the US — separate from the 149 state-level measures that got media coverage. Each lives on a different county elections website, in a different format, on a different timeline. Some counties (e.g. Catawba County, NC) don't publish sample ballots until September.

The original instinct — scrape state-by-state election boards, integrate Google Civic API, build multi-source deduplication — is a much harder architectural problem than necessary. The simpler path: **Ballotpedia as the single source of truth for ballot content.**

Ballotpedia covers federal races, state legislative races, gubernatorial races, statewide ballot measures, and county/local ballot measures across most jurisdictions. Their URL structure is predictable and consistent, which makes scraping more reliable than most targets. For the 2026 midterms — primarily federal and state races — their coverage is comprehensive. The only gap is hyperlocal sub-county races (school board districts, water districts), which is a v2 problem.

Congressional redistricting litigation means precinct-level shapefiles may not be finalized before election day. Outside anyone's control — which is why v1 routes by zip → county, not precinct.

### Step zero: contact Ballotpedia first

Before building any scraper, email Ballotpedia's partnerships team. Ballotpedia is a nonprofit — they have a formal data licensing program for civic tech use cases. A licensed data agreement means:
- Cleaner, structured data instead of scraped HTML
- No risk of being blocked mid-election cycle
- Potential ongoing relationship and data updates

Frame the ask: civic tech project, Columbia hackathon win, LEP voter focus, nonprofit alignment. This is exactly the kind of partnership they exist to support. If they say yes, the data pipeline becomes significantly more reliable. If they say no, proceed with scraping knowingly.

### Scrape frequency calendar

Once data access is confirmed (licensed or scraped), sync to the electoral calendar:

| Period | Frequency | Reason |
|---|---|---|
| Now → filing deadlines (spring 2026) | Weekly | Candidate fields still forming |
| Post-filing → primary (summer 2026) | Daily | Ballot content solidifying |
| Post-primary → November 2026 | Daily + delta checks | Final ballot locked; catch amendments |
| Election week | Hourly | Last-minute changes, candidate withdrawals |

### Tiered coverage strategy

Don't try to be comprehensive on day one. Be excellent in the places that matter most.

**Tier 1 — State-level measures, all battleground states**
Source: Ballotpedia (Marie-France's existing spreadsheet is the seed). These 149 measures are well-documented. Import all into Airtable as Status = `Raw` on day one.

**Tier 2 — High-population counties in priority battleground states**
Rather than covering all 1,300+ local measures, focus on counties where the most competitive votes live. Target approximately 40–50 counties across the priority states.

Priority counties to cover first:
| State | County | Pop | Why |
|---|---|---|---|
| Michigan | Wayne | 1.7M | Detroit; Senate + Governor toss-up state; highest LEP density in MI |
| Michigan | Oakland | 1.3M | Most competitive suburban county; Senate + Governor toss-up |
| Michigan | Macomb | 880K | Key swing county; will decide both MI races |
| Georgia | Fulton | 1.1M | Atlanta; Senate toss-up + open Governor race |
| Georgia | Gwinnett | 970K | Fastest-growing, highly diverse; decisive in GA statewide |
| Georgia | Cobb | 780K | Critical Atlanta suburb; both races competitive |
| Wisconsin | Milwaukee | 950K | Governor toss-up; highest turnout county in WI |
| Wisconsin | Dane | 570K | Madison; high turnout; trifecta control at stake |
| Wisconsin | Waukesha | 420K | Largest GOP suburb; margin here decides WI |
| North Carolina | Mecklenburg | 1.1M | Charlotte; Lean D Senate race; largest county |
| North Carolina | Wake | 1.1M | Raleigh; both highly educated and competitive |
| Arizona | Maricopa | 4.5M | Largest battleground county in the US; Governor race |
| Arizona | Pima | 1.1M | Tucson; high LEP population; Governor race |
| Pennsylvania | Philadelphia | 1.6M | Governor race; highest local measure complexity |
| Pennsylvania | Allegheny | 1.2M | Pittsburgh metro; Governor race |
| Nevada | Clark | 2.3M | Las Vegas; 73% of NV population; Governor race |
| New Hampshire | Hillsborough | 420K | Manchester metro; both Senate + Governor competitive |
| Ohio | Cuyahoga | 1.2M | Cleveland; Senate race; highest Dem turnout county |
| Ohio | Franklin | 1.3M | Columbus; Senate race; fastest-growing OH county |

**Tier 3 — Remaining counties, as capacity allows**
Fill in remaining counties in priority states as data becomes available. Use the alert system (see below) to know when county election sites publish their sample ballots.

### Routing: zip code → county, not precinct

Given redistricting litigation and the instability of precinct-level shapefiles, v1 routes voters by **zip code → county**, not precinct. This is the right call because:

- Zip-to-county mapping is stable, reliable, and not subject to litigation
- County-level ballot data gets a voter 80–90% of what they need in the voting booth
- Statewide measures (the best-covered data) apply to everyone in the state regardless of precinct
- Precinct-level routing is a v2 feature once shapefiles settle post-redistricting

Use a static `zip-to-county.json` lookup file for routing. This file maps every US zip code to its FIPS county code. It's a one-time build, publicly available, and doesn't change unless zip codes are reassigned (rare).

### Monitoring unpublished ballots

For counties where ballots aren't published yet (like Catawba County NC saying "available in September"), set up a monitored source entry in the Airtable Sources table:

1. Add the county elections website URL to Sources
2. Set `Active monitoring = true`
3. Set `Source type = Official / Gov`
4. Add to the Make/Zapier RSS watcher or set a manual calendar reminder to check in August
5. When the ballot publishes, trigger the ingestion workflow: scrape → Airtable → AI summary → review → live

Don't leave these as open tabs to manually check. Put them in the system.

---

## Airtable Seed Checklist

This is the step-by-step to get from Marie-France's Ballotpedia spreadsheet to a working Airtable base ready to power the site.

### Step 1 — Create the base

1. Create a new Airtable base called `Show Me The Ballot — Data`
2. Create four tables: `Propositions`, `States`, `Coverage`, `Sources`
3. Build the field schema for each table using the Data Layer section above as the spec
4. Color-code the `Status` field options in Propositions: Raw (gray) → AI draft (yellow) → Needs review (orange) → Approved (blue) → Translating (purple) → Live (green) → Archived (dark gray)

### Step 2 — Seed the States table

Add all 8 priority battleground states first. For each state:
- [ ] State name + abbreviation
- [ ] FIPS code (from Battleground State Priority table above)
- [ ] Tier (Priority / Watch / Ready)
- [ ] Election date (Nov 4, 2026 for general)
- [ ] `Ballot finalized` = unchecked until confirmed
- [ ] State API endpoint (if one exists — Arizona and Michigan have open data portals)

### Step 3 — Import Ballotpedia data into Propositions

Take Marie-France's existing Ballotpedia spreadsheet and:
- [ ] Clean column headers to match Airtable field names: Title, State, Measure type, Official text
- [ ] Add a `Status` column — set everything to `Raw` on import
- [ ] Add a `County / district` column — leave blank for statewide measures
- [ ] Import via Airtable CSV import (top-left menu → Import data → CSV file)
- [ ] After import, link each row's State field to the correct States table record
- [ ] Verify row count matches the spreadsheet — Airtable sometimes truncates on large imports

### Step 4 — Create the editorial views

In the Propositions table, create these filtered views:
- [ ] **Ingestion queue** — filter: Status = Raw
- [ ] **Needs AI summary** — filter: Status = Raw, Official text is not empty
- [ ] **Needs review** — filter: Status = "AI draft"
- [ ] **Approved — needs translation** — filter: Status = Approved, ES summary is empty
- [ ] **Live** — filter: Status = Live
- [ ] **By state** — group by: State field
- [ ] **Journalist export** — hide internal fields (Review notes, Official text); show public fields only

### Step 5 — Seed the Sources table

Add the primary aggregation sources for each priority state. Start with:
- [ ] AP News (national — covers all states)
- [ ] Reuters (national)
- [ ] Each state's dominant local TV station (e.g. 12News AZ, 11Alive GA, 6ABC PA)
- [ ] Each state's dominant newspaper RSS feed
- [ ] Set `Active monitoring = true` for all of these
- [ ] Set `Credibility tier = Verified outlet`

Add county elections office websites for Tier 2 counties:
- [ ] One row per county elections site
- [ ] Set `Active monitoring = true`
- [ ] Set `Source type = Official / Gov`
- [ ] Set `Credibility tier = Verified outlet`

### Step 6 — Test the API connection

Before building the site against live data:
- [ ] Generate a read-only Airtable API key (Account → Developer Hub → Personal access tokens)
- [ ] Scope it to read-only on the SMTB base only
- [ ] Test a fetch call manually: `https://api.airtable.com/v0/{BASE_ID}/Propositions?filterByFormula=Status='Live'`
- [ ] Confirm the response shape matches what `airtable.js` expects
- [ ] Store the key in `.env` — never commit to GitHub

### Step 7 — First live record

Before bulk-processing anything, walk one proposition all the way through the full pipeline manually:
1. Pick one well-documented state measure (e.g. Arizona Prop 128)
2. Move it from Raw → write a plain-language summary → set reading grade → Status = Approved
3. Add Spanish translation → Status = Live
4. Confirm it appears in the Live view
5. Confirm the API fetch returns it correctly
6. Confirm it renders in the voter ballot card UI

This one-record dry run will surface any field mapping issues, API response mismatches, or UI rendering bugs before you're dealing with 300 rows.

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
- The battleground priority map has changed from the presidential-cycle list. The 2026 priority states are: **Michigan, Georgia, Wisconsin, North Carolina, Arizona, Pennsylvania** (Priority tier) and **Nevada, New Hampshire, Ohio, Iowa, Alaska, Maine, Texas, Florida, Kansas** (Watch tier). Update the `states-meta.json` and the dashboard `stateData` object accordingly — Pennsylvania and Arizona drop from Priority to Watch on the Senate map but stay Priority overall due to Governor races.
- Mobile-first for all voter-facing views. Desktop-first for journalist dashboard.
- WCAG 2.1 AA for all voter-facing views.
