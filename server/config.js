// Server configuration from environment (.env is loaded if present).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  root,
  port: int("PORT", 8787),
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY || "",
    baseUrl: (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
    model: process.env.NEMOTRON_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b",
    maxTokens: int("ACTIONS_MAX_TOKENS", 3000),
  },
  mongo: {
    uri: process.env.MONGODB_URI || "",
    db: process.env.MONGODB_DB || "earthdoctor",
  },
  actions: {
    // A country's suggestions are generated once, then served from cache this long.
    cacheHours: int("ACTIONS_CACHE_HOURS", 12),
    concurrency: int("ACTIONS_CONCURRENCY", 2),
  },
};

export function missingConfig() {
  const missing = [];
  if (!config.nvidia.apiKey) missing.push("NVIDIA_API_KEY");
  return missing;
}
