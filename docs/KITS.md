# Building one of the ready features

Most people arrive with no idea of their own. That is normal, and it is what this page is for: **fourteen features
are already written up**, each with a brief and a kit, each doing something real for someone looking for work. Pick
one, build it, and you have built an actual feature of this app.

If you *do* have an idea of your own, you want [`BUILDING.md`](BUILDING.md) instead. That is the open-ended version
and it starts by writing a brief from scratch.

Nothing here is an exercise. Every one of these is work the project wants and has not built yet. The app lists the
same set on its **Data** tab as "Ideas you could build".

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

Not sure which to want? Ask an agent: it asks you one question about your search and then suggests a few.

`docs/kits/index.html` is the same list with a **Copy this kit** button on each one, if you would rather browse in a
browser than read this page.

## What a kit is

A kit is one text file with everything an AI needs to build that one feature: the rules it has to follow, a worked
example, and the brief. They are in `docs/kits/<id>.txt`, written from `docs/features/<id>.md`. Do not edit a kit by
hand — `python3 tools/kit.py` writes them all again, and `python3 tools/kit.py --check` says if one is out of date.

A kit is not tied to a particular tool. Both routes below take the same file.

## Build it with a coding harness

If you have an agent that reads and writes files, paste the kit into it and it does the work: reads the brief,
writes `features/<id>.js`, adds the id to `features/list.js`, runs the feature's check, and tells you what passed.

```
docs/kits/pay.txt        →  paste into your agent  →  features/pay.js, checked
```

That is the whole process. This is also how these features get built for real releases, which is why the briefs are
written the way they are.

## Build it with a browser chat, no installs

**Use this when the machine will not let you install anything** — a locked-down work computer, a library machine, an
IT policy. It is also a reasonable choice if you would rather not set an agent up at all.

You need a browser chat and a plain text editor. Nothing else, and no account beyond the chat.

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
A free-tier chat is usually a smaller model than a harness would use, and a kit is a long paste, which some free
tiers will not take in one go. Step 6 is also done by hand — if the file does not load, the id in `features/list.js`
is the first thing to check. If a step fails twice, stop, and if you can install an agent anywhere, use one.

## Changing one that is built

1. With an agent: say what you want in one plain sentence. It reads the current file first, so there is nothing to
   paste. Ask it to rerun that feature's check, then `#selftest`.
2. With a browser chat: paste the kit and the current file (for example `features/jobs.js`), say what you want, and
   say "Reply with the whole file again, nothing else." Save over the old one and reload.

Keep a copy of the old file first. If the new one breaks, put the old one back.

## A feature of your own

If none of the fourteen is what you need, you do not need to force one. Say what you want and
[`BUILDING.md`](BUILDING.md) starts from an empty page: it covers writing the brief yourself, and an agent does the
rest. Writing a brief is not much work — the fourteen above are all one page each.

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

`BUILDING.md` is the route for your own ideas. The rules are in [`AGENTS.md`](../AGENTS.md) and
[`CONTRACT.md`](CONTRACT.md). `tools/kit.py` writes the kits and checks them, and `docs/kits/index.html` comes from
the same tool, so neither goes stale on its own.

**Some of these will be in a later version.** That is the ordinary way this project grows: a feature gets written
from its brief, lands in a release, and its brief moves to `docs/built/` and drops off this page. The page shrinking
is the sign it is working. `board` already went that way — it was its own feature, then became a choice inside Jobs.

If you take one away with you and the project later ships its own version of the same idea, you will have two files
with the same id. Rename yours: the id is yours to choose, and `features/<id>.js` has to match
`checks/<id>.check.js`. Both then work side by side.