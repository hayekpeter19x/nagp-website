// /members/board: list of topics (most recent activity first) and the "Start a new topic" form.
(function () {
  const { $, api, html } = NAGP;
  const box = $('#topics');
  const count = $('#topic-count');

  function topic(t, council) {
    return html`<li class="topic-item${t.hidden ? ' is-hidden' : ''}">
      <h3><a href="/members/topic?id=${t.id}">${t.title}</a> ${NAGP.sampleBadge(t)}
        ${council && t.hidden ? html`<span class="badge badge-danger">Hidden</span>` : ''}
        ${council && t.reports ? html`<span class="badge badge-warning">Reported ${t.reports === 1 ? 'once' : `${t.reports} times`}</span>` : ''}</h3>
      <p class="meta topic-stats"><span>Started by ${t.author_name || 'a member (name hidden)'}${t.mine ? ' (you)' : ''}</span>
        <span>${t.reply_count === 1 ? '1 reply' : `${t.reply_count} replies`}</span>
        <span>Last activity ${NAGP.timeAgo(t.last_activity)}</span></p>
      <p class="topic-excerpt">${t.excerpt}</p>
    </li>`;
  }

  async function load(council) {
    try {
      const { topics } = await api('/api/board');
      count.textContent = topics.length ? `${topics.length} topic${topics.length === 1 ? '' : 's'}, most recent activity first.` : '';
      box.innerHTML = topics.length
        ? html`<ul class="topic-list card divided">${topics.map((t) => topic(t, council))}</ul>`
        : html`<div class="empty"><p><strong>No topics yet.</strong></p><p>Why not start the first conversation? Use the form below.</p></div>`;
    } catch (err) {
      NAGP.showError(box, err);
    }
  }

  NAGP.whenAllowed().then(({ user }) => {
    const council = !!user.isCouncil;
    NAGP.form($('#topic-form'), {
      busyText: 'Posting…',
      onSubmit: async (data) => {
        const result = await api('/api/board', { method: 'POST', body: data });
        load(council);
        return result;
      },
      success: (r) => html`<div class="notice notice-success" role="status"><span class="notice-title">Your topic was posted.</span>
        <p>Other members can now read it and reply. It is at the top of the list above.</p>
        <p><a class="btn" href="/members/topic?id=${r.id}">Go to your topic</a></p></div>`,
    });
    load(council);
  });
})();
