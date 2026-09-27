"use client";

import { Check, Lock, Palette, Plus, ShieldAlert, ShoppingBag, Tags, TriangleAlert } from "lucide-react";
import { LeafEmote } from "../ui-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_STATE_EVENT } from "./live-server-status";
import type { RoleState } from "../../lib/member-roles";

const POLL_MS = 10_000;

/** "Select this if you identify as male." -> "Identify as male" */
function shortDescription(text: string) {
  const trimmed = text
    .replace(/^select this if you (are )?/i, "")
    .replace(/^(standard|currently) /i, "")
    .replace(/\.$/, "")
    .trim();
  const short = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return short.length > 42 ? `${short.slice(0, 40).trimEnd()}…` : short;
}

function swatch(colors: string[]) {
  if (!colors.length) return "linear-gradient(135deg, #8b8d98, #5b5d68)";
  return colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(", ")})`;
}

export function RoleManager({ initial }: { initial: RoleState | null }) {
  const [state, setStateRaw] = useState<RoleState | null>(initial);
  // Every fresh copy of the roles also updates the profile card (LiveServerStatus)
  const setState = useCallback((next: RoleState | null | ((s: RoleState | null) => RoleState | null)) => {
    setStateRaw((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      if (value) window.setTimeout(() => window.dispatchEvent(new CustomEvent(ROLE_STATE_EVENT, { detail: value })), 0);
      return value;
    });
  }, []);
  const [active, setActive] = useState<string>(initial?.categories[0]?.key ?? "");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [colorView, setColorView] = useState<"all" | "owned" | "shop">("all");
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const busy = pending.size > 0;

  const showToast = (text: string, tone: "ok" | "error") => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/roles", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Couldn't load your roles.");
      setState(body.state);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your roles.");
    }
  }, []);

  // Live: picks up role changes made in Discord too
  useEffect(() => {
    if (!initial) void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, initial, busy]);

  async function send(key: string, body: Record<string, unknown>, optimistic: (s: RoleState) => RoleState) {
    if (!state) return;
    setState((s) => (s ? optimistic(s) : s));
    setPending((p) => new Set(p).add(key));
    try {
      const res = await fetch("/api/account/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "That didn't work.");
      setState(data.state);
      showToast(data.message, "ok");
    } catch (e) {
      void refresh(); // put back whatever Discord really has
      showToast(e instanceof Error ? e.message : "That didn't work.", "error");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  function toggleRole(roleId: string, add: boolean) {
    void send(roleId, { roleId, add }, (s) => ({
      ...s,
      categories: s.categories.map((c) => ({ ...c, roles: c.roles.map((r) => (r.id === roleId ? { ...r, has: add } : r)) })),
    }));
  }

  function toggleColor(itemId: string, equip: boolean) {
    void send(`color:${itemId}`, { itemId, equip }, (s) => ({
      ...s,
      colorRoles: s.colorRoles.map((c) => ({ ...c, equipped: c.itemId === itemId ? equip : equip ? false : c.equipped })),
    }));
  }

  if (!state) {
    return <div className="roles-loading">{error ?? "Loading your roles…"}</div>;
  }

  if (!state.inServer) {
    return (
      <div className="roles-empty">
        <p>Join the Kitty Kingdom Discord server to pick your roles here.</p>
        <a className="acct-button" href="https://discord.com/invite/M9XKHFdYQV">
          Join the server
        </a>
      </div>
    );
  }

  const general = state.categories.filter((c) => !c.adult);
  const adult = state.categories.filter((c) => c.adult);
  const category = state.categories.find((c) => c.key === active) ?? general[0];
  const selectedCount = (key: string) => state.categories.find((c) => c.key === key)?.roles.filter((r) => r.has).length ?? 0;

  return (
    <div className="roles">
      {/* Category picker, SFW and NSFW kept apart */}
      <div className="roles-groups">
        <div className="roles-group">
          <span className="roles-group-label">SFW roles</span>
          <div className="roles-nav" role="tablist" aria-label="SFW role categories">
            {general.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={category?.key === c.key}
                className={category?.key === c.key ? "is-active" : undefined}
                style={{ "--cat": c.color } as React.CSSProperties}
                onClick={() => setActive(c.key)}
              >
                {c.title}
                {selectedCount(c.key) ? <span>{selectedCount(c.key)}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="roles-group roles-group--nsfw">
          <span className="roles-group-label">
            <ShieldAlert size={13} aria-hidden="true" /> NSFW roles {!state.isAdult ? <em>· unlock with 18+ verification</em> : null}
          </span>
          <div className="roles-nav" role="tablist" aria-label="NSFW role categories">
            {adult.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={category?.key === c.key}
                className={`roles-nav-adult${category?.key === c.key ? " is-active" : ""}`}
                style={{ "--cat": c.color } as React.CSSProperties}
                onClick={() => setActive(c.key)}
              >
                {c.locked ? <Lock size={12} aria-hidden="true" /> : null}
                {c.title}
                {selectedCount(c.key) ? <span>{selectedCount(c.key)}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {category ? (
        <div className="roles-panel" style={{ "--cat": category.color } as React.CSSProperties} key={category.key}>
          <div className="roles-panel-head">
            <div>
              <h3>
                {category.adult ? <ShieldAlert size={16} aria-hidden="true" /> : null}
                {category.title}
              </h3>
              <p>{category.description}</p>
            </div>
            {!category.locked && selectedCount(category.key) ? (
              <button
                type="button"
                className="roles-clear"
                disabled={busy}
                onClick={() => category.roles.filter((r) => r.has).forEach((r) => toggleRole(r.id, false))}
              >
                Clear section
              </button>
            ) : null}
          </div>

          {category.locked ? (
            <div className="roles-locked">
              <span aria-hidden="true"><Lock size={22} /></span>
              <div>
                <strong>18+ roles are available once you&apos;re ID verified in the Discord server.</strong>
                <p>Open a verification ticket in Discord. Once you have the 18+ Verified role, these unlock here automatically.</p>
              </div>
            </div>
          ) : null}

          <div className={`roles-grid${category.locked ? " is-locked" : ""}`}>
            {category.roles.map((role) => {
              const isPending = pending.has(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`role-tile${role.has ? " is-on" : ""}${isPending ? " is-pending" : ""}`}
                  disabled={category.locked || isPending || !role.exists}
                  aria-pressed={role.has}
                  onClick={() => toggleRole(role.id, !role.has)}
                  title={role.description}
                >
                  <span className="role-tile-emoji" aria-hidden="true">
                    {role.emoji}
                  </span>
                  <span className="role-tile-text">
                    <strong>{role.name}</strong>
                    <small>{shortDescription(role.description)}</small>
                  </span>
                  <span className="role-tile-check" aria-hidden="true">
                    {isPending ? <i className="role-spinner" /> : role.has ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Color roles from the shop */}
      <div className="roles-section">
        <div className="roles-section-head">
          <h3>
            <Palette size={17} aria-hidden="true" /> Color roles{" "}
            <span className="roles-unlocked">
              {state.colorRoles.length}/{state.colorRoleTotal} unlocked
            </span>
          </h3>
          <a href="/store">Get more in the Leaf Shop →</a>
        </div>
        {state.colorRoleTotal ? (
          <div className="roles-progress" role="progressbar" aria-valuemin={0} aria-valuemax={state.colorRoleTotal} aria-valuenow={state.colorRoles.length} aria-label="Color roles unlocked">
            <span style={{ width: `${Math.min(100, (state.colorRoles.length / state.colorRoleTotal) * 100)}%` }} />
            <small>
              {state.colorRoles.length === state.colorRoleTotal
                ? "You've collected every color role!"
                : `${Math.round((state.colorRoles.length / state.colorRoleTotal) * 100)}% collected · ${state.colorRoleTotal - state.colorRoles.length} to go`}
            </small>
          </div>
        ) : null}
        <div className="roles-color-filter" role="tablist" aria-label="Which color roles">
          {(
            [
              ["all", "All"],
              ["owned", `Unlocked (${state.colorRoles.length})`],
              ["shop", `In the shop now (${(state.colorCatalog ?? []).filter((c) => c.inShop && !c.owned).length})`],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={colorView === key} className={colorView === key ? "is-active" : undefined} onClick={() => setColorView(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="roles-colors">
          {state.colorRoles
            .filter(() => colorView !== "shop")
            .map((c) => {
              const isPending = pending.has(`color:${c.itemId}`);
              return (
                <button
                  key={c.itemId}
                  type="button"
                  className={`color-tile${c.equipped ? " is-on" : ""}${isPending ? " is-pending" : ""}`}
                  disabled={isPending}
                  onClick={() => toggleColor(c.itemId, !c.equipped)}
                  aria-pressed={c.equipped}
                >
                  <span className="color-swatch" style={{ background: swatch(c.colors) }} aria-hidden="true" />
                  <strong>{c.name}</strong>
                  <small>{isPending ? "Updating…" : c.equipped ? "Wearing" : "Tap to wear"}</small>
                </button>
              );
            })}
          {(state.colorCatalog ?? [])
            .filter((c) => !c.owned && (colorView === "all" || (colorView === "shop" && c.inShop)))
            .map((c) =>
              c.inShop ? (
                <a key={c.itemId} className="color-tile is-locked is-buyable" href={`/store?item=${encodeURIComponent(c.itemId)}`} title="Open it in the Leaf Shop">
                  <span className="color-swatch" style={{ background: swatch(c.colors) }} aria-hidden="true" />
                  <strong>{c.name}</strong>
                  <small className="color-tile-shop">
                    <ShoppingBag size={12} aria-hidden="true" /> <span className="color-tile-shop-label">In the shop ·</span> {c.price.toLocaleString()} <LeafEmote size={13} />
                  </small>
                </a>
              ) : (
                <div key={c.itemId} className="color-tile is-locked" title="Not in the shop right now">
                  <span className="color-swatch" style={{ background: swatch(c.colors) }} aria-hidden="true">
                    <Lock size={14} />
                  </span>
                  <strong>{c.name}</strong>
                  <small>{c.rotation === "permanent" ? "Locked" : `Returns in the ${c.rotation} rotation`}</small>
                </div>
              ),
            )}
        </div>
        {!state.colorRoles.length && colorView === "owned" ? <p className="roles-muted">You don&apos;t own any color roles yet. Pick one up in the Leaf Shop!</p> : null}
        <p className="roles-hint">You can wear one color role at a time.</p>
      </div>

      {/* Everything else, read-only */}
      {state.levelRoles.length || state.otherRoles.length ? (
        <div className="roles-section">
          <div className="roles-section-head">
            <h3><Tags size={17} aria-hidden="true" /> Your other roles</h3>
            <span className="roles-muted">Earned or given by staff</span>
          </div>
          <div className="roles-chips">
            {[...state.levelRoles, ...state.otherRoles].map((r) => (
              <span key={r.id} className="role-chip">
                <i style={{ background: swatch(r.colors) }} aria-hidden="true" />
                {r.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`roles-toast roles-toast--${toast.tone}`} role="status">
          {toast.tone === "ok" ? <Check size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}{" "}
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
