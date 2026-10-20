// GET    /api/council/events/:id   one event (for the edit form)
// PUT    /api/council/events/:id   save changes
// DELETE /api/council/events/:id   delete it, with its registrations (payment records are kept)
import { json, readJson, requireUser, HttpError } from '../../../../../lib/http.js';
import { first, run } from '../../../../../lib/db.js';
import { EVENT_COLUMNS, eventRow, idParam, readEventForm } from '../../../../../lib/council.js';

async function load(env, id) {
  const row = await first(env,
    `SELECT ${EVENT_COLUMNS},
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = events.id AND r.status = 'confirmed') AS confirmed,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = events.id AND r.status = 'pending') AS waiting
       FROM events WHERE id = ?`, id);
  if (!row) throw new HttpError(404, 'We could not find that event. It may have been deleted.');
  return row;
}

export async function onRequestGet(context) {
  requireUser(context, 'council');
  return json({ event: eventRow(await load(context.env, idParam(context, 'event'))) });
}

export async function onRequestPut(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'event');
  const current = await load(env, id);
  const ev = readEventForm(await readJson(request), { currentTimezone: current.timezone });
  await run(env,
    `UPDATE events SET title = ?, category = ?, summary = ?, description = ?, starts_at = ?, ends_at = ?, timezone = ?, location = ?,
       is_online = ?, presenter = ?, ce_info = ?, price_member_cents = ?, price_public_cents = ?, members_only = ?, capacity = ?,
       registration_open = ?, published = ?
     WHERE id = ?`,
    ev.title, ev.category, ev.summary, ev.description, ev.starts_at, ev.ends_at, ev.timezone, ev.location, ev.is_online,
    ev.presenter, ev.ce_info, ev.price_member_cents, ev.price_public_cents, ev.members_only, ev.capacity,
    ev.registration_open, ev.published, id);
  return json({ ok: true, event: eventRow(await load(env, id)), message: `Saved. Your changes to "${ev.title}" are now on the site.` });
}

export async function onRequestDelete(context) {
  requireUser(context, 'council');
  const { env } = context;
  const id = idParam(context, 'event');
  const ev = await load(env, id);
  const regs = await run(env, `DELETE FROM registrations WHERE event_id = ?`, id);
  await run(env, `DELETE FROM events WHERE id = ?`, id);
  const n = regs.meta.changes || 0;
  return json({
    ok: true,
    message: `"${ev.title}" was deleted${n ? `, with its ${n} registration${n === 1 ? '' : 's'}` : ''}. Any payments stay on the Payments page.`,
  });
}
