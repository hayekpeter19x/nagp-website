// DELETE /api/council/subscribers/:id — remove someone who asked to be taken off the mailing list.
import { json, requireUser, HttpError } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';
import { idParam } from '../../../../lib/council.js';

export async function onRequestDelete(context) {
  requireUser(context, 'council');
  const id = idParam(context, 'sign-up');
  const row = await first(context.env, `SELECT email FROM subscribers WHERE id = ?`, id);
  if (!row) throw new HttpError(404, 'We could not find that sign-up. It may have been removed already.');
  await run(context.env, `DELETE FROM subscribers WHERE id = ?`, id);
  return json({ ok: true, message: `${row.email} was removed from the mailing list sign-ups.` });
}
