// Removing a website account and everything that only exists because of it: sign-ins, link codes and badge
// history. Used when a member deletes their own account and when a banned member's account is closed.
// (Their Discord-side data, like levels, leaves and their Social profile, belongs to the bots and stays.)

import type { ObjectId } from "mongodb";
import { deleteBadgeHistory } from "./badge-history";
import { getMongoClient } from "./mongodb";
import { sessionsCollection } from "./sessions";

/** Clean up after an account's user record has been deleted. */
export async function removeAccountData(userId: ObjectId, discordId: string | null | undefined) {
  await (await sessionsCollection()).deleteMany({ userId });
  const website = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website");
  await Promise.all([website.collection("link_codes").deleteMany({ userId }), deleteBadgeHistory(discordId)]).catch(() => undefined);
}
