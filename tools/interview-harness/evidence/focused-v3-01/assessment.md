# V3 focused feedback regression

Parent assessment, 2026-10-16. Eight fresh Sol continuations with expected checks hidden. Prompt 1,500 characters; suite version 2; exact hashes/requests/responses retained.

| Case | Result | Observation |
|---|---|---|
| early_stop | Pass | Explicitly nothing to assess; offers future practice, no forced strength/weakness. |
| all_skipped | Pass | Correctly acknowledges no substantive answers; offers practice rather than a nonexistent retry. |
| partial_answer_stop | Pass | Recognises the stated personal contribution and limits assessment of coordination/outcome to missing detail. No skill deficit inferred. |
| strong_partial_stop | Pass | Recognises the supplied actions and coat choice, limits assessment to one answer, and does not manufacture criticism. |
| known_outcome_debrief | Pass | Preserves the known coat outcome and distinguishes unremembered steps from lack of skill. |
| retry_selection | Pass | Repeats the original question and waits. |
| retry_unchanged | Pass | Explicitly says the answer contains the same information; no false claim of improvement. One action-detail next step. |
| retry_feedback | Fail | Identifies added actions but says “The outcome is still missing,” overlooking the visitor's supplied coat choice. Violates known-outcome requirement. |

Seven passes, one fail. The partial/no-answer edge is fixed in these single executions, but the known-outcome weakness recurred in retry feedback. V4 addresses that explicitly; its evidence belongs in a separate run. No full-conversation v3 validation or repeatability claim.
