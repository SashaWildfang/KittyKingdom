import { readPhoto } from "../../../../../lib/dating/media";
import { datingAccess } from "../../../../../lib/dating/access";
import { getPanelUser } from "../../../../../lib/admin";

export const dynamic = "force-dynamic";

/** A dating photo, only for signed-in 18+ Verified members, or staff reviewing reports (cached privately in their browser). */
export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const access = await datingAccess();
  if (!access.ok && !(await getPanelUser().catch(() => null))) return new Response("Not available", { status: 403 });
  const photo = await readPhoto(params.file.split(".")[0]).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
