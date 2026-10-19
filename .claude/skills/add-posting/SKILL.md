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
- Write the record without asking first. Then check it landed, from the desk's own copy: wait a few seconds (the page
  reloads and merges the inbox by itself, and `searchdesk-live.json` follows about a second later), then run
  `python3 tools/read-desk.py --find <the employer>` (the `read-desk` skill has the rest).
- Then say what you added, in plain words: the title, the employer, the requirements and the fields you left blank.
  If the job is in the copy, say so. If it is not, say it has not shown up yet: the page may not be open, or the server
  was not started with `--mirror`. Do not claim it landed without having seen it, and do not say you cannot check:
  the copy is how you check. The job is in the desk where they can see it, and Undo on the banner or Delete on the job
  takes it out if it is wrong.
- You cannot read the browser's own storage. The copy file is the way to see the desk; if it is missing, start the
  server with `--mirror`, or ask for an export from the Data screen moved into the folder.

## Without an agent

If they ask how they could do this with a free chat instead: the desk's own helper on the Data screen takes the
posting, writes the question to copy, and fills the job form when the answer comes back. Point at the button they
can see rather than describing the machinery.
