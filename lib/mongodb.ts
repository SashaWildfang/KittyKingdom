import { MongoClient } from "mongodb";

type ServerStatsDocument = {
  _id: string;
  online_count?: number;
};

let clientPromise: Promise<MongoClient> | null = null;

function getDatabaseUrl() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error(
      "DATABASE_URL is not configured. Add it in Vercel Project Settings > Environment Variables.",
    );
  }
  return uri;
}

async function getMongoClient() {
  if (!clientPromise) {
    const client = new MongoClient(getDatabaseUrl(), {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getUsersCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  const users = db.collection("users");

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ username: 1 }, { unique: true, sparse: true }),
    users.createIndex({ emailVerificationTokenHash: 1 }, { sparse: true }),
  ]);

  return users;
}

export async function getServerStatsCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  return db.collection<ServerStatsDocument>("server_stats");
}

export async function getJoinApplicationsCollection() {
  const client = await getMongoClient();
  const db = client.db("zeo_bot");
  return db.collection("join_applications");
}


export async function getBotUsersCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.BOT_MONGODB_DB ?? "zeo_bot");
  return db.collection("users");
}

// Staff Team members, kept up to date by the main bot's staff sync (events/staff_sync.py)
export async function getStaffCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  return db.collection("staff");
}

type PresenceDocument = { _id: string; lastSeen: Date };
let presenceIndexReady: Promise<string> | null = null;

// Open website tabs (one doc per visitor), cleaned up automatically a few minutes after they leave
export async function getPresenceCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "website");
  const presence = db.collection<PresenceDocument>("website_presence");
  presenceIndexReady ??= presence.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 300 });
  await presenceIndexReady;
  return presence;
}

// Any collection in the bot's database (store, inventory, economy, gifts...)
export async function getBotCollection(name: string) {
  const client = await getMongoClient();
  return client.db(process.env.BOT_MONGODB_DB ?? "zeo_bot").collection(name);
}
