# Maintainer to-do (Ryan)

Things only you can do, in rough order of urgency for the Mon Oct 19, 2pm tag. Tick them here as you go.

## Before the workshop (P0)

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
- [ ] **Review the coach instructions** once the integration lands (`features/recipe-coach.js`, `docs/coach-prompt.md`).
  The talk marks them as a review item until you accept v4 and its options.
- [ ] **Accept or change the made-up person's data** in `data/example.js` after T2.6 (from `docs/inputs/example-person.md`).
- [ ] **Mac test, V1–V4** (the workshop Macs: managed macOS 14, Chrome, no Python, Node or git):
  - V1: open from `file://`, then check loading, saving across reloads, clipboard, download, file import and the
    Togather fetch;
  - V4: `bash checks/check.sh example` runs through `osascript`. This is untested JXA code.
  - V3: the agent permission settings in a workshop folder.
- [ ] **Chat-route trials (V5–V6):** a full round trip on the workshop's Claude seat (copy a question, paste the
  answer), for events, posting and coach.
- [ ] **Phone check (V8):** the hosted copy on a real phone, including copy, app switch, paste and Undo.
- [ ] **DNS** for `searchdesk.ryankelln.com` to GitHub Pages (T4.2).
- [ ] **Decide the cut list** on Sunday night if time is short. The plan's order: the service worker, your own AI
  tasks (T3.8), `recipe-posting`, and reference features beyond `sites`.

## Soon after (P1)

- [ ] **Verify the services entries** in the locale: the `account` labels (V9) and `prefill` URLs (V7).
- [ ] **Togather:** tell me when production exists, so the locale can switch from staging.
- [ ] **One timed human rehearsal** of the coach round (10 minutes, without facilitator help), as in
  `docs/coach-prompt.md`.

## Decided (for the record)

- 2026-10-17: use Togather staging (`staging.toronto.togather.foundation`); there is no production yet.
- 2026-10-17: `tel:` links are allowed (digits only).
