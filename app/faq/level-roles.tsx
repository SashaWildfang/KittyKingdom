"use client";

// The FAQ's level role list: the role names change with the season (Admin → Overview → Seasons).

import { useSeason } from "../season-context";

const PERKS: Record<number, string> = {
  0: "Welcome to the kingdom!",
  1: "Unlocks Media Perms (pictures, GIFs & reactions)",
};

export function SeasonLevelRoles() {
  const { levels } = useSeason();
  return (
    <div className="kb-roles">
      {levels.map((r, i) => (
        <div key={r.range} className="kb-role">
          <span className="kb-role-emoji" aria-hidden="true">
            {r.emoji}
          </span>
          <div>
            <b style={{ color: r.color }}>{r.name}</b>
            <small>Levels {r.range.replace("-", "–")}</small>
            {PERKS[i] ? <em>{PERKS[i]}</em> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
