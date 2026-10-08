import { Heart } from "lucide-react";
import type { CSSProperties } from "react";
import type { PatronGroup } from "../lib/patrons";
import { TIERS } from "../lib/perks";
import { TierIcon } from "./tier-icon";

/** Homepage thank-you to everyone supporting Kitty Kingdom on Patreon. */
export function HomePatrons({ groups }: { groups: PatronGroup[] }) {
  const total = groups.reduce((n, g) => n + g.patrons.length, 0);
  return (
    <section className="home-section hc" aria-label="Thank you to our Patreon supporters" data-reveal>
      <div className="hc-card">
        <div className="hc-head">
          <span className="hc-eyebrow">
            <Heart size={14} aria-hidden="true" /> Thank you
          </span>
          <h2>The Royal Court</h2>
          <p>
            {total
              ? `Kitty Kingdom stays free for everyone thanks to these ${total} wonderful supporter${total === 1 ? "" : "s"}. Thank you for keeping the kingdom cozy.`
              : "Kitty Kingdom stays free for everyone thanks to our supporters. The court is waiting for its first royals."}
          </p>
        </div>

        {total ? (
          <div className="hc-groups">
            {groups
              .filter((g) => g.patrons.length)
              .map((g) => {
                const tier = TIERS.find((t) => t.key === g.tier)!;
                return (
                  <div key={g.tier} className={`hc-group is-${g.tier}`} style={{ "--tier": tier.color } as CSSProperties}>
                    <h3>
                      <TierIcon tier={g.tier} size={18} /> {g.name}
                      <small>{g.patrons.length}</small>
                    </h3>
                    <ul>
                      {g.patrons.map((p) => (
                        <li key={p.discordId}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.avatar} alt="" loading="lazy" />
                          <span>
                            <b>{p.name}</b>
                            <small>{p.title}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="hc-empty">
            {TIERS.slice()
              .reverse()
              .map((t) => (
                <span key={t.key} style={{ "--tier": t.color } as CSSProperties}>
                  <TierIcon tier={t.key} size={16} /> {t.name}
                </span>
              ))}
          </div>
        )}

        <a className="hc-cta" href="/patreon">
          <TierIcon tier="monarch" size={17} /> Join the Royal Court
        </a>
      </div>
    </section>
  );
}
