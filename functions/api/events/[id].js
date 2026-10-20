// GET /api/events/:id  -> { event }
// Unpublished events are only visible to the Council (so they can preview them).
import { json, HttpError, isCouncil } from '../../../lib/http.js';
import { toEvent, takenCounts, myRegistrations, getEventRow, toId } from '../../../lib/events.js';

export async function onRequestGet({ params, env, data }) {
  const id = toId(params.id);
  const row = id && (await getEventRow(env, id));
  if (!row || (!row.published && !isCouncil(data.user))) {
    throw new HttpError(404, 'We could not find that event. It may have been removed or the link may be incomplete.');
  }
  const taken = await takenCounts(env, [row.id]);
  const mine = await myRegistrations(env, data.user, [row.id]);
  return json({ event: toEvent(row, { taken: taken[row.id] || 0, mine: mine[row.id] || null, user: data.user }) });
}
