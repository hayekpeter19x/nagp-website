// Sending email, through Resend (resend.com). It is called with fetch, so no extra package is needed.
// Two settings in Cloudflare (Pages project → Settings → Variables and Secrets) switch it on:
//   RESEND_API_KEY  the API key from Resend (add it as a secret)
//   EMAIL_FROM      who the emails come from, for example "NAGP <no-reply@usgestalt.org>".
//                   Its domain must be verified in Resend.
// Optional: SITE_URL (for example https://usgestalt.org) for the links in emails; otherwise the
// address the visitor is using.
export const emailConfigured = (env) => !!(env.RESEND_API_KEY && env.EMAIL_FROM);

export async function sendEmail(env, { to, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`The email could not be sent (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export const siteUrl = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
