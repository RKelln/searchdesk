#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Write the agent files each tool needs, from the two canonical folders in tools/.

Run:  uv run tools/agent-files.py          (or python3 tools/agent-files.py)   writes the copies
      uv run tools/agent-files.py --check  exits 1 and names any copy that is missing or stale, else 0

Canonical files, the only ones to edit:
  tools/commands/<name>.md   a slash command ("run this check"). Becomes a command AND a skill.
  tools/skills/<name>.md     a skill ("know how to do this"). Becomes a skill only.

Where the copies go, and why:
  .opencode/commands/  OpenCode command          (.agents/skills/ is read here too)
  .claude/commands/    Claude Code command       (the older command format; still supported)
  .pi/prompts/         Pi prompt template        (.agents/skills/ is read here too)
  .agents/skills/      Codex, Antigravity, Pi and OpenCode all read this one folder
  .claude/skills/      Claude Code skill         (Claude Code does not read .agents/skills)

No command copies for two tools, on purpose:
  Codex custom prompts are deprecated and live in ~/.codex/prompts, which a repo cannot share. Codex
    reads .agents/skills/ instead, so each command is also written there as a skill.
  Antigravity's own workflow files (.agents/workflows/) stop working on 19 October 2026, so writing
    them would be writing something that is already on its way out. Its replacement is .agents/skills/.

A command body may use {{id}} for an input. In a command copy it becomes $1, $2, ... in the order the
placeholders appear. {{all}} and {{request}} are the two names that mean everything the person typed, so
they become $ARGUMENTS. In a skill copy there is no substitution, so any of them becomes <the name>: a
blank for the person to fill. Write each sentence so it reads correctly both ways.

tests/unit/agent-files.test.js fails when a copy is stale, so CI catches drift. Standard library only.
"""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMANDS = ROOT / "tools" / "commands"
SKILLS = ROOT / "tools" / "skills"

# One folder of command copies, for the tools that still have project commands.
COMMAND_TARGETS = [".opencode/commands", ".claude/commands", ".pi/prompts"]
# One folder of skills, for everything that reads the open Agent Skills standard, plus Claude Code.
SKILL_TARGETS = [".agents/skills", ".claude/skills"]

PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")

# Skills the workshop kit adds to .claude/skills when a set is published (payload/kit in the TPL repo).
# They have no canonical file in tools/, so they are not copies of anything here. Without this list a
# workshop copy reports them as "a copy with no file to come from", and an agent whose instructions say
# to keep the unit suite green goes looking for a way to fix a file it must not touch.
KIT_SKILLS = {
    ".claude/skills/send-transcript/SKILL.md",
    ".claude/skills/take-home/SKILL.md",
}


def read(path):
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n").strip("\n") + "\n"


def split(text):
    """(frontmatter lines, body). A file with no frontmatter gets none."""
    if not text.startswith("---\n"):
        return [], text
    end = text.find("\n---\n", 3)
    if end < 0:
        return [], text
    return text[4:end + 1].splitlines(), text[end + 5:]


def field(lines, key):
    """One frontmatter value, e.g. description. The canonical frontmatter is one line per key."""
    prefix = key + ":"
    for line in lines:
        if line.startswith(prefix):
            return line[len(prefix):].strip()
    return ""


def as_command(body):
    """{{id}} -> $1, {{all}} or {{request}} -> $ARGUMENTS, numbered in the order they appear."""
    seen = {}

    def swap(match):
        name = match.group(1)
        if name in ("all", "request"):
            return "$ARGUMENTS"
        if name not in seen:
            seen[name] = len(seen) + 1
        return "$%d" % seen[name]

    return PLACEHOLDER.sub(swap, body)


def as_skill(body):
    """{{id}} -> <id>. A skill is read as it stands, so the name stays as a blank to fill."""
    return PLACEHOLDER.sub(lambda m: "<%s>" % m.group(1), body)


def canonical(folder):
    """path -> text, for the real files in a canonical folder, in a fixed order."""
    out = {}
    for path in sorted(folder.glob("*.md")) if folder.exists() else []:
        if path.name == "README.md" or path.name.startswith("_"):
            continue
        out[path] = read(path)
    return out


def expected():
    """target path -> text, for every harness."""
    out = {}
    for src, text in canonical(COMMANDS).items():
        lines, body = split(text)
        out[ROOT / ".agents" / "skills" / src.stem / "SKILL.md"] = skill(src.stem, field(lines, "description"), body)
        for folder in COMMAND_TARGETS:
            out[ROOT / folder / src.name] = command(lines, as_command(body))
    for src, text in canonical(SKILLS).items():
        lines, body = split(text)
        for folder in SKILL_TARGETS:
            out[ROOT / folder / src.stem / "SKILL.md"] = skill(src.stem, field(lines, "description"), body)
    return out


def command(lines, body):
    """A command copy. The canonical frontmatter is kept as it is, so every copy is the same."""
    return "---\n" + "\n".join(lines) + "\n---\n\n" + body.lstrip("\n")


def skill(name, description, body):
    """A skill copy. A skill needs a name, and has no use for an argument hint."""
    head = ["---", "name: " + name]
    if description:
        head.append("description: " + description)
    head.append("---")
    return "\n".join(head) + "\n\n" + as_skill(body).lstrip("\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="exit 1 if any copy is missing or stale")
    ap.add_argument("--paths", action="store_true", help="print every copy this tool writes, one per line")
    args = ap.parse_args()
    want = expected()
    if not want:
        print("nothing in %s or %s" % (COMMANDS.relative_to(ROOT), SKILLS.relative_to(ROOT)))
        return 1
    if args.paths:
        for path in sorted(want):
            print(path.relative_to(ROOT).as_posix())
        return 0
    if args.check:
        bad = []
        for path, text in sorted(want.items()):
            if not path.exists() or path.read_bytes() != text.encode("utf-8"):
                bad.append(path)
        known = set(want)
        for folder in COMMAND_TARGETS + SKILL_TARGETS:
            here = ROOT / folder
            for path in sorted(here.rglob("*.md")) if here.exists() else []:
                if path.relative_to(ROOT).as_posix() in KIT_SKILLS:
                    continue  # the kit's own skill, not a copy of anything here
                if path not in known:
                    bad.append(path)  # a copy with no file to come from
        for path in bad:
            state = "missing" if not path.exists() else "stale"
            print("%s: %s" % (state, path.relative_to(ROOT)))
        if bad:
            print("Run: uv run tools/agent-files.py")
            return 1
        print("agent files up to date (%d copies from tools/commands and tools/skills)" % len(want))
        return 0
    for folder in COMMAND_TARGETS:
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
    for path, text in sorted(want.items()):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        print("%-46s %5d characters" % (str(path.relative_to(ROOT)), len(text)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())