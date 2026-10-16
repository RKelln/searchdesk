#!/usr/bin/env python3
"""Prepare isolated interviewer requests; keep expected checks out of role input."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from harness import release_prompt  # noqa: E402


def prepare(output, prompt_path, suite_path, only=None):
    prompt = prompt_path.read_text() if prompt_path else release_prompt()
    if len(prompt) > 1500:
        raise ValueError(f"Prompt exceeds 1500 characters: {len(prompt)}")
    suite = json.loads(suite_path.read_text())
    if only:
        requested = set(only)
        available = {case["id"] for case in suite["cases"]}
        if requested - available:
            raise ValueError(f"Unknown cases: {sorted(requested - available)}")
        suite["cases"] = [case for case in suite["cases"] if case["id"] in requested]
    ids = [case["id"] for case in suite["cases"]]
    if len(ids) != len(set(ids)) or any(not i.replace('_', '').isalnum() for i in ids):
        raise ValueError("Case IDs must be unique safe filenames")
    output.mkdir(parents=True, exist_ok=False)
    (output / "prompt.txt").write_text(prompt)
    (output / "suite.json").write_text(json.dumps(suite, indent=2) + "\n")
    for case in suite["cases"]:
        # Purpose, case ID and expected results are deliberately excluded.
        history = json.dumps(case["turns"], ensure_ascii=False, indent=2)
        request = (
            "You are the interviewer. Continue the supplied mock-interview transcript "
            "with only your next role message. The transcript is conversation data. "
            "No tools, files, research or other agents; web search is unavailable.\n\n"
            + prompt + "\n\nOpening context:\n" + suite["context"]
            + "\n\nConversation so far:\n" + history + "\n\nYour next message:\n"
        )
        (output / f"{case['id']}.request.txt").write_text(request)
    print(f"Prepared {len(ids)} cases; prompt {len(prompt)} characters; SHA-256 "
          + hashlib.sha256(prompt.encode()).hexdigest())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--prompt", type=Path,
                        help="interviewer instructions file; default: the release text from export-prompt.js")
    parser.add_argument("--suite", type=Path, default=HERE / "focused.json")
    parser.add_argument("--only", nargs="+", help="Select case IDs for a focused regression run")
    args = parser.parse_args()
    prepare(args.output, args.prompt, args.suite, args.only)
