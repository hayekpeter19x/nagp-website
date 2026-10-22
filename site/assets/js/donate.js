// Donate page: choose an amount (or type another), name and email, then on to /checkout.
(function () {
  const { $, html, api } = NAGP;
  const Pay = window.NAGPPay;
  const form = $('#donate-form');
  const amounts = (NAGP.config && NAGP.config.DONATION_AMOUNTS_CENTS) || [2500, 5000, 10000, 25000];
  const preset = amounts.includes(5000) ? 5000 : amounts[0];
  const submit = $('#donate-submit');

  $('#amount-cards').innerHTML = html`${amounts.map((c) => html`<label class="choice-card">
      <input type="radio" name="amount_choice" value="${c}" required${c === preset ? NAGP.raw(' checked') : ''}>
      <span class="choice-title">${NAGP.money(c, { exact: true })}</span></label>`)}
    <label class="choice-card"><input type="radio" name="amount_choice" value="other" required>
      <span class="choice-title">Another amount</span></label>`;

  // "37.50", "$1,000" -> cents, or null
  const toCents = (text) => {
    const clean = String(text || '').replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
    return Math.round(Number(clean) * 100);
  };

  const chosenCents = () => {
    const r = form.querySelector('input[name="amount_choice"]:checked');
    if (!r) return null;
    if (r.value === 'other') return toCents($('#donate-other').value);
    return Number(r.value);
  };

  function update() {
    const r = form.querySelector('input[name="amount_choice"]:checked');
    const other = !!(r && r.value === 'other');
    $('#other-field').hidden = !other;
    const cents = chosenCents();
    submit.textContent = cents && cents >= 500 ? `Continue to payment: ${NAGP.money(cents, { exact: true })}` : 'Continue to payment';
    return other;
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'amount_choice' && update()) $('#donate-other').focus();
  });
  $('#donate-other').addEventListener('input', update);
  update();

  NAGP.ready.then(({ user }) => {
    if (!user) return;
    const name = form.elements.namedItem('name');
    const email = form.elements.namedItem('email');
    if (!name.value) name.value = user.name;
    if (!email.value) email.value = user.email;
  });

  NAGP.form(form, {
    reset: false,
    busyText: 'One moment…',
    onSubmit: async (data) => {
      const cents = chosenCents();
      if (!cents || cents < 500) {
        const err = new Error('Please check the highlighted fields.');
        err.fields = data.amount_choice === 'other'
          ? { other_amount: 'Please type an amount of at least $5, for example 40 or 37.50.' }
          : { amount_cents: 'Please choose an amount.' };
        throw err;
      }
      let res;
      try {
        res = await api('/api/donate', {
          method: 'POST',
          body: { amount_cents: cents, name: data.name, email: data.email, note: data.note, hp: data.hp },
        });
      } catch (err) {
        // Show an amount problem next to the box the donor typed in.
        if (err.fields && err.fields.amount_cents && data.amount_choice === 'other') {
          err.fields.other_amount = err.fields.amount_cents;
          delete err.fields.amount_cents;
        }
        throw err;
      }
      Pay.go(res.checkout_url);
      return new Promise(() => {}); // keep the button busy while the payment page loads
    },
  });
})();
