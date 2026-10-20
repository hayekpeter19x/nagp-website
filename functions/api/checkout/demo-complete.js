// POST /api/checkout/demo-complete  { id, token }  -> { order, receipt_url }
// PREVIEW ONLY: the "Pay" button on the simulated card form. No money changes hands.
// Turned off (404) when Stripe is set up or DEMO_MODE=false, so it can never be used to skip paying.
import { json, readJson, HttpError } from '../../../lib/http.js';
import { findOrderWithToken, markOrderPaid, orderDetails, orderLinks, demoPaymentsAllowed, randomRef } from '../../../lib/payments.js';
import { eventOrderInfo } from '../../../lib/events.js';

export async function onRequestPost({ request, env, data }) {
  if (!demoPaymentsAllowed(env, data)) throw new HttpError(404, 'Simulated payments are turned off on this site.');
  const body = await readJson(request);
  let order = await findOrderWithToken(env, typeof body.id === 'string' ? body.id : '', typeof body.token === 'string' ? body.token : '');
  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw new HttpError(409, 'This payment was cancelled, so it cannot be paid. Please start again, or contact us for help.');
  }
  if (order.status === 'pending') {
    if (order.kind === 'event') {
      const info = await eventOrderInfo(env, order);
      if (info.problem) throw new HttpError(409, info.problem);
    }
    order = await markOrderPaid(env, order.id, { provider: 'demo', provider_ref: randomRef() });
  }
  return json({ order: await orderDetails(env, order), receipt_url: orderLinks(order).receipt });
}
