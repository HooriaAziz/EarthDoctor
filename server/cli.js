// Optional: pre-generate (or print) suggestions for specific countries.
// Respects the same 12-hour cache, so re-running costs nothing while fresh.
//
//   npm run actions:generate -- USA IND NPL
import { missingConfig } from "./config.js";
import { getOrGenerate } from "./actions.js";
import { closeDb } from "./db.js";

const codes = process.argv.slice(2).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c));

if (!codes.length) {
  console.error("Usage: npm run actions:generate -- <CODE> [CODE...]   (EDGAR 3-letter codes, e.g. USA IND)");
  process.exit(1);
}
if (missingConfig().length) {
  console.error(`Missing in .env: ${missingConfig().join(", ")}`);
  process.exit(1);
}

try {
  for (const code of codes) {
    try {
      const { doc, cache, storage } = await getOrGenerate(code);
      console.log(`${code} ${doc.name}: cache ${cache} (${storage}) · ${Object.values(doc.levels).flat().length} actions · ${doc.hashtags.length} hashtags · ${doc.movements?.length ?? 0} movements`);
    } catch (error) {
      console.error(`${code}: ${error.message}`);
      process.exitCode = 1;
    }
  }
} finally {
  await closeDb();
}
