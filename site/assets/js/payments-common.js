// Small helpers shared by the payments, joining and events pages (window.NAGPPay).
(function () {
  const { html } = NAGP;
  const cfg = NAGP.config || {};
  const preview = !!(cfg.ORG && cfg.ORG.preview);

  const Pay = (window.NAGPPay = {});

  Pay.JOIN_STEPS = ['Choose membership', 'Your details', 'Review', 'Payment'];
  Pay.OTHER_STEPS = ['Your details', 'Payment', 'Receipt'];

  // <ol class="steps-inline"> with the steps before `current` (0-based) marked done.
  // current = labels.length marks every step done.
  Pay.steps = (labels, current, label = 'Progress') => html`<ol class="steps-inline" aria-label="${label}">${labels.map((l, i) => (
    i < current ? html`<li class="done"><span class="visually-hidden">Done: </span>${l}</li>`
      : i === current ? html`<li aria-current="step">${l}</li>` : html`<li>${l}</li>`))}</ol>`;

  Pay.samplePriceNote = () => (preview ? html`<span class="sample-price">Sample price, to be confirmed by the Council</span>` : '');

  // "Free", "$40", "Members $295 · Non-members $375", "Free for members · Non-members $15"
  Pay.priceText = (ev) => {
    const m = ev.price_member_cents || 0;
    const p = ev.price_public_cents || 0;
    if (ev.members_only) return m ? `${NAGP.money(m)} (members only)` : 'Free for members';
    if (!m && !p) return 'Free';
    if (m === p) return NAGP.money(p);
    if (!m) return `Free for members · Non-members ${NAGP.money(p)}`;
    return `Members ${NAGP.money(m)} · Non-members ${NAGP.money(p)}`;
  };

  Pay.eventBadges = (ev) => html`<ul class="tag-list" aria-label="About this event">
    <li><span class="badge badge-primary">${ev.category}</span></li>
    <li><span class="badge">${ev.is_online ? 'Online' : 'In person'}</span></li>
    ${ev.members_only ? html`<li><span class="badge badge-accent">Members only</span></li>` : ''}
    ${ev.my_registration && ev.my_registration.status === 'confirmed' ? html`<li><span class="badge badge-success">You are registered</span></li>` : ''}
    ${ev.my_registration && ev.my_registration.status === 'pending' ? html`<li><span class="badge badge-warning">Payment not finished</span></li>` : ''}
    ${ev.sample ? html`<li>${NAGP.sampleBadge(ev)}</li>` : ''}
  </ul>`;

  // "Only 3 places left" when few remain (null = unlimited).
  Pay.spotsText = (ev) => {
    if (ev.spots_left === null || ev.spots_left === undefined || ev.is_past) return '';
    if (ev.spots_left <= 0) return 'This event is full';
    if (ev.spots_left <= 10) return ev.spots_left === 1 ? 'Only 1 place left' : `Only ${ev.spots_left} places left`;
    return '';
  };

  Pay.methodText = (order) => ({
    demo: 'Card (simulated for the preview, no money was charged)',
    stripe: 'Card, paid securely through Stripe',
    manual: 'Check or cash, recorded by the NAGP Council',
  }[order.provider] || 'Card');

  Pay.statusBadge = (status) => ({
    paid: html`<span class="badge badge-success">Paid</span>`,
    pending: html`<span class="badge badge-warning">Not paid yet</span>`,
    cancelled: html`<span class="badge">Cancelled</span>`,
    refunded: html`<span class="badge">Refunded</span>`,
    confirmed: html`<span class="badge badge-success">Confirmed</span>`,
  }[status] || html`<span class="badge">${status}</span>`);

  Pay.lockIcon = () => NAGP.raw('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 1 1 6 0v3H9V7zm3 7a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14z"/></svg>');

  // Where = "Online (Zoom)" or the place.
  Pay.where = (ev) => ev.location || (ev.is_online ? 'Online' : 'To be announced');

  // Any button with data-print prints the page (receipts, check instructions).
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-print]')) window.print();
  });

  // Safe local redirects only (for ?next= style links coming back from the server).
  Pay.go = (url) => {
    const u = String(url || '');
    if (u.startsWith('/') && !u.startsWith('//')) location.href = u;
    else if (/^https:\/\/checkout\.stripe\.com\//.test(u)) location.href = u;
    else location.href = '/';
  };
})();
