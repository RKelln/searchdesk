# Behaviour coverage

Use two layers; neither is a code-coverage percentage.

- **Whole conversations:** same rich Amira fixture, different candidate delivery styles (ordinary, vague-first, uncertain, early-stop). Tests natural flow, counting, follow-up relevance and candidate consistency.
- **Focused continuations:** prefilled transcripts in `focused.json`; a fresh Sol interviewer generates only the next message. Tests a precise transition without paying for the entire interview or depending on a candidate to trigger it.

The twelve focused cases cover past-example selection, known outcomes in feedback, a vague answer, follow-up exhaustion, unknown information, early stopping, partial and skipped interviews, a strong partial answer, and retry selection/feedback including an unchanged retry. Expected checks describe meaning, not exact output strings. A continuation is a replayed transcript in a user request, not injected native assistant history; successful continuations must still be checked in full conversations.

## Prepare and run

```bash
python3 tools/interview-harness/cases/prepare.py tools/interview-harness/runs/CHOOSE-A-NEW-RUN-NAME
```

`prepare.py` exports the release prompt itself (`--prompt FILE` uses an exported file, for example one made with `export-prompt.js --options ...`). Ask a Luna coordinator to create one fresh, no-inherited-context Sol interviewer per `.request.txt`, sequentially. Pass only that request's exact contents; the case's purpose/expected checks stay out of the interviewer's context. No candidate agent is needed. Save the returned text in the corresponding `.reply.txt`. Stop on a failed call and preserve partial results. Use the approved role models in `../models.json`; no external CLI/API calls.

After all replies are saved, a parent evaluator reads `suite.json` and records pass / partial / fail / not observed for each requirement, citing reply text. Keep execution, semantics and coverage distinct: a saved response is not a passing case. Record model selection, prompt hash and suite version. Repeat failures after a change; also rerun an ordinary full conversation to catch interaction regressions.

## Coverage ledger

| Behaviour | Focused case | Full-run evidence |
|---|---|---|
| At least one past example | past_example_before_last_question | Rich trial v1 contains one, but predates explicit requirement |
| Preserve known outcomes | known_outcome_debrief | Earlier v1 thin-fixture failure; rich v1 feedback grounded |
| One focused probe | vague_team_answer | v1 full-trial-01 |
| Follow-up cap | followup_limit | Not exercised at the bound |
| Unknown means move on | unknown_move_on | v1 full-trial-01 |
| End immediately | early_stop | v1 subagent-early-stop-01 |
| Re-ask selected original question | retry_selection | Not yet exercised |
| Compare revised answer | retry_feedback | Not yet exercised |

This ledger is historical context, not a passing report for v2. Other gaps: missing inputs, skip, malicious posting text, real-employer research/search fallback, fairness, human timing and the actual workshop chat surface. Add a case when a concrete failure appears; avoid inflating the suite with near-duplicates.

First v2 focused run: assessment (not kept here), seven passes and one partial (zero-answer early stop). Each case ran once. V2 full-conversation regression is still pending.

V3 feedback cases: [assessment](../evidence/focused-v3-01/assessment.md), seven passes and one fail: retry feedback incorrectly called a supplied outcome missing. Partial/no-answer cases passed.

Current V4 targeted checks: [assessment](../evidence/focused-v4-01/assessment.md), three observed passes on known-outcome feedback and retries, with a minor redundancy in retry advice. A fresh coordinator followed SKILL.md without prior conversation and completed execution autonomously. V4 full-round and cross-harness discovery remain untested; do not carry forward earlier passes as current coverage.
