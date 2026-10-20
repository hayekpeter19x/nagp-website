// /announcements: approved announcements, newest first, with a category filter (?category=Event).
(function () {
  const { $, api, html } = NAGP;
  const CATEGORIES = NAGP.config.ANNOUNCEMENT_CATEGORIES || [];
  const list = $('#ann-list');
  const count = $('#ann-count');
  let category = CATEGORIES.includes(NAGP.qs('category')) ? NAGP.qs('category') : '';

  function renderPills() {
    const pills = ['', ...CATEGORIES];
    $('#category-pills').innerHTML = html`${pills.map((c) => html`<li><button type="button" data-category="${c}"
      aria-pressed="${String(category === c)}">${c || 'All announcements'}</button></li>`)}`;
  }

  function badges(a) {
    return html`<div class="ann-badges">
      ${a.from_council ? html`<span class="badge badge-primary">Official NAGP</span>` : ''}
      ${a.visibility === 'members' ? html`<span class="badge badge-accent">Members only</span>` : ''}
      <span class="badge">${a.category}</span>
      ${NAGP.sampleBadge(a)}
    </div>`;
  }

  function item(a) {
    const link = /^https?:\/\//i.test(a.link_url) ? a.link_url : '';
    return html`<article class="card ann${a.from_council ? ' ann-official' : ''}">
      ${badges(a)}
      <h2 class="ann-title"><a href="/announcement?id=${a.id}">${a.title}</a></h2>
      <p class="meta">Posted ${NAGP.formatShortDate(a.published_at || a.created_at)} by ${a.author_name}</p>
      <div class="ann-body">${NAGP.paragraphs(a.body)}</div>
      ${link ? html`<p class="ann-link">More information: <a href="${link}" rel="noopener nofollow">${link}</a></p>` : ''}
    </article>`;
  }

  async function load() {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    count.textContent = '';
    NAGP.loading(list, 'Loading announcements…');
    try {
      const { announcements } = await api('/api/announcements', { query: { category, limit: 100 } });
      const n = announcements.length;
      count.textContent = n ? `${n} announcement${n === 1 ? '' : 's'}${category ? ` in “${category}”` : ''}.` : '';
      list.innerHTML = n ? html`${announcements.map(item)}`
        : html`<div class="empty"><p><strong>${category ? `There are no announcements in “${category}” right now.` : 'There are no announcements yet.'}</strong></p>
            ${category ? html`<p><button class="btn btn-secondary" type="button" data-category="">Show all announcements</button></p>` : html`<p>Please check back soon.</p>`}</div>`;
    } catch (err) {
      NAGP.showError(list, err);
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    category = btn.dataset.category;
    renderPills();
    load();
  });

  renderPills();
  // Members also see members-only announcements, so wait until we know who is signed in.
  NAGP.ready.then(load);
})();
