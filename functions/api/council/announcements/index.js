// GET /api/council/announcements?status=pending|approved|declined
// Waiting items are listed oldest first (a to-do list); the others newest first.
import { json, requireUser } from '../../../../lib/http.js';
import { all } from '../../../../lib/db.js';

const STATUSES = ['pending', 'approved', 'declined'];

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const asked = new URL(request.url).searchParams.get('status');
  const status = STATUSES.includes(asked) ? asked : 'pending';
  const order = status === 'pending' ? 'a.created_at ASC' : 'COALESCE(a.reviewed_at, a.published_at, a.created_at) DESC';

  const rows = await all(env,
    `SELECT a.id, a.title, a.body, a.category, a.visibility, a.status, a.author_id, a.author_name, a.from_council,
            a.link_url, a.decline_reason, a.reviewed_at, a.sample, a.created_at, a.published_at,
            u.email AS author_email, r.name AS reviewed_by_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN users r ON r.id = a.reviewed_by
      WHERE a.status = ?
      ORDER BY ${order}
      LIMIT 300`, status);

  const counts = { pending: 0, approved: 0, declined: 0 };
  for (const r of await all(env, `SELECT status, COUNT(*) AS n FROM announcements GROUP BY status`)) {
    if (r.status in counts) counts[r.status] = r.n;
  }

  return json({
    status,
    counts,
    announcements: rows.map((r) => ({ ...r, from_council: !!r.from_council, sample: !!r.sample })),
  });
}
