// /members/announce: submit an announcement, and see your own submissions and their status.
(function () {
  const { $, api, html } = NAGP;
  const form = $('#announce-form');
  const list = $('#my-submissions');

  const STATUS = {
    pending: html`<span class="badge badge-warning">Waiting for approval</span>`,
    approved: html`<span class="badge badge-success">Published</span>`,
    declined: html`<span class="badge badge-danger">Not approved</span>`,
  };

  function submission(a) {
    return html`<li class="submission">
      <h3><a href="/announcement?id=${a.id}">${a.title}</a></h3>
      <p class="meta mb-0">${STATUS[a.status] || ''} ${a.from_council ? html`<span class="badge badge-primary">Official NAGP</span>` : ''}
        ${a.visibility === 'members' ? html`<span class="badge badge-accent">Members only</span>` : ''} ${NAGP.sampleBadge(a)}</p>
      <p class="meta mb-0">${a.category}. Sent ${NAGP.formatShortDate(a.created_at)}${a.status === 'approved' && a.published_at ? `, published ${NAGP.formatShortDate(a.published_at)}` : ''}.</p>
      ${a.status === 'declined' ? NAGP.notice('warning', html`<p><strong>The Council's reason:</strong> ${a.decline_reason || 'No reason was given.'}</p>
        <p>You are welcome to change it and send it again, or <a href="/contact?topic=Announcements">contact the Council</a> with questions.</p>`) : ''}
    </li>`;
  }

  async function loadMine() {
    try {
      const { announcements } = await api('/api/me/announcements');
      list.innerHTML = announcements.length
        ? html`<ul class="list-plain card divided">${announcements.map(submission)}</ul>`
        : html`<div class="empty"><p>You have not sent any announcements yet. When you do, you can follow them here.</p></div>`;
    } catch (err) {
      NAGP.showError(list, err);
    }
  }

  NAGP.whenAllowed().then(({ user }) => {
    const council = !!user.isCouncil;
    const categories = (NAGP.config.ANNOUNCEMENT_CATEGORIES || []).filter((c) => council || c !== 'NAGP news');
    $('#an-category').innerHTML = html`<option value="">Choose a category</option>${categories.map((c) => html`<option>${c}</option>`)}`;
    if (council) {
      $('#an-submit').textContent = 'Publish now';
      $('#how-it-works').innerHTML = html`<h2 id="how-heading" class="h3-size">How it works for the Council</h2>
        <p>Announcements from members wait for Council approval. Yours are published as soon as you press <strong>Publish now</strong>.</p>
        <p>Tick <strong>Post as an official NAGP announcement</strong> for news from NAGP itself. Leave it unticked to share news under your own name.</p>
        <p class="mb-0">Your posts as a Council member are published straight away.</p>`;
    }

    NAGP.form(form, {
      busyText: council ? 'Publishing…' : 'Sending…',
      onSubmit: async (data) => {
        const result = await api('/api/announcements', { method: 'POST', body: data });
        loadMine();
        return result;
      },
      success: (r) => (r.status === 'approved'
        ? html`<div class="notice notice-success" role="status"><span class="notice-title">Your announcement is published.</span>
            <p>It is now on the Announcements page. <a href="/announcement?id=${r.id}">See your announcement</a>.</p></div>`
        : html`<div class="notice notice-success" role="status"><span class="notice-title">Thank you.</span>
            <p>Your announcement was sent to the Council for approval. You'll see it on the <a href="/announcements">Announcements page</a> once it's approved, usually within a few days. You can follow its progress under “Your submissions” below.</p></div>`),
    });
    loadMine();
  });
})();
