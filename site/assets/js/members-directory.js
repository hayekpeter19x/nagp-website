// /members/directory: the members-only directory, grouped by state (?state=NY&type=student&q=).
(function () {
  const { $, api, html } = NAGP;
  const { card, wire, plural } = window.NAGPListing;
  const form = $('#md-filters');
  const results = $('#md-results');
  const count = $('#md-count');
  const TYPES = ['professional', 'associate', 'student'];

  const params = new URLSearchParams(location.search);
  const filters = {
    state: (params.get('state') || '').toUpperCase(),
    type: TYPES.includes(params.get('type')) ? params.get('type') : '',
    q: (params.get('q') || '').slice(0, 100),
  };

  function syncAddress() {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }

  function groupByState(members) {
    const groups = new Map();
    for (const m of members) {
      const key = m.state || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    return [...groups.entries()]
      .map(([code, list]) => ({ code, name: code ? NAGP.regionName(code) : 'State not given', list }))
      .sort((a, b) => (!a.code) - (!b.code) || a.name.localeCompare(b.name));
  }

  let request = 0;
  async function load() {
    const mine = ++request;
    syncAddress();
    count.textContent = 'Searching…';
    try {
      const { members } = await api('/api/members/directory', { query: filters });
      if (mine !== request) return;
      if (!members.length) {
        count.textContent = 'No members found.';
        const filtered = filters.state || filters.type || filters.q;
        results.innerHTML = html`<div class="empty"><p><strong>No members match your search.</strong></p>
          ${filtered ? html`<p>Try “All states and provinces”, “All members”, or a shorter search word.</p>
            <p><button class="btn btn-secondary" type="button" data-clear>Clear search and show everyone</button></p>`
            : html`<p>No members are listed yet.</p>`}</div>`;
        return;
      }
      const groups = groupByState(members);
      count.textContent = `${plural(members.length, 'member')} found` +
        (groups.length > 1 ? ` in ${plural(groups.length, 'state or province', 'states and provinces')}.` : filters.state ? ` in ${NAGP.regionName(filters.state)}.` : '.');
      results.innerHTML = html`${groups.map((g) => html`<section class="state-group" aria-label="${g.name}">
        <h2>${g.name} <span class="count">(${plural(g.list.length, 'member')})</span></h2>
        <div class="grid-2 listing-grid">${g.list.map((m) => card(m, { showType: true }))}</div>
      </section>`)}`;
    } catch (err) {
      if (mine !== request) return;
      count.textContent = '';
      NAGP.showError(results, err);
    }
  }

  function clearAll() {
    filters.state = '';
    filters.type = '';
    filters.q = '';
    form.reset();
    $('#md-state').value = '';
    load();
  }

  NAGP.whenAllowed().then(() => {
    $('#md-state').innerHTML = NAGP.regionOptions(filters.state, { placeholder: 'All states and provinces' });
    $('#md-type').value = filters.type;
    $('#md-q').value = filters.q;
    wire(results);

    $('#md-state').addEventListener('change', (e) => { filters.state = e.target.value; load(); });
    $('#md-type').addEventListener('change', (e) => { filters.type = e.target.value; load(); });
    let typing = null;
    $('#md-q').addEventListener('input', (e) => {
      clearTimeout(typing);
      typing = setTimeout(() => { filters.q = e.target.value.trim(); load(); }, 450);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(typing);
      filters.q = $('#md-q').value.trim();
      load();
    });
    $('#md-clear').addEventListener('click', clearAll);
    results.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) clearAll(); });
    load();
  });
})();
