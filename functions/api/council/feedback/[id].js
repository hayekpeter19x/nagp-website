// POST /api/council/feedback/:id  { resolved: true|false }
import { json, readJson, validate, requireUser, HttpError } from '../../../../lib/http.js';
import { run } from '../../../../lib/db.js';
import { idParam } from '../../../../lib/council.js';

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const id = idParam(context, 'comment');
  const body = await readJson(context.request);
  const resolved = validate(body).bool('resolved');
  const res = await run(context.env, `UPDATE feedback SET resolved = ? WHERE id = ?`, resolved ? 1 : 0, id);
  if (!res.meta.changes) throw new HttpError(404, 'We could not find that comment.');
  return json({ ok: true, resolved });
}
