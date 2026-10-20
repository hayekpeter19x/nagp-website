// Checkout page (/checkout?order=…&token=…): order summary, then pay by card (simulated in the
// preview, or Stripe's secure page) or by check.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const box = $('#checkout');
  const id = NAGP.qs('order') || '';
  const token = NAGP.qs('token') || '';
  const cameBack = NAGP.qs('cancelled') === '1';

  const STEP_LABELS = {
    membership: Pay.JOIN_STEPS,
    event: ['Register', 'Payment', 'Receipt'],
    donation: ['Your gift', 'Payment', 'Receipt'],
  };
  const steps = (order, done = false) => {
    const labels = STEP_LABELS[order.kind] || Pay.OTHER_STEPS;
    const payIndex = labels.indexOf('Payment');
    return Pay.steps(labels, done ? labels.length : payIndex);
  };

  const help = html`<p class="mt-2 muted">Questions or problems? <a href="/contact?topic=Payments">Send us a message</a> and include your order number.</p>`;

  function summary(order) {
    const ev = order.event;
    return html`<div class="summary-box">
      <h2>Your order</h2>
      <p class="summary-item">${order.description}</p>
      ${ev ? html`<div class="summary-row"><span>When</span><span>${NAGP.eventWhen(ev)}</span></div>
        <div class="summary-row"><span>Where</span><span>${Pay.where(ev)}</span></div>` : ''}
      <div class="summary-row"><span>Name</span><span>${order.name}</span></div>
      <div class="summary-row"><span>Email</span><span>${order.email}</span></div>
      <div class="summary-row"><span>Order number</span><span class="order-number">${order.id}</span></div>
      <div class="summary-row summary-total"><span>Total to pay</span><span class="amount">${NAGP.money(order.amount_cents)}</span></div>
      ${order.kind === 'membership' ? Pay.samplePriceNote() : ''}
    </div>`;
  }

  function payCard(order, mode) {
    const amount = NAGP.money(order.amount_cents);
    const status = html`<div class="form-status" id="pay-status" role="status" aria-live="polite"></div>`;
    if (mode === 'demo') {
      return html`<div class="card pay-card">
        <h2>Pay by card</h2>
        ${NAGP.notice('warning', 'No real money is charged. This is how the payment step will look.', 'This is a preview')}
        <div class="sim-card" role="group" aria-label="Card details (simulated)">
          <div class="field"><label for="sim-name">Name on the card</label><input id="sim-name" type="text" value="${order.name}" readonly></div>
          <div class="field"><label for="sim-number">Card number</label><input id="sim-number" type="text" value="4242 4242 4242 4242" readonly></div>
          <div class="sim-card-row">
            <div class="field mb-0"><label for="sim-exp">Expiry date</label><input id="sim-exp" type="text" value="12 / 30" readonly></div>
            <div class="field mb-0"><label for="sim-cvc">Security code</label><input id="sim-cvc" type="text" value="123" readonly></div>
          </div>
          <p class="hint mt-1 mb-0">These boxes are already filled in with a test card for the preview. Please do not type a real card number.</p>
        </div>
        <button type="button" class="btn btn-accent btn-large btn-block btn-pay" id="pay-btn">Pay ${amount}</button>
        ${status}
      </div>`;
    }
    if (mode === 'stripe') {
      return html`<div class="card pay-card">
        <h2>Pay by card</h2>
        <p>When you press the button, you will go to <strong>Stripe</strong>, a secure payment service used by millions of organizations, to type in your card details. NAGP never sees or keeps your card number. When you are done, you will come straight back here for your receipt.</p>
        <button type="button" class="btn btn-accent btn-large btn-block btn-pay" id="pay-btn">Pay ${amount}</button>
        <p class="secure-note">${Pay.lockIcon()}<span>Your card details are entered on Stripe's secure page, not on this website.</span></p>
        ${status}
      </div>`;
    }
    return html`<div class="card pay-card">${NAGP.notice('info', 'Paying by card on the website is not available yet. Please pay by check, as explained below, or contact us.', 'Card payments are not available yet')}</div>`;
  }

  function checkCard(order) {
    const after = {
      membership: "Your membership starts as soon as the Council records your check. In the meantime you can already sign in and fill in your profile.",
      event: 'Your place is confirmed once the Council records your check.',
      donation: 'The Council will record your gift when the check arrives. Thank you!',
    }[order.kind] || '';
    return html`<div class="card check-option">
      <h2>Prefer to pay by check?</h2>
      <p>That is fine. Please make out a check for <strong>${NAGP.money(order.amount_cents)}</strong> and write your order number, <span class="order-number">${order.id}</span>, on the memo line so we know what it is for.</p>
      <span class="placeholder-note">Please supply the mailing address for checks and the exact name checks should be made out to. The Council records check payments by hand (in the Council area, under Payments), which marks this order as paid.</span>
      ${after ? html`<p>${after}</p>` : ''}
      <div class="actions mt-0"><button type="button" class="btn btn-secondary" data-print>Print this page</button></div>
    </div>`;
  }

  function wirePay(mode) {
    const btn = $('#pay-btn');
    if (!btn) return;
    const status = $('#pay-status');
    btn.addEventListener('click', async () => {
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = mode === 'demo' ? 'Processing your payment…' : 'Opening the secure payment page…';
      status.innerHTML = '';
      try {
        if (mode === 'demo') {
          const res = await api('/api/checkout/demo-complete', { method: 'POST', body: { id, token } });
          Pay.go(res.receipt_url);
        } else {
          const res = await api(`/api/orders/${encodeURIComponent(id)}`, { method: 'POST', body: { token } });
          Pay.go(res.checkout_url);
        }
      } catch (err) {
        status.innerHTML = NAGP.notice('error', err.message);
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  async function load() {
    await NAGP.ready;
    if (!id || !token) {
      box.innerHTML = html`${NAGP.notice('error', 'This payment link is not complete. Please use the whole link, or start again.', 'We could not find your order')}${help}`;
      return;
    }
    let data;
    try {
      data = await api(`/api/orders/${encodeURIComponent(id)}`, { query: { token } });
    } catch (err) {
      NAGP.showError(box, err);
      box.insertAdjacentHTML('beforeend', String(help));
      return;
    }
    const { order } = data;
    const mode = data.payments === 'stripe' ? 'stripe' : data.demo_payments ? 'demo' : 'none';

    if (order.status === 'paid') {
      box.innerHTML = html`${steps(order, true)}${NAGP.notice('success', 'This has already been paid. Thank you!', 'Nothing more to pay')}
        <div class="actions"><a class="btn btn-large" href="${order.links.receipt}">See your receipt</a></div>`;
      return;
    }
    if (order.status !== 'pending') {
      box.innerHTML = html`${NAGP.notice('info', 'This payment was cancelled, so there is nothing to pay. If you still want to go ahead, please start again.', 'This payment was cancelled')}
        <div class="actions"><a class="btn" href="${order.kind === 'event' ? (order.event ? `/event?id=${order.event.id}` : '/events') : order.kind === 'donation' ? '/donate' : '/members/payments'}">Start again</a></div>${help}`;
      return;
    }

    const parts = [steps(order)];
    if (cameBack) {
      parts.push(NAGP.notice('info', 'Your payment was not finished, and nothing was charged. You can try again below whenever you are ready, or pay by check instead.', 'No problem'));
    }
    parts.push(summary(order));
    if (order.problem) {
      parts.push(html`<div class="mt-2">${NAGP.notice('error', order.problem, 'This cannot be paid now')}</div>
        <div class="actions"><a class="btn" href="/events">See upcoming events</a><a class="btn btn-secondary" href="/contact?topic=Events">Contact us</a></div>`);
      box.innerHTML = html`${parts}`;
      return;
    }
    parts.push(payCard(order, mode), checkCard(order), help);
    box.innerHTML = html`${parts}`;
    wirePay(mode);
  }

  load();
})();
