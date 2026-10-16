// AI reply parser; pure. DESIGN 9.4. No DOM, no clock, no randomness.
//
//   Desk.reply.parse(text, context) -> result
//
// context (all optional except what the recipe needs):
//   recipe    'events'              which recipe asked; used to pick "the newest prompt" when the code is missing
//   prompts   [{code, recipe, aliases: {L3: '<event id>'}}]   stored prompt records, NEWEST FIRST. `code` may be
//             'DESK-7Q3K' or '7Q3K'.
//   titles    {'<event id>': 'Title'}   for exact-title matching (rule 7)
//   answer    {L:['why'], C:['why'], NEW:['title','url','why']}   line kinds and their fields, as in the recipe.
//             A one-letter key is an alias kind; any other key is a keyword kind (NEW, TITLE, ORG ...).
//             Or the string 'text': take the code block's text whole (DESIGN 9.11).
//   required  {NEW:['title','url']}   fields that must be present. Default: for keyword kinds, fields named
//             title or value, and url fields; alias kinds have none.
//   quota     {L:4, C:4, NEW:2}   first N kept per kind, the rest dropped silently (counted in `dropped`)
//   synonyms  {CLOSES:['DEADLINE']}   extra keyword synonyms (a built-in table covers the posting fields)
//   types     {CLOSES:'date', url:'url'}   field types by kind name or field name; 'date' and 'url' are checked
//   example   'L1 | why ...'   the example line from the question, so a pasted-back question is not read as an answer
//   now       'YYYY-MM-DD'   today, only to give a year to dates like "Nov 2" (without it they become unknown).
//             A yearless date at most 31 days in the past is this year; further in the past it is next year only if
//             that is within 183 days ahead (a closing date), else unknown (marked 'date-unknown').
//
// result:
//   code            the code found in the text ('DESK-7Q3K'), or null
//   codeStatus      'found' (the newest prompt), 'older' (an older stored prompt), 'missing' (no code; the
//                   newest matching prompt was used), 'unknown' (a code this page does not have; nothing parsed),
//                   'other' (the code belongs to a prompt of a different recipe than context.recipe; nothing is
//                   imported and one rejected entry, code 'other-task', says so)
//   promptCode      the stored prompt's code that was used, or null
//   promptRecipe    only with codeStatus 'other': the recipe of the prompt the code belongs to
//   accepted[]      {kind, alias, id, fields, marks[], line}; alias kinds carry `fields.why`, `score` for old JSON.
//                   marks: 'name' (matched by title), 'http' (link is not https), 'date-unknown' (text kept in
//                   `unknown`). For answer 'text': one {kind:'TEXT', text, summary}.
//   rejected[]      {line, reason, code}   reason is a plain sentence; code is a stable key for the string table.
//                   At most 50 are kept; `rejectedMore` (present only when above 0) counts the rest.
//   ignored         count of prose lines that were not answer lines
//   dropped         count of lines dropped silently (duplicates, over quota)
//   looksLikeQuestion  true when the question itself was pasted back
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var R = Desk.reply = Desk.reply || {};
  var MAX_FIELD = 300;
  var MAX_REJECTED = 50;
  var MAX_GLUE = 1000;   // a record is not extended past this many characters of wrapped lines

  var BUILTIN_SYNONYMS = {
    TITLE: ['JOB TITLE', 'ROLE', 'POSITION'],
    ORG: ['COMPANY', 'EMPLOYER', 'ORGANISATION', 'ORGANIZATION'],
    WHERE: ['LOCATION', 'PLACE'],
    CLOSES: ['DEADLINE', 'APPLY BY', 'CLOSING DATE', 'CLOSE DATE'],
    PAY: ['SALARY', 'WAGE', 'WAGES'],
    'AI-SCREENING': ['AI SCREENING', 'AI_SCREENING'],
    ASKS: ['REQUIREMENTS', 'REQUIRES'],
  };
  var BUILTIN_TYPES = { CLOSES: 'date', url: 'url', link: 'url' };

  // ---- small helpers ---------------------------------------------------------------------------------------------
  function normalise(text) {
    var s = String(text == null ? '' : text);
    try { s = s.normalize('NFKC'); } catch (e) { /* old engine: keep as is */ }
    return s.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      .replace(/[\u00A0\u202F\u2007]/g, ' ').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\r\n?|\u2028|\u2029/g, '\n');
  }
  function lightNormalise(text) { // for answer 'text': keep the characters, only fix line ends and invisibles
    return String(text == null ? '' : text).replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\r\n?|\u2028|\u2029/g, '\n');
  }
  function stripControl(s) { return s.replace(/\t/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cap(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '\u2026' : s; }
  function words(s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function bareCode(c) { return String(c || '').toUpperCase().replace(/^\s*DESK[\s-]*/, '').replace(/\s+/g, ''); }

  // Leading decoration of an answer line: blockquote marks, bullets, emoji, arrows, check marks, keycap digits.
  var PICT = '\\p{Extended_Pictographic}\\uFE0F\\u200D\\u20E3\\u2190-\\u21FF\\u2300-\\u23FF\\u25A0-\\u25FF\\u2600-\\u27BF\\u2B00-\\u2BFF';
  var LEAD_RE = new RegExp('^(?:\\s+|>|[-*\\u2022\\u2023\\u25AA\\u25E6](?=\\s)|[0-9#*]\\uFE0F?\\u20E3|[' + PICT + '])+', 'u');
  var PICT_AFTER_RE = new RegExp('^[ \\t]*(?:[0-9#*]\\uFE0F?\\u20E3|[' + PICT + '])+[ \\t]*', 'u');

  // ---- codes -------------------------------------------------------------------------------------------------------
  // Candidates: every "DESK-XXXX" in the text. Returns [{raw, bare, idx, lineIdx?}] in text order.
  function findCodes(text) {
    var re = /(DESK)([\s_\-\u2013\u2014]*)([0-9A-Za-z]{4})(?![0-9A-Za-z])/gi, m, out = [];
    while ((m = re.exec(text))) {
      var bare = m[3].toUpperCase();
      if (/^(?:19|20)\d\d$/.test(bare)) continue; // a year is never a code
      // "desk-work" or "desk 2026" in prose is not a code: without an upper-case DESK it needs a digit, and either
      // the dash form or a token with both a letter and a digit
      if (m[1] !== 'DESK') {
        if (!/[0-9]/.test(bare)) continue;
        if (!/-/.test(m[2]) && /^[0-9]+$/.test(bare)) continue;
      }
      out.push({ bare: bare, idx: m.index });
    }
    return out;
  }
  // Match a pasted code to a stored one: exact, else the one stored code that differs only where the pasted
  // character is one that can never occur in a code (0 1 O I L U), a typing slip with one certain meaning.
  function matchPrompt(bare, prompts) {
    var i, hit = null;
    for (i = 0; i < prompts.length; i++) if (bareCode(prompts[i].code) === bare) return { index: i, prompt: prompts[i] };
    for (i = 0; i < prompts.length; i++) {
      var c = bareCode(prompts[i].code);
      if (c.length !== bare.length) continue;
      var ok = true;
      for (var k = 0; k < c.length; k++) if (c[k] !== bare[k] && !/[01OILU]/.test(bare[k])) { ok = false; break; }
      if (ok) { if (hit) return null; hit = { index: i, prompt: prompts[i] }; }
    }
    return hit;
  }

  // ---- dates -------------------------------------------------------------------------------------------------------
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function monthOf(tok) {
    tok = tok.toLowerCase().replace(/\.$/, '');
    if (tok === 'sept') return 9;
    if (tok.length < 3) return 0;
    for (var i = 0; i < 12; i++) if (MONTHS[i].indexOf(tok) === 0) return i + 1;
    return 0;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function validYMD(y, m, d) {
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  var WEEKDAY = /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i;
  var TIME_TAIL = /(?:\s*(?:,|\bat\b|@)\s*|\s+)(?:\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)(?:\s*(?:[A-Z]{2,4}|[+-]\d{2}:?\d{2}))?$/i;
  // -> {value:'YYYY-MM-DD'} | {empty:true} | {unknown:true}
  function parseDate(text, now) {
    var t = String(text).trim().replace(/[.,;]+$/, ''), m;
    if (!t || /^(unknown|not stated|not given|n\/a|na|none|tbd|tba|-|\u2013|\u2014|ongoing|rolling|open)$/i.test(t)) return { empty: true };
    var ny = null, nm = null, nd = null;
    if (now && (m = /^(\d{4})-(\d{2})-(\d{2})/.exec(now))) { ny = +m[1]; nm = +m[2]; nd = +m[3]; }
    function dayNo(y2, mo, d) { return Math.round(Date.UTC(y2, mo - 1, d) / 86400000); }
    function withYear(mo, d, y) {
      if (!y) {
        if (ny === null) return { unknown: true };
        // a date up to 31 days back is the most recent past one (last year too, around New Year); a date further
        // back is next year's only when that is within 183 days ahead; else unknown
        var today = dayNo(ny, nm, nd), cand = [ny - 1, ny, ny + 1], found = 0, ci;
        for (ci = 0; ci < cand.length && !found; ci++) {
          if (!validYMD(cand[ci], mo, d)) continue;
          var diff = dayNo(cand[ci], mo, d) - today;
          if (ci === 0 ? (diff >= -31 && diff < 0) : ci === 1 ? diff >= -31 : diff <= 183) found = cand[ci];
        }
        if (!found) return { unknown: true };
        y = found;
      } else if (y < 100) y += 2000;
      return validYMD(y, mo, d) ? { value: y + '-' + pad(mo) + '-' + pad(d) } : { unknown: true };
    }
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}.*)?$/.exec(t))) return withYear(+m[2], +m[3], +m[1]);
    // a trailing time ("Nov 2, 2026 at 5pm", "Nov 2 17:30") is dropped; so is a leading weekday ("Mon, Nov 2")
    t = t.replace(TIME_TAIL, '').replace(/[.,;]+$/, '').replace(WEEKDAY, '');
    if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s*(\d{4})?$/.exec(t)) && monthOf(m[2]))
      return withYear(monthOf(m[2]), +m[1], m[3] ? +m[3] : 0);
    if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/.exec(t)) && monthOf(m[1]))
      return withYear(monthOf(m[1]), +m[2], m[3] ? +m[3] : 0);
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/.exec(t))) {
      var a = +m[1], b = +m[2], y = m[3] ? +m[3] : 0;
      if (a > 12 && b <= 12) return withYear(b, a, y);
      if (b > 12 && a <= 12) return withYear(a, b, y);
    }
    return { unknown: true };
  }

  // ---- links -------------------------------------------------------------------------------------------------------
  // -> {url, http:bool} | {bad:true}
  function parseUrl(text) {
    var t = String(text).trim(), m;
    if ((m = /\[[^\]]*\]\(([^)\s]+)\)/.exec(t))) t = m[1];
    t = t.replace(/^<|>$/g, '').replace(/[.,;)\]]+$/, '');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(t) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(t)) t = 'https://' + t;
    if (!(m = /^(https?):\/\/([^\/?#]*)([\/?#]\S*)?$/i.exec(t))) return { bad: true };
    var auth = m[2];
    if (/@/.test(auth) || /\s/.test(t)) return { bad: true };
    // hygiene: only printable ASCII, none of the characters that are never safe in a link
    if (/[^\x21-\x7E]/.test(t) || /["<>\\^`{|}]/.test(t)) return { bad: true, why: 'chars' };
    var pm = /:(\d*)$/.exec(auth);
    if (pm && !(pm[1] && +pm[1] >= 1 && +pm[1] <= 65535)) return { bad: true, why: 'port' };
    var host = auth.replace(/:\d+$/, '');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) return { bad: true };
    if (/^\d+$/.test(host.split('.').pop())) return { bad: true }; // an IP address
    return { url: t, http: m[1].toLowerCase() === 'http' };
  }

  // ---- setting up ----------------------------------------------------------------------------------------------------
  function setup(context, prompt) {
    var c = context || {};
    var ans = c.answer && typeof c.answer === 'object' ? c.answer : {};
    var S = { ctx: c, letters: {}, kw: [], kwByName: {}, fields: {}, types: {}, required: {}, quota: c.quota || {}, now: c.now || '' };
    var k;
    for (k in BUILTIN_TYPES) S.types[k] = BUILTIN_TYPES[k];
    for (k in (c.types || {})) S.types[k] = c.types[k];
    var syn = {};
    for (k in BUILTIN_SYNONYMS) syn[k] = BUILTIN_SYNONYMS[k].slice();
    for (k in (c.synonyms || {})) syn[k.toUpperCase()] = (syn[k.toUpperCase()] || []).concat(c.synonyms[k]);
    var names = [];
    Object.keys(ans).forEach(function (key) {
      var fields = ans[key] && ans[key].length ? ans[key].slice() : ['why'];
      var up = key.toUpperCase();
      S.fields[up] = fields;
      if (/^[A-Za-z]$/.test(key)) { S.letters[up] = true; return; }
      var list = [up].concat(syn[up] || []);
      list.forEach(function (n) { n = n.toUpperCase(); names.push({ name: n, kind: up }); });
      var req = (c.required && c.required[key]) || fields.filter(function (f) {
        return f === 'title' || f === 'value' || fieldType(S, up, f) === 'url';
      });
      S.required[up] = req;
    });
    names.sort(function (a, b) { return b.name.length - a.name.length; });
    S.kw = names.map(function (n) {
      var src = n.name.split(/[\s_-]+/).map(esc).join('[ \\t_-]?');
      return { kind: n.kind, re: new RegExp('^' + src + '(?![A-Za-z0-9])', 'i') };
    });
    // prompt: alias lookup
    S.prompt = prompt || null;
    S.byNum = {}; S.byId = {}; S.byAlias = {}; S.titles = [];
    if (prompt && prompt.aliases) {
      Object.keys(prompt.aliases).forEach(function (a) {
        var m = /^([A-Za-z]+)(\d+)$/.exec(a); if (!m) return;
        var item = { alias: a.toUpperCase(), kind: m[1].toUpperCase(), n: +m[2], id: prompt.aliases[a] };
        S.byNum[item.n] = item; S.byAlias[item.alias] = item; S.byId[String(item.id).toUpperCase()] = item;
        var t = c.titles && c.titles[item.id];
        if (t) {
          var vs = [words(t)];
          if (String(t).length > 80) vs.push(words(String(t).slice(0, 80)));
          vs = vs.filter(function (v) { return v.length >= 12; });
          if (vs.length) S.titles.push({ item: item, variants: vs, title: String(t) });
        }
      });
    }
    S.minTitle = 12; S.maxTitle = 400;
    S.titles.forEach(function (t) { t.variants.forEach(function (v) { if (v.length * 3 + 100 > S.maxTitle) S.maxTitle = v.length * 3 + 100; }); });
    return S;
  }
  function fieldType(S, kind, field) {
    return S.types[kind + '.' + field] || S.types[field] || (field === 'value' && S.types[kind]) || '';
  }

  // ---- cleaning one line ---------------------------------------------------------------------------------------------
  function isTableSeparator(s) { return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s); }
  function clean(line) {
    var s = line.replace(LEAD_RE, '');
    // markup (**bold**, `code`, __x__) goes, but never inside a web address
    if (/[*`_]/.test(s)) s = s.replace(/(https?:\/\/\S+)|\*+|`+|__/gi, function (all, url) {
      if (!url) return '';
      var tail = /(?:[*`]+|__)+$/.exec(url);
      return tail && tail.index > 0 ? url.slice(0, tail.index) : url;
    });
    s = s.trim().replace(/^\|\s*/, '');
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1); // (not /\s*\|$/: quadratic on long runs of spaces)
    s = s.replace(LEAD_RE, '').trim();
    s = s.replace(/^\[([A-Za-z]?[ \t-]*\d{1,3})\]\([^)\s]*\)/, '$1');          // [L1](http://x.y) | why
    s = s.replace(/^#\d{1,3}\s+(?=[A-Za-z][ \t-]*\d)/, '');                      // "#1 L3 | why"; a list number
    var q = /^"(.*)"[,]?$/.exec(s); if (q && q[1].indexOf('"') < 0) s = q[1];
    return s;
  }

  // ---- recognising a record -------------------------------------------------------------------------------------------
  var SEP = /^(?:[ \t]*[|:\-\u2013\u2014][ \t]*|[ \t]*\t[ \t]*| {2,})/;
  function stripLead(s) { return s.replace(/^[\s|:\-\u2013\u2014]+/, ''); }

  // alias token at the start: returns {letter, num, rest} or null.
  // A bare number (no letter) counts only with "|", a tab or two or more spaces after it. `loose` (a JSON id) also
  // takes a bare number alone.
  var MULTI = /^\s*[&+,\/]\s*(?:[A-Za-z]-?\d|\d{1,3}\s*(?:[,&|+\/]|$))/;
  function aliasToken(S, s, depth, loose) {
    var m = /^[(\[#<]*[ \t]*(?:([A-Za-z])[ \t-]*)?0*(\d{1,3})(?![0-9A-Za-z])[)\]>]*\.?/.exec(s);
    if (!m) return null;
    var letter = m[1] ? m[1].toUpperCase() : '', num = parseInt(m[2], 10), rest = s.slice(m[0].length), sm;
    var pm = PICT_AFTER_RE.exec(rest);            // "L1 \u2705 | why": a symbol right after the alias
    if (pm) rest = ' ' + rest.slice(pm[0].length);
    sm = SEP.exec(rest);
    if (!sm && letter && S.letters[letter] && /^[ \t]+\S/.test(rest)) sm = [rest.match(/^[ \t]+/)[0]];
    if (!sm && /^\s*$/.test(rest)) { if (!letter && !loose) return null; sm = [rest]; }
    if (!sm) return letter && MULTI.test(rest) ? { multi: true } : null;
    var sep = sm[0];
    if (!letter && !loose && sep.indexOf('|') < 0 && sep.indexOf('\t') < 0 && !/^ {2,}$/.test(sep)) return null;
    var after = rest.slice(sep.length);
    if (letter) {
      // "L1-2 | both", "L1:30", "L1 & L3 | x": not one clear alias
      if (/^[\-\u2013\u2014]$/.test(sep) && /^\d/.test(after)) return { multi: true };   // L1-2
      if (/^[:]$/.test(sep) && /^\d/.test(after)) return null;                            // L1:30
      if (MULTI.test(' ' + after)) return { multi: true };
      after = after.replace(/^[+\/]\s+/, '');
    }
    rest = after;
    if (!letter && !(depth > 0)) { // a list number in front of a real alias ("1 | L3 | why")
      var inner = aliasToken(S, rest, 1);
      if (inner && inner.letter) return inner;
    }
    return { letter: letter, num: num, rest: stripLead(rest) };
  }

  // An exact title counts only when it starts the text (after bullets, numbers, quotes, bold) or follows a short
  // label or separator ("Pick: <title> - why"). A title in the middle of prose is not a pick: "I would skip <title>".
  function titleAtStart(S, s) {
    if (!S.titles.length || s.length < S.minTitle) return null;   // (cheap exits keep a long paste fast)
    var body = s.replace(/^[^\p{L}\p{N}]+/u, '');
    if (body.length > S.maxTitle) body = body.slice(0, S.maxTitle);
    var n = ' ' + words(body) + ' ', hits = [];
    S.titles.forEach(function (t) {
      for (var i = 0; i < t.variants.length; i++) if (n.indexOf(' ' + t.variants[i] + ' ') === 0) { hits.push({ t: t, v: t.variants[i] }); return; }
    });
    if (hits.length !== 1) return null;
    var re = new RegExp('^' + hits[0].v.split(' ').map(esc).join('[^\\p{L}\\p{N}]+'), 'iu');
    var why = stripLead(body.replace(re, ' ').replace(/\s+/g, ' ').replace(/^[\s"',.()\[\]]+|[\s"',(\[]+$/g, ''));
    return { item: hits[0].t.item, why: why };
  }
  // a label that says no: "Skip: <title>", "Not for me - <title>"
  var NEGATIVE = /^\W*(?:skip|avoid|not|no|nope|pass|ignore|exclude|drop|reject|remove|never|worst|bad|don'?t|do not|cannot|can'?t|won'?t|would not|wouldn'?t|least)\b/i;
  function lineTitleMatch(S, s) {
    var r = titleAtStart(S, s);
    if (r) return r;
    var m = /^[^|:\u2013\u2014]{1,25}?(?:[:|\u2013\u2014]|\s-\s)\s*/.exec(s);
    if (m && NEGATIVE.test(m[0])) return null;
    return m ? titleAtStart(S, s.slice(m[0].length)) : null;
  }

  // The reason after the item's own title: "Resume Help for Newcomers | Great" -> "Great"; also "(Title) | Great".
  function stripOwnTitle(S, item, rest) {
    var t = S.ctx.titles && S.ctx.titles[item.id], w = t ? words(t) : '';
    if (!w) return rest;
    var re = new RegExp('^[(\\[\\s"\']*' + w.split(' ').map(esc).join('[^\\p{L}\\p{N}]+') +
      '[)\\]"\'\\s]*?(?:[ \\t]*\\t[ \\t]*|[ \\t]*[|:\\u2013\\u2014-][ \\t]*| {2,}|[ \\t]*$)', 'iu');
    var m = re.exec(rest);
    return m ? stripLead(rest.slice(m[0].length)) : rest;
  }
  // The reason for a known item: from the column a header row named, else after the item's own title.
  function whyFor(S, item, rest) {
    if (S.hdr && S.hdr.why > 0) {
      var cells = rest.split('|'), at = S.hdr.why - 1;
      if (S.hdr.last) return cells.slice(at).join('|').trim();
      return (cells[at] || '').trim();
    }
    return stripOwnTitle(S, item, rest);
  }
  var HEAD_ALIAS = /^(?:alias|id|ref|code|no|number|pick|item)$/;
  var HEAD_WHY = /^(?:why|reason|reasons|because|note|notes|comment|comments|fit|rationale)$/;
  var HEAD_OTHER = /^(?:event|events|title|name|date|venue|where|when|org|organisation|organization|type|link|url|tier|score)$/;
  // "Alias | Event | Why": a header row that names its columns -> {why: column index, last: it is the last column}
  function tableHeader(cleaned) {
    var cells = cleaned.split('|').map(function (c) { return c.trim().toLowerCase().replace(/[^a-z# ]/g, '').replace(/^#$/, 'no'); });
    if (cells.length < 2 || cells.length > 8) return null;
    var why = -1, i;
    for (i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (HEAD_WHY.test(c)) { if (why < 0) why = i; }
      else if (!HEAD_OTHER.test(c) && !HEAD_ALIAS.test(c)) return null;
    }
    if (why < 0 || !HEAD_ALIAS.test(cells[0])) return null;
    return { why: why, last: why === cells.length - 1 };
  }

  // -> null (not a record) | {bad:true, reason, code} | {rec, short}
  function parseRecord(S, cleaned) {
    var s = cleaned, i, m;
    if (!s) return null;
    // keyword kinds
    for (i = 0; i < S.kw.length; i++) {
      m = S.kw[i].re.exec(s);
      if (!m) continue;
      var rest = s.slice(m[0].length), sm = SEP.exec(rest);
      if (!sm) continue;
      return keywordRecord(S, S.kw[i].kind, stripLead(rest.slice(sm[0].length)), s);
    }
    // alias kinds
    var hasLetters = Object.keys(S.letters).length;
    var tok = aliasToken(S, s, 0);
    if (!tok && /^\d{1,3}[.)]\s+/.test(s)) tok = aliasToken(S, s.replace(/^\d{1,3}[.)]\s+/, ''), 0);
    if (!tok && hasLetters) { // a short label in front: "Top pick: L1 | why", "Pick L1 | why"
      m = /^(?:(?:top\s+|my\s+|best\s+)?(?:pick|choice)s?\s+|[^|:]{1,25}:\s+)(?=\S)/i.exec(s);
      if (m && !NEGATIVE.test(m[0])) {
        var t2 = aliasToken(S, s.slice(m[0].length), 0);
        if (t2 && t2.letter && S.letters[t2.letter]) tok = t2;
      }
    }
    if (tok && tok.multi) return hasLetters ? { bad: true, reason: 'Give one item per line.', code: 'multi-alias' } : null;
    if (tok && hasLetters) {
      var item = S.byNum[tok.num];
      if (!S.prompt) return { bad: true, reason: 'This page has no question to match this answer to.', code: 'no-question' };
      if (!item) {
        var tm = lineTitleMatch(S, tok.rest);
        if (tm) return aliasRecord(S, tm.item, tm.why, ['name']);
        if (!tok.letter) return null; // a bare number that is not an item: prose
        return { bad: true, reason: (tok.letter || '') + tok.num + ' is not one of the items in the question.', code: 'unknown-alias' };
      }
      return aliasRecord(S, item, whyFor(S, item, tok.rest), []);
    }
    // no alias: an exact title at the start of the line
    if (hasLetters) {
      var t3 = lineTitleMatch(S, s.replace(/^\d{1,3}[.)]\s+/, ''));
      if (t3) return aliasRecord(S, t3.item, t3.why, ['name']);
    }
    return null;
  }

  function aliasRecord(S, item, whyText, marks) {
    var spec = S.fields[item.kind] || S.fields[Object.keys(S.letters)[0]] || ['why'];
    var fields = {};
    fields[spec[0]] = whyText;
    var v = validate(S, item.kind, spec, fields, marks.slice());
    if (v.bad) return v;
    return { rec: { kind: item.kind, alias: item.alias, id: item.id, fields: v.fields, marks: v.marks, unknown: v.unknown }, short: !whyText };
  }

  function keywordRecord(S, kind, rest, line) {
    var spec = S.fields[kind], parts = [], i, r = rest;
    for (i = 0; i < spec.length - 1; i++) {
      var p = r.indexOf('|');
      if (p < 0) break;
      parts.push(r.slice(0, p)); r = r.slice(p + 1);
    }
    parts.push(r);
    var fields = {};
    // salvage: "NEW: Title - https://..." with no pipes, when a link field is wanted
    var urlIdx = -1;
    spec.forEach(function (f, j) { if (urlIdx < 0 && fieldType(S, kind, f) === 'url') urlIdx = j; });
    if (urlIdx > 0 && parts.length < urlIdx + 1) {
      var um = /(https?:\/\/\S+)/i.exec(rest);
      if (um) {
        parts = [];
        var before = rest.slice(0, um.index).replace(/[\s|:\-\u2013\u2014(\[]+$/, ''), after = stripLead(rest.slice(um.index + um[0].length).replace(/^[)\]]/, ''));
        for (i = 0; i < urlIdx - 1; i++) parts.push('');
        parts.push(before, um[1], after);
      }
    }
    spec.forEach(function (f, j) { fields[f] = (parts[j] || '').trim(); });
    var v = validate(S, kind, spec, fields, []);
    if (v.bad) return v;
    return { rec: { kind: kind, alias: null, id: null, fields: v.fields, marks: v.marks, unknown: v.unknown }, short: parts.length < spec.length };
  }

  // Step 9 for one record.
  function validate(S, kind, spec, fields, marks) {
    var out = {}, unknown = null, bad = null;
    spec.forEach(function (f) {
      var val = stripControl(String(fields[f] == null ? '' : fields[f])).replace(/\s+/g, ' ').trim();
      var ty = fieldType(S, kind, f);
      if (ty === 'date' && val) {
        var d = parseDate(val, S.now);
        if (d.value) val = d.value;
        else if (d.empty) val = '';
        else { unknown = unknown || {}; unknown[f] = val; val = ''; marks.push('date-unknown'); }
      } else if (ty === 'url' && val) {
        var u = parseUrl(val);
        if (u.bad) {
          bad = bad || { bad: true, code: 'bad-url', reason: u.why === 'chars' ? 'The web address has characters that cannot be in a link.'
            : u.why === 'port' ? 'The web address has a port number that is not valid.' : 'The web address has no usable host.' };
        }
        else { val = u.url; if (u.http) marks.push('http'); }
      } else {
        val = cap(val, MAX_FIELD);
      }
      out[f] = val;
    });
    if (bad) return bad;
    var req = S.required[kind] || [];
    for (var i = 0; i < req.length; i++) {
      if (!out[req[i]] && !(unknown && unknown[req[i]]) && fieldType(S, kind, req[i]) !== 'date') {
        return { bad: true, reason: 'A line is missing its ' + req[i] + '.', code: 'missing-field' };
      }
    }
    return { fields: out, marks: marks, unknown: unknown };
  }

  // ---- parsing a scope of lines (pipe lines) -------------------------------------------------------------------------
  // A line after a record is the rest of its reason only if it is indented, or starts with a lower-case letter or
  // continuation punctuation; anything else is prose around the answer.
  function continues(raw) {
    if (/^\s/.test(raw)) return true;
    if (/^[A-Za-z]-?\d{1,3}(?![0-9A-Za-z])/.test(raw)) return false; // looks like another alias
    if (/^[-\u2013\u2014]\s/.test(raw)) return false;            // a bullet
    return /^[a-z,;:\u2013\u2014(-]/.test(raw);
  }
  function parsePipeLines(S, lines) {
    var units = [], ignored = 0, afterBlank = true;
    lines.forEach(function (raw) {
      if (!raw.trim()) { afterBlank = true; return; }
      if (isTableSeparator(raw.trim())) return;
      var cleaned = clean(raw);
      if (!cleaned) return;
      var hdr = tableHeader(cleaned);
      if (hdr) { S.hdr = hdr; ignored++; afterBlank = false; return; }
      var r = parseRecord(S, cleaned);
      if (r) { units.push({ raw: raw.trim(), cleaned: cleaned, res: r }); afterBlank = false; return; }
      var prev = units[units.length - 1];
      if (prev && !afterBlank) {
        var open = prev.res.bad || prev.res.short, cand, k, r2;
        if (prev.cleaned.length > MAX_GLUE) { /* long enough: more lines are prose (keeps this linear) */ }
        else if (open) {
          for (k = 0; k < 2; k++) {
            cand = prev.cleaned + (k ? ' ' : '') + cleaned;
            r2 = parseRecord(S, cand);
            if (r2 && !r2.bad && !r2.short) { prev.cleaned = cand; prev.raw += ' / ' + raw.trim(); prev.res = r2; return; }
          }
        } else if (continues(raw) && (!/[.!?)"']$/.test(prev.cleaned) || /^\s/.test(raw))) {
          cand = prev.cleaned + ' ' + cleaned;
          r2 = parseRecord(S, cand);
          if (r2 && !r2.bad) { prev.cleaned = cand; prev.raw += ' / ' + raw.trim(); prev.res = r2; return; }
        }
      }
      ignored++; afterBlank = false;
    });
    return { units: units, ignored: ignored };
  }

  // ---- old JSON format -------------------------------------------------------------------------------------------------
  // Finds top-level {...} spans (strings respected). -> [{text, start, end}]
  function jsonSpans(text) {
    var out = [], i = 0, n = text.length;
    while (i < n) {
      if (text[i] !== '{') { i++; continue; }
      var depth = 0, inStr = false, j = i, closed = false;
      for (; j < n; j++) {
        var ch = text[j];
        if (inStr) { if (ch === '\\') j++; else if (ch === '"') inStr = false; }
        else if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { closed = true; break; } }
      }
      if (!closed) { out.push({ text: text.slice(i), start: i, end: n, open: true }); break; }
      out.push({ text: text.slice(i, j + 1), start: i, end: j + 1 });
      i = j + 1;
    }
    return out;
  }
  function tryJson(t) {
    var variants = [t, t.replace(/,\s*([}\]])/g, '$1')];
    // a hard line break inside a string (a split URL): join with nothing, then with a space
    var inStrFix = function (sep) {
      var o = '', inStr = false;
      for (var i = 0; i < t.length; i++) {
        var ch = t[i];
        if (inStr && ch === '\\') { o += ch + (t[i + 1] || ''); i++; continue; }
        if (ch === '"') inStr = !inStr;
        if (inStr && ch === '\n') { o += sep; continue; }
        o += ch;
      }
      return o.replace(/,\s*([}\]])/g, '$1');
    };
    variants.push(inStrFix(''), inStrFix(' '));
    for (var i = 0; i < variants.length; i++) {
      try { var v = JSON.parse(variants[i]); if (v && typeof v === 'object') return v; } catch (e) { /* next */ }
    }
    return null;
  }
  function resolveRef(S, ref) {
    if (ref == null) return null;
    var s = String(ref).trim(), up = s.toUpperCase();
    if (S.byId[up]) return S.byId[up];
    if (S.byAlias[up]) return S.byAlias[up];
    var tok = aliasToken(S, s, 0, true);
    if (tok && !tok.rest && S.byNum[tok.num]) return S.byNum[tok.num];
    return null;
  }
  function parseJsonSpans(S, text, spans) {
    var units = [], covered = 0;
    spans.forEach(function (sp) {
      var raw = sp.text.replace(/\s+/g, ' ').trim(), o = sp.open ? null : tryJson(sp.text);
      if (!o) { units.push({ raw: raw, res: { bad: true, reason: 'This line is cut off or is not written correctly.', code: 'unreadable' } }); return; }
      var t = String(o.t || o.type || '').toLowerCase();
      if (t === 'check') { units.push({ raw: raw, skip: true }); return; }
      if (t === 'new' || (!t && o.title && o.url)) {
        var spec = S.fields.NEW || ['title', 'url', 'why'], f = {};
        spec.forEach(function (n) { f[n] = o[n] != null ? o[n] : (n === 'why' ? (o.reason || o.text || '') : ''); });
        var v = validate(S, 'NEW', spec, f, []);
        units.push({ raw: raw, res: v.bad ? v : { rec: { kind: 'NEW', alias: null, id: null, fields: v.fields, marks: v.marks, unknown: v.unknown } } });
        return;
      }
      if (t === 'pick' || !t) {
        var ref = o.id != null ? o.id : (o.alias != null ? o.alias : (o.ref != null ? o.ref : o.event));
        if (ref == null && !t) { units.push({ raw: raw, skip: true }); return; }
        var item = resolveRef(S, ref);
        if (!item) { units.push({ raw: raw, res: { bad: true, reason: 'That item is not in the question.', code: 'unknown-alias' } }); return; }
        var res = aliasRecord(S, item, o.reason != null ? o.reason : (o.why != null ? o.why : (o.text || '')), []);
        if (!res.bad && o.score != null) res.rec.score = o.score;
        units.push({ raw: raw, res: res });
        return;
      }
      units.push({ raw: raw, skip: true });
    });
    return { units: units };
  }

  // ---- one scope -> accepted/rejected --------------------------------------------------------------------------------------
  function parseScope(S, lines) {
    S.hdr = null;
    var joined = lines.join('\n'), result, ignored = 0;
    var spans = jsonSpans(joined).filter(function (sp) { return /"\s*(t|type|id|alias)\s*"\s*:/.test(sp.text) || sp.open; });
    var units;
    if (spans.length) {
      // JSON spans and the pipe lines around them are both read, in text order
      var json = parseJsonSpans(S, joined, spans).units, pos = 0;
      units = [];
      var around = function (from, to) {
        var seg = joined.slice(from, to).split('\n').filter(function (l) { return !/^[\s\[\],]*$/.test(l); });
        if (!seg.length) return;
        var pr = parsePipeLines(S, seg);
        units = units.concat(pr.units); ignored += pr.ignored;
      };
      spans.forEach(function (sp, k) { around(pos, sp.start); units.push(json[k]); pos = sp.end; });
      around(pos, joined.length);
    } else {
      result = parsePipeLines(S, lines);
      units = result.units; ignored = result.ignored;
    }
    var accepted = [], rejected = [], rejectedMore = 0, dropped = 0, seen = {}, counts = {};
    units.forEach(function (u) {
      if (u.skip) { ignored++; return; }
      var r = u.res;
      if (r.bad) {
        if (rejected.length < MAX_REJECTED) rejected.push({ line: cap(u.raw, 200), reason: r.reason, code: r.code }); else rejectedMore++;
        return;
      }
      var rec = r.rec, key = rec.alias ? rec.alias : 'N:' + (rec.fields.title || '') .toLowerCase() + '|' + (rec.fields.url || '') ;
      if (!rec.alias && !rec.fields.title) key = 'K:' + rec.kind;
      if (seen[key]) { dropped++; return; }
      var q = S.quota[rec.kind];
      counts[rec.kind] = (counts[rec.kind] || 0) + 1;
      if (q != null && counts[rec.kind] > q) { dropped++; return; }
      seen[key] = true;
      rec.line = cap(u.raw, 200);
      accepted.push(rec);
    });
    return { accepted: accepted, rejected: rejected, rejectedMore: rejectedMore, ignored: ignored, dropped: dropped };
  }

  // ---- fences ----------------------------------------------------------------------------------------------------------
  // -> [{start, end, lines}]  (start/end are line indexes of the fence lines; end = last line for an unclosed block)
  function findBlocks(lines) {
    var blocks = [], cur = null;
    lines.forEach(function (l, i) {
      var m = /^\s*(`{3,}|~{3,})(.*)$/.exec(l);
      if (!cur) {
        if (m) cur = { start: i, ch: m[1][0], len: m[1].length, lines: [] };
      } else if (m && m[1][0] === cur.ch && m[1].length >= cur.len && !m[2].trim()) {
        cur.end = i; blocks.push(cur); cur = null;
      } else cur.lines.push(l);
    });
    if (cur) { cur.end = lines.length; blocks.push(cur); }
    return blocks;
  }

  // ---- answer 'text' (DESIGN 9.11) ---------------------------------------------------------------------------------------
  function trimBlank(arr) {
    var a = 0, b = arr.length;
    while (a < b && !arr[a].trim()) a++;
    while (b > a && !arr[b - 1].trim()) b--;
    return arr.slice(a, b);
  }
  function parseTextAnswer(raw, codes, hasHeader) {
    var lines = lightNormalise(raw).split('\n'), norm = normalise(raw).split('\n');
    var headerAt = -1;
    if (hasHeader) for (var h = 0; h < norm.length; h++) if (/HOW TO ANSWER/i.test(norm[h])) { headerAt = h; break; }
    var from = headerAt + 1;
    var blocks = findBlocks(lines.slice(from)).map(function (b) { b.start += from; b.end += from; return b; });
    var codeRe = /DESK[\s_\-\u2013\u2014]*[0-9A-Za-z]{4}/i;
    var text = null, summary = '', afterIdx = -1, i;
    if (!blocks.length) {
      if (hasHeader) return { question: true };
      var ci = -1;
      for (i = 0; i < norm.length; i++) if (codeRe.test(norm[i])) { ci = i; break; }
      var body = trimBlank(lines.slice(ci + 1));
      var out = [];
      body.forEach(function (l) {
        var m = /^\s*(?:\*\*)?what changed(?:\*\*)?\s*[:\-\u2013\u2014]\s*(.*)$/i.exec(l);
        if (m) summary = m[1].trim(); else out.push(l);
      });
      text = trimBlank(out).join('\n');
    } else {
      var b = blocks[0];
      for (i = 0; i < blocks.length; i++) if (blocks[i].lines.some(function (l) { return codeRe.test(normalise(l)); })) { b = blocks[i]; break; }
      var inner = b.lines.slice();
      var ci2 = -1;
      for (i = 0; i < inner.length; i++) if (codeRe.test(normalise(inner[i]))) { ci2 = i; break; }
      if (ci2 >= 0 && ci2 < 3) inner = inner.slice(ci2 + 1);
      else if (ci2 < 0 && blocks.length > 1) { /* code outside blocks: take the longest block */
        b = blocks.slice().sort(function (x, y) { return y.lines.length - x.lines.length; })[0]; inner = b.lines.slice();
      }
      text = trimBlank(inner).join('\n');
      afterIdx = b.end;
      for (i = afterIdx + 1; i < lines.length; i++) {
        if (lines[i].trim()) { summary = lines[i].trim().replace(/^(?:[-*\u2022]\s+)?(?:\*\*)?what changed(?:\*\*)?\s*[:\-\u2013\u2014]\s*/i, ''); break; }
      }
      if (!summary) { // the line may sit inside the block, after the text
        var m2 = /\n\s*(?:\*\*)?what changed(?:\*\*)?\s*[:\-\u2013\u2014]\s*(.*)$/i.exec(text);
        if (m2) { summary = m2[1].trim(); text = text.slice(0, m2.index).replace(/\s+$/, ''); }
      }
    }
    text = stripControlKeepNewlines(text || '');
    return { text: text, summary: cap(stripControl(summary).trim(), MAX_FIELD) };
  }
  function stripControlKeepNewlines(s) { return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); }

  // ---- parse ------------------------------------------------------------------------------------------------------------------
  R.parse = function (text, context) {
    var c = context || {}, prompts = c.prompts || [];
    var raw = String(text == null ? '' : text);
    var isText = c.answer === 'text';
    var norm = normalise(raw);
    var result = { code: null, codeStatus: 'missing', promptCode: null, accepted: [], rejected: [], ignored: 0, dropped: 0, looksLikeQuestion: false };
    if (!norm.trim()) return result;

    // 3. the code
    var codes = findCodes(norm), chosen = null, status = 'missing', i, hit;
    for (i = 0; i < codes.length && !chosen; i++) {
      hit = matchPrompt(codes[i].bare, prompts);
      if (hit) { chosen = hit.prompt; status = hit.index === 0 ? 'found' : 'older'; result.code = 'DESK-' + bareCode(hit.prompt.code); }
    }
    if (!chosen && codes.length) {
      result.code = 'DESK-' + codes[0].bare; result.codeStatus = 'unknown';
      // a pasted-back question still deserves its own answer
      if (/HOW TO ANSWER/i.test(norm) && !isText) { /* fall through to the question check below */ }
      else return result;
    }
    if (!chosen && !codes.length) {
      var letters = {};
      if (c.answer && typeof c.answer === 'object') Object.keys(c.answer).forEach(function (k) { if (/^[A-Za-z]$/.test(k)) letters[k.toUpperCase()] = true; });
      var need = Object.keys(letters);
      for (i = 0; i < prompts.length; i++) {
        var p = prompts[i];
        if (c.recipe && p.recipe && p.recipe !== c.recipe) continue;
        if (need.length && !Object.keys(p.aliases || {}).some(function (a) { return letters[a.charAt(0).toUpperCase()]; })) continue;
        chosen = p; break;
      }
      status = 'missing';
    }
    if (result.codeStatus !== 'unknown') result.codeStatus = status;
    result.promptCode = chosen ? 'DESK-' + bareCode(chosen.code) : null;
    if (chosen && result.code && c.recipe && chosen.recipe && chosen.recipe !== c.recipe) {
      // a real code, but for another kind of task: importing it under this recipe would mislead
      result.codeStatus = 'other'; result.promptRecipe = chosen.recipe;
      result.rejected.push({ line: '', reason: 'This answer belongs to a different AI task.', code: 'other-task' });
      return result;
    }

    var hasHeader = /HOW TO ANSWER/i.test(norm);
    if (isText) {
      var t = parseTextAnswer(raw, codes, hasHeader);
      if (t.question) { result.looksLikeQuestion = true; return result; }
      if (!t.text) { result.rejected.push({ line: '', reason: 'There is no text in the answer.', code: 'empty' }); return result; }
      result.accepted.push({ kind: 'TEXT', alias: null, id: null, text: t.text, summary: t.summary, fields: {}, marks: [], line: '' });
      return result;
    }

    // 2. the question pasted back: read only what comes after the header, without the example line
    var lines = norm.split('\n');
    if (hasHeader) {
      for (i = 0; i < lines.length; i++) if (/HOW TO ANSWER/i.test(lines[i])) {
        // drop the whole format block (header, "First line", the example, "You may also use:" lines): it runs to the
        // first blank line, code fence, or a line holding only the code
        var j = i + 1;
        while (j < lines.length && lines[j].trim() && !/^\s*(`{3,}|~{3,})/.test(lines[j]) &&
          !/^[\s`'"*>]*DESK[\s_\-\u2013\u2014]*[0-9A-Za-z]{4}[\s`'"*]*$/i.test(lines[j])) j++;
        lines = lines.slice(j); break;
      }
      if (c.example) {
        var ex = clean(normalise(c.example)).toLowerCase();
        lines = lines.filter(function (l) { return clean(l).toLowerCase() !== ex; });
      }
      lines = lines.filter(function (l) { return !/^[^A-Za-z]*[A-Za-z]+<n>\s*\|/.test(l); });
    }
    var S = setup(c, chosen);
    var blocks = findBlocks(lines), candidates = [], all;
    blocks.forEach(function (b) { b.hasCode = findCodes(b.lines.join('\n')).length > 0; });
    var withCode = blocks.filter(function (b) { return b.hasCode; });
    if (withCode.length) { // every block that holds the code is read, as one scope (repeats are dropped as duplicates)
      var merged = [];
      withCode.forEach(function (b, k) { if (k) merged.push(''); merged = merged.concat(b.lines); });
      candidates.push(merged);
    }
    blocks.forEach(function (b) { if (!b.hasCode) candidates.push(b.lines); });
    all = lines.filter(function (l) { return !/^\s*(`{3,}|~{3,})/.test(l); });
    // other blocks are tried best-first
    var firstFixed = withCode.length ? 1 : 0;
    var rest = candidates.slice(firstFixed);
    var scored = rest.map(function (ls) { var r = parseScope(S, ls); return { r: r, n: r.accepted.length + r.rejected.length }; });
    var best = null;
    if (firstFixed) { var r0 = parseScope(S, candidates[0]); if (r0.accepted.length + r0.rejected.length) best = r0; }
    if (!best) {
      var top = null;
      scored.forEach(function (s) { if (s.n && (!top || s.n > top.n)) top = s; });
      if (top) best = top.r;
    }
    if (!best) best = parseScope(S, all);
    if (best.rejectedMore) result.rejectedMore = best.rejectedMore;
    result.accepted = best.accepted; result.rejected = best.rejected; result.ignored = best.ignored; result.dropped = best.dropped;
    if (hasHeader && !best.accepted.length && !best.rejected.length) result.looksLikeQuestion = true;
    if (result.codeStatus === 'unknown') { // unknown code with the question pasted back: nothing is imported
      result.accepted = []; result.rejected = []; result.dropped = 0;
    }
    return result;
  };

  R.normalise = normalise;
  R.parseDate = parseDate;
  R.parseUrl = parseUrl;
})();
