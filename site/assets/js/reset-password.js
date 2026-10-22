// /reset-password?token=...: the page the "Forgot your password?" email links to.
(function () {
  const { $, api, html } = NAGP;
  const form = $('#reset-form');
  const token = NAGP.qs('token') || '';
  form.elements.namedItem('token').value = token;

  function expired() {
    $('#reset-card').hidden = true;
    const box = $('#reset-expired');
    box.hidden = false;
    box.innerHTML = NAGP.notice('warning', html`<p>This link has expired or has already been used. Links work once, for one hour.</p>
      <p><a class="btn" href="/forgot-password">Email me a new link</a></p>`, 'Please ask for a new link');
  }

  $('#reset-show').addEventListener('change', (e) => {
    $('#reset-password').type = $('#reset-password2').type = e.target.checked ? 'text' : 'password';
  });

  api('/api/auth/reset', { query: { token } }).then((r) => { if (!r.valid) expired(); }).catch(() => {});

  NAGP.form(form, {
    busyText: 'Saving…',
    reset: false,
    onSubmit: async (data) => {
      try {
        return await api('/api/auth/reset', { method: 'POST', body: data });
      } catch (err) {
        if (!err.fields) expired();
        throw err;
      }
    },
    success: (res) => {
      form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
      const next = res.user && res.user.isCouncil ? '/council/' : '/members/profile';
      return NAGP.notice('success', html`<p>${res.message}</p><p><a class="btn" href="${next}">Continue</a></p>`, 'Done');
    },
  });
})();
