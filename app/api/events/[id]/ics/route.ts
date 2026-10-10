import { EventError, eventIcs } from "../../../../../lib/events";

export const dynamic = "force-dynamic";

/** "Add to calendar": the event as an .ics file. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ics = await eventIcs(params.id);
    return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="kitty-kingdom-event.ics"` } });
  } catch (error) {
    if (error instanceof EventError) return new Response(error.message, { status: error.status });
    console.error("Event calendar file failed", error);
    return new Response("Something went wrong.", { status: 500 });
  }
}
