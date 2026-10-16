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
//   now       'YYYY-MM-DD'   today, only to give a year to dates like "Nov 2" (without it they become unknown)
//
// result:
//   code            the code found in the text ('DESK-7Q3K'), or null
//   codeStatus      'found' (the newest prompt), 'older' (an older stored prompt), 'missing' (no code; the
//                   newest matching prompt was used), 'unknown' (a code this page does not have; nothing parsed)
//   promptCode      the stored prompt's code that was used, or null
//   accepted[]      {kind, alias, id, fields, marks[], line}; alias kinds carry `fields.why`, `score` for old JSON.
//                   marks: 'name' (matched by title), 'http' (link is not https), 'date-unknown' (text kept in
//                   `unknown`). For answer 'text': one {kind:'TEXT', text, summary}.
//   rejected[]      {line, reason, code}   reason is a plain sentence; code is a stable key for the string table
//   ignored         count of prose lines that were not answer lines
//   dropped         count of lines dropped silently (duplicates, over quota)
//   looksLikeQuestion  true when the question itself was pasted back
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var R = Desk.reply = Desk.reply || {};
  var MAX_FIELD = 300;

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

  // ---- codes -------------------------------------------------------------------------------------------------------
  // Candidates: every "DESK-XXXX" in the text. Returns [{raw, bare, idx, lineIdx?}] in text order.
  function findCodes(text) {
    var re = /(DESK)[\s_\-\u2013\u2014]*([0-9A-Za-z]{4})(?![0-9A-Za-z])/gi, m, out = [];
    while ((m = re.exec(text))) {
      var bare = m[2].toUpperCase();
      // "desk-work" in prose is not a code: it needs an upper-case DESK or a digit
      if (m[1] !== 'DESK' && !/[0-9]/.test(bare)) continue;
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
  // -> {value:'YYYY-MM-DD'} | {empty:true} | {unknown:true}
  function parseDate(text, now) {
    var t = String(text).trim().replace(/[.,;]+$/, ''), m;
    if (!t || /^(unknown|not stated|not given|n\/a|na|none|tbd|tba|-|\u2013|\u2014|ongoing|rolling|open)$/i.test(t)) return { empty: true };
    var ny = null, nm = null, nd = null;
    if (now && (m = /^(\d{4})-(\d{2})-(\d{2})/.exec(now))) { ny = +m[1]; nm = +m[2]; nd = +m[3]; }
    function withYear(mo, d, y) {
      if (!y) {
        if (ny === null) return { unknown: true };
        y = ny;
        if (mo < nm || (mo === nm && d < nd)) y = ny + 1;
      } else if (y < 100) y += 2000;
      return validYMD(y, mo, d) ? { value: y + '-' + pad(mo) + '-' + pad(d) } : { unknown: true };
    }
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ].*)?$/.exec(t))) return withYear(+m[2], +m[3], +m[1]);
    if ((m = /^(?:[A-Za-z]+day,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s*(\d{4})?$/.exec(t)) && monthOf(m[2]))
      return withYear(monthOf(m[2]), +m[1], m[3] ? +m[3] : 0);
    if ((m = /^(?:[A-Za-z]+day,?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/.exec(t)) && monthOf(m[1]))
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
    return S;
  }
  function fieldType(S, kind, field) {
    return S.types[kind + '.' + field] || S.types[field] || (field === 'value' && S.types[kind]) || '';
  }

  // ---- cleaning one line ---------------------------------------------------------------------------------------------
  function isTableSeparator(s) { return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s); }
  function clean(line) {
    var s = line.trim();
    s = s.replace(/^(?:[-*\u2022\u2023\u25AA\u25E6]\s+)+/, '');
    s = s.replace(/\*+|`+|__/g, '');
    s = s.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim();
    var q = /^"(.*)"[,]?$/.exec(s); if (q && q[1].indexOf('"') < 0) s = q[1];
    return s;
  }

  // ---- recognising a record -------------------------------------------------------------------------------------------
  var SEP = /^(?:[ \t]*[|:\-\u2013\u2014][ \t]*|[ \t]*\t[ \t]*| {2,})/;
  function stripLead(s) { return s.replace(/^[\s|:\-\u2013\u2014]+/, ''); }

  // alias token at the start: returns {letter, num, rest} or null
  function aliasToken(S, s, depth) {
    var m = /^[(\[#<]*[ \t]*(?:([A-Za-z])[ \t-]*)?0*(\d{1,3})(?![0-9A-Za-z])[)\]>]*\.?/.exec(s);
    if (!m) return null;
    var letter = m[1] ? m[1].toUpperCase() : '', num = parseInt(m[2], 10), rest = s.slice(m[0].length), sm = SEP.exec(rest);
    if (!sm && letter && S.letters[letter] && /^[ \t]+\S/.test(rest)) sm = [rest.match(/^[ \t]+/)[0]];
    if (!sm && /^\s*$/.test(rest)) sm = [rest];
    if (!sm) return null;
    rest = rest.slice(sm[0].length);
    if (!letter && !(depth > 0)) { // a list number in front of a real alias ("1 | L3 | why")
      var inner = aliasToken(S, rest, 1);
      if (inner && inner.letter) return inner;
    }
    return { letter: letter, num: num, rest: stripLead(rest) };
  }

  function lineTitleMatch(S, s) {
    var n = ' ' + words(s) + ' ', hits = [];
    S.titles.forEach(function (t) {
      for (var i = 0; i < t.variants.length; i++) if (n.indexOf(' ' + t.variants[i] + ' ') >= 0) { hits.push({ t: t, v: t.variants[i] }); return; }
    });
    if (hits.length !== 1) return null;
    var re = new RegExp(hits[0].v.split(' ').map(esc).join('[^\\p{L}\\p{N}]+'), 'iu');
    var why = stripLead(s.replace(re, ' ').replace(/\s+/g, ' ').replace(/^[\s"',.()\[\]]+|[\s"',(\[]+$/g, ''));
    return { item: hits[0].t.item, why: why };
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
    var tok = aliasToken(S, s, 0);
    if (!tok && /^\d{1,3}[.)]\s+/.test(s)) tok = aliasToken(S, s.replace(/^\d{1,3}[.)]\s+/, ''), 0);
    if (tok && Object.keys(S.letters).length) {
      var item = S.byNum[tok.num];
      if (!S.prompt) return { bad: true, reason: 'This page has no question to match this answer to.', code: 'no-question' };
      if (!item) {
        var tm = lineTitleMatch(S, tok.rest);
        if (tm) return aliasRecord(S, tm.item, tm.why, ['name']);
        return { bad: true, reason: (tok.letter || '') + tok.num + ' is not one of the items in the question.', code: 'unknown-alias' };
      }
      return aliasRecord(S, item, tok.rest, []);
    }
    // no alias: an exact title
    if (Object.keys(S.letters).length) {
      var t2 = lineTitleMatch(S, s.replace(/^\d{1,3}[.)]\s+/, ''));
      if (t2) return aliasRecord(S, t2.item, t2.why, ['name']);
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
        if (u.bad) { bad = bad || { bad: true, reason: 'The web address has no usable host.', code: 'bad-url' }; }
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
  function parsePipeLines(S, lines) {
    var units = [], ignored = 0, afterBlank = true;
    lines.forEach(function (raw) {
      if (!raw.trim()) { afterBlank = true; return; }
      if (isTableSeparator(raw)) return;
      var cleaned = clean(raw);
      if (!cleaned) return;
      var r = parseRecord(S, cleaned);
      if (r) { units.push({ raw: raw.trim(), cleaned: cleaned, res: r }); afterBlank = false; return; }
      var prev = units[units.length - 1];
      if (prev && !afterBlank) {
        var open = prev.res.bad || prev.res.short, cand, k, r2;
        if (open) {
          for (k = 0; k < 2; k++) {
            cand = prev.cleaned + (k ? ' ' : '') + cleaned;
            r2 = parseRecord(S, cand);
            if (r2 && !r2.bad && !r2.short) { prev.cleaned = cand; prev.raw += ' / ' + raw.trim(); prev.res = r2; return; }
          }
        } else if (!/[.!?)"']$/.test(prev.cleaned) || /^\s/.test(raw)) {
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
    var tok = aliasToken(S, s, 0);
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
    var joined = lines.join('\n'), result, ignored = 0;
    var spans = jsonSpans(joined).filter(function (sp) { return /"\s*(t|type|id|alias)\s*"\s*:/.test(sp.text) || sp.open; });
    var units;
    if (spans.length) {
      units = parseJsonSpans(S, joined, spans).units;
      var rest = joined, k;
      for (k = spans.length - 1; k >= 0; k--) rest = rest.slice(0, spans[k].start) + '\n' + rest.slice(spans[k].end);
      rest.split('\n').forEach(function (l) { if (l.trim() && !/^[\s\[\],]*$/.test(l)) ignored++; });
    } else {
      result = parsePipeLines(S, lines);
      units = result.units; ignored = result.ignored;
    }
    var accepted = [], rejected = [], dropped = 0, seen = {}, counts = {};
    units.forEach(function (u) {
      if (u.skip) { ignored++; return; }
      var r = u.res;
      if (r.bad) { rejected.push({ line: cap(u.raw, 200), reason: r.reason, code: r.code }); return; }
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
    return { accepted: accepted, rejected: rejected, ignored: ignored, dropped: dropped };
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
      for (i = 0; i < lines.length; i++) if (/HOW TO ANSWER/i.test(lines[i])) { lines = lines.slice(i + 1); break; }
      if (c.example) {
        var ex = clean(normalise(c.example)).toLowerCase();
        lines = lines.filter(function (l) { return clean(l).toLowerCase() !== ex; });
      }
    }
    var S = setup(c, chosen);
    var blocks = findBlocks(lines), candidates = [], all;
    var codeRe = /DESK[\s_\-\u2013\u2014]*[0-9A-Za-z]{4}/i;
    blocks.forEach(function (b) { b.hasCode = b.lines.some(function (l) { return codeRe.test(l); }); });
    var withCode = blocks.filter(function (b) { return b.hasCode; });
    if (withCode.length) candidates.push(withCode[0].lines);
    blocks.forEach(function (b) { if (withCode.indexOf(b) < 0 || withCode[0] !== b) candidates.push(b.lines); });
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
