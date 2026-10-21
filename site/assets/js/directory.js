// /directory: the public directory (professionals who opt in). Not in the menu for now (Phase 2).
// Filters live in the address (?specialty=coaching&state=NY&q=grief) so a search can be shared.
(function () {
  const { $, api, html } = NAGP;
  const { card, wire, plural } = window.NAGPListing;
  const SPECIALTIES = NAGP.config.SPECIALTIES || [];
  const form = $('#directory-filters');
  const results = $('#dir-results');
  const count = $('#dir-count');

  const params = new URLSearchParams(location.search);
  const filters = {
    specialty: SPECIALTIES.some((s) => s.key === params.get('specialty')) ? params.get('specialty') : '',
    state: (params.get('state') || '').toUpperCase(),
    q: (params.get('q') || '').slice(0, 100),
  };

  function renderPills() {
    const pills = [{ key: '', label: 'All specialties' }, ...SPECIALTIES];
    $('#specialty-pills').innerHTML = html`${pills.map((s) => html`<li><button type="button" data-specialty="${s.key}"
      aria-pressed="${String(filters.specialty === s.key)}">${s.label}</button></li>`)}`;
  }

  function syncAddress() {
    const p = new URLSearchParams();
    if (filters.specialty) p.set('specialty', filters.specialty);
    if (filters.state) p.set('state', filters.state);
    if (filters.q) p.set('q', filters.q);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function describe() {
    const parts = [];
    if (filters.specialty) parts.push(`in ${NAGP.specialtyLabel(filters.specialty)}`);
    if (filters.state) parts.push(`in ${NAGP.regionName(filters.state)}`);
    if (filters.q) parts.push(`matching “${filters.q}”`);
    return parts.join(' ');
  }

  let request = 0;
  async function load() {
    const mine = ++request;
    syncAddress();
    count.textContent = 'Searching…';
    try {
      const { practitioners } = await api('/api/directory', { query: filters });
      if (mine !== request) return; // a newer search has started
      const filtered = !!(filters.specialty || filters.state || filters.q);
      count.textContent = `${plural(practitioners.length, 'practitioner')} found ${describe()}`.trim() + '.';
      if (!practitioners.length) {
        results.innerHTML = filtered
          ? html`<div class="empty"><p><strong>No practitioners match your search.</strong></p>
              <p>Try “All specialties”, a different state, or a shorter search word.</p>
              <p><button class="btn btn-secondary" type="button" data-clear>Clear search and show everyone</button></p></div>`
          : html`<div class="empty"><p><strong>No practitioners are listed yet.</strong></p>
              <p>Professional members can add themselves from <a href="/members/profile">their profile page</a>.</p></div>`;
        return;
      }
      results.innerHTML = html`${practitioners.map((p) => card(p))}`;
    } catch (err) {
      if (mine !== request) return;
      count.textContent = '';
      NAGP.showError(results, err);
    }
  }

  function clearAll() {
    filters.specialty = '';
    filters.state = '';
    filters.q = '';
    form.reset();
    $('#dir-state').value = '';
    renderPills();
    load();
  }

  // Set up the controls from the address.
  $('#dir-state').innerHTML = NAGP.regionOptions(filters.state, { placeholder: 'All states and provinces' });
  $('#dir-q').value = filters.q;
  renderPills();
  wire(results);

  $('#specialty-pills').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-specialty]');
    if (!btn) return;
    filters.specialty = btn.dataset.specialty;
    renderPills();
    $(`#specialty-pills [data-specialty="${filters.specialty}"]`).focus();
    load();
  });
  $('#dir-state').addEventListener('change', (e) => { filters.state = e.target.value; load(); });

  let typing = null;
  $('#dir-q').addEventListener('input', (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => { filters.q = e.target.value.trim(); load(); }, 450);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(typing);
    filters.q = $('#dir-q').value.trim();
    filters.state = $('#dir-state').value;
    load();
  });
  $('#dir-clear').addEventListener('click', clearAll);
  results.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) clearAll(); });

  load();
})();
