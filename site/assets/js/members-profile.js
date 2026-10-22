// /members/profile: edit your profile and directory listings, with a live preview,
// plus a separate "Change your password" form.
(function () {
  const { $, $$, api, html } = NAGP;
  const form = $('#profile-form');
  let me = null;

  const isPro = () => me && me.member_type === 'professional';
  const typeLabel = (key) => ((NAGP.config.MEMBER_TYPES || []).find((t) => t.key === key) || {}).label || 'Member';
  const field = (name) => form.elements.namedItem(name);

  function fill(u) {
    field('name').value = u.name;
    field('city').value = u.city;
    $('#pf-state').innerHTML = NAGP.regionOptions(u.state, { placeholder: 'Choose your state or province' });
    field('bio').value = u.bio;
    field('credentials').value = u.credentials;
    field('training').value = u.training;
    $$('input[name="specialties"]', form).forEach((c) => { c.checked = u.specialties.includes(c.value); });
    field('show_members').checked = u.show_members;
    field('show_public').checked = u.show_public;
    field('public_email').value = u.public_email;
    field('public_phone').value = u.public_phone;
    field('website').value = u.website;
    $('#pf-login-email').textContent = u.email;
    // "Your account" summary at the top of the page
    $('#acc-name').textContent = u.name;
    $('#acc-email').textContent = u.email;
    $('#acc-tier').textContent = `NAGP membership (${typeLabel(u.member_type)})`;
    $('#account-summary').hidden = false;
  }

  function setUpForType() {
    const pro = isPro();
    $('#practice-legend').textContent = pro ? 'Your practice' : 'Your Gestalt background';
    $$('[data-pro-only]', form).forEach((el) => {
      el.hidden = !pro;
      $$('input', el).forEach((i) => { i.disabled = !pro; });
    });
    const pub = field('show_public');
    pub.disabled = !pro;
    $('#pf-public-label').classList.toggle('is-disabled', !pro);
    $('#pf-public-explain').innerHTML = pro
      ? html`<p>Anyone on the internet can see this listing: your name, credentials, Gestalt training, specialties, city and state, the few words about you, and the contact details you choose below. You can turn it off at any time.</p>`
      : html`<p><strong>This is only for professional members.</strong> The public directory helps people find a qualified practitioner, so it lists professional members only.
          You told us you are: <strong>${typeLabel(me.member_type)}</strong>.
          If you are a practicing professional, please <a href="/contact?topic=Membership">contact the Council</a> and they will change this for you.</p>`;
  }

  function current() {
    const d = NAGP.formData(form);
    return {
      name: d.name.trim(),
      credentials: isPro() ? (d.credentials || '').trim() : '',
      training: (d.training || '').trim(),
      specialties: isPro() ? d.specialties || [] : [],
      city: d.city.trim(),
      state: d.state,
      bio: d.bio,
      website: /^https?:\/\//i.test(d.website.trim()) ? d.website.trim() : d.website.trim() ? 'https://' + d.website.trim() : '',
      public_email: d.public_email.trim(),
      public_phone: d.public_phone.trim(),
      member_type: me.member_type,
      sample: false,
      show_public: !!d.show_public,
      show_members: !!d.show_members,
    };
  }

  function renderPreview() {
    const p = current();
    const pro = isPro();
    const shown = pro ? p.show_public : p.show_members;
    const where = pro ? 'the public directory' : 'the Members Directory';
    $('#preview-heading').textContent = pro ? 'Preview of your public listing' : 'Preview of your directory listing';
    $('#preview-status').innerHTML = shown
      ? html`<span class="badge badge-success">Shown</span> This is how you appear in ${where}.`
      : html`<span class="badge badge-warning">Not shown</span> You do not appear in ${where} right now. Tick the box under “What other people can see” to be listed.`;
    $('#profile-preview').innerHTML = window.NAGPListing.card(p, { showType: !pro });
    const n = (field('bio').value || '').length;
    $('#pf-bio-count').textContent = `${n.toLocaleString('en-US')} of 1,500 characters`;
  }

  function buildSpecialties() {
    $('#pf-specialties').innerHTML = html`${(NAGP.config.SPECIALTIES || []).map((s) => html`<label class="check">
      <input type="checkbox" name="specialties" value="${s.key}"> <span>${s.label}</span></label>`)}`;
  }

  NAGP.whenAllowed().then(async () => {
    buildSpecialties();
    window.NAGPListing.wire($('#profile-preview'));
    try {
      ({ user: me } = await api('/api/me'));
    } catch (err) {
      NAGP.showError($('#profile-loading'), err);
      return;
    }
    fill(me);
    setUpForType();
    $('#profile-loading').hidden = true;
    form.hidden = false;
    renderPreview();
    form.addEventListener('input', renderPreview);
    form.addEventListener('change', renderPreview);

    NAGP.form(form, {
      reset: false,
      busyText: 'Saving…',
      onSubmit: async (data) => {
        const { user } = await api('/api/me', { method: 'PUT', body: data });
        me = user;
        fill(user);
        renderPreview();
        return user;
      },
      success: (u) => {
        const pro = u.member_type === 'professional';
        return html`<div class="notice notice-success" role="status"><span class="notice-title">Your profile was saved.</span>
          <p>The directories show your changes right away.
          ${pro && u.show_public ? html`<a href="/directory?q=${encodeURIComponent(u.name)}">See your public listing</a>.` : ''}
          ${u.show_members ? html`<a href="/members/directory?q=${encodeURIComponent(u.name)}">See yourself in the Members Directory</a>.` : ''}</p></div>`;
      },
    });
  });

  // ----- Change password -----
  const pw = $('#password-form');
  $('#pw-show').addEventListener('change', (e) => {
    $$('input[type="password"], input[data-pw]', pw).forEach((i) => { i.dataset.pw = '1'; i.type = e.target.checked ? 'text' : 'password'; });
  });
  NAGP.form(pw, {
    busyText: 'Changing…',
    onSubmit: async (data) => {
      if (data.new_password !== data.confirm_password) {
        const err = new Error('The two new passwords are not the same.');
        err.fields = { confirm_password: 'This does not match the new password above. Please type it again.' };
        throw err;
      }
      return api('/api/me/password', { method: 'POST', body: { current_password: data.current_password, new_password: data.new_password } });
    },
    success: 'Your password was changed. Use your new password the next time you sign in. If you are signed in on another computer or phone, you will need to sign in there again.',
  });
})();
