---
name: add-posting
description: Use when someone gives you a job posting as a link, as pasted text, or as a file, and wants it in their desk.
---

# Add a job posting to the desk

## Getting the text

1. **They pasted it.** Use what they pasted. Do not ask for it again, and do not summarise the requirements away.
2. **They gave a link.** Fetch that one address with WebFetch, if your tools have it. That page and no other: this
   is the task, not research.
   - If the fetch fails, say so in one sentence (no network, a sign-in wall, a page that builds itself with
     scripts) and ask them to select the posting text in the browser and paste it here. That is the normal
     fallback, not a failure; the desk's own helper works by hand the same way.
   - A job page carries more than the posting. Keep the title, the employer, the location, the requirements and the
     closing date if it gives one; drop navigation, similar jobs and adverts.
3. **A file in the folder.** In a workshop the posting is `workshop-assets/job-posting.html`: read it yourself
   rather than asking for a paste.

## Turning it into a record

- Read `docs/CONTRACT.md` for the record shape before preparing an inbox, and use the real schema rather than a
  guessed example. The inbox is `data/inbox.js`.
- Keep what the posting states: title, employer, location, the stage if it names one, the requirements, the closing
  date, and pay if it gives one.
- Leave blank rather than infer: pay it does not state, a closing date, a link, qualifications, experience, contact
  details.
- Show the title, the employer, the requirements and the fields you are leaving blank, in plain words, before you
  write anything.
- You cannot read the browser's storage from files. If the current records matter, ask them to export a backup into
  the folder and read that.

## Without an agent

If they ask how they could do this with a free chat instead: the desk's own helper on the Data screen takes the
posting, writes the question to copy, and fills the job form when the answer comes back. Point at the button they
can see rather than describing the machinery.
