// Receipt page (/payment-complete?order=…&token=…[&session_id=…]): thank you, a printable
// receipt, and what to do next.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const org = (NAGP.config && NAGP.config.ORG) || {};
  const box = $('#complete');
  const titleEl = $('#pc-title');
  const ledeEl = $('#pc-lede');
  const id = NAGP.qs('order') || '';
  const token = NAGP.qs('token') || '';
  const sessionId = NAGP.qs('session_id') || '';
  let session = null;

  const STEP_LABELS = {
    membership: Pay.JOIN_STEPS,
    event: ['Register', 'Payment', 'Receipt'],
    donation: ['Your gift', 'Payment', 'Receipt'],
  };
  const help = html`<p class="mt-2 muted no-print">Questions? <a href="/contact?topic=Payments">Send us a message</a> and include your order number.</p>`;

  const setHeader = (title, lede) => {
    titleEl.textContent = title;
    ledeEl.textContent = lede;
    document.title = `${title} | NAGP`;
  };

  function receipt(order) {
    const demo = order.provider === 'demo';
    const m = order.membership;
    return html`<article class="card receipt" aria-labelledby="receipt-title">
      <div class="receipt-head">
        <div>
          <h2 id="receipt-title">Receipt</h2>
          ${demo ? html`<span class="badge badge-sample">Preview: no money was charged</span>` : ''}
        </div>
        <div class="receipt-org">${org.name || 'NAGP'}${org.short ? ` (${org.short})` : ''}<span>${org.email || ''}</span></div>
      </div>
      <dl class="review-list">
        <div><dt>Order number</dt><dd><span class="order-number">${order.id}</span></dd></div>
        <div><dt>Date paid</dt><dd>${NAGP.formatDate(order.paid_at)}</dd></div>
        <div><dt>Description</dt><dd>${order.description}</dd></div>
        ${order.event ? html`<div><dt>Event date</dt><dd>${NAGP.eventWhen(order.event)}</dd></div>` : ''}
        ${m && m.expires ? html`<div><dt>Membership active until</dt><dd>${NAGP.formatDate(m.expires)}</dd></div>` : ''}
        <div><dt>Amount paid</dt><dd><span class="receipt-amount">${NAGP.money(order.amount_cents)}</span> <span class="muted">(US dollars)</span></dd></div>
        <div><dt>Paid by</dt><dd>${order.name}</dd></div>
        <div><dt>Email</dt><dd>${order.email}</dd></div>
        <div><dt>Payment method</dt><dd>${Pay.methodText(order)}</dd></div>
      </dl>
      ${order.kind === 'donation' ? html`<p class="mt-1">Thank you for your gift to NAGP.</p>
        <span class="placeholder-note">Please confirm whether gifts to NAGP are tax-deductible, and if so, the wording this receipt needs (for example the organization's tax status and EIN).</span>` : ''}
      <div class="actions"><button type="button" class="btn btn-secondary btn-large" data-print>Print this receipt</button></div>
    </article>`;
  }

  function nextSteps(order) {
    const u = session && session.user;
    if (order.kind === 'membership') {
      return html`<div class="card mt-2 no-print">
        <h2>What happens next</h2>
        <ol class="steps">
          <li><strong>Complete your profile.</strong> Add your details so other members can find and contact you${order.membership && order.membership.tier === 'professional' ? ', and check how you appear in the public directory' : ''}.</li>
          <li><strong>Explore the Members' Area:</strong> the member directory, the community board, announcements and documents.</li>
        </ol>
        <div class="actions">
          <a class="btn btn-large" href="/members/profile">Complete your profile</a>
          <a class="btn btn-secondary btn-large" href="/members/profile">Go to My Profile</a>
        </div>
        ${u ? '' : html`<p class="hint mt-1">You will be asked to sign in with your email address and password.</p>`}
      </div>`;
    }
    if (order.kind === 'event' && order.event) {
      const ev = order.event;
      return html`<div class="card mt-2 no-print">
        <h2>Your event</h2>
        <p class="summary-item">${ev.title}</p>
        <ul class="event-facts">
          <li><b>When:</b> ${NAGP.eventWhen(ev)}</li>
          <li><b>Where:</b> ${Pay.where(ev)}</li>
        </ul>
        <p>${ev.is_online ? 'The Zoom link' : 'The venue details'} will be emailed to <strong>${order.email}</strong> before the event.</p>
        <div class="actions">
          <a class="btn" href="/event?id=${ev.id}">See the event details</a>
          <a class="btn btn-secondary" href="/events">See more events</a>
        </div>
      </div>`;
    }
    if (order.kind === 'donation') {
      return html`<div class="card mt-2 no-print">
        <h2>Thank you for supporting NAGP</h2>
        <p>Your gift helps a new professional home for Gestalt practitioners take root. We are truly grateful.</p>
        <div class="actions"><a class="btn" href="/">Back to the home page</a><a class="btn btn-secondary" href="/events">See upcoming events</a></div>
      </div>`;
    }
    return '';
  }

  function showPaid(order) {
    setHeader('Thank you!', 'Your payment was received.');
    const labels = STEP_LABELS[order.kind] || Pay.OTHER_STEPS;
    const m = order.membership;
    const renewal = m && m.reason === 'renew';
    const [noticeTitle, headline] = {
      membership: [renewal ? 'Your membership is renewed' : 'Welcome to NAGP!', m && m.expires
        ? `Your membership is active until ${NAGP.formatDate(m.expires)}.`
        : 'Your membership is now active.'],
      event: ["You're registered!", order.event ? `Your place at "${order.event.title}" is confirmed.` : 'Your registration is confirmed.'],
      donation: ['Thank you for your gift!', `Your gift of ${NAGP.money(order.amount_cents)} was received.`],
    }[order.kind] || ['Payment received', 'Your payment was received.'];
    const u = session && session.user;
    const keep = u
      ? html`<p>A copy of this receipt is kept in <a href="/members/payments">My Membership</a>.</p>`
      : html`<p>Please print this receipt or bookmark this page for your records.</p>`;
    box.innerHTML = html`${Pay.steps(labels, labels.length)}
      ${NAGP.notice('success', html`<p>${headline}</p>${keep}`, noticeTitle)}
      ${receipt(order)}
      ${nextSteps(order)}
      ${help}`;
  }

  async function load(attempt = 0) {
    if (!session) session = await NAGP.ready;
    if (!id || !token) {
      setHeader('We could not find your payment', 'The link to this page is not complete.');
      box.innerHTML = html`${NAGP.notice('error', 'Please use the whole link, or look for your receipts in My Membership in the Members’ Area.')}${help}`;
      return;
    }
    let data;
    try {
      data = await api(`/api/orders/${encodeURIComponent(id)}`, { query: { token, session_id: sessionId } });
    } catch (err) {
      setHeader('We could not find your payment', 'Something went wrong while looking up your payment.');
      NAGP.showError(box, err);
      box.insertAdjacentHTML('beforeend', String(help));
      return;
    }
    const { order } = data;
    if (order.status === 'paid') { showPaid(order); return; }

    if (order.status === 'pending' && sessionId && data.payments === 'stripe' && attempt < 10) {
      setHeader('Confirming your payment', 'This usually takes just a few seconds.');
      box.innerHTML = html`<p class="loading">We are confirming your payment with Stripe. Please keep this page open…</p>`;
      setTimeout(() => load(attempt + 1), 2000);
      return;
    }
    if (order.status === 'pending' && sessionId) {
      setHeader('Your payment is being confirmed', 'This is taking a little longer than usual.');
      box.innerHTML = html`${NAGP.notice('info', html`<p>If you finished paying on the Stripe page, you do not need to do anything else. Your payment will show as paid in My Membership within a few minutes, and you can come back to this page for your receipt.</p>
        <p>Your order number is <span class="order-number">${order.id}</span>.</p>`, 'Still confirming')}
        <div class="actions"><button type="button" class="btn" id="pc-retry">Check again</button></div>${help}`;
      $('#pc-retry').addEventListener('click', () => { NAGP.loading(box, 'Checking your payment…'); load(0); });
      return;
    }
    if (order.status === 'pending') {
      setHeader('Not paid yet', 'This order has not been paid yet.');
      box.innerHTML = html`${NAGP.notice('warning', 'We have not received a payment for this order yet. You can pay now, by card or by check.', 'Not paid yet')}
        <div class="actions"><a class="btn btn-accent btn-large" href="${order.links.checkout}">Go to payment: ${NAGP.money(order.amount_cents)}</a></div>${help}`;
      return;
    }
    setHeader('This payment was cancelled', 'Nothing was charged.');
    box.innerHTML = html`${NAGP.notice('info', 'This order was cancelled, so nothing was charged. If you still want to go ahead, please start again.')}${help}`;
  }

  load();
})();
