import { MongoClient } from "mongodb";
import { config } from "./config.js";

let clientPromise = null;

export async function getDb() {
  if (!config.mongo.uri) throw new Error("MONGODB_URI is not set in .env");
  if (!clientPromise) {
    const client = new MongoClient(config.mongo.uri, {
      appName: "earth-doctor",
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    });
    clientPromise = client.connect().then(async (connected) => {
      const db = connected.db(config.mongo.db);
      await db.collection("country_actions").createIndex({ generatedAt: 1 });
      return connected;
    });
    clientPromise.catch(() => {
      clientPromise = null; // allow a later retry
    });
  }
  return (await clientPromise).db(config.mongo.db);
}

export async function collections() {
  const db = await getDb();
  return {
    actions: db.collection("country_actions"),
    jobs: db.collection("jobs"),
  };
}

export async function closeDb() {
  if (clientPromise) {
    const client = await clientPromise.catch(() => null);
    clientPromise = null;
    await client?.close();
  }
}
