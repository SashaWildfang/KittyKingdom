"use client";

import {
  Ban,
  Bell,
  Check,
  ChevronRight,
  Compass,
  Eye,
  HeartHandshake,
  KeyRound,
  Gavel,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Palette,
  PenLine,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApi } from "../social/ui";
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
type NotifyType = { key: string; label: string; hint?: string };

type Category = "account" | "notifications" | "privacy" | "messages" | "discover" | "profile";
const CATEGORIES: { key: Category; label: string; blurb: string; icon: LucideIcon; social?: boolean }[] = [
  { key: "account", label: "Account", blurb: "Appearance, Discord level-ups and your account", icon: UserRound },
  { key: "notifications", label: "Notifications", blurb: "What you're told about, and where", icon: Bell, social: true },
  { key: "privacy", label: "Privacy", blurb: "What others can see", icon: Lock, social: true },
  { key: "messages", label: "Messages", blurb: "Who can reach you", icon: MessageCircle, social: true },
  { key: "discover", label: "Discover & Browse", blurb: "How profiles are shown to you", icon: Compass, social: true },
  { key: "profile", label: "Social profile", blurb: "Edit, hidden profiles and more", icon: HeartHandshake, social: true },
];
// Old links (#dms, #general…) still land in the right place
const ALIASES: Record<string, Category> = { general: "account", dms: "notifications", social: "profile" };

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`set-switch${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
      <i aria-hidden="true" />
    </button>
  );
}

/** One setting: what it is on the left, the control on the right. */
function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

function ToggleRow({ title, hint, checked, disabled, onChange }: { title: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row title={title} hint={hint}>
      <Switch checked={checked} disabled={disabled} onChange={onChange} label={title} />
    </Row>
  );
}

/** A question with a few answers, as selectable cards. */
function ChoiceRow<T extends string>({ title, value, options, onChange }: { title: string; value: T; options: [T, string, string][]; onChange: (v: T) => void }) {
  return (
    <div className="set-choice">
      <b>{title}</b>
      <div className="set-choice-options" role="radiogroup" aria-label={title}>
        {options.map(([v, label, hint]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "is-on" : undefined} onClick={() => onChange(v)}>
            <span className="set-choice-dot" aria-hidden="true" />
            <span>
              <b>{label}</b>
              <small>{hint}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Group({ title, intro, children }: { title?: string; intro?: string; children: ReactNode }) {
  return (
    <section className="set-group">
      {title ? <h3>{title}</h3> : null}
      {intro ? <p className="set-intro">{intro}</p> : null}
      <div className="set-rows">{children}</div>
    </section>
  );
}

function LinkRow({ href, icon: Icon, title, hint, danger }: { href: string; icon: LucideIcon; title: string; hint?: string; danger?: boolean }) {
  return (
    <a className={`set-link${danger ? " is-danger" : ""}`} href={href}>
      <span className="set-link-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="set-row-text">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="set-link-chev" />
    </a>
  );
}

type LevelUps = "on" | "quiet" | "off";

/** Discord level-up messages: with a ping, without, or none at all (needs Discord linked). */
function LevelUpSetting({ onStatus }: { onStatus: (saving: boolean, saved: string | null) => void }) {
  const [mode, setMode] = useState<LevelUps | null>(null);
  const [unlinked, setUnlinked] = useState(false);
  useEffect(() => {
    fetch("/api/account/levelups", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (r.status === 403) setUnlinked(true);
        else if (body?.ok) setMode(body.mode);
      })
      .catch(() => undefined);
  }, []);
  if (unlinked) {
    return (
      <p className="set-note">
        <Bell size={15} aria-hidden="true" /> Link your Discord on My Account to choose how level-ups are announced.
      </p>
    );
  }
  if (!mode) return <div className="set-loading" aria-busy="true" />;
  return (
    <ChoiceRow
      title="Level-up messages in Discord"
      value={mode}
      onChange={async (v) => {
        const prev = mode;
        setMode(v);
        onStatus(true, null);
        const res = await fetch("/api/account/levelups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: v }) })
          .then((r) => r.json())
          .catch(() => null);
        if (!res?.ok) setMode(prev);
        onStatus(false, res?.ok ? "Saved" : res?.error ?? "Couldn't save. Try again.");
      }}
      options={[
        ["on", "On", "A congrats message where you levelled up, with an @mention."],
        ["quiet", "Quiet", "The same message, but it won't ping you."],
        ["off", "Off", "No level-up messages. You still get your level roles and perks."],
      ]}
    />
  );
}

function AccountPane({ social, onStatus }: { social: boolean; onStatus: (saving: boolean, saved: string | null) => void }) {
  return (
    <>
      <Group title="Appearance">
        <Row title="Theme" hint="Light, dark, or match your device.">
          <ThemeSwitch />
        </Row>
      </Group>
      <Group title="Discord">
        <LevelUpSetting onStatus={onStatus} />
      </Group>
      <Group title="Your account" intro="These open on My Account.">
        <LinkRow href="/account#profile" icon={PenLine} title="Name, username & phone" hint="How you appear around the site, and your private phone number" />
        <LinkRow href="/account#punishments" icon={Gavel} title="Punishments & appeals" hint="Your moderation record, when it ends, and appeals" />
        <LinkRow href="/account#security" icon={KeyRound} title="Password & two-factor" hint="Keep your account secure" />
        <LinkRow href="/account#discord-account" icon={ShieldCheck} title="Discord link" hint="Link or unlink your Discord account" />
      </Group>
      {!social ? (
        <Group title="Social">
          <p className="set-note">
            <HeartHandshake size={16} aria-hidden="true" /> Notification, privacy and message settings for Social show up here once you have the 18+ Verified role and your Discord is linked.
          </p>
        </Group>
      ) : null}
      <Group title="Danger zone">
        <LinkRow href="/account#delete-account" icon={TriangleAlert} title="Delete account" hint="Permanently remove your website account" danger />
      </Group>
    </>
  );
}

/**
 * Settings (the gear next to the bell). One category at a time: Account for everyone, plus
 * Notifications, Privacy, Messages, Discover and Social profile for members who can use Social.
 * Every change saves right away.
 */
export function SettingsPanel({ social }: { social: boolean }) {
  const settingsApi = useApi<{ settings: Settings; types: NotifyType[] }>(social ? "/api/dating/settings" : null);
  const meApi = useApi<{ profile: { web: Web } | null }>(social ? "/api/dating/me" : null);
  const [s, setS] = useState<Settings | null>(null);
  const [web, setWeb] = useState<Web | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const categories = CATEGORIES.filter((c) => social || !c.social);
  const [cat, setCat] = useState<Category>("account");

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
  const needsSocial = current.social;
  const socialReady = Boolean(s && settingsApi.data);

  let pane: ReactNode = null;
  if (!needsSocial)
    pane = (
      <AccountPane
        social={social}
        onStatus={(busy, msg) => {
          setSaving(busy);
          if (msg) setSaved(msg);
        }}
      />
    );
  else if (settingsApi.error) pane = <p className="set-error">{settingsApi.error}</p>;
  else if (!socialReady || !s) pane = <div className="set-loading" aria-busy="true" />;
  else if (cat === "notifications") {
    const allSite = types.every((t) => s.notify[t.key] !== false);
    const allDm = types.length > 0 && types.every((t) => s.dm[t.key] === true || t.key === "view");
    pane = (
      <>
        <Group intro="Pick where you hear about each thing: in the bell on the site, as a Discord DM from the Kitty Kingdom bot, or both.">
          <div className="set-matrix" role="table" aria-label="Notification settings">
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
          <Group title="Danger zone">
            <LinkRow href="/social/profile/edit#danger" icon={Trash2} title="Delete my Social profile" hint="Your website account stays" danger />
          </Group>
        ) : null}
      </>
    );
  }

  return (
    <div className="set-layout">
      <nav className="set-nav" aria-label="Settings categories">
        {categories.map((c) => (
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
      </nav>
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
