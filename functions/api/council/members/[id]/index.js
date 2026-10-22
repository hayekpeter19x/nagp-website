// GET   /api/council/members/:id   one member
// PATCH /api/council/members/:id   change status, role, member_type, active-until date, directory listings, name, email...
// Only the fields that are sent are changed.
import { json, readJson, validate, requireUser, HttpError } from '../../../../../lib/http.js';
import { first, run } from '../../../../../lib/db.js';
import { MEMBER_TYPES, REGIONS } from '../../../../../lib/config.js';
import { idParam, dateField, memberRow, theirEmail, MEMBER_COLUMNS } from '../../../../../lib/council.js';

async function load(env, id) {
  const u = await first(env, `SELECT ${MEMBER_COLUMNS} FROM users WHERE id = ?`, id);
  if (!u) throw new HttpError(404, 'We could not find that member.');
  return u;
}

export async function onRequestGet(context) {
  requireUser(context, 'council');
  return json({ member: memberRow(await load(context.env, idParam(context, 'member'))) });
}

export async function onRequestPatch(context) {
  const me = requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'member');
  const current = await load(env, id);
  const body = await readJson(request);
  const check = validate(body);
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const set = {};

  if (has('name')) set.name = check.text('name', { label: 'Their name', required: true, max: 120 });
  if (has('email')) set.email = theirEmail(check);
  if (has('status')) set.status = check.oneOf('status', ['pending', 'active', 'lapsed', 'suspended'], { label: 'a membership status' });
  if (has('role')) {
    const roles = current.role === 'admin' ? ['member', 'council', 'admin'] : ['member', 'council'];
    set.role = check.oneOf('role', roles, { label: 'a role' });
  }
  if (has('member_type')) {
    set.member_type = check.oneOf('member_type', MEMBER_TYPES.map((t) => t.key), { label: 'what best describes them' });
  }
  if (has('membership_expires')) set.membership_expires = dateField(check, body, 'membership_expires', { label: 'the date their membership ends' }) || null;
  if (has('city')) set.city = check.text('city', { label: 'City', max: 80 });
  if (has('state')) set.state = check.oneOf('state', REGIONS.map((r) => r.code), { label: 'a state or province', required: false }) || '';
  if (has('show_public')) set.show_public = check.bool('show_public') ? 1 : 0;
  if (has('show_members')) set.show_members = check.bool('show_members') ? 1 : 0;

  // A Council member may not lock themselves out.
  if (id === me.id) {
    if (set.role && set.role !== current.role && current.role !== 'member') {
      check.fail('role', 'You cannot remove your own Council role. Please ask another Council member to do this.');
    }
    if (set.status && set.status !== 'active' && set.status !== current.status) {
      check.fail('status', 'You cannot suspend yourself or end your own membership here. Please ask another Council member.');
    }
  }
  // The public directory is for professional members only.
  const memberType = set.member_type || current.member_type;
  if (set.show_public === 1 && memberType !== 'professional') {
    check.fail('show_public', 'Only practicing professionals can be listed in the Public Directory.');
  }
  if (set.member_type && set.member_type !== 'professional') set.show_public = 0;
  check.done();

  if (set.email && set.email !== current.email) {
    const taken = await first(env, `SELECT id, name FROM users WHERE email = ? AND id != ?`, set.email, id);
    if (taken) throw new HttpError(409, `Another account already uses ${set.email} (${taken.name}).`, { email: 'This email address already has an account.' });
  }

  const keys = Object.keys(set);
  if (!keys.length) return json({ ok: true, member: memberRow(current), message: 'Nothing was changed.' });
  await run(env, `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => set[k]), id);
  // Someone who is suspended is signed out everywhere at once.
  if (set.status === 'suspended') await run(env, `DELETE FROM sessions WHERE user_id = ?`, id);

  const updated = await load(env, id);
  return json({ ok: true, member: memberRow(updated), message: `Saved. ${updated.name}'s details are updated.` });
}
