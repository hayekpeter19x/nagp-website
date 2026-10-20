// POST /api/council/messages/:id  { handled: true|false }
import { json, readJson, validate, requireUser, HttpError } from '../../../../lib/http.js';
import { run } from '../../../../lib/db.js';
import { idParam } from '../../../../lib/council.js';

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const id = idParam(context, 'message');
  const body = await readJson(context.request);
  const handled = validate(body).bool('handled');
  const res = await run(context.env, `UPDATE messages SET handled = ? WHERE id = ?`, handled ? 1 : 0, id);
  if (!res.meta.changes) throw new HttpError(404, 'We could not find that message.');
  return json({ ok: true, handled });
}
