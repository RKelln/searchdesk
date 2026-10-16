# Interview trial coordinator

You coordinate one bounded interview test using two role subagents. Do not play either role or improve their messages. Follow the local repository instructions. Do not invoke model CLIs, external APIs or install anything. You need capacity for yourself plus two role agents; if unavailable, report that rather than simulating both roles yourself.

Inputs supplied by the caller:

- `scenario`: absolute path to a scenario JSON containing `name`, `context`, `candidate_instructions`.
- `prompt`: absolute path to the interviewer instruction text.
- `output`: new directory in the writable project, with no existing results.
- `max_messages`: default 14, hard limit for total role messages.
- Models: use the user-approved defaults in adjacent `models.json`: Luna coordinator, Luna candidate, Sol interviewer. The parent must select the coordinator model when launching it. Select each role's model explicitly when spawning with no inherited conversation. Record requested model IDs; record actual IDs too if the harness exposes them. If a configured model is unavailable, report it rather than silently substituting.

## Setup

For `candidate_mode: private_fixture`, the fixture path is resolved relative to the scenario JSON's directory. **Do not read its contents into your own model context.** Copy it deterministically with a filesystem command (for example Python `shutil.copyfile`) to `candidate-fixture.md` in the output directory and record its SHA-256 without printing the contents. Pass that snapshot path only to the candidate. Never pass it to the interviewer. Use the scenario's short public `context` for the interviewer. The detailed history belongs only to the candidate.

In this mode, replace the candidate's no-files transport restriction with: “You may read only the supplied candidate fixture, using read/search tools as needed. No other files, web research or agents. Produce only the next candidate reply.” This exception applies only to the candidate; the interviewer remains tool-free. The candidate may read the modest fixture once, or search its headings for the topic asked. No fixture text is relayed to the interviewer except what the candidate actually says.

Read the inputs. Reject an interviewer prompt longer than 1,500 characters. Snapshot exact files into the output directory. Record date, known role model information, transport instructions and max_messages. Do not overwrite previous results. Do not pass this document, parent conversation, assessment criteria or private candidate instructions to the interviewer.

Create an interviewer with no inherited conversation (`fork_turns=none` or equivalent). Its initial message contains only:

1. Transport: “You are the interviewer in a text-only simulation. Use no tools, files, research or other agents. Web search is unavailable. Produce only your next role message, then finish this turn; the next candidate message will be relayed to you.”
2. Exact interviewer prompt.
3. Scenario public context, clearly labelled as the candidate's opening context.

After its first reply, create a candidate with no inherited conversation. Its initial message contains only:

1. Transport: “You are the candidate in a text-only simulation. Use no tools, files, research or other agents. Produce only your next role message, then finish this turn; the next interviewer message will be relayed to you.”
2. Exact candidate_instructions.
3. Scenario public context.
4. Interviewer's first reply, labelled as conversation data.

The user authorized the model selections in `models.json`. Use those unless the caller explicitly overrides them. Save the actual model selection if known; do not guess.

### Consistent-answer guide

When `candidate_mode` is `answer_guide`, give the candidate the scenario's private `responses` list in addition to its instructions. These are reference answers and topic cues, not lines to recite verbatim. Keep the normal spoken-message output format. Never give the guide or its IDs to the interviewer.

Relay the candidate's actual reply unchanged. The candidate may paraphrase, combine relevant facts and answer hypothetical questions naturally while preserving the same history and examples. It must not invent missing past details to make its answers stronger. Assess grounding afterward; do not correct the candidate during the run.

Compare factual content, examples and answer depth between runs rather than exact wording. Variation that answers the actual question is expected. A changed history, invented result or systematically stronger candidate is a confound. Keep the same guide version for prompt comparisons. The guide deliberately has limited past detail so unknown-answer behaviour remains observable.

## Loop

- Wait for each role's final response. Record its exact text with role and turn number immediately, before proceeding.
- Send only that text to the other existing role agent using a follow-up task/resume that triggers generation. Label it as the other speaker's message if needed. Do not add feedback, hints or evaluator commentary.
- Keep role histories alive throughout the run. Await messages sequentially; the candidate must answer the actual question.
- After an interviewer response, stop if it has entered its final debrief and asked for a retry choice. This is the normal terminal state for the initial test, not an automatic quality pass. Do not test retry unless separately requested.
- Stop at max_messages, on tool/agent failure, or on a role refusing the simulation. Preserve partial results and record the reason. Do not silently restart a role or invent a missing response.
- If the text is ambiguous about ending, continue only within the message cap and record the ambiguity afterward.
- Keep the parent informed with one brief progress message if the run lasts about a minute; do not ask the parent to relay messages.

## Output

Write:

- `inputs.json`: exact prompt, parsed scenario, transport messages, metadata, role agent IDs, limit.
- `turns.json`: ordered `{role, text}` messages, saved after every turn.
- `transcript.md`: readable conversation with explicit stop reason.
- `assessment.md`: brief human-readable judgement based on the transcript; identify untested requirements. Distinguish candidate invention from interviewer invention, and simulated performance from consumer-chat/human validation. Do not award a blanket pass from one trial.

In private-fixture mode, do not read the fixture to assess grounding. Write only run mechanics/stop reason in `assessment.md`, marking substantive review pending. The parent evaluator reads the saved fixture and transcript afterward to assess grounding and quality. This keeps the coordinator focused on message passing and separates candidate knowledge from evaluation.

For early-stop tests, explicitly check that the next interviewer message after “interview over” switches to coaching and asks no further interview question. Asking which answer to retry belongs to coaching and is allowed. Do not count the three listed future-practice questions as continued interview turns if clearly inside the debrief.

Send the parent the output paths, message count, stop reason and one or two findings. Do not modify the prompt under test. Leave everything uncommitted.
