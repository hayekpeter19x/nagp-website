// Payments: orders, checkout (simulated or Stripe) and what happens once an order is paid.
//
// Used by the payments endpoints (functions/api/membership, donate, events, orders, checkout, stripe)
// and by the Council area (recording check payments with provider 'manual').
//
//   createOrder(env, { kind, ref_id, description, amount_cents, user_id, name, email, meta })  -> order row
//   startCheckout(env, request, order)        -> { url }
//   markOrderPaid(env, orderId, { provider, provider_ref })                                   -> order row
//   orderLinks(order)                         -> { checkout, receipt }
//
// Two modes:
//   Demo   (no STRIPE_SECRET_KEY): checkout is our own simulated page, /checkout?order=…&token=…
//   Stripe (STRIPE_SECRET_KEY set): a Stripe Checkout Session (hosted payment page). Stripe calls
//          /api/stripe/webhook (signed with STRIPE_WEBHOOK_SECRET) when the payment succeeds, and the
//          receipt page also double-checks the session with Stripe, so either one marks the order paid.
import { first, run, randomId } from './db.js';
import { HttpError, nowIso } from './http.js';
import { tierByKey, ORG } from './config.js';
import { eventOrderInfo, eventBrief } from './events.js';

export const ORDER_KINDS = ['membership', 'event', 'donation'];
const STRIPE_API = 'https://api.stripe.com/v1';

export const isStripeMode = (env) => !!(env && env.STRIPE_SECRET_KEY);
// The simulated card form only works in preview mode AND when Stripe is not set up, so a live
// site that is missing its Stripe key can never hand out free memberships.
export const demoPaymentsAllowed = (env, data) => !isStripeMode(env) && !!(data && data.demo);

// ---------- Orders ----------

export async function createOrder(env, { kind, ref_id = null, description, amount_cents, user_id = null, name, email, meta = {} }) {
  if (!ORDER_KINDS.includes(kind)) throw new HttpError(400, 'Unknown kind of payment.');
  if (!Number.isInteger(amount_cents) || amount_cents < 0) throw new HttpError(400, 'The amount must be a whole number of cents.');
  if (!description || !name || !email) throw new HttpError(400, 'An order needs a description, a name and an email address.');
  const id = readableOrderId();
  const token = randomId('', 18);
  const metaText = typeof meta === 'string' ? meta : JSON.stringify(meta || {});
  await run(env,
    `INSERT INTO orders (id, token, kind, ref_id, description, amount_cents, currency, status, user_id, name, email, provider, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'usd', 'pending', ?, ?, ?, ?, ?, ?)`,
    id, token, kind, ref_id, String(description).slice(0, 300), amount_cents, user_id, name, String(email).toLowerCase(),
    isStripeMode(env) ? 'stripe' : 'demo', metaText, nowIso());
  return first(env, `SELECT * FROM orders WHERE id = ?`, id);
}

// Order numbers are written on check memo lines and read out on the phone, so they use only
// capital letters and digits that cannot be confused (no 0/O, 1/I/L). For example "ord_7K3M9QX2PD".
// The order id is not secret: the separate random token is what protects the order's pages.
const ORDER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function readableOrderId(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  let out = '';
  for (const b of bytes) {
    if (b < 248) out += ORDER_ALPHABET[b % ORDER_ALPHABET.length]; // 248 = 8 * 31, so no bias
    if (out.length === length) break;
  }
  while (out.length < length) out += ORDER_ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % ORDER_ALPHABET.length];
  return 'ord_' + out;
}

export function orderLinks(order) {
  const q = `order=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.token)}`;
  return { checkout: `/checkout?${q}`, receipt: `/payment-complete?${q}` };
}

// A reference for a simulated (preview) payment, e.g. "demo_x8Hq2…".
export const randomRef = () => randomId('demo_', 9);

export function orderMeta(order) {
  try { return JSON.parse(order.meta || '{}') || {}; } catch { return {}; }
}

// Looks up an order by id + secret token. The same "not found" answer for a wrong id or a wrong
// token, so the link cannot be guessed.
export async function findOrderWithToken(env, id, token) {
  const notFound = new HttpError(404, 'We could not find that payment. Please check that you used the whole link, or contact us for help.');
  if (typeof id !== 'string' || typeof token !== 'string' || !/^ord_[\w-]{6,40}$/.test(id) || token.length > 100) throw notFound;
  const order = await first(env, `SELECT * FROM orders WHERE id = ?`, id);
  if (!order || !sameText(order.token, token)) throw notFound;
  return order;
}

// The fields that are safe to show to the person holding the order link.
export function safeOrder(order) {
  return {
    id: order.id,
    kind: order.kind,
    ref_id: order.ref_id,
    description: order.description,
    amount_cents: order.amount_cents,
    currency: order.currency,
    status: order.status,
    name: order.name,
    email: order.email,
    provider: order.provider,
    created_at: order.created_at,
    paid_at: order.paid_at,
    links: orderLinks(order),
  };
}

// safeOrder plus what the checkout and receipt pages need: the event (with any reason it can no
// longer be paid for), the membership type and end date, or the donor's note.
export async function orderDetails(env, order) {
  const out = safeOrder(order);
  const meta = orderMeta(order);
  if (order.kind === 'event') {
    const info = await eventOrderInfo(env, order);
    out.event = eventBrief(info.event);
    out.registration_status = info.registration ? info.registration.status : null;
    out.problem = info.problem;
  } else if (order.kind === 'membership') {
    const tier = tierByKey(meta.tier);
    out.membership = { tier: tier ? tier.key : meta.tier || null, tier_name: tier ? tier.name : 'Membership', reason: meta.reason || 'join' };
    if (order.status === 'paid' && (order.user_id || order.ref_id)) {
      const u = await first(env, `SELECT membership_expires, status FROM users WHERE id = ?`, order.user_id || order.ref_id);
      // The end date this payment gave (older orders did not record it: use the member's current one).
      if (u) { out.membership.expires = meta.expires || u.membership_expires; out.membership.status = u.status; }
    }
  } else if (order.kind === 'donation') {
    out.note = meta.note || '';
  }
  return out;
}

// ---------- Checkout ----------

// Sends the visitor to pay. Demo: our own /checkout page. Stripe: a hosted Checkout Session.
export async function startCheckout(env, request, order) {
  if (order.status !== 'pending') return { url: orderLinks(order)[order.status === 'paid' ? 'receipt' : 'checkout'] };
  if (!isStripeMode(env)) return { url: orderLinks(order).checkout };

  const origin = new URL(request.url).origin;
  const links = orderLinks(order);

  // Re-use an open Stripe session for this order (for example after pressing Back), so a person
  // cannot end up with two payment pages for the same order.
  if (order.provider_ref && order.provider_ref.startsWith('cs_')) {
    const existing = await stripeGetSession(env, order.provider_ref).catch(() => null);
    if (existing && existing.metadata && existing.metadata.order_id === order.id) {
      if (existing.status === 'open' && existing.url) return { url: existing.url };
      if (existing.status === 'complete' && existing.payment_status === 'paid') {
        await markOrderPaid(env, order.id, { provider: 'stripe', provider_ref: existing.id });
        return { url: links.receipt };
      }
    }
  }

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', order.currency || 'usd');
  form.set('line_items[0][price_data][unit_amount]', String(order.amount_cents));
  form.set('line_items[0][price_data][product_data][name]', order.description);
  form.set('customer_email', order.email);
  form.set('client_reference_id', order.id);
  form.set('metadata[order_id]', order.id);
  form.set('metadata[kind]', order.kind);
  form.set('payment_intent_data[metadata][order_id]', order.id);
  form.set('payment_intent_data[description]', `${ORG.short}: ${order.description}`.slice(0, 300));
  if (order.kind === 'donation') form.set('submit_type', 'donate');
  // {CHECKOUT_SESSION_ID} is filled in by Stripe.
  form.set('success_url', `${origin}${links.receipt}&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}${links.checkout}&cancelled=1`);

  let res;
  try {
    res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (err) {
    console.error('Stripe request failed', err);
    throw stripeDown();
  }
  const session = await res.json().catch(() => null);
  if (!res.ok || !session || !session.url) {
    console.error('Stripe refused the checkout session', res.status, session && session.error);
    throw stripeDown();
  }
  await run(env, `UPDATE orders SET provider = 'stripe', provider_ref = ? WHERE id = ? AND status = 'pending'`, session.id, order.id);
  return { url: session.url };
}

// Like startCheckout, but never fails: if Stripe cannot be reached, send people to our own
// checkout page, which explains the problem and offers to try again or pay by check.
export async function checkoutUrl(env, request, order) {
  try {
    return (await startCheckout(env, request, order)).url;
  } catch (err) {
    console.error('startCheckout failed, falling back to the checkout page', err && err.message);
    return orderLinks(order).checkout;
  }
}

const stripeDown = () => new HttpError(502,
  'We could not reach our payment service just now. Please try again in a minute, or choose to pay by check.');

export async function stripeGetSession(env, sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId || ''))) return null;
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Asks Stripe whether a pending order has been paid (used by the receipt page, in case the
// webhook has not arrived yet). Returns the up-to-date order.
export async function confirmWithStripe(env, order, sessionId) {
  if (order.status !== 'pending' || !isStripeMode(env)) return order;
  const id = sessionId || order.provider_ref;
  if (!id) return order;
  const session = await stripeGetSession(env, id).catch(() => null);
  if (session && session.metadata && session.metadata.order_id === order.id && session.payment_status === 'paid'
      && Number(session.amount_total) === Number(order.amount_cents)) {
    return markOrderPaid(env, order.id, { provider: 'stripe', provider_ref: session.id });
  }
  return order;
}

// ---------- Paid ----------

// Marks an order paid and runs its fulfilment exactly once (only the pending -> paid change does it,
// so calling this twice, or from both the webhook and the receipt page, is harmless).
export async function markOrderPaid(env, orderId, { provider = 'demo', provider_ref = null } = {}) {
  const res = await run(env,
    `UPDATE orders SET status = 'paid', paid_at = ?, provider = ?, provider_ref = COALESCE(?, provider_ref)
     WHERE id = ? AND status = 'pending'`,
    nowIso(), provider, provider_ref, orderId);
  const order = await first(env, `SELECT * FROM orders WHERE id = ?`, orderId);
  if (!order) throw new HttpError(404, 'We could not find that payment.');
  if (res.meta && res.meta.changes === 1) await fulfil(env, order);
  return order;
}

async function fulfil(env, order) {
  if (order.kind === 'membership') {
    const meta = orderMeta(order);
    const userId = order.user_id || order.ref_id;
    const user = userId ? await first(env, `SELECT id, tier, member_type, membership_expires FROM users WHERE id = ?`, userId) : null;
    if (!user) { console.error('Membership order paid for a missing user', order.id); return; }
    const tier = tierByKey(meta.tier) || tierByKey('member');
    const expires = nextExpiry(user.membership_expires);
    // One membership for everyone; member_type (professional / student / other) stays as the member chose.
    await run(env,
      `UPDATE users SET status = CASE WHEN status = 'suspended' THEN status ELSE 'active' END,
         tier = ?, membership_expires = ?, cancel_requested_at = NULL,
         show_public = CASE WHEN member_type = 'professional' THEN show_public ELSE 0 END
       WHERE id = ?`,
      tier.key, expires, user.id);
    // Keep the end date this payment gave on the order, so its receipt stays the same after later renewals.
    await run(env, `UPDATE orders SET meta = ? WHERE id = ?`, JSON.stringify({ ...meta, expires }), order.id);
  } else if (order.kind === 'event') {
    await run(env, `UPDATE registrations SET status = 'confirmed' WHERE order_id = ?`, order.id);
  }
  // donation: nothing else to do
}

const pad = (n) => String(n).padStart(2, '0');
export const todayYmd = () => new Date().toISOString().slice(0, 10);

// One year from the later of today and the current expiry date. YYYY-MM-DD.
export function nextExpiry(current, today = todayYmd()) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(current || '') && current > today ? current : today;
  const [y, m, d] = base.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y + 1, m, 0)).getUTCDate(); // Feb 29 -> Feb 28
  return `${y + 1}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
}

// ---------- Stripe webhook signature ----------

// Checks the Stripe-Signature header ("t=…,v1=…") against the raw request body.
// Returns true or false. tolerance is in seconds (Stripe recommends 5 minutes).
export async function verifyStripeSignature(payload, header, secret, { tolerance = 300, now = Date.now() } = {}) {
  if (!payload || !header || !secret) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of String(header).split(',')) {
    const [k, v] = part.split('=', 2).map((s) => (s || '').trim());
    if (k === 't') timestamp = v;
    else if (k === 'v1' && v) signatures.push(v.toLowerCase());
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > tolerance) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((sig) => sameText(sig, expected));
}

// Compares two strings in constant time (for tokens and signatures).
export function sameText(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
