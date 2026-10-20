// GET  /api/council/members?q=&status=&role=&format=csv   everyone with an account
// POST /api/council/members                              add a member by hand (for example someone who paid by check)
import { json, readJson, validate, requireUser, HttpError, nowIso } from '../../../../lib/http.js';
import { all, first, run, likeContains } from '../../../../lib/db.js';
import { hashPassword, checkPasswordStrength } from '../../../../lib/auth.js';
import { MEMBERSHIP_TIERS, REGIONS, regionName, tierByKey } from '../../../../lib/config.js';
import {
  csvResponse, wantsCsv, dateField, EXPIRED_SQL, dollarsField, memberTypeFor, memberRow, recordManualPayment, longDate, orderRow, theirEmail, MEMBER_COLUMNS, STATUS_LABELS, ROLE_LABELS,
} from '../../../../lib/council.js';

const STATUSES = ['pending', 'active', 'lapsed', 'suspended'];

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const params = new URL(request.url).searchParams;
  const where = [];
  const args = [];
  const q = (params.get('q') || '').trim().slice(0, 100);
  if (q) {
    const like = likeContains(q.toLowerCase());
    where.push(`(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(email) LIKE ? ESCAPE '\\' OR LOWER(city) LIKE ? ESCAPE '\\')`);
    args.push(like, like, like);
  }
  const status = params.get('status');
  if (status === 'expired') where.push(EXPIRED_SQL);
  else if (status === 'active') where.push(`status = 'active' AND NOT ${EXPIRED_SQL}`);
  else if (STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
  const role = params.get('role');
  if (role === 'council') where.push(`role IN ('council', 'admin')`);
  else if (role === 'member') where.push(`role = 'member'`);
  const tier = params.get('tier');
  if (MEMBERSHIP_TIERS.some((t) => t.key === tier)) { where.push('tier = ?'); args.push(tier); }

  const rows = await all(env,
    `SELECT ${MEMBER_COLUMNS} FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE`, ...args);
  const members = rows.map(memberRow);

  if (wantsCsv(request)) {
    return csvResponse('nagp-members',
      ['Name', 'Email', 'Membership', 'Status', 'Active until', 'Role', 'City', 'State or province', 'Credentials',
        'In public directory', 'In members directory', 'Joined', 'Last signed in'],
      members.map((m) => [m.name, m.email, tierByKey(m.tier)?.name || m.member_type, STATUS_LABELS[m.expired ? 'expired' : m.status] || m.status,
        m.membership_expires, ROLE_LABELS[m.role] || m.role, m.city, regionName(m.state), m.credentials,
        m.show_public, m.show_members, (m.created_at || '').slice(0, 10), (m.last_login || '').slice(0, 10)]));
  }

  const counts = { all: 0, pending: 0, active: 0, expired: 0, lapsed: 0, suspended: 0 };
  for (const r of await all(env, `SELECT CASE WHEN ${EXPIRED_SQL} THEN 'expired' ELSE status END AS s, COUNT(*) AS n FROM users GROUP BY s`)) {
    counts.all += r.n;
    if (r.s in counts) counts[r.s] = r.n;
  }
  return json({ members, counts });
}

export async function onRequestPost(context) {
  const council = requireUser(context, 'council');
  const { env, request } = context;
  const body = await readJson(request);
  const check = validate(body);
  const name = check.text('name', { label: 'Their full name', required: true, max: 120 });
  const email = theirEmail(check);
  const tier = check.oneOf('tier', MEMBERSHIP_TIERS.map((t) => t.key), { label: 'a membership type' });
  const state = check.oneOf('state', REGIONS.map((r) => r.code), { label: 'a state or province', required: false });
  const city = check.text('city', { label: 'City', max: 80 });
  const password = typeof body.password === 'string' ? body.password : '';
  const weak = checkPasswordStrength(password);
  if (weak) check.fail('password', weak.replace('Please choose a password', 'Please choose a temporary password'));
  const recordPayment = check.bool('record_payment');
  let amountCents = 0;
  let method = 'check';
  let note = '';
  let expires = '';
  if (recordPayment) {
    amountCents = dollarsField(check, body, 'amount', { label: 'The amount received', required: true });
    method = check.oneOf('method', ['check', 'cash'], { label: 'how they paid' });
    note = check.text('note', { label: 'Note', max: 500 });
  } else {
    expires = dateField(check, body, 'membership_expires', { label: 'the date their membership ends' });
  }
  check.done();

  const existing = await first(env, `SELECT id, name FROM users WHERE email = ?`, email);
  if (existing) {
    throw new HttpError(409, `There is already an account for ${email} (${existing.name}). Find them in the list and choose "Edit" to update their membership.`,
      { email: 'This email address already has an account.' });
  }

  const memberType = memberTypeFor(tier);
  const hash = await hashPassword(password);
  // With a payment, the account starts as "waiting for payment" and recording the payment
  // activates it for one year. Without one, it is active straight away.
  const status = recordPayment ? 'pending' : 'active';
  if (!recordPayment && !expires) {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    expires = d.toISOString().slice(0, 10);
  }
  const res = await run(env,
    `INSERT INTO users (email, password_hash, name, role, status, tier, member_type, membership_expires, city, state,
       show_public, show_members, sample, created_at)
     VALUES (?, ?, ?, 'member', ?, ?, ?, ?, ?, ?, 0, 1, 0, ?)`,
    email, hash, name, status, tier, memberType, recordPayment ? null : expires, city, state || '', nowIso());
  const userId = res.meta.last_row_id;

  let payment = null;
  if (recordPayment) {
    payment = await recordManualPayment(env, council, {
      kind: 'membership', tier, user: { id: userId, name, email }, amountCents, method, note,
    });
  }
  const user = await first(env, `SELECT ${MEMBER_COLUMNS} FROM users WHERE id = ?`, userId);
  const until = user.membership_expires ? ` Their membership is active until ${longDate(user.membership_expires)}.` : '';
  return json({
    ok: true,
    member: memberRow(user),
    order: payment ? orderRow(payment.order) : null,
    message: `${name} was added.${until} They can sign in with ${email} and the temporary password you chose.`
      + (payment ? ' The payment was recorded on the Payments page.' : ''),
  }, { status: 201 });
}

