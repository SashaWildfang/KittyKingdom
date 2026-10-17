"use client";

import {
  Settings as SettingsIcon,
  Ban,
  Bell,
  Check,
  Compass,
  Eye,
  HeartHandshake,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Palette,
  PenLine,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApi } from "../social/ui";
import { AccountPane, AppearancePane, EmailPane, LevelUpSetting, SecurityPane, type AccountSummary } from "./settings-panes";
import { ChoiceRow, Group, LinkRow, Switch, ToggleRow, slug } from "./settings-ui";

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
type NotifyType = { key: string; label: string; hint?: string };

type Category = "account" | "security" | "appearance" | "email" | "notifications" | "privacy" | "messages" | "discover" | "profile";
type Section = "You" | "Notifications" | "Social";
const CATEGORIES: { key: Category; label: string; blurb: string; icon: LucideIcon; section: Section; social?: boolean }[] = [
  { key: "account", label: "Account", blurb: "Your profile, email and Discord link", icon: UserRound, section: "You" },
  { key: "security", label: "Security", blurb: "Two-factor, password and devices", icon: ShieldCheck, section: "You" },
  { key: "appearance", label: "Appearance", blurb: "Theme, text size and motion", icon: Palette, section: "You" },
  { key: "email", label: "Email", blurb: "News, events and other emails", icon: Mail, section: "Notifications" },
  { key: "notifications", label: "Site & Discord", blurb: "The bell, Discord DMs and level-ups", icon: Bell, section: "Notifications" },
  { key: "privacy", label: "Privacy", blurb: "What others can see", icon: Lock, section: "Social", social: true },
  { key: "messages", label: "Messages", blurb: "Who can reach you", icon: MessageCircle, section: "Social", social: true },
  { key: "discover", label: "Discover & Browse", blurb: "How profiles are shown to you", icon: Compass, section: "Social", social: true },
  { key: "profile", label: "Social profile", blurb: "Edit, hidden profiles and more", icon: HeartHandshake, section: "Social", social: true },
];
// Old links (#dms, #general…) still land in the right place
const ALIASES: Record<string, Category> = { general: "account", dms: "notifications", social: "profile", theme: "appearance", emails: "email" };

// What the search box looks through: each setting, where it lives, and other words people might type
const SEARCH: { cat: Category; title: string; words?: string; social?: boolean }[] = [
  { cat: "account", title: "Name, username & phone", words: "display name nickname phone number" },
  { cat: "account", title: "Email address", words: "change email confirm verify" },
  { cat: "account", title: "Discord link", words: "link unlink discord account" },
  { cat: "account", title: "Punishments & appeals", words: "ban mute warn record appeal" },
  { cat: "account", title: "Delete account", words: "remove close account danger" },
  { cat: "security", title: "Two-factor authentication", words: "2fa authenticator code otp" },
  { cat: "security", title: "Password", words: "change password" },
  { cat: "security", title: "Devices & sessions", words: "sign out log out logged in devices" },
  { cat: "security", title: "Security alert emails" },
  { cat: "appearance", title: "Theme", words: "dark mode light mode colors" },
  { cat: "appearance", title: "Text size", words: "font bigger smaller zoom accessibility" },
  { cat: "appearance", title: "Animations", words: "reduce motion accessibility" },
  { cat: "appearance", title: "Seasonal effects", words: "leaves snow petals particles falling" },
  { cat: "email", title: "News posts", words: "email newsletter updates announcements" },
  { cat: "email", title: "New events", words: "email calendar" },
  { cat: "email", title: "Event reminders", words: "email remind" },
  { cat: "email", title: "New giveaways", words: "email prize" },
  { cat: "email", title: "New matches", words: "email social dating", social: true },
  { cat: "email", title: "New messages", words: "email social chat unread", social: true },
  { cat: "email", title: "Friend requests", words: "email social friends", social: true },
  { cat: "email", title: "Turn off all notification emails", words: "unsubscribe stop emails" },
  { cat: "notifications", title: "Level-up messages in Discord", words: "levelup level up ping mention xp" },
  { cat: "notifications", title: "Notify me about", words: "bell discord dm likes matches", social: true },
  { cat: "privacy", title: "Browse anonymously", words: "views incognito", social: true },
  { cat: "privacy", title: "Appear in “Online now”", words: "online status", social: true },
  { cat: "privacy", title: "Show my profile view count", social: true },
  { cat: "privacy", title: "Show my partners on my profile", social: true },
  { cat: "privacy", title: "Show when I was last active", words: "online last seen", social: true },
  { cat: "privacy", title: "Hide my age", social: true },
  { cat: "privacy", title: "Include me in Featured this hour", social: true },
  { cat: "privacy", title: "Pause my profile", words: "hide", social: true },
  { cat: "messages", title: "Who can message me", words: "dm requests", social: true },
  { cat: "messages", title: "Who can send me friend requests", social: true },
  { cat: "messages", title: "Read receipts", words: "seen", social: true },
  { cat: "messages", title: "Press Enter to send", words: "keyboard", social: true },
  { cat: "discover", title: "Open Discover in", words: "dating friends", social: true },
  { cat: "discover", title: "Hide matches below", words: "score percent", social: true },
  { cat: "discover", title: "Sort by default", words: "browse order", social: true },
  { cat: "discover", title: "Show members who left the server", social: true },
  { cat: "profile", title: "Edit my profile", words: "photos bio", social: true },
  { cat: "profile", title: "Hidden profiles", words: "blocked passed", social: true },
];

/**
 * Settings (the gear next to the bell). Grouped into You (account, security, appearance), Notifications
 * (email, site & Discord) and Social (for members who can use Social). Search finds any setting.
 * Every change saves right away.
 */
export function SettingsPanel({ social, account }: { social: boolean; account: AccountSummary }) {
  const settingsApi = useApi<{ settings: Settings; types: NotifyType[] }>(social ? "/api/dating/settings" : null);
  const meApi = useApi<{ profile: { web: Web } | null }>(social ? "/api/dating/me" : null);
  const [s, setS] = useState<Settings | null>(null);
  const [web, setWeb] = useState<Web | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const categories = CATEGORIES.filter((c) => social || !c.social);
  const [cat, setCat] = useState<Category>("account");
  const [query, setQuery] = useState("");
  const pendingJump = useRef<string | null>(null);

  // The address bar's #section picks the category (and old links keep working)
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      const key = (ALIASES[h] ?? h) as Category;
      if (categories.some((c) => c.key === key)) setCat(key);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social]);
  // On phones the categories scroll sideways: keep the open one in view
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".set-nav");
    const on = nav?.querySelector<HTMLElement>(".is-on");
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
  }, [cat]);
  const open = (key: Category) => {
    setCat(key);
    window.history.replaceState(null, "", `#${key}`);
  };

  // A search result: open its category, then scroll to the setting and flash it (it may still be loading)
  const jump = (key: Category, title: string) => {
    setQuery("");
    open(key);
    pendingJump.current = slug(title);
  };
  useEffect(() => {
    if (!pendingJump.current) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const el = pendingJump.current ? document.getElementById(pendingJump.current) : null;
      if (el || ++tries > 20) {
        window.clearInterval(t);
        pendingJump.current = null;
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }
    }, 100);
    return () => window.clearInterval(t);
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return SEARCH.filter((r) => (social || !r.social) && words.every((w) => `${r.title} ${r.words ?? ""} ${CATEGORIES.find((c) => c.key === r.cat)?.label}`.toLowerCase().includes(w))).slice(0, 8);
  }, [query, social]);

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

  const onStatus = (busy: boolean, msg: string | null) => {
    setSaving(busy);
    if (msg) setSaved(msg);
  };
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
    if (!s) return;
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

  const current = categories.find((c) => c.key === cat) ?? categories[0];
  const types = settingsApi.data?.types ?? [];
  const socialReady = Boolean(s && settingsApi.data);

  let pane: ReactNode = null;
  if (current.key === "account") pane = <AccountPane account={account} social={social} />;
  else if (current.key === "security") pane = <SecurityPane account={account} />;
  else if (current.key === "appearance") pane = <AppearancePane />;
  else if (current.key === "email") pane = <EmailPane social={social} onStatus={onStatus} />;
  else if (current.key === "notifications" && !social)
    pane = (
      <Group title="Discord">
        <LevelUpSetting onStatus={onStatus} />
      </Group>
    );
  else if (settingsApi.error) pane = <p className="set-error">{settingsApi.error}</p>;
  else if (!socialReady || !s) pane = <div className="set-loading" aria-busy="true" />;
  else if (cat === "notifications") {
    const allSite = types.every((t) => s.notify[t.key] !== false);
    const allDm = types.length > 0 && types.every((t) => s.dm[t.key] === true || t.key === "view");
    pane = (
      <>
        <Group title="Discord">
          <LevelUpSetting onStatus={onStatus} />
        </Group>
        <Group title="Social" intro="Pick where you hear about each thing: in the bell on the site, as a Discord DM from the Bear Nation bot, or both. Emails are in Settings → Email.">
          <div className="set-matrix" role="table" aria-label="Notification settings" id={slug("Notify me about")}>
            <div className="set-matrix-head" role="row">
              <span role="columnheader">Notify me about</span>
              <span role="columnheader">On the site</span>
              <span role="columnheader">Discord DM</span>
            </div>
            <div className="set-matrix-row is-all" role="row">
              <span className="set-row-text" role="cell">
                <b>Everything</b>
                <small>Turn a whole column on or off</small>
              </span>
              <span role="cell">
                <Switch
                  label="All on-site notifications"
                  checked={allSite}
                  onChange={(v) => {
                    const notify = Object.fromEntries(types.map((t) => [t.key, v]));
                    setS({ ...s, notify });
                    void save({ notify });
                  }}
                />
              </span>
              <span role="cell">
                <Switch
                  label="All Discord DMs"
                  checked={allDm}
                  onChange={(v) => {
                    const dm = Object.fromEntries(types.map((t) => [t.key, v && t.key !== "view"]));
                    setS({ ...s, dm });
                    void save({ dm });
                  }}
                />
              </span>
            </div>
            {types.map((t) => (
              <div key={t.key} className="set-matrix-row" role="row">
                <span className="set-row-text" role="cell">
                  <b>{t.label}</b>
                  {t.hint ? <small>{t.hint}</small> : null}
                </span>
                <span role="cell">
                  {t.key === "message" || t.key === "request" ? (
                    // Messages always show on the envelope at the top of the site
                    <span className="set-matrix-fixed" title="Shown on the envelope at the top of the site">
                      <Mail size={14} aria-hidden="true" /> Envelope
                    </span>
                  ) : (
                    <Switch
                      label={`${t.label} on the site`}
                      checked={s.notify[t.key] !== false}
                      onChange={(v) => {
                        setS({ ...s, notify: { ...s.notify, [t.key]: v } });
                        void save({ notify: { [t.key]: v } });
                      }}
                    />
                  )}
                </span>
                <span role="cell">
                  <Switch
                    label={`${t.label} as a Discord DM`}
                    checked={s.dm[t.key] === true}
                    onChange={(v) => {
                      setS({ ...s, dm: { ...s.dm, [t.key]: v } });
                      void save({ dm: { [t.key]: v } });
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
          <p className="set-note">
            <MessageCircle size={15} aria-hidden="true" /> Message DMs are a reminder: if a message is still unread after 10 minutes, the bot DMs you once. Other DMs are off unless you turn them on. Your Discord privacy settings must allow DMs from server members.
          </p>
        </Group>
      </>
    );
  } else if (cat === "privacy") {
    pane = (
      <>
        <Group title="What others see">
          <ToggleRow title="Browse anonymously" hint="People aren't told when you view their profile, and you won't appear in their “Viewed you” list." checked={s.anonymousViews} onChange={(v) => set("anonymousViews", v)} />
          <ToggleRow title="Appear in “Online now”" hint="Show your bubble on the Social home while you're on the site." checked={s.showInOnline} onChange={(v) => set("showInOnline", v)} />
          <ToggleRow title="Show my profile view count" hint="Others still see whether you viewed their profile (unless you browse anonymously)." checked={s.showViewCount} onChange={(v) => set("showViewCount", v)} />
          <ToggleRow title="Show my partners on my profile" hint="Linked, confirmed partners appear under your name." checked={s.showPartners} onChange={(v) => set("showPartners", v)} />
          {web ? (
            <>
              <ToggleRow title="Show when I was last active" hint="Like “online now” or “active 2h ago”." checked={web.showOnline !== false} onChange={(v) => void saveWeb({ showOnline: v })} />
              <ToggleRow title="Hide my age" hint="Still used for matching, just not shown." checked={!!web.hideAge} onChange={(v) => void saveWeb({ hideAge: v })} />
            </>
          ) : null}
        </Group>
        <Group title="Your profile">
          <ToggleRow title="Include me in Featured this hour" hint="The hourly draw on the Social home (only if you're open to dating)." checked={s.featured} onChange={(v) => set("featured", v)} />
          {web ? (
            <>
              {web.pausedByStaff ? <p className="set-error">Staff paused your profile after a report. Open a ticket in the Discord server if you think this was a mistake.</p> : null}
              <ToggleRow title="Pause my profile" hint="Hide from Discover, Browse and the hourly draw. Your matches, friends and chats stay." checked={!!web.paused} disabled={!!web.pausedByStaff} onChange={(v) => void saveWeb({ paused: v })} />
            </>
          ) : (
            <p className="set-note">More profile options appear once you&apos;ve made a Social profile.</p>
          )}
        </Group>
      </>
    );
  } else if (cat === "messages") {
    pane = (
      <>
        <Group title="Who can reach you">
          <ChoiceRow
            title="Who can message me"
            value={s.messagesFrom}
            onChange={(v) => set("messagesFrom", v)}
            options={[
              ["everyone", "Anyone", "People who aren't matches or friends land in your Requests until you accept."],
              ["connections", "Matches & friends only", "Nobody else can start a chat with you."],
            ]}
          />
          <ChoiceRow
            title="Who can send me friend requests"
            value={s.friendRequestsFrom}
            onChange={(v) => set("friendRequestsFrom", v)}
            options={[
              ["everyone", "Anyone", "Any member can add you."],
              ["matches", "Matches only", "Only people you've matched with."],
              ["nobody", "Nobody", "Friend requests are off."],
            ]}
          />
        </Group>
        <Group title="Chatting">
          <ToggleRow title="Read receipts" hint="Show “Seen” in chats. Works both ways: turn it off and you won't see theirs either." checked={s.readReceipts} onChange={(v) => set("readReceipts", v)} />
          <ToggleRow title="Press Enter to send" hint="Off: Enter adds a new line and you send with the button." checked={s.enterToSend} onChange={(v) => set("enterToSend", v)} />
        </Group>
      </>
    );
  } else if (cat === "discover") {
    pane = (
      <>
        <Group title="Discover">
          <ChoiceRow
            title="Open Discover in"
            value={s.discoverMode}
            onChange={(v) => set("discoverMode", v)}
            options={[
              ["dating", "Dating", "Your best dating matches."],
              ["friends", "Friends", "People you'd get along with."],
            ]}
          />
          <ChoiceRow
            title="Hide matches below"
            value={String(s.discoverMinScore) as "0" | "40" | "55" | "70"}
            onChange={(v) => set("discoverMinScore", Number(v) as Settings["discoverMinScore"])}
            options={[
              ["0", "Show all", "Everyone who fits your preferences."],
              ["40", "40%", "Skip weak matches."],
              ["55", "55%", "Good matches and up."],
              ["70", "70%", "Only strong matches."],
            ]}
          />
        </Group>
        <Group title="Browse">
          <ChoiceRow
            title="Sort by default"
            value={s.browseSort}
            onChange={(v) => set("browseSort", v)}
            options={[
              ["best", "Best match", "Your strongest matches first."],
              ["active", "Recently active", "Who's around lately."],
              ["new", "Newest", "The newest profiles first."],
            ]}
          />
          <ToggleRow title="Show members who left the server" hint="Their profiles are marked “Left server”. Banned members never show." checked={s.showLeft} onChange={(v) => set("showLeft", v)} />
        </Group>
      </>
    );
  } else if (cat === "profile") {
    pane = (
      <>
        <Group title="Your Social profile">
          {meApi.data?.profile ? (
            <LinkRow href="/social/profile/edit" icon={PenLine} title="Edit my profile" hint="Photos, bio, prompts and more" />
          ) : (
            <LinkRow href="/social/setup" icon={PenLine} title="Create my profile" hint="The guided setup fills in what it can" />
          )}
          <LinkRow href="/social/likes?tab=views" icon={Eye} title="Who viewed my profile" />
          <LinkRow href="/social/hidden" icon={Ban} title="Hidden profiles" hint="People you blocked, passed or skipped" />
        </Group>
        {meApi.data?.profile ? (
          <Group title="Danger zone" tone="danger">
            <LinkRow href="/social/profile/edit#danger" icon={Trash2} title="Delete my Social profile" hint="Your website account stays" danger />
          </Group>
        ) : null}
      </>
    );
  }

  const sections = (["You", "Notifications", "Social"] as Section[]).map((name) => ({ name, items: categories.filter((c) => c.section === name) })).filter((x) => x.items.length);

  return (
    <div className="set-layout">
      {/* Sidebar: title, search, then every category by section (it never moves when you switch) */}
      <aside className="set-side">
        <header className="set-side-head">
          <span className="set-side-icon" aria-hidden="true">
            <SettingsIcon size={20} />
          </span>
          <div>
            <h1>Settings</h1>
            <p>Changes save automatically.</p>
          </div>
        </header>
        <div className="set-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) jump(results[0].cat, results[0].title);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Search settings"
            aria-label="Search settings"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {query.trim() ? (
          <div className="set-results" role="listbox" aria-label="Matching settings">
            {results.length ? (
              results.map((r) => {
                const c = CATEGORIES.find((x) => x.key === r.cat)!;
                return (
                  <button key={`${r.cat}-${r.title}`} type="button" role="option" aria-selected="false" onClick={() => jump(r.cat, r.title)}>
                    <span className="set-nav-icon" aria-hidden="true">
                      <c.icon size={15} />
                    </span>
                    <span className="set-nav-text">
                      <b>{r.title}</b>
                      <small>{c.label}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="set-results-empty">No settings match “{query.trim()}”.</p>
            )}
          </div>
        ) : (
          <nav className="set-nav" aria-label="Settings categories">
            {sections.map((sec) => (
              <div key={sec.name} className="set-nav-section">
                <p className="set-nav-label">{sec.name}</p>
                {sec.items.map((c) => (
                  <button key={c.key} type="button" className={c.key === current.key ? "is-on" : undefined} aria-current={c.key === current.key ? "page" : undefined} onClick={() => open(c.key)}>
                    <span className="set-nav-icon" aria-hidden="true">
                      <c.icon size={17} />
                    </span>
                    <span className="set-nav-text">
                      <b>{c.label}</b>
                      <small>{c.blurb}</small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}
      </aside>
      <div className="set-main">
        <header className="set-main-head">
          <div>
            <h2>
              <current.icon size={20} aria-hidden="true" /> {current.label}
            </h2>
            <p>{current.blurb}</p>
          </div>
          <p className={`set-saved${saving || saved ? " is-shown" : ""}${saved && saved !== "Saved" ? " is-error" : ""}`} role="status">
            {saving ? <Loader2 size={14} className="set-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} {saving ? "Saving…" : saved ?? "Saved"}
          </p>
        </header>
        {pane}
      </div>
    </div>
  );
}
