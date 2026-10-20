// GET  /api/council/orders              every payment, newest first, with totals (?format=csv for a spreadsheet)
// POST /api/council/orders              record a payment received by check or cash
//   { person: 'member'|'other', user_id, name, email, kind: 'membership'|'event'|'donation',
//     tier, event_id, amount (dollars), method: 'check'|'cash', note }
import { json, readJson, validate, requireUser, HttpError } from '../../../lib/http.js';
import { all, first } from '../../../lib/db.js';
import { MEMBERSHIP_TIERS } from '../../../lib/config.js';
import { csvResponse, wantsCsv, dollarsField, orderRow, recordManualPayment, dollars, theirEmail, PROVIDER_LABELS } from '../../../lib/council.js';

const STATUS_TEXT = { paid: 'Paid', pending: 'Not completed', cancelled: 'Cancelled', refunded: 'Refunded' };
const KIND_TEXT = { membership: 'Membership', event: 'Event', donation: 'Donation' };

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const rows = await all(env, `SELECT * FROM orders ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 2000`);
  const orders = rows.map(orderRow);

  if (wantsCsv(request)) {
    return csvResponse('nagp-payments',
      ['Date', 'Name', 'Email', 'What for', 'Type', 'Amount (USD)', 'Status', 'Method', 'Note', 'Recorded by', 'Reference'],
      orders.map((o) => [(o.paid_at || o.created_at).slice(0, 10), o.name, o.email, o.description, KIND_TEXT[o.kind] || o.kind,
        dollars(o.amount_cents), STATUS_TEXT[o.status] || o.status,
        o.provider === 'manual' ? (o.method === 'cash' ? 'Cash' : 'Check') : PROVIDER_LABELS[o.provider] || o.provider,
        o.council_note, o.recorded_by, o.id]));
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  const totals = { month_cents: 0, month_count: 0, year_cents: 0, year_count: 0, all_cents: 0, all_count: 0 };
  for (const o of orders) {
    if (o.status !== 'paid' || !o.paid_at) continue;
    totals.all_cents += o.amount_cents; totals.all_count++;
    if (o.paid_at >= yearStart) { totals.year_cents += o.amount_cents; totals.year_count++; }
    if (o.paid_at >= monthStart) { totals.month_cents += o.amount_cents; totals.month_count++; }
  }
  return json({ orders, totals, preview_payments: !env.STRIPE_SECRET_KEY });
}

export async function onRequestPost(context) {
  const council = requireUser(context, 'council');
  const { env, request } = context;
  const body = await readJson(request);
  const check = validate(body);
  const person = check.oneOf('person', ['member', 'other'], { label: 'who paid' });
  const kind = check.oneOf('kind', ['membership', 'event', 'donation'], { label: 'what the payment was for' });
  const tier = kind === 'membership' ? check.oneOf('tier', MEMBERSHIP_TIERS.map((t) => t.key), { label: 'a membership type' }) : '';
  const eventId = kind === 'event' ? check.int('event_id', { label: 'The event', required: true, min: 1 }) : null;
  if (kind === 'event' && check.fields.event_id) check.fields.event_id = 'Please choose the event.';
  const amountCents = dollarsField(check, body, 'amount', { label: 'The amount received', required: true });
  const method = check.oneOf('method', ['check', 'cash'], { label: 'how they paid' });
  const note = check.text('note', { label: 'Note', max: 500 });

  let user = null;
  let name = '';
  let email = '';
  if (person === 'member') {
    const userId = check.int('user_id', { label: 'The member', required: true, min: 1 });
    if (check.fields.user_id) check.fields.user_id = 'Please choose the member from the list.';
    check.done();
    user = await first(env, `SELECT id, name, email FROM users WHERE id = ?`, userId);
    if (!user) throw new HttpError(404, 'We could not find that member.', { user_id: 'Please choose the member from the list.' });
  } else {
    name = check.text('name', { label: 'Their name', required: true, max: 120 });
    email = theirEmail(check);
    check.done();
    // Someone with an account who was typed in by hand: use their account.
    user = await first(env, `SELECT id, name, email FROM users WHERE email = ?`, email);
    if (!user && kind === 'membership') {
      throw new HttpError(400, `There is no member account for ${email} yet. Please go to the Members page and choose "Add a member by hand". You can record their payment there at the same time.`,
        { email: 'No member account uses this email address yet.' });
    }
  }
  check.done();

  const { order } = await recordManualPayment(env, council, { kind, user, name, email, tier, eventId, amountCents, method, note });
  let message = `The payment of $${dollars(order.amount_cents)} from ${order.name} was recorded.`;
  if (kind === 'membership') {
    const u = await first(env, `SELECT status, membership_expires FROM users WHERE id = ?`, user.id);
    message += u.status === 'active'
      ? ` Their membership is active until ${u.membership_expires}.`
      : ' Their account is suspended, so it was not switched on. Change their status on the Members page if they should have access.';
  } else if (kind === 'event') {
    message += ' They are registered for the event.';
  }
  return json({ ok: true, order: orderRow(order), message }, { status: 201 });
}
