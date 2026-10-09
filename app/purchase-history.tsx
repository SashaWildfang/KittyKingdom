"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronDown, Globe, MessageCircle, Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import type { HistoryEntry } from "../lib/purchase-history";
import { LeafEmote, StoreItemIcon } from "./ui-icons";
import { useCurrency } from "./season-context";

type Result = { entries: HistoryEntry[]; total: number; page: number; pageSize: number; totals: { spent: number; purchases: number; sent: number; received: number } };

const KINDS = [
  { key: "", label: "All" },
  { key: "purchase", label: "Purchases" },
  { key: "gift-sent", label: "Gifts sent" },
  { key: "gift-received", label: "Gifts received" },
];

/** 30500 -> "30.5k", 1250000 -> "1.25M" (the exact number is in the tooltip) */
function compact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${+(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${+(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const fullDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "full", timeStyle: "medium" }) : "Unknown");

/** Everything about one purchase or gift. */
function Details({ e }: { e: HistoryEntry }) {
  const unit = e.price !== null && e.quantity ? Math.round(e.price / e.quantity) : null;
  const rows: [string, React.ReactNode][] = [
    [e.kind === "purchase" ? "Order" : "Gift", <code key="id">#{e.id.slice(-8).toUpperCase()}</code>],
    ["Date", fullDate(e.at)],
    ["Item", e.name],
    ["Type", `${e.itemType[0]?.toUpperCase() ?? ""}${e.itemType.slice(1)}${e.category ? ` · ${e.category}` : ""}`],
    ["Quantity", e.quantity.toLocaleString()],
  ];
  if (e.kind === "purchase") {
    rows.push(["Price each", unit !== null ? <span key="u" className="ph-leaf">{unit.toLocaleString()} <LeafEmote size={13} /></span> : "—"]);
    rows.push(["Total paid", e.price !== null ? <span key="t" className="ph-leaf"><b>{e.price.toLocaleString()}</b> <LeafEmote size={13} /></span> : "—"]);
    if (e.currentPrice !== null && unit !== null && e.currentPrice !== unit) rows.push(["Price now", <span key="n" className="ph-leaf">{e.currentPrice.toLocaleString()} <LeafEmote size={13} /></span>]);
  } else {
    rows.push([e.kind === "gift-sent" ? "Sent to" : "From", e.otherName ?? "Someone who left the server"]);
  }
  rows.push(["Where", e.source === "website" ? "Kitty Kingdom website" : "Discord (bot command)"]);
  if (!e.stillSold) rows.push(["Status", "No longer sold in the shop"]);
  return (
    <div className="ph-details">
      {e.description ? <p className="ph-desc">{e.description}</p> : null}
      {e.message ? <p className="ph-note">“{e.message}”</p> : null}
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Searchable purchase history: Store buys (website and Discord) and gifts sent/received.
 * `url` is /api/store/history for yourself or /api/admin/user/<id>/history for a member.
 */
export function PurchaseHistory({ url, whose = "your", startOpen = false }: { url: string; whose?: string; startOpen?: boolean }) {
  const cur = useCurrency();
  const [open, setOpen] = useState(startOpen);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setLoading(true);
    const params = new URLSearchParams({ search: query, kind, page: String(page) });
    fetch(`${url}?${params}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.ok) throw new Error(body.error ?? "Couldn't load the purchase history.");
        if (!stop) {
          setData(body);
          setError(null);
        }
      })
      .catch((e) => !stop && setError(e instanceof Error ? e.message : "Couldn't load the purchase history."))
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [url, query, kind, page, open]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className={`ph${open ? " is-open" : ""}`}>
      <button type="button" className="ph-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ShoppingBag size={16} aria-hidden="true" />
        <span>Purchase history</span>
        {data ? <small>{data.totals.purchases} purchases</small> : null}
        <ChevronDown size={16} aria-hidden="true" className="ph-chevron" />
      </button>

      {open ? (
        <div className="ph-body">
          {data ? (
            <div className="ph-totals">
              <span title={`${data.totals.spent.toLocaleString()} ${cur.lower} spent`}>
                <b>
                  <LeafEmote size={15} />
                  {compact(data.totals.spent)}
                </b>
                <em>spent</em>
              </span>
              <span>
                <b>{compact(data.totals.purchases)}</b>
                <em>{data.totals.purchases === 1 ? "purchase" : "purchases"}</em>
              </span>
              <span>
                <b>{compact(data.totals.sent)}</b>
                <em>{data.totals.sent === 1 ? "gift sent" : "gifts sent"}</em>
              </span>
              <span>
                <b>{compact(data.totals.received)}</b>
                <em>{data.totals.received === 1 ? "gift received" : "gifts received"}</em>
              </span>
            </div>
          ) : null}

          <div className="ph-filters">
            <label className="ph-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={`Search ${whose} purchase history`} />
            </label>
            <div className="ph-kinds" role="tablist">
              {KINDS.map((k) => (
                <button
                  key={k.key || "all"}
                  type="button"
                  role="tab"
                  aria-selected={kind === k.key}
                  className={kind === k.key ? "is-active" : undefined}
                  onClick={() => {
                    setKind(k.key);
                    setPage(1);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="ph-error">{error}</p> : null}
          {!data && loading ? <div className="adm-skeleton adm-skeleton--short" /> : null}

          {data ? (
            data.entries.length ? (
              <ul className={`ph-list${loading ? " is-loading" : ""}`}>
                {data.entries.map((e) => {
                  const open = openId === e.id;
                  return (
                  <li key={e.id} className={open ? "is-open" : undefined}>
                    <button type="button" className="ph-row" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open}>
                    <span className={`ph-icon ph-icon--${e.kind}`} aria-hidden="true">
                      <StoreItemIcon icon={e.itemType === "role" ? "package" : e.icon} size={17} />
                    </span>
                    <span className="ph-main">
                      <strong>
                        {e.quantity > 1 ? `${e.quantity}× ` : ""}
                        {e.name}
                      </strong>
                      <small>
                        {e.kind === "purchase" ? (
                          <span className="ph-kind">Bought</span>
                        ) : e.kind === "gift-sent" ? (
                          <span className="ph-kind ph-kind--sent">
                            <ArrowUpRight size={12} aria-hidden="true" /> Gift to {e.otherName ?? "someone"}
                          </span>
                        ) : (
                          <span className="ph-kind ph-kind--got">
                            <ArrowDownLeft size={12} aria-hidden="true" /> Gift from {e.otherName ?? "someone"}
                          </span>
                        )}
                        <span>{when(e.at)}</span>
                        <span className="ph-source" title={e.source === "website" ? "Bought on the website" : "Done in Discord"}>
                          {e.source === "website" ? <Globe size={11} aria-hidden="true" /> : <MessageCircle size={11} aria-hidden="true" />} {e.source === "website" ? "Website" : "Discord"}
                        </span>
                      </small>
                    </span>
                    {e.price !== null ? (
                      <span className="ph-price">
                        −{e.price.toLocaleString()} <LeafEmote size={14} />
                      </span>
                    ) : null}
                    <ChevronDown size={16} aria-hidden="true" className="ph-row-chevron" />
                    </button>
                    {open ? <Details e={e} /> : null}
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ph-empty">{query || kind ? "Nothing matches." : `No purchases yet.`}</p>
            )
          ) : null}

          {data && pages > 1 ? (
            <div className="ph-pager">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                ← Newer
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
                Older →
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
