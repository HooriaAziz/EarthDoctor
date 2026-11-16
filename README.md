# Earth Doctor

Planetary intelligence workspace with a Cesium globe, live natural events,
weather and air quality, climate trends, and country-specific AI climate actions.

## Run the app

```bash
npm ci
npm run dev        # web app: http://localhost:5173
npm run server     # AI API: http://localhost:8787 (separate terminal)
```

The Vite development server proxies `/api/*` to the API server. In production,
the Node server serves the built frontend and API together.

Weather normally loads directly from Open-Meteo. If that browser request fails
or times out, the app retries through `/api/weather` on the Node server. Keep
`npm run server` running locally for this fallback. The retry button in Location
intelligence refreshes weather and air quality without reselecting a point.

## Deploy to Render

Push this repository to GitHub. In Render, choose New > Blueprint and connect
the repository. Render reads render.yaml and creates a Node web service.
Enter NVIDIA_API_KEY when prompted. Optionally add MONGODB_URI in the service's
Environment settings for persistent AI caching; allow Render's outbound IPs in
Atlas Network Access if using Atlas.

Render builds with `npm ci --include=dev && npm run build` and starts with
`npm run server`. It provides HTTPS and automatic deployments from the connected
branch. No Docker Hub, Vultr VM, SSH deployment keys or GitHub Actions are needed.
Keep secrets in Render's environment settings, never in GitHub source files.

## AI action suggestions

Select a country on the globe or use country search, then open the Take action
panel. NVIDIA Nemotron generates actions for individuals, families, schools,
neighborhoods, communities, and non-partisan civic/policy participation. Each
 action includes a reason and effort level. The panel also includes campaign
ideas, hashtags, and social posts you can copy or share.

Suggestions use the selected country's bundled EDGAR emissions profile, including
its largest emitting sectors. Check local facts before acting or posting.

### Setup

1. Copy `.env.example` to `.env` if you do not already have one.
2. Set `NVIDIA_API_KEY` and optionally `NEMOTRON_MODEL`.
3. Optionally set `MONGODB_URI` and `MONGODB_DB` for persistent caching. Without a
   working MongoDB connection, the server uses memory, which clears on restart.
4. Run `npm run server`. `/api/health` reports configuration and cache status.

Keys stay on the Node server; never add a `VITE_` prefix to secret variables.

### Generation and caching

Generation runs on demand for the selected country. A saved answer is reused for
`ACTIONS_CACHE_HOURS` (default 12 hours); the next request after expiry renews it.
Concurrent requests for the same country share one generation. Across countries,
`ACTIONS_CONCURRENCY` limits simultaneous generations (default 2), and
`ACTIONS_MAX_TOKENS` caps each model response. If renewal fails, an expired answer
is shown when available.

To pre-generate selected countries using the same cache:

```bash
npm run actions:generate -- USA IND NPL
```

### API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Configuration and cache status |
| `GET /api/weather?latitude=...&longitude=...` | Open-Meteo weather fallback for a selected point |
| `GET /api/actions/:code` | Generate or reuse actions for an EDGAR code, such as `IND` |

## Checks and data

Run `npm run lint` and `npm run build` to check the app.
Run `node --test src/liveEarthData.test.js server/weather.test.js server/actions.test.js`
to check weather recovery and AI action behavior.
`python scripts/extract_edgar_global.py` regenerates
`src/assets/edgarGlobalData.js` from the bundled EDGAR workbook.


