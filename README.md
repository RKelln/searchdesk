# Search Desk

Search Desk is a job search helper that runs in your web browser. It keeps your jobs, dates, events and free help in
one place. If you want, it also helps you use a free AI chat by copy and paste.

**This is an early prototype, made for people in Toronto.** The events, free help and job posting rules are for
Toronto and Ontario. Things may change or break, so save a copy of your data now and then (see below).

This page has three parts:

1. [For people looking for work](#for-people-looking-for-work)
2. [For libraries and workshop hosts](#for-libraries-and-workshop-hosts)
3. [For developers](#for-developers)

## For people looking for work

### What it does

- **Jobs.** Write down each job you apply for, with its dates (when you applied, when to follow up, when it
  closes, your interview). It shows what is coming up next.
- **Events.** See career and job search events in Toronto, and star the ones you want to go to.
- **Help.** A list of free help, from people and online. If you do not know where to start, call 2-1-1. It is a free
  helpline that points you to the right service.
- **AI helper (optional).** Search Desk writes a question for you. You copy it into a free AI chat, then copy the
  answer and paste it back. What comes back is a suggestion. You choose what to keep. It never changes your jobs by
  itself.

Everything except the AI helper works without any AI.

### Where to open it

Use the hosted copy: https://searchdesk.ryankelln.com.

### Your data stays on this device

Your jobs and notes are kept in your browser, on the device you use. They are not sent anywhere. So save a copy
now and then:

1. Open the **Data** tab.
2. Press **Save a copy to a file**. (Other choices there are **Send a copy to myself** and **Copy as text**.)
3. To bring a copy back, use **Bring back a copy** on the same screen: pick the file, or paste the text.

If your copy has older things than your device does, the newer things are kept. You can undo a bring-back.

### Try it safely with Amira

Not sure how it works? On the **Data** tab, press **Try with a made-up person**. This adds Amira (made up). She is
not a real person. She has a few jobs and dates so you can look around. Your own things are not touched, and she is
not in the copies you save. Press **Remove the made-up person** when you are done.

## For libraries and workshop hosts

### Run a workshop

The short version: start the page, then let people watch an agent change it.

```
uv run tools/serve.py --workshop --rebuild
```

(`python3 tools/serve.py --workshop --rebuild` is the same thing where `uv` is not installed: standard library
only, nothing to install. Drop `--workshop` if the folder already carries `data/workshop.js`.)

It prints an address, usually `http://127.0.0.1:8000/`. The page reloads itself every time a file changes, so
there is nothing to press and no build step; Amira is already loaded, the banner says it is a practice computer,
and the page asks the network for nothing. Writing a screen's name in `.dev-go` moves the open tab there, so a
new feature can be shown without anybody going looking for it.

[`docs/WORKSHOP.md`](docs/WORKSHOP.md) is the whole thing: what to say, what to do when it breaks, how to get
each person to run `#selftest` themselves, and what to build at the end.

### Build one file to hand out

A workshop copy is one file. It opens straight into Amira, shows a banner ("Practice computer: use the made-up
person only."), and turns live events off, so the page asks the network for nothing.

1. On a computer with `uv` (and Python), from this folder, run:

   ```
   uv run tools/build.py --workshop
   ```

   This writes `dist/workshop/searchdesk.html`. To change the banner words, add `--banner "Your words"`.
2. Copy that one file to each workshop computer (a USB stick works).
3. Open it in Chrome. It works from a file with no server and no internet.

Some managed computers have no Python, Node or git. If yours does not, build on another computer and copy the file
over. Finder may leave `.DS_Store` files in folders; ignore them.

**A folder copy can leave the development tools out.** `tools/`, `tests/e2e/`, `reference/` and this repo's own
`docs/PLAN.md` and `docs/DESIGN.md` are for working on Search Desk, not for running it, and a folder you hand to
people does not need them. Take the folder rather than the repository — the tracked files at a tag — and the unit
suite in it still passes:

```
node --test tests/unit/*.test.js
```

Checks that read a file the folder does not carry skip and name it, rather than failing and making the code look
broken. Skipped is not passed, so read the count. Nothing about the app itself is skipped.

For a normal copy (live events on, starts empty), run `uv run tools/build.py`. It writes `dist/searchdesk.html`
(also `dist/index.html`, plus a manifest and icons, so you can host the `dist` folder on any web server).

People's saved data is kept per browser. On a shared computer, the made-up person is the safe way to practice.

### The locale pack

Everything that belongs to one city is in one file: `locale/toronto.js`. It is plain data, no code. It holds:

- `help`: the free help entries. Each has a name, what it is, how to use it, who it is for, and a source link.
  `kind: 'person'` is shown first ("Free, from people"); `kind: 'online'` is for things you do on your own.
- `helpNotes`: the two short lines on the Help screen.
- `sites`: the default job sites.
- `services`: the free AI chats the app offers (name and link).
- `events`: the events API address and the tiers (for example "At the library" and "Around the city"), each with its
  search words. A tier can also have `match` words: its list then shows only events with one of those words in the
  title, and a button shows the rest.
- `postingRules`: the posting rules for the area (Ontario's O. Reg. 476/24), the checklist, and how many days an
  employer has to reply.

To make a pack for another city, copy `locale/toronto.js`, change the values, and point `index.html` at your file.
Keep help text to what you read on each service's own page, and keep every link `https`. Run the unit tests
(below) to check the shape; `tests/unit/locale.test.js` covers it. The page may talk to only one network host, the
one in `events.api`, and the build sets its security rule from that address.

### Where the events come from

Events come from Togather. For now the app uses the Togather staging server
(an early test, not production). A snapshot of events ships inside the app, so the list is not empty when offline.
Regenerate it with `uv run tools/snapshot.py` (see below).

## For developers

Start with these:

- [`AGENTS.md`](AGENTS.md): the principles and rules. Read this first, also if you use an AI agent.
- [`docs/CONTRACT.md`](docs/CONTRACT.md): the `ctx` API, slots, `h()`, checks, and a full example
  (`docs/example-feature.js`).
- [`docs/DESIGN.md`](docs/DESIGN.md) and [`docs/PLAN.md`](docs/PLAN.md): the design and the task list.
- [`docs/RECIPES.md`](docs/RECIPES.md): how the instructions sent to AI are made and changed.
- [`docs/BUILDING.md`](docs/BUILDING.md): how to build a feature of your own with a coding agent.
- [`docs/BRIEFS.md`](docs/BRIEFS.md): the fourteen features already written up, each with a brief.
- [`docs/KITS.md`](docs/KITS.md): the same fourteen as paste packets, for a browser chat with nothing installed.
- [`docs/features/`](docs/features/): a short brief for each feature not built yet.
- [`reference/`](reference/): reference builds of some of those features, with their checks and tests. They are
  not loaded by the app.

The idea: no dependencies, no build step to run or extend it, plain files. Open `index.html` in a browser. Each
feature is one file in `features/` that follows one contract, and a missing feature breaks nothing.

Commands:

```
node --test tests/unit/*.test.js            # unit tests (keep the glob)
uv run tests/unit/test_build.py             # unit tests for the build tool
uv run tests/unit/test_serve.py             # unit tests for the workshop server
node checks/run.js <id>                     # check one feature, e.g. example
bash checks/check.sh <id>                   # the same, on a Mac with no Node
uv run tests/e2e/run.py                     # browser tests
uv run tools/build.py                       # single-file build into dist/
uv run tests/e2e/run.py --app dist/searchdesk.html   # browser tests on the built file
uv run tools/snapshot.py                    # regenerate the events snapshot (needs the network)
uv run tools/serve.py --workshop            # the page, for a workshop: it reloads itself on every change
```

In the browser, `#selftest` runs every loaded feature's check and the contract scan. See `tests/e2e/README.md` for
test options.

Licence: see `LICENSE`.
