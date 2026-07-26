# JATSWeb / Josh Huang Personal Portal

JATSWeb is Josh Huang's public personal portal and browser-based auxiliary terminal experiment.

Production:

```text
https://joshhuang.ccwu.cc/
```

The site is built with Astro as a static Cloudflare Pages project. Public content remains data-driven through `data/*.json`; Cloudflare Pages Functions provide controlled read-only APIs, and larger public assets may live in Cloudflare R2 behind the guarded asset proxy.

## Current Scope

The project currently includes:

- Personal profile and public identity page.
- Project listing and project detail renderer.
- Quick links and public tool directory.
- Wallpaper-style start surface with selectable backgrounds and shortcut tiles.
- Public file download metadata layer.
- YouTube browser page using a Cloudflare Pages Function proxy.
- Source-first regional Finance terminal for the U.S., Hong Kong, Mainland China, Taiwan, and Singapore, including a browser-side FX cost lab.
- Compute Lab for browser-side expressions, matrices, and quick charts.
- UX Lab concept record for the JATS design system.
- Formula Lab with searchable formula cards, detailed derivation pages, KaTeX math, and Plotly/math.js interactive plots.
- Standalone flower language personality test.
- Preserved legacy Four Seasons Flowers and Zhu Bloom source/assets (outside the current professionalization scope and not added to portal navigation).
- Standalone Christmas Tree economic visualization.
- Cloudflare Pages Functions for YouTube search, guarded R2 asset reads, and quota status.

## Architecture

```text
WebPage/
|-- src/
|   |-- components/       # shared localized UI and formula renderers
|   |-- layouts/          # shared JATS portal shell and left collapsible navigation rail
|   |-- lib/              # content and compute utilities
|   |-- pages/            # Astro static routes and generated detail pages
|   `-- styles/           # design tokens and shared responsive system
|-- data/                 # public JSON source of truth
|-- assets/               # public images and downloads
|-- functions/            # Cloudflare Pages Functions
|-- tests/                # Vitest and Playwright coverage
|-- scripts/              # content and production-build validation
|-- docs/                 # architecture and maintenance references
|-- *.html / *.css        # preserved standalone microsite sources
|-- astro.config.mjs
|-- package.json
`-- dist/                 # generated production output (ignored)
```

## Data Model

The public pages should treat `data/*.json` as the source of truth.

Current data inventory:

| File | Purpose |
| --- | --- |
| `data/profile.json` | Profile summary, tags, public contacts |
| `data/projects.json` | Project cards and project detail content |
| `data/shortcuts.json` | Quick links page data |
| `data/tools.json` | Tool directory entries |
| `data/wallpapers.json` | Wallpaper backgrounds and shortcut tiles |
| `data/files.json` | Public file metadata and storage provider info |
| `data/i18n.json` | Shared UI copy for `en`, `zh-TW`, and `zh-CN` |
| `data/formulas.json` | Formula Lab categories, cards, derivations, plots |
| `data/flower-language-test.json` | Flower test questions and 64 result profiles |

Astro reads shared JSON during the static build and copies the public datasets into the production output for compatible standalone pages. `scripts/validate-content.mjs` checks JSON validity, multilingual field parity, IDs, and referenced local assets.

## Public / Private Boundary

Public pages may expose:

- Public profile information.
- Public project descriptions.
- Public links and tool entries.
- Public downloadable asset URLs.
- Browser-side API calls to approved public endpoints.
- Cloudflare Pages Function routes that return sanitized public JSON.

Public pages must not expose:

- API keys, tokens, secrets, or `.env` values.
- Cloudflare Tunnel private URLs.
- R2 credentials or direct private bucket access.
- Local admin routes or local network services.
- Upload, delete, or write APIs.

`YoutubeKey.txt` and `.env*` are ignored and must stay out of Git.

## Asset Strategy

Small public assets may be committed under `assets/`.

Large public files should use Cloudflare R2 and be represented by metadata in `data/files.json`.

Recommended guarded R2 public route:

```text
https://files.joshhuang.ccwu.cc/api/assets/<r2-object-key>
```

The guarded asset proxy is implemented at:

```text
functions/api/assets/[[path]].js
```

It reads from the `ASSETS_BUCKET` binding and applies quota accounting through `functions/_lib/quota-guard.js`.

## Cloudflare Pages Functions

Current API routes:

| Route | File | Purpose |
| --- | --- | --- |
| `/api/youtube/search` | `functions/api/youtube/search.js` | Validates search query, applies quota, calls YouTube Data API, returns sanitized video data |
| `/api/assets/*` | `functions/api/assets/[[path]].js` | Reads R2 public assets through the quota guard |
| `/api/quota/status` | `functions/api/quota/status.js` | Returns current quota guard status |
| `/api/finance/overview` | `functions/api/finance/overview.js` | Returns the five-region coverage and availability contract |
| `/api/finance/regions/:region` | `functions/api/finance/regions/[region].js` | Returns a source-safe regional snapshot contract for `us`, `hk`, `cn`, `tw`, or `sg` |
| `/api/finance/fx` | `functions/api/finance/fx.js` | Returns allowlisted daily reference FX rates with Frankfurter primary and official Fawaz mirror fallback |
| `/api/finance/history` | `functions/api/finance/history.js` | Returns bounded `7D`, `1M`, `3M`, or `1Y` FX reference history with provider attribution |

`functions/api/_middleware.js` counts API requests and appends quota headers.

Required Cloudflare bindings:

```text
USAGE_KV=<Workers KV namespace binding>
ASSETS_BUCKET=<R2 bucket binding>
```

Required / optional environment variables:

```text
YOUTUBE_API_KEY=<set in Cloudflare Pages>
ENFORCE_QUOTA_GUARD=true
LIMIT_API_DAILY_REQUESTS=90000
LIMIT_YOUTUBE_DAILY_UNITS=9000
LIMIT_R2_MONTHLY_CLASS_B=9000000
```

## Local Development

Install dependencies and start the full Cloudflare Pages development server:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8788/
```

`npm run dev` builds the Astro static output, then serves both `dist/` and
`functions/` through Wrangler so the Finance and YouTube API routes work
locally. Use `npm run dev:astro` on port `4321` only for UI-only iteration;
Pages Functions are not available in that mode. Do not use `file://`.
Production output is generated under `dist/`.

## QA Checklist

Run the automated validation suite:

```powershell
npm run validate:data
npm run check
npm test
npm run build
npm run test:e2e
```

Manual page checks:

```text
/
/profile.html
/projects.html
/project.html?id=personal-portal
/links.html
/tools.html
/files.html
/wallpapers.html
/youtube.html
/finance.html
/compute-lab.html
/ux-lab.html
/formulas.html
/formula.html?id=euler-phasors
/formulas/euler-phasors.html
/flower-language-test.html
/four-seasons-flowers.html
```

Check desktop, tablet, and mobile layouts. Confirm language switching, theme switching, JSON loading, fallback states, and external API failure states.

## Formula Lab

`formulas.html` renders the formula index from `data/formulas.json`.

`formulas/<formulaId>.html` renders the static, indexable derivation. The old `formula.html?id=<formulaId>` route redirects for compatibility, while `formula-interactive.html?id=<formulaId>` preserves the Plotly/math.js interactive renderer.

- Localized title, summary, tags, and category.
- Structured derivation sections.
- KaTeX math rendering.
- Plotly-based browser-side plots.
- Plot handlers in `js/formula-detail.js`.

Current formula dataset:

```text
categories: 6
items: 20
```

To rebuild the first-pass formula data from the generation script:

```powershell
node scripts\build-formulas-data.js
```

Formula maintenance details are in:

```text
docs/FORMULA_LAB_MAINTENANCE.md
```

## YouTube Browser

`youtube.html` is a public search and playback interface.

Flow:

```text
youtube.html
|-- js/youtube.js
|   |-- reads search form input
|   |-- uses localStorage cache for repeated queries
|   |-- calls /api/youtube/search only after user search
|   `-- controls the YouTube IFrame Player API
`-- functions/api/youtube/search.js
    |-- validates q, lang, and region
    |-- reads env.YOUTUBE_API_KEY
    |-- applies YouTube quota accounting
    |-- calls YouTube Data API search.list
    `-- returns sanitized video items
```

Quota posture:

- No auto polling.
- No automatic recommendation chain.
- Search only runs after user submission.
- Browser and Function responses cache repeated queries.

## Finance Module

`src/pages/finance.astro` is a source-first regional macro reference terminal. It covers:

- United States
- Hong Kong
- Mainland China
- Taiwan
- Singapore

The route preserves `/finance.html` and provides eight hash-addressable views:

```text
#overview
#us
#hk
#cn
#tw
#sg
#fx
#sources
```

Core data and behavior:

- `data/finance.json` defines 38 regional indicators and 18 entries in the canonical source registry.
- Each indicator declares a source, category, update cadence, unit, and access mode.
- Data modes are explicit: `official-api`, `official-snapshot`, `institutional-feed`, and `external-widget`.
- Reviewed live adapters cover U.S. Treasury and BLS, HKMA, TWSE, and Singapore SingStat; mixed-cadence responses retain per-item dates.
- China entries stay source-linked official snapshots unless a documented stable public API is reviewed.
- TradingView market widgets load only after explicit browser-local consent and remain attributed.
- The FX Lab supports a fixed 12-currency allowlist, preserves each quote's actual Frankfurter or Fawaz provider and date, uses browser-local last-success caching, and accepts only user-entered fee/spread scenarios.
- No module value is presented as a real-time quote, executable price, trading signal, forecast, or investment recommendation.

Local Finance preferences use versioned browser keys:

```text
jats:finance:external-v1
jats:finance:fx-cache-v1
jats:finance:fx-prefs-v1
```

The detailed source policy, API contract, cache behavior, and maintenance checklist are documented in `docs/FINANCE.md`.

## Wallpaper Surface

`wallpapers.html` is a dedicated desktop-surface interface.

Data comes from:

```text
data/wallpapers.json
```

Current inventory:

```text
backgrounds: 4
links: 18
```

Rules:

- Wallpaper assets must use public static paths or guarded public asset URLs.
- Shortcut tiles must stay public-safe.
- Do not add admin dashboards, local service URLs, tokens, or private links.

## Flower Language Test

`flower-language-test.html` is a standalone class-project page with its own CSS and JS.

Data comes from:

```text
data/flower-language-test.json
```

Current inventory:

```text
questions: 6
results: 64
```

This page does not use the shared portal shell.

## Four Seasons Flowers

`four-seasons-flowers.html` is a standalone, storybook-style instant flower-growing tool. It has its own CSS, JavaScript, data file, and generated WebP assets.

Data comes from:

```text
data/four-seasons-flowers.json
```

The flow is pot selection, flower selection, and a persistent garden view. Watering and fertilizing advance growth through seedling, growing, and bloom stages; photos and all progress are stored locally under the versioned `fourSeasonsFlowers:v1` key. The settings dialog provides the only reset path.

This page does not use the shared portal shell and does not send progress to a server.

## Cloudflare Pages Settings

Recommended Pages settings:

```text
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Production branch: main
```

Routing:

```text
_routes.json includes /api/* for Pages Functions.
```

Headers:

```text
_headers sets nosniff globally and no-cache revalidation for CSS, JS, and data files.
```

## Maintenance Rules

When editing content:

1. Prefer editing `data/*.json` for public content.
2. Keep `en`, `zh-TW`, and `zh-CN` semantically aligned where localized fields exist.
3. Validate JSON before previewing.
4. Preview through the Astro development server.
5. Update the generated sitemap route when adding or removing public pages.
6. Keep public/private boundaries intact.
7. Do not commit secrets, local logs, generated temp files, or oversized assets.

When editing behavior:

1. Keep shared portal behavior in `src/layouts/` and shared components.
2. Keep page-specific behavior in the matching Astro page.
3. Keep legacy interactive formula plot logic in `js/formula-detail.js`.
4. Keep Cloudflare-only behavior inside `functions/`.
5. Run syntax checks before publishing.

## Current Verified State

As of 2026-07-26, the following checks pass locally:

- JSON, multilingual parity, ID, and local asset validation.
- Astro strict type checks and production build.
- Required route, metadata, and internal-link validation.
- Vitest coverage for Compute Lab plus Finance input allowlists, regional and FX Function contracts, provider/date normalization, conversion, cost comparison, freshness, cache handling, and quota-safe failure envelopes.
- Playwright coverage for preferences, Compute Lab, legacy detail redirects, Finance tabs and deep links, FX provenance plus success/failure refresh behavior, dynamic language, 360 px layout, and external-widget consent.
- Finance Lighthouse production-preview scores meet the ≥90 acceptance target in all four categories on desktop and mobile.

Current working tree note:

- `server.log` and `server.err.log` are untracked local runtime files.
