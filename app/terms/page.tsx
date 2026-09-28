import Link from "next/link";
import { LegalShell, type LegalSection } from "../legal/legal-shell";

export const metadata = { title: "Terms of Service | Kitty Kingdom" };

const UPDATED = "September 28, 2026";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    body: (
      <>
        <p>
          These Terms of Service (the &quot;<b>Terms</b>&quot;) are a binding agreement between you and Kitty Kingdom (&quot;<b>Kitty Kingdom</b>&quot;,
          &quot;<b>we</b>&quot;, &quot;<b>us</b>&quot;). They govern your use of the website at kittykingdom.net (the &quot;<b>Site</b>&quot;), the Kitty Kingdom
          Discord server (the &quot;<b>Server</b>&quot;), and the Discord bots we operate (the &quot;<b>Bots</b>&quot;), together the &quot;<b>Services</b>&quot;.
        </p>
        <p>
          By creating an account, linking Discord, joining the Server or otherwise using the Services, you confirm that you have read, understood and agree to
          these Terms, our <Link href="/privacy">Privacy Policy</Link> and the Server rules (together, the &quot;<b>Rules</b>&quot;). If you do not agree, do
          not use the Services.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility",
    body: (
      <>
        <p>
          You must be <b>at least 18 years old</b> and legally able to agree to these Terms to use the Services. By using them you represent that this is true.
          Some areas, including 18+ channels, roles and dating features, require age verification or staff approval, which we may grant, refuse or revoke at
          our discretion.
        </p>
        <p>
          You may not use the Services if you have been banned from them, or if the law where you live prohibits it. You must also follow Discord&apos;s{" "}
          <a href="https://discord.com/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="https://discord.com/guidelines" target="_blank" rel="noopener noreferrer">
            Community Guidelines
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <ul>
          <li>You must give accurate information when you sign up and keep it up to date, including a working email address.</li>
          <li>Creating a Site account requires being a verified member of the Server and linking your Discord account. Each Discord account can be linked to one Site account.</li>
          <li>You are responsible for keeping your password and two-factor codes secure and for everything that happens under your account. Tell staff right away if you think your account has been compromised.</li>
          <li>You may not share, sell, transfer or rent your account, use someone else&apos;s account, or create accounts to get around a ban or restriction.</li>
          <li>Usernames can only be set once and must not impersonate others or be offensive. We may change or remove names that break the Rules.</li>
        </ul>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Community conduct",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>harass, threaten, bully, stalk, dox or discriminate against anyone, or encourage others to;</li>
          <li>post content that is illegal, involves or sexualises minors, is non-consensual, promotes self-harm or violence, or shares someone&apos;s private information or images without their consent;</li>
          <li>post adult content outside the areas where it is allowed, or share it with anyone who has not been verified for those areas;</li>
          <li>spam, raid, advertise without permission, run scams, phish, or distribute malware;</li>
          <li>impersonate staff, other members or anyone else;</li>
          <li>exploit bugs, automate actions (self-bots, macros or scripts), or manipulate the economy, levels, leaderboards or statistics;</li>
          <li>try to access accounts, data or parts of the Services you are not allowed to, probe or attack our systems, or interfere with how they work; or</li>
          <li>break any law, Discord&apos;s terms, or the Server rules.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep ownership of the messages, images, profiles and other content you post (&quot;<b>Your Content</b>&quot;). You are responsible for it and
          confirm you have the rights to post it.
        </p>
        <p>
          You grant Kitty Kingdom a worldwide, non-exclusive, royalty-free licence to host, store, copy, display and process Your Content as needed to run,
          moderate, secure and improve the Services, including keeping it in logs and ticket transcripts as described in our Privacy Policy. This licence
          continues for content we are allowed to keep after you leave, such as moderation records.
        </p>
        <p>
          If you send us feedback or suggestions, we may use them without any obligation to you.
        </p>
      </>
    ),
  },
  {
    id: "moderation",
    title: "Moderation, recording and enforcement",
    body: (
      <>
        <p>
          Staff may review, edit, hide or remove content, and may warn, mute, kick, ban, restrict, reset or remove any account, role, item, Leaves or
          feature access, at any time, with or without notice, if we believe the Rules were broken or to protect the community. Automated systems may also
          take these actions.
        </p>
        <p>
          <b>You understand that the Server is logged and tickets are recorded</b>, including messages that are later edited or deleted, as explained in our
          Privacy Policy, and that staff can review these records. If you believe a decision was a mistake you can appeal through a support ticket. Staff
          decisions after an appeal are final.
        </p>
      </>
    ),
  },
  {
    id: "economy",
    title: "Leaves, the store and virtual items",
    body: (
      <>
        <ul>
          <li>
            Leaves, XP, levels, store items, roles, boosters and other virtual items (&quot;<b>Virtual Items</b>&quot;) are a free, for-fun part of the
            community. <b>They have no real-world monetary value</b>, are not your property, and cannot be sold, exchanged or redeemed for money or anything
            of value outside the Services.
          </li>
          <li>You receive a limited, revocable licence to use Virtual Items within the Services. Gifting items to other members through the store is allowed; trading them for anything outside the Services is not.</li>
          <li>Prices, rewards, drop rates, stock and multipliers can change at any time. We may adjust, correct, reset or remove Virtual Items, for example to fix a bug or undo an exploit.</li>
          <li>Games of chance in the Server use Leaves only and involve no real money. All purchases and game results are final.</li>
          <li>Virtual Items may be lost if your account is banned or deleted, or if you leave the Server, and they will not be refunded or restored.</li>
        </ul>
      </>
    ),
  },
  {
    id: "support",
    title: "Patreon, boosting and supporter perks",
    body: (
      <p>
        Supporting Kitty Kingdom through Patreon or Discord Server Boosts is optional and does not buy an exemption from the Rules. Payments are handled by
        Patreon or Discord under their own terms, and refunds are governed by those terms. Supporter perks (such as roles and XP or Leaf bonuses) are provided
        while your support is active, may change over time, and may be removed if you break the Rules or reverse a payment.
      </p>
    ),
  },
  {
    id: "features",
    title: "Dating and social features",
    body: (
      <>
        <p>
          Dating, matching and statistics features (such as your &quot;server bestie&quot;) are for entertainment. We do not screen members, verify what they
          say about themselves, or guarantee compatibility or behaviour. Use good judgement, be careful about sharing personal information, and report anything
          that makes you uncomfortable. Any interaction with other members, online or offline, is at your own risk.
        </p>
        <p>Dating is only for members 18 or older who hold the 18+ Verified role. When you use it:</p>
        <ul>
          <li>photos and art must be safe for work (no nudity or sexual content), must be of you or art you have the right to share, and must not show anyone else without their permission;</li>
          <li>do not harass, pressure or keep messaging someone who hasn&apos;t replied or has declined your request, and do not use Dating to advertise, scam or collect people&apos;s personal information;</li>
          <li>you may not share another member&apos;s photos or messages outside Dating without their permission.</li>
        </ul>
        <p>
          Staff may remove photos, pause profiles, or restrict or remove access to Dating (and take action in the Server) for breaking these rules or the
          community conduct rules. Automatic filters may block messages that contain banned words or unsafe links.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Our content and trademarks",
    body: (
      <p>
        The Services, including the Site&apos;s design, code, text, graphics, logos, artwork and the Kitty Kingdom name, belong to Kitty Kingdom or its
        licensors and are protected by law. You may not copy, modify, distribute, sell or create derivative works from them, or scrape or reverse engineer the
        Services, without our written permission.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "Third-party services",
    body: (
      <p>
        The Services rely on and link to services we do not control, including Discord, Patreon and other websites. We are not responsible for their
        content, availability or practices, and your use of them is governed by their own terms.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Changes and availability",
    body: (
      <p>
        We may change, pause or discontinue any part of the Services at any time, including features, Virtual Items and the Server itself, without
        liability to you. We do not promise that the Services will be available at all times, error-free or secure.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending your use",
    body: (
      <p>
        You can stop using the Services at any time and can delete your Site account from My Account. We may suspend or end your access at any time for any
        reason, including breaking these Terms. Sections that by their nature should survive (such as Your Content licence for retained records, Virtual
        Items, disclaimers, limitation of liability and indemnity) continue after your access ends.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p className="legal-caps">
        The Services are provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, whether express, implied or statutory,
        including implied warranties of merchantability, fitness for a particular purpose, title and non-infringement. We do not warrant that the Services
        will be uninterrupted, secure or error-free, or that content, statistics or results are accurate. Some jurisdictions do not allow these exclusions,
        so some of them may not apply to you.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p className="legal-caps">
        To the fullest extent permitted by law, Kitty Kingdom and its owner, administrators, staff and volunteers will not be liable for any indirect,
        incidental, special, consequential, exemplary or punitive damages, or for any loss of data, Virtual Items, goodwill or profits, arising from or
        related to the Services or these Terms, even if advised of the possibility. Our total liability for any claim relating to the Services will not
        exceed the greater of the amount you paid us directly in the 12 months before the claim or US $50. Nothing in these Terms limits liability that cannot
        be limited by law.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <p>
        You agree to defend, indemnify and hold harmless Kitty Kingdom and its owner, administrators, staff and volunteers from any claims, damages, losses and
        expenses (including reasonable legal fees) arising from Your Content, your use of the Services, or your breach of these Terms or the law.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "Disputes and governing law",
    body: (
      <p>
        If you have a concern, please contact us first through a support ticket so we can try to resolve it informally. These Terms are governed by the laws
        of the United States and the state in which Kitty Kingdom&apos;s owner resides, without regard to conflict-of-law rules, except where the law of the
        country you live in gives you mandatory consumer protections that cannot be waived.
      </p>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <ul>
        <li>These Terms, the Privacy Policy and the Server rules are the entire agreement between you and us about the Services.</li>
        <li>If any part of these Terms is found unenforceable, the rest stays in effect.</li>
        <li>If we don&apos;t enforce a part of these Terms, that is not a waiver of our right to do so later.</li>
        <li>You may not transfer your rights under these Terms. We may transfer ours, for example if Kitty Kingdom changes ownership.</li>
        <li>Headings are for convenience only.</li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. We will update the &quot;Last updated&quot; date above and give notice on the Site or in the Server for
        significant changes. Continuing to use the Services after changes take effect means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <p>
        Questions about these Terms? Open a support ticket in the Kitty Kingdom Discord server or message an administrator. You can find the team on the{" "}
        <Link href="/staff">Staff page</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      current="terms"
      title="Terms of Service"
      updated={UPDATED}
      parts={[
        { title: "The basics", ids: ["agreement", "eligibility", "accounts"] },
        { title: "Community rules", ids: ["conduct", "content", "moderation"] },
        { title: "Leaves, perks & features", ids: ["economy", "support", "features"] },
        { title: "Legal details", ids: ["ip", "third-party", "availability", "termination", "disclaimers", "liability", "indemnity", "disputes", "general", "changes", "contact"] },
      ]}
      intro={
        <p>
          These are the rules for using the Kitty Kingdom website, Discord server and bots. Please read them. By using Kitty Kingdom you agree to them.
        </p>
      }
      summary={
        <>
          <h2>The short version</h2>
          <ul>
            <li>You must be <b>18 or older</b> and follow the Server rules and Discord&apos;s terms.</li>
            <li>Be kind. Harassment, illegal content, scams and exploiting bugs get you removed.</li>
            <li>The Server is logged and tickets are recorded so staff can keep everyone safe.</li>
            <li>Leaves and store items are just for fun: they have no real-money value and can change.</li>
            <li>Staff can moderate content and accounts, and you can appeal through a ticket.</li>
          </ul>
        </>
      }
      sections={sections}
    />
  );
}
