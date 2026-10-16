// checks/profile.check.js  (the check for the profile feature; Desk.prompt.profileLines is tested in tests/unit/prompt.test.js)
Desk.check('profile', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'profile', 'the feature has its id');
  t.eq(f.types, ['profile'], 'it owns the profile type');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  const keys = L.fields.map((x) => x.key);
  t.eq(keys, ['roles', 'field', 'background', 'area', 'languages', 'replyLanguage', 'availability', 'avoid'], 'the fields are fixed');
  t.ok(!keys.some((k) => /name|email|phone/i.test(k)), 'there is no name, email or phone field');
  keys.forEach((k) => t.ok(f.strings['label.' + k], 'the field ' + k + ' has a label'));

  const on = L.fields.filter((x) => x.share).map((x) => x.key);
  t.eq(on, ['roles', 'field', 'area', 'languages', 'replyLanguage'], 'by default these are sent to the AI');

  t.ok(L.isShared({}, 'roles'), 'a missing share uses the default (on)');
  t.ok(!L.isShared({}, 'avoid'), 'a missing share uses the default (off)');
  t.ok(!L.isShared({ share: { roles: false } }, 'roles'), 'a switch turned off stays off');
  t.ok(L.isShared({ share: { avoid: true } }, 'avoid'), 'a switch turned on stays on');
  t.ok(L.isShared({ share: { avoid: true } }, 'field'), 'a switch not mentioned uses the default');
  t.ok(!L.isShared({}, 'name'), 'an unknown field is never shared');

  const a = L.withValue({ field: 'x', ext: { other: 1 } }, 'roles', ' cook ');
  t.eq([a.id, a.type, a.roles, a.field, a.ext.other], ['profile', 'profile', ' cook ', 'x', 1], 'a typed value is kept as typed and the rest stays');
  t.ok(!('name' in L.withValue({}, 'name', 'Sam')), 'an unknown field is not saved');

  const input = { share: { roles: true } };
  const b = L.withShare(input, 'avoid', true);
  t.eq(b.share.avoid, true, 'turning a switch on is saved');
  t.eq(b.share.field, true, 'the other switches are written with their current value');
  t.eq(b.share.background, false, 'defaults that are off are written as off');
  t.eq(input, { share: { roles: true } }, 'the record given is not changed');
  t.ok(!('name' in L.withShare({}, 'name', true).share), 'an unknown switch is not saved');
});
