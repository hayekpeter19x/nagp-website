// /forgot-password: ask for an email with a link to choose a new password.
(function () {
  const { $, api } = NAGP;
  const form = $('#forgot-form');
  const email = NAGP.qs('email');
  if (email) form.elements.namedItem('email').value = email;

  NAGP.form(form, {
    busyText: 'Sending…',
    reset: false,
    onSubmit: (data) => api('/api/auth/forgot', { method: 'POST', body: data }),
    success: (res) => res.message,
  });
})();
