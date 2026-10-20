// POST /api/council/reports/:id/resolve — "Keep this post": the Council looked at it and it can stay.
// The decision is about the post, so every open report on the same post is marked as handled.
import { json, requireUser, HttpError } from '../../../../../lib/http.js';
import { first, run } from '../../../../../lib/db.js';
import { idParam } from '../../../../../lib/council.js';

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const { env } = context;
  const id = idParam(context, 'report');
  const report = await first(env, `SELECT id, post_id FROM board_reports WHERE id = ?`, id);
  if (!report) throw new HttpError(404, 'We could not find that report. It may have been handled already.');
  const res = await run(env, `UPDATE board_reports SET resolved = 1 WHERE post_id = ? AND resolved = 0`, report.post_id);
  return json({ ok: true, resolved: res.meta.changes || 0, message: 'Done. The post stays on the board and the report is marked as handled.' });
}
