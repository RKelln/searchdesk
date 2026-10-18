// features/build.js: how to add your own feature, for someone who has never done it.
//
// A feature is one file in the project folder, and this app has no way to take a file -- so the answer is a coding
// tool that can read and save that folder. This card says which tool, in four steps, and that it need not cost
// anything. It is deliberately just words: no records, no settings, nothing to go wrong.
Desk.register({
  id: 'build',
  name: 'Build your own feature',
  purpose: 'How to add a new part to Search Desk with a coding tool.',
  types: [],
  strings: {
    summary: 'Build your own feature',
    lead: 'A feature is one file in the project folder. This page has no way to take a file, so a coding tool does the work.',
    stepsHeading: 'How to do it',
    step1: 'Put the project folder on your computer.',
    step2: 'Open a coding tool that can read and save files, like OpenCode, and point it at that folder.',
    step3: 'Ask it to add a feature. It already knows an add-feature skill: it asks about you first, then offers three ideas from the folder\'s own list of things to build.',
    step4: 'It writes one file and runs the checks. Reload this page and open #selftest to see the new part.',
    freeHeading: 'It does not have to cost anything',
    free: 'A model marked Free can build a whole feature. In OpenCode, run /connect once, then /models, and pick one marked Free. You can also run a model on your own computer, with Ollama.',
    linksHeading: 'Where to get them',
    opencode: 'OpenCode',
    opencodeUrl: 'https://opencode.ai',
    ollama: 'Ollama',
    ollamaUrl: 'https://ollama.com',
    kitHeading: 'If you would rather not install anything',
    kit: 'Copy a kit from the folder, in docs/kits, and paste it into a free chat in this browser. Then save the answer as the file. You still have to save the file.',
    note: 'One feature is one file, so you can take it away again by deleting it and removing its name from the list.',
  },
  css: `
    .build-steps { margin: 0 0 1rem; }
    .build-steps li { margin-bottom: .5rem; }
    .build-links { margin: 0 0 1rem; }
    .build-card > summary { margin-bottom: .5rem; }
  `,
  logic: {
    // The four steps, in order. A missing one comes back as the key, because ctx.t shows a key it cannot find
    // rather than pretending it has words, so an empty step is visible here instead of silently missing.
    steps(t) {
      return ['step1', 'step2', 'step3', 'step4'].map(function (k) { return t(k); });
    },
    // Which strings are too long to read in one breath. This card is nothing but words, so a wall of text is the
    // only way it can go wrong, and a check is a better place to catch that than a person at a workshop.
    tooLong(strings, max) {
      var out = [];
      Object.keys(strings || {}).forEach(function (k) {
        if (typeof strings[k] === 'string' && strings[k].length > max) out.push(k);
      });
      return out;
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const t = ctx.t;
    const logic = this.logic;

    // Whether the card is open, kept here because the screen is drawn again after every store change and a redraw
    // would otherwise fold it shut under the person reading it. Nothing is saved: this is one visit, not a setting.
    let open = false;

    // "Never invent a link. If you do not have the real address, leave the link empty." So an empty address gives
    // the name in plain words, rather than a link that goes nowhere and looks like it would have worked.
    function maybeLink(label, url) {
      return url ? h('a', { href: url }, label) : label;
    }

    // No preferences: this feature changes nothing about the page and saves nothing.
    ctx.slot('ai', {
      id: 'build',
      order: 90, // after the other blocks on this screen, so the tasks still come first
      render(el) {
        // Folded away by default, so the tasks on this screen are what you see. No slot title: the summary is
        // the heading, and two headings saying the same thing is worse than one.
        const fold = h('details', {
          class: 'build-card',
          open: !!open,
          'data-test': 'build-card',
          on: { toggle: () => { open = fold.open; } },
        }, h('summary', { 'data-test': 'build-summary' }, t('summary')));

        // This is read, not scanned, so it keeps one comfortable width however wide the window is. The section
        // belongs to the slot, so the measure goes on something inside it.
        const box = h('div', { class: 'measure' });
        fold.appendChild(box);
        el.appendChild(fold);
        el = box;

        el.appendChild(h('p', { class: 'muted', 'data-test': 'build-lead' }, t('lead')));

        el.appendChild(h('h4', {}, t('stepsHeading')));
        const steps = h('ol', { class: 'build-steps', 'data-test': 'build-steps' });
        logic.steps(t).forEach(function (s) {
          if (!s) return;
          steps.appendChild(h('li', {}, s));
        });
        el.appendChild(steps);

        el.appendChild(h('h4', {}, t('freeHeading')));
        el.appendChild(h('p', {}, t('free')));

        el.appendChild(h('h4', {}, t('linksHeading')));
        el.appendChild(h('ul', { class: 'build-links', 'data-test': 'build-links' },
          h('li', {}, maybeLink(t('opencode'), t('opencodeUrl'))),
          h('li', {}, maybeLink(t('ollama'), t('ollamaUrl')))));

        el.appendChild(h('h4', {}, t('kitHeading')));
        el.appendChild(h('p', {}, t('kit')));

        el.appendChild(h('p', { class: 'muted' }, t('note')));
      },
    });
  },
});