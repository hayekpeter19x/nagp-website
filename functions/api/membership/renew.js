// POST /api/membership/renew  {}   (signed in, including people who have not paid yet)
// Starts a one-year membership payment for the signed-in person -> { checkout_url, order_id }.
// Also used to finish joining: an unpaid order for the same membership is re-used.
import { json, readJson, requireUser } from '../../../lib/http.js';
import { first, run } from '../../../lib/db.js';
import { MEMBERSHIP_TIERS } from '../../../lib/config.js';
import { createOrder, checkoutUrl } from '../../../lib/payments.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = requireUser(context, 'signed-in');
  await readJson(request);
  const tier = MEMBERSHIP_TIERS[0]; // one membership for everyone

  // Re-use an unpaid order for the same membership, and tidy away unpaid orders for other types.
  const open = await first(env,
    `SELECT * FROM orders WHERE user_id = ? AND kind = 'membership' AND status = 'pending'
       AND amount_cents = ? AND json_extract(meta, '$.tier') = ?
     ORDER BY created_at DESC LIMIT 1`, user.id, tier.price_cents, tier.key);
  await run(env,
    `UPDATE orders SET status = 'cancelled' WHERE user_id = ? AND kind = 'membership' AND status = 'pending' AND id != ?`,
    user.id, open ? open.id : '');
  if (open) return json({ checkout_url: await checkoutUrl(env, request, open), order_id: open.id });

  const renewing = user.status === 'active' || user.status === 'lapsed' || !!user.membership_expires;
  const order = await createOrder(env, {
    kind: 'membership',
    ref_id: user.id,
    description: `NAGP membership, one year${renewing ? ' (renewal)' : ''}`,
    amount_cents: tier.price_cents,
    user_id: user.id,
    name: user.name,
    email: user.email,
    meta: { tier: tier.key, reason: renewing ? 'renew' : 'join' },
  });
  return json({ checkout_url: await checkoutUrl(env, request, order), order_id: order.id });
}
