// Toronto locale pack: free help, default sites, AI services, events sources, posting rules.
// Pure data (no functions) so tests can check it. Every URL is https.
// Help copy comes only from docs/inputs/toronto-help.md (read at each service's own page, 2026-10-15).
// Order of `help` is the order on the Help screen. kind 'person' = a person or a helpline (shown first,
// under "Free, from people"); kind 'online' = courses and guidance you use on your own.
window.DESK_LOCALE = {
  id: 'toronto',
  name: 'Toronto',

  help: [
    {
      id: 'employment-ontario', kind: 'person', name: 'Employment Ontario',
      what: 'Free one-on-one support from an Employment Ontario counsellor: resume writing, interview training, skills training, job search help.',
      how: 'Over 700 locations. Book by appointment, email, phone or live chat.',
      who: 'People looking for work in Ontario. The local provider decides who can join. It does not depend on immigration status.',
      source: 'https://www.ontario.ca/page/employment-ontario',
    },
    {
      id: 'acces', kind: 'person', name: 'ACCES Employment',
      what: 'Helps job seekers who face barriers to work get into the Canadian job market. Most of its services are free.',
      how: 'Programs and events are listed on its website, by kind of service.',
      who: 'Job seekers in the Toronto area, especially newcomers to Canada.',
      source: 'https://accesemployment.ca/',
    },
    {
      id: 'costi', kind: 'person', name: 'COSTI Immigrant Services',
      what: 'Employment and career programs for newcomers and skilled workers, including online services. Interview preparation is part of its programs.',
      how: 'See its employment page (link below).', // TODO(maintainer): no contact details in toronto-help.md
      who: 'Newcomers and skilled workers.',
      source: 'https://www.costi.org/en/employment', // host www.costi.org confirmed, page loads (T2.4, 2026-10-16)
    },
    {
      id: 'jvs', kind: 'person', name: 'JVS Toronto',
      what: 'A four-day Job Search Workshop for Newcomers, with one-to-one support and a certificate. Eight-week programs for one kind of work, with employer connections. Programs for internationally trained professionals.',
      how: 'See its newcomer services page (link below).', // TODO(maintainer): no contact details in toronto-help.md
      who: 'Newcomers.',
      source: 'https://www.jvstoronto.org/find-a-job/newcomer-services/', // host confirmed, page loads (T2.4, 2026-10-16)
    },
    {
      id: 'tpl-coaches', kind: 'person', name: 'Career Coaches in Residence (Toronto Public Library)',
      what: 'Career and job search help for younger adults. Coaches can help with general career advice, resume and cover letters, job search, interview preparation, or personal marketing material for your LinkedIn profile, portfolio or website. Free with a Toronto Public Library card.',
      how: 'Book an appointment: pick a date in the calendar, fill in a consent form, then wait for a confirmation.',
      who: 'Younger adults.',
      source: 'https://tpl.ca/programs-and-classes/featured/career-coaches-in-residence/',
    },
    {
      id: 'tpl-newcomers', kind: 'person', name: 'New to Canada: settlement workers (Toronto Public Library)',
      what: 'Meet with a settlement worker who can help you get started in Toronto and Canada. The library also has information in over 40 languages, citizenship practice tests, and language-learning databases including IELTS practice. Free with a Toronto Public Library card.',
      how: 'See the library page (link below).', // TODO(maintainer): no booking steps in toronto-help.md
      who: 'Newcomers to Canada.',
      source: 'https://tpl.ca/using-the-library/new-to-canada/',
    },
    {
      id: '211', kind: 'person', name: '211 Ontario',
      what: 'A free helpline and website that points you to the right community service, including newcomer employment programs in Toronto. If you do not know which agency you qualify for, 211 answers that in one call.',
      how: 'Call 2-1-1, or use the website.',
      phone: { label: 'Call 2-1-1', tel: '211' },
      who: 'Anyone who does not know where to start.',
      source: 'https://211ontario.ca/',
    },
    {
      id: 'tpl-job-seeker', kind: 'online', name: 'Job Seeker learning pathway (Toronto Public Library)',
      what: 'Online courses: LinkedIn Learning on networking, job interviews (including video interviews) and resume writing, plus a resume course with an instructor, over 24 hours. Certificates are available.',
      how: 'Online, with a library card.',
      who: 'Anyone with a Toronto Public Library card.',
      source: 'https://tpl.ca/elearning/learning-pathways/job-seeker/',
    },
    {
      id: 'jobbank-interview', kind: 'online', name: 'Job Bank: Preparing for an interview',
      what: 'Four steps: planning, interview materials, the interview, and after the interview. It advises you to plan and rehearse answers to questions you might be asked.',
      how: 'Read it on the Job Bank website.',
      who: 'Anyone.',
      source: 'https://www.on.jobbank.gc.ca/findajob/resources/prepare-for-interview',
    },
    // TODO(maintainer): Skills for Change and WoodGreen Community Services are marked "~" (not read at source) in
    // toronto-help.md, so they are not listed. City of Toronto Newcomer Services Kiosks: URL not recorded; find
    // the City of Toronto page, confirm it, then add an entry ("meet with a settlement worker", free).
  ],

  // The help screen's own lines (copy from toronto-help.md).
  helpNotes: {
    status: 'Some programs check your immigration status and some do not. If you are not sure, call 211 or ask a library settlement worker.',
    libraryClasses: 'The library also runs free career and job search sessions (resumes, interviews, using AI in a job search). Find them in the Events tab, under the library.',
  },

  // Default job sites, general audience only. Job Bank first.
  sites: [
    { id: 'jobbank', name: 'Job Bank', url: 'https://www.jobbank.gc.ca/' },
    // TODO(maintainer): no other sites are named in toronto-help.md or DESIGN, so none are added from memory.
  ],

  // DESIGN 9.5. TODO(V9): `account` values are unverified; check each service's current terms before shipping.
  // TODO(V7): `prefill` stays null until tested.
  services: [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', account: 'optional', prefill: null },
    { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', account: 'needed', prefill: null },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', account: 'needed', prefill: null },
    { id: 'duck', name: 'Duck.ai', url: 'https://duck.ai/', account: 'none', prefill: null },
    { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com/', account: 'optional', prefill: null },
  ],

  // DESIGN 11. net.js may only GET the host of `api`.
  // `api` is the full events endpoint (not just a base), so the host is read from one string. It is Togather
  // STAGING for now (early alpha, no production yet): switch to production by changing this one line.
  // net.js adds startDate, endDate, limit, context and (per tier) the `query` entries below, and follows
  // `next_cursor` through `after`. A tier `query` value is plain text; net.js encodes it ("&" is fine).
  // tools/snapshot.py has the same tiers and endpoint: keep them in step (a unit test checks).
  events: {
    api: 'https://staging.toronto.togather.foundation/api/v1/events',
    tiers: [
      { id: 'library', name: 'At the library', query: { keywords: 'career & job search' } },
      { id: 'city', name: 'Around the city', query: {} },
    ],
  },

  // DESIGN 8.4. TODO(V10): check against the text of O. Reg. 476/24.
  postingRules: {
    source: { name: 'O. Reg. 476/24 (Ontario)', url: 'https://www.ontario.ca/laws/regulation/r24476' },
    checklist: [
      { id: 'pay', label: 'Shows a pay range' },
      { id: 'ai', label: 'Says if AI screens applicants' },
      { id: 'vacancy', label: 'Says if the job is open now' },
    ],
    replyDays: 45,
  },
};
