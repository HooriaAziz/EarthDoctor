// Suggestion cache. MongoDB Atlas is the store of record; if it is not
// configured or unreachable, an in-memory map keeps the feature working
// (per server process, lost on restart) and Mongo is retried periodically.
import { config } from "./config.js";
import { collections } from "./db.js";

const memory = new Map();
let mongoDownUntil = 0;
let lastMongoError = null;

export function mongoConfigured() {
  const uri = config.mongo.uri;
  // Treat the Atlas template placeholder (<db_password>) as "not configured".
  return Boolean(uri) && !/[<>]/.test(uri);
}

function mongoUsable() {
  return mongoConfigured() && Date.now() >= mongoDownUntil;
}

function markMongoDown(error) {
  lastMongoError = error?.message?.slice(0, 200) || "connection failed";
  mongoDownUntil = Date.now() + 60_000; // retry after a minute
  console.warn(`[cache] MongoDB unavailable, using memory cache: ${lastMongoError}`);
}

export async function cacheGet(code) {
  if (mongoUsable()) {
    try {
      const { actions } = await collections();
      const doc = await actions.findOne({ _id: code, generatedAt: { $exists: true } });
      if (doc) return { doc, storage: "mongodb" };
      // Fall through: a memory entry may exist from a period when Mongo was down.
    } catch (error) {
      markMongoDown(error);
    }
  }
  const doc = memory.get(code);
  return doc ? { doc, storage: "memory" } : { doc: null, storage: mongoUsable() ? "mongodb" : "memory" };
}

export async function cacheSet(code, doc) {
  memory.set(code, doc);
  if (!mongoUsable()) return "memory";
  try {
    const { actions } = await collections();
    await actions.updateOne({ _id: code }, { $set: doc }, { upsert: true });
    return "mongodb";
  } catch (error) {
    markMongoDown(error);
    return "memory";
  }
}

export function cacheStatus() {
  return {
    storage: mongoUsable() ? "mongodb" : "memory",
    mongoConfigured: mongoConfigured(),
    lastMongoError: mongoUsable() ? null : mongoConfigured() ? lastMongoError : "MONGODB_URI not set (or still contains <db_password>)",
    memoryEntries: memory.size,
  };
}
