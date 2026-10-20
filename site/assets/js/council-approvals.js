// /council/approvals — approve or decline members' announcements, and moderate reported board posts.
(function () {
  const { $, $$, api, html } = NAGP;
  const C = Council;
  let view = 'pending';
  const cache = new Map(); // announcement id -> row (for dialogs)

  /* ---------- Announcements ---------- */

  function setCounts(counts) {
    $$('#ann-pills [data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] ?? ''; });
  }

  function annCard(a) {
    const visibility = a.visibility === 'members' ? 'Members only' : 'Everyone (public)';
    const meta = html`<ul class="item-meta">
      <li>From <b>${a.author_name}</b>${a.author_email && !a.from_council ? html` (<a href="mailto:${a.author_email}">${a.author_email}</a>)` : ''}</li>
      <li>Sent ${C.longDate(a.created_at)}</li>
      <li>Category: <b>${a.category}</b></li>
      <li>Who will see it: <b>${visibility}</b></li>
      ${a.status === 'approved' && a.published_at ? html`<li>Published ${C.longDate(a.published_at)}${a.reviewed_by_name ? ` (approved by ${a.reviewed_by_name})` : ''}</li>` : ''}
      ${a.status === 'declined' && a.reviewed_at ? html`<li>Not approved on ${C.longDate(a.reviewed_at)}${a.reviewed_by_name ? ` by ${a.reviewed_by_name}` : ''}</li>` : ''}
    </ul>`;
    let actions;
    if (a.status === 'pending') {
      actions = html`<button class="btn btn-large btn-approve" type="button" data-act="approve">Approve</button>
        <button class="btn btn-danger btn-large" type="button" data-act="decline">Decline…</button>`;
    } else if (a.status === 'approved') {
      actions = html`<a class="btn btn-secondary" href="/announcement?id=${a.id}">See it on the site</a>
        <button class="btn btn-secondary" type="button" data-act="unpublish">Unpublish…</button>
        <button class="btn btn-danger" type="button" data-act="delete">Delete…</button>`;
    } else {
      actions = html`<button class="btn" type="button" data-act="approve">Approve after all</button>
        <button class="btn btn-danger" type="button" data-act="delete">Delete…</button>`;
    }
    return html`<li data-id="${a.id}"><article class="card item-card${a.status === 'pending' ? ' is-new' : ''}" aria-labelledby="ann-${a.id}">
      <h3 id="ann-${a.id}">${a.title} <span class="badges">${a.from_council ? html`<span class="badge badge-primary">Official NAGP</span>` : ''}${NAGP.sampleBadge(a)}</span></h3>
      ${meta}
      <div class="item-body">${NAGP.paragraphs(a.body)}
        ${a.link_url ? html`<p>Link: <a href="${a.link_url}" rel="noopener nofollow" target="_blank">${a.link_url}</a></p>` : ''}</div>
      ${a.status === 'declined' ? html`<p class="item-note"><b>Reason given to the member:</b> ${a.decline_reason || '(no reason given)'}</p>` : ''}
      <div class="actions">${actions}</div>
      <div class="form-status" role="status" aria-live="polite"></div>
    </article></li>`;
  }

  const EMPTY = {
    pending: html`<div class="empty"><p><strong>Nothing is waiting for approval.</strong></p><p>When a member sends an announcement, it will appear here.</p></div>`,
    approved: html`<div class="empty"><p>No announcements are published yet.</p></div>`,
    declined: html`<div class="empty"><p>No announcements have been declined.</p></div>`,
  };

  async function loadAnnouncements() {
    const list = $('#ann-list');
    NAGP.loading(list);
    try {
      const data = await api('/api/council/announcements', { query: { status: view } });
      setCounts(data.counts);
      cache.clear();
      data.announcements.forEach((a) => cache.set(String(a.id), a));
      list.innerHTML = data.announcements.length
        ? html`<p class="results-count">${resultsText(data.announcements.length)}</p><ul class="item-list">${data.announcements.map(annCard)}</ul>`
        : EMPTY[view];
    } catch (err) {
      NAGP.showError(list, err);
    }
  }

  function resultsText(n) {
    if (view === 'pending') return n === 1 ? '1 announcement is waiting. The oldest is shown first.' : `${n} announcements are waiting. The oldest is shown first.`;
    if (view === 'approved') return `${C.plural(n, 'published announcement')}, newest first.`;
    return `${C.plural(n, 'announcement')} not approved, newest first.`;
  }

  async function refreshCounts() {
    try { setCounts((await api('/api/council/announcements', { query: { status: view } })).counts); } catch { /* ignore */ }
  }

  async function annAction(btn) {
    const li = btn.closest('li[data-id]');
    const a = cache.get(li.dataset.id);
    const box = li.querySelector('.form-status');
    const act = btn.dataset.act;
    let reason = '';
    if (act === 'decline') {
      const r = await C.ask({
        title: 'Decline this announcement?',
        message: html`<p>"${a.title}" will not be posted. ${a.from_council ? '' : `${a.author_name} will see on their page that it was not approved.`}</p>`,
        input: { label: 'Reason for the member', multiline: true, hint: 'For example: "Thank you! Please add the date and a registration link, then send it again." The member sees this.' },
        confirm: 'Decline',
        cancel: 'Go back',
      });
      if (!r.ok) return;
      reason = r.value;
    } else if (act === 'unpublish') {
      const r = await C.ask({
        title: 'Take this announcement off the site?',
        message: html`<p>"${a.title}" will no longer be shown on the Announcements page. You can approve it again later from "Not approved".</p>`,
        input: { label: 'Reason for the member', multiline: true, hint: 'The member who wrote it sees this on their page.' },
        confirm: 'Unpublish',
        cancel: 'Go back',
      });
      if (!r.ok) return;
      reason = r.value;
    } else if (act === 'delete') {
      const r = await C.ask({
        title: 'Delete this announcement?',
        message: html`<p>"${a.title}" will be removed for good, including from the member's own list.</p><p><strong>Are you sure? This cannot be undone.</strong></p>`,
        confirm: 'Yes, delete it',
        cancel: 'No, keep it',
        danger: true,
      });
      if (!r.ok) return;
    }
    const res = await C.run(btn, box, () => api(`/api/council/announcements/${a.id}`, { method: 'POST', body: { action: act, reason } }), 'Saving…');
    if (!res) return;
    // Replace the card with a plain confirmation, so the place in the list is not lost.
    li.innerHTML = NAGP.notice('success', res.message);
    refreshCounts();
  }

  /* ---------- Community board reports ---------- */
  const posts = new Map();

  function reportCard(p) {
    const what = p.is_reply ? html`A reply in the topic "${p.title}"` : html`The topic "${p.title}"`;
    const open = p.reports.filter((r) => !r.resolved);
    return html`<li data-post="${p.id}"><article class="card item-card${p.open_reports ? ' is-new' : ''}" aria-labelledby="post-${p.id}">
      <h3 id="post-${p.id}">${what} ${NAGP.sampleBadge(p)} ${p.hidden ? html`<span class="badge badge-warning">Hidden</span>` : ''}</h3>
      <ul class="item-meta">
        <li>Written by <b>${p.author_name}</b></li>
        <li>${C.longDate(p.created_at)}</li>
        ${p.open_reports ? html`<li><b>Reported ${p.open_reports === 1 ? 'once' : `${p.open_reports} times`}</b></li>` : ''}
      </ul>
      <div class="item-body">${NAGP.paragraphs(p.body)}</div>
      ${open.length ? html`<p><b>What members said:</b></p><ul>${open.map((r) => html`<li>${r.reporter_name}, ${C.longDate(r.created_at)}: ${r.reason ? html`"${r.reason}"` : html`<span class="muted">(no reason given)</span>`}</li>`)}</ul>` : ''}
      ${p.hidden ? html`<p class="item-note">Hidden. Members see only a short note that this post was hidden by the Council, without its text or the author's name.${p.hidden_reason ? html` <b>Reason (Council records only):</b> ${p.hidden_reason}` : ''}</p>` : ''}
      <div class="actions">
        ${p.hidden
          ? html`<button class="btn" type="button" data-act="unhide">Show it again</button>`
          : html`<button class="btn" type="button" data-act="hide">Hide it…</button>`}
        ${p.open_reports && !p.hidden ? html`<button class="btn btn-secondary" type="button" data-act="keep">Keep it (it is fine)</button>` : ''}
        <button class="btn btn-danger" type="button" data-act="delete">Delete…</button>
        <a class="btn btn-quiet" href="/members/topic?id=${p.topic_id}">Open on the board</a>
      </div>
      <div class="form-status" role="status" aria-live="polite"></div>
    </article></li>`;
  }

  async function loadReports() {
    const list = $('#report-list');
    try {
      const data = await api('/api/council/reports');
      posts.clear();
      const shown = data.posts.filter((p) => p.open_reports || p.hidden);
      shown.forEach((p) => posts.set(String(p.id), p));
      list.innerHTML = shown.length
        ? html`<ul class="item-list">${shown.map(reportCard)}</ul>`
        : html`<div class="empty"><p><strong>No reported posts.</strong> The community board has nothing that needs looking at.</p></div>`;
    } catch (err) {
      NAGP.showError(list, err);
    }
  }

  async function postAction(btn) {
    const li = btn.closest('li[data-post]');
    const p = posts.get(li.dataset.post);
    const box = li.querySelector('.form-status');
    const act = btn.dataset.act;
    let call;
    if (act === 'hide') {
      const r = await C.ask({
        title: 'Hide this post?',
        message: 'Members will see a short note that the post was hidden by the Council, without its text or the author\'s name. You can show it again at any time.',
        input: { label: 'Reason', hint: 'For the Council\'s records only, for example which guideline it did not follow. Members do not see it.' },
        confirm: 'Hide the post',
        cancel: 'Go back',
      });
      if (!r.ok) return;
      call = { action: 'hide', reason: r.value };
    } else if (act === 'delete') {
      const r = await C.ask({
        title: p.is_reply ? 'Delete this reply?' : 'Delete this whole topic?',
        message: html`<p>${p.is_reply ? 'The reply will be removed from the board for good.' : 'The topic and all of its replies will be removed from the board for good.'}
          If you might want it back, choose "Hide" instead.</p><p><strong>Are you sure? This cannot be undone.</strong></p>`,
        confirm: 'Yes, delete it',
        cancel: 'No, keep it',
        danger: true,
      });
      if (!r.ok) return;
      call = { action: 'delete' };
    } else if (act === 'unhide') {
      call = { action: 'unhide' };
    }
    const res = await C.run(btn, box, () => (act === 'keep'
      ? api(`/api/council/reports/${p.reports.find((r) => !r.resolved).id}/resolve`, { method: 'POST' })
      : api(`/api/council/board/${p.id}`, { method: 'POST', body: call })), 'Saving…');
    if (!res) return;
    li.innerHTML = NAGP.notice('success', res.message);
  }

  NAGP.whenAllowed().then(() => {
    const wanted = location.hash.replace('#', '');
    if (['pending', 'approved', 'declined'].includes(wanted)) { view = wanted; C.setPill($('#ann-pills'), view); }
    C.pills($('#ann-pills'), (value) => { view = value; $('#ann-status').innerHTML = ''; loadAnnouncements(); });
    $('#ann-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) annAction(b); });
    $('#report-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) postAction(b); });
    loadAnnouncements();
    loadReports().then(() => { if (location.hash === '#reports') $('#reports').scrollIntoView(); });
  });
})();
