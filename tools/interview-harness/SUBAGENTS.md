# Run an interview with two subagents

Use this procedure inside a coding harness with conversational subagents. The parent orchestrates and records; it does not play either part. This is the default route. No external CLI or API key is needed beyond the current harness's normal model access.

For fresh sessions, start with [SKILL.md](SKILL.md). Prefer its coordinator route and `scenario-rich.json`; the basic procedure below describes the original no-file smoke test. When using candidate-only fixtures, the candidate read exception and privacy rules in `COORDINATOR.md` take precedence over the blanket no-tools steps below.

## Set up

1. Export the release prompt (`node tools/interview-harness/export-prompt.js > FILE`) and read `scenario.json`. Snapshot them with the result so later edits do not change what was tested.
2. Create an interviewer subagent with **no inherited parent conversation**. Give it the exact interviewer prompt and the scenario's public `context`. Add only a transport instruction: produce one role message, do not use tools, wait for the relayed next message. State that web search is unavailable for this text-only test.
3. On receiving its first question, create a separate candidate subagent with **no inherited parent conversation**. Give it public context, `candidate_instructions`, and that question. Ask for one candidate reply, with no tools or evaluation.

## Relay

4. Record the interviewer's exact question and candidate's exact reply.
5. Send only the candidate reply to the existing interviewer agent and trigger its next turn.
6. Send only the next interviewer message to the existing candidate agent and trigger its next turn.
7. Repeat until the interviewer finishes its debrief and invites a retry, or a maximum of 14 total messages. Stop there for the basic test. Test the retry separately if desired.

Use each harness's equivalent of a follow-up task/resume to trigger the next turn. A message delivered to an idle agent may not trigger generation. Preserve each role's conversation history, not the parent's research or assessment. If the harness cannot resume subagents, recreate each role with only its instructions, public context and transcript so far, and mark the result as transcript replay.

## Record and assess

- Save the exact prompt, fixture, role models if known, date, transport instructions, transcript and stop reason. A bounded stop is not a successful finish.
- Keep commentary, rubric and candidate strategy hidden from the interviewer. Keep the interviewer prompt and rubric hidden from the candidate. Do not ask either role to assess its own performance during the exchange.
- Assess only afterward using `../../docs/coach-prompt.md`. Inspect candidate fabrication separately from interviewer fabrication. Do not infer that a good simulated candidate means a good real participant experience.
- A normal round, a vague/unknown-answer round and an early-end round are useful first cases. Begin with the normal round; run cases separately so private test instructions do not leak.
- No tools/search in the initial simulation. Research behaviour and the actual consumer chat still require their own check.

For machine-readable recording, initialise `harness.py` and use its `record` command for each message. For a quick run, a Markdown transcript with snapshots is sufficient. The relay should never edit or improve a role's message before forwarding it.
