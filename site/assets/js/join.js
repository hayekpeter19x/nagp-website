// Join page: a three-step application (membership, details, review), then on to /checkout.
(function () {
  const { $, $$, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const cfg = NAGP.config || {};
  const tiers = cfg.MEMBERSHIP_TIERS || [];
  const form = $('#join-form');
  const stepsEl = $('#join-steps');
  const f = (name) => form.elements.namedItem(name);
  let step = 1;

  /* ---------- Build the choices ---------- */
  // One membership for everyone; the person says what best describes them.
  const types = cfg.MEMBER_TYPES || [];
  const membership = tiers[0];
  $('#membership-line').innerHTML = html`NAGP membership: <strong>${NAGP.money(membership.price_cents)} per ${membership.period}</strong>. It lasts one year from the day you pay.`;
  $('#tier-cards').innerHTML = html`${types.map((t) => html`<label class="choice-card">
      <input type="radio" name="member_type" value="${t.key}" required>
      <span class="choice-title">${t.label}</span>
      <span class="choice-who">${t.hint}</span>
    </label>`)}`;
  $('#join-state').innerHTML = NAGP.regionOptions('');
  $('#specialty-checks').innerHTML = html`${(cfg.SPECIALTIES || []).map((s) => html`<label class="check-line">
      <input type="checkbox" name="specialties" value="${s.key}" data-pro> <span>${s.label}</span></label>`)}`;

  const selectedType = () => {
    const r = form.querySelector('input[name="member_type"]:checked');
    return r ? types.find((t) => t.key === r.value) : null;
  };
  const isPro = () => { const t = selectedType(); return !!t && t.key === 'professional'; };

  // Professional fields only for practicing professionals (disabled fields are not sent or checked).
  function updatePro() {
    const pro = isPro();
    $('#pro-fields').hidden = !pro;
    $$('#pro-fields input, #pro-fields textarea').forEach((el) => { el.disabled = !pro; });
  }
  updatePro();
  form.addEventListener('change', (e) => { if (e.target.name === 'member_type') updatePro(); });

  $('#join-show-password').addEventListener('change', (e) => {
    f('password').type = f('password_confirm').type = e.target.checked ? 'text' : 'password';
  });

  /* ---------- Steps ---------- */
  function showStep(n, { focus = true } = {}) {
    step = n;
    $$('.join-step', form).forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
    [...stepsEl.children].forEach((li, i) => {
      li.classList.toggle('done', i < n - 1);
      if (i === n - 1) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (n === 3) renderReview();
    if (focus) {
      stepsEl.scrollIntoView({ block: 'start' });
      const h = form.querySelector(`.join-step[data-step="${n}"] h2`);
      if (h) h.focus({ preventScroll: true });
    }
  }

  const MESSAGES = {
    member_type: 'Please choose what best describes you.',
    name: 'Please enter your full name.',
    email: 'Please enter your email address.',
    city: 'Please enter your city or town.',
    state: 'Please choose your state or province.',
    password: 'Please choose a password.',
    password_confirm: 'Please type your password a second time.',
    credentials: 'Please enter your credentials.',
    training: 'Please describe your Gestalt training.',
    agree: 'Please read the community guidelines and tick the box to agree.',
  };

  function stepErrors(n) {
    const panel = form.querySelector(`.join-step[data-step="${n}"]`);
    const errors = {};
    panel.querySelectorAll('[required]').forEach((el) => {
      if (el.disabled || errors[el.name]) return;
      const empty = el.type === 'checkbox' ? !el.checked
        : el.type === 'radio' ? !form.querySelector(`[name="${el.name}"]:checked`) : !String(el.value).trim();
      if (empty) errors[el.name] = MESSAGES[el.name] || 'Please fill this in.';
    });
    if (n === 2) {
      const email = f('email').value.trim();
      if (email && !errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please check the email address. It should look like name@example.com.';
      const pw = f('password').value;
      if (pw && pw.length < 8) errors.password = 'Please choose a password with at least 8 characters.';
      else if (pw && f('password_confirm').value && pw !== f('password_confirm').value) {
        errors.password_confirm = 'The two passwords are not the same. Please type the same password in both boxes.';
      }
      if (isPro() && !form.querySelector('[name="specialties"]:checked')) errors.specialties = 'Please choose at least one area of practice.';
    }
    return errors;
  }

  function checkStep(n) {
    NAGP.clearErrors(form);
    const errors = stepErrors(n);
    if (Object.keys(errors).length) {
      NAGP.showFieldErrors(form, errors, 'Please check the highlighted fields.');
      return false;
    }
    return true;
  }

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const back = e.target.closest('[data-back]');
    const edit = e.target.closest('[data-edit]');
    if (next && checkStep(step)) showStep(step + 1);
    if (back) { NAGP.clearErrors(form); showStep(step - 1); }
    if (edit) { NAGP.clearErrors(form); showStep(Number(edit.dataset.edit)); }
  });

  // Registered before NAGP.form, so it runs first: pressing Enter in step 1 or 2 means "Continue",
  // and on step 3 any missing answer from an earlier step takes you back to it.
  form.addEventListener('submit', (e) => {
    if (step < 3) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (checkStep(step)) showStep(step + 1);
      return;
    }
    for (const n of [1, 2, 3]) {
      if (Object.keys(stepErrors(n)).length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (n !== step) showStep(n, { focus: false });
        checkStep(n);
        return;
      }
    }
  });

  function renderReview() {
    const type = selectedType();
    if (!type) return;
    const t = membership;
    const v = (n) => (f(n) ? String(f(n).value).trim() : '');
    const specs = $$('[name="specialties"]:checked', form).map((el) => NAGP.specialtyLabel(el.value)).join(', ');
    $('#review').innerHTML = html`<div class="summary-box">
      <dl class="review-list">
        <div><dt>Membership</dt><dd>NAGP membership, one year</dd></div>
        <div><dt>Describes you</dt><dd>${type.label}</dd></div>
        <div><dt>Name</dt><dd>${v('name')}</dd></div>
        <div><dt>Email</dt><dd>${v('email')}</dd></div>
        <div><dt>City and state</dt><dd>${v('city')}, ${NAGP.regionName(v('state'))}</dd></div>
        ${isPro() ? html`
          <div><dt>Credentials</dt><dd>${v('credentials')}</dd></div>
          <div><dt>Gestalt training</dt><dd>${v('training')}</dd></div>
          <div><dt>Areas of practice</dt><dd>${specs}</dd></div>
          <div><dt>Public directory</dt><dd>${f('show_public').checked ? 'Yes, list me in the public directory' : 'No, do not list me publicly'}</dd></div>` : ''}
      </dl>
      <p class="review-edit">
        <button type="button" class="link-button" data-edit="1">Change your answer</button>
        <button type="button" class="link-button" data-edit="2">Change your details</button>
      </p>
      <div class="summary-row summary-total"><span>Total for one year</span><span class="amount">${NAGP.money(t.price_cents)}</span></div>
      ${Pay.samplePriceNote()}
    </div>`;
  }

  /* ---------- Send ---------- */
  const stepOf = (name) => {
    const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const panel = el && el.closest('.join-step');
    return panel ? Number(panel.dataset.step) : null;
  };

  NAGP.form(form, {
    reset: false,
    busyText: 'One moment…',
    onSubmit: async (data) => {
      try {
        const res = await api('/api/membership/join', { method: 'POST', body: data });
        Pay.go(res.checkout_url);
        return new Promise(() => {}); // keep the button busy while the payment page loads
      } catch (err) {
        if (err.fields) {
          const n = stepOf(Object.keys(err.fields)[0]);
          if (n && n !== step) showStep(n, { focus: false });
          if (err.fields.email && /already exists/i.test(err.fields.email)) {
            // After NAGP.form has shown the message, add a sign-in link to it.
            setTimeout(() => {
              const span = document.getElementById('err-join-form-email');
              if (span) span.insertAdjacentHTML('beforeend', String(html` <a href="/signin?next=${encodeURIComponent('/members/payments')}">Sign in</a>`));
            }, 0);
          }
        }
        throw err;
      }
    },
  });

  /* ---------- Already signed in? ---------- */
  NAGP.ready.then(async (session) => {
    const u = session.user;
    if (!u) return;
    const box = $('#join-status');
    $('#join-wrap').hidden = true;
    if (u.isMember) {
      box.innerHTML = html`<div class="card card-highlight">
        <h2>You're already a member</h2>
        <p class="lede">You are signed in as ${u.name}.
          ${u.membership_expires ? `Your membership is active until ${NAGP.formatDate(u.membership_expires)}.` : ''}</p>
        <div class="actions">
          <a class="btn btn-large" href="/members/profile">Go to My Profile</a>
          <a class="btn btn-secondary btn-large" href="/members/payments">Renew your membership</a>
        </div></div>`;
      return;
    }
    let order = null;
    try { order = (await api('/api/me/orders')).membership.pending_order; } catch { /* show the general message */ }
    const signOut = html`<p class="mt-1 muted">Not ${u.name}? <button type="button" class="link-button" data-join-signout>Sign out</button></p>`;
    if (u.status === 'pending' && order) {
      box.innerHTML = html`${Pay.steps(Pay.JOIN_STEPS, 3, 'Joining, step by step')}
        <div class="card card-highlight">
          <h2>You have already started joining</h2>
          <p class="lede">Welcome back, ${u.name}. Your application for NAGP membership is saved. The only step left is payment.</p>
          <div class="actions"><a class="btn btn-accent btn-large" href="${order.links.checkout}">Finish joining: ${NAGP.money(order.amount_cents)}</a></div>
          <p class="hint mt-1">On the next page you can pay by card, or choose to pay by check.</p>
          ${signOut}
        </div>`;
    } else {
      box.innerHTML = html`<div class="card card-highlight">
        <h2>Welcome back, ${u.name}</h2>
        <p class="lede">${u.status === 'pending' ? 'You already have an account. To finish joining, choose your membership and pay on your My Membership page.'
          : 'Your membership is not active at the moment. You can renew it on your My Membership page.'}</p>
        <div class="actions"><a class="btn btn-accent btn-large" href="/members/payments">${u.status === 'pending' ? 'Finish joining' : 'Renew my membership'}</a></div>
        ${signOut}
      </div>`;
    }
    const so = box.querySelector('[data-join-signout]');
    if (so) so.addEventListener('click', NAGP.signOut);
  });
})();
