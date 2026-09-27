import { calculateAge, parseAge, parseDateOfBirth } from "./dates";
import { getJoinApplicationsCollection } from "./mongodb";

/** A member's Discord join application (newest first if they applied more than once). */
export async function getJoinApplication(discordId: unknown): Promise<Record<string, unknown> | null> {
  if (!discordId) return null;
  try {
    const id = String(discordId);
    const apps = await getJoinApplicationsCollection();
    return (await apps.findOne(
      { $or: [{ discordId: id }, { discord_id: id }, { userId: id }, { user_id: id }, { id }] },
      { sort: { submittedAt: -1 } },
    )) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

/** Birthday and age from the application's free-text answer, falling back to what the account stored. */
export function applicationBirthday(application: Record<string, unknown> | null, fallback?: { dateOfBirth?: unknown; age?: unknown }) {
  const ageAndDob = application ? (application.ageAndDob ?? application.age_and_dob ?? application.ageDOB ?? application.ageDob ?? null) : null;
  const dobSource =
    (application ? (application.dateOfBirth ?? application.date_of_birth ?? application.dob ?? application.DOB ?? application.birthdate ?? ageAndDob) : null) ??
    fallback?.dateOfBirth;
  const ageSource = (application ? (application.age ?? application.Age) : null) ?? fallback?.age;
  const birthDate = parseDateOfBirth(dobSource);
  const age = birthDate ? calculateAge(birthDate) : (parseAge(ageSource) ?? parseAge(dobSource));
  return { birthDate, age, raw: typeof ageAndDob === "string" ? ageAndDob : null };
}
