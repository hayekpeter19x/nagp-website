// GET /api/council/feedback — "Comment on this page" notes left during the preview.
import { json, requireUser } from '../../../../lib/http.js';
import { all } from '../../../../lib/db.js';

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const rows = await all(context.env,
    `SELECT id, page, name, comment, resolved, created_at FROM feedback ORDER BY created_at DESC, id DESC LIMIT 1000`);
  const feedback = rows.map((r) => ({ ...r, resolved: !!r.resolved }));
  return json({ feedback, open: feedback.filter((f) => !f.resolved).length });
}
