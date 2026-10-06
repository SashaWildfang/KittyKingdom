import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRealUser } from "../../../lib/auth";
import { OWNER_DISCORD_ID } from "../../../lib/ticket-delete";
import { Md } from "../project-guide/md";
import { RESUME, type Job } from "../resume-data";
import { PrintButton } from "./print-button";
import "./resume.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resume | Sasha Wildfang", robots: { index: false, follow: false } };

function Jobs({ jobs }: { jobs: Job[] }) {
  return (
    <>
      {jobs.map((j) => (
        <article key={j.title + j.org} className="rs-job">
          <header>
            <div>
              <h3>{j.title}</h3>
              <p>
                {j.org} · {j.place}
              </p>
            </div>
            <span>{j.dates}</span>
          </header>
          <ul>
            {j.points.map((p) => (
              <li key={p}>
                <Md text={p} />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </>
  );
}

export default async function ResumePage() {
  const user = await getRealUser().catch(() => null);
  if (!user || String(user.discordId ?? "") !== OWNER_DISCORD_ID) notFound();
  const r = RESUME;
  return (
    <main className="rs-shell">
      <div className="rs-bar">
        <a href="/owner/project-guide">
          <ArrowLeft size={16} aria-hidden="true" /> Project Guide
        </a>
        <PrintButton />
      </div>
      <div className="rs-paper">
        <header className="rs-head">
          <h1>{r.name}</h1>
          <p className="rs-contact">
            <span>
              <MapPin size={14} aria-hidden="true" /> {r.location}
            </span>
            <span>
              <Phone size={14} aria-hidden="true" /> {r.phone}
            </span>
            <span>
              <Mail size={14} aria-hidden="true" /> {r.email}
            </span>
          </p>
        </header>

        <section>
          <h2>Objective</h2>
          <p className="rs-objective">{r.objective}</p>
        </section>

        <section>
          <h2>Education</h2>
          {r.education.map((e) => (
            <article key={e.school} className="rs-job">
              <header>
                <div>
                  <h3>{e.school}</h3>
                  <p>
                    {e.detail} · {e.place}
                  </p>
                </div>
                <span>{e.dates}</span>
              </header>
              <ul>
                {e.points.map((p) => (
                  <li key={p}>
                    <Md text={p} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section>
          <h2>Skills</h2>
          <dl className="rs-skills">
            {r.skills.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Technical Experience</h2>
          <Jobs jobs={r.technical} />
        </section>

        <section>
          <h2>Work Experience</h2>
          <Jobs jobs={r.work} />
        </section>
      </div>
    </main>
  );
}
