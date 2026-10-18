// features/events.js  (T2.5, DESIGN 8.1, 11) Events: what is on, star or hide it, and what the AI suggested.
//
// The events come from ctx.events.current() (the snapshot, or the live cache when live events are on). The
// shape of one event is {id, title, start, end, venue, address, url, tier, tags}; `start` and `end` are local
// wall-clock text, 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'.
//
// Records. `event-mark` is owned here: id 'em_<eventId>', {eventId, status: 'starred' | 'dismissed',
// copy: {title, start, end, venue, url, tier}}. The copy is what lets a starred event outlive the feed, and it is
// written with the same date form as above (Home reads copy.start). Unstar and "show again" remove the mark.
// This feature also lists `suggestion` among its types: taking or hiding a suggestion from the events recipe
// changes its status ('taken' | 'dismissed'), and the store only allows writes to types a feature owns. Nothing
// else about suggestions is touched here (core makes them).
//
// Weeks (logic.weekOf, with today as 'YYYY-MM-DD'): an event that is over (its last day is before today) is
// dropped. For the rest the day that counts is the later of its start day and today (so an event that began
// yesterday and runs to tomorrow counts as today). That day is 'this' for today..today+6 (the same window as
// Home), 'next' for today+7..today+13, and 'later' after that. "All" is everything that is not over.
//
// Layout of the screen: Suggested for you, Starred, the This week / Next week / All buttons, one list per tier
// (the locale's tier names), and a line to show the events the person hid. Starred events are listed once, in
// Starred (all of them, whatever the week buttons say), not again in their tier. Each tier list shows 25 and
// has a "Show more" button. data-test names: event-row (data-event-id), event-star, event-dismiss,
// events-week-<this|next|all>, events-tier-<id>, events-suggested, events-starred, suggestion-row
// (data-event-id), suggestion-take, suggestion-dismiss, events-ai-mark, events-link, events-more-<tier>,
// events-hidden-toggle, events-hidden, event-restore, events-source, events-empty.
Desk.register({
  id: 'events',
  name: 'Events',
  purpose: 'Find hiring events and job fairs, and star the ones you like.',
  // Where the events come from is in the locale pack, and a feed needs a Togather server for that place, so with
  // no pack this screen has nothing real in it. The shell then shows a stub that says so.
  needsLocale: true,
  types: ['event-mark', 'suggestion'],
  uses: [],
  strings: {
    tabLabel: 'Events',
    heading: 'Events',
    weekLabel: 'Show events from',
    weekThis: 'This week',
    weekNext: 'Next week',
    weekAll: 'All',
    sourceSnapshot: 'List saved on {date}. It may be out of date.',
    sourceLive: 'Latest list from {date}.',
    star: 'Star',
    unstar: 'Unstar',
    dismiss: 'Hide',
    restore: 'Show again',
    listing: 'See the listing',
    moreEvents: 'Show more',
    suggestedHeading: 'Suggested for you',
    suggestedIntro: 'Picked by an AI chat from your answers. You decide.',
    fromAi: 'From AI',
    why: 'Why: {why}',
    take: 'Star it',
    notForMe: 'Not for me',
    starredHeading: 'Starred',
    emptyTier: 'Nothing here for this time.',
    emptyAll: 'No events in the list yet.',
    hiddenShow: 'Hidden events: {n}. Show them',
    hiddenHide: 'Hide the list of hidden events',
    hiddenHeading: 'Hidden events',
    toStarred: 'Starred: {title}',
    toUnstarred: 'Removed the star: {title}',
    toHidden: 'Hidden: {title}',
    toShown: 'Showing again: {title}',
    toTaken: 'Starred: {title}',
    toSuggestionOff: 'Suggestion put away.',
    timeTo: '{start} to {end}',
    tierListLabel: 'Events {tier}',
    matchedOnly: 'Showing events about finding work.',
    matchShowAll: 'Show all events here ({n} more)',
    matchShowFew: 'Show only events about finding work',
  },
  css: `
    .events-weeks { display: inline-flex; flex-wrap: wrap; gap: 0; margin: 0 0 1.25rem; }
    .events-weeks button { border-radius: 0; margin-left: -1px; min-height: 40px; padding: .35rem 1rem; }
    .events-weeks button:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); margin-left: 0; }
    .events-weeks button:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .events-weeks button[aria-pressed="true"] { position: relative; z-index: 1; }
    .events-source { margin: 0 0 1rem; color: var(--muted); }
    .events-section { margin: 0 0 1.75rem; }
    .events-section > h3 { margin-top: 0; }
    .events-list { list-style: none; padding: 0; margin: 0 0 .75rem; display: grid; gap: .6rem; }
    .events-row { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: .85rem 1rem; display: grid; gap: .2rem; box-shadow: var(--shadow); }
    .events-row[data-starred="true"] { border-left: .3rem solid var(--accent); }
    .events-row h4 { margin: 0 0 .1rem; font-size: 1.05rem; overflow-wrap: anywhere; }
    .events-row p { margin: 0; overflow-wrap: anywhere; }
    .events-row .events-when { font-weight: 600; color: var(--accent); }
    .events-buttons { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
    .events-buttons button { min-height: 40px; padding: .35rem .9rem; }
    .events-ai { display: inline-block; font-size: .8rem; font-weight: 700; border-radius: 999px; padding: .05rem .5rem; margin-left: .5rem; color: var(--accent); background: var(--accent-soft); vertical-align: middle; }
  `,
  logic: {
    WEEK_DAYS: 7,
    PAGE: 25,
    WEEKS: ['this', 'next', 'all'],

    // Same date helpers as Home: a 'YYYY-MM-DD' key for a date text, a date-and-time text, or an ISO time.
    dayOf(v) {
      if (typeof v !== 'string' || !v) return '';
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) return v.slice(0, 10);
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : this.dateKey(d);
    },
    dateKey(date) {
      const p = (n) => (n < 10 ? '0' : '') + n;
      return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
    },
    daysBetween(a, b) {
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      return Math.round(n(b) - n(a));
    },
    todayKey(now) { return this.dateKey(now instanceof Date ? now : new Date(now)); },

    markId(eventId) { return 'em_' + eventId; },

    // The last day an event is on: its end day, or its start day when it has no end (or a bad one).
    lastDay(e) {
      const s = this.dayOf(e && e.start), en = this.dayOf(e && e.end);
      return en && en >= s ? en : s;
    },
    isUpcoming(e, today) {
      const last = this.lastDay(e);
      return !!last && last >= today;
    },
    // 'past' | 'this' | 'next' | 'later'
    weekOf(e, today) {
      if (!this.isUpcoming(e, today)) return 'past';
      const s = this.dayOf(e.start);
      const day = s > today ? s : today;
      const n = this.daysBetween(today, day);
      return n < this.WEEK_DAYS ? 'this' : (n < 2 * this.WEEK_DAYS ? 'next' : 'later');
    },
    // Is the event shown under this button ('this' | 'next' | 'all')?
    inWeek(e, week, today) {
      const w = this.weekOf(e, today);
      if (w === 'past') return false;
      return week === 'all' ? true : w === week;
    },
    // Oldest start first, then title, then id. Returns a new list.
    sortEvents(list) {
      return list.slice().sort((a, b) => {
        if (a.start !== b.start) return a.start < b.start ? -1 : 1;
        const x = String(a.title).toLowerCase(), y = String(b.title).toLowerCase();
        if (x !== y) return x < y ? -1 : 1;
        return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
      });
    },

    // {eventId: mark} for the marks that are starred or dismissed (not deleted).
    marksByEvent(marks) {
      const out = {};
      (Array.isArray(marks) ? marks : []).forEach((m) => {
        if (m && m.type === 'event-mark' && !m.deleted && m.eventId && (m.status === 'starred' || m.status === 'dismissed')) out[m.eventId] = m;
      });
      return out;
    },
    // What a mark remembers about its event. Only an https link is kept.
    copyOf(e) {
      return { title: e.title, start: e.start, end: e.end || '', venue: e.venue || '', url: /^https:\/\//.test(e.url || '') ? e.url : '', tier: e.tier || '' };
    },
    // An event rebuilt from a mark's copy, for an event the feed no longer has.
    eventFromMark(m) {
      const c = m.copy || {};
      return { id: m.eventId, title: String(c.title || ''), start: String(c.start || ''), end: String(c.end || ''), venue: String(c.venue || ''),
        address: '', url: /^https:\/\//.test(c.url || '') ? c.url : '', tier: String(c.tier || ''), tags: [] };
    },
    // The events (fresh from the feed when it still has them, else from the copy) of marks with this status,
    // not over, in date order.
    markedEvents(marks, events, status, today) {
      const byId = {};
      events.forEach((e) => { byId[e.id] = e; });
      const out = [];
      const map = this.marksByEvent(marks);
      Object.keys(map).forEach((id) => {
        const m = map[id];
        if (m.status !== status) return;
        const e = byId[id] || this.eventFromMark(m);
        if (e.title && e.start && this.isUpcoming(e, today)) out.push(e);
      });
      return this.sortEvents(out);
    },
    // Events for the tier lists: in the week, not starred, not hidden, in date order.
    listed(events, marks, week, today) {
      const map = this.marksByEvent(marks);
      return this.sortEvents(events.filter((e) => !map[e.id] && this.inWeek(e, week, today)));
    },
    // Does the event's title or tags have one of the words? A word matches at the start of a word, in any case
    // ("job" matches "Jobs" and "job-ready", not "banjo"). No words means everything matches.
    matchesWords(e, words) {
      if (!Array.isArray(words) || !words.length) return true;
      const text = String((e && e.title) || '') + ' ' + ((e && Array.isArray(e.tags)) ? e.tags.join(' ') : '');
      const esc = (w) => String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + words.filter(Boolean).map(esc).join('|') + ')', 'iu');
      return re.test(text);
    },
    // [{id, name, events}] for each locale tier, in the locale's order. An event with a tier the locale does not
    // list goes in the last group.
    groupByTier(events, tiers) {
      const groups = tiers.map((t) => ({ id: t.id, name: t.name, events: [] }));
      if (!groups.length) return groups;
      events.forEach((e) => {
        const g = groups.find((x) => x.id === e.tier) || groups[groups.length - 1];
        g.events.push(e);
      });
      return groups;
    },
    // Suggestions from the events recipe that are still new, point at an event that is in the feed and not
    // over, and are not already starred or hidden. -> [{suggestion, event, why}] by event date.
    suggested(suggestions, events, marks, today) {
      const byId = {};
      events.forEach((e) => { byId[e.id] = e; });
      const map = this.marksByEvent(marks);
      const out = [];
      (Array.isArray(suggestions) ? suggestions : []).forEach((s) => {
        if (!s || s.type !== 'suggestion' || s.deleted || s.recipe !== 'events' || s.kind !== 'event' || s.status !== 'new') return;
        const e = typeof s.target === 'string' ? byId[s.target] : null;
        if (!e || map[e.id] || !this.isUpcoming(e, today)) return;
        out.push({ suggestion: s, event: e, why: String(s.why || '') });
      });
      return out.sort((a, b) => {
        if (a.event.start !== b.event.start) return a.event.start < b.event.start ? -1 : 1;
        return a.suggestion.id < b.suggestion.id ? -1 : 1;
      });
    },
  },

  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    const tiers = (ctx.locale.events && Array.isArray(ctx.locale.events.tiers)) ? ctx.locale.events.tiers : [];
    let week = 'this';
    let showHidden = false;
    let asked = false;
    const shown = {}; // tier id -> how many rows
    const showAll = {}; // tier id -> true when the person asked to see every event, not just the matching ones

    function short(s) { return s.length > 60 ? s.slice(0, 57) + '...' : s; }

    // "Tue Oct 22, 6pm", or "Tue Oct 22, 6pm to 7:30pm" when it ends the same day.
    function when(e) {
      const a = ctx.fmt.dateTime(e.start, { now: ctx.now() });
      if (e.end && e.end.length > 10 && e.start.length > 10 && e.end.slice(0, 10) === e.start.slice(0, 10)) {
        return ctx.t('timeTo', { start: a, end: ctx.fmt.time(e.end) });
      }
      return a;
    }

    function saveMark(e, status) {
      ctx.store.put({ type: 'event-mark', id: logic.markId(e.id), eventId: e.id, status: status, copy: logic.copyOf(e) });
    }
    function star(e) {
      ctx.store.batch('Star event', () => saveMark(e, 'starred'));
      ctx.ui.toast(ctx.t('toStarred', { title: short(e.title) }), { undo: true });
    }
    function unstar(e) {
      ctx.store.batch('Remove star', () => ctx.store.remove(logic.markId(e.id)));
      ctx.ui.toast(ctx.t('toUnstarred', { title: short(e.title) }), { undo: true });
    }
    function dismiss(e) {
      ctx.store.batch('Hide event', () => saveMark(e, 'dismissed'));
      ctx.ui.toast(ctx.t('toHidden', { title: short(e.title) }), { undo: true });
    }
    function restore(e) {
      ctx.store.batch('Show event again', () => ctx.store.remove(logic.markId(e.id)));
      ctx.ui.toast(ctx.t('toShown', { title: short(e.title) }), { undo: true });
    }
    function take(item) {
      ctx.store.batch('Star suggested event', () => {
        saveMark(item.event, 'starred');
        ctx.store.put(Object.assign({}, item.suggestion, { status: 'taken' }));
      });
      ctx.ui.toast(ctx.t('toTaken', { title: short(item.event.title) }), { undo: true });
    }
    function putAway(item) {
      ctx.store.batch('Put a suggestion away', () => ctx.store.put(Object.assign({}, item.suggestion, { status: 'dismissed' })));
      ctx.ui.toast(ctx.t('toSuggestionOff'), { undo: true });
    }

    function button(test, label, fn) {
      return h('button', { type: 'button', 'data-test': test, on: { click: fn } }, label);
    }

    // The part every row shares: title, when, where, link.
    function details(e) {
      const where = [e.venue, e.address].filter(Boolean).join(', ');
      return [
        h('p', { class: 'events-when' }, when(e)),
        where ? h('p', { class: 'muted' }, where) : null,
        e.url ? h('p', {}, h('a', { href: e.url, 'data-test': 'events-link' }, ctx.t('listing'))) : null,
      ];
    }

    function eventRow(e, mode) { // mode: 'tier' | 'starred' | 'hidden'
      const buttons = h('div', { class: 'events-buttons' });
      if (mode === 'tier') {
        buttons.append(button('event-star', ctx.t('star'), () => star(e)), button('event-dismiss', ctx.t('dismiss'), () => dismiss(e)));
      } else if (mode === 'starred') {
        buttons.append(button('event-star', ctx.t('unstar'), () => unstar(e)));
      } else {
        buttons.append(button('event-restore', ctx.t('restore'), () => restore(e)));
      }
      ctx.renderSlot('event.actions', buttons, Object.assign({}, e));
      return h('li', { class: 'events-row', 'data-test': 'event-row', 'data-event-id': e.id, 'data-starred': mode === 'starred' ? 'true' : 'false' },
        h('h4', {}, e.title), details(e), buttons);
    }

    function suggestionRow(item) {
      const e = item.event;
      const why = item.why ? h('p', {}, ctx.t('why', { why: item.why })) : null;
      return h('li', { class: 'events-row', 'data-test': 'suggestion-row', 'data-event-id': e.id },
        h('h4', {}, e.title, h('span', { class: 'events-ai', 'data-test': 'events-ai-mark' }, ctx.t('fromAi'))),
        details(e), why,
        h('div', { class: 'events-buttons' },
          button('suggestion-take', ctx.t('take'), () => take(item)),
          button('suggestion-dismiss', ctx.t('notForMe'), () => putAway(item))));
    }

    function section(test, heading, intro) {
      return h('section', { class: 'events-section', 'data-test': test }, h('h3', {}, heading), intro ? h('p', { class: 'muted' }, intro) : null);
    }

    function sourceLine(data) {
      const day = data.generated ? ctx.fmt.date(logic.dayOf(data.generated), { now: ctx.now() }) : '';
      const base = day ? ctx.t(data.source === 'cache' ? 'sourceLive' : 'sourceSnapshot', { date: day }) : '';
      return [base, data.note].filter(Boolean).join(' ');
    }

    ctx.slot('tab', {
      id: 'events',
      label: ctx.t('tabLabel'),
      order: 30,
      render(el) {
        if (!asked) { asked = true; ctx.events.refresh(); } // does nothing unless live events are on
        const data = ctx.events.current();
        const today = logic.todayKey(ctx.now());
        const marks = ctx.store.all('event-mark');
        el.append(h('h2', {}, ctx.t('heading')));
        const src = sourceLine(data);
        if (src) el.append(h('p', { class: 'muted events-source', 'data-test': 'events-source' }, src));
        if (!data.events.length && !marks.length) el.append(h('p', { 'data-test': 'events-empty' }, ctx.t('emptyAll')));

        const sug = logic.suggested(ctx.store.all('suggestion'), data.events, marks, today);
        if (sug.length) {
          const sec = section('events-suggested', ctx.t('suggestedHeading'), ctx.t('suggestedIntro'));
          sec.append(h('ul', { class: 'events-list cols cols-sm' }, sug.map(suggestionRow)));
          el.append(sec);
        }

        const starred = logic.markedEvents(marks, data.events, 'starred', today);
        if (starred.length) {
          const sec = section('events-starred', ctx.t('starredHeading'));
          sec.append(h('ul', { class: 'events-list cols cols-sm' }, starred.map((e) => eventRow(e, 'starred'))));
          el.append(sec);
        }

        const lower = h('div', { class: 'events-lower' });
        const weeks = h('div', { class: 'events-weeks', role: 'group', 'aria-label': ctx.t('weekLabel') });
        const weekButtons = {};
        logic.WEEKS.forEach((w) => {
          weekButtons[w] = h('button', { type: 'button', 'data-test': 'events-week-' + w, 'aria-pressed': week === w ? 'true' : 'false',
            on: { click: () => {
              week = w;
              Object.keys(shown).forEach((k) => { delete shown[k]; });
              logic.WEEKS.forEach((x) => weekButtons[x].setAttribute('aria-pressed', x === w ? 'true' : 'false'));
              drawLower();
            } } }, ctx.t(w === 'this' ? 'weekThis' : (w === 'next' ? 'weekNext' : 'weekAll')));
          weeks.append(weekButtons[w]);
        });

        // The tier lists and the hidden list: drawn again by the week buttons, "Show more" and the hidden toggle
        // without redrawing the whole screen (so the focus stays on the week buttons).
        function drawLower() {
          lower.textContent = '';
          const groups = logic.groupByTier(logic.listed(data.events, marks, week, today), tiers);
          groups.forEach((g) => {
            const sec = section('events-tier-' + g.id, g.name);
            // A tier with `match` words shows only the events that match, unless the person asked for all of them.
            const tier = tiers.find((t) => t.id === g.id) || {};
            const all = g.events;
            if (Array.isArray(tier.match) && tier.match.length && all.length) {
              const few = all.filter((e) => logic.matchesWords(e, tier.match));
              if (few.length < all.length) {
                if (!showAll[g.id]) {
                  g.events = few;
                  sec.append(h('p', { class: 'muted', 'data-test': 'events-matched-' + g.id }, ctx.t('matchedOnly')));
                }
                sec.append(button('events-all-' + g.id,
                  showAll[g.id] ? ctx.t('matchShowFew') : ctx.t('matchShowAll', { n: all.length - few.length }),
                  () => { showAll[g.id] = !showAll[g.id]; delete shown[g.id]; drawLower(); }));
              }
            }
            if (!g.events.length) {
              sec.append(h('p', { class: 'muted' }, ctx.t('emptyTier')));
            } else {
              const n = shown[g.id] || logic.PAGE;
              sec.append(h('ul', { class: 'events-list cols cols-sm', 'aria-label': ctx.t('tierListLabel', { tier: g.name }) }, g.events.slice(0, n).map((e) => eventRow(e, 'tier'))));
              if (g.events.length > n) {
                sec.append(button('events-more-' + g.id, ctx.t('moreEvents'), () => { shown[g.id] = n + logic.PAGE; drawLower(); }));
              }
            }
            lower.append(sec);
          });
          const hidden = logic.markedEvents(marks, data.events, 'dismissed', today);
          if (hidden.length) {
            lower.append(button('events-hidden-toggle', showHidden ? ctx.t('hiddenHide') : ctx.t('hiddenShow', { n: hidden.length }),
              () => { showHidden = !showHidden; drawLower(); }));
            if (showHidden) {
              const sec = section('events-hidden', ctx.t('hiddenHeading'));
              sec.append(h('ul', { class: 'events-list cols cols-sm' }, hidden.map((e) => eventRow(e, 'hidden'))));
              lower.append(sec);
            }
          }
        }
        drawLower();
        el.append(weeks, lower);
      },
    });
  },
});
