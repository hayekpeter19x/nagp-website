// GET  /api/orders/:id?token=…[&session_id=cs_…]  -> { order, payments, demo_payments }
//      Anyone with the secret link can see the order (safe fields only). With Stripe, a pending
//      order is double-checked with Stripe, so the receipt shows "paid" even before the webhook arrives.
// POST /api/orders/:id  { token }  -> { checkout_url }
//      Starts (or resumes) paying for an unpaid order: the "Pay" button on /checkout in Stripe mode,
//      and "Finish joining" in My Payments.
import { json, readJson, HttpError, nowIso } from '../../../lib/http.js';
import { run } from '../../../lib/db.js';
import {
  findOrderWithToken, orderDetails, startCheckout, confirmWithStripe, isStripeMode, demoPaymentsAllowed,
} from '../../../lib/payments.js';
import { eventOrderInfo } from '../../../lib/events.js';

export async function onRequestGet({ request, env, params, data }) {
  const url = new URL(request.url);
  let order = await findOrderWithToken(env, params.id, url.searchParams.get('token') || '');
  if (order.status === 'pending' && isStripeMode(env)) {
    order = await confirmWithStripe(env, order, url.searchParams.get('session_id') || null);
  }
  return json({
    order: await orderDetails(env, order),
    payments: isStripeMode(env) ? 'stripe' : 'demo',
    demo_payments: demoPaymentsAllowed(env, data),
  });
}

export async function onRequestPost({ request, env, params }) {
  const body = await readJson(request);
  const order = await findOrderWithToken(env, params.id, typeof body.token === 'string' ? body.token : '');
  if (order.status === 'paid') throw new HttpError(409, 'This has already been paid. Thank you!');
  if (order.status !== 'pending') throw new HttpError(409, 'This payment was cancelled, so it cannot be paid. Please start again, or contact us for help.');
  if (order.kind === 'event') {
    const info = await eventOrderInfo(env, order);
    if (info.problem) throw new HttpError(409, info.problem);
    // Hold the place again while they pay.
    await run(env, `UPDATE registrations SET created_at = ? WHERE id = ? AND status = 'pending'`, nowIso(), info.registration.id);
  }
  const { url } = await startCheckout(env, request, order);
  return json({ checkout_url: url });
}
