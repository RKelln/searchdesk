---
name: read-desk
description: Use when you need to know what is on the person's desk now, such as which jobs they have, what stage each is at, or what the profile says.
---

# Read what is on the desk

The desk's records live in the browser, so they are not in any file you can read until a copy is written. Read the
copy, and read only the part you need: a desk holds every posting and note in full, and most questions need a few
lines.

## Which copy

1. **`searchdesk-live.json`** in this folder, if the server was started with `--mirror`. The page keeps it up to date
   about a second after every change, so there is nothing for the person to do.
2. Otherwise the newest `searchdesk-<date>.json` in this folder. That is an export from the Data screen, and it is only
   as new as the moment it was made.
3. If there is none, say so, and either start the server with `--mirror` or ask the person to press Export on the Data
   screen and move the file into this folder. Do not guess at what is on the desk, and do not go looking in the
   browser's storage.

Do not look in `~/Downloads` unless the person says that is where they saved an export, and then add `--downloads`.
On a Mac the system stops to ask them for permission the first time anything reads that folder.

## Read a piece of it

Run `python3 tools/read-desk.py` rather than opening the file. It prints which file it used and how old it is, and:

- no options: how many records of each kind there are;
- `--type job` (or `event`, `profile`): one line per record, with the fields that matter;
- `--type job --stage interview`: only the jobs at that stage;
- `--find <word>`: the records that mention a word anywhere, one line each;
- `--id <id>`: one whole record. Add `--fields title,org,nextStep` for only those fields.

Start with the counts, then one `--type` list, then `--id` for the one record you need. Do not print the whole file,
and do not paste it back to the person: say what you found in a sentence or two.

## Things to remember

- Do not answer "what is on the desk" by opening the page in a browser of your own. That browser keeps its own
  records, apart from the person's, so it can show a different desk (it will even bring in `data/inbox.js` itself and
  look right). The copy comes from the person's page; a browser you open does not.

- A record marked `(made-up)` belongs to the practice person. It is fictional, and it is what the demo is built on.
- If the age it shows is older than the change you are asking about, the copy has not caught up. Say so, or ask for a
  new export; do not report an old copy as the current desk.
- This is reading. To add or change a record, write `data/inbox.js` as `AGENTS.md` describes, and give a changed
  record a new `updated`.
