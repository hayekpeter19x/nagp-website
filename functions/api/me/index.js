// GET /api/me  -> { user }  the signed-in person's own profile (never the password hash)
// PUT /api/me  { name, city, state, credentials, training, specialties[], bio, website,
//               public_email, public_phone, show_public, show_members } -> { ok, user }
// Fields left out of the request are not changed. show_public, credentials and
// specialties only apply to professional members.
import { json, readJson, validate, requireUser, HttpError } from '../../../lib/http.js';
import { first, run } from '../../../lib/db.js';
import { ownProfile, joinSpecialties, isProfessional, REGION_CODES, SPECIALTY_KEYS, PHONE_RE } from '../../../lib/members.js';

export async function onRequestGet(context) {
  const user = requireUser(context, 'signed-in');
  return json({ user: ownProfile(user) });
}

export async function onRequestPut(context) {
  const user = requireUser(context, 'signed-in');
  const body = await readJson(context.request);
  const check = validate(body);
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const pro = isProfessional(user);
  const changes = {};

  if (has('name')) changes.name = check.text('name', { label: 'Your name', required: true, max: 120 });
  if (has('city')) changes.city = check.text('city', { label: 'City or town', max: 80 });
  if (has('state')) changes.state = check.oneOf('state', REGION_CODES, { label: 'a state or province from the list', required: false });
  // Same limit as the join form, so what someone wrote when joining can always be saved again.
  if (has('training')) changes.training = check.text('training', { label: 'Gestalt training', max: 1000, multiline: true });
  if (has('bio')) changes.bio = check.text('bio', { label: 'About you', max: 1500, multiline: true });
  if (has('website')) changes.website = check.url('website', { label: 'Website' });
  if (has('public_email')) changes.public_email = check.email('public_email', { label: 'Email shown in directories', required: false });
  if (has('public_phone')) {
    const phone = check.text('public_phone', { label: 'Phone shown in directories', max: 40 });
    if (phone && !PHONE_RE.test(phone)) check.fail('public_phone', 'Please check the phone number. Use numbers only, for example (555) 123-4567.');
    changes.public_phone = phone;
  }
  if (has('show_members')) changes.show_members = check.bool('show_members') ? 1 : 0;

  // Professional details and the public listing are for professional members only.
  if (pro) {
    if (has('credentials')) changes.credentials = check.text('credentials', { label: 'Credentials', max: 120 });
    if (has('specialties')) changes.specialties = joinSpecialties(check.list('specialties', SPECIALTY_KEYS));
    if (has('show_public')) changes.show_public = check.bool('show_public') ? 1 : 0;
  } else if (has('show_public') && check.bool('show_public')) {
    check.fail('show_public', 'The public directory is only for professional members.');
  }
  check.done();

  const keys = Object.keys(changes);
  if (keys.length) {
    await run(context.env, `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      ...keys.map((k) => changes[k]), user.id);
  }
  const fresh = await first(context.env, `SELECT * FROM users WHERE id = ?`, user.id);
  if (!fresh) throw new HttpError(404, 'We could not find your account.');
  return json({ ok: true, user: ownProfile(fresh) });
}
