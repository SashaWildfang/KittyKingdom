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
