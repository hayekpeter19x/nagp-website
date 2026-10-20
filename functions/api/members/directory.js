// GET /api/members/directory?state=&q=&type=  -> { members: [...], total }
// The members-only directory: every active member who chose to be listed
// (show_members = 1), including associate and student members.
import { json, requireUser } from '../../../lib/http.js';
import { all } from '../../../lib/db.js';
import { memberListing, keywordFilter, byLastName, LISTED_SQL, today, REGION_CODES, MEMBER_TYPES } from '../../../lib/members.js';

export async function onRequestGet(context) {
  requireUser(context, 'member');
  const url = new URL(context.request.url);
  const state = (url.searchParams.get('state') || '').toUpperCase();
  const type = url.searchParams.get('type') || '';
  const q = url.searchParams.get('q') || '';

  let sql = `SELECT * FROM users WHERE ${LISTED_SQL} AND show_members = 1`;
  const params = [today()];
  if (REGION_CODES.includes(state)) {
    sql += ` AND state = ?`;
    params.push(state);
  }
  if (MEMBER_TYPES.includes(type)) {
    sql += ` AND member_type = ?`;
    params.push(type);
  }
  const kw = keywordFilter(q, ['name', 'credentials', 'training', 'bio', 'city']);
  sql += kw.sql + ' LIMIT 2000';
  params.push(...kw.params);

  const rows = await all(context.env, sql, ...params);
  const members = rows.map(memberListing).sort(byLastName);
  return json({ members, total: members.length });
}
