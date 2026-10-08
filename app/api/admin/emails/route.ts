import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { getEmail, listEmails } from "../../../../lib/email-log";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Admins: emails the website sent. ?id= returns one with its body. */
export async function GET(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  const url = new URL(request.url);
  try {
    const id = url.searchParams.get("id");
    if (id) {
      const email = await getEmail(id);
      return email ? NextResponse.json({ ok: true, email }, { headers: NO_STORE }) : NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    const data = await listEmails({
      q: url.searchParams.get("q") ?? "",
      kind: url.searchParams.get("kind") ?? "",
      status: url.searchParams.get("status") ?? "",
      page: Number(url.searchParams.get("page") ?? 1),
    });
    return NextResponse.json({ ok: true, ...data }, { headers: NO_STORE });
  } catch (error) {
    console.error("Admin emails failed", error);
    return NextResponse.json({ ok: false, error: "Couldn't load emails." }, { status: 500 });
  }
}
