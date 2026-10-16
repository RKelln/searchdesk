# Real replies from free Claude (fixtures for the parser)

Collected 2026-10-15 and 2026-10-16 from free Claude (Sonnet 5.5), using an earlier question format that asked for
JSON lines with full event ids. The person in the questions is made up; the events are real public listings from
Togather. Use these for PLAN T3.2's "older trial format" cases. The parser should accept every valid line, and
recover the broken one too.

- `round1/`: a general city-events slice. `prompt.txt` is the question and `slice.json` lists the events (`id`,
  `name`, `date`, `venue`) plus the `relevant` set. The `*_t2-recovered_fullresponse.txt` file includes the prose
  around the answer, as copied from the page.
- `round2/`: 47 events (32 library career sessions, 15 city events).
  - **Trial 1** (`*_t1.txt`) has a real model error: a hard line break inside a URL splits one JSON line in two.
    The join-repair step (DESIGN 9.4 step 6) must recover it.
  - The last line of each reply is a `{"t":"check",…}` self-report. The parser should ignore it (it is not an item
    kind).

The questions also contain a Python validator. The current design dropped it (DESIGN 9.3); it is left in so the
questions stay exactly as they were sent.
