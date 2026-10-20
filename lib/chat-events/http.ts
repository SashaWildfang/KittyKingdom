import { NextResponse } from "next/server";
import { ChatEventError } from "./types";

/** The JSON error for the chat events API. */
export function chatEventFail(error: unknown) {
  if (error instanceof ChatEventError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Chat events failed", error);
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}
