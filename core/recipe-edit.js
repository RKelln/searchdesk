// Improving recipes (T3.7, DESIGN 9.11). Core owns the `recipe-edit` and `recipe-note` record types (DESIGN 6: "core
// (recipes)"), because they are about every recipe and the store lets only the owner write them.
//
// The instructions the built-in "Improve these instructions with AI" task sends. They are the first thing here on
// purpose: anyone can read and change them. {task}, {kept}, {notes} and {current} are filled in by the page.
//
//   recipe-edit   id `re_<recipe id>`: {recipe, text, why, versions: [{text, at}]}. `text` is the person's changed
//                 instructions ('' means "back to the original"; the versions are kept). prompt.build uses `text`
//                 in place of the recipe's template (core/recipes.js, editedTemplate).
//   recipe-note   {recipe, code, text, used}: the "Could be better" notes (saved in core/recipes.js).
//
// Pure functions are on Desk.recipeEdit (tested in tests/unit/recipe-edit.test.js). The screen part at the end only
// runs in a browser: it adds "Change the instructions" and the notes list under each task, and registers the
// "improve" task (hidden from the task list; it opens from the editor at #ai/improve/<task id>).
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var E = Desk.recipeEdit = Desk.recipeEdit || {};

  E.TEMPLATE = [
    'Improve the instructions below. They are sent to an AI chat for this task: {task}.',
    '',
    'What to do:',
    '- Keep every word in curly brackets that is listed under KEPT WORDS, spelled exactly the same. The page fills them in later. Add no new ones.',
    '- Change as little as you can. Keep what already works.',
    '- Fix the problems in the notes. If there are no notes, make the instructions clearer and shorter.',
    '- Use plain words. Do not add anything about how to format the answer. The page adds that.',
    '',
    'KEPT WORDS',
    '{kept}',
    '',
    'NOTES FROM THE PERSON',
    '{notes}',
    '',
    'CURRENT INSTRUCTIONS (between the lines)',
    '-----',
    '{current}',
    '-----'
  ].join('\n');
  E.EXAMPLE = 'After the code block, one more line like this:\nWhat changed: one short sentence about what you changed';

  E.MAX_VERSIONS = 5;   // earlier texts kept per recipe
  E.MAX_TEXT = 8000;    // characters in an edit
  E.MAX_NOTES = 10;     // notes sent with one improve question
  E.NOTE_CHARS = 300;   // each note is cut to this when sent
  E.LIMIT = 1500;       // characters free AI chats keep of custom instructions (a warning, never a block)
  E.MAX_DIFF = 90000;   // lines in A times lines in B above which the diff gets simple

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function P() { return Desk.prompt; }

  E.editId = function (recipeId) { return 're_' + String(recipeId || '').replace(/[^A-Za-z0-9_-]/g, '_'); };

  // Line breaks made the same, control characters out, trailing spaces out, cut to MAX_TEXT. Never trims the front.
  E.clean = function (text) {
    var t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    t = t.split('\n').map(function (l) { return l.replace(/[ \t]+$/, ''); }).join('\n').replace(/\s+$/, '');
    if (t.length > E.MAX_TEXT) t = t.slice(0, E.MAX_TEXT).replace(/\s+$/, '');
    return t;
  };
  E.same = function (a, b) { return E.clean(a) === E.clean(b); };

  // The text a question uses: the edit when there is one, else the recipe's own template.
  E.effective = function (original, edit) {
    return edit && typeof edit.text === 'string' && edit.text.trim() ? edit.text : String(original || '');
  };

  // ---- versions ------------------------------------------------------------------------------------------------------
  // versions: [{text, at}], newest first. The new text goes first; the same text elsewhere in the list moves to the
  // front instead of being kept twice; at most `max` (default 5) are kept.
  E.addVersion = function (versions, text, at, max) {
    var limit = max || E.MAX_VERSIONS;
    var list = (Array.isArray(versions) ? versions : []).filter(function (v) { return isObj(v) && typeof v.text === 'string' && v.text !== text; });
    return [{ text: text, at: at || '' }].concat(list).slice(0, limit).map(function (v) { return { text: v.text, at: v.at || '' }; });
  };

  // The record to save for new text. `existing` is the stored record (or null). Pure: `at` is the time as ISO text.
  E.makeEdit = function (existing, recipeId, text, why, at) {
    var t = E.clean(text), ex = isObj(existing) ? existing : {};
    return Object.assign({}, ex, {
      type: 'recipe-edit', id: E.editId(recipeId), recipe: String(recipeId),
      text: t, why: String(why == null ? '' : why).replace(/\s+/g, ' ').trim().slice(0, 300),
      versions: E.addVersion(ex.versions, t, at)
    });
  };
  // Back to the original: the text is emptied and the versions stay. Null when there is nothing to reset.
  E.resetEdit = function (existing) {
    if (!isObj(existing) || !String(existing.text || '').trim()) return null;
    return Object.assign({}, existing, { text: '', why: '' });
  };

  // ---- placeholders --------------------------------------------------------------------------------------------------
  // The names a recipe's text may use, with a plain description each: def.placeholders, else the names in its template.
  E.allowed = function (def) {
    var d = def || {};
    if (isObj(d.placeholders) && Object.keys(d.placeholders).length) return Object.keys(d.placeholders);
    return P().placeholders(d.template || '');
  };
  E.describe = function (def, name) {
    var d = def && isObj(def.placeholders) ? def.placeholders[name] : '';
    return typeof d === 'string' ? d : '';
  };
  // -> {absent: [names the text dropped], unknown: [names the task does not know]}
  E.check = function (text, def) {
    var names = E.allowed(def);
    var known = names.concat(['profile', 'items']);
    return { absent: P().absentPlaceholders(text, names), unknown: P().missingPlaceholders(text, known) };
  };

  // Characters in the instructions the person controls. A recipe may say how with def.instructionsLength(text, ctx)
  // (the coach fills its options first); otherwise it is the text as typed, minus a trailing {context} block.
  E.instructionsLength = function (text, def) {
    var t = String(text == null ? '' : text);
    if (def && typeof def.instructionsLength === 'function') {
      try { var n = def.instructionsLength(t, Desk.recipes.ctx()); if (typeof n === 'number' && isFinite(n)) return n; } catch (e) { if (window.console) console.error(e); }
    }
    return t.replace(/\r\n?/g, '\n').replace(/\s*\{context\}\s*$/, '').replace(/\s+$/, '').length;
  };
  E.tooLong = function (text, def) { var n = E.instructionsLength(text, def); return n > E.LIMIT ? n : 0; };

  // ---- the line diff -------------------------------------------------------------------------------------------------
  // Rows for the side-by-side view: [{a, b, changed}]. a is the line in the old text, b in the new (null when that side
  // has no line there). Same lines come as one row with both sides. A run of removed and added lines is paired up in
  // order and marked changed. Lines that differ only by spaces at the end count as the same.
  E.lineDiff = function (oldText, newText) {
    var A = String(oldText == null ? '' : oldText).replace(/\r\n?/g, '\n').split('\n');
    var B = String(newText == null ? '' : newText).replace(/\r\n?/g, '\n').split('\n');
    var ka = A.map(function (l) { return l.replace(/\s+$/, ''); }), kb = B.map(function (l) { return l.replace(/\s+$/, ''); });
    var ops = [], i, j, pre = 0, suf = 0;
    while (pre < ka.length && pre < kb.length && ka[pre] === kb[pre]) pre++;
    while (suf < ka.length - pre && suf < kb.length - pre && ka[ka.length - 1 - suf] === kb[kb.length - 1 - suf]) suf++;
    var ma = ka.slice(pre, ka.length - suf), mb = kb.slice(pre, kb.length - suf);
    for (i = 0; i < pre; i++) ops.push(['=', i, i]);
    if (ma.length * mb.length > E.MAX_DIFF) { // too big for the exact way: the middle is one changed block
      ma.forEach(function (_, k) { ops.push(['-', pre + k, -1]); });
      mb.forEach(function (_, k) { ops.push(['+', -1, pre + k]); });
    } else {
      var n = ma.length, m = mb.length, t = [];
      for (i = 0; i <= n; i++) { t.push([]); for (j = 0; j <= m; j++) t[i].push(0); }
      for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) {
        t[i][j] = ma[i] === mb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
      }
      i = 0; j = 0;
      while (i < n || j < m) {
        if (i < n && j < m && ma[i] === mb[j]) { ops.push(['=', pre + i, pre + j]); i++; j++; }
        else if (j >= m || (i < n && t[i + 1][j] >= t[i][j + 1])) { ops.push(['-', pre + i, -1]); i++; }
        else { ops.push(['+', -1, pre + j]); j++; }
      }
    }
    for (i = 0; i < suf; i++) ops.push(['=', ka.length - suf + i, kb.length - suf + i]);
    var rows = [], dels = [], adds = [];
    function flush() {
      var most = Math.max(dels.length, adds.length);
      for (var k = 0; k < most; k++) rows.push({ a: k < dels.length ? A[dels[k]] : null, b: k < adds.length ? B[adds[k]] : null, changed: true });
      dels = []; adds = [];
    }
    ops.forEach(function (op) {
      if (op[0] === '=') { flush(); rows.push({ a: A[op[1]], b: B[op[2]], changed: false }); }
      else if (op[0] === '-') dels.push(op[1]);
      else adds.push(op[2]);
    });
    flush();
    return rows;
  };
  E.changedCount = function (rows) { return (rows || []).filter(function (r) { return r.changed; }).length; };

  // ---- notes ---------------------------------------------------------------------------------------------------------
  // The notes of one recipe, newest first. `unusedOnly` leaves out the ones an improvement already used.
  E.notesFor = function (notes, recipeId, unusedOnly) {
    return (notes || []).filter(function (n) {
      return n && !n.deleted && n.recipe === recipeId && (!unusedOnly || !n.used);
    }).sort(function (a, b) { return a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : (a.id < b.id ? 1 : -1); });
  };
  // The notes that go with an improve question: unused, with a sentence, the newest MAX_NOTES.
  E.notesToSend = function (notes, recipeId) {
    return E.notesFor(notes, recipeId, true).filter(function (n) { return String(n.text || '').trim(); }).slice(0, E.MAX_NOTES);
  };
  function oneLine(s, max) {
    var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return max && t.length > max ? t.slice(0, max - 1).replace(/\s+$/, '') + '…' : t;
  }
  E.noteLines = function (notes) {
    if (!notes || !notes.length) return '(none yet)';
    return notes.map(function (n) { return '- ' + oneLine(n.text, E.NOTE_CHARS); }).join('\n');
  };
  E.keptLines = function (def) {
    var names = E.allowed(def);
    if (!names.length) return '(none)';
    return names.map(function (n) { var d = E.describe(def, n); return '{' + n + '}' + (d ? ' - ' + oneLine(d, 120) : ''); }).join('\n');
  };

  // ---- the "improve" task --------------------------------------------------------------------------------------------
  // The recipe def. It reads the target task from the address (#ai/improve/<task id>) and remembers it, with the ids of
  // the notes it sent, on the question (`keep`), so an answer pasted after a reload still knows what it is for.
  function target(args) { var id = args && args[0]; return id && id !== 'improve' ? Desk.recipes.get(id) : null; }
  function sentNotes(ctx, id) { return E.notesToSend(ctx.store.all('recipe-note'), id); }
  function T(k, v) { return Desk.t(k, v); }

  E.improveDef = function () {
    return {
      id: 'improve', listed: false, noEdit: true,
      title: T('imTitle'), blurb: T('imBlurb'),
      template: E.TEMPLATE,
      placeholders: { task: 'the name of the task', kept: 'the words in curly brackets the AI must keep', notes: 'your "Could be better" notes', current: 'the instructions as they are now' },
      budget: 0,
      answer: 'text', example: E.EXAMPLE,
      tips: [T('imTip')],
      needs: function (ctx, opts) {
        return target((opts || {}).args) ? [] : [{ text: T('imNeedsPick'), go: 'ai' }];
      },
      data: function (ctx, opts) {
        var def = target(opts.args);
        if (!def) return { task: '', kept: '', notes: '', current: '', replyLanguage: '' };
        return {
          task: Desk.recipes.titleOf(def), kept: E.keptLines(def),
          notes: E.noteLines(sentNotes(ctx, def.id)),
          current: E.effective(def.template, ctx.store.get(E.editId(def.id))),
          replyLanguage: '' // the instructions stay in the language they are in
        };
      },
      keep: function (ctx, opts) {
        var def = target(opts.args);
        return def ? { target: def.id, notes: sentNotes(ctx, def.id).map(function (n) { return n.id; }) } : {};
      },
      apply: function (result) {
        var hit = (result.accepted || []).filter(function (a) { return a.kind === 'TEXT'; })[0];
        var keep = (result.prompt && result.prompt.keep) || {};
        var def = keep.target ? Desk.recipes.get(keep.target) : null;
        if (!hit || !def) return { suggestions: [], text: T('imNoTarget') };
        var text = E.clean(hit.text), summary = oneLine(hit.summary, 300), notes = Array.isArray(keep.notes) ? keep.notes : [];
        var state = {}; // what the person chose for this answer; a new paste starts fresh
        return { suggestions: [], text: T('imReady'), render: function (el) { E.compare(el, def, text, summary, notes, state); } };
      }
    };
  };
  if (Desk.recipes && Desk.recipes.register && Desk.t) Desk.recipes.register(E.improveDef());

  // ---- the screen (browser only) -------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !Desk.h || !Desk.recipes || !Desk.recipes.panelExtras) return;
  var H = Desk.h, S = function () { return Desk.store; };
  var ui = { open: {}, drafts: {}, why: {}, saved: {} };   // per task id; kept while the screen is drawn again

  function stamp() { return Desk.now().toISOString(); }
  function redraw() { if (Desk.redraw) Desk.redraw(); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function whenText(iso) { try { return Desk.fmtRelative(iso, Desk.now(), { past: 'ago' }); } catch (e) { return ''; } }

  // Saves new text as ONE undo step (and marks notes used). Text equal to the original is the same as "back to the original".
  function saveText(def, text, why, usedNoteIds) {
    var st = S(), existing = st.get(E.editId(def.id)), clean = E.clean(text);
    var rec = E.same(clean, def.template) ? E.resetEdit(existing) : E.makeEdit(existing, def.id, clean, why, stamp());
    st.batch(T('reLabel'), function () {
      if (rec) st.put(rec);
      (usedNoteIds || []).forEach(function (id) {
        var n = st.get(id);
        if (n && n.type === 'recipe-note' && !n.used) st.put(Object.assign({}, n, { used: true }));
      });
    });
    return st.undoToken();
  }
  function resetText(def) {
    var st = S(), rec = E.resetEdit(st.get(E.editId(def.id)));
    if (!rec) return;
    st.batch(T('reLabel'), function () { st.put(rec); });
  }

  // Warning lines for a text: what it dropped and what it does not know.
  function warnings(text, def) {
    var c = E.check(text, def), out = [];
    c.absent.forEach(function (n) {
      out.push(T('reAbsent', { name: '{' + n + '}', what: E.describe(def, n) || T('reAbsentFallback') }));
    });
    c.unknown.forEach(function (n) { out.push(T('reUnknown', { name: '{' + n + '}' })); });
    return out;
  }
  function fillWarnings(box, text, def) {
    clear(box);
    warnings(text, def).forEach(function (w) { box.appendChild(H('p', { class: 're-warn', 'data-test': 're-warn' }, w)); });
    var n = E.tooLong(text, def);
    if (n) box.appendChild(H('p', { class: 're-warn', 'data-test': 'instructions-long' }, T('instructionsLong', { n: n, max: E.LIMIT })));
  }

  function placeholderList(def, text) {
    var ul = H('ul', { class: 're-ph', 'data-test': 'recipe-edit-placeholders' });
    var used = Desk.prompt.placeholders(text);
    E.allowed(def).forEach(function (n) {
      var on = used.indexOf(n) >= 0, d = E.describe(def, n);
      ul.appendChild(H('li', { class: on ? '' : 're-out' }, H('code', {}, '{' + n + '}'), d ? ' - ' + d + ' ' : ' ',
        H('span', { class: 're-state' }, on ? T('rePhIn') : T('rePhOut'))));
    });
    return ul;
  }

  function editor(def) {
    var st = S(), edit = st.get(E.editId(def.id));
    var using = !!(edit && String(edit.text || '').trim());
    var current = E.effective(def.template, edit);
    var value = ui.drafts[def.id] !== undefined ? ui.drafts[def.id] : current;
    var id = 're-text-' + def.id;
    var det = H('details', { class: 're-box', 'data-test': 'recipe-edit' }, H('summary', {}, T('reChange')));
    if (ui.open[def.id]) det.open = true;
    det.addEventListener('toggle', function () { ui.open[def.id] = det.open; });
    det.appendChild(H('p', { class: 'muted' }, T('reIntro')));
    det.appendChild(H('p', { class: 'muted', 'data-test': 'recipe-edit-status' }, using ? T('reUsing', { when: whenText(edit.updated) }) : T('reOriginal')));
    var ta = H('textarea', { id: id, rows: '14', maxlength: String(E.MAX_TEXT), spellcheck: 'false', 'data-test': 'recipe-edit-text' });
    ta.value = value;
    var phBox = H('div', {}), warnBox = H('div', { role: 'status', 'data-test': 'recipe-edit-warnings' });
    function refresh() { clear(phBox); phBox.appendChild(placeholderList(def, ta.value)); fillWarnings(warnBox, ta.value, def); }
    ta.addEventListener('input', function () { ui.drafts[def.id] = ta.value; ui.saved[def.id] = false; refresh(); });
    det.appendChild(H('label', { for: id }, T('reTextLabel')));
    det.appendChild(ta);
    det.appendChild(H('h4', {}, T('rePhHeading')));
    det.appendChild(H('p', { class: 'muted' }, T('rePhNote')));
    det.appendChild(phBox);
    det.appendChild(warnBox);
    refresh();
    var why = H('input', { type: 'text', id: 're-why-' + def.id, maxlength: '300', 'data-test': 'recipe-edit-why' });
    why.value = ui.why[def.id] || '';
    why.addEventListener('input', function () { ui.why[def.id] = why.value; });
    det.appendChild(H('label', { for: 're-why-' + def.id }, T('reWhy')));
    det.appendChild(why);
    var row = H('div', { class: 'ai-buttons' });
    row.appendChild(H('button', { type: 'button', class: 'primary', 'data-test': 'recipe-edit-save', on: { click: function () {
      saveText(def, ta.value, why.value);
      delete ui.drafts[def.id]; delete ui.why[def.id]; ui.saved[def.id] = 'saved'; ui.open[def.id] = true;
      redraw();
    } } }, T('reSave')));
    var rb = H('button', { type: 'button', 'data-test': 'recipe-edit-reset', on: { click: function () {
      resetText(def);
      delete ui.drafts[def.id]; delete ui.why[def.id]; ui.saved[def.id] = 'reset'; ui.open[def.id] = true;
      redraw();
    } } }, T('reReset'));
    if (!using) rb.disabled = true;
    row.appendChild(rb);
    row.appendChild(H('button', { type: 'button', 'data-test': 'recipe-improve-open', on: { click: function () { Desk.ui.go('ai/improve/' + def.id); } } }, T('reImprove')));
    det.appendChild(row);
    if (ui.saved[def.id]) det.appendChild(H('p', { role: 'status', 'data-test': 'recipe-edit-saved' }, ui.saved[def.id] === 'reset' ? T('reResetDone') : T('reSaved')));
    var vers = edit && Array.isArray(edit.versions) ? edit.versions.filter(function (v) { return v.text !== current; }) : [];
    if (vers.length) {
      var vd = H('details', { class: 're-versions', 'data-test': 'recipe-edit-versions' }, H('summary', {}, T('reVersions', { n: vers.length })));
      var vl = H('ul', {});
      vers.forEach(function (v, i) {
        var first = oneLine(v.text, 80);
        vl.appendChild(H('li', {}, H('span', { class: 'muted' }, whenText(v.at) + ' '), H('span', {}, first + ' '),
          H('button', { type: 'button', 'data-test': 'recipe-edit-version-' + i, on: { click: function () {
            ui.drafts[def.id] = v.text; ui.open[def.id] = true; ui.saved[def.id] = false; redraw();
          } } }, T('reVersionUse'))));
      });
      vd.appendChild(vl);
      det.appendChild(vd);
    }
    return det;
  }

  function notesList(def) {
    var notes = E.notesFor(S().all('recipe-note'), def.id, false);
    if (!notes.length) return null;
    var box = H('section', { class: 're-notes', 'data-test': 'recipe-notes' }, H('h4', {}, T('reNotesHeading')));
    var ul = H('ul', {});
    notes.forEach(function (n) {
      var text = String(n.text || '').trim();
      ul.appendChild(H('li', { 'data-used': n.used ? '1' : '0' }, text || T('reNoteNoText'), ' ',
        H('span', { class: 'muted' }, (n.code ? 'DESK-' + n.code + ' ' : '') + (n.used ? '(' + T('reNoteUsed') + ')' : ''))));
    });
    box.appendChild(ul);
    return box;
  }

  Desk.recipes.panelExtras.push(function (def) {
    if (def.id === 'improve') {
      var d = target(Desk.route().args.slice(1));
      if (!d) return null;
      var n = E.notesToSend(S().all('recipe-note'), d.id).length;
      return H('div', { class: 're-for', 'data-test': 'improve-for' }, H('p', {}, T('imFor', { task: Desk.recipes.titleOf(d) })),
        H('p', { class: 'muted' }, n ? T('imNotes', { n: n }) : T('imNoNotes')),
        H('a', { href: '#ai/' + d.id, 'data-test': 'improve-back' }, T('imBack')));
    }
    if (def.noEdit || typeof def.template !== 'string') return null;
    var wrap = H('div', { class: 're-wrap' }, editor(def));
    var nl = notesList(def);
    if (nl) wrap.appendChild(nl);
    return wrap;
  });

  // ---- the side-by-side view, drawn under the result line of an improve answer --------------------------------------
  E.compare = function (el, def, newText, summary, noteIds, state) {
    var st = S(), box = H('div', { class: 're-compare', 'data-test': 'recipe-compare' });
    var key = 'choice';
    var mine = E.effective(def.template, st.get(E.editId(def.id)));
    var done = state[key] || null;
    box.appendChild(H('h4', {}, T('imNewTitle')));
    if (summary) box.appendChild(H('p', { 'data-test': 'recipe-compare-summary' }, T('imWhat', { what: summary })));
    var warnBox = H('div', { role: 'status', 'data-test': 'recipe-compare-warnings' });
    fillWarnings(warnBox, newText, def);
    box.appendChild(warnBox);
    if (done && done.kind === 'used') {
      var p = H('p', { role: 'status', 'data-test': 'recipe-compare-used' }, T('imUsed'));
      if (done.token !== null && st.undoToken() === done.token) {
        p.appendChild(document.createTextNode(' '));
        p.appendChild(H('button', { type: 'button', 'data-test': 'recipe-compare-undo', on: { click: function () {
          if (st.undoToken() !== done.token) return;
          st.undo(); state[key] = { kind: 'undone' }; redraw();
        } } }, T('undo')));
      }
      box.appendChild(p);
      el.appendChild(box);
      return;
    }
    if (done && done.kind === 'kept') { box.appendChild(H('p', { 'data-test': 'recipe-compare-kept' }, T('imKept'))); el.appendChild(box); return; }
    if (done && done.kind === 'undone') box.appendChild(H('p', { class: 'muted' }, T('undone')));
    var rows = E.lineDiff(mine, newText), count = E.changedCount(rows);
    if (!count) { box.appendChild(H('p', { 'data-test': 'recipe-compare-same' }, T('imSame'))); el.appendChild(box); return; }
    box.appendChild(H('p', { class: 'muted', 'data-test': 'recipe-compare-count' }, T('imChangedLines', { n: count })));
    var grid = H('div', { class: 're-diff', 'data-test': 'recipe-diff' },
      H('div', { class: 're-head' }, T('imYours')), H('div', { class: 're-head' }, T('imNew')));
    function cell(text, changed) {
      var c = H('div', { class: 're-cell' + (changed ? ' re-changed' : '') + (text === null ? ' re-empty' : '') });
      if (changed && text !== null) c.appendChild(H('span', { class: 're-sr' }, T('imChangedLine')));
      c.appendChild(document.createTextNode(text === null ? '' : (text === '' ? ' ' : text)));
      return c;
    }
    rows.forEach(function (r) { grid.appendChild(cell(r.a, r.changed)); grid.appendChild(cell(r.b, r.changed)); });
    box.appendChild(grid);
    var btns = H('div', { class: 'ai-buttons' });
    btns.appendChild(H('button', { type: 'button', class: 'primary', 'data-test': 'recipe-compare-use', on: { click: function () {
      var token = saveText(def, newText, summary, noteIds);
      state[key] = { kind: 'used', token: token };
      delete ui.drafts[def.id];
      redraw();
    } } }, T('imUse')));
    btns.appendChild(H('button', { type: 'button', 'data-test': 'recipe-compare-keep', on: { click: function () { state[key] = { kind: 'kept' }; redraw(); } } }, T('imKeep')));
    box.appendChild(btns);
    el.appendChild(box);
  };
})();
