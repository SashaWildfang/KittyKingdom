// Staff tasks: a shared to-do list ("post the event poll", "check the art channel pins"). Anyone on staff can add
// and finish tasks; assigned tasks that are due show in that person's Needs attention.
//
// website.staff_tasks {_id, title, details, assignee, assigneeName, due, status: todo|doing|done, createdBy, createdByName,
//                      createdAt, doneAt, doneBy}

import { ObjectId, type Document } from "mongodb";
import type { PanelUser } from "./admin";
import { getMongoClient } from "./mongodb";

export type Task = { id: string; title: string; details: string; assignee: string | null; due: string | null; status: "todo" | "doing" | "done"; createdBy: string; createdByName: string; createdAt: string; doneAt: string | null; doneByName: string | null };

export class TaskError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
async function col() {
  const c = (await getMongoClient()).db(process.env.MONGODB_DB ?? "website").collection("staff_tasks");
  await c.createIndex({ status: 1, due: 1 }).catch(() => undefined);
  return c;
}
const toTask = (d: Document): Task => ({
  id: String(d._id),
  title: String(d.title ?? ""),
  details: String(d.details ?? ""),
  assignee: d.assignee ? String(d.assignee) : null,
  due: iso(d.due),
  status: ["todo", "doing", "done"].includes(d.status) ? d.status : "todo",
  createdBy: String(d.createdBy ?? ""),
  createdByName: String(d.createdByName ?? ""),
  createdAt: iso(d.createdAt) ?? "",
  doneAt: iso(d.doneAt),
  doneByName: d.doneByName ? String(d.doneByName) : null,
});

const parseDue = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new TaskError("That due date isn't a date.");
  return d;
};

export async function listTasks(showDone: boolean) {
  const c = await col();
  const [open, done] = await Promise.all([
    c.find({ status: { $ne: "done" } }).sort({ due: 1, createdAt: 1 }).limit(300).toArray(),
    showDone ? c.find({ status: "done" }).sort({ doneAt: -1 }).limit(50).toArray() : Promise.resolve([] as Document[]),
  ]);
  // Tasks with a due date first (soonest first), then the rest by age
  const sorted = open.sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || (a.due?.getTime?.() ?? 0) - (b.due?.getTime?.() ?? 0) || a.createdAt - b.createdAt);
  return [...sorted, ...done].map(toTask);
}

export async function saveTask(panel: PanelUser, input: { id?: unknown; title?: unknown; details?: unknown; assignee?: unknown; due?: unknown }) {
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (!title) throw new TaskError("Give the task a title.");
  const assignee = input.assignee && /^\d{15,21}$/.test(String(input.assignee)) ? String(input.assignee) : null;
  const set = { title, details: String(input.details ?? "").trim().slice(0, 2000), assignee, due: parseDue(input.due) };
  const c = await col();
  if (input.id) {
    if (!ObjectId.isValid(String(input.id))) throw new TaskError("Task not found.", 404);
    const r = await c.findOneAndUpdate({ _id: new ObjectId(String(input.id)) }, { $set: set }, { returnDocument: "after" });
    if (!r) throw new TaskError("Task not found.", 404);
    return toTask(r);
  }
  const doc = { ...set, status: "todo", createdBy: panel.discordId, createdByName: panel.name, createdAt: new Date() };
  const r = await c.insertOne(doc);
  return toTask({ ...doc, _id: r.insertedId });
}

export async function setTaskStatus(panel: PanelUser, id: string, status: string) {
  if (!ObjectId.isValid(id)) throw new TaskError("Task not found.", 404);
  if (!["todo", "doing", "done"].includes(status)) throw new TaskError("Unknown status.");
  const set: Document = { status };
  const unset: Document = {};
  if (status === "done") Object.assign(set, { doneAt: new Date(), doneBy: panel.discordId, doneByName: panel.name });
  else Object.assign(unset, { doneAt: "", doneBy: "", doneByName: "" });
  await (await col()).updateOne({ _id: new ObjectId(id) }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
}

/** Delete: the person who made it, or an admin. */
export async function deleteTask(panel: PanelUser, id: string) {
  if (!ObjectId.isValid(id)) throw new TaskError("Task not found.", 404);
  const r = await (await col()).deleteOne({ _id: new ObjectId(id), ...(panel.level === "admin" ? {} : { createdBy: panel.discordId }) });
  if (!r.deletedCount) throw new TaskError("Only the person who added it (or an admin) can delete this task.", 403);
}

/** Your tasks that are due within a day or overdue (for Needs attention). */
export async function dueTasksFor(discordId: string) {
  const soon = new Date(Date.now() + 86_400_000);
  const rows = await (await col()).find({ assignee: discordId, status: { $ne: "done" }, due: { $ne: null, $lte: soon } }).sort({ due: 1 }).limit(20).toArray();
  return rows.map(toTask);
}
