// The contract scan and the check API, shared by checks/run.js (no page) and the self-test (in the page).
// Pure: no DOM, no clock. DESIGN 7.5 rule 3 and 7.6.
//   Desk.contract.banned          the banned words, one list for everyone
//   Desk.contract.scan(source)    -> [{ word, line }]   (comments are removed first; see strip())
//   Desk.contract.scanFeature(def)-> [{ word, line, where }]  over every function in the feature (mount, logic.*, ...)
//   Desk.check(id, fn)            a check file registers fn(t, feature); Desk.checks[id] holds it
//   Desk.contract.runCheck(fn, feature) -> { pass, fail, results: [{ ok, msg }] }
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;

  // word: what is shown. re: how it is found. A whole identifier must match, so `evaluate` is not `eval`
  // and `prefetch` is not `fetch`; `x.fetch(` is still caught. Spaces and dots may have extra spaces around them.
  var BEFORE = '(^|[^A-Za-z0-9_$])';
  var AFTER = '(?![A-Za-z0-9_$])';
  function w(word) {
    var core = word.replace(/\./g, '\\s*\\.\\s*').replace(/ /g, '\\s+');
    return { word: word, re: BEFORE + core + AFTER };
  }
  var BANNED = [
    w('innerHTML'), w('outerHTML'), w('insertAdjacentHTML'), w('document.write'), w('eval'),
    w('new Function'), w('fetch'), w('XMLHttpRequest'),
    { word: 'import(', re: '(^|[^A-Za-z0-9_$.])import\\s*\\(' }, // a dynamic import, not `x.import(`
    w('localStorage'), w('setInterval')
  ];

  // Remove comments (keeping line breaks so line numbers stay right). Quoted text stays, so a banned word in a
  // string still counts; building a word from pieces (window['ev'+'al']) is not caught, since this is a safety
  // net, not a wall. A small state machine that knows ', ", ` strings and, roughly, regular expression literals.
  function strip(src) {
    var out = '', i = 0, n = src.length, last = ''; // last: last significant character, to tell / from a regex
    while (i < n) {
      var c = src.charAt(i), d = src.charAt(i + 1);
      if (c === '/' && d === '/') { while (i < n && src.charAt(i) !== '\n') i++; continue; }
      if (c === '/' && d === '*') {
        i += 2;
        while (i < n && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) { if (src.charAt(i) === '\n') out += '\n'; i++; }
        i += 2; out += ' '; continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        var q = c; out += c; i++;
        while (i < n && src.charAt(i) !== q) {
          if (src.charAt(i) === '\\') out += src.charAt(i++);
          if (q !== '`' && src.charAt(i) === '\n') break;
          out += src.charAt(i++);
        }
        out += q; i++; last = q; continue;
      }
      if (c === '/' && (last === '' || '(,=:[!&|?{};+-*%<>~^'.indexOf(last) >= 0)) {
        out += c; i++;
        var cls = false;
        while (i < n && src.charAt(i) !== '\n' && (cls || src.charAt(i) !== '/')) {
          var e = src.charAt(i);
          if (e === '\\') { out += e; i++; e = src.charAt(i); }
          else if (e === '[') cls = true;
          else if (e === ']') cls = false;
          out += e; i++;
        }
        out += '/'; i++; last = '/'; continue;
      }
      out += c; i++;
      if (!/\s/.test(c)) last = c;
    }
    return out;
  }

  function scan(source) {
    var s = strip(String(source)), found = [];
    BANNED.forEach(function (b) {
      var re = new RegExp(b.re, 'g'), m;
      while ((m = re.exec(s))) {
        var at = m.index + m[1].length;
        found.push({ word: b.word, line: s.slice(0, at).split('\n').length });
        re.lastIndex = Math.max(re.lastIndex, m.index + 1);
      }
    });
    return found.sort(function (a, b2) { return a.line - b2.line; });
  }

  function scanFeature(def) {
    var out = [];
    function one(where, fn) {
      if (typeof fn !== 'function') return;
      scan(fn).forEach(function (f) { out.push({ word: f.word, line: f.line, where: where }); });
    }
    if (!def || typeof def !== 'object') return out;
    Object.keys(def).forEach(function (k) { if (k !== 'logic') one(k, def[k]); });
    if (def.logic && typeof def.logic === 'object') {
      Object.keys(def.logic).forEach(function (k) { one('logic.' + k, def.logic[k]); });
    }
    return out;
  }

  function same(a, b) { // deep equality for plain data
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return a !== a && b !== b;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) {
      return Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]);
    });
  }
  function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }

  function runCheck(fn, feature) {
    var r = { pass: 0, fail: 0, results: [] };
    function add(ok, msg) { r[ok ? 'pass' : 'fail']++; r.results.push({ ok: ok, msg: msg }); }
    var t = {
      ok: function (cond, msg) { add(!!cond, String(msg)); },
      eq: function (actual, expected, msg) {
        if (same(actual, expected)) add(true, String(msg));
        else add(false, msg + ' (got ' + show(actual) + ', wanted ' + show(expected) + ')');
      }
    };
    try { fn(t, feature); }
    catch (e) { add(false, 'the check stopped with an error: ' + (e && e.message)); }
    return r;
  }

  Desk.checks = Desk.checks || {};
  // One check per feature id; a second Desk.check for the same id replaces the first.
  Desk.check = function (id, fn) {
    if (typeof id !== 'string' || typeof fn !== 'function') throw new Error('Desk.check needs an id and a function.');
    Desk.checks[id] = fn;
  };

  Desk.contract = {
    banned: BANNED.map(function (b) { return b.word; }),
    scan: scan, scanFeature: scanFeature, strip: strip, runCheck: runCheck, same: same
  };
})();
