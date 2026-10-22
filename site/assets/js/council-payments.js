// /council/payments — all payments with totals, and recording a payment received by check or cash.
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let orders = [];
  let show = 'paid';
  let members = null;
  let events = null;

  const STATUS = {
    paid: html`<span class="badge badge-success">Paid</span>`,
    pending: html`<span class="badge badge-warning">Not completed</span>`,
    cancelled: html`<span class="badge">Cancelled</span>`,
    refunded: html`<span class="badge badge-danger">Refunded</span>`,
  };
  const method = (o) => ({ stripe: 'Card (Stripe)', demo: 'Preview (simulated)' }[o.provider]
    || (o.provider === 'manual' ? (o.method === 'cash' ? 'Cash' : 'Check') : o.provider));

  /* ---------- List ---------- */
  function totals(t, preview) {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return html`<dl class="stat-grid">
      <div class="stat"><dt>Received in ${month}</dt><dd>${C.dollars(t.month_cents)}<span class="stat-note">${C.plural(t.month_count, 'payment')}</span></dd></div>
      <div class="stat"><dt>Received in ${now.getFullYear()}</dt><dd>${C.dollars(t.year_cents)}<span class="stat-note">${C.plural(t.year_count, 'payment')}</span></dd></div>
    </dl>
    ${preview ? NAGP.notice('info', 'This is the preview site, so card payments are simulated ("Preview" below). No real money has been taken. Checks and cash you record here are real records.') : ''}`;
  }

  function render() {
    const counts = { paid: 0, pending: 0, all: orders.length };
    orders.forEach((o) => { if (o.status === 'paid') counts.paid++; if (o.status === 'pending') counts.pending++; });
    $$('#order-pills [data-count]').forEach((el) => { el.textContent = counts[el.dataset.count]; });
    const list = show === 'all' ? orders : orders.filter((o) => o.status === show);
    const box = $('#order-list');
    if (!list.length) {
      box.innerHTML = html`<div class="empty"><p>${show === 'paid' ? 'No payments yet.' : show === 'pending' ? 'There are no unfinished payments.' : 'No payments yet.'}</p></div>`;
      return;
    }
    box.innerHTML = html`${show === 'pending' ? html`<p>These people started paying online but did not finish. Usually they changed their mind or will try again; there is nothing you need to do.</p>` : ''}
      <div class="table-wrap"><table class="table table-stack">
      <thead><tr><th scope="col">Date</th><th scope="col">Name</th><th scope="col">What for</th><th scope="col" class="num">Amount</th><th scope="col">Status</th><th scope="col">Method</th></tr></thead>
      <tbody>${list.map((o) => html`<tr>
        <td data-label="Date" class="nowrap">${NAGP.formatShortDate(o.paid_at || o.created_at)}</td>
        <td data-label="Name"><span class="cell-name">${o.name}</span><span class="cell-sub"><a href="mailto:${o.email}">${o.email}</a></span></td>
        <td data-label="What for">${o.description}${o.council_note ? html`<span class="cell-sub">Note: ${o.council_note}</span>` : ''}${o.recorded_by ? html`<span class="cell-sub">Recorded by ${o.recorded_by}</span>` : ''}</td>
        <td data-label="Amount" class="num nowrap">${C.dollars(o.amount_cents)}</td>
        <td data-label="Status">${STATUS[o.status] || o.status}</td>
        <td data-label="Method">${method(o)}</td>
      </tr>`)}</tbody></table></div>`;
  }

  async function load() {
    try {
      const data = await api('/api/council/orders');
      orders = data.orders;
      $('#totals').innerHTML = totals(data.totals, data.preview_payments);
      render();
    } catch (err) {
      NAGP.showError($('#order-list'), err);
      $('#totals').innerHTML = '';
    }
  }

  /* ---------- Record a payment ---------- */
  const form = () => $('#record-form');
  const value = (name) => { const el = form().querySelector(`[name="${name}"]:checked`); return el ? el.value : ''; };
  const chosenMember = () => (members || []).find((m) => String(m.id) === form().user_id.value) || null;

  // One year from the later of today and the current end date (the same rule as the server).
  function nextExpiry(current) {
    const today = new Date().toISOString().slice(0, 10);
    const base = current && current > today ? current : today;
    const [y, m, d] = base.split('-').map(Number);
    const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
    return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  }

  function suggestAmount() {
    const f = form();
    const kind = value('kind');
    if (kind === 'membership') {
      const tier = (NAGP.config.MEMBERSHIP_TIERS || [])[0]; // one membership for everyone
      f.amount.value = tier ? C.centsToInput(tier.price_cents) : '';
    } else if (kind === 'event') {
      const ev = (events || []).find((e) => String(e.id) === f.event_id.value);
      const m = value('person') === 'member' ? chosenMember() : null;
      f.amount.value = ev ? C.centsToInput(m && m.status === 'active' && !m.expired ? ev.price_member_cents : ev.price_public_cents) : '';
    } else {
      f.amount.value = '';
    }
  }

  function sync() {
    const f = form();
    const person = value('person');
    const kind = value('kind');
    $('#who-member').hidden = person !== 'member';
    $('#who-other').hidden = person !== 'other';
    $('#for-membership').hidden = kind !== 'membership';
    $('#for-event').hidden = kind !== 'event';
    f.user_id.required = person === 'member';
    f.name.required = person === 'other';
    f.email.required = person === 'other';
    f.event_id.required = kind === 'event';
    const note = $('#r-tier-note');
    const m = person === 'member' ? chosenMember() : null;
    if (kind === 'membership' && m) {
      const now = !m.membership_expires ? ''
        : m.expired ? `Their membership ended on ${NAGP.formatShortDate(m.membership_expires)}. `
          : m.status === 'active' ? `Their membership is active until ${NAGP.formatShortDate(m.membership_expires)}. ` : '';
      note.textContent = `${now}After this payment it will run until ${NAGP.formatShortDate(nextExpiry(m.membership_expires))}.`;
    } else if (kind === 'membership' && person === 'other') {
      note.textContent = 'They need a member account. If they do not have one yet, use "Add a member by hand" on the Members page instead.';
    } else {
      note.textContent = 'Their membership will run for one more year.';
    }
  }

  async function openRecord() {
    const f = form();
    f.reset();
    NAGP.clearErrors(f);
    C.openDialog($('#record-dialog'), f.querySelector('[name="person"]:checked'));
    try {
      if (!members || !events) {
        f.user_id.innerHTML = '<option value="">Loading…</option>';
        const [m, e] = await Promise.all([api('/api/council/members'), api('/api/council/events')]);
        members = m.members;
        events = e.events;
      }
      f.user_id.innerHTML = html`<option value="">Choose a member</option>${members.map((m) => html`<option value="${m.id}">${m.name} (${m.email})</option>`)}`;
      const upcoming = events.filter((e) => !e.is_past);
      const past = events.filter((e) => e.is_past).reverse();
      const opt = (e) => html`<option value="${e.id}">${e.title}, ${NAGP.formatShortDate(e.starts_at, e.timezone)}</option>`;
      f.event_id.innerHTML = html`<option value="">Choose the event</option>
        ${upcoming.length ? html`<optgroup label="Upcoming">${upcoming.map(opt)}</optgroup>` : ''}
        ${past.length ? html`<optgroup label="Past">${past.map(opt)}</optgroup>` : ''}`;
      const pre = NAGP.qs('member');
      if (pre && members.some((m) => String(m.id) === pre)) f.user_id.value = pre;
      sync();
      suggestAmount();
    } catch (err) {
      $('#record-form .form-status').innerHTML = NAGP.notice('error', err.message);
    }
  }

  NAGP.whenAllowed().then(() => {
    C.pills($('#order-pills'), (v) => { show = v; render(); });
    $('#open-record').addEventListener('click', openRecord);
    const f = form();
    f.addEventListener('change', (e) => {
      const n = e.target.name;
      sync();
      if (['kind', 'event_id', 'user_id', 'person'].includes(n)) suggestAmount();
    });
    NAGP.form(f, {
      busyText: 'Recording…',
      onSubmit: async (data) => {
        const res = await api('/api/council/orders', { method: 'POST', body: data });
        $('#record-dialog').close();
        members = null; // their membership dates may have changed
        show = 'paid';
        C.setPill($('#order-pills'), 'paid');
        C.say($('#page-status'), 'success', res.message, 'Payment recorded');
        load();
      },
    });
    load();
    if (NAGP.qs('record') === '1') openRecord();
  });
})();
