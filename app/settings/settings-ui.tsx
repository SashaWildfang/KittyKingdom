"use client";

import { ChevronRight, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Building blocks for Settings. Every row gets an id from its title so the search can jump to it.

export const slug = (title: string) =>
  `set-${title
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

export function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`set-switch${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
      <i aria-hidden="true" />
    </button>
  );
}

/** One setting: what it is on the left, the control on the right. */
export function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row" id={slug(title)}>
      <div className="set-row-text">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

export function ToggleRow({ title, hint, checked, disabled, onChange }: { title: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row title={title} hint={hint}>
      <Switch checked={checked} disabled={disabled} onChange={onChange} label={title} />
    </Row>
  );
}

/** Always on (security emails and the like): shown so members know, but can't be turned off. */
export function LockedRow({ title, hint }: { title: string; hint?: string }) {
  return (
    <Row title={title} hint={hint}>
      <span className="set-locked">
        <Lock size={13} aria-hidden="true" /> Always on
      </span>
    </Row>
  );
}

/** A question with a few answers, as selectable cards. */
export function ChoiceRow<T extends string>({ title, value, options, onChange }: { title: string; value: T; options: [T, string, string][]; onChange: (v: T) => void }) {
  return (
    <div className="set-choice" id={slug(title)}>
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

/** A short pick-one control (like the theme switch) for a row's right side. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void }) {
  return (
    <div className="theme-seg set-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "is-on" : undefined} onClick={() => onChange(o.value)}>
          {o.icon ? <o.icon size={14} aria-hidden="true" /> : null}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Group({ title, intro, children, tone }: { title?: string; intro?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <section className={`set-group${tone === "danger" ? " is-danger" : ""}`}>
      {title ? <h3>{title}</h3> : null}
      {intro ? <p className="set-intro">{intro}</p> : null}
      <div className="set-rows">{children}</div>
    </section>
  );
}

export function LinkRow({ href, icon: Icon, title, hint, danger, badge }: { href: string; icon: LucideIcon; title: string; hint?: string; danger?: boolean; badge?: ReactNode }) {
  return (
    <a className={`set-link${danger ? " is-danger" : ""}`} href={href} id={slug(title)}>
      <span className="set-link-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="set-row-text">
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
      {badge}
      <ChevronRight size={16} aria-hidden="true" className="set-link-chev" />
    </a>
  );
}

/** A small coloured status label (On / Off / Verified…). */
export function Pill({ tone, children }: { tone: "good" | "warn" | "muted"; children: ReactNode }) {
  return <span className={`set-pill is-${tone}`}>{children}</span>;
}
