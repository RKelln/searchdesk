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
    appName: 'Search Desk',
    // A build may be for one place (the locale pack says which). Then the name says so, in the window title and in
    // the menu. Two format strings, because a language may not put the place in brackets.
    appTitle: '{app} ({place})',
    appPlace: '({place})',
    menuLabel: 'Main menu',
    skipToContent: 'Skip to the main part',
    tabAi: 'AI helper',
    tabData: 'Data',
    stubNotBuilt: 'This part is not built yet.',
    stubBroken: 'Something went wrong while starting this part. The rest of the app still works.',
    // Shown when a feature says it needs a place (needsLocale) and this build has no locale pack, so the feature
    // is loaded and working but has nothing to show. Not the same as "not built yet": nothing is broken here.
    noPlaceNote: 'This part is about one place, and this version is not set to a place yet.',
    noPlaceOnly: 'Toronto is the only place set up so far.',
    noPlaceWork: 'Adding another place is not a setting you change. It is real work: the help, the rules and the events all come from that place, and the events need a [[Togather]] server of their own.',
    noPlaceRest: 'The rest of {app} works as usual.',
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
    // The five stages a job moves through. These words are app-wide, not one feature's: the job list, the board
    // and the Today pipeline all show them, so they are translated in one place.
    'stage.saved': 'Saved',
    'stage.applied': 'Applied',
    'stage.interview': 'Interview',
    'stage.offer': 'Offer',
    'stage.closed': 'Closed',
    // io / Data screen
    saveHeading: 'Save a copy',
    saveIntro: 'Your jobs and notes stay in this browser, on this device. Save a copy now and then so you do not lose them.',
    exportBtn: 'Save a copy to a file',
    shareBtn: 'Send a copy to myself',
    copyTextBtn: 'Copy as text',
    copyTextDone: 'Copied. Paste it into an email to yourself.',
    copyTextHold: 'This browser would not copy by itself. Press and hold the text below to copy it.',
    copyTextLabel: 'Your copy, as text',
    exportSaved: 'Saved a copy: {name}',
    exportShared: 'Copy sent.',
    exportFailed: 'Could not save a copy. Try "Copy as text" instead.',
    lastSaved: 'Last saved a copy: {when}',
    never: 'never',
    fileDetailsTitle: 'What is in the file?',
    fileDetailsBody: 'The copy is a plain text file in a format called JSON. Any text editor can open it. It holds your jobs, dates, starred events and what you wrote about yourself. It does not hold the made-up person.',
    restoreHeading: 'Bring back a copy',
    restoreIntro: 'Pick a file you saved before, or paste the text you copied. Nothing here is lost: if something here is newer, it is kept.',
    importFileLabel: 'Pick a saved file',
    pasteLabel: 'Or paste the text here',
    pasteBtn: 'Paste',
    pasteDenied: 'Could not read what you copied. Click in the box and press Ctrl+V (Cmd+V on a Mac).',
    importTooBig: 'That is too big (over 5 MB), so nothing was changed.',
    importCannotRead: 'That file could not be read, so nothing was changed.',
    importNotMine: 'That does not look like a Search Desk copy, so nothing was changed.',
    importEmpty: 'There was nothing to read, so nothing was changed.',
    importIsAnswer: 'This looks like an AI answer. Open the AI helper to use it.',
    reportAdded: 'Added {n}',
    reportUpdated: 'Updated {n}',
    reportRemoved: 'Removed {n}',
    reportKept: 'Kept {n} that were newer here',
    reportSkipped: 'Skipped {n} that could not be read',
    reportAllBack: 'Added {n}. Everything was added back.',
    reportNothing: 'Nothing new.',
    reportNothingHere: 'Everything in this copy is already here.',
    labelImport: 'Import',
    // Mode A inbox (T5.3)
    labelInbox: 'Changes from your helper',
    inboxBrought: 'Brought in {n} changes from your helper.',
    inboxBroughtOne: 'Brought in 1 change from your helper.',
    inboxKept: 'Kept {n} that were newer here.',
    inboxKeptOne: 'Kept 1 that was newer here.',
    inboxLeftOut: '{n} items from your helper were left out.',
    inboxLeftOutOne: '1 item from your helper was left out.',
    inboxBad: 'The file from your helper could not be used, so nothing was changed.',
    labelExampleAdd: 'Add the made-up person',
    labelExampleRemove: 'Remove the made-up person',
    exampleHeading: 'A made-up person',
    exampleIntro: 'Not sure how it works? Add a made-up person with a few jobs, and look around. Your own things are not touched. You can remove them at any time.',
    exampleTry: 'Try with a made-up person',
    exampleRemove: 'Remove the made-up person',
    exampleOn: 'A made-up person is on this device. They are not in the copies you save.',
    exampleAdded: 'Added the made-up person.',
    exampleRemoved: 'Removed the made-up person. Your own things are still here.',
    // example (T2.6)
    exampleBanner: 'Amira (made up) is on this screen. She is not a real person. Remove her on the Data screen.',
    storageHeading: 'Saving on this device',
    storageOk: 'Saved in this browser. {n} things are kept here.',
    storageOkOne: 'Saved in this browser. 1 thing is kept here.',
    versionLine: 'Search Desk version {v}',
    lastChange: 'Last change: {label}',
    lastChangeNone: 'The last change',
    undoLast: 'Undo the last change',
    ideasHeading: 'Ideas you could build',
    ideasIntro: 'These parts are not built yet. You could build one with your coding helper.',
    aiHeading: 'AI helper',
    aiSoon: 'The AI helper will be here soon.',
    // AI helper (T3.3)
    aiIntro: 'Pick a task. Copy the question, paste it into a free AI chat, then paste the answer back here.',
    aiTasksLabel: 'AI tasks',
    aiNoTasks: 'No AI tasks are installed yet.',
    aiFix: 'Fix this',
    aiServiceLabel: 'Which AI chat do you use?',
    aiAccountNone: 'No account needed',
    aiAccountNeeded: 'Needs an account',
    aiAccountOptional: 'Account is optional',
    aiCopyOpen: 'Copy and open {service}',
    aiCopy: 'Just copy',
    aiPrivacy: 'This text goes to the AI service you pick. It has no name or contact details in it. You can see it all under "What will be sent".',
    aiPreviewTitle: 'What will be sent',
    aiPreviewNote: 'This is the whole question ({n} characters).',
    aiTruncated: 'The list was cut to fit. {n} rows were left out.',
    aiCopiedOpened: 'Copied. {service} is opening in a new tab. Paste the question there. Then copy the answer and come back.',
    aiCopiedPlain: 'Copied. Paste the question into your AI chat. Then copy the answer and come back.',
    aiCopiedPart: 'Copied.',
    aiCopyHold: 'This browser would not copy by itself. Press and hold the text below to copy it.',
    aiHoldLabel: 'The text to copy',
    aiOpenLink: 'Open {service} yourself',
    aiTaskError: 'This task could not be set up.',
    aiPendingTitle: 'Waiting for an answer',
    aiPendingBody: '{task}, asked {when} (code {code}). Paste the answer in the box below.',
    aiPendingClear: 'Not waiting any more',
    aiPasteHeading: 'Paste the answer',
    aiPasteLabel: 'Paste the AI answer here. It is read as soon as you paste.',
    aiLabel: 'AI answer',
    aiAddedOne: '1 suggestion added.',
    aiAddedMany: '{n} suggestions added.',
    aiAddedWhere: 'to {where}',
    aiAddedSome: '{n} added. {m} were already here.',
    aiAlready: 'Already added. Nothing new.',
    aiNothingToAdd: 'There was nothing to add.',
    aiNoCode: 'No code found; used your last question.',
    aiNoQuestion: 'There is no question yet. Copy one first, then paste the answer.',
    aiUnknownCode: 'This answer is for a question this page does not have (maybe from another device). Nothing was added.',
    aiThatIsQuestion: 'That is the question. Paste the AI\'s answer instead.',
    aiNothingFound: 'No answer lines were found in that text. Nothing was added.',
    aiNoRecipe: 'This answer is for a task that is not here any more. Nothing was added.',
    aiIsBackup: 'That is a saved copy, not an AI answer. Use the Data screen to bring it back.',
    aiBadOne: '1 line could not be read.',
    aiBadMany: '{n} lines could not be read.',
    aiMoreBad: '...and {n} more.',
    aiBadReasonDefault: 'This line could not be read.',
    aiFixIt: 'Copy a fix-it message',
    aiFixItDone: 'Copied. Paste it into the same chat, then copy the new answer and paste it here.',
    aiBetter: 'Could be better',
    aiBetterLabel: 'What was not right? (You can leave this empty.)',
    aiBetterSave: 'Save this note',
    aiBetterDone: 'Thanks. Saved a note for this task.',
    // recipe edit (T3.7)
    reLabel: 'Instructions changed',
    reChange: 'Change the instructions',
    reIntro: 'These are the words sent to the AI. Change them and save, and your next question uses them. The page adds the part that tells the AI how to answer, so you cannot break that.',
    reUsing: 'You are using your own words, saved {when}.',
    reOriginal: 'You are using the original words.',
    reTextLabel: 'The instructions',
    rePhHeading: 'Words in curly brackets',
    rePhNote: 'The page fills these in when it makes the question. Keep the ones you want the AI to get.',
    rePhIn: 'in use',
    rePhOut: 'not in the text',
    reAbsent: '{name} is gone. Without it the AI will not get: {what}.',
    reAbsentFallback: 'what the page fills in there',
    reUnknown: '{name} is not a word this task knows. It will show up as {name} in the question.',
    instructionsLong: 'These instructions are {n} characters. Free AI chats on the web may only keep {max}. Make them shorter if you use a free chat.',
    reWhy: 'What did you change? (You can leave this empty.)',
    reSave: 'Save',
    reSaved: 'Saved. Your next question uses these words.',
    reReset: 'Back to the original',
    reResetDone: 'Back to the original words.',
    reImprove: 'Improve these instructions with AI',
    reVersions: 'Earlier versions ({n})',
    reVersionUse: 'Put this in the box',
    reNotesHeading: 'Notes about this task',
    reNoteUsed: 'used',
    reNoteNoText: '(no sentence)',
    imTitle: 'Improve these instructions with AI',
    imBlurb: 'Ask an AI chat to rewrite the instructions for one task, using your notes.',
    imTip: 'Paste the answer in the box below. You will see the new words next to yours, and you choose.',
    imNeedsPick: 'Pick a task first. Open it, then choose "Improve these instructions with AI".',
    imFor: 'You are improving: {task}.',
    imNotes: '{n} of your notes will go with the question.',
    imNoNotes: 'You have no new notes for this task. The AI will make the words clearer.',
    imBack: 'Back to the task',
    imNoTarget: 'That task is not here any more. Nothing was changed.',
    imReady: 'The AI wrote new instructions. Look at them next to yours.',
    imNewTitle: 'New instructions to compare',
    imWhat: 'What changed: {what}',
    imYours: 'Yours',
    imNew: 'New',
    imChangedLine: 'Changed line. ',
    imChangedLines: '{n} lines changed',
    imSame: 'The new words are the same as yours. There is nothing to change.',
    imUse: 'Use this',
    imKeep: 'Keep mine',
    imUsed: 'Saved. Your next question uses the new instructions.',
    imKept: 'Kept yours. Nothing was changed.',
    selftestHeading: 'Self-test',
    // net (T2.5)
    netNoteCache: 'Could not get the latest events. Showing the ones saved earlier.',
    netNoteSnapshot: 'Could not get the latest events. Showing the list that came with this app.',
    // selftest
    selftestIntro: 'This runs the checks for every part of the app. Green is good. Red needs a fix.',
    selftestRun: 'Run again',
    selftestRunning: 'Running the checks...',
    selftestCoreHeading: 'The app itself',
    selftestPartsHeading: 'Parts of the app',
    selftestAllGood: 'All good. {pass} checks passed.',
    selftestSomeBad: '{fail} problems found. {pass} checks passed.',
    selftestPass: 'Passed',
    selftestFail: 'Needs a fix',
    selftestNone: 'No check file',
    selftestMissing: 'Did not load',
    selftestNoCheckFile: 'This part has no check file, so only the safety scan ran.',
    selftestNoCheckRegistered: 'The check file loaded, but it did not register a check with Desk.check.',
    selftestMissingNote: 'This part did not load. The app shows a stub in its place.',
    selftestBrokenNote: 'This part broke when it started.',
    selftestChecksCount: '{pass} of {total} checks passed',
    selftestBanned: 'Uses "{word}" in {where} (line {line}). Parts of the app may not do this.',
    selftestShowDetails: 'Show every check',
    // One preference set by a feature (ctx.pref in core/prefs.js). The label, the choices and any note are the
    // feature's own words, so only the way back is core's.
    prefReset: 'Start again',
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
    'base.recipe-coach.purpose': 'Practise interview questions with a free AI chat.',
    // hosting (T4.2)
    installHintIos: 'Add Search Desk to your home screen: tap Share, then Add to Home Screen.',
    installHintMenu: 'Add Search Desk to your home screen: open your browser menu, then tap Add to Home screen.',
    installHintPrompt: 'Add Search Desk to your home screen so it opens in one tap.',
    installAdd: 'Add it',
    installDismiss: 'Not now'
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
