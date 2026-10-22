// /council/members — search and filter members, edit a member, set a new password, add a member by hand.
(function () {
  const { $, api, html } = NAGP;
  const C = Council;
  let me = null;
  let members = [];
  let editing = null;

  // One membership for everyone; what differs is what best describes the member.
  const MEMBERSHIP = (NAGP.config.MEMBERSHIP_TIERS || [])[0] || { price_cents: 0 };
  const TYPES = NAGP.config.MEMBER_TYPES || [];
  const typeLabel = (key) => (TYPES.find((t) => t.key === key) || {}).label || 'Member';
  const typeOptions = (selected = '') => NAGP.raw(TYPES.map((t) =>
    `<option value="${NAGP.esc(t.key)}"${t.key === selected ? ' selected' : ''}>${NAGP.esc(t.label)}</option>`).join(''));

  /* ---------- Easy-to-read passwords ---------- */
  const WORDS = ['quiet', 'river', 'maple', 'cedar', 'harbor', 'meadow', 'garden', 'willow', 'canyon', 'forest', 'sunny', 'gentle',
    'autumn', 'spring', 'silver', 'golden', 'valley', 'island', 'orchard', 'prairie', 'lantern', 'harvest', 'breeze', 'pebble'];
  function makePassword() {
    const r = crypto.getRandomValues(new Uint32Array(3));
    const a = WORDS[r[0] % WORDS.length];
    let b = WORDS[r[1] % WORDS.length];
    if (b === a) b = WORDS[(r[1] + 1) % WORDS.length];
    return `${a}-${b}-${1000 + (r[2] % 9000)}`;
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-make-password]');
    if (!btn) return;
    const input = $(btn.dataset.makePassword);
    input.value = makePassword();
    input.focus();
    input.select();
  });

  /* ---------- List ---------- */
  function filters() {
    const f = $('#member-filters');
    return { q: f.q.value.trim(), status: f.status.value, role: f.role.value };
  }

  function updateCsvLink() {
    const p = new URLSearchParams({ format: 'csv' });
    for (const [k, v] of Object.entries(filters())) if (v) p.set(k, v);
    $('#csv-link').href = '/api/council/members?' + p.toString();
  }

  function untilCell(m) {
    if (!m.membership_expires) return html`<span class="muted">Not set</span>`;
    return m.expired ? html`${NAGP.formatShortDate(m.membership_expires)}<span class="cell-sub">Ended, not renewed</span>` : NAGP.formatShortDate(m.membership_expires);
  }

  function row(m) {
    const place = [m.city, NAGP.regionName(m.state)].filter(Boolean).join(', ');
    return html`<tr>
      <td data-label="Name"><span class="cell-name">${m.name}</span> ${NAGP.sampleBadge(m)}${m.id === me.id ? html` <span class="badge badge-primary">You</span>` : ''}
        ${m.credentials ? html`<span class="cell-sub">${m.credentials}</span>` : ''}</td>
      <td data-label="Email"><a href="mailto:${m.email}">${m.email}</a></td>
      <td data-label="Type">${typeLabel(m.member_type)}</td>
      <td data-label="Place">${place || html`<span class="muted">Not given</span>`}</td>
      <td data-label="Status">${C.statusBadge(m)}</td>
      <td data-label="Active until" class="nowrap">${untilCell(m)}</td>
      <td data-label="Role">${m.role === 'member' ? 'Member' : html`<span class="badge badge-primary">${C.ROLE[m.role] || m.role}</span>`}</td>
      <td class="cell-actions"><button class="btn btn-small btn-secondary" type="button" data-edit="${m.id}" aria-label="Edit ${m.name}">Edit</button></td>
    </tr>`;
  }

  function render(data) {
    const box = $('#member-list');
    members = data.members;
    const f = filters();
    const filtered = f.q || f.status || f.role;
    if (!members.length) {
      box.innerHTML = html`<div class="empty"><p><strong>No one matches your search.</strong></p>
        ${filtered ? html`<p>Try a shorter search, or choose "Clear" to see everyone.</p>` : ''}</div>`;
      return;
    }
    const c = data.counts;
    box.innerHTML = html`<p class="results-count">${filtered
      ? `Showing ${C.plural(members.length, 'person', 'people')} that match.`
      : `${C.plural(c.all, 'person', 'people')} in total: ${c.active} active, ${c.expired ? `${c.expired} expired, ` : ''}${c.pending} waiting for payment, ${c.lapsed} lapsed, ${c.suspended} suspended.`}</p>
      <div class="table-wrap"><table class="table table-stack table-stack-wide">
        <caption class="visually-hidden">Members</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Type</th><th scope="col">Place</th>
          <th scope="col">Status</th><th scope="col">Active until</th><th scope="col">Role</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>${members.map(row)}</tbody>
      </table></div>`;
  }

  let timer = null;
  let requestNo = 0;
  async function load() {
    updateCsvLink();
    const n = ++requestNo;
    try {
      const data = await api('/api/council/members', { query: filters() });
      if (n === requestNo) render(data);
    } catch (err) {
      NAGP.showError($('#member-list'), err);
    }
  }

  /* ---------- Edit ---------- */
  function openEdit(id) {
    const m = members.find((x) => String(x.id) === String(id));
    if (!m) return;
    editing = m;
    const dlg = $('#edit-dialog');
    const form = $('#edit-form');
    NAGP.clearErrors(form);
    NAGP.clearErrors($('#password-form'));
    $('#password-form').reset();
    $('#edit-title').textContent = `Edit ${m.name}`;
    $('#edit-who').innerHTML = html`${m.email}${m.last_login ? ` · Last signed in ${C.longDate(m.last_login)}` : ' · Has not signed in yet'}`;
    $('#e-tier').innerHTML = typeOptions(m.member_type);
    C.fill(form, {
      status: m.status, member_type: m.member_type, membership_expires: m.membership_expires, role: m.role === 'admin' ? 'council' : m.role,
      show_members: m.show_members, show_public: m.show_public,
    });
    const self = m.id === me.id;
    $('#self-note').hidden = !self;
    const exp = $('#expired-note');
    exp.hidden = !m.expired;
    if (m.expired) exp.textContent = `Their membership ended on ${NAGP.formatShortDate(m.membership_expires)} and was not renewed, so they no longer have access to the Members' Area. To renew it, record their payment on the Payments page (this adds a year), or change "Active until" here.`;
    form.role.disabled = self || m.role === 'admin';
    [...form.status.options].forEach((o) => { o.disabled = self && o.value !== m.status; });
    syncPublic();
    C.openDialog(dlg, form.status);
  }

  function syncPublic() {
    const form = $('#edit-form');
    const pro = form.member_type.value === 'professional';
    form.show_public.disabled = !pro;
    if (!pro) form.show_public.checked = false;
    $('#public-hint').textContent = pro
      ? 'Only tick this if the member has asked to be listed publicly.'
      : 'The Public Directory is for practicing professionals only.';
  }

  /* ---------- Add ---------- */
  function syncPayment() {
    const form = $('#add-form');
    const on = form.record_payment.checked;
    $('#a-payment').hidden = !on;
    $('#a-no-payment').hidden = on;
    form.amount.required = on;
  }
  function suggestAmount() {
    const form = $('#add-form');
    form.amount.value = C.centsToInput(MEMBERSHIP.price_cents);
  }

  NAGP.whenAllowed().then(({ user }) => {
    me = user;
    const f = $('#member-filters');
    f.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    f.addEventListener('input', (e) => { if (e.target.name === 'q') { clearTimeout(timer); timer = setTimeout(load, 300); } });
    f.addEventListener('change', (e) => { if (e.target.name !== 'q') load(); });
    f.addEventListener('reset', () => setTimeout(load, 0));
    const wanted = NAGP.qs('status');
    if (wanted) f.status.value = wanted;

    $('#member-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-edit]');
      if (btn) openEdit(btn.dataset.edit);
    });

    // Edit form
    const editForm = $('#edit-form');
    editForm.member_type.addEventListener('change', syncPublic);
    NAGP.form(editForm, {
      reset: false,
      busyText: 'Saving…',
      onSubmit: async (data) => {
        const body = { ...data };
        if (editForm.role.disabled) delete body.role;
        const res = await api(`/api/council/members/${editing.id}`, { method: 'PATCH', body });
        $('#edit-dialog').close();
        C.say($('#page-status'), 'success', res.message);
        load();
      },
    });

    // Password form
    NAGP.form($('#password-form'), {
      busyText: 'Saving…',
      onSubmit: async (data) => {
        if (String(data.password).length < 8) {
          const err = new Error('Please check the new password.');
          err.fields = { password: 'Please choose a password with at least 8 characters.' };
          throw err;
        }
        return api(`/api/council/members/${editing.id}/password`, { method: 'POST', body: data });
      },
      success: (res) => res.message,
    });

    // Add form
    const addForm = $('#add-form');
    addForm.member_type.innerHTML = typeOptions('associate');
    addForm.state.innerHTML = NAGP.regionOptions('', { placeholder: 'Not given' });
    addForm.record_payment.addEventListener('change', () => { syncPayment(); if (addForm.record_payment.checked && !addForm.amount.value) suggestAmount(); });
    syncPayment();
    $('#open-add').addEventListener('click', () => {
      addForm.reset();
      NAGP.clearErrors(addForm);
      addForm.member_type.value = 'associate';
      syncPayment();
      C.openDialog($('#add-dialog'), addForm.name);
    });
    NAGP.form(addForm, {
      busyText: 'Adding…',
      onSubmit: async (data) => {
        const res = await api('/api/council/members', { method: 'POST', body: data });
        $('#add-dialog').close();
        C.say($('#page-status'), 'success', res.message, 'Member added');
        f.reset(); // shows everyone again, including the new member
      },
    });

    load();
    if (NAGP.qs('add') === '1') $('#open-add').click();
  });
})();
