// features/recipe-events.js  (T3.4, DESIGN 9.6) Ask a free AI chat which events are worth going to.
//
// The question has the profile and two short lists: L1-L20 from the library tier and C21-C40 from the city tier.
// Choosing the rows (logic.pickRows), so the question stays small even when the city feed has about 1,000 events:
//   1. Leave out events that are over, that start after the next 21 days, or that the person already starred or hid
//      (event-mark records with eventId and status starred or dismissed; a deleted mark does not count).
//   2. Score each one by how many words of the profile ("What work" and "Field") appear in its title, tags and venue.
//   3. Per tier, keep the 20 best (score high to low, then earlier date, then title). Show them in date order.
//   Tier 'library' is L; every other tier is C.
// The answer is `L<n> | why`, `C<n> | why` and, at most 2 times, `NEW | title | https://... | why`.
// apply: L and C lines become `event` suggestions (target = the event id, which the Events "Suggested for you" lane
// matches; taking one stars the event, and that code is in features/events.js). NEW lines become `lead` suggestions
// whose target is {title, url} (nothing shows leads yet).
Desk.register({
  id: 'recipe-events',
  name: 'AI: events worth going to',
  purpose: 'Copies a question that makes an AI chat pick the events that fit your work, then reads the answer back.',
  types: [],
  strings: {
    title: 'Find events worth going to',
    blurb: 'A free AI chat picks the events that could help you meet people or learn something for your search.',
    needProfile: 'Add the kind of work you look for in About me, so the AI knows what to pick.',
    where: 'Events',
  },
  logic: {
    LIST_MAX: 20,
    DAYS: 21,
    VENUE_MAX: 40,
    QUOTA: { L: 4, C: 4, NEW: 2 },
    // Words that say nothing about the kind of work.
    STOP: ['and', 'the', 'for', 'with', 'work', 'job', 'jobs', 'all', 'any', 'new', 'entry', 'level', 'full', 'part',
      'time', 'looking', 'field', 'related', 'other', 'etc', 'new', 'from', 'that', 'this', 'are', 'you', 'who'],
    // TEMPLATE: plain text anyone may change. {profile}, {quotaL}, {quotaC}, {quotaNew} and {items} are filled in.
    TEMPLATE: `Pick the events most likely to help this person meet people in their line of work, or learn something useful for finding work.
About the person:
{profile}
Pick up to {quotaL} from the L list and up to {quotaC} from the C list. A short list is better than a padded one.
For each pick, say the concrete connection to their situation.
You may add up to {quotaNew} lines starting with NEW for a real public place or programme that is not in the lists. Only do this if you are certain, and only with its exact https address. If you are not sure, add none.
{items}`,

    // 'YYYY-MM-DD' from 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM', else ''.
    dayOf(v) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v == null ? '' : v));
      return m ? m[0] : '';
    },
    // Local 'YYYY-MM-DD' of a Date or timestamp.
    todayKey(now) {
      const d = now instanceof Date ? now : new Date(now);
      const p = (n) => (n < 10 ? '0' : '') + n;
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    addDays(day, n) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
      if (!m) return '';
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
      return d.toISOString().slice(0, 10);
    },
    // The last day an event is on (its end day, or its start day when the end is missing or earlier).
    lastDay(e) {
      const s = this.dayOf(e && e.start), en = this.dayOf(e && e.end);
      return en && en >= s ? en : s;
    },
    // Ids of events that are starred or dismissed (a deleted mark does not count).
    markedIds(marks) {
      const out = {};
      (Array.isArray(marks) ? marks : []).forEach((m) => {
        if (m && m.type === 'event-mark' && !m.deleted && m.eventId && (m.status === 'starred' || m.status === 'dismissed')) out[m.eventId] = true;
      });
      return out;
    },
    // Lowercase words of 3 or more letters, without the stop words and with a trailing "s" cut ("clerks" -> "clerk").
    words(text) {
      const seen = {}, out = [];
      String(text == null ? '' : text).toLowerCase().split(/[^a-zÀ-ɏ]+/).forEach((w) => {
        if (w.length < 3 || this.STOP.indexOf(w) >= 0) return;
        const s = w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;
        if (!seen[s]) { seen[s] = true; out.push(s); }
      });
      return out;
    },
    // How many of the profile's words appear in the event's title, tags and venue.
    fit(e, profileWords) {
      if (!profileWords.length) return 0;
      const hay = this.words([e.title, (e.tags || []).join(' '), e.venue].join(' '));
      return profileWords.filter((w) => hay.indexOf(w) >= 0).length;
    },
    // events: ctx.events.current().events; marks: event-mark records; profile: {roles, field}; today: 'YYYY-MM-DD'.
    // -> {L: [events], C: [events]}, each at most LIST_MAX, in date order.
    pickRows(events, marks, profile, today, opts) {
      const o = opts || {}, max = o.max || this.LIST_MAX, days = o.days || this.DAYS;
      const last = this.addDays(today, days - 1), marked = this.markedIds(marks);
      const p = profile || {}, pw = this.words((p.roles || '') + ' ' + (p.field || ''));
      const cmp = (a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.title !== b.title ? (a.title < b.title ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const pool = { L: [], C: [] }, seen = {};
      (Array.isArray(events) ? events : []).forEach((e) => {
        if (!e || !e.id || !e.title || !this.dayOf(e.start) || seen[e.id] || marked[e.id]) return;
        if (this.lastDay(e) < today || this.dayOf(e.start) > last) return;
        seen[e.id] = true;
        pool[e.tier === 'library' ? 'L' : 'C'].push({ e: e, score: this.fit(e, pw) });
      });
      const out = {};
      Object.keys(pool).forEach((k) => {
        const best = pool[k].sort((a, b) => b.score - a.score || cmp(a.e, b.e)).slice(0, max).map((x) => x.e);
        out[k] = best.sort(cmp);
      });
      return out;
    },
    // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM'.
    dateCell(e) {
      const s = String(e.start || '');
      return s.length > 10 ? s.slice(0, 10) + ' ' + s.slice(11, 16) : s.slice(0, 10);
    },
    row(e) {
      const v = String(e.venue || '').replace(/\s+/g, ' ').trim();
      const venue = v.length > this.VENUE_MAX ? v.slice(0, this.VENUE_MAX - 1).trim() + '…' : v;
      return { id: e.id, cols: [this.dateCell(e), e.title, venue] };
    },
    // The data the recipe gives core. -> {items: {header, kinds: {L: rows, C: rows}}, quotaL, quotaC, quotaNew}
    build(events, marks, profile, today, opts) {
      const picked = this.pickRows(events, marks, profile, today, opts);
      return {
        quotaL: this.QUOTA.L, quotaC: this.QUOTA.C, quotaNew: this.QUOTA.NEW,
        items: { header: 'alias | date | title | venue', kinds: { L: picked.L.map((e) => this.row(e)), C: picked.C.map((e) => this.row(e)) } },
      };
    },
    // Accepted lines (Desk.reply.parse) -> suggestions. L and C: an event suggestion pointing at the event id.
    // NEW: a lead suggestion with {title, url}.
    suggestions(accepted) {
      const out = [];
      (accepted || []).forEach((a) => {
        const f = a.fields || {};
        if (a.kind === 'NEW') {
          out.push({ kind: 'lead', target: { title: f.title || '', url: f.url || '' }, why: f.why || '', marks: a.marks || [] });
        } else if (a.alias && a.id) {
          out.push({ kind: 'event', alias: a.alias, target: a.id, why: f.why || '', marks: a.marks || [] });
        }
      });
      return out;
    },
  },
  mount(ctx) {
    const L = this.logic;
    const today = (c) => L.todayKey(c.now());
    const eventsNow = () => {
      try { return (ctx.events.current().events) || []; } catch (e) { return []; }
    };
    ctx.recipe({
      id: 'events',
      title: ctx.t('title'),
      blurb: ctx.t('blurb'),
      where: ctx.t('where'),
      template: L.TEMPLATE,
      placeholders: {
        profile: 'what you chose to share in About me',
        quotaL: 'how many library events to pick',
        quotaC: 'how many city events to pick',
        quotaNew: 'how many new places the AI may add',
        items: 'the events list',
      },
      needs(c) {
        const p = c.profile() || {};
        return (p.roles && String(p.roles).trim()) || (p.field && String(p.field).trim()) ? [] : [{ text: ctx.t('needProfile'), go: 'profile' }];
      },
      data(c) {
        return L.build(eventsNow(), c.store.all('event-mark'), c.profile(), today(c));
      },
      answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] },
      example: 'L1 | why this one fits, in one sentence',
      quota: L.QUOTA,
      kind: 'event',
      titles(c, prompt) {
        const byId = {};
        eventsNow().forEach((e) => { byId[e.id] = e.title; });
        const out = {};
        Object.keys((prompt && prompt.aliases) || {}).forEach((a) => {
          const id = prompt.aliases[a];
          if (byId[id]) out[id] = byId[id];
        });
        return out;
      },
      apply(result) { return L.suggestions(result.accepted); },
    });
  },
});
