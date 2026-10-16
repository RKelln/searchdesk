// Records, batch, undo, subscribe. State shape: DESIGN 6. Scoped stores (ctx.store): DESIGN 7.2, 7.5.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var SCHEMA = 'searchdesk/1';
  var ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32, lowercase
  var UNDO_DEPTH = 1; // DESIGN 6 Undo: only the last batch
  var SOURCES = ['user', 'ai', 'example', 'feed', 'import'];
  var SINGLETONS = ['profile', 'settings'];

  var cfg = { now: null, random: null, app: '' };
  var state = null;
  var undoStack = [];
  var subs = [];
  var droppedCount = 0;
  var tokenSeq = 0; // each undo step gets its own number
  var open = null; // the batch in progress: { label, before: {id: record|null}, ids: {}, quiet }
  var quiet = false; // true while putQuiet runs: the write is saved and announced but is not an undo step

  function clone(x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)); }
  function nowMs() { return cfg.now ? cfg.now() : Date.now(); }
  function randBytes(n) {
    if (cfg.random) return cfg.random(n);
    var a = new Uint8Array(n);
    window.crypto.getRandomValues(a);
    return a;
  }
  function b32(n) {
    var b = randBytes(n), s = '';
    for (var i = 0; i < n; i++) s += ALPHABET.charAt(b[i] & 31);
    return s;
  }
  function prefix(type) { // job -> j, event-mark -> em
    var p = String(type).split('-').map(function (w) { return w.charAt(0); }).join('');
    return p || 'x';
  }
  function fresh() {
    return { schema: SCHEMA, app: cfg.app, device: b32(6), records: {} };
  }
  function ensure() { if (!state) state = fresh(); return state; }
  function fail(msg) { throw new Error(msg); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function goodId(id) { return typeof id === 'string' && id !== '' && id !== '__proto__'; }
  function checkId(id) { if (!goodId(id)) fail('That is not a usable record id.'); }
  function rec(id) { // own-property lookup only
    return goodId(id) && Object.prototype.hasOwnProperty.call(state.records, id) ? state.records[id] : undefined;
  }
  function validRecord(id, r) { return isObj(r) && typeof r.id === 'string' && r.id === id && typeof r.type === 'string' && r.type !== ''; }
  function fingerprint(ids) {
    var a = {};
    ids.forEach(function (id) { var r = rec(id); a[id] = r ? String(r.updated) : null; });
    return a;
  }

  // ---- change tracking -------------------------------------------------
  function touch(id) { // remember the record as it was, once per batch
    if (!open.ids[id]) {
      open.ids[id] = true;
      var cur = rec(id);
      open.before[id] = cur ? clone(cur) : null;
    }
  }
  function notify(label, ids) {
    subs.slice().forEach(function (fn) {
      try { fn({ label: label, ids: ids }); } catch (e) { if (window.console) console.error(e); }
    });
  }
  function batch(label, fn) {
    if (typeof label === 'function') { fn = label; label = ''; }
    ensure();
    if (open) return fn(); // nested: joins the outer step
    open = { label: label || '', before: {}, ids: {}, quiet: quiet };
    var mine = open, result;
    try { result = fn(); }
    catch (e) { // roll back everything this batch did
      Object.keys(mine.before).forEach(function (id) { restore(id, mine.before[id]); });
      open = null;
      throw e;
    }
    open = null;
    var ids = Object.keys(mine.before);
    if (ids.length) {
      if (!mine.quiet) {
        undoStack.push({ label: mine.label, before: mine.before, after: fingerprint(ids), at: nowMs(), tok: ++tokenSeq });
        if (undoStack.length > UNDO_DEPTH) undoStack.shift();
      }
      notify(mine.label, ids);
    }
    return result;
  }
  function restore(id, r) {
    if (!goodId(id)) return;
    if (r === null) delete state.records[id]; else state.records[id] = clone(r);
  }
  function undo() {
    ensure();
    var step = undoStack.pop();
    if (!step) return false;
    Object.keys(step.before).forEach(function (id) { restore(id, step.before[id]); });
    notify('undo', Object.keys(step.before));
    return step.label || true;
  }

  // ---- reads -----------------------------------------------------------
  function all(type, opts) {
    ensure();
    if (type && typeof type === 'object') { opts = type; type = null; }
    var withDeleted = !!(opts && opts.withDeleted), out = [];
    Object.keys(state.records).forEach(function (id) {
      var r = state.records[id];
      if (type && r.type !== type) return;
      if (r.deleted && !withDeleted) return;
      out.push(clone(r));
    });
    return out;
  }
  function get(id, opts) {
    ensure();
    var r = rec(id);
    if (!r || (r.deleted && !(opts && opts.withDeleted))) return undefined;
    return clone(r);
  }

  // ---- writes (core level; `owns` is null for core, or a function) ----
  function stamp(rec) {
    rec.updated = new Date(nowMs()).toISOString();
  }
  function put(record, scope) {
    ensure();
    if (!record || typeof record !== 'object' || !record.type) fail('A record needs a type before it can be saved.');
    var type = record.type;
    if (scope && scope.owned.indexOf(type) < 0) fail('"' + scope.id + '" may not change "' + type + '" records. Those belong to another part of the app.');
    var rc = clone(record);
    if (rc.id !== undefined && rc.id !== null && rc.id !== '') checkId(rc.id);
    if (!rc.id) {
      if (SINGLETONS.indexOf(type) >= 0) rc.id = type;
      else do { rc.id = prefix(type) + '_' + b32(10); } while (rec(rc.id) || SINGLETONS.indexOf(rc.id) >= 0);
    }
    if (SINGLETONS.indexOf(rc.id) >= 0 && rc.id !== type) fail('That id is kept for the "' + rc.id + '" record.');
    var existing = rec(rc.id);
    if (existing && existing.type !== type) fail('That id is already used by a "' + existing.type + '" record.');
    if (!rc.source || SOURCES.indexOf(rc.source) < 0) rc.source = (existing && existing.source) || 'user';
    if (existing && existing.ext) { // keep other features' fields
      var ext = clone(existing.ext);
      if (scope) { if (rc.ext && rc.ext[scope.id] !== undefined) ext[scope.id] = rc.ext[scope.id]; rc.ext = ext; }
      else if (rc.ext === undefined) rc.ext = ext;
    } else if (scope) {
      var own = rc.ext && rc.ext[scope.id];
      if (own !== undefined) rc.ext = (function (o) { o[scope.id] = own; return o; })({}); else delete rc.ext;
    }
    delete rc.deleted; // saving a record revives it
    if (!existing && !rc.created) rc.created = new Date(nowMs()).toISOString();
    else if (existing && existing.created && !rc.created) rc.created = existing.created;
    stamp(rc);
    var out;
    batch('Save', function () { touch(rc.id); state.records[rc.id] = rc; out = clone(rc); });
    return out;
  }
  function remove(id, scope) {
    ensure();
    checkId(id);
    var cur = rec(id);
    if (!cur) return false;
    if (scope && scope.owned.indexOf(cur.type) < 0) fail('"' + scope.id + '" may not remove "' + cur.type + '" records. Those belong to another part of the app.');
    if (cur.deleted) return false;
    batch('Remove', function () {
      touch(id);
      var t = { id: cur.id, type: cur.type, source: cur.source, deleted: true };
      if (cur.created) t.created = cur.created;
      if (cur.ext) t.ext = cur.ext; // unknown ext survives
      stamp(t);
      state.records[id] = t;
    });
    return true;
  }
  function ext(id, patch, featureId, scope) {
    ensure();
    var key = scope ? scope.id : featureId;
    if (!key) fail('Say which feature the extra fields belong to.');
    if (scope && featureId && featureId !== scope.id) fail('"' + scope.id + '" may only change its own extra fields.');
    checkId(id);
    var cur = rec(id);
    if (!cur || cur.deleted) fail('There is no such record to add fields to.');
    patch = clone(isObj(patch) ? patch : {});
    var out;
    batch('Update', function () {
      touch(id);
      var nr = clone(cur);
      if (!isObj(nr.ext)) nr.ext = {};
      var merged = isObj(nr.ext[key]) ? nr.ext[key] : {};
      Object.keys(patch).forEach(function (k) { if (k !== '__proto__') merged[k] = patch[k]; });
      nr.ext[key] = merged;
      stamp(nr);
      state.records[id] = nr;
      out = clone(nr);
    });
    return out;
  }

  // ---- core-only writes (io.js: import, example data). Never on scoped stores. -------------------
  // Writes records exactly as given (their own `updated`, `source`, `deleted`), so a merge stays idempotent.
  // No ownership checks. Joins the batch in progress, or makes one of its own. Returns how many were written.
  function applyRecords(list) {
    ensure();
    if (!Array.isArray(list)) fail('applyRecords needs a list of records.');
    var n = 0;
    batch('Apply', function () {
      list.forEach(function (r) {
        if (!isObj(r) || !goodId(r.id) || !validRecord(r.id, r)) return;
        if (SINGLETONS.indexOf(r.id) >= 0 && r.type !== r.id) return;
        if (SINGLETONS.indexOf(r.type) >= 0 && r.id !== r.type) return;
        touch(r.id);
        state.records[r.id] = clone(r);
        n++;
      });
    });
    return n;
  }
  // Hard delete: no tombstone is left. Undoable as part of its batch. Returns how many were removed.
  function purge(ids) {
    ensure();
    if (!Array.isArray(ids)) fail('purge needs a list of ids.');
    var n = 0;
    batch('Remove', function () {
      ids.forEach(function (id) {
        if (!goodId(id) || !rec(id)) return;
        touch(id);
        delete state.records[id];
        n++;
      });
    });
    return n;
  }
  // Like put, but not an undo step: for bookkeeping the person did not ask for (settings.lastExport).
  function putQuiet(record) {
    var was = quiet;
    quiet = true;
    try { return put(record, null); } finally { quiet = was; }
  }

  // ---- public ----------------------------------------------------------
  var store = {
    SCHEMA: SCHEMA,
    // init({ now: () => ms, random: n => bytes, app, device }) resets the store (tests and boot)
    init: function (o) {
      o = o || {};
      cfg.now = o.now || null; cfg.random = o.random || null; cfg.app = o.app || '';
      state = fresh();
      if (o.device) state.device = o.device;
      undoStack = []; open = null;
    },
    all: all, get: get,
    put: function (r) { return put(r, null); },
    remove: function (id) { return remove(id, null); },
    ext: function (id, patch, featureId) { return ext(id, patch, featureId, null); },
    batch: batch, undo: undo,
    applyRecords: applyRecords, purge: purge, putQuiet: putQuiet, // core only
    // A number naming the step undo() would undo now, or null. A new batch gives a new number.
    undoToken: function () { return undoStack.length ? undoStack[undoStack.length - 1].tok : null; },
    canUndo: function () { return undoStack.length > 0; },
    undoLabel: function () { return undoStack.length ? undoStack[undoStack.length - 1].label : null; },
    subscribe: function (fn) {
      subs.push(fn);
      return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
    // ctx.store for a feature: reads anything, writes only ownedTypes (and its own ext)
    scoped: function (featureId, ownedTypes) {
      var scope = { id: featureId, owned: (ownedTypes || []).slice() };
      return {
        all: all, get: get, batch: batch, subscribe: store.subscribe,
        put: function (r) { return put(r, scope); },
        remove: function (id) { return remove(id, scope); },
        ext: function (id, patch) { return ext(id, patch, null, scope); },
        undo: function () { fail('Undo is handled by the app, not by a feature.'); }
      };
    },
    // whole-state access, for persist, merge and io (core only)
    state: function () { ensure(); return clone(state); },
    // load(stateObject) replaces everything; clears undo. Returns '' or a sentence saying why not.
    load: function (s) {
      if (!s || typeof s !== 'object' || s.schema !== SCHEMA) return 'This is not a Search Desk file.';
      if (!isObj(s.records)) return 'This Search Desk file has no records.';
      var recs = {}, bad = 0, src = clone(s.records);
      Object.keys(src).forEach(function (id) {
        if (goodId(id) && validRecord(id, src[id])) recs[id] = src[id]; else bad++;
      });
      droppedCount = bad;
      state = { schema: SCHEMA, app: s.app || cfg.app, device: s.device || b32(6), records: recs };
      Object.keys(s).forEach(function (k) { if (!(k in state)) state[k] = clone(s[k]); });
      undoStack = [];
      notify('load', Object.keys(state.records));
      return '';
    },
    // the most recent undo step, for persist to keep as searchdesk1:undo
    dropped: function () { return droppedCount; }, // records skipped by the last load()
    lastStep: function () { return undoStack.length ? clone(undoStack[undoStack.length - 1]) : null; },
    restoreStep: function (step) {
      // Only accepted if well formed and the records still look the way the step left them.
      ensure();
      if (!isObj(step) || !isObj(step.before) || !isObj(step.after)) return false;
      var ids = Object.keys(step.before);
      if (!ids.length) return false;
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i], b = step.before[id];
        if (!goodId(id) || !(b === null || validRecord(id, b))) return false;
        var want = step.after[id], r = rec(id);
        if (want === undefined || (r ? String(r.updated) : null) !== want) return false;
      }
      undoStack = [clone({ label: typeof step.label === 'string' ? step.label : '', before: step.before, after: step.after, at: step.at, tok: ++tokenSeq })];
      return true;
    }
  };
  window.Desk.store = store;
})();
