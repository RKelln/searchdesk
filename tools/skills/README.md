# Skills

One file per skill, and it is the real one. Each agent gets a copy, written by
`python3 tools/agent-files.py`, into whichever folder it reads skills from. Two destinations are configured at
the moment:

- `.agents/skills/<name>/SKILL.md` — the shared convention several agents read
- `.claude/skills/<name>/SKILL.md` — for the agent that does not read `.agents/skills/`

Those folder names are the one place a tool's name belongs, because a tool cannot be told where its own skills
live. An agent you add later needs one line here and nothing else in this repo changes: the skill bodies name no
tool, so they cannot go stale.

To change a skill, edit the file here and run the tool. Do not edit a copy:
`python3 tools/agent-files.py --check` says if any is out of date, and `node --test
tests/unit/agent-files.test.js` fails in CI when one is. A file named `README.md` or starting with `_` is a note,
not a skill, and is not copied.

Frontmatter keeps to the open Agent Skills standard: `name` and `description`, one line each. The tool takes `name`
from the file name, so a `name:` line here is read but not needed.

A skill body may use `{{id}}` for an input. There is no substitution when a skill is read, so it becomes `<id>`: a
blank for the person to fill. Write each sentence so it reads correctly that way. See
[`../commands/README.md`](../commands/README.md) for the other half of this.

A command in `tools/commands/` also arrives here as a skill, for the agents that have no project commands to put
one in.