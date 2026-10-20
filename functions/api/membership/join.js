// POST /api/membership/join
// { tier, name, email, password, password_confirm, city, state,
//   credentials, training, specialties[], show_public   (Professional members only)
//   agree }
// Creates the account (status 'pending' until paid) and a membership order, signs the person in,
// and returns { checkout_url, order_id }.
import { json, readJson, validate, HttpError, nowIso } from '../../../lib/http.js';
import { first, run } from '../../../lib/db.js';
import { hashPassword, checkPasswordStrength, createSession } from '../../../lib/auth.js';
import { MEMBERSHIP_TIERS, SPECIALTIES, REGIONS, tierByKey } from '../../../lib/config.js';
import { createOrder, checkoutUrl } from '../../../lib/payments.js';

const EXISTS = 'An account with this email already exists. Please sign in.';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (body.hp) return json({ checkout_url: '/' }); // spam trap

  if (data.user) {
    throw new HttpError(409, `You are already signed in as ${data.user.name}. To pay for or renew your membership, please go to My Payments in the Members' Area.`);
  }

  const check = validate(body);
  const tierKey = check.oneOf('tier', MEMBERSHIP_TIERS.map((t) => t.key), { label: 'a type of membership' });
  const tier = tierByKey(tierKey);
  const name = check.text('name', { label: 'Your full name', required: true, max: 120 });
  const email = check.email('email');
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.password_confirm === 'string' ? body.password_confirm : '';
  const weak = checkPasswordStrength(password);
  if (weak) check.fail('password', weak);
  else if (password !== confirm) check.fail('password_confirm', 'The two passwords are not the same. Please type the same password in both boxes.');
  const city = check.text('city', { label: 'Your city or town', required: true, max: 80 });
  const state = check.oneOf('state', REGIONS.map((r) => r.code), { label: 'your state or province' });

  let credentials = '';
  let training = '';
  let specialties = [];
  let showPublic = false;
  if (tier && tier.professional) {
    credentials = check.text('credentials', { label: 'Your credentials', required: true, max: 120 });
    training = check.text('training', { label: 'Your training', required: true, max: 1000, multiline: true });
    if (!training && check.fields.training) check.fields.training = 'Please describe your Gestalt training.';
    specialties = check.list('specialties', SPECIALTIES.map((s) => s.key));
    if (!specialties.length) check.fail('specialties', 'Please choose at least one area of practice.');
    showPublic = check.bool('show_public');
  }
  if (!check.bool('agree')) check.fail('agree', 'Please read the community guidelines and tick the box to agree.');

  if (email && !check.fields.email) {
    const existing = await first(env, `SELECT id FROM users WHERE email = ?`, email);
    if (existing) check.fail('email', EXISTS);
  }
  check.done();

  const passwordHash = await hashPassword(password);
  let userId;
  try {
    const res = await run(env,
      `INSERT INTO users (email, password_hash, name, role, status, tier, member_type, city, state,
         credentials, training, specialties, show_public, show_members, sample, created_at)
       VALUES (?, ?, ?, 'member', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      email, passwordHash, name, tier.key, tier.key, city, state, credentials, training, specialties.join(','),
      showPublic ? 1 : 0, nowIso());
    userId = res.meta.last_row_id;
  } catch (err) {
    if (/UNIQUE/i.test(String(err && err.message))) throw new HttpError(400, 'Please check the highlighted fields.', { email: EXISTS });
    throw err;
  }

  const order = await createOrder(env, {
    kind: 'membership',
    ref_id: userId,
    description: `${tier.name}, one year`,
    amount_cents: tier.price_cents,
    user_id: userId,
    name,
    email,
    meta: { tier: tier.key, reason: 'join' },
  });
  const cookie = await createSession(env, request, userId);
  const url = await checkoutUrl(env, request, order);
  return json({ checkout_url: url, order_id: order.id }, { headers: { 'set-cookie': cookie } });
}
