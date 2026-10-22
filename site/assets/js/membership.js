// Membership page: the membership and what it includes, drawn from lib/config.js (MEMBERSHIP_TIERS),
// so the name, benefits and price are only ever changed in one place.
(function () {
  const { $, html } = NAGP;
  const box = $('#tiers');
  if (!box) return;

  const m = (NAGP.config.MEMBERSHIP_TIERS || [])[0];
  if (!m) {
    box.innerHTML = html`<div class="empty"><p class="mb-0">Membership details will be posted here soon.</p></div>`;
    return;
  }
  const types = NAGP.config.MEMBER_TYPES || [];
  box.innerHTML = html`<article class="card price-card membership-card">
    <h3>NAGP membership</h3>
    <p class="price">${NAGP.money(m.price_cents)} <small>per ${m.period || 'year'}</small></p>
    <p>${m.who}</p>
    <h4>What is included</h4>
    <ul class="list-check">${(m.benefits || []).map((b) => html`<li>${b}</li>`)}</ul>
    <h4>Who it is for</h4>
    <ul>${types.map((t) => html`<li><strong>${t.label}:</strong> ${t.hint.charAt(0).toLowerCase() + t.hint.slice(1)}</li>`)}</ul>
    <a class="btn btn-accent btn-block" href="/join">Join NAGP</a>
  </article>`;
})();
