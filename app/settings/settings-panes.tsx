"use client";

import {
  AtSign,
  Bell,
  BellOff,
  Gavel,
  HeartHandshake,
  KeyRound,
  LogOut,
  Monitor,
  Tablet,
  Mail,
  MailCheck,
  MailWarning,
  PenLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { askConfirm } from "../confirm-dialog";
import { EMAIL_PREF_GROUPS, type EmailPrefKey, type EmailPrefs } from "../../lib/email-prefs-shared";
import { useDevicePrefs, type Motion, type TextSize } from "../device-prefs";
import { ThemeSwitch } from "../theme-switch";
import { ChoiceRow, Group, LinkRow, LockedRow, Pill, Row, Segmented, ToggleRow, slug } from "./settings-ui";

export type AccountSummary = {
  name: string;
  email: string;
  verified: boolean;
  discordLinked: boolean;
  discordName: string | null;
  twoFactor: boolean;
  avatar: string | null;
};

export type OnStatus = (saving: boolean, saved: string | null) => void;

export function AccountPane({ account, social }: { account: AccountSummary; social: boolean }) {
  return (
    <>
      <section className="set-group set-me">
        <span className="set-me-avatar" aria-hidden="true">
          {account.avatar ? <img src={account.avatar} alt="" width={56} height={56} /> : <UserRound size={26} />}
        </span>
        <div className="set-me-text">
          <b>{account.name}</b>
          <span>
            {account.email} {account.verified ? <Pill tone="good">Verified</Pill> : <Pill tone="warn">Not verified</Pill>}
          </span>
          <span>{account.discordLinked ? <>Discord: {account.discordName ?? "linked"}</> : "Discord not linked"}</span>
        </div>
        <a className="set-me-link" href="/account">
          My Account
        </a>
      </section>
      <Group title="Profile">
        <LinkRow href="/account#profile" icon={PenLine} title="Name, username & phone" hint="How you appear around the site, and your private phone number" />
        <LinkRow href="/account#profile" icon={AtSign} title="Email address" hint={account.verified ? "Change the address your account uses" : "Confirm your email so you can get notification emails"} badge={account.verified ? null : <Pill tone="warn">Confirm</Pill>} />
        <LinkRow
          href="/account#discord-account"
          icon={ShieldCheck}
          title="Discord link"
          hint="Link or unlink your Discord account"
          badge={account.discordLinked ? <Pill tone="good">Linked</Pill> : <Pill tone="warn">Not linked</Pill>}
        />
        <LinkRow href="/account#punishments" icon={Gavel} title="Punishments & appeals" hint="Your moderation record, when it ends, and appeals" />
      </Group>
      {!social ? (
        <Group title="Social">
          <p className="set-note">
            <HeartHandshake size={16} aria-hidden="true" /> Privacy, message and Discover settings for Social show up here once you have the 18+ Verified role and your Discord is linked.
          </p>
        </Group>
      ) : null}
      <Group title="Danger zone" tone="danger">
        <LinkRow href="/account#delete-account" icon={TriangleAlert} title="Delete account" hint="Permanently remove your website account" danger />
      </Group>
    </>
  );
}

export function SecurityPane({ account }: { account: AccountSummary }) {
  return (
    <>
      <Group title="Signing in">
        <LinkRow
          href="/account#security"
          icon={ShieldCheck}
          title="Two-factor authentication"
          hint={account.twoFactor ? "A code from your authenticator app is needed to sign in." : "Add a code from an authenticator app when you sign in. Strongly recommended."}
          badge={account.twoFactor ? <Pill tone="good">On</Pill> : <Pill tone="warn">Off</Pill>}
        />
        <LinkRow href="/account#security" icon={KeyRound} title="Password" hint="Change your password" />
      </Group>
      <DevicesSetting />
      <Group title="Alerts">
        <LockedRow title="Security alert emails" hint="We always email you when your password, email or two-factor changes, so you'd know if it wasn't you." />
      </Group>
    </>
  );
}

type Device = { id: string; current: boolean; device: { browser: string; os: string; type: "mobile" | "tablet" | "desktop" }; place: string | null; lastSeenAt: string; createdAt: string };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 3) return "Active now";
  if (m < 60) return `Active ${m} min ago`;
  if (m < 1440) return `Active ${Math.round(m / 60)}h ago`;
  return `Active ${Math.round(m / 1440)}d ago`;
};

/** Where this account is signed in, with sign-out for other devices. */
function DevicesSetting() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch("/api/account/sessions", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => (b?.ok ? setDevices(b.sessions) : setError(b?.error ?? "Couldn't load your devices.")))
      .catch(() => setError("Couldn't load your devices."));
  }, []);
  useEffect(load, [load]);
  const end = async (q: string, key: string) => {
    setBusy(key);
    const res = await fetch(`/api/account/sessions?${q}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!res?.ok) setError(res?.error ?? "That didn't work. Try again.");
    load();
  };
  const others = devices?.filter((d) => !d.current) ?? [];
  return (
    <Group title="Devices & sessions" intro="Where you're signed in right now. Don't recognise one? Sign it out and change your password.">
      <div id={slug("Devices & sessions")}>
        {error ? <p className="set-error">{error}</p> : null}
        {!devices && !error ? <div className="set-loading" aria-busy="true" /> : null}
        {devices?.length === 0 ? <p className="set-note">No other sign-ins found.</p> : null}
        {devices?.map((d) => {
          const Icon = d.device.type === "mobile" ? Smartphone : d.device.type === "tablet" ? Tablet : Monitor;
          return (
            <div key={d.id} className="set-device">
              <span className="set-link-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="set-row-text">
                <b>
                  {d.device.browser} on {d.device.os} {d.current ? <Pill tone="good">This device</Pill> : null}
                </b>
                <small>
                  {d.current ? "Active now" : ago(d.lastSeenAt)}
                  {d.place ? ` · ${d.place}` : ""} · signed in {new Date(d.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </small>
              </span>
              {d.current ? null : (
                <button type="button" className="set-btn is-small" disabled={busy === d.id} onClick={() => void end(`id=${encodeURIComponent(d.id)}`, d.id)}>
                  {busy === d.id ? "Signing out…" : "Sign out"}
                </button>
              )}
            </div>
          );
        })}
        {others.length > 1 ? (
          <div className="set-actions">
            <button
              type="button"
              className="set-btn"
              disabled={busy === "all"}
              onClick={async () => {
                if (await askConfirm(`Sign out of ${others.length} other devices? You'll stay signed in here.`, { confirmLabel: "Sign them out" })) void end("others=1", "all");
              }}
            >
              <LogOut size={15} aria-hidden="true" /> Sign out all other devices
            </button>
          </div>
        ) : null}
      </div>
    </Group>
  );
}

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xl", label: "Larger" },
];
const MOTION: { value: Motion; label: string }[] = [
  { value: "system", label: "Device" },
  { value: "reduce", label: "Less" },
  { value: "full", label: "Full" },
];

export function AppearancePane() {
  const [device, setDevice] = useDevicePrefs();
  return (
    <>
      <Group title="Look">
        <Row title="Theme" hint="Light, dark, or match your device.">
          <ThemeSwitch />
        </Row>
        <Row title="Text size" hint="Makes the whole site's text bigger or smaller.">
          <Segmented label="Text size" value={device.text} options={TEXT_SIZES} onChange={(text) => setDevice({ text })} />
        </Row>
      </Group>
      <Group title="Motion & effects">
        <Row title="Animations" hint="“Device” follows your system's reduce-motion setting. “Less” stops animations and transitions on the site.">
          <Segmented label="Animations" value={device.motion} options={MOTION} onChange={(motion) => setDevice({ motion })} />
        </Row>
        <ToggleRow title="Seasonal effects" hint="The season's drifting leaves, snow or petals behind pages, and the little bursts when you click." checked={device.effects} onChange={(effects) => setDevice({ effects })} />
      </Group>
      <p className="set-note">
        <Smartphone size={15} aria-hidden="true" /> Appearance settings are saved in this browser, so each of your devices can look different.
      </p>
    </>
  );
}

/** Settings → Email: notification emails (all off until turned on) and the ones that always send. */
export function EmailPane({ social, onStatus }: { social: boolean; onStatus: OnStatus }) {
  const [data, setData] = useState<{ prefs: EmailPrefs; email: string; verified: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/account/email-prefs", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => (b?.ok ? setData(b) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <p className="set-error">Couldn&apos;t load your email settings. Refresh the page to try again.</p>;
  if (!data) return <div className="set-loading" aria-busy="true" />;

  const groups = EMAIL_PREF_GROUPS.filter((g) => social || !g.social);
  const keys = groups.flatMap((g) => g.items.map((i) => i.key));
  const anyOn = keys.some((k) => data.prefs[k]);
  const save = async (patch: Partial<Record<EmailPrefKey, boolean>>) => {
    const prev = data.prefs;
    setData({ ...data, prefs: { ...data.prefs, ...patch } });
    onStatus(true, null);
    const res = await fetch("/api/account/email-prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      .then((r) => r.json())
      .catch(() => null);
    if (res?.ok) setData((d) => (d ? { ...d, prefs: res.prefs } : d));
    else setData((d) => (d ? { ...d, prefs: prev } : d));
    onStatus(false, res?.ok ? "Saved" : res?.error ?? "Couldn't save. Try again.");
  };

  return (
    <>
      <section className={`set-group set-email-to${data.verified ? "" : " is-warn"}`}>
        <span className="set-email-icon" aria-hidden="true">
          {data.verified ? <MailCheck size={20} /> : <MailWarning size={20} />}
        </span>
        <div className="set-row-text">
          <b>{data.email}</b>
          <small>
            {data.verified
              ? "Notification emails go here. Change it on My Account."
              : "Confirm this address first: notification emails only go to confirmed addresses. Check your inbox for the link, or send a new one from My Account."}
          </small>
        </div>
        <a className="set-me-link" href="/account#profile">
          {data.verified ? "Change" : "Confirm"}
        </a>
      </section>
      {groups.map((g) => (
        <Group key={g.title} title={g.title}>
          {g.items.map((i) => (
            <ToggleRow key={i.key} title={i.label} hint={i.hint} checked={data.prefs[i.key]} onChange={(v) => void save({ [i.key]: v })} />
          ))}
        </Group>
      ))}
      <Group title="Always sent" intro="These are about your account, so they can't be turned off.">
        <LockedRow title="Security alerts" hint="Password, email and two-factor changes." />
        <LockedRow title="Password reset links" hint="Only when you (or staff, at your request) ask for one." />
        <LockedRow title="Appeals & account updates" hint="Replies to your appeals, and changes staff make to your account." />
      </Group>
      <div className="set-actions" id={slug("Turn off all notification emails")}>
        <button type="button" className="set-btn" disabled={!anyOn} onClick={() => void save(Object.fromEntries(keys.map((k) => [k, false])))}>
          <BellOff size={15} aria-hidden="true" /> Turn off all notification emails
        </button>
        <span className="set-actions-note">
          <Mail size={14} aria-hidden="true" /> Every email also has a one-click unsubscribe link.
        </span>
      </div>
    </>
  );
}

type LevelUps = "on" | "quiet" | "off";

/** Discord level-up messages: with a ping, without, or none at all (needs Discord linked). */
export function LevelUpSetting({ onStatus }: { onStatus: OnStatus }) {
  const [mode, setMode] = useState<LevelUps | null>(null);
  const [unlinked, setUnlinked] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/account/levelups", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (r.status === 403) setUnlinked(true);
        else if (body?.ok) setMode(body.mode);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <p className="set-error">Couldn&apos;t load your level-up setting. Refresh the page to try again.</p>;
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
        ["off", "Off", "No level-up messages. You still keep your level and perks."],
      ]}
    />
  );
}
