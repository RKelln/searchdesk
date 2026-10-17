// A demo inbox for the made-up person (data/example.js). Not loaded by the app from here.
// To try it: press "Try with a made-up person" on the Data screen, copy this file to data/inbox.js, set WROTE to
// the time you copy it (an agent always writes the real time it made each change), then reload the page.
// You should see "Brought in 5 changes from your helper" with an Undo button. Delete data/inbox.js when done.
// All five records are synthetic: no real names, emails, phone numbers or links.
(function () {
  var WROTE = '2026-10-16T12:00:00Z'; // REPLACE with the real time you copy this file; it must be newer than the made-up person's records
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var day = function (n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  var recs = [
    // 1. A new job.
    { id: 'job_demo_front_desk', type: 'job', title: 'Front Desk Coordinator', org: 'Riverside Wellness Clinic (made up)',
      stage: 'saved', closes: day(6), nextStep: 'Read the posting and tailor the resume', source: 'ai', updated: WROTE },
    // 2. A changed stage on an existing example job (saved -> applied). A whole record replaces the old one,
    //    so every field is repeated.
    { id: 'job_amira_bookkeeper', type: 'job', title: 'Bookkeeper (part-time)', org: 'Fenwick & Rao Accounting',
      stage: 'applied', applied: day(0), closes: day(4), followUp: day(7),
      nextStep: 'Email to ask if they got my application', source: 'ai', updated: WROTE },
    // 3. A new job with a note.
    { id: 'job_demo_clerk', type: 'job', title: 'Accounts Clerk (contract)', org: 'Harbourview Foods (made up)',
      stage: 'saved', notes: 'Six month contract. Ask about the hours.', source: 'ai', updated: WROTE }
  ];
  // 4 and 5. A note on the first resume event and the first interview event in the snapshot that have not started
  // (the same two the made-up person starred). The event note rides along on the event mark.
  var snap = window.DESK_EVENTS_SNAPSHOT, events = snap && Array.isArray(snap.events) ? snap.events : [];
  ['resume', 'interview'].forEach(function (word) {
    var pick = null;
    events.forEach(function (e) {
      if (pick || !e || typeof e.id !== 'string' || typeof e.title !== 'string') return;
      if (String(e.start || '').slice(0, 10) < day(0) || e.tier !== 'library' || e.title.toLowerCase().indexOf(word) < 0) return;
      pick = e;
    });
    if (!pick) return;
    recs.push({ id: 'em_' + pick.id, type: 'event-mark', eventId: pick.id, status: 'starred',
      copy: { title: pick.title, start: pick.start, end: pick.end || '', venue: pick.venue || '',
        url: /^https:\/\//.test(pick.url || '') ? pick.url : '', tier: pick.tier || '' },
      note: 'Bring two printed copies of my resume.', source: 'ai', updated: WROTE });
  });
  window.DESK_INBOX = { schema: 'searchdesk/1', records: recs };
})();
