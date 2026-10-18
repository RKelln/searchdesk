// Export, import, share, copy as text, the made-up person, and the Data screen blocks (DESIGN 6, 4, 12).
// Pure parts come first (unit tested in tests/unit/io.test.js); the DOM part is at the bottom.
//
// Public: Desk.io = { MAX_BYTES, filename, exportObject, exportText, detectPaste, parseState, prepareIncoming,
//   reportCounts, reportSentence, hasChanges, nudge, backupNudge, importText, importState, exportNow,
//   copyText, makePasteBox, loadExample, removeExample, hasExample, exampleAvailable }
// Desk.pasteHandlers: a list of functions `fn(text) -> true | { text } | falsy`. When the shared paste box sees an
// AI answer it offers the text to each in turn; the first truthy result wins (T3.3 registers one).
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var MAX_BYTES = 5 * 1024 * 1024; // DESIGN 6: the import size cap
  var DEVICE_KEYS = ['lastExport', 'exampleLoaded', 'inboxSeen']; // settings fields that belong to this device, not to a file
  if (!Desk.version) Desk.version = 'dev'; // the build stamps the real one (T4.1)
  Desk.pasteHandlers = Desk.pasteHandlers || [];

  function T(k, v) { return Desk.t(k, v); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- Pure: export -------------------------------------------------------------------------------
  // "searchdesk-2026-10-19.json", from the date's local year, month and day.
  function filename(date) {
    var d = date instanceof Date ? date : new Date(date);
    return 'searchdesk-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  }

  // The object that goes in the file: records from the made-up person are left out (and so are their
  // tombstones), and settings keeps only what travels (not this device's lastExport / exampleLoaded).
  // Caches and the undo step are not in the state at all.
  function exportObject(state, version) {
    var out = { schema: 'searchdesk/1', app: (state && state.app) || version || '', device: (state && state.device) || '', records: {} };
    var recs = state && isObj(state.records) ? state.records : {};
    Object.keys(recs).forEach(function (id) {
      var r = recs[id];
      if (!isObj(r) || r.source === 'example') return;
      r = clone(r);
      if (r.type === 'settings') DEVICE_KEYS.forEach(function (k) { delete r[k]; });
      out.records[id] = r;
    });
    return out;
  }
  function exportText(state, version) { return JSON.stringify(exportObject(state, version), null, 2) + '\n'; }

  // ---- Pure: reading pasted text ------------------------------------------------------------------
  function stripFence(text) {
    var s = String(text === null || text === undefined ? '' : text).replace(/^﻿/, '').trim();
    var m = /^```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(s);
    return m ? m[1].trim() : s;
  }
  // Every fenced block in the text, not only one that fills it. A person who selects a whole chat message
  // copies the words around the code as well, and those words are not part of the copy.
  function fences(text) {
    var s = String(text === null || text === undefined ? '' : text).replace(/^﻿/, '');
    var re = /```[A-Za-z]*[ \t]*\r?\n([\s\S]*?)```/g, out = [], m;
    while ((m = re.exec(s)) !== null) out.push(m[1].trim());
    return out;
  }
  function tryObject(s) {
    if (s.charAt(0) !== '{') return null;
    try { var o = JSON.parse(s); return isObj(o) ? o : null; } catch (e) { return null; }
  }
  function isState(o) {
    return !!(o && typeof o.schema === 'string' && o.schema.indexOf('searchdesk/') === 0);
  }
  // The copy, wherever it is in the text: the whole thing, or the first fenced block that really is one. A
  // fenced block is only accepted when it parses and says so, so words around it cannot turn an answer into a
  // copy, and cannot turn anything else into one either.
  function stateObject(text) {
    var o = tryObject(stripFence(text));
    if (isState(o)) return o;
    var blocks = fences(text);
    for (var i = 0; i < blocks.length; i++) {
      var b = tryObject(blocks[i]);
      if (isState(b)) return b;
    }
    return null;
  }
  var ANSWER_CODE = /\bDESK-[0-9A-Z]{4}\b/i;
  var ANSWER_LINE = /^[\s>*\-•(\[#]*[LCJ]\s*-?\s*0*\d+[\])*.]*\s*[|:\-–—]/im;
  // 'state' | 'answer' | 'empty' | 'unknown'
  function detectPaste(text) {
    var s = stripFence(text);
    if (!s) return 'empty';
    if (stateObject(text)) return 'state';
    if (ANSWER_CODE.test(s) || /HOW TO ANSWER/.test(s) || ANSWER_LINE.test(s) || /"t"\s*:\s*"pick"/.test(s)) return 'answer';
    return 'unknown';
  }
  // -> the parsed state object, or null
  function parseState(text) { return stateObject(text); }

  // ---- Pure: merging and the report ---------------------------------------------------------------
  // Before merging, give the file's settings record this device's own lastExport / exampleLoaded (or none),
  // so those never change by import and importing the same file twice stays "nothing new".
  function prepareIncoming(local, incoming) {
    if (!isObj(incoming) || !isObj(incoming.records) || !isObj(incoming.records.settings)) return incoming;
    var out = clone(incoming);
    var ls = local && isObj(local.records) && isObj(local.records.settings) ? local.records.settings : null;
    DEVICE_KEYS.forEach(function (k) {
      if (ls && ls[k] !== undefined) out.records.settings[k] = ls[k]; else delete out.records.settings[k];
    });
    return out;
  }

  // Counts from Desk.merge's report, without the settings record (bookkeeping the person never sees).
  function reportCounts(report) {
    var c = { added: 0, updated: 0, removed: 0, kept: 0, skipped: 0 };
    if (!report) return c;
    var by = report.byType || {};
    Object.keys(by).forEach(function (type) {
      if (type === 'settings') return;
      c.added += by[type].added || 0; c.updated += by[type].updated || 0;
      c.removed += by[type].removed || 0; c.kept += by[type].kept || 0;
    });
    c.skipped = (report.skippedBad || 0);
    return c;
  }
  // "Added 3 · Updated 5 · Kept 12 that were newer here"; only the parts that are not zero.
  function reportSentence(c) {
    var changes = c.added + c.updated + c.removed;
    var skip = c.skipped ? T('reportSkipped', { n: c.skipped }) : '';
    if (!changes) {
      var base = T('reportNothing') + ' ' + (c.kept ? T('reportKept', { n: c.kept }) + '.' : T('reportNothingHere'));
      return skip ? base + ' ' + skip + '.' : base;
    }
    if (c.added && !c.updated && !c.removed && !c.kept && !skip) return T('reportAllBack', { n: c.added });
    var parts = [];
    if (c.added) parts.push(T('reportAdded', { n: c.added }));
    if (c.updated) parts.push(T('reportUpdated', { n: c.updated }));
    if (c.removed) parts.push(T('reportRemoved', { n: c.removed }));
    if (c.kept) parts.push(T('reportKept', { n: c.kept }));
    if (skip) parts.push(skip);
    return parts.join(' · ');
  }

  // ---- Pure: the backup nudge ---------------------------------------------------------------------
  // True when something the person made changed after the last export (the made-up person and settings
  // do not count). With no export yet, any record counts.
  function hasChanges(records, lastExport) {
    var since = lastExport ? Date.parse(lastExport) : NaN;
    var ids = Object.keys(records || {});
    for (var i = 0; i < ids.length; i++) {
      var r = records[ids[i]];
      if (!isObj(r) || r.source === 'example' || r.type === 'settings') continue;
      if (!isFinite(since)) return true;
      var u = Date.parse(r.updated);
      if (!isFinite(u) || u > since) return true;
    }
    return false;
  }
  // DESIGN 6: show when there are changes since the last export AND (7 days have passed OR 10+ records).
  // -> { show, text, days } ; days is null when there has been no export.
  function nudge(settings, recordsCount, changed, now) {
    var last = settings && settings.lastExport ? Date.parse(settings.lastExport) : NaN;
    var nowMs = now instanceof Date ? now.getTime() : Number(now);
    var days = isFinite(last) ? Math.floor((nowMs - last) / 86400000) : null;
    var when = isFinite(last) ? Desk.fmtRelative(settings.lastExport, new Date(nowMs), { past: 'ago' }) : T('never');
    var due = days === null || days >= 7 || recordsCount >= 10;
    return { show: !!changed && due, text: T('lastSaved', { when: when }), days: days };
  }

  // ---- Settings (a core singleton) ----------------------------------------------------------------
  function settings() { return Desk.store.get('settings') || { type: 'settings' }; }
  function setSettings(patch, quiet) {
    var next = Object.assign({}, settings(), patch);
    Object.keys(next).forEach(function (k) { if (next[k] === undefined) delete next[k]; });
    return quiet ? Desk.store.putQuiet(next) : Desk.store.put(next);
  }
  function userRecordCount(state) {
    var n = 0;
    Object.keys(state.records).forEach(function (id) {
      var r = state.records[id];
      if (r.deleted || r.source === 'example' || r.type === 'settings') return;
      n++;
    });
    return n;
  }
  // For Home (T2.3): the same nudge, read from the store. -> { show, text, days }
  function backupNudge() {
    var st = Desk.store.state();
    return nudge(settings(), userRecordCount(st), hasChanges(st.records, settings().lastExport), Desk.now());
  }

  // ---- Import -------------------------------------------------------------------------------------
  // Merge an already-parsed state object into the store as ONE batch (so Undo works).
  // -> { ok, text, token, counts }   (`token` is the undo token when there is something to undo, else null)
  // Records keep the `source` they have in the file: merge keeps whole records, and changing it would
  // make a second import look like a change.
  function importState(incoming) {
    var S = Desk.store, local = S.state();
    var res = Desk.merge(local, prepareIncoming(local, incoming));
    if (res.error) return { ok: false, text: res.error, token: null };
    var changed = [];
    Object.keys(res.state.records).forEach(function (id) {
      var now = res.state.records[id];
      if (!own(local.records, id) || JSON.stringify(local.records[id]) !== JSON.stringify(now)) changed.push(now);
    });
    var counts = reportCounts(res.report);
    if (changed.length) S.batch(T('labelImport'), function () { S.applyRecords(changed); });
    var worth = counts.added + counts.updated + counts.removed > 0;
    return { ok: true, text: reportSentence(counts), token: changed.length && worth ? S.undoToken() : null, counts: counts };
  }
  // Text from a file or the paste box. -> same shape as importState, plus `kind`.
  function importText(text) {
    text = String(text === null || text === undefined ? '' : text);
    if (text.length > MAX_BYTES) return { ok: false, kind: 'unknown', text: T('importTooBig'), token: null };
    var kind = detectPaste(text);
    if (kind === 'empty') return { ok: false, kind: kind, text: T('importEmpty'), token: null };
    if (kind === 'answer') {
      for (var i = 0; i < Desk.pasteHandlers.length; i++) {
        var r;
        try { r = Desk.pasteHandlers[i](text); } catch (e) { if (window.console) console.error(e); r = null; }
        if (r) return { ok: true, kind: kind, handled: true, text: isObj(r) && typeof r.text === 'string' ? r.text : '', token: null };
      }
      return { ok: false, kind: kind, text: T('importIsAnswer'), token: null };
    }
    if (kind === 'unknown') return { ok: false, kind: kind, text: T('importNotMine'), token: null };
    var obj = parseState(text);
    if (!obj) return { ok: false, kind: kind, text: T('importNotMine'), token: null };
    var out = importState(obj);
    out.kind = kind;
    return out;
  }

  // ---- The made-up person -------------------------------------------------------------------------
  // data/example.js sets window.DESK_EXAMPLE = { records: [ { type, ...fields }, ... ] } (or the array itself,
  // or a function returning either, called when the button is pressed). Ids are optional.
  function exampleList() {
    var ex = window.DESK_EXAMPLE;
    if (typeof ex === 'function') { try { ex = ex(); } catch (e) { ex = null; } }
    var list = Array.isArray(ex) ? ex : (isObj(ex) && Array.isArray(ex.records) ? ex.records : []);
    return list.filter(function (r) { return isObj(r) && typeof r.type === 'string' && r.type && r.type !== 'settings'; });
  }
  function exampleAvailable() { return exampleList().length > 0; }
  function exampleIds(state) {
    return Object.keys(state.records).filter(function (id) { return state.records[id].source === 'example' && state.records[id].type !== 'settings'; });
  }
  function hasExample() { return exampleIds(Desk.store.state()).length > 0; }
  // Adds the made-up records (source "example") as one batch. Never overwrites a record of the person's own:
  // an example with the same id is skipped, and so is the example profile when they already have one.
  // -> how many records were added
  function loadExample() {
    var S = Desk.store, list = exampleList(), n = 0;
    if (!list.length) return 0;
    S.batch(T('labelExampleAdd'), function () {
      list.forEach(function (r) {
        var rc = clone(r);
        delete rc.updated; delete rc.deleted;
        rc.source = 'example';
        var id = rc.id || (rc.type === 'profile' ? 'profile' : '');
        var cur = id ? S.get(id, { withDeleted: true }) : undefined;
        if (cur && cur.source !== 'example') return;
        if (rc.type === 'profile' && !cur) {
          var p = S.get('profile');
          if (p && p.source !== 'example') return;
        }
        S.put(rc); n++;
      });
      if (n) setSettings({ exampleLoaded: true });
    });
    return n;
  }
  // Deletes every example record outright (no tombstones) as one batch. -> how many were removed
  function removeExample() {
    var S = Desk.store, ids = exampleIds(S.state()), n = 0;
    S.batch(T('labelExampleRemove'), function () {
      n = S.purge(ids);
      if (settings().exampleLoaded) setSettings({ exampleLoaded: undefined });
    });
    return n;
  }

  // Pure: may a feature save this file? A plain name (letters, digits, dash, dot, underscore; up to 80, not
  // starting with a dot) and a text type.
  var DOWNLOAD_TYPES = ['text/calendar', 'text/plain', 'text/csv', 'application/json'];
  function downloadAllowed(name, text, type) {
    return typeof name === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$/.test(name) &&
      typeof text === 'string' && DOWNLOAD_TYPES.indexOf(type) >= 0;
  }

  Desk.io = {
    downloadAllowed: downloadAllowed,
    MAX_BYTES: MAX_BYTES, filename: filename, exportObject: exportObject, exportText: exportText,
    detectPaste: detectPaste, parseState: parseState, prepareIncoming: prepareIncoming,
    reportCounts: reportCounts, reportSentence: reportSentence, hasChanges: hasChanges, nudge: nudge,
    backupNudge: backupNudge, importState: importState, importText: importText,
    loadExample: loadExample, removeExample: removeExample, hasExample: hasExample, exampleAvailable: exampleAvailable
  };

  // ---- DOM: only when there is a page and the shell ------------------------------------------------
  if (typeof document === 'undefined' || !Desk.dataSection || !Desk.h) return;
  var H = Desk.h;
  var last = null;      // the last import line: { text, ok, token } (survives a re-render of the Data screen)
  var paintReport = null;

  function markExported() { try { setSettings({ lastExport: Desk.now().toISOString() }, true); } catch (e) { if (window.console) console.error(e); } }
  function currentText() { return exportText(Desk.store.state(), Desk.version); }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.setAttribute('href', url); // h() would drop a blob: link, so this one is made by hand
    a.setAttribute('download', name);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000); // one shot
  }
  // ctx.download: save a text file the feature made (a calendar entry, say). Safe names and text types only.
  function saveText(name, text, type) {
    if (!downloadAllowed(name, text, type)) return false;
    try { download(name, text, type); return true; } catch (e) { if (window.console) console.error(e); return false; }
  }
  function exportNow() {
    var name = filename(Desk.now());
    try { download(name, currentText()); } catch (e) { if (window.console) console.error(e); Desk.ui.toast(T('exportFailed')); return false; }
    markExported();
    Desk.ui.toast(T('exportSaved', { name: name }));
    return true;
  }
  function makeFile() {
    return new File([currentText()], filename(Desk.now()), { type: 'application/json' });
  }
  function canShareFiles() {
    try {
      return !!(typeof File === 'function' && navigator.share && navigator.canShare && navigator.canShare({ files: [makeFile()] }));
    } catch (e) { return false; }
  }
  function shareNow() {
    var file = makeFile();
    return navigator.share({ files: [file], title: file.name }).then(function () {
      markExported(); Desk.ui.toast(T('exportShared'));
    }, function (e) {
      if (e && e.name === 'AbortError') return; // the person closed the share sheet
      Desk.ui.toast(T('exportFailed'));
    });
  }

  // Clipboard with the fallbacks from DESIGN 4. -> Promise<boolean>
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { ta.setSelectionRange(0, text.length); } catch (e) {}
      var ok = false;
      try { ok = !!document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }
  Desk.io.copyText = copyText;
  Desk.io.exportNow = exportNow;
  Desk.io.saveText = saveText;

  // The shared paste box: a labelled textarea that reads what is pasted (on `paste`, and on `input` after
  // 300 ms) and a "Paste" button where the browser lets a page read the clipboard.
  // opts.onText(text) -> true when the text was used (the box is then emptied). Each distinct text is offered once.
  // opts: { label, id, onText, onClipboardError }
  function makePasteBox(opts) {
    var done = '', timer = null;
    var box = H('textarea', { id: opts.id || 'paste-box', rows: 4, 'data-test': 'paste-box', spellcheck: 'false', autocomplete: 'off' });
    function offer() {
      var text = box.value;
      if (!text.trim() || text === done) return;
      done = text;
      if (opts.onText(text)) { box.value = ''; done = ''; }
    }
    box.addEventListener('paste', function () { setTimeout(offer, 0); }); // after the browser has put the text in
    box.addEventListener('input', function () {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; offer(); }, 300);
    });
    var node = H('div', { class: 'paste-field' }, H('label', { for: box.id }, opts.label), box);
    if (navigator.clipboard && navigator.clipboard.readText) {
      node.appendChild(H('button', { type: 'button', 'data-test': 'paste-button', on: { click: function () {
        navigator.clipboard.readText().then(function (text) { box.value = text; offer(); },
          function () { if (opts.onClipboardError) opts.onClipboardError(); });
      } } }, T('pasteBtn')));
    }
    return { node: node, box: box };
  }
  Desk.io.makePasteBox = makePasteBox;

  function showResult(res) {
    last = { text: res.text, ok: res.ok, token: res.token };
    if (res.text) Desk.ui.toast(res.text, { undo: res.token !== null && res.token !== undefined });
    if (paintReport) paintReport();
  }
  function readFile(file, cb) {
    if (file.size > MAX_BYTES) { cb(null, T('importTooBig')); return; }
    var fr = new FileReader();
    fr.onload = function () { cb(String(fr.result || ''), ''); };
    fr.onerror = function () { cb(null, T('importCannotRead')); };
    fr.readAsText(file);
  }

  // ---- Data screen blocks ----------------------------------------------------------------------------
  Desk.dataSection({ id: 'save', order: 10, render: function (el) {
    el.appendChild(H('h3', {}, T('saveHeading')));
    el.appendChild(H('p', {}, T('saveIntro')));
    var row = H('div', { class: 'button-row' });
    row.appendChild(H('button', { type: 'button', class: 'primary', 'data-test': 'export', on: { click: exportNow } }, T('exportBtn')));
    if (canShareFiles()) {
      row.appendChild(H('button', { type: 'button', 'data-test': 'share', on: { click: shareNow } }, T('shareBtn')));
    }
    var hold = H('div', { class: 'copy-hold', 'data-test': 'copy-fallback' });
    hold.hidden = true;
    row.appendChild(H('button', { type: 'button', 'data-test': 'copy-text', on: { click: function () {
      var text = currentText();
      copyText(text).then(function (ok) {
        if (ok) { markExported(); Desk.ui.toast(T('copyTextDone')); return; }
        hold.textContent = '';
        var ta = H('textarea', { readonly: true, rows: 6, id: 'copy-fallback-text', 'aria-label': T('copyTextLabel') });
        ta.value = text;
        hold.appendChild(H('p', {}, T('copyTextHold')));
        hold.appendChild(ta);
        hold.hidden = false;
        ta.focus(); ta.select();
      });
    } } }, T('copyTextBtn')));
    el.appendChild(row);
    el.appendChild(hold);
    el.appendChild(H('p', { class: 'muted', 'data-test': 'last-export' }, backupNudge().text));
    el.appendChild(H('details', { class: 'file-details' }, H('summary', {}, T('fileDetailsTitle')), H('p', {}, T('fileDetailsBody'))));
  } });

  Desk.dataSection({ id: 'restore', order: 20, render: function (el) {
    el.appendChild(H('h3', {}, T('restoreHeading')));
    el.appendChild(H('p', {}, T('restoreIntro')));
    var report = H('p', { class: 'import-report', role: 'status', 'data-test': 'import-report' });
    function paint() {
      report.textContent = '';
      report.hidden = !last;
      if (!last) return;
      report.appendChild(document.createTextNode(last.text));
      if (last.token !== null && last.token !== undefined && Desk.store.undoToken() === last.token) {
        var token = last.token;
        report.appendChild(document.createTextNode(' '));
        report.appendChild(H('button', { type: 'button', 'data-test': 'import-undo', on: { click: function () {
          if (Desk.store.undoToken() !== token) return;
          Desk.store.undo();
          last = { text: T('undone'), ok: true, token: null };
          paint();
        } } }, T('undo')));
      }
    }
    paintReport = paint;
    var fileId = 'import-file';
    var input = H('input', { type: 'file', id: fileId, accept: '.json,application/json,text/plain', 'data-test': 'import-file', on: { change: function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      readFile(f, function (text, err) {
        showResult(err ? { ok: false, text: err, token: null } : importText(text));
        try { input.value = ''; } catch (x) {}
      });
    } } });
    el.appendChild(H('div', { class: 'file-field' }, H('label', { for: fileId }, T('importFileLabel')), input));
    var pb = makePasteBox({
      label: T('pasteLabel'),
      onText: function (text) { var res = importText(text); showResult(res); return res.ok; },
      onClipboardError: function () { showResult({ ok: false, text: T('pasteDenied'), token: null }); }
    });
    el.appendChild(pb.node);
    el.appendChild(report);
    paint();
  } });

  Desk.dataSection({ id: 'example', order: 30, render: function (el) {
    var have = hasExample();
    if (!have && !exampleAvailable()) return;
    el.appendChild(H('h3', {}, T('exampleHeading')));
    if (have) {
      el.appendChild(H('p', {}, T('exampleOn')));
      el.appendChild(H('button', { type: 'button', 'data-test': 'example-remove', on: { click: function () {
        removeExample(); Desk.ui.toast(T('exampleRemoved'), { undo: true });
      } } }, T('exampleRemove')));
    } else {
      el.appendChild(H('p', {}, T('exampleIntro')));
      el.appendChild(H('button', { type: 'button', 'data-test': 'example-try', on: { click: function () {
        if (loadExample()) Desk.ui.toast(T('exampleAdded'), { undo: true });
      } } }, T('exampleTry')));
    }
  } });

  Desk.dataSection({ id: 'storage', order: 40, render: function (el) {
    el.appendChild(H('h3', {}, T('storageHeading')));
    var mode = Desk.persist ? Desk.persist.status() : 'memory';
    var text = mode === 'memory' ? Desk.persist.message() || T('notSaving') : (function (n) { return n === 1 ? T('storageOkOne') : T('storageOk', { n: n }); })(userRecordCount(Desk.store.state()));
    el.appendChild(H('p', { 'data-test': 'storage-status', 'data-status': mode }, text));
    el.appendChild(H('p', { class: 'muted', 'data-test': 'app-version' }, T('versionLine', { v: Desk.version })));
  } });
})();
