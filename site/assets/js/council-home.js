// /council/ — the Council dashboard: what needs attention, numbers at a glance, and the
// "Before launch" box for deleting the sample data.
(function () {
  const { $, api, html } = NAGP;
  const { plural } = Council;

  function attentionList(a) {
    const items = [
      a.pending_announcements && {
        n: a.pending_announcements, href: '/council/approvals',
        text: a.pending_announcements === 1 ? '1 announcement is waiting for your approval' : `${a.pending_announcements} announcements are waiting for your approval`,
        cta: 'Review announcements',
      },
      a.open_reports && {
        n: a.open_reports, href: '/council/approvals#reports',
        text: a.open_reports === 1 ? '1 community board post was reported by a member' : `${a.open_reports} community board posts were reported by members`,
        cta: 'Look at the reported posts',
      },
      a.unread_messages && {
        n: a.unread_messages, href: '/council/messages',
        text: a.unread_messages === 1 ? '1 message from the contact form has not been answered yet' : `${a.unread_messages} messages from the contact form have not been answered yet`,
        cta: 'Read the messages',
      },
      a.open_feedback && {
        n: a.open_feedback, href: '/council/feedback',
        text: a.open_feedback === 1 ? '1 comment about the new website is waiting' : `${a.open_feedback} comments about the new website are waiting`,
        cta: 'See the website feedback',
      },
    ].filter(Boolean);

    if (!items.length) {
      return html`<div class="card all-clear"><span class="all-clear-mark" aria-hidden="true">&#10003;</span>
        <div><strong>You are all caught up.</strong> Nothing needs your attention right now.</div></div>`;
    }
    return html`<ul class="attention-list">${items.map((i) => html`<li>
      <a class="card card-link attention-card" href="${i.href}">
        <span class="attention-count" aria-hidden="true">${i.n}</span>
        <span class="attention-text"><strong>${i.text}</strong><span class="card-cta">${i.cta}</span></span>
      </a></li>`)}</ul>`;
  }

  function glance(g) {
    const stat = (label, value, note) => html`<div class="stat"><dt>${label}</dt><dd>${value}${note ? html`<span class="stat-note">${note}</span>` : ''}</dd></div>`;
    return html`<dl class="stat-grid">
      ${stat('Active members', g.active_members, g.waiting_for_payment ? `plus ${g.waiting_for_payment} who started joining but have not paid` : '')}
      ${stat('New members', g.new_members_30d, 'in the last 30 days')}
      ${stat('Mailing list sign-ups', g.subscribers, 'from the website forms')}
      ${stat('Upcoming events', g.upcoming_events, 'published on the Events page')}
      ${stat('Payments received', NAGP.money(g.payments_30d_cents, { free: '$0' }), `${plural(g.payments_30d_count, 'payment')} in the last 30 days`)}
    </dl>`;
  }

  function launchBox(sample, user) {
    const box = $('#launch-box');
    if (!sample.total) { box.hidden = true; return; }
    box.hidden = false;
    const noRealCouncil = !sample.real_council_accounts;
    $('#launch-text').innerHTML = html`
      <p>So you can see how the site will look, the preview contains made-up <strong>sample data</strong>:
        ${plural(sample.accounts, 'sample account')} (including the demo accounts used by the one-click sign-in)
        and ${plural(sample.other, 'other sample item')} (announcements, events, documents and community board posts).
        Each one is marked with a "Sample" tag.</p>
      <p>When the Council is ready to go live, delete all of it here. Real members, messages and mailing-list sign-ups are kept.</p>
      ${noRealCouncil ? NAGP.notice('warning', html`<p>First, make sure each Council member has their own account with a password.
        On the <a href="/council/members">Members page</a>, choose "Add a member by hand", then "Edit" and set their role to Council.
        Otherwise nobody could sign in to the Council Area afterwards, because the demo accounts are removed too.</p>`, 'One step first') : ''}`;
    const btn = $('#delete-sample');
    btn.disabled = noRealCouncil;
    btn.onclick = async () => {
      const choice = await Council.ask({
        title: 'Delete all sample data?',
        message: html`<p>This permanently deletes:</p>
          <ul>
            <li>all ${plural(sample.accounts, 'sample account')}, <strong>including the demo accounts</strong>. The one-click "Try it as…" sign-in on the sign-in page will stop working;</li>
            <li>the sample announcements, events, documents and community board posts;</li>
            <li>any registrations, payments and sign-ins that belong to them.</li>
          </ul>
          <p>Real members, messages, mailing-list sign-ups and website comments are kept.</p>
          ${user.sample ? html`<p><strong>You are using the demo Council account, so you will be signed out.</strong> Sign in again with your own account afterwards.</p>` : ''}
          <p><strong>Are you sure? This cannot be undone.</strong></p>`,
        confirm: 'Yes, delete the sample data',
        cancel: 'No, keep it',
        danger: true,
      });
      if (!choice.ok) return;
      const status = $('#launch-status');
      const res = await Council.run(btn, status, () => api('/api/council/sample-data/delete', { method: 'POST', body: { confirm: true } }), 'Deleting…');
      if (!res) return;
      const d = res.deleted;
      const parts = [
        d.users && plural(d.users, 'account'), d.announcements && plural(d.announcements, 'announcement'),
        d.events && plural(d.events, 'event'), d.documents && plural(d.documents, 'document'),
        d.board_posts && plural(d.board_posts, 'community board post'), d.registrations && plural(d.registrations, 'registration'),
        d.orders && plural(d.orders, 'payment record'),
      ].filter(Boolean);
      const done = html`<p>${res.message}</p>${parts.length ? html`<p>Deleted: ${parts.join(', ')}.</p>` : ''}`;
      if (res.signed_out) {
        status.innerHTML = NAGP.notice('success', html`${done}<p>You were signed out because the demo account is gone.</p>
          <p><a class="btn" href="/signin?next=/council/">Sign in with your own account</a></p>`, 'Done');
        btn.hidden = true;
        $('#launch-text').innerHTML = '';
      } else {
        status.innerHTML = NAGP.notice('success', done, 'Done');
        btn.hidden = true;
        $('#launch-text').innerHTML = '';
        load(user, { keepLaunch: true });
      }
    };
  }

  async function load(user, { keepLaunch = false } = {}) {
    try {
      const s = await api('/api/council/summary');
      $('#attention').innerHTML = attentionList(s.attention);
      $('#glance').innerHTML = glance(s.glance);
      if (!keepLaunch) launchBox(s.sample, user);
    } catch (err) {
      NAGP.showError($('#attention'), err);
      $('#glance').innerHTML = '';
    }
  }

  NAGP.whenAllowed().then(({ user }) => {
    $('#welcome').textContent = `Welcome, ${user.name}`;
    load(user);
  });
})();
