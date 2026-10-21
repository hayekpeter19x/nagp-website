// POST /api/events/:id/register  { name, email }
// Free event  -> { status: 'confirmed' }
// Paid event  -> { status: 'pending', checkout_url, order_id }
// The price is always worked out here: the member price for active members, otherwise the public price.
import { json, readJson, validate, HttpError, isActiveMember, nowIso, requireUser } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';
import { createOrder, checkoutUrl } from '../../../../lib/payments.js';
import {
  getEventRow, toId, takenCounts, registrationState, priceFor, eventDateText, holdCutoff,
} from '../../../../lib/events.js';

export async function onRequestPost(context) {
  requireUser(context, 'member'); // Events are for members only
  const { request, env, params, data } = context;
  const id = toId(params.id);
  const ev = id && (await getEventRow(env, id));
  if (!ev || !ev.published) throw new HttpError(404, 'We could not find that event. It may have been removed.');

  const body = await readJson(request);
  if (body.hp) return json({ status: 'confirmed' }); // spam trap
  const user = data.user;
  const check = validate(body);
  const name = check.text('name', { label: 'Your name', required: true, max: 120 });
  const email = check.email('email');
  check.done();

  const taken = (await takenCounts(env, [ev.id]))[ev.id] || 0;
  const spotsLeft = ev.capacity === null ? null : Math.max(0, ev.capacity - taken);
  const state = registrationState(ev, spotsLeft);
  if (state === 'past') throw new HttpError(400, 'This event has already taken place, so registration is closed.');
  if (state === 'started') throw new HttpError(400, 'This event has already started, so registration is closed.');
  if (state === 'closed') throw new HttpError(400, 'Registration for this event is closed. If you have a question, please contact us.');
  if (ev.members_only && !isActiveMember(user)) {
    throw new HttpError(403, user
      ? 'This event is for members with an active membership. Please finish joining or renew your membership first.'
      : 'This event is for NAGP members. Please sign in first.');
  }

  // Already registered?
  const byEmail = await first(env,
    `SELECT id FROM registrations WHERE event_id = ? AND status = 'confirmed' AND lower(email) = ? LIMIT 1`, ev.id, email);
  if (byEmail) throw new HttpError(409, `${email} is already registered for this event. There is no need to register again.`, { email: 'This email address is already registered for this event.' });
  if (user) {
    const byUser = await first(env,
      `SELECT id FROM registrations WHERE event_id = ? AND status = 'confirmed' AND user_id = ? LIMIT 1`, ev.id, user.id);
    if (byUser) throw new HttpError(409, 'You are already registered for this event. There is no need to register again.');
  }

  const price = priceFor(ev, user);
  const now = nowIso();

  // Started registering before but did not pay? Pick up where they left off instead of
  // taking a second place.
  const pending = await first(env,
    `SELECT r.id AS reg_id, r.created_at AS reg_created, o.* FROM registrations r JOIN orders o ON o.id = r.order_id
     WHERE r.event_id = ? AND r.status = 'pending' AND lower(r.email) = ? AND o.status = 'pending'
     ORDER BY r.id DESC LIMIT 1`, ev.id, email);
  if (pending) {
    const stillHeld = pending.reg_created > holdCutoff();
    if (pending.amount_cents === price && (stillHeld || spotsLeft === null || spotsLeft > 0)) {
      await run(env, `UPDATE registrations SET created_at = ?, name = ?, user_id = COALESCE(user_id, ?) WHERE id = ?`,
        now, name, user ? user.id : null, pending.reg_id);
      const { reg_id, reg_created, ...order } = pending;
      return json({ status: 'pending', order_id: order.id, checkout_url: await checkoutUrl(env, request, order) });
    }
    // The price changed (for example they have since become a member): start again.
    await run(env, `UPDATE registrations SET status = 'cancelled' WHERE id = ?`, pending.reg_id);
    await run(env, `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, pending.id);
  }

  // Take a place, but only if one is free (checked in the same statement, so two people
  // cannot both get the last place).
  const status = price > 0 ? 'pending' : 'confirmed';
  const res = await run(env,
    `INSERT INTO registrations (event_id, user_id, name, email, order_id, status, created_at)
     SELECT ?, ?, ?, ?, NULL, ?, ?
     WHERE (SELECT capacity FROM events WHERE id = ?) IS NULL
        OR (SELECT COUNT(*) FROM registrations WHERE event_id = ?
            AND (status = 'confirmed' OR (status = 'pending' AND created_at > ?)))
           < (SELECT capacity FROM events WHERE id = ?)`,
    ev.id, user ? user.id : null, name, email, status, now, ev.id, ev.id, holdCutoff(), ev.id);
  if (!res.meta || res.meta.changes !== 1) {
    throw new HttpError(409, 'Sorry, this event is now full. Please contact us if you would like to hear about a place opening up.');
  }
  const registrationId = res.meta.last_row_id;

  if (status === 'confirmed') return json({ status: 'confirmed', registration_id: registrationId });

  const member = isActiveMember(user) && ev.price_member_cents !== ev.price_public_cents;
  const order = await createOrder(env, {
    kind: 'event',
    ref_id: ev.id,
    description: `Event registration: ${ev.title}, ${eventDateText(ev)}${member ? ' (member price)' : ''}`,
    amount_cents: price,
    user_id: user ? user.id : null,
    name,
    email,
    meta: { event_id: ev.id, registration_id: registrationId, price: member ? 'member' : 'public' },
  });
  await run(env, `UPDATE registrations SET order_id = ? WHERE id = ?`, order.id, registrationId);
  return json({ status: 'pending', order_id: order.id, checkout_url: await checkoutUrl(env, request, order) });
}
