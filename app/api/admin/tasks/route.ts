import { NextResponse } from "next/server";
import { requirePanel } from "../../../../lib/admin";
import { people } from "../../../../lib/admin-people";
import { assignableStaff } from "../../../../lib/ticket-work";
import { TaskError, deleteTask, listTasks, saveTask, setTaskStatus } from "../../../../lib/staff-tasks";

export const dynamic = "force-dynamic";

/** Staff: the shared task list (?done=1 also returns recently finished ones). */
export async function GET(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  const tasks = await listTasks(new URL(request.url).searchParams.get("done") === "1");
  const staff = await assignableStaff(false).catch(() => []);
  return NextResponse.json({ ok: true, tasks, staff, people: await people(tasks.flatMap((t) => [t.assignee, t.createdBy])), me: panel.discordId, isAdmin: panel.level === "admin" }, { headers: { "Cache-Control": "no-store" } });
}

/** Staff: {op: "save", id?, title, details, assignee, due} · {op: "status", id, status} · {op: "delete", id} */
export async function POST(request: Request) {
  const panel = await requirePanel(request);
  if (panel instanceof NextResponse) return panel;
  try {
    const body = (await request.json().catch(() => ({}))) as { op?: string; id?: string; title?: unknown; details?: unknown; assignee?: unknown; due?: unknown; status?: string };
    if (body.op === "save") return NextResponse.json({ ok: true, task: await saveTask(panel, body) });
    if (body.op === "status") await setTaskStatus(panel, String(body.id ?? ""), String(body.status ?? ""));
    else if (body.op === "delete") await deleteTask(panel, String(body.id ?? ""));
    else return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TaskError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Task change failed", error);
    return NextResponse.json({ ok: false, error: "That didn't work. Try again." }, { status: 500 });
  }
}
