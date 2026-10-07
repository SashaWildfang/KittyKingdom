import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../lib/admin";
import { freshAttachmentUrl } from "../../../../../../lib/bot-logs";

export const dynamic = "force-dynamic";

/** Opens an archived attachment from a log (Discord's own links expire after a day). */
export async function GET(
  request: Request,
  props: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const params = await props.params;
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const url = await freshAttachmentUrl(params.messageId, params.attachmentId);
  if (!url) return new NextResponse("That file is no longer available.", { status: 404 });
  return NextResponse.redirect(url, 302);
}
