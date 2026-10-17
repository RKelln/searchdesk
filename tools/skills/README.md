# Skills

One file per skill, and it is the real one. Each tool gets a copy, written by
`uv run tools/agent-files.py` (or `python3 tools/agent-files.py`):

- `.agents/skills/<name>/SKILL.md` — read by Codex, Antigravity, Pi and OpenCode
- `.claude/skills/<name>/SKILL.md` — read by Claude Code, which does not read `.agents/skills/`

To change a skill, edit the file here and run the tool. Do not edit a copy:
`uv run tools/agent-files.py --check` says if any is out of date, and `node --test
tests/unit/agent-files.test.js` fails in CI when one is. A file named `README.md` or starting with `_` is a note,
not a skill, and is not copied.

Frontmatter keeps to the open Agent Skills standard: `name` and `description`, one line each. The tool takes `name`
from the file name, so a `name:` line here is read but not needed.

A skill body may use `{{id}}` for an input. There is no substitution when a skill is read, so it becomes `<id>`: a
blank for the person to fill. Write each sentence so it reads correctly that way. See
[`../commands/README.md`](../commands/README.md) for the other half of this.

A command in `tools/commands/` also arrives here as a skill, because Codex and Antigravity have no project commands
left to put it in.