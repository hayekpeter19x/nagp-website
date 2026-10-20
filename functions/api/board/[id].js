// GET /api/board/:id -> { topic, replies }
// Hidden posts show "hidden by the Council" to members; the Council also sees the text,
// the hidden flag and reason, and the number of reports.
import { json, requireUser, HttpError } from '../../../lib/http.js';
import { all, first } from '../../../lib/db.js';
import { postOut } from '../../../lib/members.js';

export async function onRequestGet(context) {
  const user = requireUser(context, 'member');
  const id = Number(context.params.id);
  const notFound = new HttpError(404, 'We could not find that topic. It may have been removed.');
  if (!Number.isInteger(id) || id < 1) throw notFound;

  const topic = await first(context.env, `SELECT * FROM board_posts WHERE id = ? AND parent_id IS NULL`, id);
  if (!topic) throw notFound;
  const replies = await all(context.env,
    `SELECT * FROM board_posts WHERE parent_id = ? ORDER BY created_at ASC, id ASC LIMIT 1000`, id);

  const mine = await all(context.env,
    `SELECT post_id FROM board_reports WHERE reporter_id = ?
       AND post_id IN (SELECT id FROM board_posts WHERE id = ? OR parent_id = ?)`, user.id, id, id);
  const reported = new Set(mine.map((r) => r.post_id));

  return json({
    topic: postOut(topic, user, { reportedByMe: reported.has(topic.id) }),
    replies: replies.map((r) => postOut(r, user, { reportedByMe: reported.has(r.id) })),
  });
}
