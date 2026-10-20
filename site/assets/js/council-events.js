// /council/events — every event (upcoming, past, not published), add/edit, registrations, delete.
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let events = [];
  let timezones = [];
  let view = 'upcoming';
  let editingId = null;

  /* ---------- Time zones (same rules as the server, lib/council.js) ---------- */
  function offsetMinutes(tz, ms) {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName');
    const m = part && part.value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  }
  const pad = (n) => String(n).padStart(2, '0');
  const fmtOffset = (min) => `${min < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(min) / 60))}:${pad(Math.abs(min) % 60)}`;
  function zonedIso(date, time, tz) {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    const before = offsetMinutes(tz, wall - 432e5);
    const after = offsetMinutes(tz, wall + 432e5);
    for (const off of before === after ? [before] : [Math.max(before, after), Math.min(before, after)]) {
      if (offsetMinutes(tz, wall - off * 60e3) === off) return `${date}T${time}:00${fmtOffset(off)}`;
    }
    const instant = wall - before * 60e3;
    const off = offsetMinutes(tz, instant);
    const iso = new Date(instant + off * 60e3).toISOString();
    return `${iso.slice(0, 10)}T${iso.slice(11, 16)}:00${fmtOffset(off)}`;
  }

  /* ---------- List ---------- */
  const inView = (e) => (view === 'unpublished' ? !e.published : view === 'past' ? e.published && e.is_past : e.published && !e.is_past);

  function setCounts() {
    const counts = {
      upcoming: events.filter((e) => e.published && !e.is_past).length,
      past: events.filter((e) => e.published && e.is_past).length,
      unpublished: events.filter((e) => !e.published).length,
    };
    $$('#event-pills [data-count]').forEach((el) => { el.textContent = counts[el.dataset.count]; });
  }

  function priceText(e) {
    if (!e.price_member_cents && !e.price_public_cents) return 'Free';
    if (e.price_member_cents === e.price_public_cents) return NAGP.money(e.price_member_cents);
    if (!e.price_member_cents) return `Free for members, ${NAGP.money(e.price_public_cents)} for non-members`;
    return `${NAGP.money(e.price_member_cents)} for members, ${NAGP.money(e.price_public_cents)} for non-members`;
  }

  function regText(e) {
    const places = e.capacity ? ` of ${e.capacity} places` : '';
    const base = e.confirmed === 1 ? `1 person registered${places}` : `${e.confirmed} people registered${places}`;
    return e.waiting ? `${base} (${e.waiting} started but did not finish paying)` : base;
  }

  function card(e) {
    const p = NAGP.dateParts(e.starts_at, e.timezone);
    return html`<li data-id="${e.id}"><article class="card item-card event-admin" aria-labelledby="ev-${e.id}">
      <div class="event-item">
        <div class="date-block" aria-hidden="true"><span class="month">${p.month}</span><span class="day">${p.day}</span><span class="weekday">${p.year}</span></div>
        <div>
          <h3 id="ev-${e.id}">${e.title} <span class="badges">${NAGP.sampleBadge(e)}
            ${!e.published ? html`<span class="badge badge-warning">Not published</span>` : ''}
            ${e.members_only ? html`<span class="badge badge-primary">Members only</span>` : ''}
            ${!e.registration_open && !e.is_past ? html`<span class="badge">Registration closed</span>` : ''}</span></h3>
          <ul class="item-meta">
            <li>${NAGP.eventWhen(e)}</li>
            <li>${e.location}</li>
            <li>${e.category}</li>
            <li>${priceText(e)}</li>
          </ul>
          <p class="reg-count">${regText(e)}</p>
          <div class="actions">
            <button class="btn" type="button" data-act="edit">Edit</button>
            <button class="btn btn-secondary" type="button" data-act="regs">Who registered</button>
            ${e.published ? html`<a class="btn btn-quiet" href="/event?id=${e.id}">See it on the site</a>` : ''}
            <button class="btn btn-danger" type="button" data-act="delete">Delete…</button>
          </div>
          <div class="form-status" role="status" aria-live="polite"></div>
        </div>
      </div>
    </article></li>`;
  }

  function renderList() {
    setCounts();
    let list = events.filter(inView);
    if (view === 'past') list = list.slice().reverse(); // newest first
    const box = $('#event-list');
    if (!list.length) {
      const msg = { upcoming: 'There are no upcoming published events.', past: 'There are no past events.', unpublished: 'Every event is published.' }[view];
      box.innerHTML = html`<div class="empty"><p>${msg}</p>${view === 'upcoming' ? html`<p>Choose "Add an event" to create one.</p>` : ''}</div>`;
      return;
    }
    box.innerHTML = html`<ul class="item-list">${list.map(card)}</ul>`;
  }

  async function load() {
    try {
      const data = await api('/api/council/events');
      events = data.events;
      timezones = data.timezones;
      renderList();
    } catch (err) {
      NAGP.showError($('#event-list'), err);
    }
  }

  /* ---------- Form ---------- */
  function showForm(ev) {
    editingId = ev ? ev.id : null;
    const form = $('#event-form');
    form.reset();
    NAGP.clearErrors(form);
    const tz = ev ? ev.timezone : 'America/New_York';
    const zones = timezones.some((z) => z.key === tz) ? timezones : [...timezones, { key: tz, label: tz }];
    form.timezone.innerHTML = NAGP.raw(zones.map((z) => `<option value="${NAGP.esc(z.key)}">${NAGP.esc(z.label)}</option>`).join(''));
    form.category.innerHTML = NAGP.raw((NAGP.config.EVENT_CATEGORIES || []).map((c) => `<option>${NAGP.esc(c)}</option>`).join(''));
    if (ev) {
      C.fill(form, {
        ...ev,
        end_date: ev.end_date && ev.end_date !== ev.start_date ? ev.end_date : '',
        end_time: ev.ends_at ? ev.end_time : '',
        is_online: ev.is_online ? '1' : '0',
        price_member: C.centsToInput(ev.price_member_cents),
        price_public: C.centsToInput(ev.price_public_cents),
        capacity: ev.capacity || '',
      });
    } else {
      form.timezone.value = tz;
      form.category.value = 'Salon';
    }
    $('#form-title').textContent = ev ? `Edit "${ev.title}"` : 'Add an event';
    syncWhere();
    updatePreview();
    $('#list-view').hidden = true;
    $('#form-view').hidden = false;
    window.scrollTo(0, 0);
    $('#form-title').focus();
  }

  function showList() {
    $('#form-view').hidden = true;
    $('#list-view').hidden = false;
    editingId = null;
    if (NAGP.qs('new') || NAGP.qs('edit')) history.replaceState(null, '', location.pathname);
  }

  function syncWhere() {
    const form = $('#event-form');
    const online = form.querySelector('[name="is_online"]:checked').value === '1';
    $('#ev-location-hint').textContent = online
      ? 'For example "Online (Zoom)". Do not put the private Zoom link here: this is shown to everyone.'
      : 'The venue and city, for example "Gestalt Institute, Denver, Colorado".';
    if (online && !form.location.value) form.location.placeholder = 'Online (Zoom)';
    else form.location.placeholder = '';
  }

  function updatePreview() {
    const f = $('#event-form');
    const out = $('#when-preview');
    if (!f.start_date.value || !f.start_time.value) { out.textContent = 'choose a date and a start time'; return; }
    try {
      const ev = { timezone: f.timezone.value, starts_at: zonedIso(f.start_date.value, f.start_time.value, f.timezone.value), ends_at: null };
      if (f.end_time.value) ev.ends_at = zonedIso(f.end_date.value || f.start_date.value, f.end_time.value, f.timezone.value);
      out.textContent = ev.ends_at && Date.parse(ev.ends_at) <= Date.parse(ev.starts_at)
        ? 'the end is before the start. Please check the times, or choose an end date.'
        : NAGP.eventWhen(ev);
    } catch {
      out.textContent = 'please check the date and time';
    }
  }

  /* ---------- Registrations ---------- */
  async function showRegistrations(e) {
    const dlg = $('#reg-dialog');
    $('#reg-title').textContent = `Who registered: ${e.title}`;
    const body = $('#reg-body');
    NAGP.loading(body);
    C.openDialog(dlg, dlg.querySelector('[data-close]'));
    try {
      const data = await api(`/api/council/events/${e.id}/registrations`);
      const regs = data.registrations;
      const STATUS = { confirmed: html`<span class="badge badge-success">Confirmed</span>`, pending: html`<span class="badge badge-warning">Did not finish paying</span>`, cancelled: html`<span class="badge">Cancelled</span>` };
      const emails = regs.filter((r) => r.status === 'confirmed').map((r) => r.email);
      body.innerHTML = html`<p>${NAGP.eventWhen(e)}</p>
        <p class="results-count">${C.plural(data.confirmed, 'confirmed registration')}${e.capacity ? ` (${e.capacity} places)` : ''}</p>
        ${regs.length ? html`
          <div class="actions mt-0 mb-1">
            <a class="btn btn-secondary" href="/api/council/events/${e.id}/registrations?format=csv">Download as spreadsheet (CSV)</a>
            ${emails.length ? html`<button class="btn btn-secondary" type="button" id="copy-reg-emails">Copy the email addresses</button>` : ''}
          </div>
          <div id="reg-status" class="form-status" role="status" aria-live="polite"></div>
          <div class="table-wrap"><table class="table table-stack">
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Paid</th><th scope="col">Registered</th></tr></thead>
            <tbody>${regs.map((r) => html`<tr>
              <td data-label="Name">${r.name}${r.is_member ? html` <span class="badge badge-primary">Member</span>` : ''}</td>
              <td data-label="Email"><a href="mailto:${r.email}">${r.email}</a></td>
              <td data-label="Status">${STATUS[r.status] || r.status}</td>
              <td data-label="Paid">${r.amount_cents ? C.dollars(r.amount_cents) : '-'}</td>
              <td data-label="Registered" class="nowrap">${NAGP.formatShortDate(r.created_at)}</td></tr>`)}</tbody>
          </table></div>` : html`<div class="empty"><p>No one has registered yet.</p></div>`}`;
      const copyBtn = $('#copy-reg-emails');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        const ok = await C.copy(emails.join(', '));
        C.say($('#reg-status'), ok ? 'success' : 'error', ok
          ? `${C.plural(emails.length, 'email address', 'email addresses')} copied. Paste them into the "To" or "Bcc" box of your email.`
          : 'Your browser did not allow copying. Please use the spreadsheet download instead.');
      });
    } catch (err) {
      NAGP.showError(body, err);
    }
  }

  async function act(btn) {
    const li = btn.closest('li[data-id]');
    const e = events.find((x) => String(x.id) === li.dataset.id);
    if (btn.dataset.act === 'edit') { history.replaceState(null, '', `?edit=${e.id}`); showForm(e); return; }
    if (btn.dataset.act === 'regs') { showRegistrations(e); return; }
    const people = e.confirmed + e.waiting;
    const r = await C.ask({
      title: `Delete "${e.title}"?`,
      message: html`<p>The event will be removed from the site for good.
        ${people ? html`<strong>${C.plural(people, 'registration')} will be deleted too.</strong> Payments stay on the Payments page.` : ''}</p>
        <p>If you only want to hide it for now, choose "Edit" and untick "Published" instead.</p>
        <p><strong>Are you sure? This cannot be undone.</strong></p>`,
      confirm: 'Yes, delete the event',
      cancel: 'No, keep it',
      danger: true,
    });
    if (!r.ok) return;
    const res = await C.run(btn, li.querySelector('.form-status'), () => api(`/api/council/events/${e.id}`, { method: 'DELETE' }), 'Deleting…');
    if (!res) return;
    C.say($('#page-status'), 'success', res.message);
    await load();
  }

  NAGP.whenAllowed().then(async () => {
    C.pills($('#event-pills'), (v) => { view = v; $('#page-status').innerHTML = ''; renderList(); });
    $('#event-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) act(b); });
    $('#add-event').addEventListener('click', () => { history.replaceState(null, '', '?new=1'); showForm(null); });
    $$('[data-back]').forEach((b) => b.addEventListener('click', showList));

    const form = $('#event-form');
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', (e) => { if (e.target.name === 'is_online') syncWhere(); updatePreview(); });
    NAGP.form(form, {
      reset: false,
      busyText: 'Saving…',
      onSubmit: async (data) => {
        const res = editingId
          ? await api(`/api/council/events/${editingId}`, { method: 'PUT', body: data })
          : await api('/api/council/events', { method: 'POST', body: data });
        await load();
        const ev = res.event;
        view = !ev.published ? 'unpublished' : ev.is_past ? 'past' : 'upcoming';
        C.setPill($('#event-pills'), view);
        renderList();
        showList();
        C.say($('#page-status'), 'success', res.message);
      },
    });

    await load();
    if (NAGP.qs('new') === '1') showForm(null);
    else if (NAGP.qs('edit')) {
      const ev = events.find((x) => String(x.id) === NAGP.qs('edit'));
      if (ev) showForm(ev);
    }
  });
})();
