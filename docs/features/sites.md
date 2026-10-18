# Job sites  (id: sites, size: S)
In plain words: Keep the job sites you use in one place, with a note about each.
Why someone wants it: Job searching means many sites and it is easy to lose track of which ones you check. This also
gives the AI's "new place to look" leads a home: you can take one, and it becomes a site.

Done when:
- [ ] An agent in the folder adds `checks/sites.check.js`, and `node checks/run.js sites` passes.
- [ ] A "Job sites" item is in the menu. It shows your sites, sorted by name, each with its name, its note, and a link
      that opens in a new tab.
- [ ] You can add a site (name, link, note), edit it, and delete it. Delete can be undone with the toast's Undo.
- [ ] A name is needed. A link is optional, but if it is there it must start with `https://` or `http://`. A bad one is
      refused with a plain sentence from `strings`.
- [ ] Adding the same link twice is refused (links match when you ignore capital letters, `www.` and a last `/`).
- [ ] The locale's starting sites (`ctx.locale.sites`, for example Job Bank) show in a "To start with" list, each with
      an "Add to my sites" button. A site you already have is not shown there.
- [ ] Leads from the AI: every `suggestion` record with `kind: 'lead'`, `status: 'new'` shows in a "New places to look,
      from AI" lane at the top. Each row shows the title, the link's domain as plain text (not a link), the `why`
      line, and the words "From AI, not checked". Two buttons:
      "Take it" adds a site (name = the lead's title, link = the lead's url, note = the why line) and sets the
      suggestion's `status` to `'taken'` in the same `ctx.store.batch`; "Not for me" sets `status` to `'dismissed'`.
- [ ] A lead whose link is empty or not `https://` still shows, with no link, and can be taken without a link.
- [ ] A lead whose link you already have as a site is shown as "You have this one", and taking it adds nothing.
- [ ] With no sites and no leads the screen says so in one plain sentence.

Data: owns `site` = `{name, url, note}` (`url` and `note` may be empty). Also lists `suggestion` in `types`,
only to change a lead's `status` (the same way `features/events.js` does). Never create suggestions here; core makes them.
Record types: `site`, `suggestion` (status changes only).
Slots: `tab`   Soft uses: none. (`recipe-sites` suggests leads for this screen; `recipe-events` already does.)
Lead shape (from `features/recipe-events.js`): `{type: 'suggestion', kind: 'lead', recipe: 'events', status, why,
target: {title, url}}`. Read `target.title` and `target.url`; fall back to the top-level `title` and `url` if the target
is missing.
ctx calls: `ctx.store.all`, `put`, `remove`, `batch`, `ctx.slot('tab', ...)`, `ctx.locale.sites`, `ctx.ui.toast` (with
`{undo: true}`), `ctx.h`, `ctx.t`.

Checks to write (all in `logic`):
- `sortSites(list)` returns a new list sorted by name, ignoring capital letters; it does not change the input.
- `cleanSite({name, url, note})` returns `{ok: true, site}` with trimmed text, or `{ok: false, problem: 'needName' |
  'badLink'}` (the problem is a key in `strings`).
- `sameLink(a, b)` is true for `https://www.Example.com/` and `https://example.com`, false for different sites, and
  false for two empty links.
- `domainOf(url)` gives `example.com` for `https://www.example.com/a/b`, and `''` for junk or an empty value.
- `newLeads(suggestions, sites)` keeps only `kind: 'lead'`, `status: 'new'`, not deleted; marks each one with
  `have: true` when its link matches a site.
- `startingSites(localeSites, sites)` leaves out the ones already added.

Build notes (things that tripped the first build):
- The tab is drawn again after every store change, so a form or "which site I am editing" kept inside `render` is lost.
  Keep that state in a variable in `mount` (outside `render`), and call `ctx.ui.go('sites')` to draw again when only
  that state changed (it re-draws even when you are already on `#sites`).
- A locale site is `{id, name, url}` with no note. `ctx.locale` is frozen: copy before you change anything. Adding one
  makes a new `site` with `note: ''`.
- Changing a suggestion: `ctx.store.put(Object.assign({}, ctx.store.get(id), {status: 'taken'}))`. Put the whole
  record, not just the status.
- Put the site and the status change in one `ctx.store.batch`, and call `ctx.ui.toast(..., {undo: true})` after it, so
  one Undo takes both back.
- Keep `logic` methods safe to call as `f.logic.x(...)`: when one logic function calls another, use `this.` (the check
  calls them as methods). An "except this id" check (for editing) must not match when the id is missing: write
  `exceptId && s.id === exceptId`, not `s.id !== exceptId`.
- A link is "good" if it matches `^https?://\S+$`. Do the same test for leads: a lead link that fails it is shown with
  no link and no domain. `domainOf` also drops a port, a user name and `www.`.
- A tab's `order` is a number (the example uses 90); anything works.
- Test hooks (`data-test`) are not in the brief's checks but tests need them. Use: `sites-add`, `sites-form`,
  `sites-name`, `sites-url`, `sites-note`, `sites-save`, `sites-cancel`, `sites-problem`, `site-row` (with `data-id`),
  `site-link`, `site-edit`, `site-delete`, `sites-start`, `start-row`, `start-add`, `sites-leads`, `lead-row` (with
  `data-id`), `lead-domain`, `lead-have`, `lead-ai-mark`, `lead-take`, `lead-dismiss`, `sites-empty`. The menu link is
  `nav-sites` (core makes it). Add any new ones to `tests/e2e/README.md`.
- When this feature is added to `features/list.js`, also take `sites` out of `Desk.planned`, so it stops being
  listed under "Ideas you could build". **Nothing fails if you forget, so do not go hunting for a failure that is
  not there.** Measured while building `pay` (see `wip/README.md` on the branch of that name): with the feature in
  both `Desk.features` and `Desk.planned`, `test_data_lists_ideas_you_could_build_with_a_brief_each` passes, because
  it skips an id that is built (`if must in built: continue`), and `test_smoke_loads` passes, because it only checks
  the order of the base features. Adding `sites` to `BASE_FEATURES` is still worth doing, so the smoke test covers it
  -- that is for coverage, not to stop a red test.

Out of scope: checking whether a link works; fetching anything from a site; folders or tags; reminders to visit.
Ideas for after: a "last looked" date with a "Looked today" button; a star for the sites that work best; show the site
list on the one-page summary through the `print` slot.
