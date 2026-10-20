// My Payments (/members/payments): finish joining, membership status and renewal,
// event registrations and payment history. Signed-in people who have not paid yet can see this page.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const box = $('#mp-content');
  const tiers = (NAGP.config && NAGP.config.MEMBERSHIP_TIERS) || [];

  const tierOptions = (selected) => html`${tiers.map((t) => html`<option value="${t.key}"${t.key === selected ? NAGP.raw(' selected') : ''}>${t.name}: ${NAGP.money(t.price_cents)} a year</option>`)}`;

  // A small form: membership type + "Renew for one year: $75" (also used to finish joining).
  const renewForm = (selected, verb) => html`<form class="renew-form" id="renew-form" novalidate data-verb="${verb}">
      <div class="field">
        <label for="renew-tier">Membership type</label>
        <select id="renew-tier" name="tier">${tierOptions(selected)}</select>
      </div>
      <button class="btn btn-accent btn-large" type="submit">${verb}</button>
      <div class="form-status" role="status" aria-live="polite"></div>
    </form>
    ${Pay.samplePriceNote()}`;

  function finishJoining(m, user) {
    const o = m.pending_order;
    if (o) {
      return html`<section class="mp-section">
        ${Pay.steps(Pay.JOIN_STEPS, 3, 'Joining, step by step')}
        <div class="card card-highlight">
          <h2>Finish joining</h2>
          <p class="lede">Welcome, ${user.name}. Your application is saved. The last step is to pay for your membership.</p>
          <div class="summary-box">
            <p class="summary-item">${o.description}</p>
            <div class="summary-row summary-total"><span>Total</span><span class="amount">${NAGP.money(o.amount_cents)}</span></div>
            ${Pay.samplePriceNote()}
          </div>
          <div class="actions"><a class="btn btn-accent btn-large" href="${o.links.checkout}">Pay ${NAGP.money(o.amount_cents)}</a></div>
          <p class="hint mt-1">On the next page you can pay by card, or choose to pay by check.</p>
          <details class="mt-1">
            <summary>Choose a different type of membership</summary>
            ${renewForm(o.tier || m.tier, 'Continue')}
          </details>
        </div>
      </section>`;
    }
    return html`<section class="mp-section">
      <div class="card card-highlight">
        <h2>Finish joining</h2>
        <p class="lede">Welcome, ${user.name}. To become a member, choose your type of membership and pay for one year.</p>
        ${renewForm(m.tier || 'professional', 'Continue to payment')}
      </div>
    </section>`;
  }

  function membershipCard(m) {
    const badge = m.is_member && !m.expired ? html`<span class="badge badge-success">Active</span>`
      : m.status === 'lapsed' || m.expired ? html`<span class="badge badge-warning">Ended</span>`
        : html`<span class="badge">Not active</span>`;
    let text;
    if (!m.is_member || m.expired) text = 'Renew to restore your member benefits. Your new year starts on the day you pay.';
    else if (m.days_left !== null && m.days_left <= 60) text = 'Your membership ends soon. Renew now to keep your member benefits. Renewing adds one year to your current end date.';
    else text = 'You can renew early at any time. Renewing adds one year to your current end date, so you do not lose any time.';
    const o = m.pending_order;
    return html`<section class="mp-section card">
      <h2>Your membership</h2>
      <ul class="meta-list">
        <li><b>Membership type:</b> ${m.tier_name || 'Not chosen yet'}</li>
        <li class="status-line"><b>Status:</b> ${badge}</li>
        ${m.expires ? html`<li><b>${m.expired ? 'Ended on' : 'Active until'}:</b> ${NAGP.formatDate(m.expires)}</li>` : ''}
      </ul>
      ${o ? html`<div class="mt-1">${NAGP.notice('warning', html`<p>You started a renewal (${o.description}) but have not paid yet.</p>
          <p><a class="btn btn-accent" href="${o.links.checkout}">Pay ${NAGP.money(o.amount_cents)}</a></p>`, 'Renewal not finished')}</div>` : ''}
      <h3 class="mp-sub">Renew your membership</h3>
      <p>${text}</p>
      ${renewForm(m.tier || 'associate', 'Renew for one year')}
    </section>`;
  }

  function registrationsSection(regs) {
    return html`<section class="mp-section">
      <h2>My event registrations</h2>
      ${regs.length ? html`<ul class="reg-list divided">${regs.map((r) => html`<li>
          <h3><a href="/event?id=${r.event.id}">${r.event.title}</a> ${NAGP.sampleBadge(r.event)}</h3>
          <p class="meta mb-0">${NAGP.eventWhen(r.event)} · ${Pay.where(r.event)}</p>
          <p class="status-line mt-1 mb-0">
            ${r.is_past ? html`<span class="badge">Past event</span>` : Pay.statusBadge(r.status === 'confirmed' ? 'confirmed' : 'pending')}
            ${!r.is_past && r.status === 'pending' && r.links ? html`<a class="btn btn-accent btn-small" href="${r.links.checkout}">Finish payment: ${NAGP.money(r.amount_cents)}</a>` : ''}
            ${r.status === 'confirmed' && r.links ? html`<a href="${r.links.receipt}">Receipt<span class="visually-hidden"> for ${r.event.title}</span></a>` : ''}
          </p>
        </li>`)}</ul>`
        : html`<div class="empty"><p>You have not registered for any events yet.</p><p><a class="btn btn-secondary" href="/events">See upcoming events</a></p></div>`}
    </section>`;
  }

  function historySection(orders) {
    return html`<section class="mp-section">
      <h2>Payment history</h2>
      ${orders.length ? html`<div class="table-wrap"><table class="table table-stack">
          <caption class="visually-hidden">Your payments, newest first</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">What for</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Receipt</th></tr></thead>
          <tbody>${orders.map((o) => html`<tr>
            <td data-label="Date">${NAGP.formatShortDate(o.paid_at || o.created_at)}</td>
            <td data-label="What for">${o.description}</td>
            <td data-label="Amount">${NAGP.money(o.amount_cents)}</td>
            <td data-label="Status">${Pay.statusBadge(o.status)}</td>
            <td data-label="Receipt">${o.status === 'paid' ? html`<a href="${o.links.receipt}">View receipt<span class="visually-hidden"> for ${o.description}</span></a>`
              : o.status === 'pending' ? html`<a href="${o.links.checkout}">Pay now<span class="visually-hidden">: ${o.description}</span></a>` : ''}</td>
          </tr>`)}</tbody>
        </table></div>`
        : html`<div class="empty"><p>No payments yet.</p></div>`}
      <p class="mt-1 muted">Paid by check? The Council records check payments by hand, so they can take a little while to appear here. Questions about a payment? <a href="/contact?topic=Payments">Send us a message</a>.</p>
    </section>`;
  }

  function wireRenew() {
    const form = $('#renew-form');
    if (!form) return;
    const select = $('#renew-tier');
    const btn = form.querySelector('[type="submit"]');
    const label = () => {
      const t = NAGP.tier(select.value);
      btn.textContent = t ? `${form.dataset.verb}: ${NAGP.money(t.price_cents)}` : form.dataset.verb;
    };
    select.addEventListener('change', label);
    label();
    NAGP.form(form, {
      reset: false,
      busyText: 'One moment…',
      onSubmit: async (data) => {
        const res = await api('/api/membership/renew', { method: 'POST', body: { tier: data.tier } });
        Pay.go(res.checkout_url);
        return new Promise(() => {});
      },
    });
  }

  async function load(session) {
    let data;
    try {
      data = await api('/api/me/orders');
    } catch (err) {
      NAGP.showError(box, err);
      return;
    }
    const m = data.membership;
    const user = session.user;
    const joining = !m.is_member && m.status === 'pending';
    box.innerHTML = html`${joining ? finishJoining(m, user) : membershipCard(m)}
      ${registrationsSection(data.registrations)}
      ${historySection(data.orders)}`;
    wireRenew();
  }

  NAGP.whenAllowed().then(load);
})();
