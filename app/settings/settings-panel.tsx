"use client";

import { Ban, Bell, Check, Send, Compass, Eye, HeartHandshake, KeyRound, Link2, Loader2, Lock, MessageCircle, Palette, PenLine, Settings2, ShieldCheck, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Empty, useApi } from "../social/ui";
import { ThemeSwitch } from "../theme-switch";

type Settings = {
  notify: Record<string, boolean>;
  dm: Record<string, boolean>;
  anonymousViews: boolean;
  messagesFrom: "everyone" | "connections";
  showLeft: boolean;
  discoverMode: "dating" | "friends";
  showInOnline: boolean;
  showViewCount: boolean;
  readReceipts: boolean;
  friendRequestsFrom: "everyone" | "matches" | "nobody";
  featured: boolean;
  discoverMinScore: 0 | 40 | 55 | 70;
  browseSort: "best" | "active" | "new";
  enterToSend: boolean;
  showPartners: boolean;
};
type Web = { accent?: string; headline?: string; paused?: boolean; pausedByStaff?: boolean; hideAge?: boolean; showOnline?: boolean };

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="dt-switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>{label}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string][]; onChange: (v: T) => void }) {
  return (
    <div className="dt-choices" role="radiogroup">
      {options.map(([v, label, hint]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "is-on" : undefined} onClick={() => onChange(v)}>
          <b>{label}</b>
          <small>{hint}</small>
        </button>
      ))}
    </div>
  );
}

function Section({ id, icon, title, intro, children }: { id: string; icon: ReactNode; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="dt-card dt-settings-section">
      <h2>
        <span className="dt-widget-icon" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {intro ? <p className="dt-help">{intro}</p> : null}
      <div className="dt-switches">{children}</div>
    </section>
  );
}

/** General settings for everyone: appearance and shortcuts to the account options on My Account. */
function GeneralSection() {
  return (
    <section id="general" className="dt-card dt-settings-section">
      <h2>
        <span className="dt-widget-icon" aria-hidden="true">
          <Settings2 size={16} />
        </span>
        General
      </h2>
      <div className="set-row">
        <span>
          <b>
            <Palette size={15} aria-hidden="true" /> Appearance
          </b>
          <small>Light, dark, or match your device.</small>
        </span>
        <ThemeSwitch />
      </div>
      <div className="dt-linkrows">
        <a href="/account#profile">
          <UserRound size={15} aria-hidden="true" /> Display name &amp; username
        </a>
        <a href="/account#contact">
          <Link2 size={15} aria-hidden="true" /> Contact &amp; socials
        </a>
        <a href="/account#security">
          <KeyRound size={15} aria-hidden="true" /> Password &amp; two-factor
        </a>
        <a href="/account#discord-account">
          <ShieldCheck size={15} aria-hidden="true" /> Discord link
        </a>
        <a href="/account#delete-account" className="is-danger">
          <TriangleAlert size={15} aria-hidden="true" /> Delete account
        </a>
      </div>
    </section>
  );
}

/**
 * Settings (the gear next to the bell): general settings for everyone, plus Social's notifications,
 * privacy and Discover settings for members who can use Social. Every change saves right away.
 */
export function SettingsPanel({ social }: { social: boolean }) {
  const settingsApi = useApi<{ settings: Settings; types: { key: string; label: string; hint?: string }[] }>(social ? "/api/dating/settings" : null);
  const meApi = useApi<{ profile: { web: Web } | null }>(social ? "/api/dating/me" : null);
  const [s, setS] = useState<Settings | null>(null);
  const [web, setWeb] = useState<Web | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (settingsApi.data) setS(settingsApi.data.settings);
  }, [settingsApi.data]);
  useEffect(() => {
    if (meApi.data?.profile) setWeb(meApi.data.profile.web);
  }, [meApi.data]);
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(null), 2200);
    return () => window.clearTimeout(t);
  }, [saved]);

  if (!social) {
    return (
      <div className="dt-settings">
        <aside className="dt-editor-nav">
          <nav aria-label="Settings sections">
            <a href="#general">
              <Settings2 size={15} aria-hidden="true" /> General
            </a>
          </nav>
        </aside>
        <div className="dt-editor-main">
          <GeneralSection />
          <section className="dt-card dt-settings-section">
            <h2>
              <span className="dt-widget-icon" aria-hidden="true">
                <HeartHandshake size={16} />
              </span>
              Social
            </h2>
            <p className="dt-help">Notification, privacy and Discover settings for Social show up here once you have the 18+ Verified role and your Discord is linked.</p>
          </section>
        </div>
      </div>
    );
  }
  if (settingsApi.error) return <p className="dt-error">{settingsApi.error}</p>;
  if (!s || !settingsApi.data) return <div className="dt-loading" aria-busy="true" />;

  const save = async (patch: Partial<Settings> | { notify: Record<string, boolean> } | { dm: Record<string, boolean> }) => {
    setSaving(true);
    const res = await fetch("/api/dating/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setS(res.settings);
      setSaved("Saved");
    } else setSaved("Couldn't save. Try again.");
  };
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS({ ...s, [k]: v });
    void save({ [k]: v } as Partial<Settings>);
  };
  const saveWeb = async (patch: Partial<Web>) => {
    if (!web) return;
    const next = { ...web, ...patch };
    setWeb(next);
    setSaving(true);
    const res = await fetch("/api/dating/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ web: next }) }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      setWeb(res.profile.web);
      setSaved("Saved");
    } else setSaved(res?.error ?? "Couldn't save. Try again.");
  };
  const allOn = settingsApi.data.types.every((t) => s.notify[t.key] !== false);
  const dmOn = settingsApi.data.types.some((t) => s.dm[t.key] === true);

  return (
    <div className="dt-settings">
      <aside className="dt-editor-nav">
        <nav aria-label="Settings sections">
          <a href="#general">
            <Settings2 size={15} aria-hidden="true" /> General
          </a>
          <a href="#notifications">
            <Bell size={15} aria-hidden="true" /> Notifications
          </a>
          <a href="#dms">
            <Send size={15} aria-hidden="true" /> Discord DMs
          </a>
          <a href="#privacy">
            <Lock size={15} aria-hidden="true" /> Privacy
          </a>
          <a href="#messages">
            <MessageCircle size={15} aria-hidden="true" /> Messages
          </a>
          <a href="#discover">
            <Compass size={15} aria-hidden="true" /> Discover
          </a>
          <a href="#account">
            <UserRound size={15} aria-hidden="true" /> Social profile
          </a>
        </nav>
        <p className={`dt-saved${saved ? " is-shown" : ""}`} role="status">
          {saving ? <Loader2 size={13} className="dt-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} {saving ? "Saving…" : saved ?? "Changes save automatically"}
        </p>
      </aside>

      <div className="dt-editor-main">
        <GeneralSection />
        <Section id="notifications" icon={<Bell size={16} />} title="Notifications" intro="Choose what shows up in the bell next to My Account.">
          <Toggle
            label="All notifications"
            hint={allOn ? "Everything is on" : "Some are off"}
            checked={allOn}
            onChange={(v) => {
              const notify = Object.fromEntries(settingsApi.data!.types.map((t) => [t.key, v]));
              setS({ ...s, notify });
              void save({ notify });
            }}
          />
          <div className="dt-switches dt-switches--nested">
            {settingsApi.data.types.map((t) => (
              <Toggle
                key={t.key}
                label={t.label}
                hint={t.hint}
                checked={s.notify[t.key] !== false}
                onChange={(v) => {
                  setS({ ...s, notify: { ...s.notify, [t.key]: v } });
                  void save({ notify: { [t.key]: v } });
                }}
              />
            ))}
          </div>
        </Section>

        <Section id="dms" icon={<Send size={16} />} title="Discord DMs" intro="Get a little message from the Kitty Kingdom bot in your Discord DMs, with who it was and a button to open it here. Off unless you turn them on.">
          <Toggle
            label="Send me Discord DMs"
            hint={dmOn ? "On for the ones below" : "All off"}
            checked={dmOn}
            onChange={(v) => {
              const dm = Object.fromEntries(settingsApi.data!.types.map((t) => [t.key, v && (t.key === "view" ? false : true)]));
              setS({ ...s, dm });
              void save({ dm });
            }}
          />
          <div className="dt-switches dt-switches--nested">
            {settingsApi.data.types.map((t) => (
              <Toggle
                key={t.key}
                label={t.label}
                checked={s.dm[t.key] === true}
                onChange={(v) => {
                  setS({ ...s, dm: { ...s.dm, [t.key]: v } });
                  void save({ dm: { [t.key]: v } });
                }}
              />
            ))}
          </div>
          <p className="dt-help">Make sure your Discord privacy settings allow DMs from server members, or they won&apos;t arrive. You&apos;ll get at most a few per few minutes.</p>
        </Section>

        <Section id="privacy" icon={<Lock size={16} />} title="Privacy">
          <Toggle label="Browse anonymously" hint="People aren't told when you view their profile, and you won't appear in their 'Viewed you' list." checked={s.anonymousViews} onChange={(v) => set("anonymousViews", v)} />
          <Toggle label="Appear in Online now" hint="Show your bubble on the Social home while you're on the site." checked={s.showInOnline} onChange={(v) => set("showInOnline", v)} />
          <Toggle label="Show my profile view count" hint="Others still see whether you viewed their profile (unless you browse anonymously)." checked={s.showViewCount} onChange={(v) => set("showViewCount", v)} />
          <Toggle label="Show my partners on my profile" hint="Linked, confirmed partners appear under your name." checked={s.showPartners} onChange={(v) => set("showPartners", v)} />
          <Toggle label="Include me in Featured this hour" hint="The hourly draw on the Social home (only if you're open to dating)." checked={s.featured} onChange={(v) => set("featured", v)} />
          {web ? (
            <>
              {web.pausedByStaff ? <p className="dt-error">Staff paused your profile after a report. Open a ticket in the Discord server if you think this was a mistake.</p> : null}
              <Toggle label="Pause my profile" hint="Hide from Discover, Browse and the hourly draw. Your matches, friends and chats stay." checked={!!web.paused} disabled={!!web.pausedByStaff} onChange={(v) => void saveWeb({ paused: v })} />
              <Toggle label="Hide my age" hint="Still used for matching, just not shown." checked={!!web.hideAge} onChange={(v) => void saveWeb({ hideAge: v })} />
              <Toggle label="Show when I was last active" hint={'Like "online now" or "active 2h ago".'} checked={web.showOnline !== false} onChange={(v) => void saveWeb({ showOnline: v })} />
            </>
          ) : (
            <p className="dt-muted">Profile privacy options appear once you&apos;ve made a profile.</p>
          )}
        </Section>

        <section id="messages" className="dt-card dt-settings-section">
          <h2>
            <span className="dt-widget-icon" aria-hidden="true">
              <MessageCircle size={16} />
            </span>
            Messages &amp; friend requests
          </h2>
          <p className="dt-help">Who can message me</p>
          <Choice
            value={s.messagesFrom}
            onChange={(v) => set("messagesFrom", v)}
            options={[
              ["everyone", "Anyone", "People who aren't matches or friends start in your Requests tab until you accept."],
              ["connections", "Matches & friends only", "Nobody else can start a chat with you."],
            ]}
          />
          <p className="dt-help">Who can send me friend requests</p>
          <Choice
            value={s.friendRequestsFrom}
            onChange={(v) => set("friendRequestsFrom", v)}
            options={[
              ["everyone", "Anyone", "Any member can add you."],
              ["matches", "Matches only", "Only people you've matched with."],
              ["nobody", "Nobody", "Turn friend requests off."],
            ]}
          />
          <div className="dt-switches">
            <Toggle label="Read receipts" hint={'Show "Seen" in chats. Works both ways: turn it off and you won\'t see theirs either.'} checked={s.readReceipts} onChange={(v) => set("readReceipts", v)} />
            <Toggle label="Press Enter to send" hint="Off: Enter adds a new line and you send with the button." checked={s.enterToSend} onChange={(v) => set("enterToSend", v)} />
          </div>
        </section>

        <section id="discover" className="dt-card dt-settings-section">
          <h2>
            <span className="dt-widget-icon" aria-hidden="true">
              <Compass size={16} />
            </span>
            Discover &amp; Browse
          </h2>
          <p className="dt-help">Which Discover opens in</p>
          <Choice
            value={s.discoverMode}
            onChange={(v) => set("discoverMode", v)}
            options={[
              ["dating", "Dating", "Your best dating matches."],
              ["friends", "Friends", "People you'd get along with."],
            ]}
          />
          <p className="dt-help">Hide Discover matches below</p>
          <Choice
            value={String(s.discoverMinScore) as "0" | "40" | "55" | "70"}
            onChange={(v) => set("discoverMinScore", Number(v) as Settings["discoverMinScore"])}
            options={[
              ["0", "Show all", "Everyone who fits your preferences."],
              ["40", "40%", "Skip weak matches."],
              ["55", "55%", "Good matches and up."],
              ["70", "70%", "Only strong matches."],
            ]}
          />
          <p className="dt-help">Browse sorts by default</p>
          <Choice
            value={s.browseSort}
            onChange={(v) => set("browseSort", v)}
            options={[
              ["best", "Best match", "Your strongest matches first."],
              ["active", "Recently active", "Who's around lately."],
              ["new", "Newest", "The newest profiles first."],
            ]}
          />
          <div className="dt-switches">
            <Toggle label="Show members who left the server" hint="Their profiles are marked 'Left server'. Banned members never show." checked={s.showLeft} onChange={(v) => set("showLeft", v)} />
          </div>
        </section>

        <section id="account" className="dt-card dt-settings-section">
          <h2>
            <span className="dt-widget-icon" aria-hidden="true">
              <UserRound size={16} />
            </span>
            Social profile
          </h2>
          <div className="dt-linkrows">
            <a href="/social/profile/edit">
              <PenLine size={15} aria-hidden="true" /> Edit my profile
            </a>
            {meApi.data?.profile ? null : (
              <a href="/social/setup">
                <PenLine size={15} aria-hidden="true" /> Create my profile
              </a>
            )}
            <a href="/social/likes?tab=views">
              <Eye size={15} aria-hidden="true" /> Who viewed my profile
            </a>
            <a href="/social/hidden">
              <Ban size={15} aria-hidden="true" /> Hidden profiles (blocked, passed, skipped)
            </a>
            <a href="/social/profile/edit#danger" className="is-danger">
              <Trash2 size={15} aria-hidden="true" /> Delete my dating profile
            </a>
          </div>
        </section>
        {meApi.error && !meApi.data ? <Empty icon={<UserRound size={24} />} title="Couldn't load your profile" /> : null}
      </div>
    </div>
  );
}
