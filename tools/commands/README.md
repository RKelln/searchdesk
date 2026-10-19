# Commands

One file per command, and it is the real one. Each tool gets a copy, written by
`uv run tools/agent-files.py` (or `python3 tools/agent-files.py`):

- `.opencode/commands/` for OpenCode
- `.claude/commands/` for Claude Code
- `.pi/prompts/` for Pi

All three copies are the same bytes: they read the same frontmatter (`description`, `argument-hint`) and the same body
(`$1`, `$ARGUMENTS`). Two tools get no copy here, and get the command as a skill instead:

- **Codex** custom prompts are deprecated and live in `~/.codex/prompts`, which a repository cannot share.
- **Antigravity** workflow files stop working on 19 October 2026.

Both read `.agents/skills/`, so every command here is written there as a skill too. See
[`../skills/README.md`](../skills/README.md).

To change a command, edit the file here and run the tool. Do not edit a copy: `uv run tools/agent-files.py --check`
says if any is out of date, and `node --test tests/unit/agent-files.test.js` fails in CI when one is. A file named
`README.md` or starting with `_` is a note, not a command, and is not copied.

## These files ship

A workshop copy is a folder cut from a tag, and it keeps this folder, so an agent in the room reads these commands
too. Two rules follow. Name commands that work with `python3` alone, and mention `uv` as the alternative rather than
the only spelling. And keep workshop-only behaviour out: session rules belong in the brief the copy carries, so a
command here is true at home as well.

## Writing the body

Frontmatter keeps to two keys, one line each: `description` (shown in the tool's command list) and `argument-hint`
(the hint a person sees while typing). The tool copies them through unchanged.

For an input, write `{{name}}` in the sentence:

| In the body | In a command copy | In the skill copy |
| --- | --- | --- |
| `{{id}}` | `$1`, then `$2`, `$3` in the order they appear | `<id>` |
| `{{all}}` or `{{request}}` | `$ARGUMENTS`, everything the person typed | `<all>`, `<request>` |

A skill is read as it stands, with nothing to substitute, so the copy keeps the name in angle brackets as a blank for
the person to fill. Write each sentence so that it reads correctly either way: "Run the check for `{{id}}`" becomes
"Run the check for `$1`" and "Run the check for `<id>`".

The rules these commands point at live in [`AGENTS.md`](../../AGENTS.md), not here. Keep each body short and say which
part of `AGENTS.md` it means.