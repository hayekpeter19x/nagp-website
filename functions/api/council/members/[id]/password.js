// POST /api/council/members/:id/password  { password }
// For "I forgot my password" requests: the Council sets a new one and tells the member.
import { json, readJson, validate, requireUser, HttpError } from '../../../../../lib/http.js';
import { first, run } from '../../../../../lib/db.js';
import { hashPassword, checkPasswordStrength } from '../../../../../lib/auth.js';
import { idParam } from '../../../../../lib/council.js';

export async function onRequestPost(context) {
  const me = requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'member');
  const body = await readJson(request);
  const check = validate(body);
  const password = typeof body.password === 'string' ? body.password : '';
  const weak = checkPasswordStrength(password);
  if (weak) check.fail('password', weak.replace('Please choose a password', 'Please choose a new password'));
  check.done();

  const user = await first(env, `SELECT id, name, email FROM users WHERE id = ?`, id);
  if (!user) throw new HttpError(404, 'We could not find that member.');
  await run(env, `UPDATE users SET password_hash = ? WHERE id = ?`, await hashPassword(password), id);
  // Sign them out on other devices (unless it is the Council member's own account),
  // and clear any "too many attempts" lock so they can sign in straight away.
  if (id !== me.id) await run(env, `DELETE FROM sessions WHERE user_id = ?`, id);
  await run(env, `DELETE FROM login_attempts WHERE key = ?`, 'login:' + user.email);
  return json({
    ok: true,
    message: `The new password for ${user.name} is saved. Please tell them by phone or in a private email, and suggest they choose their own password under "My Profile" after signing in.`,
  });
}
