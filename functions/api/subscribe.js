// POST /api/subscribe  { first_name, last_name, email, source, interest }
// "Stay connected" mailing-list sign-ups. The Council exports these to the Google Group.
import { json, readJson, validate, nowIso } from '../../lib/http.js';
import { run } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body.hp) return json({ ok: true }); // spam trap
  const check = validate(body);
  const first_name = check.text('first_name', { label: 'First name', max: 80 });
  const last_name = check.text('last_name', { label: 'Last name', max: 80 });
  const email = check.email('email');
  const source = check.text('source', { max: 40 });
  const interest = check.text('interest', { max: 40 });
  check.done();
  await run(env,
    `INSERT INTO subscribers (email, first_name, last_name, source, interest, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       first_name = COALESCE(NULLIF(excluded.first_name, ''), first_name),
       last_name = COALESCE(NULLIF(excluded.last_name, ''), last_name),
       interest = CASE WHEN excluded.interest != '' THEN excluded.interest ELSE interest END`,
    email, first_name, last_name, source, interest, nowIso());
  return json({ ok: true });
}
