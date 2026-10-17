// Mode A inbox (DESIGN 10). An agent with file access writes data/inbox.js:
//   window.DESK_INBOX = { schema: 'searchdesk/1', records: [ { id, type, updated, ...fields }, ... ] }
// `records` is a list of whole records. The page checks them, merges them with Desk.merge as ONE batch, and shows
// "Brought in 5 changes from your helper" with Undo.
// Pure parts (Desk.inbox.check, fingerprint, sentence) never touch the DOM. load() and run() do.
// - Ties: if the page's record and the inbox's record have the same `updated`, the page's record stays. That is not a rule
//   of its own: `Desk.merge` (core/merge.js) breaks a tie on the state-level `device` string, and the incoming state built
//   here has none, so "" never beats the page's device id. Do not give the incoming state a `device`: an inbox file that
//   wins ties would quietly overwrite a record the person changed more recently.
// - Every record is stored with source "ai". `settings`, tombstones and records the page does not know are left out.
// - Texts that look like HTML are left out, so nothing from a file is ever run as markup.
// - Idempotent twice over: merging the same records again changes nothing (the records are stored exactly as
//   checked), and the page remembers a fingerprint of the file it last used (settings.inboxSeen, device-local),
//   so a reload does not bring back what Undo took away and does not toast again.
// - Only the source copy reads the file. A built single file has no data/inbox.js, so it skips all of this.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var SCHEMA = 'searchdesk/1';
  var CORE_TYPES = ['profile'];
  var DAY = 86400000;
  var MAX_RECORDS = 500;
  var HTMLISH = /<\s*[\/!a-z?]|javascript\s*:/i;
  var PROFILE_NO = ['name', 'email', 'phone', 'fullname', 'full-name', 'telephone', 'mobile'];

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // True when every value inside is plain data with no markup-looking text.
  function cleanValue(v, depth) {
    if (v === null || v === undefined || typeof v === 'boolean') return true;
    if (typeof v === 'number') return isFinite(v);
    if (typeof v === 'string') return !HTMLISH.test(v);
    if (depth > 4) return false;
    if (Array.isArray(v)) return v.every(function (x) { return cleanValue(x, depth + 1); });
    if (isObj(v)) {
      return Object.keys(v).every(function (k) { return k !== '__proto__' && !HTMLISH.test(k) && cleanValue(v[k], depth + 1); });
    }
    return false;
  }

  // Why one record cannot be used, or '' when it can. `now` is a number (ms).
  function problem(r, types, now) {
    if (!isObj(r)) return 'shape';
    if (typeof r.id !== 'string' || !r.id || r.id === '__proto__' || HTMLISH.test(r.id)) return 'id';
    if (typeof r.type !== 'string' || types.indexOf(r.type) < 0 || r.type === 'settings') return 'type';
    var t = typeof r.updated === 'string' ? Date.parse(r.updated) : NaN;
    if (!isFinite(t) || t > now + DAY) return 'updated';
    if (r.deleted !== undefined) return 'deleted';
    if (r.type === 'profile') {
      if (r.id !== 'profile') return 'id';
      for (var i = 0; i < PROFILE_NO.length; i++) if (Object.prototype.hasOwnProperty.call(r, PROFILE_NO[i])) return 'profile';
    }
    if (!cleanValue(r, 0)) return 'html';
    return '';
  }

  // check(raw, types, nowMs) -> { error: 'schema'|'records'|'shape'|'' , incoming, skipped, count }
  // `incoming` is a state-like object for Desk.merge ({ schema, records: map }). Bad records are counted in `skipped`.
  function check(raw, types, nowMs) {
    var out = { error: '', incoming: null, skipped: 0, count: 0 };
    if (!isObj(raw)) { out.error = 'shape'; return out; }
    if (raw.schema !== SCHEMA) { out.error = 'schema'; return out; }
    if (!Array.isArray(raw.records)) { out.error = 'records'; return out; }
    var known = CORE_TYPES.concat(types || []);
    var map = {}, list = raw.records.slice(0, MAX_RECORDS);
    out.skipped = raw.records.length - list.length;
    list.forEach(function (r) {
      if (problem(r, known, nowMs)) { out.skipped++; return; }
      var rc = clone(r);
      rc.source = 'ai';
      if (Object.prototype.hasOwnProperty.call(map, rc.id)) out.skipped++; // a repeated id: the later one is used
      map[rc.id] = rc;
    });
    out.count = Object.keys(map).length;
    out.incoming = { schema: SCHEMA, records: map };
    return out;
  }

  // A short stable text for "have I used this file before" (djb2 over the JSON; not a security hash).
  function fingerprint(raw) {
    var s;
    try { s = JSON.stringify(raw); } catch (e) { s = ''; }
    if (typeof s !== 'string') return '';
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'i' + h.toString(36) + '-' + s.length;
  }

  // The toast line. c = { changes, kept, skipped, error }. Uses the string table through `t`.
  function sentence(c, t) {
    if (c.error) return t('inboxBad');
    var parts = [];
    if (c.changes) parts.push(t(c.changes === 1 ? 'inboxBroughtOne' : 'inboxBrought', { n: c.changes }));
    if (c.kept) parts.push(t(c.kept === 1 ? 'inboxKeptOne' : 'inboxKept', { n: c.kept }));
    if (c.skipped) parts.push(t(c.skipped === 1 ? 'inboxLeftOutOne' : 'inboxLeftOut', { n: c.skipped }));
    return parts.join(' ');
  }

  // ---- the page side ----------------------------------------------------------------------------
  function isSourceCopy() {
    return typeof document !== 'undefined' && !!document.querySelector('script[src$="core/desk.js"]');
  }

  // Injects data/inbox.js like a feature file (a missing file is fine and silent), then calls done().
  function load(done) {
    var finished = false, guard = null;
    function finish() { if (finished) return; finished = true; if (guard !== null) clearTimeout(guard); done(); }
    if (!isSourceCopy()) { finish(); return; }
    var s = document.createElement('script');
    s.async = false;
    s.setAttribute('data-inbox', 'data/inbox.js');
    s.onload = finish;
    s.onerror = finish;
    s.src = 'data/inbox.js';
    document.head.appendChild(s);
    guard = setTimeout(finish, 5000); // a script that never answers must not hold the app
  }

  function knownTypes() {
    var out = [];
    (Desk.featureDefs ? Desk.featureDefs() : []).forEach(function (d) {
      if (d && Array.isArray(d.types)) d.types.forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    });
    return out;
  }

  // Merges the inbox as one batch and says so. Runs from Desk.start after the saved data is loaded.
  // -> { ran, changes, kept, skipped, error, text, token }
  // For unit tests (no page): `opts.sourceCopy: true` skips the source-copy check and `opts.raw` stands in for window.DESK_INBOX.
  function run(opts) {
    var res = { ran: false, changes: 0, kept: 0, skipped: 0, error: '', text: '', token: null };
    var raw = opts && Object.prototype.hasOwnProperty.call(opts, 'raw') ? opts.raw : window.DESK_INBOX;
    if (!(opts && opts.sourceCopy === true) && !isSourceCopy() || raw === undefined || raw === null) return res;
    var S = Desk.store, T = Desk.t;
    var print = fingerprint(raw);
    var settings = S.get('settings') || { type: 'settings' };
    if (settings.inboxSeen === print) return res; // already used (or undone on purpose)
    res.ran = true;
    var c = check(raw, knownTypes(), Desk.now().getTime());
    res.skipped = c.skipped;
    if (c.error) {
      res.error = c.error;
    } else {
      var local = S.state();
      var m = Desk.merge(local, c.incoming);
      if (m.error) { res.error = 'merge'; }
      else {
        res.changes = m.report.added + m.report.updated;
        res.kept = m.report.kept;
        var changed = [];
        Object.keys(m.state.records).forEach(function (id) {
          if (!Object.prototype.hasOwnProperty.call(local.records, id) ||
              JSON.stringify(local.records[id]) !== JSON.stringify(m.state.records[id])) changed.push(m.state.records[id]);
        });
        if (changed.length) S.batch(T('labelInbox'), function () { S.applyRecords(changed); });
        if (changed.length) res.token = S.undoToken();
      }
    }
    var next = Object.assign({}, settings, { inboxSeen: print });
    S.putQuiet(next); // not an undo step, so the batch above stays the one Undo takes
    res.text = sentence(res, T);
    if (res.text && Desk.ui) Desk.ui.toast(res.text, res.token !== null ? { undo: true } : undefined);
    return res;
  }

  Desk.inbox = { check: check, fingerprint: fingerprint, sentence: sentence, load: load, run: run, isSourceCopy: isSourceCopy };
})();
