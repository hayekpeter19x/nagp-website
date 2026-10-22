// /forgot-password: ask for an email with a link to choose a new password.
// Preview: for a demo account the server returns the link, shown here instead of emailed.
(function () {
  const { $, api, html } = NAGP;
  const form = $('#forgot-form');
  const email = NAGP.qs('email');
  if (email) form.elements.namedItem('email').value = email;

  NAGP.form(form, {
    busyText: 'Sending…',
    reset: false,
    onSubmit: (data) => api('/api/auth/forgot', { method: 'POST', body: data }),
    success: (res) => (res.demo_link
      ? NAGP.notice('info', html`<p>${res.message}</p><p><a class="btn" href="${res.demo_link}">Open the link</a></p>`, 'Preview')
      : res.message),
  });

  NAGP.ready.then((session) => {
    if (session.demo) $('#forgot-demo').hidden = false;
  });
})();
