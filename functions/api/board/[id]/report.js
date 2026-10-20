// POST /api/board/:id/report  { reason } -> { ok }
// :id is a topic or a reply. Saves a report for the Council and counts it on the post.
// Each member can report a post only once.
import { json, readJson, validate, requireUser, HttpError, nowIso } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';

export async function onRequestPost(context) {
  const user = requireUser(context, 'member');
  const id = Number(context.params.id);
  const notFound = new HttpError(404, 'We could not find that post. It may have been removed.');
  if (!Number.isInteger(id) || id < 1) throw notFound;
  const post = await first(context.env, `SELECT id, author_id, hidden FROM board_posts WHERE id = ?`, id);
  if (!post) throw notFound;
  if (post.author_id === user.id) {
    throw new HttpError(400, 'This is your own post. If you would like it changed or removed, please contact the Council.');
  }
  if (post.hidden) throw new HttpError(400, 'The Council has already hidden this post.');

  const body = await readJson(context.request);
  const check = validate(body);
  const reason = check.text('reason', { label: 'The reason', max: 1000, multiline: true });
  check.done();

  // Insert only if this member has not reported this post before (safe even if clicked twice).
  const res = await run(context.env,
    `INSERT INTO board_reports (post_id, reporter_id, reason, created_at)
     SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM board_reports WHERE post_id = ? AND reporter_id = ?)`,
    id, user.id, reason, nowIso(), id, user.id);
  if (!res.meta.changes) {
    throw new HttpError(409, 'You have already reported this post. Thank you. The Council will look at it.');
  }
  await run(context.env, `UPDATE board_posts SET reports = reports + 1 WHERE id = ?`, id);
  return json({ ok: true });
}
