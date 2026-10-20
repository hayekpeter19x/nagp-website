// /announcement?id=N: one announcement on its own page (easy to share or print).
(function () {
  const { $, api, html } = NAGP;
  const box = $('#ann');
  const id = NAGP.qs('id');

  const STATUS = {
    pending: ['warning', 'Waiting for approval', 'Only you and the Council can see this page until the Council approves it.'],
    declined: ['error', 'Not approved', 'The Council did not approve this announcement, so it is not shown to others.'],
  };

  async function load() {
    if (!id || !/^\d+$/.test(id)) {
      $('#ann-title').textContent = 'Announcement not found';
      box.innerHTML = NAGP.notice('error', 'This link is missing the announcement number. Please go back to the list of announcements.');
      return;
    }
    try {
      const { announcement: a } = await api('/api/announcements/' + id);
      document.title = `${a.title} | NAGP`;
      $('#ann-title').textContent = a.title;
      $('#ann-meta').textContent = `Posted ${NAGP.formatDate(a.published_at || a.created_at)} by ${a.author_name}`;
      $('#ann-badges').innerHTML = html`<div class="ann-badges">
        ${a.from_council ? html`<span class="badge badge-primary">Official NAGP</span>` : ''}
        ${a.visibility === 'members' ? html`<span class="badge badge-accent">Members only</span>` : ''}
        <span class="badge">${a.category}</span>${NAGP.sampleBadge(a)}</div>`;
      const status = STATUS[a.status];
      const link = /^https?:\/\//i.test(a.link_url) ? a.link_url : '';
      box.innerHTML = html`
        ${status ? NAGP.notice(status[0], html`<p>${status[2]}</p>${a.decline_reason ? html`<p><strong>Reason:</strong> ${a.decline_reason}</p>` : ''}`, status[1]) : ''}
        <div class="ann-body prose">${NAGP.paragraphs(a.body)}</div>
        ${link ? html`<p class="ann-link">More information: <a href="${link}" rel="noopener nofollow">${link}</a></p>` : ''}`;
    } catch (err) {
      $('#ann-title').textContent = err.status === 401 || err.status === 403 ? 'For members only' : 'Announcement not found';
      NAGP.showError(box, err);
    }
  }

  NAGP.ready.then(load);
})();
