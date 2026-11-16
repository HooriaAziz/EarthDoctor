# Earth Doctor agent guide

## Project

Earth Doctor is a React/Vite environmental monitoring app with a Cesium globe,
public scientific feeds, EDGAR emissions profiles, and country-specific AI
climate actions. The backend is a Node.js HTTP server using NVIDIA Nemotron
and optional MongoDB caching. Use Node 22 and the committed npm lockfile.

## Main locations

- `src/App.jsx` and `src/App.css`: application composition and shared styling.
- `src/components/`: panels and reusable UI.
- `src/liveEarthData.js` and `src/hooks/useEarthData.js`: weather, air quality,
  natural events, and location fetching.
- `src/assets/edgarData.js` and `edgarGlobalData.js`: bundled emissions data
  imported by both the frontend and backend.
- `server/`: AI generation, validation, caching, API routes, and static serving.
- `public/cesiumStatic/`: Cesium runtime resources; preserve their paths.
- `render.yaml`: production hosting configuration.

## Development and checks

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```text
npm.cmd ci
npm.cmd run dev
npm.cmd run server
npm.cmd run build
npm.cmd run lint
node --test server/actions.test.js
```

Run the development frontend and backend in separate terminals. Vite normally
uses port 5173 and proxies `/api` to port 8787. Check existing listeners before
starting duplicates; report the actual frontend URL if Vite chooses another port.

Run checks appropriate to the change. Report unrelated existing failures
separately; do not disable lint rules or change unrelated code just to pass.
Add meaningful tests for behavioral changes, not tests that mirror trivial edits.

## Deployment

The current deployment target is Render's native Node runtime. Keep this setup
simple; do not reintroduce Docker, Vultr scripts, or GitHub Actions deployment
unless requested.

Render builds with `npm ci --include=dev && npm run build` and starts with
`npm run server`. The Node server serves `dist` and `/api` together, reads the
platform's `PORT`, and exposes `/api/health`. Preserve API JSON 404 responses,
static file content types, and protection against filesystem path traversal.
Vite's development proxy does not provide production API routing.

## Secrets and external data

- Never print, commit, or embed `.env` contents, API keys, database passwords,
  or SSH credentials. Use `.env.example` for documented placeholders.
- `NVIDIA_API_KEY` belongs only on the backend. Do not use a `VITE_` prefix for
  secrets. Production credentials belong in Render environment settings.
- `MONGODB_URI` is optional; the existing memory fallback loses its cache on
  restart. Do not claim persistent caching when MongoDB is unavailable.
- Weather and air-quality requests currently go directly from the browser to
  Open-Meteo. Distinguish browser/network failures from API HTTP errors and
  deployment failures. Do not infer an outage from a sandbox-blocked request.
- Preserve source attribution, units, timestamps, loading states, and partial
  failures. Never replace failed live data with fabricated measurements.

## AI action behavior

Keep suggestions tied to the selected country's factual EDGAR context. Preserve
all action levels: individual, family, school, neighborhood, community, political.
Political suggestions must remain non-partisan civic participation.

Keep response validation, the approved campaign catalog, request deduplication,
cache expiry, and generation concurrency limits. Never invent emissions figures,
laws, organizations, or claims of verified local availability. Clearly label
AI suggestions and stale cached results.

## Working conventions

Preserve the user's existing changes. Prefer focused edits and existing UI
patterns. Avoid editing generated bundles, vendor assets, or large datasets
unless the task requires it. Keep the README and deployment configuration aligned
with actual commands and behavior. State what was verified and what remains
unverified; do not claim a deployment is live merely because its files exist.
