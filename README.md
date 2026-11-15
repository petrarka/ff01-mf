[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/petrarka/ff01-mf/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/petrarka/ff01-mf/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# The build board

An independent, read-only make.fun frontend for people looking for something worth building. A dark canvas, warm type and lime accents put the challenges, live reward pots and the builders’ work up front.

Everything is handwritten vanilla JavaScript, HTML and CSS. There are no packages, remote fonts or build tools. The app reads only make.fun’s public GET endpoints; it never signs in or sends writes.

## Run locally

```sh
cd app && python3 -m http.server 8787
```

Open `http://localhost:8787/#/` in a modern browser. Each surface also opens directly:

- `#/` — live bounty board, search, category/status filters and sorting. Pots include entry fees; deadlines distinguish accepting entries, closing soon and closed bounties.
- `#/bounty/threejs-fps-01` — the brief, readable description, rules, reward distribution and dates.
- `#/bounty/makefun-frontend-01/leaderboard` — public scores and ranks, linked to each builder. Provisional and withheld results are identified.
- `#/u/luxdevelops` — a public profile, competition record and entries. The handle field opens any public builder profile.

The header, bounty cards, overview tabs, ranking rows and profile entries connect all four surfaces. Long lists render in batches. Loading, empty and failed requests have clear states, and failures offer Retry. Saved responses remain visible with a warning if a live update fails.

## Entry program

Use Node.js 22.18 or later. From the repository root:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

With no environment variable, the output directory is `/output`. The program recursively copies `app/` and `screenshots/` and writes `dossier.json` using the unchanged vendor `buildDossier`. It needs no network, and prints the dossier’s measured Totals line. The same source and screenshots produce the same dossier bytes.

## Implementation

`app.js` only routes and starts the application. Its four literal dynamic imports keep route modules outside the first-load dependency graph. Those modules share `api.js` and `ui.js`, loaded when a view is needed.

`api.js` owns every API request. It keeps response bodies and ETags in memory and session storage, coalesces concurrent requests for the same resource, sends `If-None-Match` on revisits, and reuses the stored body on HTTP 304. Storage failure does not stop the app. Requests have a timeout; stale data is visibly marked. Refresh and Retry revalidate the same endpoint.

The board follows API cursors when more results exist. The leaderboard requests the compact first-page response and uses both its full and summary rows, preserving API order, ranks and score text. Profiles render their public solutions in batches. Descriptions are escaped before a small Markdown formatter handles headings, paragraphs, lists, emphasis and code; remote HTML, images and scripts are never injected.

The interface includes semantic landmarks, labelled controls, keyboard focus styles, responsive phone layouts and reduced-motion support. Each route sets `window.__shotReady` to false before loading and true after the data or error state has rendered.

`shots.json` lists the three real desktop screenshots and their routes and viewport sizes. Screenshots contain live API data at capture time; they are not fixtures or a fallback dataset.

## Checks

Run `node --test tests/api.test.mjs` for the cache, retry, storage and safe-rendering checks. The completed app was also checked in headless Chrome at desktop and phone widths, including real server interruption, offline recovery and all four live routes.

## License

MIT. See [LICENSE](LICENSE).
