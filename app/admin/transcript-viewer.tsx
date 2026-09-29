"use client";

import { Download, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PersonLink, TICKET_COLORS, formatDate, formatMs, prettyAction, type People, type Ticket } from "./admin-shared";
import { DeleteTicketButton } from "./delete-ticket-button";

type Result = {
  ticket: Ticket;
  viewer: string | null;
  download: { url: string; filename: string; size: number } | null;
  people: People;
};

/** Full-screen transcript viewer: the ticket's zipped web page, opened right in the Admin tab. */
export function TranscriptViewer({ ticketId, onClose, onOpenMember }: { ticketId: number; onClose: () => void; onOpenMember: (id: string) => void }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setFrameLoaded(false);
    fetch(`/api/admin/tickets/${ticketId}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.error ?? "Couldn't load that ticket.");
        if (!cancelled) setData(body);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load that ticket."));
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const t = data?.ticket;
  return (
    <div className="adm-viewer" role="dialog" aria-modal="true" aria-label={`Ticket ${ticketId} transcript`}>
      <header className="adm-viewer-head">
        <div className="adm-viewer-title">
          <h2>Ticket #{ticketId}</h2>
          {t ? (
            <>
              <span className="adm-action" style={{ "--c": TICKET_COLORS[t.type] ?? "#8b8d98" } as React.CSSProperties}>
                {prettyAction(t.type)}
              </span>
              <span className="adm-muted">{t.status}</span>
            </>
          ) : null}
        </div>
        {t && data ? (
          <div className="adm-viewer-meta">
            <span>
              Opened by <PersonLink id={t.openedBy} people={data.people} onOpen={onOpenMember} compact />
            </span>
            {t.claimedBy || t.resolvedBy ? (
              <span>
                Handled by <PersonLink id={t.claimedBy ?? t.resolvedBy} people={data.people} onOpen={onOpenMember} compact />
              </span>
            ) : null}
            <span>{formatDate(t.created)}</span>
            {t.created && t.resolvedAt ? <span>took {formatMs(new Date(t.resolvedAt).getTime() - new Date(t.created).getTime())}</span> : null}
          </div>
        ) : null}
        <div className="adm-viewer-actions">
          {data?.viewer ? (
            <a className="adm-btn adm-btn--ghost" href={data.viewer} target="_blank" rel="noopener">
              <ExternalLink size={14} aria-hidden="true" /> New tab
            </a>
          ) : null}
          {data?.download ? (
            <a className="adm-btn adm-btn--ghost" href={data.download.url} rel="noopener noreferrer">
              <Download size={14} aria-hidden="true" /> Zip ({(data.download.size / 1024 / 1024).toFixed(1)} MB)
            </a>
          ) : null}
          {t ? <DeleteTicketButton ticket={t} onDeleted={onClose} label /> : null}
          <button type="button" className="adm-btn" onClick={onClose} aria-label="Close transcript">
            <X size={15} aria-hidden="true" /> Close
          </button>
        </div>
      </header>
      <div className="adm-viewer-body">
        {error ? <p className="adm-error">{error}</p> : null}
        {data && !data.viewer ? <p className="adm-empty">This ticket&apos;s transcript couldn&apos;t be found in the transcript channel.</p> : null}
        {data?.viewer ? (
          <>
            {!frameLoaded ? (
              <div className="adm-viewer-loading">
                <span className="adm-spinner" aria-hidden="true" />
                Unpacking transcript…
              </div>
            ) : null}
            <iframe
              title={`Ticket ${ticketId} transcript`}
              src={data.viewer}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={() => setFrameLoaded(true)}
            />
          </>
        ) : !error ? (
          <div className="adm-viewer-loading">
            <span className="adm-spinner" aria-hidden="true" />
            Finding transcript…
          </div>
        ) : null}
      </div>
    </div>
  );
}
