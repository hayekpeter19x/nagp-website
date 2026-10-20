// POST /api/auth/signin  { email, password }
import { json, readJson, validate, HttpError } from '../../../lib/http.js';
import { first } from '../../../lib/db.js';
import { verifyPassword, createSession, checkLoginRate, recordFailedLogin, toSessionUser } from '../../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const check = validate(body);
  const email = check.email('email');
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) check.fail('password', 'Please enter your password.');
  check.done();

  const rateKey = 'login:' + email;
  await checkLoginRate(env, rateKey);
  const user = await first(env, `SELECT * FROM users WHERE email = ?`, email);
  const ok = user && user.status !== 'suspended' && (await verifyPassword(password, user.password_hash));
  if (!ok) {
    await recordFailedLogin(env, rateKey);
    throw new HttpError(401, 'That email and password do not match our records. Please check them and try again.');
  }
  const cookie = await createSession(env, request, user.id);
  return json({ user: toSessionUser(user) }, { headers: { 'set-cookie': cookie } });
}
