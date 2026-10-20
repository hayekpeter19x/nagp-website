// Home page: the next few events and the latest announcements.
// If either list cannot be loaded (or is empty), a calm message is shown instead.
(function () {
  const { $, api, html } = NAGP;

  const listOf = (data, key) => (data && Array.isArray(data[key]) ? data[key] : []);

  // Cut long text at a word boundary, for short previews.
  const excerpt = (text, max = 170) => {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    const cut = s.lastIndexOf(' ', max);
    return s.slice(0, cut > 60 ? cut : max).replace(/[,.;:!?\s]+$/, '') + '…';
  };

  /* ---------- Upcoming events ---------- */
  const eventsBox = $('#home-events');

  const eventsEmpty = () => html`<div class="empty home-empty">
    <p><strong>Upcoming events will be posted here.</strong></p>
    <p>The Founding Council is planning salons, presentations and community meetings.
      Join the mailing list above to hear about them first.</p>
    <p class="mb-0"><a href="/events">Visit the Events page</a></p>
  </div>`;

  const eventItem = (ev) => {
    const parts = NAGP.dateParts(ev.starts_at, ev.timezone);
    const where = ev.location || (ev.is_online ? 'Online' : '');
    return html`<li class="card card-flat event-item">
      <div class="date-block" aria-hidden="true">
        <span class="month">${parts.month}</span><span class="day">${parts.day}</span><span class="weekday">${parts.weekday}</span>
      </div>
      <div>
        <h3><a href="/event?id=${ev.id}">${ev.title}</a> ${NAGP.sampleBadge(ev)}</h3>
        <p class="meta">${NAGP.eventWhen(ev)}</p>
        ${where ? html`<p class="meta">${where}</p>` : ''}
        ${ev.summary ? html`<p>${excerpt(ev.summary, 150)}</p>` : ''}
      </div>
    </li>`;
  };

  async function loadEvents() {
    if (!eventsBox) return;
    try {
      const data = await api('/api/events', { query: { when: 'upcoming', limit: 3 } });
      const events = listOf(data, 'events').filter((ev) => ev && ev.title && ev.starts_at).slice(0, 3);
      eventsBox.innerHTML = events.length
        ? html`<ul class="home-list">${events.map(eventItem)}</ul>
          <p class="list-more"><a href="/events">See all events</a></p>`
        : eventsEmpty();
    } catch {
      eventsBox.innerHTML = eventsEmpty();
    }
  }

  /* ---------- Latest announcements ---------- */
  const newsBox = $('#home-announcements');

  const newsEmpty = () => html`<div class="empty home-empty">
    <p><strong>News from NAGP will be posted here.</strong></p>
    <p>Announcements come from the Founding Council and from members. Members can send an announcement, and the Council approves it before it appears.</p>
    <p class="mb-0"><a href="/announcements">Visit the Announcements page</a></p>
  </div>`;

  const newsItem = (a) => {
    const when = a.published_at || a.created_at;
    const from = a.from_council ? 'NAGP Founding Council' : a.author_name;
    return html`<li class="card card-flat">
      <p class="meta">${[a.category, when ? NAGP.formatShortDate(when) : ''].filter(Boolean).join(' · ')}</p>
      <h3><a href="/announcement?id=${a.id}">${a.title}</a> ${NAGP.sampleBadge(a)}</h3>
      ${from ? html`<p class="meta">From ${from}</p>` : ''}
      ${a.body ? html`<p>${excerpt(a.body)}</p>` : ''}
    </li>`;
  };

  async function loadNews() {
    if (!newsBox) return;
    try {
      const data = await api('/api/announcements', { query: { limit: 3 } });
      const items = listOf(data, 'announcements').filter((a) => a && a.title).slice(0, 3);
      newsBox.innerHTML = items.length
        ? html`<ul class="home-list">${items.map(newsItem)}</ul>
          <p class="list-more"><a href="/announcements">Read all announcements</a></p>`
        : newsEmpty();
    } catch {
      newsBox.innerHTML = newsEmpty();
    }
  }

  loadEvents();
  loadNews();
})();
