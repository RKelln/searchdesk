// English interface strings (one table), t(), and date helpers (DESIGN 13).
window.Desk = window.Desk || {};
(function () {
  var Desk = window.Desk;

  // Core strings. Later tasks add more. Words are plain, about grade 6.
  Desk.strings = Desk.strings || {};
  var core = {
    dayNames: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
    monthNames: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
    am: 'am',
    pm: 'pm',
    today: 'today',
    tomorrow: 'tomorrow',
    yesterday: 'yesterday',
    inDays: 'in {n} days',
    daysLate: '{n} days late',
    daysAgo: '{n} days ago',
    notSaving: 'This browser is not saving. Save a copy before you close it.',
    // shell (T1.5)
    menuLabel: 'Main menu',
    skipToContent: 'Skip to the main part',
    tabAi: 'AI helper',
    tabData: 'Data',
    stubNotBuilt: 'This part is not built yet.',
    stubBroken: 'Something went wrong while starting this part. The rest of the app still works.',
    screenError: 'This part could not be shown. The rest of the app still works.',
    slotError: 'One block here could not be shown.',
    actionFailed: 'That did not work. Try again.',
    undo: 'Undo',
    undone: 'Undone.',
    ok: 'OK',
    cancel: 'Cancel',
    workshopBanner: 'Practice computer: use the made-up person only.',
    dataHeading: 'Your data',
    dataSoon: 'Saving, sharing and backups will be here soon.',
    lastChange: 'Last change: {label}',
    lastChangeNone: 'The last change',
    undoLast: 'Undo the last change',
    ideasHeading: 'Ideas you could build',
    ideasIntro: 'These parts are not built yet. You could build one with your coding helper.',
    aiHeading: 'AI helper',
    aiSoon: 'The AI helper will be here soon.',
    selftestHeading: 'Self-test',
    selftestSoon: 'The self-test will be here soon.',
    'base.home.name': 'Today',
    'base.home.purpose': 'See what needs you today: follow-ups, interviews and closing dates.',
    'base.jobs.name': 'Jobs',
    'base.jobs.purpose': 'Keep track of the jobs you want or have applied for.',
    'base.profile.name': 'About me',
    'base.profile.purpose': 'Say what you do and what you look for. You choose what the AI sees.',
    'base.events.name': 'Events',
    'base.events.purpose': 'Find hiring events and job fairs, and star the ones you like.',
    'base.help.name': 'Free help',
    'base.help.purpose': 'People who help with a job search for free.',
    'base.recipe-events.name': 'AI: events worth going to',
    'base.recipe-events.purpose': 'Ask a free AI chat which events fit you.',
    'base.recipe-posting.name': 'AI: turn a posting into a job',
    'base.recipe-posting.purpose': 'Paste a job posting and get a job ready to save.',
    'base.recipe-coach.name': 'AI: practise an interview',
    'base.recipe-coach.purpose': 'Practise interview questions with a free AI chat.'
  };
  Object.keys(core).forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(Desk.strings, k)) Desk.strings[k] = core[k];
  });

  var has = function (o, k) { return o && Object.prototype.hasOwnProperty.call(o, k); };

  // Replace {name} with vars.name in one pass. A name with no value stays as written.
  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{([A-Za-z0-9_]+)\}/g, function (m, k) {
      return has(vars, k) && vars[k] !== null && vars[k] !== undefined ? String(vars[k]) : m;
    });
  }

  // t(key, vars): the core table; if the key is missing, the key itself is shown.
  function t(key, vars) {
    var s = has(Desk.strings, key) && typeof Desk.strings[key] === 'string' ? Desk.strings[key] : key;
    return fill(s, vars);
  }

  // makeT(table): a t() that looks in a feature's own table first, then the core table, then shows the key.
  function makeT(table) {
    return function (key, vars) {
      if (has(table, key) && typeof table[key] === 'string') return fill(table[key], vars);
      return t(key, vars);
    };
  }

  Desk.t = t;
  Desk.makeT = makeT;

  // ---- Dates -------------------------------------------------------------------------------
  // Records store dates as 'YYYY-MM-DD' (no time, never shifted by time zone) and times as ISO
  // timestamps (shown in the person's local time). Date objects and millisecond numbers also work.

  function list(key) { return t(key).split(','); }

  // -> { y, m (1-12), d, hour, min, hasTime } or null
  function parse(value) {
    var m;
    if (typeof value === 'string') {
      m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      if (m) {
        var y = +m[1], mo = +m[2], d = +m[3];
        var chk = new Date(Date.UTC(y, mo - 1, d));
        if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
        return { y: y, m: mo, d: d, hour: 0, min: 0, hasTime: false };
      }
    }
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    var dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt.getTime())) return null;
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(),
             hour: dt.getHours(), min: dt.getMinutes(), hasTime: true };
  }

  function dayNumber(p) { return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000); }

  // "Tue Oct 22". Adds the year ("Tue Oct 22, 2027") when opts.now is given and the year differs.
  function fmtDate(value, opts) {
    var p = parse(value);
    if (!p) return '';
    var wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    var s = list('dayNames')[wd] + ' ' + list('monthNames')[p.m - 1] + ' ' + p.d;
    var np = opts && opts.now !== undefined ? parse(opts.now) : null;
    if (np && np.y !== p.y) s += ', ' + p.y;
    return s;
  }

  // "6pm", "6:30pm", "12am". Empty for a date with no time.
  function fmtTime(value) {
    var p = parse(value);
    if (!p || !p.hasTime) return '';
    var h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
    var mm = p.min ? ':' + (p.min < 10 ? '0' : '') + p.min : '';
    return h12 + mm + (p.hour < 12 ? t('am') : t('pm'));
  }

  // "Tue Oct 22, 6pm"; just the date when there is no time.
  function fmtDateTime(value, opts) {
    var d = fmtDate(value, opts), tm = fmtTime(value);
    return tm ? d + ', ' + tm : d;
  }

  // Whole calendar days from now to value: 0 today, 1 tomorrow, -1 yesterday. null if either is bad.
  function daysFrom(value, now) {
    var p = parse(value), n = parse(now === undefined ? new Date() : now);
    return p && n ? dayNumber(p) - dayNumber(n) : null;
  }

  // "today", "tomorrow", "yesterday", "in 3 days", "2 days late".
  // opts.past = 'ago' gives "2 days ago" for things that are not deadlines.
  function fmtRelative(value, now, opts) {
    var n = daysFrom(value, now);
    if (n === null) return '';
    if (n === 0) return t('today');
    if (n === 1) return t('tomorrow');
    if (n === -1) return t('yesterday');
    var ago = opts && opts.past === 'ago';
    if (n > 1) return t('inDays', { n: n });
    return t(ago ? 'daysAgo' : 'daysLate', { n: -n });
  }

  Desk.fmtDate = fmtDate;
  Desk.fmtTime = fmtTime;
  Desk.fmtDateTime = fmtDateTime;
  Desk.daysFrom = daysFrom;
  Desk.fmtRelative = fmtRelative;
})();
