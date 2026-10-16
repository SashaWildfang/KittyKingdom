"use client";

// In-page replacements for window.confirm / alert / prompt. The browser's own pop-ups can be switched off with
// "Prevent this page from creating additional dialogs", after which confirm() silently returns false and buttons
// that ask first stop working. These can't be blocked, and they match the site (light and dark).
//
//   if (!(await askConfirm("Delete this?", { danger: true, confirmLabel: "Delete" }))) return;
//   await showNotice("Saved!");
//   const url = await askText("Paste a link:");

import "./confirm-dialog.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type Options = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Kind = "confirm" | "notice" | "text";

function Dialog({ kind, message, opts, done }: { kind: Kind; message: string; opts: Options; done: (value: boolean | string | null) => void }) {
  const [text, setText] = useState("");
  const ok = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (kind === "text" ? input.current : ok.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        done(kind === "text" ? null : kind === "notice");
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [kind, done]);

  const confirm = () => done(kind === "text" ? text : true);
  return (
    <div className="cd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && done(kind === "text" ? null : kind === "notice")}>
      <div className="cd-box" role={kind === "notice" ? "alertdialog" : "dialog"} aria-modal="true" aria-label={opts.title ?? "Confirm"}>
        {opts.title ? <h2>{opts.title}</h2> : null}
        <p>{message}</p>
        {kind === "text" ? (
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            aria-label={opts.title ?? message}
          />
        ) : null}
        <div className="cd-actions">
          {kind !== "notice" ? (
            <button type="button" className="cd-btn cd-btn--ghost" onClick={() => done(kind === "text" ? null : false)}>
              {opts.cancelLabel ?? "Cancel"}
            </button>
          ) : null}
          <button type="button" ref={ok} className={`cd-btn${opts.danger ? " cd-btn--danger" : ""}`} onClick={confirm}>
            {opts.confirmLabel ?? (kind === "notice" ? "OK" : kind === "text" ? "Add" : "Yes")}
          </button>
        </div>
      </div>
    </div>
  );
}

function open<T extends boolean | string | null>(kind: Kind, message: string, opts: Options = {}): Promise<T> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const previous = document.activeElement as HTMLElement | null;
    const done = (value: boolean | string | null) => {
      root.unmount();
      host.remove();
      previous?.focus?.();
      resolve(value as T);
    };
    root.render(<Dialog kind={kind} message={message} opts={opts} done={done} />);
  });
}

/** Yes / Cancel. Resolves true for yes. */
export const askConfirm = (message: string, opts?: Options) => open<boolean>("confirm", message, opts);
/** Just a message with OK. */
export const showNotice = (message: string, opts?: Options) => open<boolean>("notice", message, opts).then(() => undefined);
/** A message and a text box. Resolves the text, or null if cancelled. */
export const askText = (message: string, opts?: Options) => open<string | null>("text", message, opts);
