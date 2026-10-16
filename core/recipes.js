// Recipe registry and the AI helper screen (T3.3, DESIGN 9.1, 9.2, 9.5, 9.9, 9.10).
//
// A recipe is registered by its feature (`ctx.recipe(def)` -> Desk.recipeDefs()) or by core (`Desk.recipes.register`).
// Recipe def (all optional except `id`; see DESIGN 9.2):
//   id, title, blurb          shown on the task list ("name" is accepted for "title")
//   template, placeholders    the instructions with {names}; placeholders = {name: plain description}
//   needs(ctx)                -> [] when ready, else a list of problems, each a sentence or {text, go: 'profile'}
//   data(ctx, opts)           -> the values for the placeholders: {profile, items: {header, kinds: {L: rows}}, ...}
//                             rows are {id, cols}; opts = {options: {<optionId>: value}, args: [route parts after the id]}
//   options                   [{id, label, choices: [{value, label}], default}] shown as selects, passed in opts.options
//   answer, example, quota, required, synonyms, types   as for Desk.reply.parse (answer null = no answer is read back)
//   copies, tips              (T3.6) extra buttons beside "Just copy" and a list of short tips under the preview.
//                             copies = [{id, label, done, text(ctx, opts)}]: copies text(ctx, opts) alone; `done` is the
//                             sentence shown after. tips = [plain sentences]. Both are plain strings from the feature.
//   titles(ctx, promptRecord) -> {itemId: title} for matching a line by title (optional)
//   kind                      the suggestion kind used when `apply` is left out (default 'item')
//   apply(result, ctx)        result = the Desk.reply.parse result plus {bareCode, prompt}. Returns an array of
//                             suggestions {kind, alias?, key?, target, why, ...}, or {suggestions, records, text, render}
//                             `records` are other records to save (they need their own ids); `text` replaces the
//                             result line; `render(el)` adds something to the result (for example a choose step).
//   where                     plain words for "added to <where>" in the result line (optional)
//   ctx is read-only: {store: {all, get}, profile(), profileLines(), prompt, locale, now(), fmt, t, route}.
// Core fills the suggestion records: type, id `s_<code>_<alias>` (or `s_<code>_<hash of title and url>`), recipe,
// code (the bare code, like the prompt record), status 'new', source 'ai'. An id that exists is never written again.
window.Desk = window.Desk || {};
(function () {
  'use strict';
  var Desk = window.Desk;
  var R = Desk.recipes = Desk.recipes || {};
  var WAIT_DAYS = 7; // a question counts as waiting for this long

  function T(k, v) { return Desk.t(k, v); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function lc(s) { return String(s == null ? '' : s).toLowerCase(); }
  function bare(code) { return String(code || '').toUpperCase().replace(/^\s*DESK[\s-]*/, '').replace(/\s+/g, ''); }

  // ---- pure: ids, records, messages ------------------------------------------------------------------------------
  // 32-bit FNV-1a as 8 hex characters. Not secret; only a stable short name for "this title and this link".
  R.hash = function (text) {
    var h = 0x811c9dc5, s = String(text == null ? '' : text);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  };

  function textOf(rec, k) {
    var t = rec.target;
    var v = isObj(t) && t[k] != null ? t[k] : rec[k];
    return v == null ? '' : String(v);
  }
  // "s_7q3k_l3" for a line with an alias; "s_7q3k_<hash of title and url>" for a NEW line (a recipe may give `key`).
  R.suggestionId = function (code, rec) {
    var c = lc(bare(code)), r = rec || {};
    if (r.alias) return 's_' + c + '_' + lc(r.alias).replace(/[^a-z0-9]/g, '');
    var basis = r.key != null ? String(r.key) : lc(textOf(r, 'title')).replace(/\s+/g, ' ').trim() + '|' + lc(textOf(r, 'url')).trim();
    if (r.key == null && basis === '|') basis = JSON.stringify(r.target === undefined ? r : r.target);
    return 's_' + c + '_' + R.hash(basis);
  };

  // The suggestion record core writes for one thing a recipe's apply returned.
  R.suggestionRecord = function (def, code, rec) {
    var out = Object.assign({}, rec);
    delete out.key;
    out.type = 'suggestion';
    out.id = R.suggestionId(code, rec);
    out.recipe = def.id;
    out.code = bare(code);
    out.kind = out.kind || def.kind || 'item';
    out.why = out.why == null ? '' : String(out.why);
    out.status = out.status || 'new';
    out.source = 'ai';
    return out;
  };

  // What a recipe without its own apply does: one suggestion per accepted line, pointing at the item.
  R.defaultApply = function (def, result) {
    return (result.accepted || []).filter(function (a) { return a.kind !== 'TEXT'; }).map(function (a) {
      var s = { kind: def.kind || lc(a.kind) || 'item', why: (a.fields && a.fields.why) || '', marks: a.marks || [] };
      if (a.alias) { s.alias = a.alias; s.target = a.id; } else { s.target = a.fields || {}; }
      return s;
    });
  };

  // apply() may return an array of suggestions or {suggestions, records, text, render}.
  R.normaliseApply = function (ret) {
    if (Array.isArray(ret)) return { suggestions: ret, records: [], text: '', render: null };
    var o = isObj(ret) ? ret : {};
    return {
      suggestions: Array.isArray(o.suggestions) ? o.suggestions : [],
      records: Array.isArray(o.records) ? o.records : [],
      text: typeof o.text === 'string' ? o.text : '',
      render: typeof o.render === 'function' ? o.render : null
    };
  };

  // Splits records into new ones and ones whose id is already stored. `exists(id)` -> bool. Two records with one id
  // in the same answer count once.
  R.splitNew = function (records, exists) {
    var fresh = [], existing = [], seen = {};
    records.forEach(function (r) {
      if (seen[r.id]) return;
      seen[r.id] = true;
      (exists(r.id) ? existing : fresh).push(r);
    });
    return { fresh: fresh, existing: existing };
  };

  // The result line for a save. info: {fresh, existing, where, text}
  R.resultSentence = function (info) {
    if (info.text) return info.text;
    var n = info.fresh, m = info.existing, w = info.where ? ' ' + T('aiAddedWhere', { where: info.where }) : '';
    if (n && m) return T('aiAddedSome', { n: n, m: m });
    if (n) return (n === 1 ? T('aiAddedOne') : T('aiAddedMany', { n: n })).replace(/\.$/, '') + w + '.';
    if (m) return T('aiAlready');
    return T('aiNothingToAdd');
  };

  // The message that goes back to the same chat for lines that could not be read: the bad lines with a reason each,
  // the code, and the answer format again (the same block the question had). Plain text.
  R.fixItMessage = function (def, code, rejected, opts) {
    var o = opts || {}, c = bare(code), lines = [];
    var list = (rejected || []).filter(function (r) { return r; });
    var shown = list.slice(0, 10);
    lines.push('[A fix-it message from Search Desk, a job-search page. Code: DESK-' + c + ']');
    lines.push('');
    lines.push('Some lines of your last answer could not be read. Please send again ONLY the lines listed here, written in the right format. Do not repeat the lines that were fine.');
    lines.push('');
    lines.push('Lines that could not be read:');
    shown.forEach(function (r, i) {
      var line = String(r.line || '').replace(/\s+/g, ' ').trim();
      lines.push((i + 1) + '. ' + (line ? '"' + line + '" - ' : '') + (r.reason || T('aiBadReasonDefault')));
    });
    if (list.length > shown.length) lines.push('(and ' + (list.length - shown.length) + ' more)');
    lines.push('');
    var how = Desk.prompt && def && def.answer ? Desk.prompt.howToAnswer(def, {
      code: c, replyLanguage: o.replyLanguage,
      aliased: def.answer && typeof def.answer === 'object' ? Object.keys(def.answer).filter(function (k) { return /^[A-Za-z]$/.test(k); }) : []
    }) : '';
    lines.push(how || ('Put your whole answer inside one code block.\nFirst line: DESK-' + c));
    return lines.join('\n') + '\n';
  };

  // The newest question from the last 7 days that has not been answered. prompts: prompt records (any order).
  R.pendingPrompt = function (prompts, nowMs, knownIds) {
    var best = null, bestMs = -Infinity;
    (prompts || []).forEach(function (p) {
      if (!p || p.deleted || !p.code || p.answeredAt) return;
      if (knownIds && knownIds.indexOf(p.recipe) < 0) return;
      var ms = Date.parse(p.created);
      if (!isFinite(ms) || nowMs - ms > WAIT_DAYS * 86400000 || ms <= bestMs) return;
      best = p; bestMs = ms;
    });
    return best;
  };

  // Prompt records as the parser wants them: newest first.
  R.promptsNewestFirst = function (records) {
    return (records || []).filter(function (p) { return p && !p.deleted && p.code; }).sort(function (a, b) {
      if (a.created !== b.created) return a.created < b.created ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
  };

  // The context object for Desk.reply.parse, from a recipe def.
  R.parseContext = function (def, prompts, titles, nowDay) {
    var c = { recipe: def.id, prompts: prompts, answer: def.answer, now: nowDay };
    ['required', 'quota', 'synonyms', 'types', 'example'].forEach(function (k) { if (def[k] !== undefined) c[k] = def[k]; });
    if (titles) c.titles = titles;
    return c;
  };

  // ---- registry ----------------------------------------------------------------------------------------------------
  var coreDefs = [];
  // Core recipes (improve, custom) register here; feature recipes come from Desk.recipeDefs().
  R.register = function (def) {
    if (!def || typeof def.id !== 'string' || !def.id) throw new Error('A recipe needs an id.');
    coreDefs = coreDefs.filter(function (d) { return d.id !== def.id; });
    coreDefs.push(def);
    return def;
  };
  // [{owner, def}] core first, then features in the order they registered. A feature's recipe replaces a core one with
  // the same id.
  R.list = function () {
    var out = [], feature = Desk.recipeDefs ? Desk.recipeDefs() : [], ids = {};
    feature.forEach(function (e) { ids[e.def.id] = true; });
    coreDefs.forEach(function (d) { if (!ids[d.id]) out.push({ owner: 'core', def: d }); });
    return out.concat(feature);
  };
  R.get = function (id) {
    var hit = null;
    R.list().forEach(function (e) { if (e.def.id === id) hit = e.def; });
    return hit;
  };
  R.titleOf = function (def) { return def.title || def.name || def.id; };

  // ---- store-bound: the read-only ctx recipes get, building a question, reading an answer ----------------------------
  function S() { return Desk.store; }
  function dayKey(date) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
  }
  function settings() { return S().get('settings') || { type: 'settings' }; }
  function putSettings(patch) { // not an undo step
    S().putQuiet(Object.assign({}, settings(), patch));
  }

  var recipeCtxCache = null;
  function recipeCtx() {
    if (recipeCtxCache) return recipeCtxCache;
    recipeCtxCache = Object.freeze({
      store: Object.freeze({ all: function (t, o) { return S().all(t, o); }, get: function (id, o) { return S().get(id, o); } }),
      profile: function () { return S().get('profile') || {}; },
      profileLines: function (p) { return Desk.prompt.profileLines(p === undefined ? (S().get('profile') || {}) : p); },
      prompt: Desk.prompt,
      get locale() { return window.DESK_LOCALE || {}; },
      now: function () { return Desk.now(); },
      fmt: Object.freeze({
        date: function (v, o) { return Desk.fmtDate(v, o); }, time: function (v) { return Desk.fmtTime(v); },
        dateTime: function (v, o) { return Desk.fmtDateTime(v, o); },
        relative: function (v, n, o) { return Desk.fmtRelative(v, n, o); }, daysFrom: function (v, n) { return Desk.daysFrom(v, n); }
      }),
      t: function (k, v) { return Desk.t(k, v); },
      route: function () { return Desk.route(); }
    });
    return recipeCtxCache;
  }
  R.ctx = recipeCtx;

  // Problems that stop a question: [{text, go}]. A recipe that throws is reported as one problem.
  R.needs = function (def) {
    var raw;
    try { raw = def.needs ? def.needs(recipeCtx()) : []; } catch (e) { if (window.console) console.error(e); return [{ text: T('aiTaskError'), go: '' }]; }
    return (Array.isArray(raw) ? raw : []).map(function (n) {
      return typeof n === 'string' ? { text: n, go: '' } : { text: String(n && n.text || ''), go: String(n && n.go || '') };
    }).filter(function (n) { return n.text; });
  };

  function replyLanguage() {
    var p = S().get('profile') || {};
    var share = isObj(p.share) ? p.share : {};
    var on = typeof share.replyLanguage === 'boolean' ? share.replyLanguage : true;
    return on && typeof p.replyLanguage === 'string' ? p.replyLanguage.replace(/\s+/g, ' ').trim() : '';
  }
  function editedTemplate(def) {
    var hit = null;
    S().all('recipe-edit').forEach(function (r) { if (r.recipe === def.id && typeof r.text === 'string' && r.text.trim()) hit = r.text; });
    return hit;
  }

  // The question for a recipe, with a fresh code. Not remembered yet (R.remember does that). opts: {options, args}.
  // -> {text, code, record, size, truncated, dropped, missing} or null when the recipe has no template.
  R.buildQuestion = function (def, opts, code) {
    var o = opts || {}, ctx = recipeCtx();
    var data = Object.assign({ profile: ctx.profileLines() }, def.data ? def.data(ctx, { options: o.options || {}, args: o.args || [] }) : {});
    if (data.replyLanguage === undefined && replyLanguage()) data.replyLanguage = replyLanguage();
    var edited = editedTemplate(def);
    var built = Desk.prompt.build(def, data, {
      code: code || Desk.prompt.code(null, Desk.prompt.usedCodes()), now: Desk.now().getTime(),
      template: edited === null ? undefined : edited
    });
    return built;
  };

  // Remember a built question as a prompt record (only when the recipe reads an answer back).
  R.remember = function (def, built) {
    if (!def.answer) return null;
    return Desk.prompt.remember(Object.assign({}, built.record, { created: Desk.now().toISOString() }));
  };

  // Read pasted text. Finds the question it belongs to, parses, saves new suggestions as ONE batch, marks the question
  // answered, and returns what to show:
  //   {text, notes[], problem, rejected[], token, recipe, code, added, existing, render, kind}
  // kind: 'saved' | 'already' | 'nothing' | 'question' | 'unknown' | 'none' | 'backup' | 'norecipe'.
  R.process = function (text) {
    var st = S(), res = { text: '', notes: [], problem: '', rejected: [], token: null, recipe: '', code: '', added: 0, existing: 0, render: null, kind: '' };
    function stop(kind, key) { res.kind = kind; res.text = T(key); return res; }
    if (Desk.io && Desk.io.detectPaste && Desk.io.detectPaste(text) === 'state') return stop('backup', 'aiIsBackup');
    var prompts = R.promptsNewestFirst(st.all('prompt'));
    if (!prompts.length) return stop('none', 'aiNoQuestion');
    var first = Desk.reply.parse(text, { prompts: prompts });
    if (first.codeStatus === 'unknown') return stop('unknown', 'aiUnknownCode');
    var pr = null;
    prompts.forEach(function (p) { if (!pr && 'DESK-' + bare(p.code) === first.promptCode) pr = p; });
    pr = pr || prompts[0];
    var def = R.get(pr.recipe);
    if (!def) return stop('norecipe', 'aiNoRecipe');
    var ctx = recipeCtx(), titles;
    try { titles = def.titles ? def.titles(ctx, pr) : undefined; } catch (e) { titles = undefined; }
    var parsed = Desk.reply.parse(text, R.parseContext(def, prompts, titles, dayKey(Desk.now())));
    var used = null;
    prompts.forEach(function (p) { if (!used && 'DESK-' + bare(p.code) === parsed.promptCode) used = p; });
    used = used || pr;
    res.recipe = def.id; res.code = bare(used.code);
    // The parser reads the "You may also use: NEW | title | url | why" format line of a pasted-back question as a bad
    // line, so a header with nothing accepted also counts as the question pasted back.
    if (parsed.looksLikeQuestion || (/HOW TO ANSWER/i.test(text) && !parsed.accepted.length)) return stop('question', 'aiThatIsQuestion');
    if (parsed.codeStatus === 'missing') res.notes.push(T('aiNoCode'));
    if (!parsed.accepted.length && !parsed.rejected.length) { res.notes = []; return stop('nothing', 'aiNothingFound'); }
    res.rejected = parsed.rejected.slice();
    if (parsed.rejected.length) res.problem = parsed.rejected.length === 1 ? T('aiBadOne') : T('aiBadMany', { n: parsed.rejected.length });

    var result = Object.assign({}, parsed, { bareCode: res.code, prompt: used });
    var applied;
    try { applied = R.normaliseApply(def.apply ? def.apply(result, ctx) : R.defaultApply(def, result)); }
    catch (e) { if (window.console) console.error(e); res.kind = 'nothing'; res.text = T('aiTaskError'); return res; }
    var recs = applied.suggestions.map(function (s) { return R.suggestionRecord(def, res.code, s); });
    var extra = applied.records.filter(function (r) { return isObj(r) && r.type && r.id; });
    var exists = function (id) { return !!st.get(id, { withDeleted: true }); };
    var split = R.splitNew(recs.concat(extra), exists);
    res.added = split.fresh.length; res.existing = split.existing.length;
    if (split.fresh.length) {
      st.batch(T('aiLabel'), function () {
        split.fresh.forEach(function (r) { st.put(r); });
        if (!used.answeredAt) st.put(Object.assign({}, st.get(used.id) || used, { answeredAt: Desk.now().toISOString() }));
      });
      res.token = st.undoToken();
    } else if (!used.answeredAt && st.get(used.id) && (parsed.accepted.length || split.existing.length)) {
      st.putQuiet(Object.assign({}, st.get(used.id), { answeredAt: Desk.now().toISOString() }));
    }
    res.kind = split.fresh.length ? 'saved' : (split.existing.length ? 'already' : 'nothing');
    res.text = R.resultSentence({ fresh: res.added, existing: res.existing, where: def.where, text: applied.text });
    res.render = applied.render;
    return res;
  };

  // ---- a paste into the Data screen's box that is an AI answer comes here ------------------------------------------
  var latest = null;   // the result line shown on the AI screen: {res, betterOpen, betterDone, fix}
  R.latest = function () { return latest; };
  function show(res) { latest = { res: res, betterOpen: false, betterDone: false, fix: null, id: (latest ? latest.id : 0) + 1 }; }
  R.handlePaste = function (text) {
    var res = R.process(text);
    show(res);
    if (Desk.ui) Desk.ui.go('ai');
    return { text: res.text };
  };
  Desk.pasteHandlers = Desk.pasteHandlers || [];
  if (Desk.pasteHandlers.indexOf(R.handlePaste) < 0) Desk.pasteHandlers.push(R.handlePaste);

  // ---- the screen --------------------------------------------------------------------------------------------------
  if (typeof document === 'undefined' || !Desk.screen || !Desk.h || !Desk.io || !Desk.io.makePasteBox) return;
  var H = Desk.h;
  var selected = '';        // task id
  var optionValues = {};    // task id -> {option id: value}
  var draft = null;         // {key, def, built}
  var copied = null;        // the last copy: {recipe, ok, text, service, opened, fix}
  var previewOpen = false;
  var fixStatus = null;     // {ok, text} after "Copy a fix-it message"
  var partCopied = null;    // the last extra copy (def.copies): {recipe, id, ok, text, done}

  function services() {
    var l = window.DESK_LOCALE && Array.isArray(window.DESK_LOCALE.services) ? window.DESK_LOCALE.services : [];
    return l.filter(function (s) { return s && typeof s.id === 'string' && typeof s.name === 'string' && /^https:\/\//.test(String(s.url)); });
  }
  function currentService() {
    var list = services(), want = settings().service, hit = null;
    list.forEach(function (s) { if (s.id === want) hit = s; });
    return hit || list[0] || null;
  }
  function accountLabel(s) {
    return s.account === 'none' ? T('aiAccountNone') : s.account === 'needed' ? T('aiAccountNeeded') : s.account === 'optional' ? T('aiAccountOptional') : '';
  }

  function optsFor(def) {
    var vals = optionValues[def.id] || {}, out = {};
    (def.options || []).forEach(function (o) { out[o.id] = vals[o.id] !== undefined ? vals[o.id] : o.default; });
    return { options: out, args: Desk.route().args.slice(1) };
  }
  // The question shown under "What will be sent" is the one that gets copied (same code), until it is used.
  function currentDraft(def) {
    var o = optsFor(def), built, code;
    if (draft && draft.def === def.id && Desk.prompt.usedCodes().indexOf(draft.built.code) < 0) code = draft.built.code;
    try { built = R.buildQuestion(def, o, code); }
    catch (e) { if (window.console) console.error(e); return null; }
    draft = { def: def.id, built: built };
    return built;
  }

  function openService(svc) {
    try { window.open(svc.url, '_blank', 'noopener'); } catch (e) { if (window.console) console.error(e); }
  }

  function doCopy(def, andOpen) {
    var built = currentDraft(def);
    if (!built) return;
    var svc = andOpen ? currentService() : null;
    Desk.io.copyText(built.text).then(function (ok) {
      partCopied = null;
      copied = { recipe: def.id, ok: ok, text: built.text, service: svc, opened: false, truncated: built.dropped };
      if (ok && svc) { openService(svc); copied.opened = true; }
      latest = null; fixStatus = null;
      R.remember(def, built);
      var patch = {};
      if (!settings().seenPrivacyNote) { patch.seenPrivacyNote = true; copied.privacy = true; }
      if (svc && settings().service !== svc.id) patch.service = svc.id;
      if (Object.keys(patch).length) putSettings(patch);
      draw();
    });
  }

  // An extra copy button a recipe asks for (def.copies): copies one piece of text, with the same hold-and-press fallback.
  function doCopyPart(def, part) {
    var text = '';
    try { text = String(part.text(recipeCtx(), optsFor(def)) || ''); } catch (e) { if (window.console) console.error(e); }
    if (!text) return;
    Desk.io.copyText(text).then(function (ok) {
      partCopied = { recipe: def.id, id: part.id, ok: ok, text: text, done: String(part.done || '') };
      copied = null;
      draw();
    });
  }

  function taskList(el, list) {
    var box = H('div', { class: 'ai-tasks', role: 'group', 'aria-label': T('aiTasksLabel') });
    list.forEach(function (e) {
      var d = e.def, on = d.id === selected;
      box.appendChild(H('button', { type: 'button', class: 'ai-task' + (on ? ' active' : ''), 'aria-pressed': on ? 'true' : 'false',
        'data-test': 'ai-task-' + d.id, on: { click: function () { Desk.ui.go('ai/' + d.id); } } },
        H('strong', {}, R.titleOf(d)), d.blurb ? H('span', { class: 'ai-blurb' }, d.blurb) : null));
    });
    el.appendChild(box);
  }

  function optionsBlock(def) {
    if (!Array.isArray(def.options) || !def.options.length) return null;
    var box = H('div', { class: 'ai-options' });
    def.options.forEach(function (o) {
      var id = 'ai-opt-' + def.id + '-' + o.id;
      var sel = H('select', { id: id, 'data-test': 'ai-opt-' + o.id, on: { change: function (e) {
        optionValues[def.id] = Object.assign({}, optionValues[def.id], (function (r) { r[o.id] = e.target.value; return r; })({}));
        draw();
      } } });
      var cur = (optionValues[def.id] || {})[o.id];
      (o.choices || []).forEach(function (c) {
        var op = H('option', { value: String(c.value) }, c.label);
        if (String(cur !== undefined ? cur : o.default) === String(c.value)) op.selected = true;
        sel.appendChild(op);
      });
      box.appendChild(H('div', { class: 'ai-option' }, H('label', { for: id }, o.label), sel));
    });
    return box;
  }
  // Draws the screen again where it is (focus and scroll kept), for changes that live only in this file's variables.
  function draw() { if (Desk.redraw) Desk.redraw(); else Desk.ui.go(window.location.hash.replace(/^#/, '') || 'ai'); }

  function taskPanel(el, def) {
    var panel = H('section', { class: 'ai-panel', 'data-test': 'ai-panel', 'aria-label': R.titleOf(def) });
    panel.appendChild(H('h3', {}, R.titleOf(def)));
    var needs = R.needs(def);
    if (needs.length) {
      var nb = H('div', { class: 'ai-needs', 'data-test': 'ai-needs', role: 'status' });
      needs.forEach(function (n) {
        var row = H('p', { class: 'ai-need' }, n.text);
        if (n.go) row.appendChild(H('button', { type: 'button', 'data-test': 'ai-needs-fix', on: { click: function () { Desk.ui.go(n.go); } } }, T('aiFix')));
        nb.appendChild(row);
      });
      panel.appendChild(nb);
    }
    var opt = optionsBlock(def);
    if (opt) panel.appendChild(opt);

    var list = services(), svc = currentService();
    if (list.length) {
      var pick = H('div', { class: 'ai-services', role: 'group', 'aria-label': T('aiServiceLabel'), 'data-test': 'ai-service' });
      list.forEach(function (s) {
        var on = svc && s.id === svc.id;
        pick.appendChild(H('button', { type: 'button', class: 'ai-service' + (on ? ' active' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-service': s.id,
          on: { click: function () { putSettings({ service: s.id }); } } }, H('strong', {}, s.name), H('span', { class: 'ai-account' }, accountLabel(s))));
      });
      panel.appendChild(pick);
    }
    var built = needs.length ? null : currentDraft(def);
    var blocked = !built;
    var row = H('div', { class: 'ai-buttons' });
    if (svc) {
      var b = H('button', { type: 'button', class: 'primary ai-big', 'data-test': 'ai-copy-open', on: { click: function () { doCopy(def, true); } } }, T('aiCopyOpen', { service: svc.name }));
      b.disabled = blocked; row.appendChild(b);
    }
    var jc = H('button', { type: 'button', class: svc ? '' : 'primary ai-big', 'data-test': 'ai-copy', on: { click: function () { doCopy(def, false); } } }, T('aiCopy'));
    jc.disabled = blocked; row.appendChild(jc);
    (Array.isArray(def.copies) ? def.copies : []).forEach(function (part) {
      if (!part || typeof part.text !== 'function' || !part.label) return;
      var pb = H('button', { type: 'button', 'data-test': 'ai-copy-' + part.id, on: { click: function () { doCopyPart(def, part); } } }, String(part.label));
      pb.disabled = blocked; row.appendChild(pb);
    });
    panel.appendChild(row);

    if (!Desk.store.get('settings') || !Desk.store.get('settings').seenPrivacyNote || (copied && copied.privacy)) {
      panel.appendChild(H('p', { class: 'ai-privacy', 'data-test': 'ai-privacy' }, T('aiPrivacy')));
    }
    if (built) {
      var det = H('details', { class: 'ai-preview', 'data-test': 'ai-preview' }, H('summary', {}, T('aiPreviewTitle')),
        H('p', { class: 'muted' }, T('aiPreviewNote', { n: built.size })),
        H('pre', { class: 'ai-preview-text', 'data-test': 'ai-preview-text', tabindex: '0' }, built.text));
      if (previewOpen) det.open = true;
      det.addEventListener('toggle', function () { previewOpen = det.open; });
      panel.appendChild(det);
      if (built.truncated) panel.appendChild(H('p', { class: 'muted' }, T('aiTruncated', { n: built.dropped })));
    }
    if (copied && copied.recipe === def.id) panel.appendChild(copiedBlock());
    if (partCopied && partCopied.recipe === def.id) {
      var pc = H('div', { class: 'ai-copied', role: 'status', 'data-test': 'ai-part-copied' });
      if (partCopied.ok) pc.appendChild(H('p', {}, partCopied.done || T('aiCopiedPart')));
      else { pc.appendChild(H('p', {}, T('aiCopyHold'))); pc.appendChild(holdBox(partCopied.text, 'ai-part-fallback')); }
      panel.appendChild(pc);
    }
    if (Array.isArray(def.tips) && def.tips.length) {
      var tl = H('ul', { class: 'ai-tips', 'data-test': 'ai-tips' });
      def.tips.forEach(function (tip) { tl.appendChild(H('li', {}, String(tip))); });
      panel.appendChild(tl);
    }
    el.appendChild(panel);
  }

  function holdBox(text, test) {
    var ta = H('textarea', { readonly: true, rows: 6, 'aria-label': T('aiHoldLabel'), 'data-test': test });
    ta.value = text;
    setTimeout(function () { try { ta.focus(); ta.select(); } catch (e) {} }, 0);
    return ta;
  }
  function copiedBlock() {
    var c = copied, box = H('div', { class: 'ai-copied', role: 'status', 'data-test': 'ai-copied' });
    if (c.ok) {
      box.appendChild(H('p', {}, c.service ? T('aiCopiedOpened', { service: c.service.name }) : T('aiCopiedPlain')));
    } else {
      box.appendChild(H('p', {}, T('aiCopyHold')));
      box.appendChild(holdBox(c.text, 'ai-copy-fallback'));
    }
    if (c.service) box.appendChild(H('p', {}, H('a', { href: c.service.url, 'data-test': 'ai-open-link' }, T('aiOpenLink', { service: c.service.name }))));
    return box;
  }

  function pendingCard(el) {
    var known = R.list().map(function (e) { return e.def.id; });
    var p = R.pendingPrompt(Desk.store.all('prompt'), Desk.now().getTime(), known);
    if (!p) return;
    var def = R.get(p.recipe);
    el.appendChild(H('section', { class: 'ai-pending', 'data-test': 'ai-pending', 'data-code': p.code, role: 'status' },
      H('h3', {}, T('aiPendingTitle')),
      H('p', {}, T('aiPendingBody', { task: def ? R.titleOf(def) : p.recipe, when: Desk.fmtRelative(p.created, Desk.now(), { past: 'ago' }), code: 'DESK-' + bare(p.code) })),
      H('button', { type: 'button', 'data-test': 'ai-pending-clear', on: { click: function () {
        Desk.store.putQuiet(Object.assign({}, p, { answeredAt: Desk.now().toISOString() }));
      } } }, T('aiPendingClear'))));
  }

  function saveNote(l, text) {
    Desk.store.putQuiet({ type: 'recipe-note', recipe: l.res.recipe, code: l.res.code, text: String(text || '').trim().slice(0, 1000), used: false });
  }

  function resultBlock(el) {
    var l = latest;
    if (!l) return;
    var r = l.res;
    var box = H('section', { class: 'ai-result', 'data-test': 'ai-result', role: 'status' });
    var line = H('p', { class: 'ai-result-line', 'data-test': 'ai-result-text' }, r.text);
    if (r.token !== null && r.token !== undefined && Desk.store.undoToken() === r.token) {
      var token = r.token;
      line.appendChild(document.createTextNode(' '));
      line.appendChild(H('button', { type: 'button', 'data-test': 'ai-undo', on: { click: function () {
        if (Desk.store.undoToken() !== token) return;
        Desk.store.undo();
        r.text = T('undone'); r.token = null; r.render = null;
        draw();
      } } }, T('undo')));
    }
    box.appendChild(line);
    r.notes.forEach(function (n) { box.appendChild(H('p', { class: 'muted', 'data-test': 'ai-note' }, n)); });
    if (r.rejected.length) {
      box.appendChild(H('p', { class: 'ai-problem', 'data-test': 'ai-problem' }, r.problem));
      var ul = H('ul', { class: 'ai-rejected', 'data-test': 'ai-rejected' });
      r.rejected.slice(0, 5).forEach(function (x) {
        ul.appendChild(H('li', {}, x.line ? H('code', {}, x.line) : null, x.line ? ' - ' : '', x.reason));
      });
      if (r.rejected.length > 5) ul.appendChild(H('li', {}, T('aiMoreBad', { n: r.rejected.length - 5 })));
      box.appendChild(ul);
      box.appendChild(H('button', { type: 'button', 'data-test': 'ai-fixit', on: { click: function () { copyFixIt(r); } } }, T('aiFixIt')));
      if (fixStatus) {
        box.appendChild(H('p', { class: 'ai-fixit-status', 'data-test': 'ai-fixit-status' }, fixStatus.ok ? T('aiFixItDone') : T('aiCopyHold')));
        if (!fixStatus.ok) box.appendChild(holdBox(fixStatus.text, 'ai-fixit-fallback'));
      }
    }
    if (r.render) {
      var extra = H('div', { class: 'ai-extra' });
      try { r.render(extra); } catch (e) { if (window.console) console.error(e); }
      box.appendChild(extra);
    }
    if (r.recipe) box.appendChild(betterBlock(l));
    el.appendChild(box);
  }

  function copyFixIt(r) {
    var def = R.get(r.recipe);
    if (!def) return;
    var msg = R.fixItMessage(def, r.code, r.rejected, { replyLanguage: replyLanguage() });
    Desk.io.copyText(msg).then(function (ok) { fixStatus = { ok: ok, text: msg }; draw(); });
  }

  function betterBlock(l) {
    var wrap = H('div', { class: 'ai-better-wrap' });
    if (l.betterDone) { wrap.appendChild(H('p', { class: 'muted', 'data-test': 'ai-better-done' }, T('aiBetterDone'))); return wrap; }
    if (!l.betterOpen) {
      wrap.appendChild(H('button', { type: 'button', 'data-test': 'ai-better', on: { click: function () { l.betterOpen = true; draw(); } } }, T('aiBetter')));
      return wrap;
    }
    var ta = H('textarea', { id: 'ai-better-text', rows: 3, maxlength: '1000', 'data-test': 'ai-better-text' });
    ta.value = l.betterText || '';
    ta.addEventListener('input', function () { l.betterText = ta.value; });
    wrap.appendChild(H('label', { for: 'ai-better-text' }, T('aiBetterLabel')));
    wrap.appendChild(ta);
    wrap.appendChild(H('button', { type: 'button', class: 'primary', 'data-test': 'ai-better-save', on: { click: function () {
      saveNote(l, l.betterText || '');
      l.betterDone = true; l.betterOpen = false;
      draw();
    } } }, T('aiBetterSave')));
    return wrap;
  }

  function pasteBlock(el) {
    var pb = Desk.io.makePasteBox({
      id: 'ai-paste-box', label: T('aiPasteLabel'),
      onText: function (text) {
        show(R.process(text)); fixStatus = null;
        Promise.resolve().then(draw); // after the box has been emptied, or the shell would put the text back
        return true;
      },
      onClipboardError: function () { show({ text: T('pasteDenied'), notes: [], rejected: [], token: null, recipe: '', code: '', render: null }); draw(); }
    });
    el.appendChild(H('section', { class: 'ai-paste' }, H('h3', {}, T('aiPasteHeading')), pb.node));
  }

  Desk.screen('ai', { label: 'tabAi', order: 900, render: function (el) {
    var route = Desk.route(), list = R.list().filter(function (e) { return e.def.listed !== false; });
    if (route.args[0]) selected = route.args[0];
    var ids = list.map(function (e) { return e.def.id; });
    if (ids.indexOf(selected) < 0) selected = ids[0] || '';
    el.appendChild(H('h2', {}, T('aiHeading')));
    if (!list.length) {
      el.appendChild(H('p', { class: 'muted', 'data-test': 'ai-none' }, T('aiNoTasks')));
    } else {
      el.appendChild(H('p', { class: 'muted' }, T('aiIntro')));
      taskList(el, list);
      var def = R.get(selected);
      if (def) taskPanel(el, def);
    }
    pendingCard(el);
    pasteBlock(el);
    resultBlock(el);
  } });
})();
