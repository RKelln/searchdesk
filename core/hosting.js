// Hosted-copy extras (DESIGN 14): the service worker, the "add to home screen" hint, and the storage request.
// Everything here is for a copy served over http(s). On file:// none of it runs. The page works without any of it.
//   Desk.hosting.shouldShowHint(env)  pure: should the hint show? env = {protocol, small, touch, standalone,
//                                     dismissed, workshop}
//   Desk.hosting.hintKind(env)        pure: 'prompt' (Android can add it with one tap), 'ios' or 'menu'
//   Desk.hosting.mount(parent, before) put the hint into the page (called by the shell once it is built)
//   Desk.hosting.saved()              persist calls this after a save worked; asks the browser, once, to keep the data
// The dismissal is a per-device key, not a setting: a setting is exported and merged, and the hint on a phone says
// nothing about the laptop.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var DISMISS_KEY = 'searchdesk1:installHint';
  var web = /^https?:$/;
  var deferred = null, node = null, dismissedNow = false, askedPersist = false;

  function T(k) { return Desk.t ? Desk.t(k) : k; }
  function loc() { try { return window.location.protocol; } catch (e) { return ''; } }
  function match(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }

  function shouldShowHint(env) {
    env = env || {};
    if (!web.test(env.protocol || '')) return false;
    if (env.workshop || env.dismissed || env.standalone) return false;
    return !!(env.small || env.touch);
  }
  function hintKind(env) {
    env = env || {};
    if (env.hasPrompt) return 'prompt';
    return env.ios ? 'ios' : 'menu';
  }

  function readDismissed() {
    if (dismissedNow) return true;
    try { return window.localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function writeDismissed() {
    dismissedNow = true;
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  }
  function env() {
    var nav = window.navigator || {};
    var ua = String(nav.userAgent || '');
    return {
      protocol: loc(),
      small: match('(max-width: 700px)'),
      touch: match('(pointer: coarse)'),
      standalone: match('(display-mode: standalone)') || nav.standalone === true,
      dismissed: readDismissed(),
      workshop: !!window.DESK_WORKSHOP,
      hasPrompt: !!deferred,
      ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1)
    };
  }

  function draw() {
    if (!node) return;
    var e = env();
    var show = shouldShowHint(e);
    node.hidden = !show;
    node.textContent = '';
    if (!show) return;
    var H = Desk.h;
    var kind = hintKind(e);
    var text = T(kind === 'prompt' ? 'installHintPrompt' : kind === 'ios' ? 'installHintIos' : 'installHintMenu');
    node.appendChild(H('span', { class: 'install-text' }, text));
    if (kind === 'prompt') {
      node.appendChild(H('button', { type: 'button', 'data-test': 'install-add', on: { click: addIt } }, T('installAdd')));
    }
    node.appendChild(H('button', { type: 'button', 'data-test': 'install-dismiss', on: { click: dismiss } }, T('installDismiss')));
  }
  function dismiss() { writeDismissed(); draw(); }
  function addIt() {
    var p = deferred;
    deferred = null;
    writeDismissed();
    draw();
    try { if (p && p.prompt) p.prompt(); } catch (e) {}
  }

  function mount(parent, before) {
    if (!parent || !Desk.h) return null;
    node = Desk.h('div', { class: 'install-hint', role: 'status', 'data-test': 'install-hint' });
    node.hidden = true;
    if (before && before.nextSibling) parent.insertBefore(node, before.nextSibling);
    else parent.appendChild(node);
    draw();
    return node;
  }

  // Ask the browser to keep this site's data (a phone may clear it after a week otherwise). Once, quietly.
  function saved() {
    if (askedPersist || !web.test(loc())) return;
    askedPersist = true;
    try {
      var s = window.navigator && window.navigator.storage;
      if (s && s.persist) { var r = s.persist(); if (r && r.catch) r.catch(function () {}); }
    } catch (e) {}
  }

  // The service worker: only on http(s), and only in a built copy (it has Desk.version), so the source page
  // never caches itself while someone is editing it.
  function register() {
    try {
      if (!web.test(loc()) || !Desk.version || !window.navigator || !window.navigator.serviceWorker) return;
      window.navigator.serviceWorker.register('sw.js').catch(function () {});
    } catch (e) {}
  }
  function init() {
    if (!web.test(loc())) return;
    try {
      window.addEventListener('beforeinstallprompt', function (ev) {
        try { ev.preventDefault(); } catch (e) {}
        deferred = ev;
        draw();
      });
      window.addEventListener('appinstalled', function () { deferred = null; writeDismissed(); draw(); });
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
    } catch (e) {}
  }

  Desk.hosting = { shouldShowHint: shouldShowHint, hintKind: hintKind, mount: mount, saved: saved };
  init();
})();
