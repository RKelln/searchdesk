'use strict';
// Remembering a setting: one way to say what a preference is, so four features do not each build the same control.
//
// A feature declares its preferences in mount:
//
//   ctx.pref({ key: 'size', label: 'Text size', type: 'choice', def: 'normal',
//              options: [{ value: 'normal', label: 'Normal' }, { value: 'big', label: 'Bigger' }] });
//   ctx.pref({ key: 'contrast', label: 'Stronger contrast', type: 'toggle', def: false, onChange: apply });
//   ctx.pref.note(ctx.t('saveNote'));
//
// They appear as one block on the Data screen, titled with the feature's own name, and are saved on the settings
// record under ext.<feature id> -- the record that travels in the person's backup file.
//
//   ctx.pref('size')               the value, or the default when the saved one is not offered any more
//   ctx.pref.set('size', 'big')   save it; returns false and changes nothing if the value is not on offer
//
// Two kinds only, choice and toggle, because those are the kinds the briefs in docs/features/ ask for. A new kind
// is added here, never improvised inside a feature: then it looks the same and a value nobody offers still falls
// back to the default.
//
// onChange runs after the save, so it can read the new value back. It is for a preference that has to change the
// page (a bigger text size is a class on the page), not for saving, which is already done.
//
// The pure parts -- which value is allowed, and what to read when the saved one has gone stale -- are Desk.prefs,
// so they can be checked with no page.

window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var TYPES = { choice: true, toggle: true };
  var KEY_RE = /^[a-z][a-zA-Z0-9]*$/;

  // ---- The pure part. These two are checked in tests/unit/prefs.test.js. -------------------------------

  // Is this value one this preference offers? A toggle offers true and false; a choice offers its options.
  function allowed(def, value) {
    if (!def || TYPES[def.type] !== true) return false;
    if (def.type === 'toggle') return value === true || value === false;
    var opts = def.options;
    if (!Array.isArray(opts)) return false;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i] && opts[i].value === value) return true;
    }
    return false;
  }

  // The value to use: the saved one when it is still on offer, and the default when it is not. A file can be old
  // or hand-edited, so "not on offer" is normal and must never be a crash.
  function read(def, extObj) {
    var saved = extObj ? extObj[def.key] : undefined;
    if (allowed(def, saved)) return saved;
    return def.def;
  }

  Desk.prefs = { allowed: allowed, read: read, types: function () { return Object.keys(TYPES); } };

  // ---- The part that needs a page. ---------------------------------------------------------------------

  function own(ctx, def) { return ((Desk.store.get('settings') || {}).ext || {})[def.id] || {}; }

  // Copy what the feature asked for into one plain object, so everything after this reads the same shape and a
  // half-specified preference cannot reach the DOM.
  function spec(def, s) {
    var out = {
      key: String(s.key),
      type: s.type,
      label: typeof s.label === 'string' && s.label ? s.label : String(s.key),
      options: null,
      hint: typeof s.hint === 'string' ? s.hint : '',
      onChange: typeof s.onChange === 'function' ? s.onChange : null,
    };
    if (s.type === 'toggle') {
      out.def = s.def === true; // anything else means off
      return out;
    }
    out.options = (Array.isArray(s.options) ? s.options : []).map(function (o) {
      return { value: o && o.value, label: (o && typeof o.label === 'string' && o.label) ? o.label : String(o && o.value) };
    });
    out.def = s.def;
    return out;
  }

  function problems(d) {
    var bad = [];
    if (!KEY_RE.test(d.key)) bad.push('"' + d.key + '" is not a key this accepts: start with a lowercase letter, then letters or digits, for example "size".');
    if (TYPES[d.type] !== true) bad.push('"' + d.type + '" is not a kind this knows. Use ' + Desk.prefs.types().map(function (t) { return '"' + t + '"'; }).join(' or ') + '.');
    if (d.type === 'choice') {
      if (!d.options.length) bad.push('a choice needs options, like [{ value: "big", label: "Bigger" }].');
      if (d.options.length && !allowed(d, d.def)) bad.push('the default ' + JSON.stringify(d.def) + ' is not one of the options.');
    }
    return bad;
  }

  // Called by the shell once per feature: makeCtx hands this to ctx.pref.
  function make(ctx, def) {
    var H = Desk.h;
    var mine = [];
    var byKey = {};
    var note = '';

    function extObj() { return own(ctx, def); }

    function save(d, value) {
      // Refuse a value nobody offers rather than storing it: a later read would ignore it anyway, and the
      // person would see the control disagree with what is saved.
      if (!allowed(d, value)) return false;
      var patch = {};
      patch[d.key] = value;
      ctx.store.ext('settings', patch); // a store change, so the screen is drawn again by itself
      if (d.onChange) {
        try { d.onChange(value); }
        catch (e) { if (window.console) window.console.error(e); }
      }
      return true;
    }

    function control(d, value) {
      var test = 'pref-' + d.key;
      if (d.type === 'toggle') {
        // `checked` is a boolean attribute, so true checks the box and false leaves it out, which is how the
        // control comes back showing what is saved. No property to set.
        return H('input', { type: 'checkbox', id: test, 'aria-label': d.label, 'data-test': test,
          checked: value === true,
          on: { change: function (e) { save(d, e.target.checked === true); } } });
      }
      // h() sets a select's value as a property, after the options are in, so the control shows what is saved.
      return H('select', { id: test, 'data-test': test, value: value,
        on: { change: function (e) { save(d, e.target.value); } } },
        d.options.map(function (o) { return H('option', { value: String(o.value) }, o.label); }));
    }

    function row(d) {
      var value = read(d, extObj());
      var el = H('div', { class: 'pref-row' });
      if (d.type === 'toggle') {
        el.appendChild(H('label', { class: 'pref-toggle' }, control(d, value), ' ', d.label));
      } else {
        el.appendChild(H('label', { class: 'pref-label', for: 'pref-' + d.key }, d.label));
        el.appendChild(control(d, value));
      }
      if (d.hint) el.appendChild(H('p', { class: 'muted pref-hint' }, d.hint));
      // Only offer the way back when there is somewhere to go back from.
      if (value !== d.def) {
        el.appendChild(H('button', { type: 'button', class: 'pref-reset', 'data-test': 'pref-reset-' + d.key,
          on: { click: function () { save(d, d.def); } } }, Desk.t('prefReset')));
      }
      return el;
    }

    function renderBlock(el) {
      if (!mine.length) return; // nothing declared: the slot leaves an empty block out
      mine.forEach(function (d) { el.appendChild(row(d)); });
      if (note) el.appendChild(H('p', { class: 'muted pref-note' }, note));
    }

    // Declaring the first preference is what puts the block on the Data screen. Doing it here rather than at the
    // end of mount() means a feature with no preferences never adds an empty block at all.
    function ensureBlock() {
      if (mine.length !== 1) return;
      ctx.slot('settings', { id: def.id, title: def.name || def.id, render: renderBlock });
    }

    function pref(key) {
      if (typeof key === 'string') return byKey[key] ? read(byKey[key], extObj()) : undefined;
      var d = spec(def, key || {});
      var bad = problems(d);
      if (bad.length) throw new Error('ctx.pref: ' + bad.join(' '));
      if (byKey[d.key]) throw new Error('ctx.pref: "' + d.key + '" is already one of this feature\'s preferences.');
      byKey[d.key] = d;
      mine.push(d);
      ensureBlock();
      return undefined;
    }

    pref.set = function (key, value) {
      var d = byKey[key];
      if (!d) return false;
      // A select hands back a string, so '21' and 21 are the same choice.
      if (d.type === 'choice' && d.options.some(function (o) { return String(o.value) === value; })) {
        var real = d.options.filter(function (o) { return String(o.value) === value; })[0].value;
        return save(d, real);
      }
      return save(d, value);
    };
    pref.note = function (text) { note = typeof text === 'string' ? text : ''; return undefined; };
    return pref;
  }

  Desk.makePrefs = make;
})();