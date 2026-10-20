// POST /api/contact  { name, email, topic, message }
// Saved for the Council to read in the Council area.
import { json, readJson, validate, nowIso } from '../../lib/http.js';
import { run } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body.hp) return json({ ok: true }); // spam trap
  const check = validate(body);
  const name = check.text('name', { label: 'Your name', required: true, max: 120 });
  const email = check.email('email');
  const topic = check.text('topic', { label: 'Topic', max: 80 });
  const message = check.text('message', { label: 'Your message', required: true, max: 5000, multiline: true });
  check.done();
  await run(env, `INSERT INTO messages (name, email, topic, message, created_at) VALUES (?, ?, ?, ?, ?)`, name, email, topic, message, nowIso());
  return json({ ok: true });
}
