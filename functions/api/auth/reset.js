// GET  /api/auth/reset?token=...   { valid } (so the page can say straight away if a link has expired)
// POST /api/auth/reset  { token, password, password_confirm }
// Saves the new password from a "Forgot your password?" link, signs the person out everywhere else,
// and signs them in here.
import { json, readJson, validate, HttpError } from '../../../lib/http.js';
import { first, run } from '../../../lib/db.js';
import { hashPassword, checkPasswordStrength, findResetUser, useResetToken, createSession, toSessionUser } from '../../../lib/auth.js';

const EXPIRED = 'This link has expired or has already been used. Please ask for a new one.';

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  return json({ valid: !!(await findResetUser(env, token)) });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const check = validate(body);
  const password = typeof body.password === 'string' ? body.password : '';
  const weak = checkPasswordStrength(password);
  if (weak) check.fail('password', weak);
  else if (password !== body.password_confirm) {
    check.fail('password_confirm', 'The two passwords are not the same. Please type the same password in both boxes.');
  }
  check.done();

  const found = await findResetUser(env, body.token);
  if (!found) throw new HttpError(400, EXPIRED);
  await run(env, `UPDATE users SET password_hash = ? WHERE id = ?`, await hashPassword(password), found.id);
  await useResetToken(env, found.id);
  await run(env, `DELETE FROM sessions WHERE user_id = ?`, found.id);
  await run(env, `DELETE FROM login_attempts WHERE key = ?`, 'login:' + found.email);
  const cookie = await createSession(env, request, found.id);
  const user = await first(env, `SELECT * FROM users WHERE id = ?`, found.id);
  return json({ ok: true, user: toSessionUser(user), message: 'Your new password is saved, and you are signed in.' },
    { headers: { 'set-cookie': cookie } });
}
