// Earth Doctor API server. Serves AI action suggestions per country:
// generated once with Nemotron on first request, then cached (MongoDB Atlas,
// with an in-memory fallback) for ACTIONS_CACHE_HOURS. Start: `npm run server`.
import { createServer } from "node:http";
import { config, missingConfig } from "./config.js";
import { closeDb } from "./db.js";
import { getOrGenerate } from "./actions.js";
import { cacheStatus } from "./cache.js";
import { listCountries } from "./countryContext.js";

const COUNTRY_CODES = new Set(listCountries().map((c) => c.code));

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

// Only the fields the UI needs (no token usage or internal hashes).
function publicDoc(doc) {
  const { code, name, summary, levels, hashtags, posts, movements, input, co2, model, generatedAt, expiresAt } = doc;
  return { code, name, summary, levels, hashtags, posts, movements: movements ?? [], input, co2, model, generatedAt, expiresAt };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      const missing = missingConfig();
      return send(res, 200, {
        ok: missing.length === 0,
        missing,
        model: config.nvidia.model,
        cacheHours: config.actions.cacheHours,
        cache: cacheStatus(),
      });
    }

    const match = url.pathname.match(/^\/api\/actions\/([A-Za-z]{3})$/);
    if (req.method === "GET" && match) {
      const code = match[1].toUpperCase();
      if (!COUNTRY_CODES.has(code)) return send(res, 404, { error: "unknown-country" });
      if (missingConfig().length) return send(res, 503, { error: "not-configured", missing: missingConfig() });

      try {
        const { doc, cache, storage } = await getOrGenerate(code);
        const maxAge = Math.max(0, Math.floor((new Date(doc.expiresAt ?? 0).getTime() - Date.now()) / 1000));
        return send(
          res,
          200,
          { ...publicDoc(doc), cache, storage, cacheHours: config.actions.cacheHours },
          // Let the browser reuse it too, never beyond the server-side expiry.
          { "Cache-Control": cache === "stale" ? "no-store" : `private, max-age=${Math.min(maxAge, 1800)}` }
        );
      } catch (error) {
        console.error(`[actions] ${code} failed: ${error.message}`);
        return send(res, 502, { error: "generation-failed", detail: String(error.message).slice(0, 200) });
      }
    }

    return send(res, 404, { error: "not-found" });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "server-error" });
  }
});

server.listen(config.port, () => {
  const missing = missingConfig();
  const cache = cacheStatus();
  console.log(`Earth Doctor API on http://localhost:${config.port}`);
  console.log(`  model: ${config.nvidia.model} · cache: ${config.actions.cacheHours} h · storage: ${cache.storage}`);
  if (missing.length) console.warn(`  Missing in .env: ${missing.join(", ")} — suggestions are disabled until set.`);
  if (cache.storage === "memory") console.warn(`  MongoDB not in use (${cache.lastMongoError}). Caching in memory until fixed.`);
});

async function shutdown() {
  server.close();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
