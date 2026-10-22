// /members/topic?id=N: one board topic with its replies and a reply form.
// Council members also get "Hide this post" / "Show it again" under each post.
(function () {
  const { $, api, html } = NAGP;
  const id = NAGP.qs('id');
  const thread = $('#thread');
  const status = $('#topic-status');
  let council = false;

  function when(iso) {
    return `${NAGP.formatShortDate(iso)} at ${NAGP.formatTime(iso, undefined, { zone: false })}`;
  }

  function author(p) {
    if (p.author_name) return p.author_name + (p.mine ? ' (you)' : '');
    return p.mine ? 'Your post' : 'Name hidden';
  }

  function post(p, first) {
    const concealed = p.hidden && !council;
    return html`<article class="post${first ? ' post-first' : ''}${p.hidden ? ' post-hidden' : ''}" id="post-${p.id}"
        aria-label="${first ? 'Topic' : 'Reply'} by ${author(p)}">
      <header class="post-header">
        <div class="avatar" aria-hidden="true">${concealed ? '–' : NAGP.initials(p.author_name)}</div>
        <div><span class="post-author">${author(p)}</span><span class="post-when">${when(p.created_at)}</span></div>
        <div class="post-badges">${NAGP.sampleBadge(p)}
          ${council && p.hidden ? html`<span class="badge badge-danger">Hidden</span>` : ''}</div>
      </header>
      ${council && p.hidden ? html`<div class="council-note"><p><strong>For the Council:</strong> this post is hidden. Members see only
        “This post was hidden by the Council…”.${p.hidden_reason ? html` Reason: ${p.hidden_reason}` : ''}</p></div>` : ''}
      <div class="post-body${concealed ? ' post-placeholder' : ''}">${NAGP.paragraphs(p.body)}</div>
      ${council ? html`<footer class="post-footer">${p.hidden
        ? html`<button type="button" class="link-button" data-moderate="unhide" data-post="${p.id}">Show this post again</button>`
        : html`<button type="button" class="link-button" data-moderate="hide" data-post="${p.id}">Hide this post</button>`}</footer>` : ''}
    </article>`;
  }

  async function load() {
    if (!id || !/^\d+$/.test(id)) {
      $('#topic-title').textContent = 'Topic not found';
      thread.innerHTML = NAGP.notice('error', 'This link is missing the topic number. Please go back to the Community Board.');
      return;
    }
    try {
      const { topic, replies } = await api('/api/board/' + id);
      document.title = `${topic.title} | NAGP`;
      $('#topic-title').textContent = topic.title;
      $('#topic-meta').textContent = topic.author_name
        ? `Started by ${topic.author_name} on ${NAGP.formatShortDate(topic.created_at)}` : '';
      const n = replies.length;
      thread.innerHTML = html`${post(topic, true)}
        <h2 class="replies-heading">${n ? `${n} ${n === 1 ? 'reply' : 'replies'}` : 'No replies yet'}</h2>
        ${n ? replies.map((r) => post(r, false)) : html`<p class="muted">Be the first to reply.</p>`}`;
      const closed = topic.hidden && !council;
      $('#reply-area').hidden = closed;
      if (closed) thread.insertAdjacentHTML('beforeend', String(NAGP.notice('info', 'This topic was hidden by the Council, so it is closed to new replies.')));
    } catch (err) {
      $('#topic-title').textContent = 'Topic not found';
      NAGP.showError(thread, err);
    }
  }

  // Council only: hide a post (members then see a short note instead), or show it again.
  thread.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-moderate]');
    if (!btn) return;
    let body = { action: 'unhide' };
    if (btn.dataset.moderate === 'hide') {
      const r = await Council.ask({
        title: 'Hide this post?',
        message: 'Members will see a short note that the post was hidden by the Council, without its text or the author\'s name. You can show it again at any time.',
        input: { label: 'Reason', hint: 'For the Council\'s records only. Members do not see it.' },
        confirm: 'Hide the post',
        cancel: 'Go back',
      });
      if (!r.ok) return;
      body = { action: 'hide', reason: r.value };
    }
    const res = await Council.run(btn, status, () => api(`/api/council/board/${btn.dataset.post}`, { method: 'POST', body }), 'Saving…');
    if (!res) return;
    await load();
    Council.say(status, 'success', res.message);
  });

  NAGP.whenAllowed().then(({ user }) => {
    council = !!user.isCouncil;

    NAGP.form($('#reply-form'), {
      busyText: 'Posting…',
      onSubmit: async (data) => {
        const result = await api(`/api/board/${id}/replies`, { method: 'POST', body: data });
        await load();
        return result;
      },
      success: 'Your reply was posted. You can see it at the end of the conversation above.',
    });

    load();
  });
})();
