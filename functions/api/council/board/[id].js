// POST /api/council/board/:id  { action: 'hide'|'unhide'|'delete', reason }
//   hide    members see only a short "hidden by the Council" note (no text, no author name, no reason);
//           the reason is kept for the Council's records; its reports are marked as handled
//   unhide  the post shows again
//   delete  removes the post for good (a topic is removed with all its replies)
import { json, readJson, validate, requireUser, HttpError } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';
import { idParam } from '../../../../lib/council.js';

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'post');
  const body = await readJson(request);
  const check = validate(body);
  const action = check.oneOf('action', ['hide', 'unhide', 'delete'], { label: 'what to do' });
  const reason = check.text('reason', { label: 'Reason', max: 500 });
  check.done();

  const post = await first(env, `SELECT id, parent_id FROM board_posts WHERE id = ?`, id);
  if (!post) throw new HttpError(404, 'We could not find that post. It may have been deleted already.');

  if (action === 'hide') {
    await run(env, `UPDATE board_posts SET hidden = 1, hidden_reason = ? WHERE id = ?`, reason, id);
    await run(env, `UPDATE board_reports SET resolved = 1 WHERE post_id = ? AND resolved = 0`, id);
    return json({ ok: true, message: 'Hidden. Members now see only a short note that the post was hidden, without its text or the author\'s name.' });
  }
  if (action === 'unhide') {
    await run(env, `UPDATE board_posts SET hidden = 0, hidden_reason = '' WHERE id = ?`, id);
    return json({ ok: true, message: 'The post is visible on the community board again.' });
  }
  // delete: a topic takes its replies with it
  const ids = `SELECT id FROM board_posts WHERE id = ?1 OR parent_id = ?1`;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM board_reports WHERE post_id IN (${ids})`).bind(id),
    env.DB.prepare(`DELETE FROM board_posts WHERE id = ?1 OR parent_id = ?1`).bind(id),
  ]);
  return json({ ok: true, message: post.parent_id ? 'The reply was deleted.' : 'The topic and all its replies were deleted.' });
}
