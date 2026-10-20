// Membership page: the membership categories, drawn from lib/config.js (MEMBERSHIP_TIERS),
// so names, benefits and prices are only ever changed in one place.
(function () {
  const { $, html } = NAGP;
  const box = $('#tiers');
  if (!box) return;

  const tiers = NAGP.config.MEMBERSHIP_TIERS || [];
  // The Council has not confirmed dues yet, so prices are labeled as samples while the site is in preview.
  const sample = !!(NAGP.config.ORG && NAGP.config.ORG.preview);

  if (!tiers.length) {
    box.innerHTML = html`<div class="empty"><p class="mb-0">Membership categories will be posted here soon.</p></div>`;
    return;
  }

  box.innerHTML = html`<div class="grid">${tiers.map((t) => html`<article class="card price-card">
    <h3>${t.name}</h3>
    <p class="price">${NAGP.money(t.price_cents)} <small>per ${t.period || 'year'}</small></p>
    ${sample ? html`<span class="sample-price">Sample price, to be confirmed by the Council</span>` : ''}
    <p>${t.who}</p>
    <h4>What is included</h4>
    <ul class="list-check">${(t.benefits || []).map((b) => html`<li>${b}</li>`)}</ul>
    <a class="btn btn-secondary btn-block" href="/join?tier=${t.key}">Join as ${/^[AEIOU]/i.test(t.name) ? 'an' : 'a'} ${t.name}</a>
  </article>`)}</div>`;
})();
