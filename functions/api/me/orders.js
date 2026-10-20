// GET /api/me/orders   (signed in, including people who have not paid yet)
// -> { membership, orders, registrations }
// Only the signed-in person's own orders (linked by account, never just by email address).
import { json, requireUser, isActiveMember, isCouncil } from '../../../lib/http.js';
import { all } from '../../../lib/db.js';
import { tierByKey } from '../../../lib/config.js';
import { safeOrder, orderMeta, todayYmd } from '../../../lib/payments.js';
import { eventIsPast } from '../../../lib/events.js';

export async function onRequestGet(context) {
  const { env } = context;
  const user = requireUser(context, 'signed-in');

  const orderRows = await all(env,
    `SELECT * FROM orders WHERE user_id = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 200`, user.id);
  const orders = orderRows.map((o) => {
    const out = safeOrder(o);
    if (o.kind === 'membership') out.tier = orderMeta(o).tier || null;
    return out;
  });

  const regRows = await all(env,
    `SELECT r.id, r.event_id, r.status, r.order_id, r.created_at, e.title, e.starts_at, e.ends_at, e.timezone,
            e.location, e.is_online, e.sample, o.token AS order_token, o.status AS order_status, o.amount_cents
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE r.user_id = ? AND r.status != 'cancelled'
       AND (r.status = 'confirmed' OR o.status = 'pending')
     ORDER BY e.starts_at`, user.id);
  const now = Date.now();
  const registrations = regRows.map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    amount_cents: r.amount_cents || 0,
    is_past: eventIsPast(r, now),
    event: {
      id: r.event_id, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, timezone: r.timezone,
      location: r.location, is_online: !!r.is_online, sample: !!r.sample,
    },
    links: r.order_id && r.order_token ? {
      checkout: `/checkout?order=${encodeURIComponent(r.order_id)}&token=${encodeURIComponent(r.order_token)}`,
      receipt: `/payment-complete?order=${encodeURIComponent(r.order_id)}&token=${encodeURIComponent(r.order_token)}`,
    } : null,
  }));
  // Upcoming first (soonest first), then past ones (newest first).
  registrations.sort((a, b) => (a.is_past - b.is_past)
    || (a.is_past ? Date.parse(b.event.starts_at) - Date.parse(a.event.starts_at) : Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at)));

  const tier = tierByKey(user.tier) || tierByKey(user.member_type);
  const pendingRow = orderRows.find((o) => o.kind === 'membership' && o.status === 'pending');
  const today = todayYmd();
  const expires = user.membership_expires || null;
  return json({
    membership: {
      status: user.status,
      is_member: isActiveMember(user),
      is_council: isCouncil(user),
      tier: tier ? tier.key : null,
      tier_name: tier ? tier.name : null,
      price_cents: tier ? tier.price_cents : null,
      expires,
      expired: !!expires && expires < today,
      days_left: expires ? Math.round((Date.parse(expires + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5) : null,
      pending_order: pendingRow ? { ...safeOrder(pendingRow), tier: orderMeta(pendingRow).tier || null } : null,
    },
    orders,
    registrations,
  });
}
