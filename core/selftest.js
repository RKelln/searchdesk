// The #selftest screen (T1.6, DESIGN 7.6 and 7.7). For the app itself and for every loaded feature it shows
// pass / fail / no check file, plus the contract scan (core/contract.js) over the feature's functions.
// Check files are loaded at runtime from checks/<id>.check.js; a missing file is shown as "No check file", not red.
// Rows carry data-test="selftest-row-<id>" and data-status="pass|fail|none|missing"; the summary is
// data-test="selftest-summary" with data-status="pass|fail".
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  function H() { return Desk.h.apply(null, arguments); }
  function T(k, v) { return Desk.t(k, v); }

  // ---- The app's own checks (pure; nothing here touches the person's data) ----
  var CORE_CHECKS = [
    function (t) {
      var a = H('a', { href: 'javascript:alert(1)' }, 'x');
      t.ok(a.getAttribute('href') === null, 'h() drops a javascript: link');
      var b = H('a', { href: 'https://example.org/' }, 'x');
      t.eq(b.getAttribute('href'), 'https://example.org/', 'h() keeps a normal https link');
    },
    function (t) {
      var p = H('p', {}, '<b>bold</b>');
      t.eq(p.children.length, 0, 'h() shows markup as plain text');
      t.eq(p.textContent, '<b>bold</b>', 'the text is kept as it was');
    },
    function (t) {
      t.eq(Desk.t('noSuchKeyAtAll'), 'noSuchKeyAtAll', 't() shows the key when a string is missing');
      t.ok(typeof Desk.t('selftestHeading') === 'string' && Desk.t('selftestHeading') !== 'selftestHeading', 't() finds a real string');
    },
    function (t) {
      var rec = function (id, u, title) { return { id: id, type: 'job', updated: u, source: 'user', title: title }; };
      var a = { schema: 'searchdesk/1', app: 'x', device: 'd1', records: { j_1: rec('j_1', '2026-10-16T10:00:00Z', 'old') } };
      var b = { schema: 'searchdesk/1', app: 'x', device: 'd2', records: { j_1: rec('j_1', '2026-10-16T11:00:00Z', 'new'), j_2: rec('j_2', '2026-10-16T09:00:00Z', 'two') } };
      var once = Desk.merge(a, b);
      t.ok(once.state && once.state.records.j_1.title === 'new', 'merge keeps the newer record');
      var twice = Desk.merge(once.state, b);
      t.eq(twice.state, once.state, 'merging the same thing twice changes nothing');
      t.eq(a.records.j_1.title, 'old', 'merge does not change what it was given');
    },
    function (t) {
      var c = Desk.contract;
      t.eq(c.scan('el.innerHTML = 1').map(function (f) { return f.word; }), ['innerHTML'], 'the scan finds innerHTML');
      t.eq(c.scan('evaluate(1); prefetch(2); // eval').length, 0, 'the scan ignores similar words and comments');
      t.ok(Desk.shellUtil.validId('my-notes') && !Desk.shellUtil.validId('My_Notes'), 'feature ids are a-z and hyphens');
    }
  ];

  // ---- Loading check files ----
  // cb(status) with 'loaded' (Desk.checks[id] is set), 'nofile' (404 or blocked), or 'empty' (loaded, no Desk.check).
  function loadCheckFile(id, cb) {
    delete Desk.checks[id];
    var s = document.createElement('script');
    var done = false;
    function finish(status) {
      if (done) return;
      done = true;
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(status);
    }
    s.onload = function () { finish(typeof Desk.checks[id] === 'function' ? 'loaded' : 'empty'); };
    s.onerror = function () { finish('nofile'); };
    s.src = 'checks/' + id + '.check.js';
    document.head.appendChild(s);
  }

  // ---- Working out one row (pure over its inputs, so easy to test) ----
  // Returns { id, name, status, pass, fail, lines: [{ ok, msg }], notes: [string] }
  function featureRow(def, fileStatus) {
    var row = { id: def.id, name: def.name || def.id, status: 'pass', pass: 0, fail: 0, lines: [], notes: [] };
    if (fileStatus === 'loaded') {
      var res = Desk.contract.runCheck(Desk.checks[def.id], def);
      row.pass += res.pass; row.fail += res.fail; row.lines = res.results;
    } else if (fileStatus === 'empty') {
      row.fail++; row.notes.push(T('selftestNoCheckRegistered'));
    } else {
      row.notes.push(T('selftestNoCheckFile'));
    }
    var found = Desk.contract.scanFeature(def);
    found.forEach(function (f) {
      row.fail++;
      var msg = T('selftestBanned', { word: f.word, where: f.where, line: f.line });
      row.lines.push({ ok: false, msg: msg });
    });
    if (!found.length) row.pass++;
    if (row.fail) row.status = 'fail';
    else if (fileStatus === 'nofile') row.status = 'none';
    return row;
  }

  function renderRow(row) {
    var label = { pass: 'selftestPass', fail: 'selftestFail', none: 'selftestNone', missing: 'selftestMissing' }[row.status];
    var li = H('li', { class: 'st-row', 'data-test': 'selftest-row-' + row.id, 'data-status': row.status },
      H('strong', {}, row.name), ' ',
      H('span', { class: 'st-badge', 'data-test': 'selftest-badge-' + row.id }, T(label)));
    var total = row.pass + row.fail;
    if (total) li.appendChild(H('span', { class: 'muted' }, T('selftestChecksCount', { pass: row.pass, total: total })));
    row.notes.forEach(function (n) { li.appendChild(H('p', { class: 'muted' }, n)); });
    var bad = row.lines.filter(function (l) { return !l.ok; });
    if (bad.length) {
      li.appendChild(H('ul', { class: 'st-problems', 'data-test': 'selftest-problems-' + row.id },
        bad.map(function (l) { return H('li', {}, l.msg); })));
    }
    var good = row.lines.filter(function (l) { return l.ok; });
    if (good.length) {
      li.appendChild(H('details', {}, H('summary', {}, T('selftestShowDetails')),
        H('ul', {}, row.lines.map(function (l) { return H('li', {}, (l.ok ? 'PASS ' : 'FAIL ') + l.msg); }))));
    }
    return li;
  }

  function coreRow() {
    var row = { id: 'core', name: T('selftestCoreHeading'), status: 'pass', pass: 0, fail: 0, lines: [], notes: [] };
    CORE_CHECKS.forEach(function (fn) {
      var r = Desk.contract.runCheck(fn, null);
      row.pass += r.pass; row.fail += r.fail; row.lines = row.lines.concat(r.results);
    });
    if (row.fail) row.status = 'fail';
    return row;
  }

  function run(el) {
    el.textContent = '';
    el.appendChild(H('h2', {}, T('selftestHeading')));
    el.appendChild(H('p', { class: 'muted' }, T('selftestIntro')));
    var summary = H('p', { class: 'st-summary', 'data-test': 'selftest-summary', 'data-status': 'running', role: 'status' }, T('selftestRunning'));
    el.appendChild(summary);
    el.appendChild(H('button', { type: 'button', 'data-test': 'selftest-run', on: { click: function () { run(el); } } }, T('selftestRun')));
    var list = H('ul', { class: 'st-list' });
    el.appendChild(list);

    var rows = [coreRow()];
    var defs = Desk.featureDefs();
    // Parts that were listed but did not load, or broke when they started.
    var listed = Array.isArray(Desk.features) ? Desk.features : [];
    var extra = [];
    listed.forEach(function (id) {
      if (Desk.featureStatus(id) === 'missing') {
        extra.push({ id: id, name: id, status: 'missing', pass: 0, fail: 0, lines: [], notes: [T('selftestMissingNote')] });
      }
    });

    var waiting = defs.length;
    function finish() {
      var byId = {};
      rows.forEach(function (r) { byId[r.id] = r; });
      var ordered = [rows[0]].concat(defs.map(function (d) { return byId[d.id]; })).concat(extra);
      var pass = 0, fail = 0;
      ordered.forEach(function (r) {
        if (Desk.featureStatus(r.id) === 'broken') {
          r.notes.push(T('selftestBrokenNote'));
          r.status = 'fail'; r.fail++;
        }
        pass += r.pass; fail += r.fail;
        list.appendChild(renderRow(r));
      });
      summary.setAttribute('data-status', fail ? 'fail' : 'pass');
      summary.textContent = fail ? T('selftestSomeBad', { fail: fail, pass: pass }) : T('selftestAllGood', { pass: pass });
    }
    if (!waiting) return finish();
    defs.forEach(function (def) {
      loadCheckFile(def.id, function (status) {
        rows.push(featureRow(def, status));
        if (--waiting === 0) finish();
      });
    });
  }

  Desk.selftest = { featureRow: featureRow, run: run };
  Desk.screen('selftest', { label: 'selftestHeading', order: 1100, hidden: true, render: function (el) { run(el); } });
})();
