// Prompt envelope, short codes, alias maps, size budget; pure except remember(). DESIGN 9.2, 9.3.
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

  // ---- codes -------------------------------------------------------------------------------------------------------
  // Crockford base32 (no I L O U) without 0 and 1, so no character can be read as O or I. 30 characters, 4 long.
  P.CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  P.CODE_PREFIX = 'DESK-';
  P.BUDGET = 6000;      // characters per question (DESIGN 9.3)
  P.TITLE_MAX = 80;     // longest title cell, in characters
  P.KEEP = 30;          // prompt records kept

  function defaultRandom(n) {
    var a = new Uint8Array(n);
    window.crypto.getRandomValues(a);
    return a;
  }

  // A new code like "7Q3K" (without the DESK- prefix). `randomBytes(n)` returns n bytes (default: window.crypto);
  // `taken` is an optional list of codes to avoid. Bytes of 240 or more are skipped so every character is equally likely.
  P.code = function (randomBytes, taken) {
    var rnd = randomBytes || defaultRandom, n = P.CODE_CHARS.length, used = {};
    (taken || []).forEach(function (c) { used[P.normalizeCode(c)] = true; });
    for (var tries = 0; tries < 1000; tries++) {
      var out = '', b = rnd(8), i = 0;
      while (out.length < 4 && i < b.length) {
        if (b[i] < 240) out += P.CODE_CHARS.charAt(b[i] % n);
        i++;
      }
      if (out.length === 4 && !used[out]) return out;
    }
    throw new Error('Could not make a new question code.');
  };

  // "desk-7q3k", " DESK 7Q3K " or "7q3k" -> "7Q3K"; anything that is not a code -> ''.
  P.normalizeCode = function (s) {
    var t = String(s == null ? '' : s).toUpperCase().replace(/^\s*DESK[\s-]*/, '').replace(/\s+/g, '');
    return /^[2-9A-HJKMNP-TV-Z]{4}$/.test(t) ? t : '';
  };

  // ---- aliases -----------------------------------------------------------------------------------------------------
  // rows: [{kind: 'L', id: '<record id>', ...}] in the order they will be shown. Numbers run 1, 2, 3... across all
  // letters, so L1-L20 then C21-C40, and the same input order always gives the same aliases.
  // Returns [{alias: 'L1', kind: 'L', n: 1, id, row}].
  P.assignAliases = function (rows) {
    return (rows || []).map(function (row, i) {
      var kind = String(row && row.kind || 'X').toUpperCase().replace(/[^A-Z]/g, '') || 'X';
      return { alias: kind + (i + 1), kind: kind, n: i + 1, id: row && row.id, row: row };
    });
  };

  // ---- templates ---------------------------------------------------------------------------------------------------
  var PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function asText(v) { return Array.isArray(v) ? v.join('\n') : (v == null ? '' : String(v)); }

  // The {names} in a template, once each, in order of first use.
  P.placeholders = function (template) {
    var out = [], m;
    PLACEHOLDER.lastIndex = 0;
    while ((m = PLACEHOLDER.exec(String(template || '')))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
    return out;
  };

  // Only {name} substitution, one pass (a value that contains {x} is not filled again). A name with no value in
  // `vars` stays visible as {name}. Arrays are joined with line breaks.
  P.fill = function (template, vars) {
    var v = vars || {};
    return String(template || '').replace(PLACEHOLDER, function (all, name) {
      return has(v, name) && v[name] !== undefined ? asText(v[name]) : all;
    });
  };

  // Names used in the template that are not in `allowed` (an array of names, or an object whose keys are names).
  // These are the ones P.fill leaves visible as {name}.
  P.missingPlaceholders = function (template, allowed) {
    var ok = Array.isArray(allowed) ? allowed : Object.keys(allowed || {});
    return P.placeholders(template).filter(function (n) { return ok.indexOf(n) < 0; });
  };

  // The opposite check, for the editor (DESIGN 9.11): allowed names the template no longer uses ("{items} is gone").
  P.absentPlaceholders = function (template, allowed) {
    var ok = Array.isArray(allowed) ? allowed : Object.keys(allowed || {}), used = P.placeholders(template);
    return ok.filter(function (n) { return used.indexOf(n) < 0; });
  };

  // ---- the items table ---------------------------------------------------------------------------------------------
  function cell(v, max) {
    var t = asText(v).replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
    if (max && t.length > max) t = t.slice(0, max - 1).replace(/\s+$/, '') + '…';
    return t;
  }
  function titleColumn(header) { // index among the cells after the alias, or -1
    var cols = String(header || '').split('|').map(function (c) { return c.trim().toLowerCase(); });
    var i = cols.indexOf('title');
    return i < 0 ? -1 : i - 1; // column 0 is the alias
  }

  // aliased: from assignAliases (each .row has `cols`). Returns the header line then one "alias | a | b | c" line per
  // row. Pipes inside a cell become "/", line breaks become spaces, and the title cell is cut at 80 characters.
  P.itemsTable = function (aliased, header) {
    var tcol = titleColumn(header);
    var lines = [String(header || 'alias | title').trim()];
    aliased.forEach(function (a) {
      var cols = (a.row && a.row.cols) || [];
      lines.push([a.alias].concat(cols.map(function (c, i) { return cell(c, i === tcol ? P.TITLE_MAX : 0); })).join(' | '));
    });
    return lines.join('\n');
  };

  // ---- HOW TO ANSWER -----------------------------------------------------------------------------------------------
  // From recipe.answer ({KIND: [fields]}, 'text' or null) and recipe.example. Null answer gives '' (no block).
  // opts: {code: '7Q3K', replyLanguage: 'English', aliased: ['L', 'C']} (kinds that have numbered rows).
  P.howToAnswer = function (recipe, opts) {
    var r = recipe || {}, o = opts || {}, ans = r.answer;
    if (!ans) return '';
    var code = P.CODE_PREFIX + (P.normalizeCode(o.code) || String(o.code || '')), out = ['HOW TO ANSWER'];
    out.push('Put your whole answer inside one code block.');
    out.push('First line: ' + code);
    var lang = o.replyLanguage ? String(o.replyLanguage).replace(/\s+/g, ' ').trim() : '';
    if (ans === 'text') {
      out.push('Then your answer as plain text.');
      if (r.example) out.push(asText(r.example).replace(/\s+$/, '')); // (T3.7) a recipe may add one more line of format
      if (lang) out.push('Write it in ' + lang + '.');
      return out.join('\n');
    }
    var example = asText(r.example).replace(/\s+$/, '');
    out.push('Then one line for each pick, like this:');
    if (example) out.push(example);
    var shown = {};
    example.split('\n').forEach(function (l) {
      var m = /^\s*([A-Za-z-]+?)\d*\s*\|/.exec(l);
      if (m) shown[m[1].toUpperCase()] = true;
    });
    var more = Object.keys(ans).filter(function (k) { return !shown[k.toUpperCase()]; }).map(function (k) {
      var numbered = (o.aliased || []).indexOf(k) >= 0;
      return (numbered ? k + '<n>' : k) + ' | ' + (ans[k] || []).join(' | ');
    });
    if (more.length) { out.push('You may also use:'); out = out.concat(more); }
    var fields = Object.keys(ans).reduce(function (a, k) { return a.concat(ans[k] || []); }, []);
    if (lang) out.push((fields.indexOf('why') >= 0 ? 'Write the reasons in ' : 'Write the text in ') + lang + '.');
    return out.join('\n');
  };

  // ---- build -------------------------------------------------------------------------------------------------------
  // recipe: {id, template, answer, example, budget?}. `template` may be replaced by the person's edit: pass
  // opts.template. data: {profile: [...lines], <name>: text, replyLanguage?, items?: {header, kinds: {L: rows, C: rows}}}
  // where a row is {id, cols: [...]}. opts: {code, now, budget, template}.
  // Returns {text, code, aliases: {L1: id}, record, size, truncated, dropped, missing}.
  //   truncated: rows were dropped to fit the budget (never the task text or HOW TO ANSWER); dropped: how many.
  //   missing: {names} left visible as {name} because no value was given.
  P.build = function (recipe, data, opts) {
    var r = recipe || {}, d = data || {}, o = opts || {};
    var code = P.normalizeCode(o.code) || P.code(o.random);
    var budget = o.budget !== undefined ? o.budget : (r.budget !== undefined ? r.budget : P.BUDGET);
    var template = o.template != null ? String(o.template) : String(r.template || '');
    var items = d.items && d.items.kinds ? d.items : null;
    var kinds = items ? Object.keys(items.kinds) : [];
    var groups = {};
    kinds.forEach(function (k) { groups[k] = (items.kinds[k] || []).map(function (row) { return Object.assign({ kind: k }, row); }); });
    var lang = o.replyLanguage || d.replyLanguage;
    var dropped = 0, res;

    function render() {
      var flat = [];
      kinds.forEach(function (k) { flat = flat.concat(groups[k]); });
      var aliased = P.assignAliases(flat);
      var vars = {};
      Object.keys(d).forEach(function (k) { if (k !== 'items') vars[k] = d[k]; });
      var table = '';
      if (items) table = aliased.length ? P.itemsTable(aliased, items.header) : '';
      vars.items = table;
      var task = P.fill(template, vars).replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
      if (items && table && P.placeholders(template).indexOf('items') < 0) task += '\n\n' + table;
      var parts = ['[A question from Search Desk, a job-search page. Code: ' + P.CODE_PREFIX + code + ']', task];
      var how = P.howToAnswer(r, { code: code, replyLanguage: lang, aliased: kinds.filter(function (k) { return groups[k].length; }) });
      if (how) parts.push(how);
      var text = parts.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
      var map = {};
      aliased.forEach(function (a) { map[a.alias] = a.id; });
      return { text: text, aliases: map };
    }

    res = render();
    // Over budget: drop rows from the end of the longest list, one at a time, until it fits. Aliases are made again
    // each time so the numbers stay unique and gap-free.
    while (budget && res.text.length > budget) {
      var big = null;
      kinds.forEach(function (k) { if (groups[k].length && (!big || groups[k].length > groups[big].length)) big = k; });
      if (!big) break;
      groups[big].pop();
      dropped++;
      res = render();
    }
    var missing = P.missingPlaceholders(template, Object.keys(d).concat(['items']));
    var created = new Date(o.now !== undefined ? o.now : Date.now()).toISOString();
    return {
      text: res.text, code: code, aliases: res.aliases, size: res.text.length,
      truncated: dropped > 0, dropped: dropped, missing: missing,
      record: { type: 'prompt', recipe: r.id || '', code: code, aliases: res.aliases, created: created, source: 'user' },
    };
  };

  // ---- prompt records ----------------------------------------------------------------------------------------------
  // The only store-bound function here. Saves build()'s `record` (id "p_<code>") and removes the oldest beyond 30.
  // Needs the store; the shell calls it when someone copies a question.
  P.remember = function (record) {
    var S = Desk.store;
    if (!S || !record || !record.code) return null;
    var rec = Object.assign({}, record, { type: 'prompt', id: 'p_' + String(record.code).toLowerCase() });
    var saved = S.putQuiet(rec);
    var all = S.all('prompt').sort(function (a, b) { return a.created < b.created ? 1 : a.created > b.created ? -1 : a.id < b.id ? 1 : -1; });
    var old = all.slice(P.KEEP).map(function (r) { return r.id; });
    if (old.length) S.purgeQuiet(old);
    return saved;
  };

  // Codes already in the store, to pass to P.code(random, taken).
  P.usedCodes = function () {
    return Desk.store ? Desk.store.all('prompt', { withDeleted: true }).map(function (r) { return r.code; }) : [];
  };
})();
