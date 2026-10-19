# A workshop

A page of words for the person running a session where people watch an agent change Search Desk, and then try
it themselves. Nothing here needs an install for the people in the room: a browser and a folder.

For building a feature on your own, with no session and no server, use [`BUILDING.md`](BUILDING.md). For a
one-file copy to put on a USB stick, use the build at the end of this page.

## Before the room

**The shape this page is for: every person has their own laptop, their own copy of this folder, and their own
agent.** One server per machine, on that machine, serving that person's own page. Nobody shares a folder, and
nobody watches a projector.

For the other shape, one machine on a projector with everybody watching, the only difference is that one person
runs the server and the rest watch. Everything else here is the same.

Each machine needs three things:

- **This folder.** A copy per person, from a tag or a zip, not a shared network folder: two agents editing one
  copy of `features/` will overwrite each other, and nobody notices until the screen is wrong.
- **An agent that can read and save files.** See
  [`BUILDING.md`](BUILDING.md#free-ways-to-get-help-from-ai) for the free ways.
- **Python 3 with `uv`.** In this shape everyone runs the server, not just the host: `uv run tools/serve.py`.

Node is only for running checks, so only the host needs it, and even that is optional
(`bash checks/check.sh <id>` works with no Node at all).

### Set the appearance to Light

Check the machine's appearance is **Light**, in System Settings, then Appearance. Search Desk has no in-app
switch and follows the device, so a Mac left on **Auto** turns dark at sunset, in the middle of a session that
started light. On a projector it is worse than a flicker: dark text on a bright wall is hard to read from the
back of a room. Ten minutes of setup saves a room of squinting.

### If a machine cannot run any of this

Some managed computers have no Python and no `uv`. Two things still work there:

- **No Python? Open the page from the folder instead.** Double-click `index.html` and press Cmd-R after each
  change. That is the whole loop minus the automatic reload, and much better than sitting the session out.
- **No agent either?** [`KITS.md`](KITS.md) is the same fourteen features as text to paste into a browser
  chat. There is no live loop in that session: people paste, they wait, they read the answer back. Worth
  running, but it is a different session, and better to know before the room fills up than after.

## 1. Start the page

On each machine, from inside the Search Desk folder:

```
uv run tools/serve.py --workshop --rebuild
```

It prints an address, usually `http://127.0.0.1:8000/`. Open that in a browser. Three things are now true, and
they are the whole reason this exists:

- **The page reloads itself when a file changes.** Nobody has to press a key to see what the agent just did.
  If somebody is typing in a text box, the page waits instead and shows a small blue bar: *New version ready.*
  Half-written job notes are worth more than a fresh screen.
- **There is no build step.** The page loads each feature as its own file, so a saved file is the next reload.
- **It cannot go stale.** Nothing is cached, and the source page does not register the service worker, because
  that only happens in a built copy. What is on the screen is what is on the disk.

`--workshop` opens straight into Amira (made up), shows a banner saying it is a practice computer, and turns
live events off so the page asks the network for nothing. Change the banner with
`--banner "Your words here"`.

Add `--rebuild` and the single file for taking home (`dist/workshop/searchdesk.html`) is rebuilt on every
change, so it is never behind the screen.

**On a phone or a second laptop:** stop and start it with `--host 0.0.0.0`. It prints a second address for the
wifi. Nothing about the app changes. It hands out the page's own files and nothing else: not `.git`, not
`docs/`, and never a `searchdesk-<date>.json`, which is where a person's exported backup lands if they save
one into this folder. Keep that in mind before you put it on an open network.

## 2. The loop, and what to say

Say this once, at the start:

> Tell the agent what you want in one sentence. It writes the code and the page updates by itself. Then look at
> it, and tell it what to change.

Then the loop is four steps, over and over:

1. **They say what they want.** One sentence is enough. "I want a page that shows me this week's interviews."
2. **The agent writes one file** in `features/`, and says which file it changed.
3. **The page updates by itself.** If it does not, the agent was told to write its name in `.dev-go`; that is
   how the tab moves to the new screen, so nobody has to go looking for a tab that just appeared.
4. **They try it.** Then they say what is wrong, in their own words, and it goes round again.

Two rules for the agent, and they are the difference between a good session and a frustrating one:

- **One feature at a time.** Finish something that works before starting the next thing.
- **Never touch a real person's data.** Amira is made up. No real names, no real employers' contact details, no
  real job applications. The whole session runs on `data/example.js`.

## 3. When it goes wrong

Almost everything that goes wrong has a small, plain answer. Have these ready:

| What you see | What it is | What to do |
| --- | --- | --- |
| The page did not change | The agent did not save, or the id is not in `features/list.js` | Ask which file it changed. It must be in `features/`, lowercase. |
| A tab called "not built yet" | The id is listed but `features/<id>.js` is not there | The file name has to match the id exactly, in lowercase. |
| The page says a check failed | A real failure, in plain words | The agent fixes the feature file, **not** the check file. Say that out loud if it tries to change the check. |
| The blue bar sits there and nothing happens | Somebody was typing when the file changed | Read it as a good sign: the page protected their typing. Click the bar when they are ready. |
| Everything is broken | A feature took the page down with it | The agent takes the id out of `features/list.js`. The rest of the app keeps working. Then it puts it back once it is fixed. |
| A person's screen is empty and they want it back | They removed the made-up person | Data tab, then "Try with a made-up person". Nothing else was lost. |

If the page is so broken that nothing works, stop the server, `git checkout -- features/ core/` puts every file
back, and start it again. Nothing anybody did is in the history, so this is always safe.

## 4. `#selftest` is their check, not yours

In the browser, `#selftest` runs every loaded feature's check and the contract scan, and says pass or fail in
plain words. It is the one thing in the session that needs no agent at all, which makes it the best moment of
the session: **have each person run it themselves.** Watching an agent say "all good" means nothing; watching
the page say it means everything.

## 5. At the end: one file to take home

Each person runs this on their own machine, and keeps the file:

```
uv run tools/build.py --workshop
```

That writes `dist/workshop/searchdesk.html`: one file, no server, no install, Amira already in it and the
network never asked for anything. It opens in Chrome from a USB stick or an email attachment. If the server was
started with `--rebuild`, the file has been kept fresh all along and this is only being run again to be sure.

Worth doing in the room, because it is the clearest ten seconds of the session: somebody's feature goes from
"it worked on my screen" to a file they can double-click on any computer, with nothing installed.

For a normal copy instead (live events on, starts empty), run `uv run tools/build.py`.
