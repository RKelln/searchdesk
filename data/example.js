// The made-up person. The "Try with a made-up person" button on the Data screen (core/io.js) reads this.
//
// Shape expected (T2.6 fills it in):
//   window.DESK_EXAMPLE = { records: [ { type: 'profile', field: '...' }, { type: 'job', title: '...', stage: 'applied' }, ... ] };
// - `records` is a list of ordinary records. `id` is optional (a profile gets the id "profile"; others get a
//   random id each time they are loaded). Do not set `updated` or `source`: the loader stamps them and marks
//   every record `source: "example"`, so a saved copy never contains them and "Remove the made-up person"
//   deletes them all.
// - It may also be the array itself, or a function returning either one (called when the button is pressed,
//   which is the place to compute dates relative to today).
// - Never put `settings` records here. If the person already has a profile of their own, the example profile
//   is skipped. Keep everything synthetic: no real names, emails or phone numbers.
window.DESK_EXAMPLE = window.DESK_EXAMPLE || function () {
  // "Amira (made up)": every fact comes from docs/inputs/example-person.md. The organisations are fictional.
  // The profile has no name field, so the name lives in the first words of her background and in the banner.
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var day = function (n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  var today = day(0);

  // The first resume event and the first interview event in the snapshot that have not started yet, library
  // tier first. Chosen when the button is pressed, so a new snapshot never leaves a stale pick.
  var marks = [];
  var snap = window.DESK_EVENTS_SNAPSHOT;
  var events = snap && Array.isArray(snap.events) ? snap.events : [];
  ['resume', 'interview'].forEach(function (word) {
    var pick = null;
    events.forEach(function (e) {
      if (pick || !e || typeof e.id !== 'string' || typeof e.title !== 'string') return;
      if (String(e.start || '').slice(0, 10) < today) return;
      if (e.tier !== 'library' || e.title.toLowerCase().indexOf(word) < 0) return;
      if (marks.some(function (m) { return m.eventId === e.id; })) return;
      pick = e;
    });
    if (!pick) return;
    marks.push({
      type: 'event-mark', id: 'em_' + pick.id, eventId: pick.id, status: 'starred',
      copy: { title: pick.title, start: pick.start, end: pick.end || '', venue: pick.venue || '',
        url: /^https:\/\//.test(pick.url || '') ? pick.url : '', tier: pick.tier || '' }
    });
  });

  var posting = 'Kingsway Dental Group is a friendly dental office in Etobicoke. We are looking for an Office ' +
    'Administrator to join our front desk team. You will greet patients, answer the phone, book and confirm ' +
    'appointments, and keep the schedule in order. You will also send reminders, handle simple billing, and ' +
    'keep patient files neat and private. The hours are Monday to Friday, with some evenings. You should be ' +
    'calm, kind and careful with details. Experience with QuickBooks or similar software is an asset. Training ' +
    'is given. (Made-up posting.)';

  return { records: [
    { type: 'profile',
      roles: 'Office administration, bookkeeping, accounts payable',
      field: 'Finance and office work',
      background: 'Amira (made up). Six years as an accounts-payable clerk in her home country. Moved to Toronto 14 months ago.',
      area: 'Scarborough; travels by TTC',
      languages: 'English (good, but nervous speaking to strangers), and her first language',
      replyLanguage: 'English',
      availability: 'Evenings and weekends',
      avoid: 'Anything that costs money to attend' },
    { type: 'job', id: 'job_amira_ap_clerk', title: 'Accounts Payable Clerk', org: 'Birchmount Supply Co.', stage: 'applied',
      applied: day(-9), followUp: day(0), nextStep: 'Email to ask if they got my application' },
    { type: 'job', id: 'job_amira_kingsway', title: 'Office Administrator', org: 'Kingsway Dental Group', stage: 'interview',
      interviewAt: day(2) + 'T10:00', nextStep: 'Practise: tell me about yourself',
      asks: 'QuickBooks or similar\nScheduling\nCustomer service', posting: posting },
    { type: 'job', id: 'job_amira_bookkeeper', title: 'Bookkeeper (part-time)', org: 'Fenwick & Rao Accounting', stage: 'saved',
      closes: day(4), nextStep: 'Ask library coach to check resume first' },
    { type: 'job', id: 'job_amira_lakeview', title: 'Administrative Assistant', org: 'Lakeview Community Housing', stage: 'applied',
      applied: day(-16), followUp: day(-2) },
    { type: 'job', id: 'job_amira_northgate', title: 'Data Entry Clerk', org: 'Northgate Logistics', stage: 'closed',
      applied: day(-30), nextStep: 'No reply. Job reposted.' },
    { type: 'job', id: 'job_amira_danforth', title: 'Receptionist / Bookkeeping Support', org: 'Danforth Physio Clinic', stage: 'interview',
      interviewAt: day(-10), nextStep: 'Waiting to hear back' }
  ].concat(marks) };
};
