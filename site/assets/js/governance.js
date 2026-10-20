// Governance page: public documents (bylaws, incorporation...) grouped by category.
// Members' minutes live on /members/documents and Council notes in the Council area,
// so this page only lists documents marked "public", even for signed-in visitors.
(function () {
  const { $, api, html } = NAGP;
  const box = $('#documents-list');
  if (!box) return;

  const ORDER = NAGP.config.DOCUMENT_CATEGORIES || [];
  const safeUrl = (u) => (/^(https?:\/\/|\/(?!\/))/i.test(String(u || '').trim()) ? String(u).trim() : '');

  const empty = () => html`<div class="empty">
    <p><strong>Documents will be posted here.</strong></p>
    <p class="mb-0">The bylaws, articles of incorporation and other official documents will appear here once the Council publishes them.</p>
  </div>`;

  const docItem = (d) => {
    const url = safeUrl(d.url);
    const external = /^https?:/i.test(url);
    return html`<li class="card card-flat">
      <h4>${d.title} ${NAGP.sampleBadge(d)}</h4>
      ${d.doc_date ? html`<p class="meta">Dated ${NAGP.formatShortDate(d.doc_date)}</p>` : ''}
      ${d.description ? html`<p>${d.description}</p>` : ''}
      ${url ? html`<p class="mb-0"><a class="btn btn-secondary btn-small" href="${url}"${external ? NAGP.raw(' rel="noopener"') : ''}>Open the document</a></p>` : ''}
      ${d.body ? html`<details class="doc-text">
        <summary>Read the full text</summary>
        <div class="doc-text-body">${NAGP.paragraphs(d.body)}</div>
      </details>` : ''}
    </li>`;
  };

  async function load() {
    try {
      const data = await api('/api/documents');
      const docs = (data && Array.isArray(data.documents) ? data.documents : [])
        .filter((d) => d && d.title && (!d.visibility || d.visibility === 'public'));
      if (!docs.length) { box.innerHTML = empty(); return; }

      const groups = new Map();
      for (const d of docs) {
        const cat = d.category || 'Other';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(d);
      }
      const rank = (c) => (ORDER.indexOf(c) === -1 ? ORDER.length : ORDER.indexOf(c));
      const cats = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      for (const c of cats) groups.get(c).sort((a, b) => String(b.doc_date || '').localeCompare(String(a.doc_date || '')));

      box.innerHTML = html`${cats.map((c) => html`<div class="doc-group">
        <h3>${c}</h3>
        <ul class="doc-list">${groups.get(c).map(docItem)}</ul>
      </div>`)}`;
    } catch {
      box.innerHTML = empty();
    }
  }

  load();
})();
