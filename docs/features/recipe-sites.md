# AI: sites for my field  (id: recipe-sites, size: S)
In plain words: Suggests job sites and organisations for your kind of work, as suggestions to add to `sites`.
Why someone wants it: Most people only know the big job sites. A good list for your trade or field is hard to find.

Done when:
- [ ] An agent in the folder adds `checks/recipe-sites.check.js`, and `node checks/run.js recipe-sites` passes.
- [ ] The AI helper screen lists a "Sites for my field" task. It needs the `sites` feature: if `ctx.has('sites')`
      is false the task's `needs` says "This task needs the Job sites feature." (the recipe is still listed).
- [ ] `needs` also says "Add the kind of work you look for in About me" when the shared profile has no roles line.
- [ ] The question holds the shared profile lines and the names and addresses of the sites the person already has (so
      the AI does not repeat them), at most 30.
- [ ] The question asks for up to 5 places, only if they are real and the AI is sure of the exact https address, with
      no made-up links ("write `unknown` if you are not sure").
- [ ] The answer lines are `NEW | title | https://address | why`. Core saves each as a `suggestion` with `kind:
      'lead'` and `target: {title, url}`, exactly like the leads from `recipe-events`.
- [ ] A line whose address is `unknown` or not `https://` keeps the title and an empty address (never invent a link).
- [ ] The `sites` screen already shows and takes leads (see `docs/features/sites.md`). This feature adds no screen.
- [ ] The question is under `Desk.prompt.BUDGET` characters (6,000).

Data: none. Owns no record type.
Record types: none.
Slots: none   Soft uses: `sites` (checked with `ctx.has('sites')` inside `needs`).
ctx calls: `ctx.recipe(def)` with `needs`, `data`, `answer: {NEW: ['title', 'url', 'why']}`, `example`, `apply`; `ctx.t`.
Inside `needs(c)` and `data(c)`: `c.profileLines()`, `c.store.all('site')`. Note that `needs(c)` gets the read-only
recipe ctx; use the feature's own `ctx.has` from `mount` (close over it). See `features/recipe-events.js` for the NEW line.

Checks to write:
- `logic.existing(sites)` gives at most 30 `name | url` lines and skips deleted sites.
- `logic.suggestions(accepted)` turns NEW lines into `lead` suggestions with `target: {title, url}`; an `unknown` or
  `http:` address becomes `''`.
- The template has every placeholder you list.

Test hooks: this recipe needs no new names. With the recipe's id `sites`, its task is the existing `ai-task-sites`;
a missing feature or a missing profile line shows in the existing `ai-needs`; and the leads themselves are shown by
`sites` under its own names (see `docs/features/sites.md`). Add any new ones to `tests/e2e/README.md`.

Out of scope: checking that a link works; fetching anything; adding the site automatically.
Ideas for after: ask for local employers as well as sites; let the person say "only free sites"; a choice of how many.
