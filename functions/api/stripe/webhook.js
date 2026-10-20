// POST /api/stripe/webhook   (called by Stripe, not by people)
// Set up in the Stripe dashboard: Developers > Webhooks > Add endpoint
//   URL:    https://<your site>/api/stripe/webhook
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded
// Then copy the endpoint's signing secret (whsec_…) into the STRIPE_WEBHOOK_SECRET setting.
// The middleware skips its same-site check for /api/stripe/*; the Stripe-Signature header is checked here instead.
import { json } from '../../../lib/http.js';
import { first } from '../../../lib/db.js';
import { verifyStripeSignature, markOrderPaid } from '../../../lib/payments.js';

const PAID_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook is not set up.' }, { status: 404 });
  const payload = await request.text();
  if (payload.length > 500_000) return json({ error: 'Too large.' }, { status: 413 });
  const ok = await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: 'Invalid signature.' }, { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return json({ error: 'Invalid JSON.' }, { status: 400 }); }

  if (PAID_EVENTS.has(event.type)) {
    const session = (event.data && event.data.object) || {};
    const orderId = session.metadata && session.metadata.order_id;
    if (session.payment_status === 'paid' && typeof orderId === 'string') {
      const order = await first(env, `SELECT id, amount_cents, currency, status FROM orders WHERE id = ?`, orderId);
      if (!order) {
        console.error('Stripe webhook: unknown order', orderId, session.id);
      } else if (Number(session.amount_total) !== Number(order.amount_cents)
          || String(session.currency || '').toLowerCase() !== String(order.currency || 'usd').toLowerCase()) {
        console.error('Stripe webhook: amount does not match the order', orderId, session.amount_total, order.amount_cents);
      } else if (order.status === 'cancelled') {
        console.error('Stripe webhook: payment received for a cancelled order. The Council should refund it or record it by hand.', orderId, session.id);
      } else {
        await markOrderPaid(env, orderId, { provider: 'stripe', provider_ref: session.id });
      }
    }
  }
  // Always answer 200 for a correctly signed event, so Stripe does not keep retrying.
  return json({ received: true });
}
