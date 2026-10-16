// Merge two states, pure. DESIGN section 6, "Merge".
// Desk.merge(local, incoming) -> { state, report }   or   { error: "<one plain sentence>" }
// Rules: per id the newer `updated` wins; on a tie the higher state-level `device` string wins; a tombstone is
// a record like any other; `source: "example"` records are never merged in from a file; the whole record wins
// or loses (ext is not merged per key); unknown types and unknown ext keys ride along untouched.
// Never mutates its inputs, reads no clock, uses no randomness, touches no DOM.
window.Desk = window.Desk || {};
(function () {
  'use strict';

  var SCHEMA = 'searchdesk/1';
  var MSG = {
    notObject: 'This does not look like a Search Desk file, so nothing was changed.',
    noSchema: 'This file is not a Search Desk save, so nothing was changed.',
    wrongSchema: 'This file was made by a different version of Search Desk, so nothing was changed.',
    noRecords: 'This file has no records in it, so nothing was changed.',
    badLocal: 'The data on this screen could not be read, so nothing was changed.'
  };

  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function validRecord(key, r) {
    return isObj(r) && typeof r.id === 'string' && r.id === key &&
      typeof r.type === 'string' && typeof r.updated === 'string';
  }

  // negative: a is older than b
  function cmpTime(a, b) {
    var x = Date.parse(a), y = Date.parse(b);
    if (isFinite(x) && isFinite(y)) return x < y ? -1 : x > y ? 1 : 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // true when the incoming record should replace the local one
  function incomingWins(lr, ir, lDev, iDev) {
    var c = cmpTime(ir.updated, lr.updated);
    if (c !== 0) return c > 0;
    return String(iDev || '') > String(lDev || '');
  }

  function bump(report, type, what) {
    var t = report.byType[type] || (report.byType[type] = { added: 0, updated: 0, removed: 0, kept: 0, unchanged: 0 });
    t[what]++;
  }

  function merge(local, incoming) {
    if (local === null || local === undefined) local = { schema: SCHEMA, records: {} };
    if (!isObj(local) || local.schema !== SCHEMA || !isObj(local.records)) return { error: MSG.badLocal };
    if (!isObj(incoming)) return { error: MSG.notObject };
    if (typeof incoming.schema !== 'string') return { error: MSG.noSchema };
    if (incoming.schema !== SCHEMA) return { error: MSG.wrongSchema };
    if (!isObj(incoming.records)) return { error: MSG.noRecords };

    var out = clone(local);
    var report = { added: 0, updated: 0, removed: 0, kept: 0, unchanged: 0, skippedExample: 0, skippedBad: 0, byType: {} };
    var ids = Object.keys(incoming.records);

    for (var n = 0; n < ids.length; n++) {
      var id = ids[n];
      var ir = incoming.records[id];
      if (!validRecord(id, ir)) { report.skippedBad++; continue; }
      if (ir.source === 'example') { report.skippedExample++; continue; }
      var lr = own(out.records, id) ? out.records[id] : null;
      var tomb = ir.deleted === true;

      if (!lr) {
        out.records[id] = clone(ir);
        if (tomb) { report.removed++; bump(report, ir.type, 'removed'); }
        else { report.added++; bump(report, ir.type, 'added'); }
        continue;
      }
      if (JSON.stringify(lr) === JSON.stringify(ir)) { report.unchanged++; bump(report, lr.type, 'unchanged'); continue; }
      if (incomingWins(lr, ir, out.device, incoming.device)) {
        out.records[id] = clone(ir);
        if (tomb && lr.deleted !== true) { report.removed++; bump(report, ir.type, 'removed'); }
        else { report.updated++; bump(report, ir.type, 'updated'); }
      } else {
        report.kept++; bump(report, lr.type, 'kept');
      }
    }
    return { state: out, report: report };
  }

  window.Desk.merge = merge;
})();
