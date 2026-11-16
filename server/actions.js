// Generates and caches per-country climate-action suggestions.
import { config } from "./config.js";
import { chat } from "./nemotron.js";
import { cacheGet, cacheSet } from "./cache.js";
import { contextHash, countryContext, fetchLatestCo2 } from "./countryContext.js";
import { MOVEMENTS, MOVEMENT_BY_ID } from "./movements.js";

export const LEVELS = ["individual", "family", "school", "neighborhood", "community", "political"];
const PLATFORMS = ["x", "instagram", "facebook", "linkedin"];
const PROMPT_VERSION = 4;

const SYSTEM_PROMPT = `You are an environmental-action advisor for a scientific monitoring app.
You write practical, specific, positive suggestions for people in one country.
Rules:
- Use ONLY the statistics given in the user message. Never invent numbers, studies, laws, programmes, organisations or quotes.
- Tailor actions to the country's largest emission sectors and situation.
- The "political" level must be strictly non-partisan civic participation (e.g. contacting representatives, public consultations, voting on local measures, supporting transparent reporting). Never endorse or attack parties, politicians or candidates.
- Actions must be legal, safe and achievable. No shaming.
- Social posts: friendly, factual, under 260 characters each, may cite only the given figures, no links, no emojis spam (at most two emojis).
- Hashtags: 6 to 10, each starting with #, no spaces, include one with the country name.
- Movements: choose only from the provided list, by its exact id. Never name any other organisation or campaign.
- Respond with a single JSON object and nothing else.`;

function userPrompt(ctx, co2) {
  const schema = {
    summary: "1–2 sentences on what matters most for this country (≤ 300 chars)",
    levels: Object.fromEntries(
      LEVELS.map((level) => [level, [{ action: "short imperative title (≤ 80 chars)", why: "one sentence linking to the data (≤ 200 chars)", effort: "low | medium | high" }]])
    ),
    hashtags: ["#Example"],
    posts: [{ platform: "x | instagram | facebook | linkedin", text: "post text" }],
    movements: [{ id: "id from the movements list", why: "why it fits this country (≤ 160 chars)", how: "one concrete way to take part (≤ 160 chars)" }],
  };
  return `Country data (EDGAR 2026 greenhouse-gas inventory, GWP-100, excludes land use):
${JSON.stringify(ctx, null, 1)}
${co2 ? `Latest atmospheric CO₂ (${co2.source}, ${co2.year}-${String(co2.month).padStart(2, "0")}): ${co2.ppm} ppm` : ""}

Give exactly 3 actions for EACH level: ${LEVELS.join(", ")}. Keep every string short.
Give 4 social media posts (one per platform: ${PLATFORMS.join(", ")}).
Pick the 4 movements most relevant to this country's largest sectors from this list (use the id):
${MOVEMENTS.map((m) => `- ${m.id}: ${m.name} (${m.focus})`).join(String.fromCharCode(10))}
Return JSON exactly in this shape:
${JSON.stringify(schema)}`;
}

// ------------------------------------------------------------------ parsing

function extractJson(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const str = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export function validate(raw, ctx) {
  const levels = {};
  for (const level of LEVELS) {
    const items = Array.isArray(raw?.levels?.[level]) ? raw.levels[level] : [];
    levels[level] = items
      .map((item) => ({
        action: str(item?.action, 120),
        why: str(item?.why, 260),
        effort: ["low", "medium", "high"].includes(String(item?.effort).toLowerCase()) ? String(item.effort).toLowerCase() : "medium",
      }))
      .filter((item) => item.action.length >= 4)
      .slice(0, 5);
    if (levels[level].length < 2) throw new Error(`Too few actions for level "${level}"`);
  }

  const hashtags = [
    ...new Set(
      (Array.isArray(raw?.hashtags) ? raw.hashtags : [])
        .map((tag) => `#${String(tag).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`)
        .filter((tag) => tag.length > 2 && tag.length <= 40)
    ),
  ].slice(0, 10);
  if (hashtags.length < 4) throw new Error("Too few hashtags");

  const posts = (Array.isArray(raw?.posts) ? raw.posts : [])
    .map((post) => ({
      platform: PLATFORMS.includes(String(post?.platform).toLowerCase()) ? String(post.platform).toLowerCase() : "x",
      text: str(post?.text, 600),
    }))
    .filter((post) => post.text.length >= 20)
    .slice(0, 6);
  if (posts.length < 2) throw new Error("Too few social posts");

  // Movements: ids must be on the verified list; display fields come from it.
  const seen = new Set();
  const movements = (Array.isArray(raw?.movements) ? raw.movements : [])
    .map((item) => {
      const known = MOVEMENT_BY_ID.get(String(item?.id || "").trim().toLowerCase());
      if (!known || seen.has(known.id)) return null;
      seen.add(known.id);
      return { id: known.id, name: known.name, when: known.when, hashtag: known.hashtag, why: str(item?.why, 220), how: str(item?.how, 220) };
    })
    .filter(Boolean)
    .slice(0, 5);

  return {
    summary: str(raw?.summary, 400) || `Climate actions for ${ctx.name}.`,
    levels,
    hashtags,
    posts,
    movements,
  };
}

// ------------------------------------------------------------------ generation

export async function generateForCountry(code, { co2 = null } = {}) {
  const ctx = countryContext(code);
  if (!ctx) throw new Error(`Unknown country code ${code}`);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(ctx, co2) },
  ];

  let first = await chat(messages);
  let usage = [first.usage];
  let parsed;
  try {
    parsed = validate(extractJson(first.content), ctx);
  } catch (error) {
    // One retry. If the reply was cut off at the token limit, ask again for a
    // shorter answer; otherwise send the invalid output back for repair.
    const truncated = first.finishReason === "length";
    const retryMessages = truncated
      ? [
          ...messages,
          { role: "user", content: "Your previous reply was cut off. Answer again with the complete JSON, using shorter strings (titles under 60 characters, reasons under 110 characters)." },
        ]
      : [
          ...messages,
          { role: "assistant", content: first.content.slice(0, 6000) },
          { role: "user", content: `That response was invalid (${error.message}). Reply again with ONLY the complete JSON object in the requested shape.` },
        ];
    const retry = await chat(retryMessages, { temperature: 0.3 });
    usage.push(retry.usage);
    parsed = validate(extractJson(retry.content), ctx);
    first = retry;
  }

  return {
    data: parsed,
    input: ctx,
    co2,
    model: first.model,
    usage: usage.filter(Boolean),
    inputHash: contextHash(ctx, { co2Month: co2 ? `${co2.year}-${co2.month}` : null, v: PROMPT_VERSION }),
  };
}

// ------------------------------------------------------------------ on-demand cache

const inflight = new Map(); // code -> Promise (one generation per country at a time)
let active = 0;
const waiters = [];

async function withSlot(fn) {
  // Global cap on simultaneous model calls.
  if (active >= config.actions.concurrency) await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

// The CO₂ context value changes monthly; fetch it at most once per 12 hours.
let co2Cache = { at: 0, value: null };
async function latestCo2() {
  if (Date.now() - co2Cache.at > 12 * 3600 * 1000) {
    co2Cache = { at: Date.now(), value: (await fetchLatestCo2()) ?? co2Cache.value };
  }
  return co2Cache.value;
}

function isFresh(doc) {
  if (!doc?.generatedAt) return false;
  const age = Date.now() - new Date(doc.generatedAt).getTime();
  return age < config.actions.cacheHours * 3600 * 1000 && doc.promptVersion === PROMPT_VERSION;
}

/**
 * Returns cached suggestions for a country, generating them with Nemotron
 * only when there is no cached copy younger than ACTIONS_CACHE_HOURS (12 h).
 * Concurrent requests for the same country share a single generation.
 */
export async function getOrGenerate(code, { log = console.log } = {}) {
  const cached = await cacheGet(code);
  if (isFresh(cached.doc)) return { doc: cached.doc, cache: "hit", storage: cached.storage };

  if (!inflight.has(code)) {
    const task = withSlot(async () => {
      // Re-check: another request may have filled the cache while we queued.
      const again = await cacheGet(code);
      if (isFresh(again.doc)) return { doc: again.doc, cache: "hit", storage: again.storage };

      const started = Date.now();
      const result = await generateForCountry(code, { co2: await latestCo2() });
      const now = new Date();
      const doc = {
        code,
        name: result.input.name,
        ...result.data,
        input: result.input,
        co2: result.co2,
        model: result.model,
        promptVersion: PROMPT_VERSION,
        inputHash: result.inputHash,
        usage: result.usage,
        generatedAt: now,
        expiresAt: new Date(now.getTime() + config.actions.cacheHours * 3600 * 1000),
      };
      const storage = await cacheSet(code, doc);
      const tokens = result.usage.reduce((sum, u) => sum + (u.total_tokens || 0), 0);
      log(`[actions] generated ${code} ${doc.name} · ${tokens} tokens · ${((Date.now() - started) / 1000).toFixed(1)} s · cached in ${storage} for ${config.actions.cacheHours} h`);
      return { doc, cache: "miss", storage };
    }).finally(() => inflight.delete(code));
    inflight.set(code, task);
  }

  try {
    return await inflight.get(code);
  } catch (error) {
    // Generation failed: serve the expired copy if one exists.
    if (cached.doc) {
      log(`[actions] ${code} generation failed (${error.message}); serving expired cache`);
      return { doc: cached.doc, cache: "stale", storage: cached.storage };
    }
    throw error;
  }
}
