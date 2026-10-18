# People I met  (id: contacts, size: M)
In plain words: A short note about people you met, linked to an event or a job.
Why someone wants it: Most jobs come from people. A note about who you met, and what they said, is what you need
when you write to them a week later.

Done when:
- [ ] An agent in the folder adds `checks/contacts.check.js`, and `node checks/run.js contacts` passes.
- [ ] A "People" item is in the menu. It lists people, newest first, with name, where you met, and a short note.
- [ ] You can add, edit and delete a person. A name is needed. Delete can be undone with the toast's Undo.
- [ ] A person can have a "next step" date (`YYYY-MM-DD`). People whose date is today or earlier are listed first,
      marked as due.
- [ ] A job's detail view has a "People" section listing the people linked to that job, and an "Add a person for this
      job" button that starts the form with the job chosen.
- [ ] Each event row has a "I met someone here" button. It starts the form with the event's title and date filled in.
- [ ] A person linked to a job that was deleted still shows, with the job part left out.
- [ ] The person's name is not sent to any AI (this feature adds no recipe).

Data: owns `contact` = `{name, role, org, note, jobId, eventTitle, eventDate, nextStep}`; all but `name` may be empty.
No email addresses or phone numbers are asked for: write them in the note if you want them.
Record types: `contact`.
Slots: `tab`, `job.panel`, `event.actions`   Soft uses: none.
ctx calls: `ctx.slot` (three), `ctx.store.all('contact')`, `put`, `remove`, `batch`, `ctx.store.all('job')`,
`ctx.ui.go('contacts')` (keep the starting values for the form in a variable inside `mount`, because a route carries only plain parts),
`ctx.fmt`, `ctx.ui.toast`, `ctx.t`, `ctx.h`. Events are not records: `event.actions` gives you the event object
`{id, title, start, ...}`; copy the title and the date into the contact.

Checks to write (in `logic`):
- `cleanContact(input)` trims text, needs a name (`problem: 'needName'`), and drops a `nextStep` that is not a date.
- `sortContacts(list, today)` puts due people first, then newest first; it does not change its input.
- `forJob(contacts, jobId)` returns the people linked to that job, not deleted.
- `fromEvent(event)` gives `{eventTitle, eventDate}` using the first ten characters of `start`.

Out of scope: syncing with a phone's address book; email links; reminders outside the page.
Ideas for after: a "Write to them" button that uses `recipe-followup`; show due people on Home; a `print` section.
