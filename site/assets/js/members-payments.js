// My Membership (/members/payments): finish joining, membership status, renew, cancel,
// event registrations and payment history. Signed-in people who have not paid yet can see this page.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const box = $('#mp-content');
  const tiers = (NAGP.config && NAGP.config.MEMBERSHIP_TIERS) || [];

  const membership = tiers[0] || { price_cents: 0 };

  // A single button: "Renew for one year: X$" (also used to finish joining). One membership for everyone.
  const renewForm = (verb) => html`<form class="renew-form" id="renew-form" novalidate>
      <button class="btn btn-accent btn-large" type="submit">${verb}: ${NAGP.money(membership.price_cents)}</button>
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
        </div>
      </section>`;
    }
    return html`<section class="mp-section">
      <div class="card card-highlight">
        <h2>Finish joining</h2>
        <p class="lede">Welcome, ${user.name}. To become a member, pay for one year of membership.</p>
        ${renewForm('Continue to payment')}
      </div>
    </section>`;
  }

  // One year from today, as the new end date for a lapsed member who renews now.
  const yearFromToday = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear() + 1}-${pad(d.getMonth() + 1)}-${pad(Math.min(d.getDate(), 28 + (d.getMonth() === 1 ? 0 : 3)))}`;
  };

  // Membership ended (or was never paid for after a past membership): a clear "Renew" first.
  function lapsedCard(m) {
    const o = m.pending_order;
    return html`<section class="mp-section card card-highlight">
      <h2>Your membership has ended</h2>
      <p class="lede">${m.expires
        ? `Your membership ended on ${NAGP.formatDate(m.expires)}.`
        : 'Your membership is not active at the moment.'}
        Renew today to get your member benefits back: the member directory, the community board, member prices for events, and more.</p>
      <ul class="meta-list">
        <li><b>Membership:</b> NAGP membership</li>
        <li class="status-line"><b>Status:</b> <span class="badge badge-warning">Ended</span></li>
      </ul>
      ${o ? html`<div class="mt-1">${NAGP.notice('warning', html`<p>You started a renewal (${o.description}) but have not paid yet.</p>
          <p><a class="btn btn-accent" href="${o.links.checkout}">Pay ${NAGP.money(o.amount_cents)}</a></p>`, 'Renewal not finished')}</div>` : ''}
      <h3 class="mp-sub">Renew your membership</h3>
      <p>Your new year starts on the day you pay, so it will run until about ${NAGP.formatDate(yearFromToday())}.</p>
      ${renewForm('Renew now')}
      <p class="hint mt-1">On the next page you can pay by card, or choose to pay by check.</p>
    </section>`;
  }

  function membershipCard(m) {
    const badge = m.is_member && !m.expired ? html`<span class="badge badge-success">Active</span>`
      : m.status === 'lapsed' || m.expired ? html`<span class="badge badge-warning">Ended</span>`
        : html`<span class="badge">Not active</span>`;
    const soon = m.days_left !== null && m.days_left <= 60;
    const o = m.pending_order;
    const cancelled = m.cancel_requested_at;
    const canCancel = !cancelled && m.is_member && !m.is_council && m.expires;
    return html`<section class="mp-section card">
      <h2>Your membership</h2>
      <ul class="meta-list">
        <li><b>Membership:</b> NAGP membership</li>
        <li class="status-line"><b>Status:</b> ${badge}</li>
        ${m.expires ? html`<li><b>${m.expired ? 'Ended on' : 'Active until'}:</b> ${NAGP.formatDate(m.expires)}</li>` : ''}
      </ul>
      ${cancelled ? html`<div class="mt-1">${NAGP.notice('info', html`<p>You asked to cancel on ${NAGP.formatShortDate(cancelled)}. Your membership stays active until ${NAGP.formatDate(m.expires)}, and it will not be renewed.</p>
          <p><button class="btn btn-secondary" type="button" id="undo-cancel">Keep my membership</button></p>`, 'Cancellation requested')}</div>` : ''}
      ${o ? html`<div class="mt-1">${NAGP.notice('warning', html`<p>You started a renewal (${o.description}) but have not paid yet.</p>
          <p><a class="btn btn-accent" href="${o.links.checkout}">Pay ${NAGP.money(o.amount_cents)}</a></p>`, 'Renewal not finished')}</div>` : ''}

      <h3 class="mp-sub">Renew your membership</h3>
      <p>${soon ? 'Your membership ends soon. ' : ''}You can renew at any time. One year is added to your membership, so you do not lose any time.</p>
      ${renewForm('Renew for one year')}

      ${canCancel ? html`<h3 class="mp-sub">Cancel your membership</h3>
      <p>If you cancel, your membership stays active until ${NAGP.formatDate(m.expires)} and will not be renewed. The Council will be told, and will contact you if you would like a refund.</p>
      <p><button class="btn btn-danger" type="button" id="cancel-membership">Cancel my membership</button></p>
      <div id="cancel-confirm" class="notice notice-warning" hidden>
        <span class="notice-title">Are you sure you want to cancel?</span>
        <p>You can change your mind later on this page.</p>
        <p><button class="btn btn-danger" type="button" id="cancel-yes">Yes, cancel my membership</button>
          <button class="btn btn-secondary" type="button" id="cancel-no">No, keep it</button></p>
      </div>` : ''}
      <div class="form-status" id="cancel-status" role="status" aria-live="polite"></div>
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
    NAGP.form(form, {
      reset: false,
      busyText: 'One moment…',
      onSubmit: async () => {
        const res = await api('/api/membership/renew', { method: 'POST', body: {} });
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
    const lapsed = !joining && !m.is_council && (!m.is_member || m.expired);
    box.innerHTML = html`${joining ? finishJoining(m, user) : lapsed ? lapsedCard(m) : membershipCard(m)}
      ${registrationsSection(data.registrations)}
      ${historySection(data.orders)}`;
    wireRenew();
    wireCancel(session);
  }

  // "Cancel my membership" asks once more before sending; "Keep my membership" undoes it.
  function wireCancel(session) {
    const status = $('#cancel-status');
    const send = async (undo) => {
      try {
        await api('/api/membership/cancel', { method: 'POST', body: { undo } });
        await load(session);
        const msg = undo ? 'Thank you. Your membership will continue as before.'
          : 'Your cancellation was sent to the Council. Your membership stays active until its end date.';
        $('#cancel-status').innerHTML = NAGP.notice('success', msg);
      } catch (err) {
        status.innerHTML = NAGP.notice('error', err.message);
      }
    };
    const start = $('#cancel-membership');
    const confirmBox = $('#cancel-confirm');
    if (start && confirmBox) {
      start.addEventListener('click', () => { confirmBox.hidden = false; start.hidden = true; $('#cancel-yes').focus(); });
      $('#cancel-no').addEventListener('click', () => { confirmBox.hidden = true; start.hidden = false; start.focus(); });
      $('#cancel-yes').addEventListener('click', () => send(false));
    }
    const undo = $('#undo-cancel');
    if (undo) undo.addEventListener('click', () => send(true));
  }

  NAGP.whenAllowed().then(load);
})();
