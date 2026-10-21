// /members/: welcome, membership status, quick actions and the latest board topics.
(function () {
  const { $, api, html } = NAGP;

  const SOON_DAYS = 45;

  function statusCard(me) {
    const tier = NAGP.tier(me.tier);
    const expires = me.membership_expires;
    const daysLeft = expires ? Math.ceil((new Date(expires + 'T23:59:59') - Date.now()) / 864e5) : null;
    const active = me.status === 'active';
    let statusText;
    if (active && expires) statusText = html`<span class="badge badge-success">Active</span> until ${NAGP.formatShortDate(expires)}`;
    else if (active) statusText = html`<span class="badge badge-success">Active</span>`;
    else if (me.isCouncil) statusText = html`<span class="badge badge-primary">Council member</span>`;
    else statusText = html`<span class="badge badge-warning">Not active</span>`;

    const pro = me.member_type === 'professional';
    const listed = (on, where) => (on
      ? html`<span class="badge badge-success">Listed</span> You appear in ${where}.`
      : html`<span class="badge">Not listed</span> You do not appear in ${where}.`);

    return html`
      <h2>Your membership</h2>
      ${daysLeft !== null && daysLeft <= SOON_DAYS ? NAGP.notice('warning',
        daysLeft < 0 ? `Your membership ended on ${NAGP.formatShortDate(expires)}. Please renew to keep using the Members' Area.`
          : `Your membership ends on ${NAGP.formatShortDate(expires)}. Please renew soon so you keep your access.`) : ''}
      <div class="status-layout">
      <dl class="status-list">
        <div><dt>Membership</dt><dd>${tier ? tier.name : me.isCouncil ? 'Founding Council' : 'Member'}</dd></div>
        <div><dt>Status</dt><dd>${statusText}</dd></div>
        <div><dt>Members Directory</dt><dd>${listed(me.show_members, 'the members-only directory')}</dd></div>
        <div><dt>Public directory</dt><dd>${pro ? listed(me.show_public, 'the public directory')
          : html`<span class="muted">The public directory is for professional members.</span>`}</dd></div>
      </dl>
      <div class="status-actions">
        <a class="btn btn-block" href="/members/payments">Renew or see my payments</a>
        <a class="btn btn-secondary btn-block" href="/members/profile">Change my listings</a>
      </div>
      </div>`;
  }

  function topics(list) {
    if (!list.length) {
      return html`<div class="empty"><p><strong>No conversations yet.</strong></p><p><a class="btn" href="/members/board#new-topic">Start the first topic</a></p></div>`;
    }
    return html`<ul class="topic-list card divided">${list.map((t) => html`<li class="topic-item${t.hidden ? ' is-hidden' : ''}">
      <h3><a href="/members/topic?id=${t.id}">${t.title}</a> ${NAGP.sampleBadge(t)}</h3>
      <p class="meta topic-stats"><span>Started by ${t.author_name || 'a member (name hidden)'}</span>
        <span>${t.reply_count === 1 ? '1 reply' : `${t.reply_count} replies`}</span>
        <span>Last activity ${NAGP.timeAgo(t.last_activity)}</span></p>
    </li>`)}</ul>`;
  }

  NAGP.whenAllowed().then(async ({ user }) => {
    $('#welcome').textContent = `Welcome, ${user.name}`;
    const statusBox = $('#membership-status');
    const topicBox = $('#recent-topics');
    const [me, board] = await Promise.allSettled([api('/api/me'), api('/api/board', { query: { limit: 3 } })]);
    if (me.status === 'fulfilled') statusBox.innerHTML = statusCard(me.value.user);
    else NAGP.showError(statusBox, me.reason);
    if (board.status === 'fulfilled') topicBox.innerHTML = topics(board.value.topics);
    else NAGP.showError(topicBox, board.reason);
  });
})();
