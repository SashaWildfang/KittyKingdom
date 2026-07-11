export async function sendVerificationEmail(email: string, verifyUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      sent: false,
      reason:
        "Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const html = `
  <div style="margin:0;padding:0;background:#160a06;color:#fff2d7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(145deg,#160a06,#3a1d12);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:rgba(14,15,16,.94);border:1px solid rgba(255,242,215,.16);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px;text-align:center;">
                <img src="https://kittykingdom.net/logo.png" alt="Kitty Kingdom" width="84" height="84" style="border-radius:20px;border:3px solid rgba(255,242,215,.8);object-fit:cover;" />
                <h1 style="margin:20px 0 8px;font-size:32px;line-height:1;color:#fff2d7;">Confirm your Kitty Kingdom account</h1>
                <p style="margin:0;color:rgba(255,242,215,.78);font-size:16px;line-height:1.6;">Welcome to Kitty Kingdom, a furry Discord community for 18+ members.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;color:rgba(255,242,215,.82);font-size:16px;line-height:1.7;">
                <p>Thanks for creating an account. Please confirm this email address before logging in. After verification, you can visit My Account to set your username, link Discord, and manage your profile.</p>
                <p style="text-align:center;margin:30px 0;">
                  <a href="${verifyUrl}" style="display:inline-block;background:#f59b2a;color:#1d0b05;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:999px;box-shadow:0 14px 32px rgba(245,155,42,.28);">Confirm email</a>
                </p>
                <p>If the button does not work, copy and paste this link into your browser:</p>
                <p style="word-break:break-all;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;">${verifyUrl}</p>
                <p style="font-size:13px;color:rgba(255,242,215,.58);">If you did not create a Kitty Kingdom account, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Confirm your Kitty Kingdom account",
        html,
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: await response.text() };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Email request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
