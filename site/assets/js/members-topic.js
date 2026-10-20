// /members/topic?id=N: one board topic with its replies, a reply form, and "Report" for each post.
(function () {
  const { $, api, html } = NAGP;
  const id = NAGP.qs('id');
  const thread = $('#thread');
  const dialog = $('#report-dialog');
  const reportForm = $('#report-form');
  let council = false;

  function when(iso) {
    return `${NAGP.formatShortDate(iso)} at ${NAGP.formatTime(iso, undefined, { zone: false })}`;
  }

  function author(p) {
    if (p.author_name) return p.author_name + (p.mine ? ' (you)' : '');
    return p.mine ? 'Your post' : 'Name hidden';
  }

  function reportControl(p) {
    if (p.mine || p.hidden) return '';
    if (p.reported_by_me) return html`<span>You reported this post. Thank you.</span>`;
    return html`<button type="button" class="link-button" data-report="${p.id}">Report this post</button>`;
  }

  function post(p, first) {
    const concealed = p.hidden && !council;
    return html`<article class="post${first ? ' post-first' : ''}${p.hidden ? ' post-hidden' : ''}" id="post-${p.id}"
        aria-label="${first ? 'Topic' : 'Reply'} by ${author(p)}">
      <header class="post-header">
        <div class="avatar" aria-hidden="true">${concealed ? '–' : NAGP.initials(p.author_name)}</div>
        <div><span class="post-author">${author(p)}</span><span class="post-when">${when(p.created_at)}</span></div>
        <div class="post-badges">${NAGP.sampleBadge(p)}
          ${council && p.hidden ? html`<span class="badge badge-danger">Hidden</span>` : ''}
          ${council && p.reports ? html`<span class="badge badge-warning">Reported ${p.reports === 1 ? 'once' : `${p.reports} times`}</span>` : ''}</div>
      </header>
      ${council && p.hidden ? html`<div class="council-note"><p><strong>For the Council:</strong> this post is hidden. Members see only
        “This post was hidden by the Council…”.${p.hidden_reason ? html` Reason: ${p.hidden_reason}` : ''}</p></div>` : ''}
      <div class="post-body${concealed ? ' post-placeholder' : ''}">${NAGP.paragraphs(p.body)}</div>
      <footer class="post-footer">${reportControl(p)}
        ${council && (p.hidden || p.reports) ? html`<a href="/council/approvals#reports">Manage this in the Council Area</a>` : ''}</footer>
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

  // ----- Report dialog -----
  function openReport(postId) {
    reportForm.reset();
    NAGP.clearErrors(reportForm);
    reportForm.elements.namedItem('post_id').value = postId;
    reportForm.querySelector('[type="submit"]').hidden = false;
    reportForm.querySelector('[data-close]').textContent = 'Cancel';
    dialog.showModal();
    $('#report-reason').focus();
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  thread.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-report]');
    if (btn) openReport(btn.dataset.report);
  });

  NAGP.whenAllowed().then(({ user }) => {
    council = !!user.isCouncil;

    NAGP.form(reportForm, {
      reset: false,
      onSubmit: async (data) => {
        await api(`/api/board/${encodeURIComponent(data.post_id)}/report`, { method: 'POST', body: { reason: data.reason } });
        reportForm.querySelector('[type="submit"]').hidden = true;
        reportForm.querySelector('[data-close]').textContent = 'Close';
        load();
      },
      success: 'Thank you. Your report was sent to the Council. They will read the post and decide what to do. You can close this box now.',
    });

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
