// POST /api/feedback  { page, name, comment } — preview-only "comment on this page" button.
// (The Council area lists these at /api/council/feedback.)
import { json, readJson, validate, nowIso } from '../../lib/http.js';
import { run } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body.hp) return json({ ok: true }); // spam trap
  const check = validate(body);
  const page = check.text('page', { label: 'Page', max: 300 }) || '/';
  const name = check.text('name', { label: 'Your name', max: 100 });
  const comment = check.text('comment', { label: 'Your comment', required: true, max: 4000, multiline: true });
  check.done();
  await run(env, `INSERT INTO feedback (page, name, comment, created_at) VALUES (?, ?, ?, ?)`, page, name, comment, nowIso());
  return json({ ok: true });
}
