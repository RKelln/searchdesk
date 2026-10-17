// localStorage wrapper; the app works with no storage at all. Key names: DESIGN 6 "Caches are not state".
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var KEY = 'searchdesk1:state', UNDO_KEY = 'searchdesk1:undo', CORRUPT_KEY = 'searchdesk1:corrupt:';
  var LINE = 'This browser is not saving. Save a copy before you close it.';
  var o = { storage: undefined, delay: 400, setTimer: null, clearTimer: null };
  var timer = null, mode = 'ok', listeners = [];
  var hold = ''; // '' | 'backed' (bad state backed up; wait for an edit) | 'blocked' (backup failed; never write)
  var dirty = false;

  function storage() { // never throws
    try { return o.storage !== undefined ? o.storage : window.localStorage; } catch (e) { return null; }
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    listeners.slice().forEach(function (fn) { try { fn(m); } catch (e) {} });
  }
  function read(key) {
    try { var s = storage(); return s ? s.getItem(key) : null; } catch (e) { setMode('memory'); return null; }
  }
  function write(key, val) {
    try {
      var s = storage();
      if (!s) { setMode('memory'); return false; }
      s.setItem(key, val);
      return true;
    } catch (e) { setMode('memory'); return false; }
  }
  function nowStamp() { return String(Date.now()); }
  var persist = {
    KEY: KEY, UNDO_KEY: UNDO_KEY,
    // init({ storage, delay, setTimer, clearTimer }): options for tests; call with nothing for defaults
    init: function (opts) {
      opts = opts || {};
      o.storage = 'storage' in opts ? opts.storage : undefined;
      o.delay = opts.delay != null ? opts.delay : 400;
      o.setTimer = opts.setTimer || null; o.clearTimer = opts.clearTimer || null;
      if (timer != null) persist.cancel();
      hold = ''; dirty = false;
      // probe: is storage usable at all?
      var m = 'ok';
      try {
        var s = storage();
        if (!s) m = 'memory';
        else { s.setItem('searchdesk1:probe', '1'); s.removeItem('searchdesk1:probe'); }
      } catch (e) { m = 'memory'; }
      setMode(m);
    },
    // load(): reads saved state into Desk.store. Returns 'loaded' | 'empty' | 'corrupt' | 'memory'
    load: function () {
      var raw = read(KEY);
      if (raw == null) return mode === 'memory' ? 'memory' : 'empty';
      var s;
      try { s = JSON.parse(raw); } catch (e) { s = null; }
      var why = s ? Desk.store.load(s) : 'bad';
      if (why) { // keep the bytes under a key of their own; never overwrite them until that worked
        var k = CORRUPT_KEY + nowStamp(), n = 0;
        while (read(k + (n ? '-' + n : '')) != null && n < 50) n++;
        var ok = write(k + (n ? '-' + n : ''), raw);
        hold = ok ? 'backed' : 'blocked';
        if (!ok) setMode('memory');
        return 'corrupt';
      }
      var u = read(UNDO_KEY);
      if (u) { try { Desk.store.restoreStep(JSON.parse(u)); } catch (e) {} }
      return 'loaded';
    },
    // save(): debounced. flush(): now.
    save: function () {
      dirty = true;
      if (timer != null) return;
      var set = o.setTimer || function (f, ms) { return setTimeout(f, ms); };
      timer = set(function () { timer = null; persist.flush(); }, o.delay);
    },
    cancel: function () {
      if (timer == null) return;
      var clr = o.clearTimer || function (t) { clearTimeout(t); };
      try { clr(timer); } catch (e) {}
      timer = null;
    },
    flush: function () {
      persist.cancel();
      if (hold === 'blocked') { setMode('memory'); return false; }
      if (hold === 'backed' && !dirty) return false; // nothing edited yet: leave the old bytes alone
      var ok = write(KEY, JSON.stringify(Desk.store.state()));
      var step = Desk.store.lastStep();
      var ok2 = ok;
      if (ok) {
        if (step) ok2 = write(UNDO_KEY, JSON.stringify(step));
        else try { var s = storage(); if (s) s.removeItem(UNDO_KEY); } catch (e) { ok2 = false; setMode('memory'); }
      }
      if (ok && ok2) { hold = ''; setMode('ok'); }
      if (ok && window.Desk.hosting) { try { window.Desk.hosting.saved(); } catch (e) {} } // hosting (T4.2)
      return ok;
    },
    status: function () { return mode; },
    // the one line to show when status() is 'memory'; '' when saving works
    message: function () {
      if (mode !== 'memory') return '';
      return (Desk.t && Desk.strings && Desk.strings.notSaving) ? Desk.t('notSaving') : LINE;
    },
    onStatus: function (fn) { listeners.push(fn); }
  };
  window.Desk.persist = persist;
  persist.init();
  if (window.Desk.store) window.Desk.store.subscribe(function () { persist.save(); });
  try { window.addEventListener && window.addEventListener('pagehide', function () { persist.flush(); }); } catch (e) {}
  try {
    if (typeof document !== 'undefined' && document && document.addEventListener) {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') persist.flush(); });
    }
  } catch (e) {}
})();
