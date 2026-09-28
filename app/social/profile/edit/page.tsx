"use client";

import { Eye, Loader2, Save, Sparkles, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SECTIONS } from "../../../../lib/dating/schema";
import { AgeField, FieldInput, FursonaEditor, PartnerManager, type Birth, LooksEditor, PhotoManager, PromptsEditor, changed, clearDraft, readDraft, saveMe, writeDraft, type Own } from "../../profile-form";
import { SectionIcon } from "../../icons";
import { Empty, useApi } from "../../ui";

type Me = { booster: boolean; profile: Own | null; view: { id: string } | null; birth: Birth };

const EXTRA = [
  { id: "photos", label: "Photos" },
  { id: "partners", label: "Partners" },
  { id: "looks", label: "Looks" },
  { id: "prompts", label: "Prompts" },
];
const TAIL = [
  { id: "fursonas", label: "Fursonas" },
  { id: "privacy", label: "Privacy" },
  { id: "danger", label: "Delete" },
];

export default function EditProfile() {
  const { data, error } = useApi<Me>("/api/dating/me");
  const [own, setOwn] = useState<Own | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [prompts, setPrompts] = useState<Own["prompts"]>([]);
  const [sonas, setSonas] = useState<Own["fursonas"]>([]);
  const [web, setWeb] = useState<Own["web"]>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmDel, setConfirmDel] = useState("");
  const [active, setActive] = useState("photos");
  const [partnerCount, setPartnerCount] = useState(0);

  const load = (p: Own) => {
    setOwn(p);
    setValues(p.values);
    setPrompts(p.prompts);
    setSonas(p.fursonas);
    setWeb(p.web);
  };
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!data?.profile) return;
    load(data.profile);
    // Unsaved edits from before a refresh (or a site update) come back
    const draft = readDraft<{ values: Record<string, unknown>; prompts: Own["prompts"]; sonas: Own["fursonas"]; web: Own["web"] }>("editor");
    if (draft) {
      setValues({ ...data.profile.values, ...draft.values });
      setPrompts(draft.prompts ?? data.profile.prompts);
      setSonas(draft.sonas ?? data.profile.fursonas);
      setWeb(draft.web ?? data.profile.web);
      setRestored(true);
    }
  }, [data]);

  const diff = useMemo(() => (own ? changed(own.values, values) : {}), [own, values]);
  const promptsDirty = own ? JSON.stringify(own.prompts) !== JSON.stringify(prompts.filter((p) => p.a.trim())) || prompts.some((p) => !p.a.trim()) : false;
  const sonasDirty = own ? JSON.stringify(own.fursonas) !== JSON.stringify(sonas) : false;
  const webDirty = own ? JSON.stringify({ accent: own.web.accent, headline: own.web.headline ?? "", paused: !!own.web.paused, hideAge: !!own.web.hideAge, showOnline: own.web.showOnline !== false }) !== JSON.stringify({ accent: web.accent, headline: web.headline ?? "", paused: !!web.paused, hideAge: !!web.hideAge, showOnline: web.showOnline !== false }) : false;
  const dirty = Object.keys(diff).length > 0 || promptsDirty || sonasDirty || webDirty;

  // Keep unsaved edits as a draft; drop it once everything is saved or discarded
  useEffect(() => {
    if (!own) return;
    if (dirty) writeDraft("editor", { values, prompts, sonas, web });
    else clearDraft("editor");
  }, [own, dirty, values, prompts, sonas, web]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // Highlight the section in view
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".dt-edit-section"));
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: "-120px 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [own]);

  if (error) return <p className="dt-error">{error}</p>;
  if (!data) return <div className="dt-loading" aria-busy="true" />;
  if (!data.profile || !own)
    return (
      <Empty icon={<Wand2 size={28} />} title="You don't have a dating profile yet">
        <a className="dt-btn" href="/social/setup">
          Create my profile
        </a>
      </Empty>
    );

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const body: Record<string, unknown> = {};
    if (Object.keys(diff).length) body.fields = diff;
    if (promptsDirty) body.prompts = prompts.filter((p) => p.a.trim());
    if (sonasDirty) body.fursonas = sonas;
    if (webDirty) body.web = web;
    const r = await saveMe(body);
    setSaving(false);
    if (!r.ok || !r.profile) return setMsg({ text: r.error ?? "Couldn't save.", bad: true });
    load(r.profile);
    setMsg({ text: "Saved! Your matches update within a minute." });
  };
  const flagged = new Set(own.review);
  const nav = [...EXTRA, ...SECTIONS.map((s) => ({ id: s.id, label: s.label })), ...TAIL];

  return (
    <div className="dt-editor">
      <aside className="dt-editor-nav">
        <div className="dt-strength dt-strength--small">
          <div className="dt-ring" style={{ "--p": own.strength.score } as CSSProperties}>
            <b>{own.strength.score}%</b>
          </div>
          <div>
            <b>Profile strength</b>
            {own.strength.missing[0] ? <small className="dt-muted">{own.strength.missing[0].tip}</small> : <small className="dt-muted">All done!</small>}
          </div>
        </div>
        <nav aria-label="Profile sections">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={active === n.id ? "is-on" : undefined}>
              <SectionIcon id={n.id} size={15} /> {n.id === "partners" && partnerCount === 1 ? "Partner" : n.label}
              {SECTIONS.find((s) => s.id === n.id)?.keys.some((k) => flagged.has(k)) ? <span className="dt-flag-dot" title="Needs a check" /> : null}
            </a>
          ))}
        </nav>
        {data.view ? (
          <a className="dt-btn dt-btn--ghost dt-btn--block" href={`/social/u/${data.view.id}`}>
            <Eye size={14} aria-hidden="true" /> Preview my profile
          </a>
        ) : null}
      </aside>

      <div className="dt-editor-main">
        {restored && dirty ? (
          <div className="dt-banner dt-banner--soft">
            <Save size={16} aria-hidden="true" />
            <span>We brought back changes you hadn&apos;t saved yet. Save them, or discard to go back to your saved profile.</span>
            <button
              type="button"
              className="dt-btn dt-btn--ghost dt-btn--small"
              onClick={() => {
                load(own);
                setRestored(false);
              }}
            >
              Discard
            </button>
          </div>
        ) : null}
        {!own.reviewConfirmed ? (
          <a className="dt-banner" href="/social/setup?mode=review">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              <b>Welcome to the new dating profiles!</b> We converted your Discord answers. {own.review.length ? `${own.review.length} answer${own.review.length === 1 ? "" : "s"} need a quick check.` : "Take a quick look to confirm them."}
            </span>
            <span className="dt-btn dt-btn--small">Review</span>
          </a>
        ) : null}

        <section id="photos" className="dt-card dt-edit-section">
          <h2 className="dt-h-icon">
            <SectionIcon id="photos" /> Photos
          </h2>
          <PhotoManager photos={own.photos} onChange={(p) => setOwn((o) => (o ? { ...o, photos: p.photos, strength: p.strength } : p))} />
        </section>
        <section id="partners" className="dt-card dt-edit-section">
          <PartnerManager onCount={setPartnerCount} />
        </section>
        <section id="looks" className="dt-card dt-edit-section">
          <h2 className="dt-h-icon">
            <SectionIcon id="looks" /> Looks
          </h2>
          <LooksEditor web={web} onChange={setWeb} name={String(values.name ?? "")} />
        </section>
        <section id="prompts" className="dt-card dt-edit-section">
          <h2 className="dt-h-icon">
            <SectionIcon id="prompts" /> Prompts
          </h2>
          <p className="dt-help">Give people an easy way to start a conversation.</p>
          <PromptsEditor value={prompts} onChange={setPrompts} />
        </section>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="dt-card dt-edit-section">
            <h2 className="dt-h-icon">
              <SectionIcon id={s.id} /> {s.label}
            </h2>
            {s.id === "targets" ? <p className="dt-help">Only used for dating matches. Friends can find you either way.</p> : null}
            <div className="dt-edit-fields">
              {s.keys.map((k) =>
                k === "age" ? (
                  <AgeField key={k} value={values.age} locked={Boolean(own.ageLocked)} birth={data.birth} onChange={(v) => setValues((x) => ({ ...x, age: v }))} />
                ) : (
                  <FieldInput key={k} k={k} value={values[k]} flagged={flagged.has(k)} legacy={own.legacy[k]} onChange={(v) => setValues((x) => ({ ...x, [k]: v }))} />
                ),
              )}
            </div>
          </section>
        ))}


        <section id="fursonas" className="dt-card dt-edit-section">
          <h2 className="dt-h-icon">
            <SectionIcon id="fursonas" /> Fursonas
          </h2>
          <FursonaEditor value={sonas} onChange={setSonas} />
        </section>

        <section id="privacy" className="dt-card dt-edit-section">
          <h2 className="dt-h-icon">
            <SectionIcon id="privacy" /> Privacy
          </h2>
          {own.web.pausedByStaff ? (
            <div className="dt-banner dt-banner--warn">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>Staff paused your profile after a report. Open a ticket in the Discord server if you think this was a mistake.</span>
            </div>
          ) : null}
          <div className="dt-switches">
            <label className="dt-switch">
              <input type="checkbox" checked={!!web.paused} disabled={!!own.web.pausedByStaff} onChange={(e) => setWeb({ ...web, paused: e.target.checked })} />
              <span>
                <b>Pause my profile</b>
                <small>Hide from Discover, Browse and the hourly draw. Your matches and chats stay.</small>
              </span>
            </label>
            <label className="dt-switch">
              <input type="checkbox" checked={!!web.hideAge} onChange={(e) => setWeb({ ...web, hideAge: e.target.checked })} />
              <span>
                <b>Hide my age</b>
                <small>Your age is still used for matching, just not shown.</small>
              </span>
            </label>
            <label className="dt-switch">
              <input type="checkbox" checked={web.showOnline !== false} onChange={(e) => setWeb({ ...web, showOnline: e.target.checked })} />
              <span>
                <b>Show when I was last active</b>
                <small>Like &quot;online now&quot; or &quot;active 2h ago&quot;.</small>
              </span>
            </label>
          </div>
        </section>

        <section id="danger" className="dt-card dt-edit-section dt-danger">
          <h2 className="dt-h-icon">
            <SectionIcon id="danger" /> Delete profile
          </h2>
          <p className="dt-muted">Deletes your dating profile, photos, likes and matches. Your messages stay with the people you sent them to. This can&apos;t be undone.</p>
          <div className="dt-row">
            <input className="dt-input" placeholder='Type "DELETE"' value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} aria-label="Type DELETE to confirm" />
            <button
              type="button"
              className="dt-btn dt-btn--danger"
              disabled={confirmDel !== "DELETE"}
              onClick={async () => {
                const r = await fetch("/api/dating/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }).then((x) => x.json()).catch(() => null);
                if (r?.ok) window.location.href = "/social";
                else setMsg({ text: r?.error ?? "Couldn't delete.", bad: true });
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Delete forever
            </button>
          </div>
        </section>
      </div>

      <div className={`dt-savebar${dirty || msg ? " is-shown" : ""}`} role="region" aria-label="Save changes">
        {msg ? (
          <span className={msg.bad ? "dt-error" : "dt-ok"}>
            {msg.bad ? <TriangleAlert size={14} aria-hidden="true" /> : null} {msg.text}
          </span>
        ) : (
          <span>You have unsaved changes</span>
        )}
        {dirty ? (
          <div className="dt-row">
            <button type="button" className="dt-btn dt-btn--ghost dt-btn--small" onClick={() => load(own)}>
              Discard
            </button>
            <button type="button" className="dt-btn dt-btn--small" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 size={14} className="dt-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />} Save changes
            </button>
          </div>
        ) : (
          <button type="button" className="dt-textlink" onClick={() => setMsg(null)}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
