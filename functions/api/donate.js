// POST /api/donate  { amount_cents, name, email, note }  -> { checkout_url, order_id }
// The donor chooses the amount, so it is checked to be a sensible whole number of cents.
import { json, readJson, validate } from '../../lib/http.js';
import { createOrder, checkoutUrl } from '../../lib/payments.js';

const MIN_DONATION_CENTS = 500;       // $5
const MAX_DONATION_CENTS = 2_500_000; // $25,000

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (body.hp) return json({ checkout_url: '/' }); // spam trap
  const check = validate(body);
  const amount = check.int('amount_cents', { label: 'The amount', required: true, min: MIN_DONATION_CENTS, max: MAX_DONATION_CENTS });
  if (check.fields.amount_cents) {
    check.fields.amount_cents = `Please choose an amount between $${MIN_DONATION_CENTS / 100} and $${(MAX_DONATION_CENTS / 100).toLocaleString('en-US')}, in whole dollars or dollars and cents.`;
  }
  const name = check.text('name', { label: 'Your name', required: true, max: 120 });
  const email = check.email('email');
  const note = check.text('note', { label: 'Your note', max: 1000, multiline: true });
  check.done();

  const order = await createOrder(env, {
    kind: 'donation',
    ref_id: null,
    description: 'Donation to NAGP',
    amount_cents: amount,
    user_id: data.user ? data.user.id : null,
    name,
    email,
    meta: note ? { note } : {},
  });
  return json({ checkout_url: await checkoutUrl(env, request, order), order_id: order.id });
}
