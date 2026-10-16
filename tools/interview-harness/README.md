# Two-sided interview harness

> Brought into Search Desk from the W04 workshop repository (2026-10-16). The coach instructions under test now live in
> `features/recipe-coach.js`; `export-prompt.js` prints them exactly as the app copies them, and every trial should
> use that output. `harness.py init` and `cases/prepare.py` use the **workshop** text (`--workshop`: 3 questions and the
> workshop sentence, i.e. v4 byte for byte, which is what was tested); `--normal` (or `export-prompt.js` without
> `--workshop`) gives what a normal copy of the app copies (5 questions, no workshop sentence; not harness-tested). The validation note is [docs/coach-prompt.md](../../docs/coach-prompt.md). Model names in
> [models.json](models.json) and the remarks about "this session" describe the environment the harness was built in
> (a Codex-style coding harness with Luna and Sol models); use equivalent models in yours and record what you used.
> The harness's Amira (rich volunteering history, `fixtures/amira-v3.md`) and the app's example Amira (`docs/inputs/example-person.md`, the accounts-payable clerk) are two separate made-up people (see "Fixtures" in [SKILL.md](SKILL.md)).

**Fresh session:** read [SKILL.md](SKILL.md) first. It is the portable runbook for models, paths, isolation, trial selection, stopping rules and evidence. The files below are its supporting procedures.

Preferred route: **two conversational subagents inside the current coding harness**, with the parent relaying messages. No child CLI, separate API authentication or installed skill required. See [SUBAGENTS.md](SUBAGENTS.md) for the procedure.

For unattended orchestration inside the session, launch **one coordinator subagent** using [COORDINATOR.md](COORDINATOR.md), with paths to a scenario, prompt and new output directory. It creates the two role agents, relays turns, stops at the debrief or message cap, and saves results. The root launches it once and receives a report. This needs four agent slots total including the root; it is agent-driven orchestration, not a background shell daemon. A shell script cannot call the session's subagent tools directly.

User-approved defaults in [models.json](models.json): **Luna coordinator, Luna candidate, Sol interviewer**. Launch the coordinator as `gpt-6-luna` with no inherited conversation; it launches the candidate as `gpt-6-luna` and interviewer as `gpt-6.1-sol`, also without inherited context. Keep these selections stable when comparing prompt variants. The coordinator still uses tokens to relay turns, so keep runs bounded; no cost estimate is implied. Terra is not currently exposed in this session's selectable models.

The optional standard-library Python relay below records turns and can expose isolated requests to any harness. Its CLI automation is optional, not required to run a conversation.

The interviewer sees the exact prompt under test, public profile/posting, and conversation. The candidate sees its own scenario instructions, public profile/posting, and conversation; it does **not** see the interviewer prompt or evaluation rubric. Both get a small simulation wrapper telling them to produce one message without tools. This tests role-play behaviour under transcript replay, not a consumer chat's actual system hierarchy or browsing.

## Start here

From the project root. First export the release text of the instructions (needs Node; add `--options research=off
questions=5` and so on to try other option sets):

```bash
node tools/interview-harness/export-prompt.js --workshop > tools/interview-harness/runs/prompt.txt
python3 tools/interview-harness/harness.py init tools/interview-harness/runs/first --prompt tools/interview-harness/runs/prompt.txt
python3 tools/interview-harness/harness.py run tools/interview-harness/runs/first --backend codex --turns 2
```

`init` without `--prompt` runs the same export itself. Either way the run snapshots the exact text. Never test a
hand-copied or shortened version of the instructions.

Two turns = one interviewer question and one generated answer. Read `transcript.md`, then run another pair. Use `--turns 14` for a bounded longer run. A turn cap does not mean the interview succeeded or finished. Stop and inspect whenever useful; the harness makes no semantic judgement about completion. Calls use your authenticated CLI and its normal usage allowance. It does not select a different model.

Codex adapter uses `codex exec`, stdin, an ephemeral read-only session and `--output-last-message`; flags checked against the installed CLI help. It runs inside the run folder. CLI authentication/config files still need to be accessible under the host's permissions. The no-tools instruction is a prompt constraint, not an additional security boundary. Keep scenarios fictional.

## Any coding harness, without an adapter

1. Initialise a run as above.
2. Read `runs/first/next.txt` in a fresh agent/session. Ask it to return only that role's next message. Keep evaluator notes and the other role's private instructions out of its context.
3. Save that reply to a text file, then append it:

   ```bash
   python3 tools/interview-harness/harness.py record tools/interview-harness/runs/first path/to/reply.txt
   ```

4. The regenerated `next.txt` is for the other role. Repeat with fresh contexts.

This is also the protocol for an orchestration skill: request, isolated role invocation, record, repeat. Do not have one agent write the whole conversation in a single response; that allows it to plan both sides together.

## Other CLI adapters

`--backend command --command '["your-wrapper", "arg"]'` sends the request on stdin and expects **only the role's reply** on stdout. Stderr is logged. It uses argv directly, with no shell. A wrapper can call Claude/OpenCode, select their text-output mode or extract their JSON response. Verify flags against the installed version before using them; those CLIs are currently hidden/unavailable in this session. You can invoke different wrappers for alternating `--turns 1` calls to mix models or tools across roles.

## Scenarios and evidence

Default full-round fixture: **`scenario-rich.json`**, with detailed candidate-only history in [fixtures/amira-v3.md](fixtures/amira-v3.md). The coordinator copies the file without reading it, gives only its path to the candidate, and keeps the interviewer on the short public introduction/posting. The candidate may read/search that file as needed. Substantive assessment happens afterward, when the parent evaluator reads the snapshot and transcript. This mode is currently supported by the subagent procedure, not the optional CLI relay.

The v3 fixture has concrete coat-help, teamwork, escalation, mistake and prioritisation examples, plus explicit unknowns and retry guidance. It is synthetic harness material, not Search Desk's canonical persona. Keep the thin v2 guide for missing-detail tests; comparisons across those fixture versions are not prompt-only comparisons.

For prompt comparisons, prefer **`scenario-answer-bank.json`**, now an answer guide. It gives the candidate stable background, example answers and limits on what is known. The candidate adapts wording and detail to the actual question while keeping its history consistent; no exact-match responses or answer-ID routing. The interviewer never sees the guide. Compare factual content and answer depth between runs, allowing natural wording differences. Keep the same guide version for prompt variants. Use separate scenarios for early-stop/skip tests rather than mixing control signals into ordinary answers.

`scenario.json` is a tiny, explicitly fictional smoke-test fixture, a harness person, separate from the app's example Amira (`docs/inputs/example-person.md`, the accounts-payable clerk). Copy it to define another scenario and pass `init --scenario FILE`. Put candidate behaviour such as “answer vaguely, then skip” in `candidate_instructions`; it stays hidden from the interviewer. Run normal and early-stop cases separately.

Runs snapshot the interviewer prompt and scenario, exact per-turn requests/replies, CLI output/errors, commands, timestamps, and a readable transcript. They are ignored by Git (`runs/.gitignore`); copy a small assessment into `evidence/` if it should be kept. Attach a short human assessment using [the validation rubric](../../docs/coach-prompt.md). Inspect candidate grounding separately: a simulator's invented experience is not automatically an interviewer failure. No model judge or automatic pass score in this first version. Repeated same-model simulations can share blind spots; they prepare us for, rather than replace, one human rehearsal.

Web research is explicitly unavailable in this initial harness. Test search later in the actual workshop chat. No prompt changes or Search Desk integration are made automatically.

## Evidence kept in this repository

`evidence/<run>/assessment.md` with the `prompt.txt` that run used (the rest of a run stays in the Git-ignored `runs/`):
`focused-v4-01` (prompt v4, three focused cases: the current result), `focused-v3-01` (prompt v3, eight focused cases,
including the retry-feedback failure v4 fixed) and `rich-trial-01` (prompt v1, the one full round with the rich fixture).
They were produced in the workshop repository with the models in `models.json`; they are history, not current coverage.
A v4 full round, repeated trials, real-chat and human trials are still untested.
