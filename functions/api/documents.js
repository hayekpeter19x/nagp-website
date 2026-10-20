// GET /api/documents?category= -> { documents: [...] }
// Filtered by who is asking: public documents for everyone, members-only ones for
// active members, Council-only ones for the Council. Newest first.
import { json, isActiveMember, isCouncil } from '../../lib/http.js';
import { all } from '../../lib/db.js';
import { DOCUMENT_CATEGORIES } from '../../lib/config.js';

export async function onRequestGet({ request, env, data }) {
  const user = data.user;
  const levels = ['public'];
  if (isActiveMember(user)) levels.push('members');
  if (isCouncil(user)) levels.push('council');

  const category = new URL(request.url).searchParams.get('category') || '';
  let sql = `SELECT id, title, category, description, url, body, doc_date, visibility, sample, created_at, updated_at
             FROM documents WHERE visibility IN (${levels.map(() => '?').join(', ')})`;
  const params = [...levels];
  if (DOCUMENT_CATEGORIES.includes(category)) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  sql += ` ORDER BY COALESCE(doc_date, created_at) DESC, id DESC LIMIT 500`;
  const rows = await all(env, sql, ...params);
  return json({ documents: rows.map((d) => ({ ...d, url: d.url || '', body: d.body || '', description: d.description || '', sample: !!d.sample })) });
}
