import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { audit } from "../../../../lib/news-admin";
import { TicketWorkError, deleteTemplate, listTemplates, saveTemplate } from "../../../../lib/ticket-work";

export const dynamic = "force-dynamic";

/** Saved replies for /reply (all staff can read them). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  return NextResponse.json({ ok: true, templates: await listTemplates(), canEdit: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
}

/** Admins: {op: "save", id?, name, text, types} · {op: "delete", id} */
export async function POST(request: Request) {
  const panel = await requirePanel(request, "admin");
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; id?: string; name?: unknown; text?: unknown; types?: unknown };
    if (body.op === "save") {
      const template = await saveTemplate(panel, body);
      await audit(body.id ? "reply-template-edit" : "reply-template-add", { templateId: template.id, name: template.name }, panel).catch(() => undefined);
      return NextResponse.json({ ok: true, template });
    }
    if (body.op === "delete") {
      await deleteTemplate(String(body.id ?? ""));
      await audit("reply-template-delete", { templateId: body.id }, panel).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    if (error instanceof TicketWorkError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Saved reply change failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
