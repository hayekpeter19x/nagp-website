// /members/documents: documents grouped by category (minutes first), newest first in each group.
(function () {
  const { $, api, html } = NAGP;
  const box = $('#docs');
  const ORDER = ['Minutes', ...(NAGP.config.DOCUMENT_CATEGORIES || []).filter((c) => c !== 'Minutes')];
  const HEADINGS = { Minutes: 'Meeting minutes', Incorporation: 'Incorporation papers' };

  function visibilityBadge(v) {
    if (v === 'members') return html`<span class="badge badge-accent">Members only</span>`;
    if (v === 'council') return html`<span class="badge badge-danger">Council only</span>`;
    return html`<span class="badge">Public</span>`;
  }

  function doc(d) {
    const url = /^https?:\/\//i.test(d.url) ? d.url : '';
    return html`<article class="card doc">
      <div class="ann-badges">${visibilityBadge(d.visibility)} ${NAGP.sampleBadge(d)}</div>
      <h3>${d.title}</h3>
      ${d.doc_date ? html`<p class="meta">${NAGP.formatShortDate(d.doc_date)}</p>` : ''}
      ${d.description ? html`<p>${d.description}</p>` : ''}
      ${url ? html`<p class="mb-0"><a class="btn btn-secondary" href="${url}" rel="noopener" target="_blank">Open the document<span class="visually-hidden"> (opens in a new tab)</span></a></p>` : ''}
      ${d.body ? html`<details><summary>Read the text here</summary><div class="doc-text">${NAGP.paragraphs(d.body)}</div></details>` : ''}
    </article>`;
  }

  NAGP.whenAllowed().then(async () => {
    try {
      const { documents } = await api('/api/documents');
      if (!documents.length) {
        box.innerHTML = html`<div class="empty"><p><strong>There are no documents yet.</strong></p><p>The Council will add minutes and other documents here.</p></div>`;
        return;
      }
      const groups = new Map();
      for (const d of documents) {
        if (!groups.has(d.category)) groups.set(d.category, []);
        groups.get(d.category).push(d);
      }
      const rank = (c) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
      const cats = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      box.innerHTML = html`${cats.map((c) => html`<section class="doc-group" aria-labelledby="docs-${c.replace(/\W+/g, '-')}">
        <h2 id="docs-${c.replace(/\W+/g, '-')}">${HEADINGS[c] || c}</h2>
        <div class="doc-list">${groups.get(c).map(doc)}</div>
      </section>`)}`;
    } catch (err) {
      NAGP.showError(box, err);
    }
  });
})();
