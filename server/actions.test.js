import assert from "node:assert/strict";
import { test } from "node:test";
import { LEVELS, getOrGenerate, validate } from "./actions.js";
import { config } from "./config.js";
import { countryContext } from "./countryContext.js";

function answer() {
  return {
    summary: "Prioritize the largest sources of emissions.",
    levels: Object.fromEntries(LEVELS.map((level) => [level, [
      { action: "Reduce wasted energy", why: "Reduce demand from power generation.", effort: "low" },
      { action: "Plan shared journeys", why: "Reduce transport fuel use.", effort: "medium" },
      { action: "Measure food waste", why: "Reduce avoidable waste.", effort: "low" },
    ]])),
    hashtags: ["#Climate", "#Energy", "#Transport", "#India"],
    posts: [
      { platform: "x", text: "Start with practical climate actions in your community." },
      { platform: "instagram", text: "Make a plan to reduce wasted energy this week." },
    ],
    movements: [
      { id: "earth-day", name: "Invented name", how: "Organize a discussion." },
      { id: "unknown-campaign" },
      { id: "earth-day" },
    ],
  };
}

test("every action level is required and campaign identity comes from the catalog", () => {
  const raw = answer();
  const result = validate(raw, countryContext("IND"));
  assert.equal(Object.keys(result.levels).length, LEVELS.length);
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0].name, "Earth Day");
  delete raw.levels.school;
  assert.throws(() => validate(raw, countryContext("IND")), /school/);
});

test("concurrent country requests share generation and subsequent requests use cache", async () => {
  const originalFetch = globalThis.fetch;
  const originalUri = config.mongo.uri;
  const originalKey = config.nvidia.apiKey;
  config.mongo.uri = "";
  config.nvidia.apiKey = "test-only";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("gml.noaa.gov")) return new Response("", { status: 503 });
    calls += 1;
    const request = JSON.parse(options.body);
    assert.match(request.messages[1].content, /India/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer()) }, finish_reason: "stop" }] });
  };
  try {
    const options = { log: () => {} };
    const results = await Promise.all([
      getOrGenerate("IND", options), getOrGenerate("IND", options),
    ]);
    assert.equal(calls, 1);
    assert.equal(results[0].doc.code, "IND");
    assert.equal(results[0].doc, results[1].doc);
    assert.equal((await getOrGenerate("IND", options)).cache, "hit");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    config.mongo.uri = originalUri;
    config.nvidia.apiKey = originalKey;
  }
});
