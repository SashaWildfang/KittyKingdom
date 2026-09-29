import { ArrowLeft, FileText, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth";
import { getDiscordInviteSummary } from "../../../../lib/discord";
import { memberTranscript, memberTranscriptToken, ticketTypeLabel } from "../../../../lib/member-transcripts";
import { SiteNav } from "../../../site-nav";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A member's own ticket transcript (media redacted), opened from My Account or the bot's DM. */
export default async function MemberTranscriptPage({ params }: { params: { ticketId: string } }) {
  const ticketId = Number(params.ticketId);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?account=transcript-login&next=${encodeURIComponent(`/account/transcripts/${Number.isInteger(ticketId) ? ticketId : ""}`)}`);
  const [discord, ticket] = await Promise.all([
    getDiscordInviteSummary(),
    user.discordId && Number.isInteger(ticketId) ? memberTranscript(String(user.discordId), ticketId).catch(() => null) : Promise.resolve(null),
  ]);

  const problem = !user.discordId
    ? {
        title: "Link your Discord first",
        text: "Transcripts belong to the Discord account that opened the ticket. Link your Discord on My Account, then open this again.",
        href: "/account#discord-account",
        cta: "Link Discord",
      }
    : !ticket
      ? {
          title: "We couldn't find that transcript",
          text: "Only transcripts of tickets opened by the Discord account linked to your website account show up here. If the ticket was just closed, give it a minute.",
          href: "/account#transcripts",
          cta: "See my transcripts",
        }
      : null;

  return (
    <main className="site-shell tx-page">
      <SiteNav signedIn discordOnline={discord.online} />
      <header className="tx-head">
        <a className="tx-back" href="/account#transcripts">
          <ArrowLeft size={16} aria-hidden="true" /> My transcripts
        </a>
        <div className="tx-title">
          <span className="tx-icon" aria-hidden="true">
            <FileText size={20} />
          </span>
          <div>
            <h1>{ticket ? `Ticket #${ticket.ticketId}` : "Ticket transcript"}</h1>
            {ticket ? (
              <p>
                {ticketTypeLabel(ticket.type)}
                {ticket.created ? ` · Opened ${dateFmt.format(new Date(ticket.created))}` : ""}
                {ticket.resolvedAt ? ` · Closed ${dateFmt.format(new Date(ticket.resolvedAt))}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        {ticket ? (
          <p className="tx-privacy">
            <Lock size={14} aria-hidden="true" /> Images, videos, files and stickers are removed from your copy for privacy.
          </p>
        ) : null}
      </header>

      {problem ? (
        <section className="tx-empty">
          <h2>{problem.title}</h2>
          <p>{problem.text}</p>
          <a className="primary-pill" href={problem.href}>
            {problem.cta}
          </a>
        </section>
      ) : ticket?.transcriptId ? (
        <div className="tx-frame">
          <iframe
            title={`Ticket ${ticket.ticketId} transcript`}
            src={`/api/transcripts/${ticket.transcriptId}/${memberTranscriptToken(ticket.transcriptId)}/index.html`}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
    </main>
  );
}
