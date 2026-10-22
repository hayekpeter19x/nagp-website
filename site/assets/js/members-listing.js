// Directory listing cards, shared by /directory, /members/directory and the
// preview on /members/profile.  Usage:  el.innerHTML = NAGPListing.card(person, { showType: true });
(function () {
  const { html } = NAGP;
  const BIO_LIMIT = 280;
  const TYPES = { professional: 'Professional', associate: 'Member', student: 'Student or trainee' };

  const safeUrl = (u) => (/^https?:\/\/[^\s]+$/i.test(String(u || '')) ? u : '');
  const prettyUrl = (u) => String(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  const telHref = (p) => 'tel:' + String(p).replace(/(x|ext\.?).*$/i, '').replace(/[^\d+]/g, '');

  function where(p) {
    const region = NAGP.regionName(p.state);
    return [p.city, region].filter(Boolean).join(', ');
  }

  function bio(text) {
    const s = String(text || '').trim();
    if (!s) return '';
    if (s.length <= BIO_LIMIT) return html`<div class="listing-bio">${NAGP.paragraphs(s)}</div>`;
    const short = s.slice(0, BIO_LIMIT).replace(/\s+\S*$/, '') + '…';
    return html`<div class="listing-bio">
      <div data-bio-short>${NAGP.paragraphs(short)}</div>
      <div data-bio-full hidden>${NAGP.paragraphs(s)}</div>
      <button type="button" class="link-button" data-bio-toggle aria-expanded="false">Read more</button></div>`;
  }

  function contact(p) {
    const items = [];
    const site = safeUrl(p.website);
    if (site) items.push(html`<li><span class="listing-contact-label">Website:</span> <a href="${site}" rel="noopener nofollow">${prettyUrl(site)}</a></li>`);
    if (p.public_email) items.push(html`<li><span class="listing-contact-label">Email:</span> <a href="mailto:${p.public_email}">${p.public_email}</a></li>`);
    if (p.public_phone) items.push(html`<li><span class="listing-contact-label">Phone:</span> <a href="${telHref(p.public_phone)}">${p.public_phone}</a></li>`);
    return items.length ? html`<ul class="listing-contact">${items}</ul>` : '';
  }

  function typeBadge(type) {
    if (!TYPES[type]) return '';
    const cls = type === 'professional' ? 'badge-primary' : type === 'student' ? 'badge-accent' : '';
    return html`<span class="badge ${cls}">${TYPES[type]}</span>`;
  }

  // p: { name, credentials, training, specialties[], city, state, bio, website, public_email, public_phone, sample, member_type? }
  function card(p, { showType = false } = {}) {
    const specialties = (p.specialties || []).map((k) => html`<li><span class="badge badge-primary">${NAGP.specialtyLabel(k)}</span></li>`);
    const place = where(p);
    return html`<article class="card listing">
      <div class="person">
        <div class="avatar" aria-hidden="true">${NAGP.initials(p.name)}</div>
        <div class="listing-body">
          <h3 class="person-name">${p.name || 'Your name'}${p.credentials ? html`<span class="listing-cred">, ${p.credentials}</span>` : ''}</h3>
          ${showType || p.sample ? html`<p class="listing-badges">${showType ? typeBadge(p.member_type) : ''} ${NAGP.sampleBadge(p)}</p>` : ''}
          ${place ? html`<p class="meta listing-place">${place}</p>` : ''}
          ${specialties.length ? html`<ul class="tag-list" aria-label="Specialties">${specialties}</ul>` : ''}
          ${p.training ? html`<p class="listing-training"><b>Gestalt training:</b> ${p.training}</p>` : ''}
          ${bio(p.bio)}
          ${contact(p)}
        </div>
      </div>
    </article>`;
  }

  // "Read more" buttons on long bios (one listener per results container).
  function wire(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bio-toggle]');
      if (!btn) return;
      const box = btn.closest('.listing-bio');
      const open = btn.getAttribute('aria-expanded') !== 'true';
      box.querySelector('[data-bio-short]').hidden = open;
      box.querySelector('[data-bio-full]').hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show less' : 'Read more';
    });
  }

  // "3 practitioners" / "1 practitioner"
  const plural = (n, one, many) => `${n === 0 ? 'No' : n} ${n === 1 ? one : many || one + 's'}`;

  window.NAGPListing = { card, wire, typeBadge, plural, TYPES };
})();
