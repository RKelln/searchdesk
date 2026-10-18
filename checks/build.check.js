Desk.check('build', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'build', 'the feature has its id');
  t.eq(f.types, [], 'it owns no types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // It is a card made of words, so the words are the whole of it. Every one has to be there.
  const KEYS = ['slotTitle', 'lead', 'stepsHeading', 'step1', 'step2', 'step3', 'step4',
    'freeHeading', 'free', 'kitHeading', 'kit', 'note'];
  KEYS.forEach((k) => {
    t.ok(typeof f.strings[k] === 'string' && f.strings[k].length > 0, 'string ' + k + ' is there and has words');
  });

  // Plain words, at about grade 6. A step you cannot read in one breath is a wall of text.
  t.eq(L.tooLong(f.strings, 200), [], 'no string runs past 200 characters');

  // The steps are in the order a person does them, and none is a duplicate of another.
  const steps = L.steps((k) => f.strings[k]);
  t.eq(steps.length, 4, 'there are four steps');
  t.eq(steps, [f.strings.step1, f.strings.step2, f.strings.step3, f.strings.step4], 'the steps keep their order');
  t.eq(new Set(steps).size, 4, 'no step is the same words as another');

  // A missing string must be visible, not hidden: steps() hands back the key so it shows up here.
  const holed = { step1: 'one', step3: 'three' };
  t.eq(L.steps((k) => (k in holed ? holed[k] : k)), ['one', 'step2', 'three', 'step4'], 'a missing step is not quietly dropped');

  // tooLong is pure and says nothing about anything but length.
  t.eq(L.tooLong({}, 10), [], 'no strings means nothing too long');
  t.eq(L.tooLong({ a: '0123456789', b: '01234567890' }, 10), ['b'], 'only the long one is reported');
  t.eq(L.tooLong(undefined, 10), [], 'a missing table is not too long');
  t.eq(L.tooLong({ a: 5, b: null }, 1), [], 'only strings have a length');
});