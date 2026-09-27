// Account emails, sent through Resend. One shared, email-client-safe layout (tables and inline
// styles only, light "official" look that doesn't get inverted by dark-mode mail apps), with a
// plain-text version alongside every HTML email.

const SITE = "https://www.kittykingdom.net";
const LOGO = `${SITE}/logo.png`;
const ACCENT = "#e0701e";
const INK = "#231a14";
const MUTED = "#6b5e53";
const LINE = "#eadfd4";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Step = { label: string; state: "done" | "current" | "todo" };
type Row = { label: string; value: string };

/** The shared email frame: header, title, body blocks, one call-to-action, fallback link, footer. */
function layout(o: {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps?: Step[];
  rows?: Row[];
  button: { label: string; url: string };
  expiry: string;
  security: string;
  reason: string;
}) {
  const steps = o.steps
    ? `<tr><td style="padding:0 40px 8px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          ${o.steps
            .map((s, i) => {
              const bg = s.state === "done" ? "#2f9e5b" : s.state === "current" ? ACCENT : "#d9cfc6";
              const mark = s.state === "done" ? "&#10003;" : String(i + 1);
              const color = s.state === "todo" ? MUTED : INK;
              return `<td align="center" valign="top" style="width:${Math.floor(100 / o.steps!.length)}%;padding:0 4px;">
                <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${bg};color:#ffffff;font-size:13px;font-weight:700;margin:0 auto 6px;">${mark}</div>
                <div style="font-size:12px;line-height:16px;color:${color};font-weight:${s.state === "current" ? 700 : 600};">${escapeHtml(s.label)}</div>
              </td>`;
            })
            .join("")}
        </tr></table>
      </td></tr>`
    : "";

  const rows = o.rows?.length
    ? `<tr><td class="px" style="padding:16px 40px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${LINE};border-radius:10px;background:#fbf8f5;">
          ${o.rows
            .map(
              (r, i) => `<tr>
                <td style="padding:12px 16px;font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${LINE};` : ""}width:38%;">${escapeHtml(r.label)}</td>
                <td style="padding:12px 16px;font-size:14px;color:${INK};font-weight:600;${i ? `border-top:1px solid ${LINE};` : ""}word-break:break-word;">${escapeHtml(r.value)}</td>
              </tr>`,
            )
            .join("")}
        </table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(o.title)}</title>
<style>
  @media (max-width: 480px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3ede7;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(o.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3ede7;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 16px;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td style="padding-right:10px;"><img src="${LOGO}" alt="" width="40" height="40" style="display:block;border-radius:10px;" /></td>
                <td style="font-size:16px;font-weight:800;letter-spacing:0.02em;color:${INK};">Kitty Kingdom</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="height:5px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td class="px" style="padding:32px 40px 8px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">${escapeHtml(o.eyebrow)}</p>
                    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${INK};font-weight:800;">${escapeHtml(o.title)}</h1>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${o.intro}</p>
                  </td>
                </tr>
                ${steps}
                ${rows}
                <tr>
                  <td class="px" align="center" style="padding:28px 40px 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                      <td style="border-radius:8px;background:${ACCENT};">
                        <a href="${o.button.url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(o.button.label)}</a>
                      </td>
                    </tr></table>
                    <p style="margin:12px 0 0;font-size:12px;color:${MUTED};">${escapeHtml(o.expiry)}</p>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:24px 40px 8px;">
                    <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Button not working? Copy and paste this link into your browser:</p>
                    <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${o.button.url}" style="color:${ACCENT};">${o.button.url}</a></p>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:20px 40px 32px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${LINE};"><tr>
                      <td style="padding-top:16px;font-size:13px;line-height:1.6;color:${MUTED};">
                        <strong style="color:${INK};">Security note:</strong> ${o.security}
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:${MUTED};">
              <p style="margin:0 0 6px;">${escapeHtml(o.reason)}</p>
              <p style="margin:0 0 6px;">
                <a href="${SITE}" style="color:${MUTED};">kittykingdom.net</a> &nbsp;·&nbsp;
                <a href="${SITE}/support" style="color:${MUTED};">Support</a> &nbsp;·&nbsp;
                <a href="${SITE}/privacy" style="color:${MUTED};">Privacy</a> &nbsp;·&nbsp;
                <a href="${SITE}/terms" style="color:${MUTED};">Terms</a>
              </p>
              <p style="margin:0;">© ${new Date().getFullYear()} Kitty Kingdom. This is an automated message; replies aren't monitored.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Sends any email through Resend. */
async function sendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, reason: "Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return response.ok ? { sent: true } : { sent: false, reason: await response.text() };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Email request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

const stamp = () => new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Denver" }) + " MT";

/** Step 3 of signing up (after /link): confirm the email address. Also used for "resend". */
export function verificationEmail(email: string, verifyUrl: string, details: { discordName?: string | null; newAccount?: boolean } = {}) {
  const discord = details.discordName ? String(details.discordName) : null;
  const html = layout({
    preheader: "One last step: confirm your email to finish your Kitty Kingdom account.",
    eyebrow: "Account verification",
    title: "Confirm your email address",
    intro: discord
      ? `Your Discord account <strong style="color:${INK};">${escapeHtml(discord)}</strong> is linked. Confirm this email address to finish setting up your Kitty Kingdom account, then you can log in.`
      : "Confirm this email address to finish setting up your Kitty Kingdom account, then you can log in.",
    steps: [
      { label: "Account details", state: "done" },
      { label: "Discord linked", state: "done" },
      { label: "Confirm email", state: "current" },
    ],
    rows: [
      { label: "Email", value: email },
      ...(discord ? [{ label: "Discord", value: discord }] : []),
      { label: "Requested", value: stamp() },
    ],
    button: { label: "Confirm email address", url: verifyUrl },
    expiry: "This link expires in 72 hours.",
    security: "Kitty Kingdom staff will never ask for your password or this link. If you didn't create this account, you can safely ignore this email and nothing will happen.",
    reason: "You're receiving this because this address was used to create an account on kittykingdom.net.",
  });
  const text = [
    "Kitty Kingdom: confirm your email address",
    "",
    ...(discord ? [`Your Discord account ${discord} is linked.`] : []),
    "Confirm this email address to finish setting up your Kitty Kingdom account, then you can log in.",
    "",
    `Confirm your email: ${verifyUrl}`,
    "This link expires in 72 hours.",
    "",
    "Kitty Kingdom staff will never ask for your password or this link. If you didn't create this account, you can ignore this email.",
    "",
    `${SITE} · Support: ${SITE}/support`,
  ].join("\n");
  return { subject: "Confirm your email for Kitty Kingdom", html, text };
}

export async function sendVerificationEmail(email: string, verifyUrl: string, details: { discordName?: string | null; newAccount?: boolean } = {}) {
  const m = verificationEmail(email, verifyUrl, details);
  return sendEmail(email, m.subject, m.html, m.text);
}

export function passwordResetEmail(email: string, resetUrl: string, requestedByStaff: boolean) {
  const intro = requestedByStaff
    ? "A Kitty Kingdom staff member sent you this link so you can reset your website password."
    : "We received a request to reset the password for your Kitty Kingdom website account.";
  const html = layout({
    preheader: "Use this link to choose a new Kitty Kingdom password. It works once and expires in 1 hour.",
    eyebrow: "Password reset",
    title: "Reset your password",
    intro,
    rows: [
      { label: "Account", value: email },
      { label: "Requested", value: stamp() },
      { label: "Requested by", value: requestedByStaff ? "Kitty Kingdom staff" : "You (on the website)" },
    ],
    button: { label: "Choose a new password", url: resetUrl },
    expiry: "This link works once and expires in 1 hour.",
    security: "Setting a new password signs you out of the website on every other device. If you didn't ask for this, ignore this email and your password won't change.",
    reason: "You're receiving this because a password reset was requested for this address on kittykingdom.net.",
  });
  const text = [
    "Kitty Kingdom: reset your password",
    "",
    intro,
    "",
    `Choose a new password: ${resetUrl}`,
    "This link works once and expires in 1 hour.",
    "",
    "If you didn't ask for this, ignore this email and your password won't change.",
    "",
    `${SITE} · Support: ${SITE}/support`,
  ].join("\n");
  return { subject: "Reset your Kitty Kingdom password", html, text };
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, requestedByStaff: boolean) {
  const m = passwordResetEmail(email, resetUrl, requestedByStaff);
  return sendEmail(email, m.subject, m.html, m.text);
}

/** "Something changed on your account" notice, e.g. two-factor turned on or off. */
export function securityNoticeEmail(email: string, title: string, message: string) {
  const html = layout({
    preheader: message,
    eyebrow: "Security alert",
    title,
    intro: escapeHtml(message),
    rows: [
      { label: "Account", value: email },
      { label: "When", value: stamp() },
    ],
    button: { label: "Review account security", url: `${SITE}/account#security` },
    expiry: "Only you can see this page after logging in.",
    security: "If you didn't make this change, change your password right away and contact Kitty Kingdom staff on Discord.",
    reason: "You're receiving this because a security setting changed on your kittykingdom.net account.",
  });
  const text = [`Kitty Kingdom: ${title}`, "", message, "", `Review your account security: ${SITE}/account#security`, "", "If you didn't make this change, change your password right away and contact staff."].join("\n");
  return { subject: `Security alert: ${title}`, html, text };
}

export async function sendSecurityNoticeEmail(email: string, title: string, message: string) {
  const m = securityNoticeEmail(email, title, message);
  return sendEmail(email, m.subject, m.html, m.text);
}
