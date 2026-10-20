// Events page: upcoming events (with category filter pills) and past events.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  let upcoming = [];
  let category = '';

  const dateBlock = (ev) => {
    const d = NAGP.dateParts(ev.starts_at, ev.timezone);
    return html`<div class="date-block" aria-hidden="true"><span class="month">${d.month}</span><span class="day">${d.day}</span><span class="weekday">${d.weekday}</span></div>`;
  };

  const eventCard = (ev) => {
    const spots = Pay.spotsText(ev);
    const mine = ev.my_registration;
    let cta = html`<a class="btn" href="/event?id=${ev.id}">Details and registration<span class="visually-hidden">: ${ev.title}</span></a>`;
    if (mine && mine.status === 'confirmed') cta = html`<a class="btn btn-secondary" href="/event?id=${ev.id}">See details<span class="visually-hidden">: ${ev.title}</span></a>`;
    else if (ev.registration_state === 'full' || ev.registration_state === 'closed') cta = html`<a class="btn btn-secondary" href="/event?id=${ev.id}">See details<span class="visually-hidden">: ${ev.title}</span></a>`;
    return html`<article class="card event-card">
      <div class="event-item">
        ${dateBlock(ev)}
        <div>
          ${Pay.eventBadges(ev)}
          <h3><a href="/event?id=${ev.id}">${ev.title}</a></h3>
          <ul class="event-facts">
            <li><b>When:</b> ${NAGP.eventWhen(ev)}</li>
            <li><b>Where:</b> ${Pay.where(ev)}</li>
            <li><b>Price:</b> ${Pay.priceText(ev)}</li>
            ${spots ? html`<li class="spots-low">${spots}</li>` : ''}
          </ul>
          ${ev.summary ? html`<p>${ev.summary}</p>` : ''}
          <div class="actions mt-0">${cta}</div>
        </div>
      </div>
    </article>`;
  };

  function renderPills() {
    const cats = [...new Set(upcoming.map((e) => e.category))];
    const order = NAGP.config.EVENT_CATEGORIES || [];
    cats.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    const pills = $('#event-filters');
    if (cats.length < 2) { pills.hidden = true; return; }
    pills.hidden = false;
    pills.innerHTML = html`<li><button type="button" data-category="" aria-pressed="${String(!category)}">All events</button></li>
      ${cats.map((c) => html`<li><button type="button" data-category="${c}" aria-pressed="${String(category === c)}">${c}</button></li>`)}`;
  }

  function renderUpcoming() {
    const list = category ? upcoming.filter((e) => e.category === category) : upcoming;
    const box = $('#events-list');
    const count = $('#events-count');
    if (!upcoming.length) {
      count.textContent = '';
      box.innerHTML = html`<div class="empty"><p><strong>There are no upcoming events right now.</strong></p>
        <p>New salons and presentations will be posted here. <a href="/newsletter">Join the mailing list</a> to hear about them first.</p></div>`;
      return;
    }
    count.textContent = category
      ? `${list.length} upcoming ${list.length === 1 ? 'event' : 'events'} in "${category}"`
      : `${list.length} upcoming ${list.length === 1 ? 'event' : 'events'}`;
    box.innerHTML = list.length
      ? html`<div class="event-list">${list.map(eventCard)}</div>`
      : html`<div class="empty"><p>No upcoming events of this kind right now.</p><p><button type="button" class="btn btn-secondary" data-category="">Show all events</button></p></div>`;
  }

  function choose(cat) {
    category = cat;
    renderPills();
    renderUpcoming();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-category]');
    if (b) choose(b.dataset.category);
  });

  async function loadUpcoming() {
    const box = $('#events-list');
    try {
      const { events } = await api('/api/events', { query: { when: 'upcoming' } });
      upcoming = events;
      renderPills();
      renderUpcoming();
    } catch (err) {
      NAGP.showError(box, err);
    }
  }

  async function loadPast() {
    const box = $('#past-list');
    try {
      const { events } = await api('/api/events', { query: { when: 'past', limit: 20 } });
      if (!events.length) { box.innerHTML = html`<p class="muted">No past events yet.</p>`; return; }
      box.innerHTML = html`<div class="divided">${events.map((ev) => html`<div class="event-item">
        ${dateBlock(ev)}
        <div>
          <h3><a href="/event?id=${ev.id}">${ev.title}</a> ${NAGP.sampleBadge(ev)}</h3>
          <p class="meta mb-0">${NAGP.formatShortDate(ev.starts_at, ev.timezone)} · ${Pay.where(ev)}</p>
          ${ev.summary ? html`<p class="mb-0">${ev.summary}</p>` : ''}
        </div>
      </div>`)}</div>`;
    } catch (err) {
      NAGP.showError(box, err);
    }
  }

  loadUpcoming();
  loadPast();
})();
