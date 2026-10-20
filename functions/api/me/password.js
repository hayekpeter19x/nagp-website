// POST /api/me/password  { current_password, new_password } -> { ok }
// Checks the current password, then saves the new one. Other devices are signed out.
import { json, readJson, requireUser, HttpError } from '../../../lib/http.js';
import { run } from '../../../lib/db.js';
import { verifyPassword, hashPassword, checkPasswordStrength, checkLoginRate, recordFailedLogin } from '../../../lib/auth.js';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sessionToken(request) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'nagp_session') return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = requireUser(context, 'signed-in');
  const body = await readJson(request);
  const current = typeof body.current_password === 'string' ? body.current_password : '';
  const next = typeof body.new_password === 'string' ? body.new_password : '';

  const fields = {};
  if (!current) fields.current_password = 'Please enter your current password.';
  const weak = checkPasswordStrength(next);
  if (!next) fields.new_password = 'Please enter a new password.';
  else if (weak) fields.new_password = weak;
  if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields.', fields);

  const rateKey = 'password:' + user.id;
  await checkLoginRate(env, rateKey);
  if (!(await verifyPassword(current, user.password_hash))) {
    await recordFailedLogin(env, rateKey);
    throw new HttpError(400, 'Your current password was not right.', {
      current_password: 'That is not your current password. Please try again.',
    });
  }
  if (current === next) {
    throw new HttpError(400, 'Please choose a new password.', { new_password: 'The new password is the same as your current one.' });
  }

  await run(env, `UPDATE users SET password_hash = ? WHERE id = ?`, await hashPassword(next), user.id);
  // Keep this device signed in; sign out everywhere else.
  const token = sessionToken(request);
  if (token) await run(env, `DELETE FROM sessions WHERE user_id = ? AND id != ?`, user.id, await sha256Hex(token));
  return json({ ok: true });
}
