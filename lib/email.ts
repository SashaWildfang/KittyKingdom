export async function sendVerificationEmail(email: string, verifyUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, reason: "Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Confirm your Kitty Kingdom account",
      html: `<p>Welcome to Kitty Kingdom.</p><p>Confirm your email by clicking this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: await response.text() };
  }

  return { sent: true };
}
