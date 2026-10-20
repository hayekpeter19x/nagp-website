// GET  /api/council/documents   every document, whoever may see it
// POST /api/council/documents   add a document (a link, pasted text, or both)
import { json, readJson, requireUser, nowIso } from '../../../../lib/http.js';
import { all, first, run } from '../../../../lib/db.js';
import { DOCUMENT_COLUMNS, readDocumentForm } from '../../../../lib/council.js';

const toDoc = (d) => ({ ...d, sample: !!d.sample });

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const rows = await all(context.env,
    `SELECT ${DOCUMENT_COLUMNS} FROM documents ORDER BY category, COALESCE(doc_date, substr(created_at, 1, 10)) DESC, id DESC`);
  return json({ documents: rows.map(toDoc) });
}

export async function onRequestPost(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const doc = readDocumentForm(await readJson(request));
  const now = nowIso();
  const res = await run(env,
    `INSERT INTO documents (title, category, description, url, body, doc_date, visibility, sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    doc.title, doc.category, doc.description, doc.url, doc.body, doc.doc_date, doc.visibility, now, now);
  const row = await first(env, `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`, res.meta.last_row_id);
  return json({ ok: true, document: toDoc(row), message: `"${doc.title}" was added.` }, { status: 201 });
}
