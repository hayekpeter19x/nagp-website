// POST /api/membership/cancel  { undo? }   (signed in)
// Membership is a one-year payment with no automatic renewal, so cancelling means:
// the membership stays active until its end date, it will not be renewed, and the Council
// gets a message (for example to discuss a refund). { undo: true } keeps the membership after all.
import { json, readJson, requireUser, HttpError, nowIso } from '../../../lib/http.js';
import { run } from '../../../lib/db.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = requireUser(context, 'signed-in');
  const body = await readJson(request);
  if (!user.membership_expires && user.status !== 'active') {
    throw new HttpError(400, 'You do not have an active membership to cancel.');
  }
  const undo = body.undo === true;
  const at = undo ? null : nowIso();
  await run(env, `UPDATE users SET cancel_requested_at = ? WHERE id = ?`, at, user.id);
  await run(env, `INSERT INTO messages (name, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?)`,
    user.name, user.email, 'Membership',
    undo
      ? `${user.name} changed their mind and wants to keep their membership.`
      : `${user.name} asked to cancel their membership (sent from the My Membership page). It stays active until ${user.membership_expires || 'its end date'} and will not be renewed.`,
    nowIso());
  return json({ ok: true, cancel_requested_at: at });
}
