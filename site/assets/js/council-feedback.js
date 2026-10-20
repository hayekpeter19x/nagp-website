// /council/feedback — preview comments, grouped by page, with "Mark as done".
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let items = [];
  let show = 'open';

  // "/about" -> "About", "/" -> "Home page", "/event?id=3" -> "Event (id=3)"
  function pageName(path) {
    const [p, q] = String(path || '/').split('?');
    if (p === '/' || p === '') return 'Home page';
    const words = p.replace(/^\/|\/$/g, '').split('/').map((w) => w.replace(/-/g, ' '));
    const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(': ');
    return q ? `${name} (${q})` : name;
  }
  // Only link to pages on this site.
  const safePath = (path) => (/^\/(?!\/)/.test(path || '') ? path : '/');

  function render() {
    const open = items.filter((f) => !f.resolved).length;
    const counts = { open, done: items.length - open, all: items.length };
    $$('#fb-pills [data-count]').forEach((el) => { el.textContent = counts[el.dataset.count]; });
    const list = items.filter((f) => (show === 'all' ? true : show === 'open' ? !f.resolved : f.resolved));
    const box = $('#fb-list');
    if (!list.length) {
      box.innerHTML = html`<div class="empty"><p><strong>${show === 'open' ? 'Nothing left to do.' : 'No comments here.'}</strong></p>
        ${show === 'open' ? html`<p>When someone uses the "Comment on this page" button, their comment appears here.</p>` : ''}</div>`;
      return;
    }
    const pages = new Map();
    for (const f of list) {
      if (!pages.has(f.page)) pages.set(f.page, []);
      pages.get(f.page).push(f);
    }
    box.innerHTML = html`${[...pages.entries()].map(([page, rows]) => html`<section class="page-group">
      <h2>${pageName(page)} <a href="${safePath(page)}">Open this page</a></h2>
      <ul class="item-list">${rows.map((f) => html`<li data-id="${f.id}"><article class="card item-card${f.resolved ? ' is-done' : ' is-new'}">
        <ul class="item-meta"><li>From <b>${f.name || 'Someone who did not give a name'}</b></li><li>${C.dateTime(f.created_at)}</li>
          ${f.resolved ? html`<li><span class="badge badge-success">Done</span></li>` : ''}</ul>
        <div class="item-body">${NAGP.paragraphs(f.comment)}</div>
        <div class="actions mt-0">${f.resolved
          ? html`<button class="btn btn-secondary" type="button" data-resolved="0">Mark as not done</button>`
          : html`<button class="btn" type="button" data-resolved="1">Mark as done</button>`}</div>
        <div class="form-status" role="status" aria-live="polite"></div>
      </article></li>`)}</ul></section>`)}`;
  }

  async function load() {
    try {
      items = (await api('/api/council/feedback')).feedback;
      render();
    } catch (err) {
      NAGP.showError($('#fb-list'), err);
    }
  }

  async function toggle(btn) {
    const li = btn.closest('li[data-id]');
    const f = items.find((x) => String(x.id) === li.dataset.id);
    const resolved = btn.dataset.resolved === '1';
    const res = await C.run(btn, li.querySelector('.form-status'), () => api(`/api/council/feedback/${f.id}`, { method: 'POST', body: { resolved } }), 'Saving…');
    if (!res) return;
    f.resolved = resolved;
    if (show !== 'all') {
      li.innerHTML = NAGP.notice('success', resolved ? 'Marked as done.' : 'Moved back to "Still to do".');
      const open = items.filter((x) => !x.resolved).length;
      $$('#fb-pills [data-count]').forEach((el) => { el.textContent = { open, done: items.length - open, all: items.length }[el.dataset.count]; });
    } else {
      render();
    }
  }

  NAGP.whenAllowed().then(() => {
    C.pills($('#fb-pills'), (v) => { show = v; render(); });
    $('#fb-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-resolved]'); if (b) toggle(b); });
    load();
  });
})();
