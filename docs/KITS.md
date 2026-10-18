# Building one with nothing installed

This page is for a machine that will not let you install anything: a locked-down work computer, a library machine, an
IT policy, no administrator. You need a browser chat and a plain text editor. Nothing else, and no account beyond the
chat.

**If you can install a coding agent, stop reading.** [`BRIEFS.md`](BRIEFS.md) has the same fourteen features, each
with the same brief, and an agent does the work: nothing is copied, no list is edited by hand, and the feature's own
check runs. This page exists so the project is not unusable on exactly the kind of computer that cannot run an agent.

The fourteen are the project's real planned work, not practice material. Most will be in a later version of Search
Desk. The feature you build here is the same feature, built by hand because that is what this machine allows.

| Id | In plain words |
| --- | --- |
| `bigtext` | Larger text and stronger contrast, remembered on this device. |
| `calendar` | Put an interview or a starred event into your phone's calendar. |
| `checklist` | What a posting must tell you in Ontario, and whether this one does. |
| `contacts` | A short note about people you met, linked to an event or a job. |
| `pay` | The pay each posting gives, beside the pay you are aiming for. |
| `print` | A page you can print or save as a PDF: this week's jobs, dates and events. |
| `recipe-followup` | Drafts a short follow-up or thank-you note for a job. You copy it yourself. |
| `recipe-sites` | Suggests job sites and organisations for your kind of work, as suggestions. |
| `recipe-weekly` | Sends your open jobs and suggests the next step for each, as suggestions. |
| `reply-clock` | After an interview, shows the date the employer should have told you the result by. |
| `resumes` | Which version of your resume you sent where. |
| `sites` | Keep the job sites you use in one place, with a note about each. |
| `stories` | Short stories from your work, ready for interview questions. |
| `week` | How many you applied to, followed up and went to this week. No streaks and no scores. |

The app lists the same set on its **Data** tab as "Ideas you could build". Not sure which to want? Say what your job
search is like and ask the chat which of these would help. The whole brief for any of them is one page in
`docs/features/<id>.md` if you want to read before you choose.

`docs/kits/index.html` is the same list with a **Copy this kit** button on each one, if you would rather browse in a
browser than read this page.

## What a kit is

A kit is one text file with everything a browser chat needs to build that one feature: the instructions, the rules
the file has to follow, a worked example, and the brief. They are in `docs/kits/<id>.txt`, written from
`docs/features/<id>.md`. Do not edit a kit by hand: `python3 tools/kit.py` writes them all again, and
`python3 tools/kit.py --check` says if one is out of date.

A kit is not tied to a particular chat. Any of them takes the same file.

The brief is the canonical copy. The kit is that brief packed for something that cannot open a file. That is the only
difference between this page and [`BRIEFS.md`](BRIEFS.md).

## Build it

1. Open `docs/kits/<id>.txt` for the feature you picked, for example `docs/kits/bigtext.txt`.
2. Copy all of it. Use select all, then copy.
3. Paste it into a new chat and send it.
4. The chat gives back one file, inside a box. **Copy the code inside the box, not the box marks.** If you copy the
   three backticks as well, the file will not load, and the menu will show a stub instead of the feature.
5. Save it as `features/<id>.js`, for example `features/bigtext.js`. Use lowercase. Save plain text, not a
   word-processor file.
6. Open `features/list.js`. Find the line that starts with `Desk.features = [`. Add the id to the end of the list,
   inside the brackets, in quotes, with a comma before it:
   `..., 'recipe-custom', 'bigtext'];`
   Leave the id in the `Desk.planned` list below it **for now**. That list is what gives a feature that will not load
   its name and its one-line description; delete the line once the self-test is clean (step 9).
7. Reload Search Desk in the browser.
8. Open `#selftest` (add `#selftest` to the end of the address). It checks every part for the rules it has to follow.
   A part built this way has no check file, so its row says "No check file". **That is not a problem**, and it is not
   red: nothing red means the file follows the contract.
9. Now use the feature and see that it does what the brief said. This is the check you have without Node. When it
   works, open `features/list.js` again and delete the line for this id from `Desk.planned`, so it stops appearing
   under "Ideas you could build" on the Data screen.
10. If `#selftest` shows a problem, copy the problem text. Paste it into the same chat and write: "Fix this. Reply
    with the whole file again." Save the new file over the old one and reload. Repeat until it passes.

**What this route gives up**, so you know what you are looking at. Nothing runs the logic: a feature built this way
has no check file, so `#selftest` confirms the file follows the rules and step 9 is the only test of whether it works.
A free-tier chat is usually a smaller model than an agent would use, and a kit is a long paste, which some free
tiers will not take in one go. Step 6 is also done by hand: if the file does not load, the id in `features/list.js`
is the first thing to check. If a step fails twice, stop, and if you can install an agent anywhere, use one. That is
[`BRIEFS.md`](BRIEFS.md), and it is the same fourteen.

## Changing one that is built

1. With an agent: say what you want in one plain sentence. It reads the current file first, so there is nothing to
   paste. Ask it to rerun that feature's check, then `#selftest`.
2. With a browser chat: paste the kit and the current file (for example `features/jobs.js`), say what you want, and
   say "Reply with the whole file again, nothing else." Save over the old one and reload.

Keep a copy of the old file first. If the new one breaks, put the old one back.

## A feature of your own

If none of the fourteen is what you need, you do not need to force one. Say what you want and
[`BUILDING.md`](BUILDING.md) starts from an empty page: it covers writing the brief yourself, and an agent does the
rest. Writing a brief is not much work; the fourteen above are all one page each. The agent can turn your brief into
a kit afterwards, which is how every kit on this page was made.

## What can go wrong

- The page looks the same. You did not reload, or the id is not in `features/list.js`.
- `#selftest` says "This part is not built yet." The file name does not match the id, or it is not saved in
  `features/`. Names are lowercase.
- The file is cut off at the end. The chat ran out of room. Ask: "Continue" and join the parts, or ask for the whole
  file again.
- A word-processor added curly quotes. Use a plain text editor.
- The chat used a banned word (such as `innerHTML` or `fetch`). `#selftest` shows which one. Paste the problem back.
- The chat added words around the code, or gave you several files. Say: "Give me one file only. Put everything in
  `features/<id>.js`." Copy only the code inside the box.
- Two features have the same id. The second replaces the first. Pick a new id.
- Something breaks that you cannot fix. Take the id out of `features/list.js` and reload. The rest of the app works.

## For agents and developers

The rules are in [`AGENTS.md`](../AGENTS.md) and [`CONTRACT.md`](CONTRACT.md). `tools/kit.py` writes the kits and
checks them, and `docs/kits/index.html` comes from the same tool, so neither goes stale on its own. The same fourteen
with an agent, and the mechanics for an idea of your own, are in [`BRIEFS.md`](BRIEFS.md) and
[`BUILDING.md`](BUILDING.md).

**Some of these will be in a later version.** That is the ordinary way this project grows: a feature gets written
from its brief, lands in a release, and its brief moves to `docs/built/` and drops off this page. The page shrinking
is the sign it is working. `board` already went that way: it was its own feature, then became a choice inside Jobs.

If you take one away with you and the project later ships its own version of the same idea, you will have two files
with the same id. Rename yours: the id is yours to choose, and `features/<id>.js` has to match
`checks/<id>.check.js`. Both then work side by side.
