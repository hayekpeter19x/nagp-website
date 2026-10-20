// GET    /api/council/documents/:id
// PUT    /api/council/documents/:id   save changes
// DELETE /api/council/documents/:id
import { json, readJson, requireUser, HttpError, nowIso } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';
import { DOCUMENT_COLUMNS, idParam, readDocumentForm } from '../../../../lib/council.js';

async function load(env, id) {
  const row = await first(env, `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`, id);
  if (!row) throw new HttpError(404, 'We could not find that document. It may have been deleted.');
  return { ...row, sample: !!row.sample };
}

export async function onRequestGet(context) {
  requireUser(context, 'council');
  return json({ document: await load(context.env, idParam(context, 'document')) });
}

export async function onRequestPut(context) {
  requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'document');
  await load(env, id);
  const doc = readDocumentForm(await readJson(request));
  await run(env,
    `UPDATE documents SET title = ?, category = ?, description = ?, url = ?, body = ?, doc_date = ?, visibility = ?, updated_at = ?
      WHERE id = ?`,
    doc.title, doc.category, doc.description, doc.url, doc.body, doc.doc_date, doc.visibility, nowIso(), id);
  return json({ ok: true, document: await load(env, id), message: `Saved. Your changes to "${doc.title}" are now on the site.` });
}

export async function onRequestDelete(context) {
  requireUser(context, 'council');
  const id = idParam(context, 'document');
  const doc = await load(context.env, id);
  await run(context.env, `DELETE FROM documents WHERE id = ?`, id);
  return json({ ok: true, message: `"${doc.title}" was deleted.` });
}
