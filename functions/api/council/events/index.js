// GET  /api/council/events   every event, including unpublished and past ones, with registration counts
// POST /api/council/events   add an event (date + time + time zone are turned into starts_at with the right offset)
import { json, readJson, requireUser, nowIso } from '../../../../lib/http.js';
import { all, first, run } from '../../../../lib/db.js';
import { EVENT_COLUMNS, EVENT_TIMEZONES, eventRow, readEventForm } from '../../../../lib/council.js';

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const rows = await all(context.env,
    `SELECT ${EVENT_COLUMNS.split(',').map((c) => 'e.' + c.trim()).join(', ')},
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'pending') AS waiting
       FROM events e
      ORDER BY julianday(e.starts_at) ASC`);
  return json({ events: rows.map(eventRow), timezones: EVENT_TIMEZONES });
}

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const ev = readEventForm(await readJson(request));
  const res = await run(env,
    `INSERT INTO events (title, category, summary, description, starts_at, ends_at, timezone, location, is_online, presenter, ce_info,
       price_member_cents, price_public_cents, members_only, capacity, registration_open, published, sample, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ev.title, ev.category, ev.summary, ev.description, ev.starts_at, ev.ends_at, ev.timezone, ev.location, ev.is_online,
    ev.presenter, ev.ce_info, ev.price_member_cents, ev.price_public_cents, ev.members_only, ev.capacity,
    ev.registration_open, ev.published, nowIso());
  const row = await first(env, `SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`, res.meta.last_row_id);
  return json({
    ok: true,
    event: eventRow(row),
    message: ev.published
      ? `"${ev.title}" was added and is now on the Events page.`
      : `"${ev.title}" was saved. It is not published yet, so only the Council can see it.`,
  }, { status: 201 });
}
