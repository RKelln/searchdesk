# Maintainer to-do

Things only the maintainer can do, in rough order of urgency. Tick them here as you go.

The things that need a person's judgement on content — is this wording right, does this rule match the regulation —
are here. The things that need a machine are not: they are the verify list in [`DESIGN.md` section
15](DESIGN.md), V1 to V11, and they are checked by running them. A host who wants to know whether a folder copy works
on a shared computer should read that list rather than this file.

## Before the next release (P0)

- [ ] **Review the help copy** in `locale/toronto.js` (the 9 entries are listed in full in the T2.4 notes). Check:
  - the paraphrased wording;
  - "who it is for" for Job Bank ("Anyone") and 211 ("Anyone who does not know where to start"), which are the
    agent's own wording.
- [ ] **Fill the help gaps** marked `TODO(maintainer)` in `locale/toronto.js`:
  - contact details for COSTI, JVS and the library settlement workers;
  - whether to add Skills for Change and WoodGreen (not yet read at their sources);
  - the URL for the City of Toronto Newcomer Services Kiosks.
- [ ] **Check the posting rules** against the text of O. Reg. 476/24 (V10): pay range, AI screening, open-now, and
  `replyDays: 45`.
- [ ] **Accept or change the made-up person's data** in `data/example.js` after T2.6 (from `docs/inputs/example-person.md`).
- [ ] **Review the coach instructions** in `features/recipe-coach.js` and `docs/coach-prompt.md`. The wording is a
  review item until you accept v4 and its options; what is tested and what is not is written down in
  `docs/coach-prompt.md`.
- [ ] Open the hosted copy on a laptop and a phone.
- [ ] **Decide the cut list** if time is short. The plan's order: the service worker, your own AI tasks (T3.8),
  `recipe-posting`, and reference features beyond `sites`.

## Deploy

- [x] **DNS** for `searchdesk.ryankelln.com` to GitHub Pages (T4.2). Done 2026-10-16; it resolves to GitHub.
- [x] **First deploy:** live 2026-10-16 at https://searchdesk.ryankelln.com.
- [x] **Enforce HTTPS** is on (2026-10-16).

## Soon after (P1)

- [ ] **Verify the services entries** in the locale: the `account` labels (V9) and `prefill` URLs (V7).
- [ ] **Togather:** tell me when production exists, so the locale can switch from staging.

## Decided (for the record)

- 2026-10-16: use Togather staging (`staging.toronto.togather.foundation`); there is no production yet.
- 2026-10-16: `tel:` links are allowed (digits only).
- 2026-10-17: the line "Workshops: fictional person only" appears only in practice mode. Practice mode keeps v4
  exactly (3 questions); everyone else gets 5 questions by default (not yet harness-tested).
- 2026-10-17: two separate made-up people with different names: the interview harness candidate (rich background,
  in `tools/interview-harness/`) and Amira (the app's example, in `data/example.js`). They exist for different
  reasons: one exercises the prompt, the other shows the app.
