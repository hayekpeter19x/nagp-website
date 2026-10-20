// GET /api/council/events/:id/registrations              who registered for an event
// GET /api/council/events/:id/registrations?format=csv   the same list as a spreadsheet
import { json, requireUser, HttpError } from '../../../../../lib/http.js';
import { all, first } from '../../../../../lib/db.js';
import { csvResponse, wantsCsv, idParam, dollars } from '../../../../../lib/council.js';

const STATUS = { confirmed: 'Confirmed', pending: 'Waiting for payment', cancelled: 'Cancelled' };

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'event');
  const event = await first(env, `SELECT id, title, starts_at, timezone FROM events WHERE id = ?`, id);
  if (!event) throw new HttpError(404, 'We could not find that event. It may have been deleted.');

  const rows = await all(env,
    `SELECT r.id, r.name, r.email, r.status, r.created_at, r.user_id, r.order_id,
            o.amount_cents, o.status AS order_status, o.provider,
            u.status AS member_status
       FROM registrations r
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.event_id = ?
      ORDER BY CASE r.status WHEN 'confirmed' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, r.created_at`, id);
  const registrations = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    status: r.status,
    created_at: r.created_at,
    is_member: r.member_status === 'active',
    amount_cents: r.order_status === 'paid' ? Number(r.amount_cents || 0) : 0,
    provider: r.provider || null,
  }));

  if (wantsCsv(request)) {
    return csvResponse(`nagp-registrations-${event.title}`.slice(0, 60),
      ['Name', 'Email', 'Status', 'Member', 'Amount paid (USD)', 'Registered on'],
      registrations.map((r) => [r.name, r.email, STATUS[r.status] || r.status, r.is_member, dollars(r.amount_cents), r.created_at.slice(0, 10)]));
  }
  return json({
    event,
    registrations,
    confirmed: registrations.filter((r) => r.status === 'confirmed').length,
  });
}
