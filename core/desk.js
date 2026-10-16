// The shell: Desk.register, slots, tabs, routes, stubs for missing features, toasts, boot (DESIGN 5, 7).
// This file loads first. It only uses other core files (Desk.h, Desk.t, Desk.store, Desk.persist) when it runs
// at start, never while loading.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var doc = typeof document !== 'undefined' ? document : null;

  // ---- Pure helpers (unit tested) ------------------------------------------------------------
  var ID_RE = /^[a-z]+(-[a-z]+)*$/; // feature and tab ids: a-z and hyphens (same rule as checks/run.js)
  function validId(id) { return typeof id === 'string' && ID_RE.test(id); }

  function orderOf(e) {
    var o = e && e.order;
    return typeof o === 'number' && isFinite(o) ? o : 50;
  }
  // Stable sort by `order` (default 50), then by `seq` (the order things were added). Returns a new array.
  function sortByOrder(list) {
    return list.slice().sort(function (a, b) {
      var x = orderOf(a), y = orderOf(b);
      return x !== y ? x - y : (a.seq || 0) - (b.seq || 0);
    });
  }
  // Menu order: "home" first, then feature tabs by order, then core tabs (core: true) by order.
  function orderTabs(tabs) {
    var home = tabs.filter(function (t) { return t.id === 'home'; });
    var feat = tabs.filter(function (t) { return t.id !== 'home' && !t.core; });
    var core = tabs.filter(function (t) { return t.id !== 'home' && t.core; });
    return home.concat(sortByOrder(feat), sortByOrder(core));
  }
  // '#jobs/abc' -> { tab: 'jobs', args: ['abc'], known: true }. Unknown or empty goes to `fallback`.
  function parseRoute(hash, ids, fallback) {
    var s = String(hash || '').replace(/^#\/?/, '');
    var parts = s.split('/').map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    var tab = parts[0];
    if (tab && ids.indexOf(tab) >= 0) return { tab: tab, args: parts.slice(1), known: true };
    return { tab: fallback, args: [], known: false };
  }

  Desk.shellUtil = { validId: validId, sortByOrder: sortByOrder, orderTabs: orderTabs, parseRoute: parseRoute };

  // ---- Registry ------------------------------------------------------------------------------
  var SLOT_NAMES = ['tab', 'home', 'job.panel', 'job.actions', 'event.actions', 'settings', 'print'];
  var ACTION_SLOTS = { 'job.actions': true, 'event.actions': true };
  var RESERVED_TABS = ['data', 'ai', 'selftest'];
  var defs = {};       // id -> registered definition
  var defOrder = [];   // ids in the order they registered
  var missingIds = {}; // id -> true: listed but its file did not load
  var broken = {};     // id -> true: registered but mount() threw
  var mounted = {};    // id -> true
  var slots = {};      // slot name -> [entry]
  SLOT_NAMES.forEach(function (n) { slots[n] = []; });
  var seq = 0;
  var coreScreens = {}; // id -> { id, label (string key), order, hidden, render, seq }
  var dataSections = [];
  var recipeDefs = [];
  var started = false, starting = false;
  var fixedNow = null;
  var current = { tab: 'home', args: [] };
  var els = {};         // shell elements
  var localeCache = null;
  var toastCount = 0;

  function warn() { if (typeof console !== 'undefined' && console.warn) console.warn.apply(console, arguments); }
  function logError() { if (typeof console !== 'undefined' && console.error) console.error.apply(console, arguments); }
  function H() { return Desk.h.apply(null, arguments); }
  function T(k, v) { return Desk.t(k, v); }

  Desk.register = function (def) {
    if (!def || typeof def !== 'object') throw new Error('Desk.register needs a feature object.');
    if (!validId(def.id)) throw new Error('A feature id must use only the letters a-z and hyphens, for example "my-notes".');
    var id = def.id;
    if (defs[id]) {
      warn('Search Desk: "' + id + '" was registered twice. The second one replaces the first.');
      if (mounted[id] || broken[id]) unmountFeature(id);
    } else {
      defOrder.push(id);
    }
    defs[id] = def;
    delete missingIds[id];
    delete broken[id];
    if (started) { mountFeature(def); refresh(true); }
    return def;
  };

  // The feature listed in list.js did not load.
  Desk.missing = function (id) {
    if (!validId(id) || defs[id]) return;
    if (!missingIds[id]) warn('Search Desk: the part "' + id + '" did not load. A stub is shown in its place.');
    missingIds[id] = true;
    if (started) refresh(true);
  };

  Desk.featureDefs = function () { return defOrder.map(function (id) { return defs[id]; }); };
  Desk.featureStatus = function (id) {
    if (defs[id]) return broken[id] ? 'broken' : (mounted[id] ? 'ok' : 'registered');
    return missingIds[id] ? 'missing' : 'unknown';
  };

  // ---- Slots ---------------------------------------------------------------------------------
  function addSlot(name, owner, d) {
    if (SLOT_NAMES.indexOf(name) < 0) throw new Error('There is no place called "' + name + '". Places are: ' + SLOT_NAMES.join(', ') + '.');
    if (!d || typeof d !== 'object') throw new Error('A slot needs an object with an id.');
    if (typeof d.id !== 'string' || !d.id) throw new Error('A "' + name + '" slot needs an id.');
    if (ACTION_SLOTS[name]) {
      if (typeof d.run !== 'function' || typeof d.label !== 'string') throw new Error('A "' + name + '" slot needs a label and a run function.');
    } else if (typeof d.render !== 'function') {
      throw new Error('A "' + name + '" slot needs a render function.');
    }
    if (name === 'tab') {
      if (!validId(d.id)) throw new Error('A tab id must use only the letters a-z and hyphens.');
      if (typeof d.label !== 'string' || !d.label) throw new Error('A tab needs a label.');
      if (RESERVED_TABS.indexOf(d.id) >= 0) throw new Error('The tab id "' + d.id + '" is kept for the app.');
      slots.tab.forEach(function (e) {
        if (e.def.id === d.id && e.owner !== owner) throw new Error('Another part already uses the tab id "' + d.id + '".');
      });
    }
    var list = slots[name];
    for (var i = 0; i < list.length; i++) {
      if (list[i].owner === owner && list[i].def.id === d.id) { list.splice(i, 1); break; }
    }
    list.push({ slot: name, owner: owner, def: d, order: d.order, seq: ++seq });
  }
  function removeSlots(owner) {
    SLOT_NAMES.forEach(function (n) {
      slots[n] = slots[n].filter(function (e) { return e.owner !== owner; });
    });
  }

  // Desk.slots.render(name, parent, ...args): adds each entry of the slot to `parent`, in order.
  // Each render function gets a fresh empty element. An entry that renders nothing is left out; one that
  // throws shows a small plain line instead. Action slots (job.actions, event.actions) become buttons.
  // Returns how many blocks were added.
  function renderSlot(name, parent, a1, a2) {
    var args = Array.prototype.slice.call(arguments, 2);
    if (!slots[name] || name === 'tab' || !parent) return 0;
    var n = 0;
    sortByOrder(slots[name]).forEach(function (e) {
      var d = e.def, node;
      if (ACTION_SLOTS[name]) {
        node = H('button', { type: 'button', class: 'slot-action', 'data-test': 'action-' + d.id, on: { click: function () {
          try { d.run.apply(d, args); } catch (err) { logError(err); Desk.ui.toast(T('actionFailed')); }
        } } }, d.label);
        parent.appendChild(node); n++;
        return;
      }
      var body = H('div', { class: 'slot-body' });
      try { d.render.apply(d, [body].concat(args)); }
      catch (err) {
        logError(err);
        body = H('p', { class: 'slot-error', role: 'note' }, T('slotError'));
      }
      if (!body.childNodes.length) return;
      node = H('section', { class: 'slot slot-' + name.replace('.', '-'), 'data-slot': name, 'data-slot-id': d.id });
      if (typeof d.title === 'string' && d.title) node.appendChild(H('h3', { class: 'slot-title' }, d.title));
      node.appendChild(body);
      parent.appendChild(node); n++;
    });
    return n;
  }
  Desk.slots = {
    names: SLOT_NAMES.slice(),
    render: renderSlot,
    // The entries of a slot in display order: [{owner, def}]
    list: function (name) { return slots[name] ? sortByOrder(slots[name]).map(function (e) { return { owner: e.owner, def: e.def }; }) : []; }
  };

  // ---- Core screens and sections (io.js, recipes.js and selftest.js plug in here) -----------------
  // Desk.screen(id, { label: 'stringKey', order, hidden, render(el) }). Replaces an earlier one with the same id.
  Desk.screen = function (id, def) {
    if (!validId(id) || !def || typeof def.render !== 'function') throw new Error('Desk.screen needs an id and a render function.');
    var old = coreScreens[id];
    coreScreens[id] = { id: id, label: def.label || id, order: def.order, hidden: !!def.hidden, render: def.render, seq: old ? old.seq : ++seq };
    if (started) refresh(true);
  };
  // A block on the Data screen, above the settings slots: Desk.dataSection({ id, order, render(el) }).
  Desk.dataSection = function (def) {
    if (!def || typeof def.id !== 'string' || typeof def.render !== 'function') throw new Error('A data section needs an id and a render function.');
    dataSections = dataSections.filter(function (s) { return s.id !== def.id; });
    dataSections.push({ id: def.id, order: def.order, render: def.render, seq: ++seq });
  };

  function addRecipe(def, owner) {
    if (!def || typeof def !== 'object' || typeof def.id !== 'string' || !def.id) throw new Error('A recipe needs an id.');
    recipeDefs = recipeDefs.filter(function (r) { return r.def.id !== def.id; });
    recipeDefs.push({ owner: owner, def: def });
  }
  Desk.recipeDefs = function () { return recipeDefs.slice(); }; // T3.3 reads this

  // ---- ctx -----------------------------------------------------------------------------------
  function deepFreeze(o) {
    if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); }
    return o;
  }
  function localeCopy() {
    if (!localeCache) {
      try { localeCache = deepFreeze(window.DESK_LOCALE ? JSON.parse(JSON.stringify(window.DESK_LOCALE)) : {}); }
      catch (e) { localeCache = Object.freeze({}); }
    }
    return localeCache;
  }
  // Desk.now() is a Date. Tests and demos may fix it with Desk.setNow(dateOrMs) and clear it with Desk.setNow(null).
  Desk.now = function () { return fixedNow === null ? new Date() : new Date(fixedNow); };
  Desk.setNow = function (v) { fixedNow = v === null || v === undefined ? null : new Date(v).getTime(); };

  function has(id) { return !!defs[id] && !broken[id]; }

  function makeCtx(def) {
    var id = def.id;
    return Object.freeze({
      store: Desk.store.scoped(id, Array.isArray(def.types) ? def.types : []),
      slot: function (name, d) { addSlot(name, id, d); },
      renderSlot: renderSlot, // addition to CONTRACT: how a feature shows job.panel, job.actions and so on
      h: Desk.h,
      t: Desk.makeT(def.strings && typeof def.strings === 'object' ? def.strings : {}),
      ui: Desk.ui,
      has: has,
      locale: localeCopy(),
      now: function () { return Desk.now(); },
      profile: function () { return Desk.store.get('profile') || {}; },
      recipe: function (r) { addRecipe(r, id); }
    });
  }

  function styleEl(id) { return doc ? doc.getElementById('feature-css-' + id) : null; }
  function mountFeature(def) {
    var id = def.id;
    try {
      if (typeof def.css === 'string' && def.css && doc) {
        var st = doc.createElement('style');
        st.id = 'feature-css-' + id;
        st.textContent = def.css;
        doc.head.appendChild(st);
      }
      if (typeof def.mount === 'function') def.mount(makeCtx(def));
      mounted[id] = true;
      delete broken[id];
    } catch (e) {
      warn('Search Desk: "' + id + '" could not start, so a stub is shown in its place.', e);
      broken[id] = true;
      delete mounted[id];
      removeSlots(id);
      var s = styleEl(id);
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  }
  function unmountFeature(id) {
    removeSlots(id);
    recipeDefs = recipeDefs.filter(function (r) { return r.owner !== id; });
    var s = styleEl(id);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    delete mounted[id]; delete broken[id];
  }

  // ---- Tabs and screens ------------------------------------------------------------------------
  function infoFor(id) {
    var d = defs[id], planned = null;
    (Desk.planned || []).forEach(function (p) { if (p && p.id === id) planned = p; });
    var kn = 'base.' + id + '.name', kp = 'base.' + id + '.purpose';
    var base = Desk.strings && Object.prototype.hasOwnProperty.call(Desk.strings, kn);
    return {
      name: (planned && planned.name) || (d && d.name) || (base ? T(kn) : id),
      purpose: (planned && planned.purpose) || (d && d.purpose) || (base ? T(kp) : '')
    };
  }

  function allTabs() {
    var tabs = [], used = {};
    slots.tab.forEach(function (e) {
      used[e.def.id] = true;
      tabs.push({ id: e.def.id, label: e.def.label, order: e.def.order, seq: e.seq, kind: 'feature', def: e.def });
    });
    var stubIds = Object.keys(missingIds).concat(Object.keys(broken));
    var listIndex = Array.isArray(Desk.features) ? Desk.features : [];
    stubIds.forEach(function (id) {
      if (used[id] || !validId(id) || RESERVED_TABS.indexOf(id) >= 0) return;
      used[id] = true;
      var at = listIndex.indexOf(id);
      tabs.push({ id: id, label: infoFor(id).name, seq: 500000 + (at < 0 ? 999 : at), kind: 'stub', broken: !!broken[id] });
    });
    Object.keys(coreScreens).forEach(function (id) {
      var c = coreScreens[id];
      tabs.push({ id: id, label: T(c.label), order: c.order, seq: c.seq, kind: 'core', core: true, hidden: c.hidden, def: c });
    });
    return orderTabs(tabs);
  }

  function renderStub(el, tab) {
    var info = infoFor(tab.id);
    el.appendChild(H('h2', {}, info.name));
    if (info.purpose) el.appendChild(H('p', { class: 'stub-purpose' }, info.purpose));
    el.appendChild(H('p', { class: 'stub-note', 'data-test': 'stub' }, T('stubNotBuilt')));
    if (tab.broken) el.appendChild(H('p', { class: 'stub-broken' }, T('stubBroken')));
  }

  function renderIdeas(el) {
    var items = (Array.isArray(Desk.planned) ? Desk.planned : []).filter(function (p) {
      return p && validId(p.id) && !has(p.id) && typeof p.name === 'string';
    });
    if (!items.length) return;
    var list = H('ul', { class: 'ideas-list' });
    items.forEach(function (p) {
      list.appendChild(H('li', { class: 'idea', 'data-test': 'idea-' + p.id },
        H('strong', {}, p.name), p.purpose ? H('span', { class: 'idea-purpose' }, ' ' + p.purpose) : null));
    });
    el.appendChild(H('section', { class: 'ideas', 'data-test': 'ideas' },
      H('h3', {}, T('ideasHeading')), H('p', { class: 'muted' }, T('ideasIntro')), list));
  }

  function renderUndoSection(el) {
    var S = Desk.store;
    if (!S || !S.canUndo()) return;
    var label = S.undoLabel(), token = S.undoToken();
    el.appendChild(H('div', { class: 'undo-row' },
      H('p', {}, label ? T('lastChange', { label: label }) : T('lastChangeNone')),
      H('button', { type: 'button', 'data-test': 'data-undo', on: { click: function () { if (S.undoToken() === token) S.undo(); } } }, T('undoLast'))));
  }

  function registerCoreScreens() {
    Desk.screen('data', { label: 'tabData', order: 1000, render: function (el) {
      el.appendChild(H('h2', {}, T('dataHeading')));
      var secs = sortByOrder(dataSections);
      if (!secs.length) el.appendChild(H('p', { class: 'muted' }, T('dataSoon')));
      secs.forEach(function (s) {
        var box = H('section', { class: 'data-section', 'data-test': 'data-' + s.id });
        try { s.render(box); } catch (e) { logError(e); box = H('p', { class: 'slot-error', role: 'note' }, T('slotError')); }
        if (box.childNodes.length) el.appendChild(box);
      });
      renderUndoSection(el);
      renderSlot('settings', el);
      renderIdeas(el);
    } });
    Desk.screen('ai', { label: 'tabAi', order: 900, render: function (el) {
      el.appendChild(H('h2', {}, T('aiHeading')));
      el.appendChild(H('p', { class: 'muted' }, T('aiSoon')));
    } });
    Desk.screen('selftest', { label: 'selftestHeading', order: 1100, hidden: true, render: function (el) {
      el.appendChild(H('h2', {}, T('selftestHeading')));
      el.appendChild(H('p', { class: 'muted' }, T('selftestSoon')));
    } });
  }

  // ---- Shell DOM --------------------------------------------------------------------------------
  function buildShell() {
    var root = doc.getElementById('root');
    if (!root) { root = doc.createElement('div'); root.id = 'root'; doc.body.appendChild(root); }
    root.textContent = '';
    els.root = root;
    els.banner = H('div', { class: 'banner', 'data-test': 'banner' });
    els.notice = H('p', { class: 'notice', role: 'status', 'data-test': 'not-saving' });
    els.nav = H('nav', { class: 'tabs', 'aria-label': T('menuLabel') });
    els.main = H('main', { id: 'main', class: 'screen', tabindex: '-1' });
    els.toasts = H('div', { class: 'toasts' });
    els.banner.hidden = true; els.notice.hidden = true;
    var skip = doc.createElement('a');
    skip.className = 'skip-link'; skip.setAttribute('href', '#main'); skip.textContent = T('skipToContent');
    skip.addEventListener('click', function (e) { e.preventDefault(); els.main.focus(); });
    root.appendChild(skip);
    root.appendChild(els.banner);
    root.appendChild(els.notice);
    root.appendChild(H('div', { class: 'app' }, els.nav, els.main));
    root.appendChild(els.toasts);
  }

  function updateBanner() {
    var w = window.DESK_WORKSHOP;
    var text = w ? (typeof w.banner === 'string' && w.banner ? w.banner : T('workshopBanner')) : '';
    els.banner.textContent = text;
    els.banner.hidden = !text;
  }
  function updateNotice() {
    var msg = Desk.persist && Desk.persist.status() === 'memory' ? T('notSaving') : '';
    els.notice.textContent = msg;
    els.notice.hidden = !msg;
  }

  function renderNav(tabs) {
    els.nav.textContent = '';
    tabs.forEach(function (t) {
      if (t.hidden) return;
      var a = doc.createElement('a');
      a.className = 'tab';
      a.setAttribute('href', '#' + t.id);
      a.setAttribute('data-test', 'nav-' + t.id);
      if (t.kind === 'stub') a.classList.add('tab-stub');
      if (t.id === current.tab) { a.setAttribute('aria-current', 'page'); a.classList.add('active'); }
      a.textContent = t.label;
      els.nav.appendChild(a);
    });
  }

  function resolveRoute(tabs) {
    var ids = tabs.map(function (t) { return t.id; });
    var visible = tabs.filter(function (t) { return !t.hidden; });
    var fallback = ids.indexOf('home') >= 0 ? 'home' : (visible[0] ? visible[0].id : 'data');
    return parseRoute(window.location.hash, ids, fallback);
  }

  // Focus is remembered by id, data-test, name, or position, so typing is not lost on a re-render.
  function focusKey(a) {
    if (a.id) return { by: 'id', v: a.id };
    var dt = a.getAttribute('data-test'); if (dt) return { by: 'dt', v: dt };
    var nm = a.getAttribute('name'); if (nm) return { by: 'name', v: nm };
    var same = els.main.querySelectorAll(a.tagName.toLowerCase());
    return { by: 'idx', tag: a.tagName.toLowerCase(), v: Array.prototype.indexOf.call(same, a) };
  }
  function findByKey(k) {
    var q = els.main;
    if (k.by === 'id') return doc.getElementById(k.v);
    if (k.by === 'dt') return q.querySelector('[data-test="' + k.v.replace(/"/g, '\\"') + '"]');
    if (k.by === 'name') return q.querySelector('[name="' + k.v.replace(/"/g, '\\"') + '"]');
    return q.querySelectorAll(k.tag)[k.v] || null;
  }
  function snapshot() {
    var a = doc.activeElement, snap = { y: window.pageYOffset || 0, focus: null };
    if (a && a !== els.main && els.main.contains(a)) {
      snap.focus = { key: focusKey(a), value: null, start: null, end: null, tag: a.tagName };
      var type = (a.getAttribute('type') || 'text').toLowerCase();
      if ((a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && type !== 'checkbox' && type !== 'radio' && type !== 'file') {
        snap.focus.value = a.value;
        try { snap.focus.start = a.selectionStart; snap.focus.end = a.selectionEnd; } catch (e) {}
      }
    }
    return snap;
  }
  function restore(snap) {
    var f = snap.focus;
    if (f) {
      var n = findByKey(f.key);
      if (n && n.tagName === f.tag) {
        if (f.value !== null && n.value !== f.value) n.value = f.value;
        try { n.focus({ preventScroll: true }); if (f.start !== null) n.setSelectionRange(f.start, f.end); } catch (e) {}
      }
    }
    window.scrollTo(0, snap.y);
  }

  function renderMain(keepFocus) {
    var tabs = allTabs();
    var tab = null;
    tabs.forEach(function (t) { if (t.id === current.tab) tab = t; });
    var snap = keepFocus ? snapshot() : null;
    var screen = H('div', { class: 'screen-body', 'data-screen': current.tab });
    try {
      if (!tab) throw new Error('no screen');
      if (tab.kind === 'stub') renderStub(screen, tab);
      else tab.def.render(screen);
    } catch (e) {
      logError(e);
      screen = H('div', { class: 'screen-body', 'data-screen': current.tab }, H('p', { class: 'slot-error', role: 'alert' }, T('screenError')));
    }
    els.main.textContent = '';
    els.main.appendChild(screen);
    if (snap) restore(snap);
  }

  // Re-render the nav and the current screen. `route` re-reads the hash.
  function refresh(route) {
    if (!started && !starting) return;
    var tabs = allTabs();
    if (route) {
      var r = resolveRoute(tabs);
      current = { tab: r.tab, args: r.args };
    }
    renderNav(tabs);
    renderMain(true);
  }

  var pending = false;
  function scheduleRender() { // many changes in one go draw once
    if (pending) return;
    pending = true;
    Promise.resolve().then(function () {
      pending = false;
      if (started) renderMain(true);
    });
  }

  function onHashChange() {
    if (!started) return;
    var before = current.tab;
    var r = resolveRoute(allTabs());
    current = { tab: r.tab, args: r.args };
    renderNav(allTabs());
    renderMain(false);
    if (before !== current.tab) { window.scrollTo(0, 0); try { els.main.focus({ preventScroll: true }); } catch (e) {} }
  }

  Desk.route = function () { return { tab: current.tab, args: current.args.slice() }; };

  // ---- ui: toast, confirm, go ----------------------------------------------------------------------
  function toast(text, opts) {
    if (!els.toasts) return null;
    var undo = opts && opts.undo;
    var unsub = null;
    var node = H('div', { class: 'toast', role: 'status', 'data-test': 'toast' });
    node.appendChild(H('span', { class: 'toast-text' }, String(text)));
    var timer = null;
    function close() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (unsub) { unsub(); unsub = null; }
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    if (undo) {
      var token = Desk.store.undoToken();
      var btn = H('button', { type: 'button', class: 'toast-undo', 'data-test': 'toast-undo', on: { click: function () {
        var fresh = Desk.store.undoToken() === token && token !== null;
        close();
        if (!fresh) return;
        var done = false;
        try { done = Desk.store.undo(); } catch (e) { logError(e); }
        if (done) toast(T('undone'));
      } } }, T('undo'));
      node.appendChild(btn);
      // A newer change takes the step this button was for, so the button goes away.
      unsub = Desk.store.subscribe(function () {
        if (Desk.store.undoToken() !== token && btn.parentNode) btn.parentNode.removeChild(btn);
      });
    }
    while (els.toasts.childNodes.length >= 3) els.toasts.removeChild(els.toasts.firstChild);
    els.toasts.appendChild(node);
    toastCount++;
    timer = setTimeout(close, undo ? 10000 : 5000); // one-shot
    return node;
  }

  function confirmBox(text, opts) {
    return new Promise(function (resolve) {
      var probe = doc.createElement('dialog');
      if (typeof probe.showModal !== 'function') { resolve(!!window.confirm(text)); return; }
      var prev = doc.activeElement, finished = false;
      var dlg;
      function finish(v) {
        if (finished) return;
        finished = true;
        try { dlg.close(); } catch (e) {}
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        try { if (prev && prev.focus) prev.focus(); } catch (e) {}
        resolve(v);
      }
      dlg = H('dialog', { class: 'confirm', 'data-test': 'confirm' },
        H('p', { class: 'confirm-text' }, String(text)),
        H('div', { class: 'confirm-buttons' },
          H('button', { type: 'button', 'data-test': 'confirm-no', on: { click: function () { finish(false); } } }, (opts && opts.no) || T('cancel')),
          H('button', { type: 'button', class: 'primary', 'data-test': 'confirm-yes', on: { click: function () { finish(true); } } }, (opts && opts.yes) || T('ok'))));
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); finish(false); });
      doc.body.appendChild(dlg);
      dlg.showModal();
    });
  }

  function go(tab) {
    var target = '#' + String(tab).replace(/^#\/?/, '');
    if (window.location.hash === target) { if (started) onHashChange(); return; }
    window.location.hash = target; // hashchange does the rest
  }

  Desk.ui = Object.freeze({ toast: toast, confirm: confirmBox, go: go });

  // ---- Loading and start ---------------------------------------------------------------------------
  // Injects <script src="features/<id>.js"> for each listed id that has not registered yet (a single-file build
  // has them all registered already). Scripts run in list order. Calls done() when every script has loaded or failed.
  function loadFeatures(done) {
    var ids = Array.isArray(Desk.features) ? Desk.features.slice() : [];
    var left = 0, finished = false, guard = null;
    function finish() {
      if (finished) return;
      finished = true;
      if (guard !== null) clearTimeout(guard);
      ids.forEach(function (id) { if (validId(id) && !defs[id]) Desk.missing(id); });
      done();
    }
    ids.forEach(function (id) {
      if (!validId(id)) { warn('Search Desk: "' + id + '" in the feature list is not a usable id, so it is skipped.'); return; }
      if (defs[id]) return;
      left++;
      var s = doc.createElement('script');
      s.async = false; // keeps the list order
      s.setAttribute('data-feature', id);
      s.onload = function () { if (--left === 0) finish(); };
      s.onerror = function () { Desk.missing(id); if (--left === 0) finish(); };
      s.src = 'features/' + id + '.js';
      doc.head.appendChild(s);
    });
    if (left === 0) finish();
    else guard = setTimeout(finish, 15000); // a script that never answers must not hold the app
  }

  Desk.start = function () {
    if (started || starting) return;
    starting = true;
    buildShell();
    updateBanner();
    if (Desk.persist) {
      try { Desk.persist.load(); } catch (e) { logError(e); }
      updateNotice();
      Desk.persist.onStatus(updateNotice);
    }
    var order = defOrder.slice();
    order.forEach(function (id) { mountFeature(defs[id]); });
    var tabs = allTabs();
    var r = resolveRoute(tabs);
    current = { tab: r.tab, args: r.args };
    if (!r.known && window.location.hash !== '#' + r.tab) {
      try { window.history.replaceState(null, '', '#' + r.tab); } catch (e) { window.location.hash = '#' + r.tab; }
    }
    started = true;
    renderNav(tabs);
    renderMain(false);
    Desk.store.subscribe(function () { scheduleRender(); });
    window.addEventListener('hashchange', onHashChange);
    Desk.started = true;
  };

  Desk.started = false;

  // Desk.boot(): load the listed features, then start. Runs by itself once the page has been read, which is
  // after list.js (and, in a single-file build, after every inlined feature) has run.
  Desk.boot = function () {
    if (Desk.booted || !doc) return;
    Desk.booted = true;
    loadFeatures(function () { Desk.start(); });
  };

  registerCoreScreens();
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { Desk.boot(); });
    else Desk.boot();
  }
})();
