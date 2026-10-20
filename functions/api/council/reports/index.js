// GET /api/council/reports — community board posts that members reported, grouped by post.
// Posts with open reports come first; recently handled ones and hidden posts follow.
import { json, requireUser } from '../../../../lib/http.js';
import { all } from '../../../../lib/db.js';

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env } = context;
  const reports = await all(env,
    `SELECT br.id, br.post_id, br.reason, br.resolved, br.created_at, u.name AS reporter_name
       FROM board_reports br
       LEFT JOIN users u ON u.id = br.reporter_id
      ORDER BY br.created_at DESC
      LIMIT 500`);
  // Posts that were reported, plus any post the Council has hidden.
  const posts = await all(env,
    `SELECT p.id, p.parent_id, p.title, p.body, p.author_id, p.author_name, p.hidden, p.hidden_reason, p.sample, p.created_at,
            t.title AS topic_title
       FROM board_posts p
       LEFT JOIN board_posts t ON t.id = p.parent_id
      WHERE p.id IN (SELECT post_id FROM board_reports) OR p.hidden = 1`);

  const byPost = new Map(posts.map((p) => [p.id, {
    id: p.id,
    topic_id: p.parent_id || p.id,
    is_reply: !!p.parent_id,
    title: p.parent_id ? p.topic_title || '' : p.title,
    body: p.body,
    author_name: p.author_name,
    hidden: !!p.hidden,
    hidden_reason: p.hidden_reason || '',
    sample: !!p.sample,
    created_at: p.created_at,
    reports: [],
    open_reports: 0,
    last_report_at: null,
  }]));
  for (const r of reports) {
    const post = byPost.get(r.post_id);
    if (!post) continue; // the post was deleted
    post.reports.push({ id: r.id, reason: r.reason || '', reporter_name: r.reporter_name || 'A member', resolved: !!r.resolved, created_at: r.created_at });
    if (!r.resolved) post.open_reports++;
    if (!post.last_report_at || r.created_at > post.last_report_at) post.last_report_at = r.created_at;
  }
  const list = [...byPost.values()].sort((a, b) =>
    (b.open_reports > 0) - (a.open_reports > 0) || String(b.last_report_at || b.created_at).localeCompare(String(a.last_report_at || a.created_at)));
  return json({ posts: list, open: list.filter((p) => p.open_reports > 0).length });
}
