# Earth Doctor

Planetary intelligence workspace with a Cesium globe, live natural events,
weather and air quality, climate trends, and country-specific AI climate actions.

## Run the app

```bash
npm ci
npm run dev        # web app: http://localhost:5173
npm run server     # AI API: http://localhost:8787 (separate terminal)
```

The Vite development server proxies `/api/*` to the API server. For production,
route `/api/*` to the Node server alongside the built frontend.

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
| `GET /api/actions/:code` | Generate or reuse actions for an EDGAR code, such as `IND` |

## Checks and data

Run `npm run lint` and `npm run build` to check the app.
`python scripts/extract_edgar_global.py` regenerates
`src/assets/edgarGlobalData.js` from the bundled EDGAR workbook.

## Docker deployment to Vultr

Create an Ubuntu x86-64 VM, install Docker Engine + Compose, curl and flock.
Create a `deploy` user with Docker access (administrative host access), own
`/opt/earthdoctor`, and allow inbound TCP 22 and 80. Install your deployment SSH
public key in that user's authorized_keys. Verify its host key using the Vultr
console before saving a known_hosts entry.

Create a private Docker Hub repository `USERNAME/earthdoctor`. Create a Read &
Write token for CI and a separate Read token for the VM. As deploy on the VM,
run `docker login -u USERNAME` and enter the Read token.

GitHub Settings > Secrets and variables > Actions:
- Secrets: DOCKERHUB_TOKEN, VULTR_SSH_PRIVATE_KEY, VULTR_SSH_KNOWN_HOSTS.
- Variables: DOCKERHUB_USERNAME, VULTR_HOST, VULTR_USER=deploy, VULTR_SSH_PORT=22.

Create `/opt/earthdoctor/app.env` on the VM using .env.example. Set NVIDIA_API_KEY
and optionally MONGODB_URI; chmod 600 app.env. Allow the VM IP in Atlas if used.
No app keys belong in the image or workflow. No Vultr API key is needed.

Push to main to test, publish an immutable Docker image and deploy it over SSH.
PR builds do not publish or deploy. The app is served at http://VM_IP; add TLS
before using the deployment for sensitive traffic. Brief deployment downtime is
expected. Failed readiness checks restore the previous image when available.
Full-repo lint currently has unrelated EarthGlobe/trendAnalysis errors; CI checks
the server and AI integration explicitly.

Manual rollback on the VM:
```bash
cd /opt/earthdoctor
bash deploy.sh "$(cat previous-image)"
```
