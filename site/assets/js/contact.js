// Contact page: sends the message to /api/contact. The topic can be chosen in
// advance with ?topic=..., for example /contact?topic=Sign-in%20help from the sign-in page.
(function () {
  const { $, api, html } = NAGP;
  const form = $('#contact-form');
  if (!form) return;
  const topic = $('#contact-topic');
  const tip = $('#signin-help-tip');

  // Pre-select the topic from the address (matching is not case-sensitive). Links elsewhere on the
  // site use short names, e.g. ?topic=Events for "Events and trainings" or ?topic=Website%20help.
  const wanted = String(NAGP.qs('topic') || '').trim().toLowerCase();
  if (wanted) {
    const options = [...topic.options];
    const word = wanted.split(/\s+/)[0];
    const match = options.find((o) => o.value.toLowerCase() === wanted)
      || options.find((o) => o.value.toLowerCase().split(/\s+/).includes(word));
    if (match) topic.value = match.value;
  }

  const showTip = () => { tip.hidden = topic.value !== 'Sign-in help'; };
  topic.addEventListener('change', showTip);
  showTip();

  let sent = {};
  NAGP.form(form, {
    busyText: 'Sending…',
    onSubmit: (data) => {
      sent = data;
      return api('/api/contact', { method: 'POST', body: data });
    },
    success: () => html`<p><strong>Thank you${sent.name ? `, ${sent.name}` : ''}! Your message was sent to the Founding Council.</strong></p>
      <p>A Council member will reply to you by email at <strong>${sent.email}</strong>. If you do not hear back, please check your spam or junk folder.</p>`,
  });
  // The form is cleared after sending; keep the tip in step with the topic.
  form.addEventListener('reset', () => setTimeout(showTip));
})();
