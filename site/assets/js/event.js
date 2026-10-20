// Event page (/event?id=N): full details and the registration form.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const id = NAGP.qs('id');
  let ev = null;
  let session = null;

  const header = $('#event-header');
  const body = $('#event-body');

  const zoneName = (iso, tz) => {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName');
      return part ? part.value : '';
    } catch { return ''; }
  };

  // For online events, also show the time where the visitor is, if that is different.
  const localTime = () => {
    let here = '';
    try { here = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
    if (!ev.is_online || !here || here === ev.timezone) return '';
    if (NAGP.formatTime(ev.starts_at, here) === NAGP.formatTime(ev.starts_at, ev.timezone)) return '';
    return html`<span class="hint mt-0">In your time zone, it starts ${NAGP.formatDate(ev.starts_at, here)}, at ${NAGP.formatTime(ev.starts_at, here)}.</span>`;
  };

  function notFound(err) {
    document.title = 'Event not found | NAGP';
    header.innerHTML = html`<h1>Event not found</h1>`;
    body.innerHTML = html`<div class="container-narrow">${NAGP.notice('error', (err && err.message) || 'We could not find that event. The link may be incomplete.')}
      <p><a class="btn" href="/events">See all events and trainings</a></p></div>`;
  }

  function render() {
    document.title = `${ev.title} | NAGP`;
    header.innerHTML = html`${Pay.eventBadges(ev)}<h1>${ev.title}</h1>${ev.summary ? html`<p class="lede">${ev.summary}</p>` : ''}
      ${ev.registration_state === 'open' ? html`<a class="btn btn-accent jump-register" href="#register-box">Go to registration</a>` : ''}`;
    const zone = zoneName(ev.starts_at, ev.timezone);
    body.innerHTML = html`<div class="split">
      <div>
        <div class="card">
          <h2>Details</h2>
          <ul class="event-facts meta-list">
            <li><b>When:</b> ${NAGP.eventWhen(ev)}${zone ? html` <span class="muted">(${zone})</span>` : ''}${localTime()}</li>
            <li><b>Where:</b> ${Pay.where(ev)}${ev.is_online ? html` <span class="muted">(the link is emailed to everyone who registers)</span>` : ''}</li>
            ${ev.presenter ? html`<li><b>Presenter:</b> ${ev.presenter}</li>` : ''}
            <li><b>Price:</b> ${Pay.priceText(ev)}</li>
            ${ev.ce_info ? html`<li><b>Continuing education:</b> ${ev.ce_info}</li>` : ''}
          </ul>
        </div>
        ${ev.description ? html`<h2 class="mt-2">About this event</h2><div class="prose">${NAGP.paragraphs(ev.description)}</div>` : ''}
        ${!ev.published ? NAGP.notice('warning', 'This event is not published yet. Only the Council can see this page.') : ''}
      </div>
      <aside class="event-aside" aria-labelledby="register-title">
        <div class="card card-highlight" id="register-box"></div>
      </aside>
    </div>`;
    renderRegister();
  }

  function priceBlock() {
    const u = session.user;
    const isMember = !!(u && u.isMember);
    const price = ev.your_price_cents;
    const differs = ev.price_member_cents !== ev.price_public_cents;
    const next = encodeURIComponent(location.pathname + location.search);
    let note = '';
    if (isMember && differs) note = html`<p class="muted">This is the member price.</p>`;
    if (!isMember && !ev.members_only && ev.price_member_cents < ev.price_public_cents) {
      const memberPrice = ev.price_member_cents ? `Members pay ${NAGP.money(ev.price_member_cents)}.` : 'Members attend free.';
      note = u
        ? html`<p>${memberPrice} <a href="/members/payments">Finish joining NAGP</a> to get the member price.</p>`
        : html`<p>${memberPrice} <a href="/signin?next=${next}">Sign in</a> if you are a member, or <a href="/join">become a member</a>.</p>`;
    }
    return html`<p class="eyebrow mb-0">${isMember && differs ? 'Your price (member)' : 'Price'}</p>
      <p class="event-price-big">${price ? NAGP.money(price) : 'Free'}</p>${note}`;
  }

  function renderRegister() {
    const box = $('#register-box');
    const u = session.user;
    const isMember = !!(u && u.isMember);
    const mine = ev.my_registration;
    const title = html`<h2 id="register-title">Registration</h2>`;
    const spots = Pay.spotsText(ev);
    const contact = html`<p>Questions? <a href="/contact?topic=${encodeURIComponent('Events')}">Send us a message</a>.</p>`;

    if (mine && mine.status === 'confirmed') {
      box.innerHTML = html`${title}${NAGP.notice('success', html`<p>You are registered for this event. We look forward to seeing you.</p>
        <p>${ev.is_online ? 'The Zoom link' : 'The venue details'} will be emailed to you before the event.</p>`, "You're registered")}
        <p><a href="/members/payments">See all your registrations and receipts</a></p>${contact}`;
      return;
    }
    const closed = {
      past: ['This event has already taken place', 'Registration is closed. Take a look at our upcoming events instead.'],
      started: ['This event has already started', 'Registration is now closed.'],
      closed: ['Registration is closed', 'Registration for this event is closed.'],
      full: ['This event is full', 'All places have been taken. Contact us if you would like to hear about a place opening up.'],
    }[ev.registration_state];
    if (closed) {
      box.innerHTML = html`${title}${NAGP.notice(ev.registration_state === 'full' ? 'warning' : 'info', closed[1], closed[0])}
        <p><a class="btn btn-secondary" href="/events">See upcoming events</a></p>${contact}`;
      return;
    }
    if (ev.members_only && !isMember) {
      const next = encodeURIComponent(location.pathname + location.search);
      box.innerHTML = html`${title}${NAGP.notice('info', u
        ? 'This event is for members with an active membership. Once your membership payment is complete, you can register here.'
        : 'This event is for NAGP members. Please sign in to register.', 'For members')}
        <div class="actions mt-0">${u
          ? html`<a class="btn btn-accent" href="/members/payments">Finish joining</a>`
          : html`<a class="btn" href="/signin?next=${next}">Sign in</a><a class="btn btn-secondary" href="/join">Become a member</a>`}</div>`;
      return;
    }
    if (mine && mine.status === 'pending' && mine.checkout_url) {
      box.innerHTML = html`${title}${priceBlock()}
        ${NAGP.notice('warning', 'You started registering, but the payment is not finished yet. Your place is confirmed once it is paid.', 'Almost done')}
        <a class="btn btn-accent btn-large btn-block" href="${mine.checkout_url}">Finish payment: ${NAGP.money(ev.your_price_cents)}</a>
        <p class="hint mt-1">You can also pay by check. You will see how on the next page.</p>`;
      return;
    }

    const price = ev.your_price_cents;
    box.innerHTML = html`${title}${priceBlock()}
      ${spots ? html`<p class="spots-low">${spots}</p>` : ''}
      <form id="register-form" class="form" novalidate>
        <div class="field">
          <label for="reg-name">Your name</label>
          <input id="reg-name" name="name" type="text" autocomplete="name" required value="${u ? u.name : ''}">
        </div>
        <div class="field">
          <label for="reg-email">Email address</label>
          <span class="hint" id="reg-email-hint">We will send your confirmation and the ${ev.is_online ? 'Zoom link' : 'event details'} here.</span>
          <input id="reg-email" name="email" type="email" autocomplete="email" required aria-describedby="reg-email-hint" value="${u ? u.email : ''}">
        </div>
        <div class="hp-field" aria-hidden="true"><label>Leave this empty <input name="hp" tabindex="-1" autocomplete="off"></label></div>
        <button class="btn btn-accent btn-large btn-block" type="submit">${price ? `Register and pay ${NAGP.money(price)}` : 'Register (free)'}</button>
        ${price ? html`<p class="hint mt-1">Next you will see a summary and can pay by card or by check.</p>` : ''}
        <div class="form-status" role="status" aria-live="polite"></div>
      </form>`;

    const form = $('#register-form');
    NAGP.form(form, {
      reset: false,
      busyText: price ? 'One moment…' : 'Registering…',
      onSubmit: async (data) => {
        const res = await api(`/api/events/${ev.id}/register`, { method: 'POST', body: data });
        if (res.status === 'pending' && res.checkout_url) {
          Pay.go(res.checkout_url);
          return new Promise(() => {}); // keep the button busy while the next page loads
        }
        box.innerHTML = html`${title}<div class="notice notice-success" role="status" tabindex="-1" id="reg-done">
            <span class="notice-title">You're registered!</span>
            <p>Thank you, ${data.name}. Your place at "${ev.title}" is confirmed.</p>
            <p>${ev.is_online ? 'The Zoom link' : 'The venue details'} will be emailed to <strong>${String(data.email || '').trim()}</strong> before the event.</p>
          </div>
          <div class="actions mt-0"><a class="btn btn-secondary" href="/events">See more events</a></div>`;
        $('#reg-done').focus();
        return null;
      },
    });
  }

  async function load() {
    session = await NAGP.ready;
    if (!/^\d+$/.test(id || '')) { notFound(); return; }
    try {
      ev = (await api(`/api/events/${id}`)).event;
    } catch (err) {
      notFound(err);
      return;
    }
    render();
  }

  load();
})();
