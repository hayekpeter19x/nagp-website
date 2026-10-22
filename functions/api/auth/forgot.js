// POST /api/auth/forgot  { email }
// "Forgot your password?": emails a link to choose a new password (it works once, for one hour).
// The answer is the same whether or not there is an account for that email address.
// If email is not set up yet (lib/email.js), the Council gets a message instead and helps by hand.
import { json, readJson, validate, nowIso } from '../../../lib/http.js';
import { first, run } from '../../../lib/db.js';
import { checkLoginRate, recordFailedLogin, createResetToken } from '../../../lib/auth.js';
import { emailConfigured, sendEmail, siteUrl } from '../../../lib/email.js';

// Only for the automated tests: the link is returned instead of emailed. Never set this on a real site.
const showLinks = (env) => env.EMAIL_TEST_MODE === 'show-links';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const check = validate(body);
  const email = check.email('email');
  check.done();

  // At most a few links per email address in 15 minutes.
  const rateKey = 'reset:' + email;
  await checkLoginRate(env, rateKey);
  await recordFailedLogin(env, rateKey);

  const byEmail = showLinks(env) || emailConfigured(env);
  const user = await first(env, `SELECT id, name, email FROM users WHERE email = ? AND status != 'suspended'`, email);
  const result = { ok: true };
  let tellCouncil = !!user && !byEmail;
  if (user && byEmail) {
    const token = await createResetToken(env, user.id);
    const link = `${siteUrl(env, request)}/reset-password?token=${token}`;
    if (showLinks(env)) {
      result.test_link = link;
    } else {
      try {
        await sendEmail(env, {
          to: user.email,
          subject: 'Choose a new NAGP password',
          text: `Hello ${user.name},\n\nSomeone (we hope it was you) asked to choose a new password for your NAGP account.\n\n`
            + `To choose a new password, open this link. It works for one hour:\n${link}\n\n`
            + 'If you did not ask for this, you can ignore this email. Your password stays the same.\n\n'
            + 'National Association of Gestalt Practitioners',
        });
      } catch (err) {
        console.error(err); // for example the sending domain is not verified yet: the Council helps instead
        tellCouncil = true;
      }
    }
  }
  if (tellCouncil) {
    await run(env, `INSERT INTO messages (name, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      user.name, user.email, 'Sign-in help',
      'Asked for a new password on the "Forgot your password?" page, but the website could not email them a link. '
      + 'Please set a new password for them (Members, then Edit) and tell them by phone or in a private email.', nowIso());
  }

  result.message = byEmail
    ? `If there is an NAGP account for ${email}, we have sent it an email with a link to choose a new password. `
      + 'The link works for one hour. If the email does not arrive within a few minutes, please check your spam or junk folder.'
    : `Thank you. If there is an NAGP account for ${email}, the Council has been told and will email you to help you choose a new password.`;
  return json(result);
}
