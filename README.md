[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/petrarka/ff01-mf/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/petrarka/ff01-mf/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# Fieldwork

Fieldwork is a small, independent window into make.fun: a live bounty board, readable competition briefs, compact standings and public builder profiles. Warm charcoal, muted green and amber make the numbers easy to scan. Everything is written in vanilla JavaScript and served as static files. There are no dependencies, installs or build steps.

## Open the app

```sh
cd app && python3 -m http.server 8787
```

Visit `http://localhost:8787/#/`. The navigation connects all four surfaces:

- `#/` — search, filter and sort bounties by their live pot, deadline and entry count.
- `#/bounty/makefun-frontend-01` — brief, rules, fee, dates and current reward distribution.
- `#/bounty/makefun-frontend-01/leaderboard` — every public standing, in pages of 25, 50 or 100. Search by handle or title; switch development and final phases.
- `#/u/haski007` — public avatar, competition record, submissions and payouts. Every entrant links to their own profile.

The client only sends public GET requests to make.fun. No account, API key or secret is needed. API responses are cached in memory and sessionStorage, with ETag revalidation and 304 handling. Storage failures leave networking usable; network failures show an explicit Retry action. If an API edge omits CORS headers on a conditional response, the client retries and uses browser-managed revalidation for the rest of the session. Chrome may report that upstream CORS rejection in its console; it does not interrupt the view. Each route imports its view on demand. The initial shell contains no route modules, fonts, image downloads or third-party scripts.

Judge scores in millionths are displayed as percentages. Other competitions retain their published metric and unit. Prize projections use the API’s reward place and live fee-adjusted schedule; they are labelled provisional until results are published. A closed deadline takes precedence over an API status still marked open. The board and profile lists paginate, and standings render only the selected page. Standings show 25 complete 28-pixel rows at the supplied 1280 × 1000 desktop capture; smaller screens keep the header visible inside a scrolling table.

## Package the entry

Use Node.js 22.18 or later:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory, imports the unchanged vendor dossier builder and writes deterministic `dossier.json` bytes. Without `MAKEFUN_OUTPUT_DIR` the output directory is `/output`. It prints the dossier’s load totals. No network access is used during packaging.

`shots.json` records the three live browser captures. The first image is the cover. Routes set `window.__shotReady` to false when loading and true after rendering, including a rendered error state. Public data changes over time, so live values can differ from the captures.

## License

MIT. See LICENSE.
