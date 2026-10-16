---
name: interview-harness
description: Test Search Desk's coach instructions (interviewer prompt v4 and later) through isolated role-agent conversations or focused prefilled transcript continuations. Use for interview prompt trials, regressions, partial-interview feedback, or coverage checks. Uses the current coding harness's subagents, not external model APIs or child CLIs.
---

# Interview prompt trials

This is the portable entry point. Instructions are harness-neutral; adapt agent tool names, never the role inputs or test expectations. Resolve this directory in the current checkout by locating `tools/interview-harness/COORDINATOR.md`; do not rely on a previous machine's absolute path or the location of a discovery symlink.

## Read only what the task needs

1. The prompt under test is the **release output** of the app's coach recipe, never a copy. Export it with `node tools/interview-harness/export-prompt.js --workshop [--options key=value ...] > <new-output-dir>/../prompt.txt` (for example into `runs/`, which is Git-ignored) and pass that file as the `prompt` path. Count the exact text including its final newline; reject over 1,500 characters (the exporter and the scripts already do). The canonical wording lives in `features/recipe-coach.js`; `tests/unit/golden/coach-v4.txt` is v4. `--workshop` is the text v4 was tested as (3 questions plus the workshop sentence); without it you get a normal copy's text (5 questions, no workshop sentence), which has not been harness-tested. `harness.py init` and `cases/prepare.py` default to the workshop text (`--normal` switches). To test other option sets, export each one separately and record the options in the run notes.
2. `models.json`: user-approved role model defaults in this repository. Do not guess model aliases across providers. If a harness does not offer those IDs, ask for an equivalent selection rather than silently changing models.
3. Choose **full conversation** or **focused continuations**, below. Default to the mode requested. If asked simply to retest the current prompt, run focused cases relevant to the change and one ordinary full round, within any usage limit the user specifies.

No package install, external API key, CLI login, or service setup is needed for the subagent route. It uses the current harness's normal model access and usage. Python 3 is needed only for deterministic file preparation/snapshots.

## Full conversation

- Read `COORDINATOR.md` and use `scenario-rich.json` unless another scenario is requested. Use a new output directory under `runs/`, never an existing run. Resolve paths to absolute paths in this checkout before passing them to isolated agents.
- Launch one coordinator on the configured model with **no inherited conversation**. Supply: coordinator instructions path, exact prompt path, scenario path, new output path, max_messages=14. Explicitly authorize it to create the two role agents. The root plus coordinator and two roles require four active agent slots.
- The coordinator alone handles relaying. Give the interviewer only the prompt, public context/posting and candidate replies. Give the candidate only its instructions, public context, the candidate-fixture snapshot path and interviewer replies. The coordinator copies the fixture without reading its contents. Candidate may read/search that file only.
- Trigger an actual next turn when delivering a reply; some harnesses distinguish “send message” from “resume.” Keep role histories alive. If only transcript replay is available, label the run accordingly. If neither isolated subagents nor equivalent independent sessions are supported, report the limitation; do not impersonate both roles in one completion.
- Default stop is debrief plus retry invitation, or the message cap. A full retry needs an explicit extended stopping rule: selection, re-asked question, candidate answer, then coach feedback. Keep a hard cap and record it.
- Parent evaluates the saved transcript against the fixture **after** execution. Coordinator does mechanics only in private-fixture mode.

## Focused continuations

- Read `cases/README.md`. Prepare a fresh directory using `python3 <harness>/cases/prepare.py <new-output>`; use `--only ID ...` for targeted regression checks. Requests snapshot the current prompt and suite; no overwrite.
- A configured Luna coordinator may execute the prepared requests. Each `.request.txt` goes verbatim to a **fresh, no-inherited-context Sol interviewer**, sequentially. No candidate agent is needed. Do not show case purpose, expected results, other cases or rubric to that interviewer.
- Save exact responses to matching `.reply.txt` and execution metadata (agent IDs, requested/actual models if known, prompt hash, suite version). Parent evaluates against saved `suite.json` afterward. Prefilled JSON transcripts are replayed context, not native injected assistant messages; document that limitation.

## Evidence and reporting

- Every run snapshots exact prompt, scenario/suite, fixture if used, transport instructions and hashes. Record requested models and actual IDs only if exposed; never invent them.
- Preserve every role response unchanged. Keep candidate private data and evaluator expectations out of interviewer context. Do not let the coordinator improve or grade messages while relaying.
- Use pass / partial / fail / not observed with excerpts. A saved response or normal stop is not a passing assessment. Missing candidate facts do not demonstrate lack of skill; plausible invented history is still a grounding error.
- Check pace, relevance, past-example coverage, follow-up limits, stop signals, proportional feedback, known outcomes and retry behaviour. Separate candidate drift from interviewer failure.
- Single-model simulations are not real-chat or human validation. Tool-free trials do not test browsing. Repeat failures after revision and run a full regression after local branch fixes; do not cite an older prompt's passes as current coverage.
- Leave prompt edits, trials and reports uncommitted unless asked. `runs/` is Git-ignored: tell the user where results live; copy a short assessment and the exported `prompt.txt` into `evidence/<run>/` if asked to keep it.
- Report prompt character count, cases/turns executed, observed issues, untested requirements and links to results. Do not claim a cost estimate without measured usage.

## Fixtures

`fixtures/amira-v3.md` and the `scenario*.json` files describe a made-up Amira with a rich volunteering history (a beginner from a community clothing swap). She is a different person from the app's example Amira in `docs/inputs/example-person.md` (the experienced accounts-payable clerk, loaded by `data/example.js`). Both are fine as test people. Keep these for prompt comparisons, since earlier results used them, and say which Amira a result used.

## Discovery in other harnesses

The canonical skill is this file, stored with its scripts and fixtures. Any harness can follow it by reading the path explicitly. Automatic discovery is harness-specific: a Claude project skill can link here from `.claude/skills/interview-harness/SKILL.md`; Codex can use a link from `.agents/skills/interview-harness/SKILL.md` where writable; other harnesses can install/link their supported skill directory. Do not duplicate the instructions or silently install into a user's home directory. This task's `.agents` directory may be read-only; a manual path invocation is sufficient.
