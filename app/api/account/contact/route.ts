import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth";
import { normalizePhone, normalizeSocial, SOCIALS } from "../../../../lib/contact";
import { getUsersCollection } from "../../../../lib/mongodb";

export const maxDuration = 10;

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.redirect(`${origin}/login?account=login-required`, 303);
    }

    const form = await request.formData();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Record<string, ""> = {};

    const phone = normalizePhone(String(form.get("phone") ?? ""));
    if (phone === "invalid") {
      return NextResponse.redirect(`${origin}/account?account=invalid-phone#contact`, 303);
    }
    if (phone) set.phone = phone;
    else unset.phone = "";

    for (const social of SOCIALS) {
      const link = normalizeSocial(social.key, String(form.get(social.key) ?? ""));
      if (link === "invalid") {
        return NextResponse.redirect(`${origin}/account?account=invalid-${social.key}#contact`, 303);
      }
      if (link) set[`socials.${social.key}`] = link;
      else unset[`socials.${social.key}`] = "";
    }

    const users = await getUsersCollection();
    await users.updateOne(
      { _id: userId },
      Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
    );

    return NextResponse.redirect(`${origin}/account?account=contact-saved#contact`, 303);
  } catch (error) {
    console.error("Contact details update failed", error);
    return NextResponse.redirect(`${origin}/account?account=service-unavailable`, 303);
  }
}
