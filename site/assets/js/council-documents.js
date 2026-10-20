// /council/documents — list, add, edit and delete documents (links or pasted text).
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let docs = [];
  let filter = '';
  let editingId = null;

  const VIS_BADGE = {
    public: html`<span class="badge badge-success">Everyone</span>`,
    members: html`<span class="badge badge-primary">Members only</span>`,
    council: html`<span class="badge badge-accent">Council only</span>`,
  };

  function card(d) {
    const words = d.body ? d.body.trim().split(/\s+/).length : 0;
    return html`<li data-id="${d.id}"><article class="card item-card" aria-labelledby="doc-${d.id}">
      <h3 id="doc-${d.id}">${d.title} <span class="badges">${VIS_BADGE[d.visibility] || ''}${NAGP.sampleBadge(d)}</span></h3>
      <ul class="item-meta">
        ${d.doc_date ? html`<li>${NAGP.formatShortDate(d.doc_date)}</li>` : ''}
        ${d.url ? html`<li><a href="${d.url}" target="_blank" rel="noopener">Open the link</a></li>` : ''}
        ${words ? html`<li>${C.plural(words, 'word')} of text</li>` : ''}
        <li>Last changed ${C.longDate(d.updated_at)}</li>
      </ul>
      ${d.description ? html`<p>${d.description}</p>` : ''}
      <div class="actions">
        <button class="btn" type="button" data-act="edit">Edit</button>
        <button class="btn btn-danger" type="button" data-act="delete">Delete…</button>
      </div>
      <div class="form-status" role="status" aria-live="polite"></div>
    </article></li>`;
  }

  function render() {
    const counts = { all: docs.length, public: 0, members: 0, council: 0 };
    docs.forEach((d) => { counts[d.visibility] = (counts[d.visibility] || 0) + 1; });
    $$('#doc-pills [data-count]').forEach((el) => { el.textContent = counts[el.dataset.count]; });
    const list = docs.filter((d) => !filter || d.visibility === filter);
    const box = $('#doc-list');
    if (!list.length) {
      box.innerHTML = html`<div class="empty"><p>${docs.length ? 'No documents in this group.' : 'There are no documents yet. Choose "Add a document" to add the first one.'}</p></div>`;
      return;
    }
    // Grouped by kind (Bylaws, Minutes, ...), in the order of the settings.
    const order = NAGP.config.DOCUMENT_CATEGORIES || [];
    const groups = [...new Set([...order, ...list.map((d) => d.category)])]
      .map((cat) => ({ cat, items: list.filter((d) => d.category === cat) })).filter((g) => g.items.length);
    box.innerHTML = html`${groups.map((g) => html`<h2 class="group-heading">${g.cat}</h2><ul class="item-list">${g.items.map(card)}</ul>`)}`;
  }

  async function load() {
    try {
      docs = (await api('/api/council/documents')).documents;
      render();
    } catch (err) {
      NAGP.showError($('#doc-list'), err);
    }
  }

  function showForm(d) {
    editingId = d ? d.id : null;
    const form = $('#doc-form');
    form.reset();
    NAGP.clearErrors(form);
    form.category.innerHTML = NAGP.raw((NAGP.config.DOCUMENT_CATEGORIES || []).map((c) => `<option>${NAGP.esc(c)}</option>`).join(''));
    if (d) C.fill(form, d);
    $('#form-title').textContent = d ? `Edit "${d.title}"` : 'Add a document';
    $('#list-view').hidden = true;
    $('#form-view').hidden = false;
    window.scrollTo(0, 0);
    $('#form-title').focus();
  }

  function showList() {
    $('#form-view').hidden = true;
    $('#list-view').hidden = false;
    editingId = null;
    if (NAGP.qs('new')) history.replaceState(null, '', location.pathname);
  }

  async function act(btn) {
    const li = btn.closest('li[data-id]');
    const d = docs.find((x) => String(x.id) === li.dataset.id);
    if (btn.dataset.act === 'edit') { showForm(d); return; }
    const r = await C.ask({
      title: `Delete "${d.title}"?`,
      message: html`<p>The document will be removed from the website for good. ${d.url ? 'The original in Notion or Google Drive is not touched.' : ''}</p>
        <p><strong>Are you sure? This cannot be undone.</strong></p>`,
      confirm: 'Yes, delete it',
      cancel: 'No, keep it',
      danger: true,
    });
    if (!r.ok) return;
    const res = await C.run(btn, li.querySelector('.form-status'), () => api(`/api/council/documents/${d.id}`, { method: 'DELETE' }), 'Deleting…');
    if (!res) return;
    C.say($('#page-status'), 'success', res.message);
    load();
  }

  NAGP.whenAllowed().then(() => {
    C.pills($('#doc-pills'), (v) => { filter = v; render(); });
    $('#doc-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) act(b); });
    $('#add-doc').addEventListener('click', () => showForm(null));
    $$('[data-back]').forEach((b) => b.addEventListener('click', showList));
    NAGP.form($('#doc-form'), {
      reset: false,
      busyText: 'Saving…',
      onSubmit: async (data) => {
        const res = editingId
          ? await api(`/api/council/documents/${editingId}`, { method: 'PUT', body: data })
          : await api('/api/council/documents', { method: 'POST', body: data });
        showList();
        filter = '';
        C.setPill($('#doc-pills'), '');
        C.say($('#page-status'), 'success', res.message);
        await load();
      },
    });
    load().then(() => { if (NAGP.qs('new') === '1') showForm(null); });
  });
})();
