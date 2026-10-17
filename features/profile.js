// features/profile.js  (About me: the profile fields, what is sent to the AI, and a preview of it)
Desk.register({
  id: 'profile',
  name: 'About me',
  purpose: 'Say what you do and what you look for. You choose what the AI sees.',
  types: ['profile'],
  strings: {
    tabLabel: 'About me',
    heading: 'About me',
    intro: 'Tell the app a little about your search. It stays on this computer. You choose what the AI sees.',
    noName: 'There is no place for your name, email or phone number. That is on purpose. The AI never needs them.',
    sendToAi: 'Send to AI',
    defaultOn: 'Usually on',
    defaultOff: 'Usually off',
    previewHeading: 'What the AI will see',
    previewIntro: 'This is what goes into a question from this page. Nothing else about you does.',
    previewEmpty: 'Nothing yet. Fill in a box and keep its switch on.',
    'label.roles': 'What work do you look for?',
    'label.field': 'Which field?',
    'label.background': 'A little about you (one or two lines)',
    'label.area': 'Where can you work? (part of the city, how far you can travel)',
    'label.languages': 'Languages you speak',
    'label.replyLanguage': 'Language for the AI answers',
    'label.availability': 'When can you work?',
    'label.avoid': 'What do you want to avoid?',
  },
  css: `
    .profile-form { display: grid; gap: .75rem; margin: 1.25rem 0; max-width: 40rem; }
    .profile-field { display: grid; gap: .35rem; padding: .85rem 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
    .profile-field label { margin: 0; }
    .profile-field input[type="text"], .profile-field textarea { width: 100%; }
    .profile-field textarea { min-height: 4.5rem; }
    .profile-share { display: flex; gap: .6rem; align-items: center; min-height: 44px; }
    .profile-share label { margin: 0; font-weight: 600; }
    .profile-hint { color: var(--muted); font-size: .9em; font-weight: 400; }
    .profile-preview-box { border: 1px solid transparent; border-left: .3rem solid var(--accent); border-radius: var(--radius); padding: 1rem; max-width: 40rem; background: var(--accent-soft); }
    .profile-preview-box h3 { margin-top: 0; }
    .profile-preview { white-space: pre-wrap; margin: 0; font: inherit; overflow-wrap: anywhere; }
  `,
  logic: {
    // The fields in screen order. `share` is the default for the switch; `long` fields get a bigger box.
    // This list must match Desk.prompt.profileFields (a unit test checks it).
    fields: [
      { key: 'roles', share: true, long: false },
      { key: 'field', share: true, long: false },
      { key: 'background', share: false, long: true },
      { key: 'area', share: true, long: false },
      { key: 'languages', share: true, long: false },
      { key: 'replyLanguage', share: true, long: false },
      { key: 'availability', share: false, long: false },
      { key: 'avoid', share: false, long: true },
    ],
    // Whether the switch for a field is on: what the person chose, else the default.
    isShared(profile, key) {
      const share = profile && profile.share && typeof profile.share === 'object' ? profile.share : {};
      if (typeof share[key] === 'boolean') return share[key];
      const f = this.fields.filter((x) => x.key === key)[0];
      return f ? f.share : false;
    },
    // The record to save after one text box changed. Keeps everything else on the record.
    withValue(profile, key, value) {
      if (!this.fields.some((x) => x.key === key)) return Object.assign({}, profile, { id: 'profile', type: 'profile' });
      const next = Object.assign({}, profile, { id: 'profile', type: 'profile' });
      next[key] = String(value);
      return next;
    },
    // The record to save after one switch changed. Writes every switch, so the choice is kept even if defaults change.
    withShare(profile, key, on) {
      const next = Object.assign({}, profile, { id: 'profile', type: 'profile' });
      const share = {};
      this.fields.forEach((f) => { share[f.key] = this.isShared(profile, f.key); });
      if (this.fields.some((x) => x.key === key)) share[key] = !!on;
      next.share = share;
      return next;
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    ctx.slot('tab', {
      id: 'profile',
      label: ctx.t('tabLabel'),
      order: 20,
      render(el) {
        const profile = ctx.store.get('profile') || {};
        const lines = ctx.profileLines(profile);

        const fields = logic.fields.map((f) => {
          const id = 'profile-field-' + f.key;
          const input = f.long
            ? h('textarea', { id: id, rows: '3', 'data-test': 'profile-field-' + f.key })
            : h('input', { id: id, type: 'text', 'data-test': 'profile-field-' + f.key });
          input.value = typeof profile[f.key] === 'string' ? profile[f.key] : '';
          input.addEventListener('input', () => {
            ctx.store.put(logic.withValue(ctx.store.get('profile') || {}, f.key, input.value));
          });
          const sid = 'profile-share-' + f.key;
          const box = h('input', { id: sid, type: 'checkbox', 'data-test': 'profile-share-' + f.key });
          box.checked = logic.isShared(profile, f.key);
          box.addEventListener('change', () => {
            ctx.store.put(logic.withShare(ctx.store.get('profile') || {}, f.key, box.checked));
          });
          return h('div', { class: 'profile-field' },
            h('label', { for: id }, ctx.t('label.' + f.key)),
            input,
            h('div', { class: 'profile-share' }, box,
              h('label', { for: sid }, ctx.t('sendToAi')),
              h('span', { class: 'profile-hint' }, '(' + ctx.t(f.share ? 'defaultOn' : 'defaultOff') + ')')));
        });

        const preview = h('pre', { class: 'profile-preview', 'data-test': 'profile-preview' },
          lines.length ? lines.join('\n') : ctx.t('previewEmpty'));

        el.append(
          h('h2', {}, ctx.t('heading')),
          h('p', {}, ctx.t('intro')),
          h('p', { class: 'profile-hint' }, ctx.t('noName')),
          h('div', { class: 'profile-form' }, ...fields),
          h('section', { class: 'profile-preview-box', 'aria-labelledby': 'profile-preview-h' },
            h('h3', { id: 'profile-preview-h' }, ctx.t('previewHeading')),
            h('p', { class: 'profile-hint' }, ctx.t('previewIntro')),
            preview));
      },
    });
  },
});
