// /council/messages — contact-form messages (mark as handled, reply by email) and mailing-list sign-ups.
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let messages = [];
  let subscribers = [];
  let show = 'open';

  /* ---------- Messages ---------- */
  function replyLink(m) {
    const subject = `Re: ${m.topic || 'Your message to NAGP'}`;
    const quoted = `\n\n\nOn ${C.longDate(m.created_at)}, ${m.name} wrote:\n> ${m.message.replace(/\n/g, '\n> ')}`;
    return `mailto:${encodeURIComponent(m.email).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Dear ${m.name},${quoted}`)}`;
  }

  function card(m) {
    return html`<li data-id="${m.id}"><article class="card item-card${m.handled ? ' is-done' : ' is-new'}" aria-labelledby="msg-${m.id}">
      <h3 id="msg-${m.id}">${m.topic || 'Message'} <span class="badges">${m.handled ? html`<span class="badge badge-success">Handled</span>` : html`<span class="badge badge-accent">Not handled yet</span>`}</span></h3>
      <ul class="item-meta">
        <li>From <b>${m.name}</b> (<a href="mailto:${m.email}">${m.email}</a>)</li>
        <li>${C.dateTime(m.created_at)}</li>
      </ul>
      <div class="item-body">${NAGP.paragraphs(m.message)}</div>
      ${/password|sign.?in/i.test(m.topic + ' ' + m.message) ? html`<p class="item-note">Asking about a password? Find them on the <a href="/council/members">Members page</a>, choose "Edit", then "Set a new password".</p>` : ''}
      <div class="actions">
        <a class="btn" href="${replyLink(m)}">Reply by email</a>
        ${m.handled
          ? html`<button class="btn btn-secondary" type="button" data-handled="0">Mark as not handled</button>`
          : html`<button class="btn btn-secondary" type="button" data-handled="1">Mark as handled</button>`}
      </div>
      <div class="form-status" role="status" aria-live="polite"></div>
    </article></li>`;
  }

  function renderMessages() {
    const open = messages.filter((m) => !m.handled);
    $$('#msg-pills [data-count]').forEach((el) => { el.textContent = el.dataset.count === 'open' ? open.length : messages.length; });
    const list = show === 'open' ? open : messages;
    $('#msg-list').innerHTML = list.length
      ? html`<ul class="item-list">${list.map(card)}</ul>`
      : html`<div class="empty"><p><strong>${show === 'open' ? 'All messages have been handled.' : 'No messages yet.'}</strong></p>
          ${show === 'open' && messages.length ? html`<p>Choose "All messages" to see the earlier ones.</p>` : ''}</div>`;
  }

  async function loadMessages() {
    try {
      messages = (await api('/api/council/messages')).messages;
      renderMessages();
    } catch (err) {
      NAGP.showError($('#msg-list'), err);
    }
  }

  async function toggle(btn) {
    const li = btn.closest('li[data-id]');
    const m = messages.find((x) => String(x.id) === li.dataset.id);
    const handled = btn.dataset.handled === '1';
    const res = await C.run(btn, li.querySelector('.form-status'), () => api(`/api/council/messages/${m.id}`, { method: 'POST', body: { handled } }), 'Saving…');
    if (!res) return;
    m.handled = handled;
    if (show === 'open' && handled) {
      li.innerHTML = NAGP.notice('success', `Marked as handled. The message from ${m.name} is now under "All messages".`);
      $$('#msg-pills [data-count="open"]').forEach((el) => { el.textContent = messages.filter((x) => !x.handled).length; });
    } else {
      renderMessages();
    }
  }

  /* ---------- Sign-ups ---------- */
  function renderSubscribers() {
    $('#sub-count').textContent = subscribers.length === 1 ? '1 person has signed up.' : `${subscribers.length} people have signed up.`;
    $('#copy-emails').disabled = !subscribers.length;
    const FORMS = { home: 'Home page', newsletter: 'Mailing list page', membership: 'Membership page', footer: 'Footer' };
    $('#sub-list').innerHTML = subscribers.length
      ? html`<div class="table-wrap"><table class="table table-stack">
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Signed up</th><th scope="col">Where</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>${subscribers.map((s) => html`<tr data-id="${s.id}">
            <td data-label="Name">${[s.first_name, s.last_name].filter(Boolean).join(' ') || html`<span class="muted">Not given</span>`}</td>
            <td data-label="Email"><a href="mailto:${s.email}">${s.email}</a></td>
            <td data-label="Signed up" class="nowrap">${NAGP.formatShortDate(s.created_at)}</td>
            <td data-label="Where">${FORMS[s.source] || s.source || 'Website'}${s.interest ? html`<span class="cell-sub">Interested in ${s.interest}</span>` : ''}</td>
            <td class="cell-actions"><button class="btn btn-small btn-quiet" type="button" data-remove aria-label="Remove ${s.email}">Remove…</button></td>
          </tr>`)}</tbody></table></div>`
      : html`<div class="empty"><p>No one has signed up yet. Sign-ups from the "Stay connected" forms on the website appear here.</p></div>`;
  }

  async function loadSubscribers() {
    try {
      subscribers = (await api('/api/council/subscribers')).subscribers;
      renderSubscribers();
    } catch (err) {
      NAGP.showError($('#sub-list'), err);
    }
  }

  async function removeSubscriber(btn) {
    const s = subscribers.find((x) => String(x.id) === btn.closest('tr').dataset.id);
    const r = await C.ask({
      title: 'Remove this sign-up?',
      message: html`<p>${s.email} will be removed from this list, for example because they asked to unsubscribe.
        If they are already in the Google Group, please remove them there too.</p><p><strong>This cannot be undone.</strong></p>`,
      confirm: 'Yes, remove',
      cancel: 'No, keep',
      danger: true,
    });
    if (!r.ok) return;
    const res = await C.run(btn, $('#sub-status'), () => api(`/api/council/subscribers/${s.id}`, { method: 'DELETE' }), 'Removing…');
    if (!res) return;
    C.say($('#sub-status'), 'success', res.message);
    loadSubscribers();
  }

  NAGP.whenAllowed().then(() => {
    $('#listserv').textContent = (NAGP.config.ORG && NAGP.config.ORG.listserv) || 'the NAGP group';
    C.pills($('#msg-pills'), (v) => { show = v; renderMessages(); });
    $('#msg-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-handled]'); if (b) toggle(b); });
    $('#sub-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-remove]'); if (b) removeSubscriber(b); });
    $('#copy-emails').addEventListener('click', async () => {
      const ok = await C.copy(subscribers.map((s) => s.email).join(', '));
      C.say($('#sub-status'), ok ? 'success' : 'error', ok
        ? `${C.plural(subscribers.length, 'email address', 'email addresses')} copied. Now paste them into Google Groups (step 4 above).`
        : 'Your browser did not allow copying. Please use "Download as spreadsheet" instead.');
    });
    loadMessages();
    loadSubscribers().then(() => { if (location.hash === '#signups') $('#signups').scrollIntoView(); });
  });
})();
