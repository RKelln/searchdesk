// Prompt envelope, short codes, alias maps, size budget; pure. T2.2 adds only profileLines; T3.1 builds the rest.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var P = Desk.prompt = Desk.prompt || {};

  // The profile fields that may go into a question, in the order they appear. `label` is the word the AI sees,
  // `share` is the default for the "send to AI" switch (DESIGN 9.9). There is no name, email or phone: on purpose.
  P.profileFields = [
    { key: 'roles', label: 'What work', share: true },
    { key: 'field', label: 'Field', share: true },
    { key: 'background', label: 'Background', share: false },
    { key: 'area', label: 'Area', share: true },
    { key: 'languages', label: 'Languages', share: true },
    { key: 'replyLanguage', label: 'Reply language', share: true },
    { key: 'availability', label: 'Availability', share: false },
    { key: 'avoid', label: 'Avoid', share: false },
  ];

  // Lines for the shared, non-empty profile fields, like "What work: Office administration".
  // A missing `share` (or a missing key in it) means that field's default. Line breaks in a value become spaces.
  P.profileLines = function (profile) {
    var p = profile || {};
    var share = p.share && typeof p.share === 'object' ? p.share : {};
    var out = [];
    P.profileFields.forEach(function (f) {
      var on = typeof share[f.key] === 'boolean' ? share[f.key] : f.share;
      if (!on) return;
      var v = p[f.key];
      if (typeof v !== 'string') return;
      v = v.replace(/\s+/g, ' ').trim();
      if (v) out.push(f.label + ': ' + v);
    });
    return out;
  };
})();
