// POST /api/auth/signout
import { json } from '../../../lib/http.js';
import { destroySession } from '../../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const cookie = await destroySession(env, request);
  return json({ ok: true }, { headers: { 'set-cookie': cookie } });
}
