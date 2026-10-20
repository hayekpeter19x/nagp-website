// GET /api/directory?specialty=&state=&q=  -> { practitioners: [...], total }
// The public "Find a Practitioner" directory: only active PROFESSIONAL members
// who chose to be listed (show_public = 1). Only public fields are returned.
import { json } from '../../lib/http.js';
import { all } from '../../lib/db.js';
import { publicListing, keywordFilter, byLastName, LISTED_SQL, today, SPECIALTY_KEYS, REGION_CODES } from '../../lib/members.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const specialty = url.searchParams.get('specialty') || '';
  const state = (url.searchParams.get('state') || '').toUpperCase();
  const q = url.searchParams.get('q') || '';

  let sql = `SELECT * FROM users WHERE ${LISTED_SQL} AND member_type = 'professional' AND show_public = 1`;
  const params = [today()];
  if (SPECIALTY_KEYS.includes(specialty)) {
    sql += ` AND (',' || specialties || ',') LIKE ?`;
    params.push('%,' + specialty + ',%');
  }
  if (REGION_CODES.includes(state)) {
    sql += ` AND state = ?`;
    params.push(state);
  }
  const kw = keywordFilter(q, ['name', 'credentials', 'training', 'bio', 'city']);
  sql += kw.sql + ' LIMIT 1000';
  params.push(...kw.params);

  const rows = await all(env, sql, ...params);
  const practitioners = rows.map(publicListing).sort(byLastName);
  return json({ practitioners, total: practitioners.length });
}
