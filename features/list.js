// Which features to load, and ideas not built yet.
window.Desk = window.Desk || {};
Desk.features = ['home', 'jobs', 'profile', 'events', 'help', 'recipe-events', 'recipe-posting', 'recipe-coach', 'recipe-custom', 'build'];
Desk.planned = [ // ideas not built yet; each has a brief in docs/features/<id>.md
  { id: 'sites', name: 'Job sites', purpose: 'Keep the job sites you use in one place, with a note about each.' },
  { id: 'calendar', name: 'Add to calendar', purpose: 'Put an interview or a starred event into your phone\'s calendar.' },
  { id: 'print', name: 'One-page summary', purpose: 'A page you can print or save as a PDF: this week\'s jobs, dates and events.' },
  { id: 'bigtext', name: 'Bigger text', purpose: 'Larger text and stronger contrast, remembered on this device.' },
  { id: 'pay', name: 'Pay notes', purpose: 'The pay each posting gives, beside the pay you are aiming for.' },
  { id: 'reply-clock', name: 'Reply due', purpose: 'After an interview, shows the date the employer should have told you the result by.' },
  { id: 'recipe-followup', name: 'AI: follow-up message', purpose: 'Drafts a short follow-up or thank-you note for a job. You copy it yourself.' },
  { id: 'checklist', name: 'Posting checklist', purpose: 'What a posting must tell you in Ontario, and whether this one does.' },
  { id: 'contacts', name: 'People I met', purpose: 'A short note about people you met, linked to an event or a job.' },
  { id: 'stories', name: 'My examples', purpose: 'Short stories from your work, ready for interview questions.' },
  { id: 'resumes', name: 'Which resume', purpose: 'Which version of your resume you sent where.' },
  // 'board' was a separate tab here once. The board is now a List/Board choice inside Jobs, which keeps one place
  // for jobs and keeps the menu short. See docs/built/board.md.
  { id: 'week', name: 'This week', purpose: 'How many you applied to, followed up and went to this week. No streaks and no scores.' },
  { id: 'recipe-weekly', name: 'AI: weekly check-in', purpose: 'Sends your open jobs and suggests the next step for each, as suggestions.' },
  { id: 'recipe-sites', name: 'AI: sites for my field', purpose: 'Suggests job sites and organisations for your kind of work, to add to your sites.' },
];
