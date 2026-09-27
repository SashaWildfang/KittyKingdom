import { NextResponse } from "next/server";
import { requirePanel } from "../../../../../../../lib/admin";
import { liveAttachmentUrl } from "../../../../../../../lib/live-chat";

export const dynamic = "force-dynamic";

/** Opens a file from a live message (only for staff who can see that channel). */
export async function GET(request: Request, { params }: { params: { messageId: string; attachmentId: string } }) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const url = await liveAttachmentUrl(panel.discordId, params.messageId, params.attachmentId);
  if (!url) return new NextResponse("That file is no longer available.", { status: 404 });
  return NextResponse.redirect(url, 302);
}
