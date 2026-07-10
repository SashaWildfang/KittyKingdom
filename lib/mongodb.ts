import { MongoClient } from "mongodb";

const uri = process.env.DATABASE_URL;

if (!uri) {
  throw new Error("DATABASE_URL is not configured");
}

let clientPromise: Promise<MongoClient>;
const globalForMongo = globalThis as typeof globalThis & { _kittyMongoClientPromise?: Promise<MongoClient> };

if (!globalForMongo._kittyMongoClientPromise) {
  const client = new MongoClient(uri);
  globalForMongo._kittyMongoClientPromise = client.connect();
}

clientPromise = globalForMongo._kittyMongoClientPromise;

export async function getUsersCollection() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB ?? "kittykingdom");
  const users = db.collection("users");

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ username: 1 }, { unique: true, sparse: true }),
    users.createIndex({ emailVerificationTokenHash: 1 }, { sparse: true }),
  ]);

  return users;
}
