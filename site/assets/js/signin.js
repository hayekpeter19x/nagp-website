// Sign-in page: email + password form, and the preview-only demo buttons.
(function () {
  const { $, $$, api, html } = NAGP;

  // Only allow redirects back to our own pages.
  const next = (() => {
    const n = NAGP.qs('next') || '';
    return n.startsWith('/') && !n.startsWith('//') ? n : '/members/';
  })();
  const goNext = (user) => {
    location.href = next === '/members/' && user && user.isCouncil ? '/council/' : next;
  };

  $('#show-password').addEventListener('change', (e) => {
    $('#signin-password').type = e.target.checked ? 'text' : 'password';
  });

  NAGP.form($('#signin-form'), {
    busyText: 'Signing in…',
    reset: false,
    onSubmit: async (data) => {
      const { user } = await api('/api/auth/signin', { method: 'POST', body: data });
      goNext(user);
    },
  });

  NAGP.ready.then((session) => {
    if (session.user) {
      const box = $('#already-signed-in');
      box.hidden = false;
      box.innerHTML = html`<div class="notice notice-info"><p>You are already signed in as <strong>${session.user.name}</strong>.</p>
        <p><a class="btn" href="${session.user.isCouncil ? '/council/' : '/members/'}">Continue</a>
        <button class="btn btn-secondary" type="button" data-signout-here>Sign out</button></p></div>`;
      box.querySelector('[data-signout-here]').addEventListener('click', NAGP.signOut);
    }
    if (session.demo) {
      $('#demo-box').hidden = false;
      $$('[data-demo]').forEach((btn) => btn.addEventListener('click', async () => {
        $$('[data-demo]').forEach((b) => { b.disabled = true; });
        try {
          const { user } = await api('/api/auth/demo', { method: 'POST', body: { as: btn.dataset.demo } });
          goNext(user);
        } catch (err) {
          $('#demo-status').innerHTML = NAGP.notice('error', err.message);
          $$('[data-demo]').forEach((b) => { b.disabled = false; });
        }
      }));
    }
  });
})();
