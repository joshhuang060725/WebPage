# JATSWeb Finance

## Product boundary

Finance is a public, read-only regional macro reference terminal for five frequently monitored regions:

- United States
- Hong Kong
- Mainland China
- Taiwan
- Singapore

It is not a brokerage surface, portfolio tracker, bank quote comparison service, prediction product, or personalized advice tool. It does not create accounts, accept financial uploads, place trades, or persist user financial data to a server.

The module remains `beta` while individual official adapters are added and reviewed. Missing upstream data is rendered as an explicit state; it is never replaced with an inferred or fabricated current value.

## Information architecture

`/finance.html` exposes eight hash-addressable views:

| Hash | Purpose |
| --- | --- |
| `#overview` | Five-region orientation, trust model, local clocks, and selected FX references |
| `#us` | U.S. market context, Treasury/rate indicators, inflation, and labor |
| `#hk` | Linked-rate conditions, HIBOR, prices, labor, and growth |
| `#cn` | Official source-linked snapshots for markets, LPR, prices, industry, and growth |
| `#tw` | TWSE context, TWD references, central-bank settings, money, prices, and growth |
| `#sg` | STI context, SGD references, SORA, government yields, prices, jobs, and growth |
| `#fx` | Daily conversion, cross-rate matrix, bounded reference history, and user-entered cost comparison |
| `#sources` | Canonical source and methodology register |

Source rows also support deep links such as `/finance.html#sources/us-treasury`.

## Canonical content model

`data/finance.json` is the canonical public registry. It contains:

- localized overview policy and disclosures;
- 38 indicator definitions across five regions;
- region currency and IANA time-zone identifiers;
- metric category, unit, cadence, availability mode, source ID, and upstream series code where reviewed;
- the supported FX currency set and curated reference pairs;
- 18 official, institutional, or attributed external sources.

`scripts/validate-content.mjs` checks:

- all five required regions and all required sections;
- complete `en`, `zh-TW`, and `zh-CN` localized fields;
- unique indicator and source IDs;
- market, FX, rate/monetary, and at least two macro indicators per region;
- valid source references and HTTPS source links;
- valid FX codes and pairs;
- China `official-snapshot` policy;
- stored numerical values only when an `asOf` date is present.

## Data modes

| Mode | Meaning |
| --- | --- |
| `official-api` | Documented, machine-readable public authority or exchange endpoint |
| `official-snapshot` | Reviewed authoritative release without assuming a stable public API |
| `institutional-feed` | Public reference aggregator with provider and date disclosure |
| `external-widget` | Attributed third-party market context loaded only after consent |

The interface does not label daily or monthly reference data as “live.”

## Read-only API

Cloudflare Pages Functions remain read-only:

```text
GET /api/finance/overview
GET /api/finance/regions/{us|hk|cn|tw|sg}
GET /api/finance/fx?base=USD&symbols=HKD,CNY,TWD,SGD
GET /api/finance/history?base=USD&symbol=TWD&range=1M
```

The FX endpoint accepts the same 12-currency allowlist shown by the browser tool:
`USD`, `HKD`, `CNY`, `TWD`, `SGD`, `EUR`, `JPY`, `GBP`, `KRW`, `AUD`, `CAD`, and `CHF`.
Each quote retains its own provider and `asOf` date; envelope-level `meta.asOf` is `null`
when a response combines dates.

The history endpoint accepts `7D`, `1M`, `3M`, and `1Y`. It returns an
ascending, bounded series of `{ "date": "YYYY-MM-DD", "rate": 0 }` points,
the actual contributing provider, and the covered window. Frankfurter is the
primary source where both currencies are supported; the official Fawaz mirror
is sampled as the fallback, including for TWD. A complete upstream failure is
an explicit non-cacheable `503`, not an empty successful chart.

All Finance endpoints return a common envelope:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "schemaVersion": "1.0",
    "endpoint": "/api/finance/fx",
    "sourceMode": "public-reference-rates",
    "asOf": "YYYY-MM-DD",
    "generatedAt": "ISO-8601",
    "sources": []
  }
}
```

Implementation rules:

- fixed region and currency allowlists;
- GET, HEAD, and OPTIONS only;
- bounded upstream timeouts;
- no upstream error or internal detail leakage;
- FX responses cache for six hours;
- overview and region contracts cache for 24 hours;
- failed responses use `no-store`;
- reviewed regional adapters currently cover U.S. Treasury and BLS, HKMA, TWSE, and Singapore SingStat;
- Mainland China remains source-linked and explicitly unavailable until a redistribution-safe adapter is reviewed;
- Frankfurter is the primary FX source;
- the official Fawaz Cloudflare Pages mirror fills unsupported or missing FX references;
- temporary failure of a configured regional adapter returns a non-cacheable `503`, while a deliberately unconfigured region remains an explicit source-linked state;
- restricted sources are not scraped or redistributed.

## Browser behavior

Versioned browser-local keys:

| Key | Purpose |
| --- | --- |
| `jats:finance:external-v1` | Explicit permission to load TradingView widgets |
| `jats:finance:fx-cache-v1` | Last successful reference-rate payload |
| `jats:finance:fx-prefs-v1` | Selected currencies and decimal precision |

FX cache policy:

- up to 24 hours: normal browser cache fallback;
- 24 hours to seven days: visibly stale fallback;
- over seven days: rejected;
- the upstream `asOf` date remains separate from the browser fetch and storage time.

The cost comparison uses only user-entered percentage fees, fixed fees, and optional quoted rates. It never synthesizes a bank, card, remittance, bid, or ask price.

## External widget consent

TradingView widgets:

- do not load before explicit consent;
- preserve TradingView attribution;
- may receive normal connection metadata such as IP address;
- are isolated from official macro indicators;
- fall back after eight seconds without hiding the official source and indicator content;
- can be revoked from the Sources view, which also unloads embedded frames.

## Accessibility and responsive behavior

- Desktop keeps the version 1.0 left-side JATS navigation rail, including its compact and expanded states.
- Finance views use a keyboard-operable tab list with Arrow, Home, and End keys.
- Mobile replaces the dense tab row with an equivalent view selector.
- Hash links remain shareable and back/forward compatible.
- Dynamic status uses `aria-live`.
- The FX history chart exposes its pair, range, dates, source, and a visible unavailable state; the adjacent cross-rate matrix is calculated from the same fetched daily reference set.
- Status uses text plus color; color is never the only signal.
- Reduced-motion preferences disable nonessential animation.
- The layout is tested at 360 px without document-level horizontal overflow.

## Verification

Required local commands:

```powershell
npm run validate:data
npm run check
npm test
npm run build
npm run test:e2e
```

Finance-specific coverage includes:

- input allowlists and payload normalization;
- cross-rate and inverse-rate consistency;
- conversion precision and invalid input;
- user-entered fee and quote scenarios;
- cadence-aware freshness;
- fresh, stale, expired, and invalid local caches;
- regional Function envelopes, allowlists, read-only methods, and SingStat series normalization;
- tabs, hash routes, source deep links, language changes, and mobile overflow;
- widget consent, loading, persistence, and revocation;
- refresh failure preserving the last verified FX result without leaving a false loading state;
- total FX source failure.

Production-preview Lighthouse acceptance is at least 90 for Performance, Accessibility, Best Practices, and SEO on desktop and mobile.
