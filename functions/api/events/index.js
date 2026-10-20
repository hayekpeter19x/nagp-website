// GET /api/events?when=upcoming|past&limit=&category=
// Published events. Upcoming: soonest first (an event stays "upcoming" until it ends).
// Past: newest first.
import { json } from '../../../lib/http.js';
import { all } from '../../../lib/db.js';
import { toEvent, takenCounts, myRegistrations, eventIsPast } from '../../../lib/events.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const when = url.searchParams.get('when') === 'past' ? 'past' : 'upcoming';
  const category = (url.searchParams.get('category') || '').slice(0, 60);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 100;

  const rows = category
    ? await all(env, `SELECT * FROM events WHERE published = 1 AND category = ?`, category)
    : await all(env, `SELECT * FROM events WHERE published = 1`);

  const now = Date.now();
  const start = (r) => Date.parse(r.starts_at) || 0;
  let list = rows.filter((r) => (when === 'past' ? eventIsPast(r, now) : !eventIsPast(r, now)));
  list.sort((a, b) => (when === 'past' ? start(b) - start(a) : start(a) - start(b)));
  list = list.slice(0, limit);

  const ids = list.map((r) => r.id);
  const taken = await takenCounts(env, ids);
  const mine = await myRegistrations(env, data.user, ids);
  const user = data.user;
  return json({ events: list.map((r) => toEvent(r, { taken: taken[r.id] || 0, mine: mine[r.id] || null, user, now })) });
}
