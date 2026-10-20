// POST /api/auth/demo  { as: 'member' | 'professional' | 'council' }
// Preview only: lets reviewers try each access level without a password.
// Turned off when DEMO_MODE=false.
import { json, readJson, HttpError } from '../../../lib/http.js';
import { first } from '../../../lib/db.js';
import { createSession, toSessionUser } from '../../../lib/auth.js';
import { DEMO_ACCOUNTS } from '../../../lib/seed.js';

export async function onRequestPost({ request, env, data }) {
  if (!data.demo) throw new HttpError(404, 'Demo sign-in is turned off on this site.');
  const body = await readJson(request);
  const account = DEMO_ACCOUNTS[body.as];
  if (!account) throw new HttpError(400, 'Please choose which demo account to use.');
  const user = await first(env, `SELECT * FROM users WHERE email = ?`, account.email);
  if (!user) throw new HttpError(404, 'The demo accounts have been removed from this site.');
  const cookie = await createSession(env, request, user.id);
  return json({ user: toSessionUser(user) }, { headers: { 'set-cookie': cookie } });
}
