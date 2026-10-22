// /council/ — the Council dashboard: what needs attention, and numbers at a glance.
(function () {
  const { $, api, html } = NAGP;
  const { plural } = Council;

  function attentionList(a) {
    const items = [
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
      ${stat('Active members', g.active_members, [
        g.expired_members ? `${g.expired_members} more ${g.expired_members === 1 ? 'has' : 'have'} not renewed` : '',
        g.waiting_for_payment ? `${g.waiting_for_payment} started joining but did not pay` : '',
      ].filter(Boolean).join('; '))}
      ${stat('New members', g.new_members_30d, 'in the last 30 days')}
      ${stat('Mailing list sign-ups', g.subscribers, 'from the website forms')}
      ${stat('Upcoming events', g.upcoming_events, 'published on the Events page')}
      ${stat('Payments received', Council.dollars(g.payments_30d_cents), `${plural(g.payments_30d_count, 'payment')} in the last 30 days`)}
    </dl>`;
  }

  async function load() {
    try {
      const s = await api('/api/council/summary');
      $('#attention').innerHTML = attentionList(s.attention);
      $('#glance').innerHTML = glance(s.glance);
    } catch (err) {
      NAGP.showError($('#attention'), err);
      $('#glance').innerHTML = '';
    }
  }

  NAGP.whenAllowed().then(load);
})();
