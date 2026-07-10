import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getDatabaseUrl() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("DATABASE_URL is not configured. Add it in Vercel Project Settings > Environment Variables.");
  }
  return uri;
}

async function getMongoClient() {
  if (!clientPromise) {
    const client = new MongoClient(getDatabaseUrl());
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getUsersCollection() {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB ?? "kittykingdom");
  const users = db.collection("users");

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ username: 1 }, { unique: true, sparse: true }),
    users.createIndex({ emailVerificationTokenHash: 1 }, { sparse: true }),
  ]);

  return users;
}
