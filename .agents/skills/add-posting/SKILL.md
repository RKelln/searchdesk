---
name: add-posting
description: Use when someone gives you a job posting as a link, as pasted text, or as a file, and wants it in their desk.
---

# Add a job posting to the desk

The rules for adding a posting are in `AGENTS.md`, section 1, and in the record contract behind it. This file only
covers the part that changes with the input: getting the text of the posting.

1. **They pasted it.** Use what they pasted. Do not ask for it again, and do not summarise the requirements away.
2. **They gave a link.** Fetch that one address with WebFetch, if your tools have it. That page and no other: this
   is the task, not research.
   - If the fetch fails, say so in one sentence (no network, a sign-in wall, a page that builds itself with
     scripts) and ask them to select the posting text in the browser and paste it here. That is the normal
     fallback, not a failure; the desk's own helper works by hand the same way.
   - A job page carries more than the posting. Keep the title, the employer, the location, the requirements and the
     closing date if it gives one; drop navigation, similar jobs and adverts.
3. **In a workshop**, the posting is the file `workshop-assets/job-posting.html`: read it yourself rather than
   asking for a paste.

Then follow section 1: show the title, the employer, the requirements and the fields that are unknown before you
write anything; write only what the posting says; never invent pay, dates, links, qualifications or experience; make
it a practice copy and tell them how to undo it.

If they ask how they could do this without a coding agent at all, that is the desk's own helper: paste the posting
into the AI helper on the Data screen, copy the question it writes, ask a free chat, paste the answer back, and the
desk fills the job form. Point at the button they can see rather than describing the machinery.
