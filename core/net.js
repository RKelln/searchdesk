// The only network code (DESIGN 11, 12): GET the events host named in the locale pack, and nothing else.
//
// Desk.net.get(url, {timeout})   GET only. The URL must be https and its host must be the host of
//                                DESK_LOCALE.events.api (null there means "no network at all"). No cookies, no
//                                redirects. Resolves to parsed JSON; rejects with a plain Error.
// Desk.net.current()             what to show right now, no network: {events, source, generated, note}.
//                                source 'cache' (a live fetch kept earlier) or 'snapshot' (data/events-snapshot.js).
// Desk.net.events({force, now})  refresh when live events are on. Resolves to the same shape as current().
//                                It fetches only when ALL of these hold: settings.liveEvents is true, this is not a
//                                workshop copy with DESK_WORKSHOP.liveEvents === false, and the locale has an api.
//                                Otherwise it just resolves current(). The cache (`searchdesk1:events`, never exported)
//                                is fresh for 12 hours; `force` skips that check. After a good fetch the screen is
//                                drawn again. Any failure resolves current() with a one-line `note`.
// Desk.net.normalise(item, tierId)  one API item -> {id,title,start,end,venue,address,url,tier,tags} or null.
// Desk.net.normaliseAll({tierId: [items]}, tiers, known)  merge the tiers (the FIRST tier in the locale list wins
//                                when an event is in two, so list the specific tier first), sorted.
// The rules are the same as tools/snapshot.py's (that file describes the API). One difference: a browser cannot
// afford one request per event, so `url` is the event's Togather page (@id) unless the snapshot already knows a
// source link for that id. Descriptions are never kept.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var CACHE_KEY = 'searchdesk1:events';
  var FRESH_MS = 12 * 3600 * 1000;
  var DAYS = 56, PAGE = 200, MAX_PAGES = 8, TIMEOUT = 10000, MAX_BYTES = 5 * 1024 * 1024;
  var inflight = null, lastNote = '';

  function T(k, v) { return Desk.t ? Desk.t(k, v) : k; }
  function localeEvents() { return (window.DESK_LOCALE && window.DESK_LOCALE.events) || {}; }

  // ---- Pure helpers ------------------------------------------------------------------------------
  // Feeds send some text still HTML-encoded ("Toronto&#39;s"). Decode the common entities to plain characters; the
  // result is only ever shown as text, so a decoded "<" is harmless.
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '\u2013', mdash: '\u2014',
    lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d', hellip: '\u2026' };
  function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, function (all, e) {
      var n = e[0] !== '#' ? -1 : (e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      if (e[0] !== '#') return Object.prototype.hasOwnProperty.call(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : all;
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all;
    });
  }
  // Some place names arrive as "MalvernEvent location: Malvern": keep the part after the label.
  function tidyPlace(s, limit) {
    s = tidy(s, 1000);
    var m = /^(.*?)\s*Event location:\s*(.+)$/.exec(s);
    return tidy(m ? m[2] : s, limit);
  }
  function tidy(s, limit) {
    s = typeof s === 'string' ? decodeEntities(s).replace(/\s+/g, ' ').replace(/^ | $/g, '') : '';
    return s.length > limit ? s.slice(0, limit).replace(/ $/, '') : s;
  }
  function hostOf(u) {
    var m = /^https:\/\/([^\/?#]+)/.exec(u);
    return m ? m[1] : '';
  }
  // The url if it is a usable https link, else ''.
  function httpsUrl(u) {
    if (typeof u !== 'string') return '';
    u = u.replace(/^\s+|\s+$/g, '');
    if (u.length < 12 || u.length > 500 || !/^https:\/\/[^\s<>"']+$/.test(u)) return '';
    var host = hostOf(u);
    return host && host.indexOf('@') < 0 ? u : '';
  }
  // '2026-10-22T18:30:00-04:00' -> '2026-10-22T18:30' (the offset already says Toronto time). Date-only stays.
  function localTime(v) {
    if (typeof v !== 'string') return '';
    var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(v.replace(/^\s+/, ''));
    return m ? m[1] + (m[2] ? 'T' + m[2] : '') : '';
  }

  function normalise(item, tierId) {
    if (!item || typeof item !== 'object') return null;
    var page = httpsUrl(item['@id']);
    var id = page ? page.replace(/\/+$/, '').split('/').pop() : '';
    var title = tidy(item.name, 200), start = localTime(item.startDate);
    if (!/^[0-9A-Za-z]{6,40}$/.test(id) || !title || !start) return null;
    var end = localTime(item.endDate);
    var place = item.location && typeof item.location === 'object' ? item.location : {};
    var addr = place.address && typeof place.address === 'object' ? place.address : {};
    var address = [tidy(addr.streetAddress, 100), tidy(addr.addressLocality, 60)].filter(Boolean).join(', ');
    var tags = [];
    (Array.isArray(item.keywords) ? item.keywords : []).forEach(function (k) {
      k = tidy(k, 40).toLowerCase();
      if (k && tags.indexOf(k) < 0) tags.push(k);
    });
    return { id: id, title: title, start: start, end: end >= start ? end : '', venue: tidyPlace(place.name, 120),
      address: address, url: page, tier: String(tierId), tags: tags.slice(0, 6) };
  }

  function byStart(a, b) {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    var x = a.title.toLowerCase(), y = b.title.toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }

  // responses: {tierId: [api items]}; tiers: the locale's list (its order decides who wins a duplicate);
  // known: {eventId: url} from the snapshot, so a source link we already have is kept.
  function normaliseAll(responses, tiers, known) {
    var seen = {}, out = [];
    (tiers || []).forEach(function (tier) {
      ((responses && responses[tier.id]) || []).forEach(function (item) {
        var ev = normalise(item, tier.id);
        if (!ev || Object.prototype.hasOwnProperty.call(seen, ev.id)) return;
        seen[ev.id] = true;
        var k = known && Object.prototype.hasOwnProperty.call(known, ev.id) ? httpsUrl(known[ev.id]) : '';
        if (k) ev.url = k;
        out.push(ev);
      });
    });
    return out.sort(byStart);
  }

  // A stored event (snapshot or cache) in the safe shape, or null.
  function cleanEvent(e) {
    if (!e || typeof e !== 'object') return null;
    var id = typeof e.id === 'string' ? e.id : '', title = tidy(e.title, 200), start = localTime(e.start);
    if (!id || id.length > 60 || !title || !start || start.length !== String(e.start).length) return null;
    var end = localTime(e.end);
    return { id: id, title: title, start: start, end: end >= start ? end : '', venue: tidyPlace(e.venue, 120),
      address: tidy(e.address, 170), url: httpsUrl(e.url), tier: tidy(e.tier, 40),
      tags: (Array.isArray(e.tags) ? e.tags : []).filter(function (t) { return typeof t === 'string'; }).map(function (t) { return tidy(t, 40); }).slice(0, 6) };
  }
  function cleanList(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (e) { var c = cleanEvent(e); if (c) out.push(c); });
    return out;
  }

  // ---- Address, switches ---------------------------------------------------------------------------
  function apiBase() {
    var a = localeEvents().api;
    return typeof a === 'string' && /^https:\/\/[^\s\/?#]+/.test(a) ? a : null;
  }
  function allowedHost() { var a = apiBase(); return a ? hostOf(a).toLowerCase() : null; }

  function liveEnabled() {
    if (!apiBase()) return false;
    if (window.DESK_WORKSHOP && window.DESK_WORKSHOP.liveEvents === false) return false;
    var s = Desk.store && Desk.store.get ? Desk.store.get('settings') : null;
    return !!(s && s.liveEvents === true);
  }

  // ---- GET ------------------------------------------------------------------------------------------
  function get(url, opts) {
    var timeout = opts && typeof opts.timeout === 'number' && opts.timeout > 0 ? opts.timeout : TIMEOUT;
    return new Promise(function (resolve, reject) {
      var host = allowedHost();
      if (!host) { reject(new Error('This copy has no events address, so nothing was fetched.')); return; }
      var u = typeof url === 'string' ? url : '';
      if (!/^https:\/\//.test(u) || hostOf(u).toLowerCase() !== host) { reject(new Error('That address is not allowed.')); return; }
      if (typeof window.fetch !== 'function') { reject(new Error('This browser cannot fetch.')); return; }
      var ctl = typeof window.AbortController === 'function' ? new window.AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('The events service took too long.')); }, timeout); // one-shot
      window.fetch(u, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
        .then(function (res) {
          if (!res.ok) throw new Error('The events service answered ' + res.status + '.');
          return res.text();
        })
        .then(function (text) {
          if (text.length > MAX_BYTES) throw new Error('The events answer was too big.');
          return JSON.parse(text);
        })
        .then(function (data) { clearTimeout(timer); resolve(data); }, function (e) { clearTimeout(timer); reject(e instanceof Error ? e : new Error('The events service did not answer.')); });
    });
  }

  // ---- Snapshot and cache -------------------------------------------------------------------------
  function snapshot() {
    var s = window.DESK_EVENTS_SNAPSHOT;
    var ok = s && typeof s === 'object';
    return { events: ok ? cleanList(s.events) : [], generated: ok && typeof s.generated === 'string' ? s.generated : '' };
  }
  function readCache() {
    try {
      var c = JSON.parse(window.localStorage.getItem(CACHE_KEY));
      if (c && typeof c.fetched === 'number' && c.api === apiBase() && Array.isArray(c.events)) return { fetched: c.fetched, events: cleanList(c.events) };
    } catch (e) { /* no cache */ }
    return null;
  }
  function writeCache(fetched, events) {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ fetched: fetched, api: apiBase(), events: events })); } catch (e) { /* full or blocked */ }
  }

  function current() {
    var c = liveEnabled() ? readCache() : null;
    if (c) return { events: c.events, source: 'cache', generated: new Date(c.fetched).toISOString(), note: lastNote };
    var s = snapshot();
    return { events: s.events, source: 'snapshot', generated: s.generated, note: lastNote };
  }

  // ---- Live fetch -----------------------------------------------------------------------------------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function tierUrl(tier, startDay, endDay, cursor) {
    var q = [['startDate', startDay], ['endDate', endDay], ['limit', String(PAGE)], ['context', 'document']];
    var extra = tier.query && typeof tier.query === 'object' ? tier.query : {};
    Object.keys(extra).forEach(function (k) { q.push([k, String(extra[k])]); });
    if (cursor) q.push(['after', cursor]);
    return apiBase() + '?' + q.map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); }).join('&');
  }

  function fetchTier(tier, startDay, endDay) {
    var items = [];
    function page(n, cursor) {
      return get(tierUrl(tier, startDay, endDay, cursor)).then(function (d) {
        if (!d || !Array.isArray(d.items)) throw new Error('The events answer was not in the expected form.');
        items = items.concat(d.items);
        var next = typeof d.next_cursor === 'string' ? d.next_cursor : '';
        if (next && n < MAX_PAGES) return page(n + 1, next);
        return items;
      });
    }
    return page(1, '');
  }

  function fetchAll(now) {
    var tiers = Array.isArray(localeEvents().tiers) ? localeEvents().tiers : [];
    var start = new Date(now), end = new Date(now);
    end.setDate(end.getDate() + DAYS);
    var responses = {}, chain = Promise.resolve();
    tiers.forEach(function (tier) {
      chain = chain.then(function () { return fetchTier(tier, dayKey(start), dayKey(end)); }).then(function (items) { responses[tier.id] = items; });
    });
    return chain.then(function () {
      var known = {};
      snapshot().events.forEach(function (e) { if (e.url && hostOf(e.url).toLowerCase() !== allowedHost()) known[e.id] = e.url; });
      return normaliseAll(responses, tiers, known);
    });
  }

  function events(opts) {
    opts = opts || {};
    if (!liveEnabled()) return Promise.resolve(current());
    var now = opts.now !== undefined ? new Date(opts.now).getTime() : Date.now();
    var c = readCache();
    if (!opts.force && c && now - c.fetched >= 0 && now - c.fetched < FRESH_MS) return Promise.resolve(current());
    if (inflight) return inflight;
    inflight = fetchAll(now).then(function (list) {
      if (!list.length) throw new Error('The events service sent no events.');
      writeCache(now, list);
      lastNote = '';
      var res = current();
      if (typeof Desk.redraw === 'function') { try { Desk.redraw(); } catch (e) { /* drawing is not our job */ } }
      return res;
    }).catch(function (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('Search Desk: live events failed.', e);
      var had = readCache();
      lastNote = T(had ? 'netNoteCache' : 'netNoteSnapshot');
      return current();
    }).then(function (res) { inflight = null; return res; });
    return inflight;
  }

  Desk.net = Object.freeze({
    get: get, events: events, current: current, snapshot: snapshot, liveEnabled: liveEnabled,
    allowedHost: allowedHost, tidy: tidy, tidyPlace: tidyPlace, normalise: normalise, normaliseAll: normaliseAll, cleanEvent: cleanEvent,
    FRESH_MS: FRESH_MS, CACHE_KEY: CACHE_KEY,
  });
})();
