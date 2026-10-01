import Link from "next/link";
import { LegalShell, type LegalSection } from "../legal/legal-shell";

export const metadata = { title: "Privacy Policy | Kitty Kingdom" };

const UPDATED = "October 1, 2026";

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Who we are and what this covers",
    body: (
      <>
        <p>
          Kitty Kingdom (&quot;<b>Kitty Kingdom</b>&quot;, &quot;<b>we</b>&quot;, &quot;<b>us</b>&quot; or &quot;<b>our</b>&quot;) is an online community operated by its
          owner and administration team. This Privacy Policy explains what personal information we collect, why we collect it, how it is used,
          stored and shared, how long it is kept, and the choices and rights you have.
        </p>
        <p>It applies to (together, the &quot;<b>Services</b>&quot;):</p>
        <ul>
          <li>the website at kittykingdom.net and its subdomains (the &quot;<b>Site</b>&quot;), including accounts, the Store, leaderboards, news, the staff page and My Account;</li>
          <li>the Kitty Kingdom Discord server (the &quot;<b>Server</b>&quot;); and</li>
          <li>the Discord bots we operate in the Server, including the main bot, the moderation bot, the ticket system and the economy bot (the &quot;<b>Bots</b>&quot;). Dating profiles made with our former dating bot moved to Social on the Site.</li>
        </ul>
        <p>
          Discord itself is operated by Discord Inc. under its own{" "}
          <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          . We do not control what Discord collects. This policy only covers what Kitty Kingdom collects and does with information.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Information you give us on the Site",
    body: (
      <>
        <p>When you create and use a Site account we store:</p>
        <ul>
          <li>
            <b>Account details:</b> your email address, username, optional display name, the date you accepted these policies, when the account was created,
            last logged in and last active, and whether your email is verified.
          </li>
          <li>
            <b>Password:</b> never stored in readable form. We keep a salted one-way hash (scrypt). Staff cannot see your password.
          </li>
          <li>
            <b>Optional contact details:</b> a phone number and social links (Telegram, X/Twitter, YouTube, Steam) if you add them. Your phone number is
            only visible to you and to Site administrators.
          </li>
          <li>
            <b>Two-factor authentication:</b> if you turn it on, the authenticator secret (encrypted with AES-256-GCM), your backup codes (stored only as
            hashes) and when each was used.
          </li>
          <li>
            <b>Security tokens:</b> email verification links (valid 72 hours), password reset links (valid 1 hour) and Discord link codes (valid 10 minutes).
            These are stored as hashes or expire automatically.
          </li>
          <li>
            <b>Purchases and gifts</b> you make in the Store, including any gift message (&quot;love letter&quot;) you write, which is delivered to the
            recipient.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "discord",
    title: "Information from Discord and the Server",
    body: (
      <>
        <p>
          The Site and the Bots work together. When you link your Discord account (with <code>/link</code>) or take part in the Server, we process:
        </p>
        <ul>
          <li>
            <b>Discord profile data:</b> your Discord user ID, username, display name, server nickname, avatar, account creation date, the date you joined the
            Server, your roles and whether you are boosting or in the Server.
          </li>
          <li>
            <b>Join application:</b> the answers you give when applying to join, which can include your age and date of birth. Your age and birthday on My
            Account are read from this application.
          </li>
          <li>
            <b>Verification records:</b> for age-restricted (18+) areas, the fact that you were verified, when and by which staff member. We record the
            result, not copies of identity documents, unless you choose to share images in a verification ticket (see Tickets below).
          </li>
          <li>
            <b>Community and economy data:</b> level, XP, Leaf balance, total messages sent, voice time, server bumps, daily streaks, inventory, purchases,
            gifts, game results (for example slots and Wordle), and Question of the Day answers.
          </li>
          <li>
            <b>Activity statistics (My stats):</b> counts of how many messages you send in each channel and at what hours and days, how many words, emojis,
            images, links and stickers you post, how often you reply to, mention, chat back-and-forth with or react to other members, and how long you spend
            in each voice channel and with whom, and which topics your messages touch. Topics are worked out by a small AI model that runs on our own bot (no outside service): it
            reads each message as it arrives, notes which of our topics it relates to (including 18+ topics) and any topic keywords from a fixed list
            (such as &quot;minecraft&quot; or &quot;pizza&quot;), and then discards the message. <b>We do not store the text of your
            messages for these statistics</b>, only counts. For the topic map&apos;s message viewer the bot also keeps the ids (not the text) of your
            25 newest messages for each topic and topic keyword; when you open the viewer, the website fetches those messages and a few around them
            directly from Discord, only from channels you can currently see, and does not save them. Deleted messages no longer appear. Voice statistics also use the server&apos;s voice-channel logs (joins, leaves, camera and mute
            changes) and the VC reward messages the bot posts (session length, rewards and who was in the call). They power your My stats page
            (including your &quot;server bestie&quot;, friendship map and topic map), which only you can open.
          </li>
          <li>
            <b>Badges:</b> the badges worked out from your statistics, which ones you pin or use as a title, and when you earned or changed tier on each
            (saved when you open My stats). Your pinned badges and title are shown on your profile card and your Social profile; the rest only you can see.
            Deleting your Site account deletes these dates.
          </li>
          <li>
            <b>Social (dating and friends) profiles:</b> if you use Social on the Site (including a profile you made with our former dating bot), the profile you create (which can include sensitive details such as
            gender, sexuality and relationship preferences), any photos or art you upload, your prompts and display choices, and your likes, passes,
            matches, friends and blocks. Photos have location and other hidden metadata removed when you upload them. To match people by meaning, our main
            bot turns the interests, dislikes, bio and location in your profile into numbers (&quot;vectors&quot;) with a small model that runs on our own bot host;
            nothing is sent to an outside AI service. Your age there is worked out from the date of birth on your join application (or account) so it
            stays current; your birthday itself is never shown. If you link a partner, the link only appears on profiles after they confirm it, and either
            of you can remove it. We record who viewed a profile and when, so members can see who viewed theirs; you can browse anonymously in Social
            settings. You control your profile and settings and can edit, pause or delete it at any time on the Social page.
          </li>
          <li>
            <b>Social messages and notifications:</b> private messages you send or receive in Social, message requests, whether a conversation has been read,
            and notifications (the bell on the Site) about likes, matches, messages, friend and partner requests and profile views.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation, tickets and logs",
    body: (
      <>
        <p>To keep the community safe, the following is recorded and can be reviewed by staff:</p>
        <ul>
          <li>
            <b>Moderation records:</b> warnings, mutes, kicks and bans, with the reason, the staff member or automated system that issued them and, where
            relevant, the message that caused them.
          </li>
          <li>
            <b>AutoMod:</b> our bot automatically checks messages, edits and server nicknames for blocked words, scam or phishing links, invites to other
            servers and spam. When it acts, it records what it caught (the rule, the matched word or link, and the start of the message) for 90 days so
            staff can review it and handle appeals. It may remove the message, give a warning or a temporary mute, reset a nickname, or DM you about it;
            it never kicks or bans anyone.
          </li>
          <li>
            <b>Server logs:</b> our staff log channels record events such as edited and deleted messages (including their content), member and role changes,
            and joining, leaving and moving between voice channels. These logs are mirrored to our database so staff can search them on the Site.
          </li>
          <li>
            <b>Live chat mirror:</b> messages sent in the Server (text, attachments and author) are copied to our database so administrators can moderate from
            the Site. These copies are <b>deleted automatically after 72 hours</b>.
          </li>
          <li>
            <b>Support tickets:</b> ticket conversations are recorded. When a ticket is closed, a transcript is created containing every message,
            attachment, image, video, sticker and reaction, the participants&apos; names and avatars, and any messages that were edited, deleted or had
            attachments removed while the ticket was open. The staff copy is stored in a private staff-only channel. The member who opened the ticket can read
            their own copy on the Site (My Account → Transcripts, which needs a Site account with that Discord account linked). That copy has images,
            videos, files and stickers removed, and only they and staff can open it.
          </li>
          <li>
            <b>Punishment appeals:</b> if you appeal a punishment at kittykingdom.net/appeals, you sign in with Discord (we only ask Discord for your user ID,
            username and avatar) so we know the appeal is really from you. We store your appeal message, the punishment it is about, the optional email address
            you give for the decision, and a history of the review (who decided, when, and their reply). Only administrators can see appeals, and they do not
            see your email address; it is only used to email you about that appeal.
          </li>
          <li>
            <b>Audit log:</b> actions administrators take on Site accounts (for example resetting a password or changing roles) are logged with who did it
            and when.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "automatic",
    title: "Information collected automatically",
    body: (
      <>
        <ul>
          <li>
            <b>Sign-in sessions and devices:</b> each time you log in we record a session with your IP address, browser and operating system (from your
            user agent), your approximate city, region and country (from our hosting provider, based on your IP address), and when the session was first and
            last used. This lets us keep you signed in, lets administrators sign out a device, and helps detect suspicious logins. Administrators can see this
            information and may use a third-party IP lookup service when investigating account security.
          </li>
          <li>
            <b>Site statistics:</b> we count page views with our own first-party statistics, with no third-party analytics or advertising trackers. For each
            page view we record the page, time, time spent, referring website, campaign tags, approximate country and region, device type, browser, operating
            system, screen size and whether you were signed in. Visitors are identified only by a random ID stored in your browser, which is hashed before it
            is saved. <b>We do not store IP addresses for statistics.</b> If your browser sends Do Not Track or Global Privacy Control, no statistics are
            recorded for you.
          </li>
          <li>
            <b>Online count:</b> a short-lived record (deleted after 5 minutes) that a browser has the Site open and which page of the Site it is on, used
            for the &quot;on the website&quot; counter. While you are signed in and online, administrators can see which page you have open (for example
            &quot;Browsing the Store&quot;) to help with support and keep the Site running smoothly.
          </li>
          <li>
            <b>Abuse prevention:</b> attempts to log in, sign up, reset passwords and similar actions are counted per IP address and per account for a short
            window to stop brute-force attacks. These records expire automatically.
          </li>
          <li>
            <b>Server logs of our providers:</b> our hosting provider may keep standard technical logs (such as request times and IP addresses) for security and
            reliability, under its own policies.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <>
        <p>We only use cookies and storage that the Site needs to work. We do not use advertising or cross-site tracking cookies.</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Lasts</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>kk_session</code></td><td>Keeps you signed in (signed, HTTP-only, secure)</td><td>Up to 8 hours</td></tr>
              <tr><td><code>kk_2fa</code></td><td>Remembers a login waiting for your two-factor code</td><td>5 minutes</td></tr>
              <tr><td><code>kk_reg</code></td><td>Remembers an unfinished sign-up while you link Discord</td><td>Until sign-up is finished</td></tr>
              <tr><td><code>kk_appeal</code></td><td>Remembers which Discord account you confirmed on the appeals page</td><td>1 hour</td></tr>
              <tr><td><code>kk_tz</code></td><td>Your time zone, so times are shown on your clock</td><td>1 year</td></tr>
              <tr><td>Local storage</td><td>Theme (light/dark), which sections you collapsed, a random statistics ID, and similar display preferences</td><td>Until you clear it</td></tr>
            </tbody>
          </table>
        </div>
        <p>You can delete cookies and site data in your browser at any time. If you do, you will be signed out.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information and our legal bases",
    body: (
      <>
        <p>We use personal information to:</p>
        <ul>
          <li>create, secure and run your account and the Services you ask for (performance of our agreement with you);</li>
          <li>link your Site account to Discord, sync roles, levels, Leaves and purchases, and show your stats (performance of our agreement);</li>
          <li>verify ages for 18+ areas, moderate the community, handle tickets and reports, and investigate rule-breaking, fraud and abuse (our legitimate interest in a safe community, and to protect members);</li>
          <li>keep the Services secure, prevent spam and brute-force attacks, and fix problems (legitimate interests);</li>
          <li>understand how the Site is used so we can improve it, using privacy-friendly statistics (legitimate interests);</li>
          <li>send account emails such as verification, password resets and security notices (performance of our agreement). We do not send marketing emails;</li>
          <li>comply with legal obligations and respond to lawful requests (legal obligation); and</li>
          <li>anything else you have clearly agreed to (consent), which you can withdraw at any time.</li>
        </ul>
        <p>
          Some information, such as sexuality or preferences in dating profiles or 18+ role choices, may be considered sensitive. We only process it because you
          chose to provide it for that feature, and you can remove it at any time.
        </p>
      </>
    ),
  },
  {
    id: "visibility",
    title: "Who can see your information",
    body: (
      <>
        <ul>
          <li>
            <b>Other members</b> can see what Discord and the Server normally show, plus your name, avatar and ranks on leaderboards, and your public staff
            profile if you are on the staff team. Your My stats page is only visible to you.
          </li>
          <li>
            <b>Staff</b> (moderators and helpers) can see moderation records, server logs, join applications and the Staff Panel.
          </li>
          <li>
            <b>Dating</b> profiles and photos are only shown to signed-in members who hold the 18+ Verified role. You can hide your age and last-active time,
            pause your profile, and block anyone. Dating messages are private between the two of you: staff cannot browse them. If you report a message,
            staff see only that message and up to two messages before and after it; if you report a profile or photo, staff see that profile as it was
            when reported. Staff may review uploaded photos to keep Dating safe for work.
          </li>
          <li>
            <b>Administrators</b> can additionally see Site account details (email, phone, birthday, linked Discord, sign-in sessions and devices), ticket
            transcripts, the live chat mirror, inventories and purchase history, and can manage accounts, roles and inventories. To help with support
            and fix problems, an administrator can also view the Site as a member who has linked Discord and verified their email, seeing the
            pages exactly as that member does. This view is read only (nothing can be changed or bought), ends after an hour, and each use is
            recorded in the audit log. Administrator actions are logged.
          </li>
          <li>We do not publish your email, phone number, IP address or date of birth.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Service providers and sharing",
    body: (
      <>
        <p>
          <b>We do not sell your personal information, and we do not share it for targeted advertising.</b> We share it only with providers that help us
          run the Services, under their own security and privacy terms, and only as needed:
        </p>
        <ul>
          <li><b>Vercel</b> — hosts the Site and provides approximate location from IP addresses;</li>
          <li><b>MongoDB</b> — our database host;</li>
          <li><b>Discord</b> — our Server and Bots run on Discord, and the Site reads and updates Discord data through Discord&apos;s API;</li>
          <li><b>Our Bot hosting provider</b> — runs the Bots, which may briefly store files (for example while a ticket transcript is built);</li>
          <li><b>Resend</b> — delivers account emails; and</li>
          <li><b>Patreon</b> — if you support us there, under Patreon&apos;s own terms. We only see which tier you have through your Discord roles.</li>
        </ul>
        <p>
          We may also disclose information if we believe in good faith it is required by law, to respond to a valid legal request, to protect the safety of
          any person, to investigate fraud or abuse, or to enforce our Terms of Service. If Kitty Kingdom is ever transferred to a new owner, information may
          be transferred as part of that, subject to this policy.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep information",
    body: (
      <>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Information</th>
                <th>Kept for</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Site account, contact details, 2FA</td><td>Until you delete your account</td></tr>
              <tr><td>Sign-in sessions and devices</td><td>Until you delete your account (you can ask us to clear old ones)</td></tr>
              <tr><td>Site statistics</td><td>About 13 months, then deleted automatically</td></tr>
              <tr><td>Live chat mirror</td><td>72 hours, then deleted automatically</td></tr>
              <tr><td>Dating profile, photos, likes and matches</td><td>Until you delete your dating profile (deleting it removes your photos, likes and matches)</td></tr>
              <tr><td>Dating messages</td><td>While both members keep the conversation; a message you unsend is removed. Reports keep a copy of what was reported for as long as needed for safety</td></tr>
              <tr><td>Notifications</td><td>60 days, then deleted automatically</td></tr>
              <tr><td>Online count, rate limits, link codes</td><td>Minutes to hours, deleted automatically</td></tr>
              <tr><td>Ticket activity (while a ticket is open)</td><td>Until the ticket is closed and its transcript saved (at most 21 days if it is never closed)</td></tr>
              <tr><td>Ticket transcripts, moderation records, punishment appeals, server logs, join applications, verification records</td><td>As long as needed for community safety and to handle appeals, disputes and repeat rule-breaking</td></tr>
              <tr><td>Levels, Leaves, inventory, purchases, activity statistics</td><td>While you are part of the community, or until you ask us to delete them</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect information",
    body: (
      <>
        <p>
          We use industry-standard safeguards, including encrypted connections (HTTPS with HSTS), salted password hashing, encrypted two-factor secrets, signed
          session cookies that can be revoked, rate limiting, strict browser security headers, role-based access for staff and administrators, and
          sandboxed viewing of ticket transcripts. Secrets such as bot tokens are kept out of our code.
        </p>
        <p>
          No system is completely secure. Please use a strong, unique password and turn on two-factor authentication. If we become aware of a breach that
          affects your personal information, we will notify affected members and authorities where the law requires.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>view and update your account details, contact details and display name on My Account;</li>
          <li>unlink Discord at any time (Discord-only features stop working until you link again);</li>
          <li>delete your Site account from My Account. This deletes your account and sign-in sessions. Staff accounts must first have their staff role removed;</li>
          <li>turn off Site statistics for yourself by enabling Do Not Track or Global Privacy Control in your browser; and</li>
          <li>edit, pause or delete your dating profile, hide your age or activity, unsend your messages, and block members on the Social page.</li>
        </ul>
        <p>
          Depending on where you live (for example under the EU or UK GDPR, or California and other US state privacy laws), you may also have the right to
          access a copy of your personal information, correct it, have it deleted, restrict or object to certain processing, receive it in a portable format,
          and withdraw consent. To make a request, open a support ticket in the Server or contact an administrator. We may need to verify your identity, and we
          will respond within the time the law requires (usually 30 days). Some information, such as moderation records, may be kept where we have a
          legitimate need, for example to prevent banned members from returning, and we will tell you if so. We will not treat you differently for using
          your rights. If you are unhappy with our answer you can complain to your local data protection authority.
        </p>
      </>
    ),
  },
  {
    id: "age",
    title: "Age requirements",
    body: (
      <p>
        The Services are only for people <b>18 years of age or older</b>. We do not knowingly collect information from anyone under 18. If we learn that
        someone under 18 has an account or has joined the Server, we will remove their access and delete their information, except for any record we need
        to keep them from rejoining. If you believe someone under 18 is using the Services, please tell a staff member.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our providers store and process information in the United States and other countries whose data protection laws may differ from yours. Where the law
        requires, we rely on appropriate safeguards (such as our providers&apos; standard contractual clauses) for these transfers. By using the Services, you
        understand that your information will be transferred to and processed in these countries.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the Services change. We will change the &quot;Last updated&quot; date above, and for significant changes we will give
        notice on the Site or in the Server. Continuing to use the Services after a change takes effect means you accept the updated policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions, requests or concerns about privacy? Open a support ticket in the Kitty Kingdom Discord server or message an administrator. You can find
        the team on the <Link href="/staff">Staff page</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      current="privacy"
      title="Privacy Policy"
      updated={UPDATED}
      parts={[
        { title: "What we collect", ids: ["scope", "account", "discord", "moderation", "automatic", "cookies"] },
        { title: "How it's used & shared", ids: ["use", "visibility", "sharing", "retention", "security"] },
        { title: "Your rights", ids: ["rights", "age", "transfers", "changes", "contact"] },
      ]}
      intro={
        <p>
          We believe you should know exactly what we keep about you. This policy lists everything the Kitty Kingdom website, Discord server and bots store,
          why, who can see it, and how long it is kept.
        </p>
      }
      summary={
        <>
          <h2>The short version</h2>
          <ul>
            <li><b>We never sell your data</b> and there are no ads or third-party trackers.</li>
            <li>Passwords are hashed, two-factor secrets are encrypted, and staff can&apos;t see your password.</li>
            <li>Your stats count your activity (channels, hours, who you chat with) but never store your message text.</li>
            <li>Staff can review moderation records, logs and ticket transcripts to keep the community safe.</li>
            <li>Administrators can see account details such as your email and your sign-in devices and IP addresses, for security.</li>
            <li>You can delete your account from My Account, and ask us for a copy of your data or to delete more.</li>
          </ul>
        </>
      }
      sections={sections}
    />
  );
}
