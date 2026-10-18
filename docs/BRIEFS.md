# Building one that is already written up

This project is also used to teach workshops about building software with AI, and in a room most people arrive with no
idea of their own. That is who this page is for. **Fourteen features are already written up**, one brief each, and
every one of them does something real for someone looking for work. Pick one, build it with a coding agent, and you
have built an actual feature of this app. You do not need to be in a workshop to do it.

Each brief is one page in `docs/features/<id>.md`. It has the same shape as the brief you would write for an idea of
your own, so nothing here is a different kind of work. If your idea is not on this list, [`BUILDING.md`](BUILDING.md)
is the page for it.

Some of these are here because a feature that fits in one sitting is a good way to see what an agent can do. Most
will be in a later version of Search Desk. When one is built, its brief moves to `docs/built/` and its row leaves
this page. The list getting shorter is the sign it is working.

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

The app lists the same set on its **Data** tab as "Ideas you could build".

## Build it

1. Open your agent in the Search Desk folder.
2. Say: "build `week`", or "read `docs/features/week.md` and build that".
3. The agent reads the brief, writes `features/<id>.js`, adds the id to `features/list.js`, runs that feature's
   check, and tells you what passed.
4. Reload the page and open `#selftest`. That is the final check.

Not sure which one to want? Say so. The agent asks one short question about what would help, then offers a few, one
at a time.

## If the machine will not let you install an agent

[`KITS.md`](KITS.md) has the same fourteen as kits: one text file each, the brief packed with the rules and a worked
example, for a browser chat that cannot open a folder. It is the route for a locked-down work computer, a library
machine, or an IT policy. It needs nothing installed, and it says what that route gives up.

## For agents and developers

The rules are in [`AGENTS.md`](../AGENTS.md) and [`CONTRACT.md`](CONTRACT.md). Checks:
`node checks/run.js <id>` and `node --test tests/unit/*.test.js`. The mechanism is the same as
[`BUILDING.md`](BUILDING.md) describes; the difference is only that the brief is already written.
