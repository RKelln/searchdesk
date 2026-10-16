# Bigger text  (id: bigtext, size: S)
In plain words: Larger text and stronger contrast, remembered on this device.
Why someone wants it: Small grey text is hard to read for many people, on a phone or a library computer.

Done when:
- [ ] `node checks/run.js bigtext` passes.
- [ ] The Data and settings screen has a "Bigger text" block with a choice: Normal, Bigger, Biggest, and a switch for
      "Stronger contrast".
- [ ] The choice changes the page at once, without a reload.
- [ ] It is still there after a reload (it is saved, and applied when the page starts).
- [ ] At "Biggest" nothing scrolls sideways at 320 px wide (look by hand).
- [ ] Stronger contrast makes the muted text and the lines darker (light mode) or lighter (dark mode).
- [ ] Choosing Normal with contrast off leaves the page exactly as it was.
- [ ] A saved value that is not one of the choices is treated as Normal.

Data: `ext.bigtext` on the `settings` record: `{size: 'normal' | 'big' | 'bigger', contrast: true | false}`. Owns no
record type. It travels in the person's backup file like other settings (a note on the block can say so).
Record types: none.
Slots: `settings`   Soft uses: none.
How it works: `core/desk.css` uses `rem` for sizes and colour variables (`--text`, `--muted`, `--line`, `--accent`).
So adding a class to `document.documentElement` (for example `bigtext-big`) and setting `html.bigtext-big { font-size:
125%; }` and the variables in your feature's `css` is enough. Set the class in `mount` (from the saved value) and again
when the person changes it. `document` and `classList` are not banned words.
ctx calls: `ctx.slot('settings', {id, title, render})`, `ctx.store.get('settings')`, `ctx.store.ext('settings', patch)`,
`ctx.t`, `ctx.h`.

Needs from core: the `settings` record does not always exist (it is created when core first saves a setting), and
`ctx.store.ext` refuses a record that is not there. Core should create the `settings` record at start, or give features a
`ctx.settings` read and write. Until then, if `ctx.store.get('settings')` is missing, the block shows a plain line
("Change a setting on this screen first, or save a copy, then try again.") and does not throw.

Checks to write (in `logic`):
- `readChoice(settings)` returns `{size, contrast}`; for `undefined`, `{}` or odd values it returns `{size: 'normal',
  contrast: false}`.
- `classesFor({size, contrast})` returns the list of class names for the page: `[]` for the default, `['bigtext-big']`,
  `['bigtext-bigger', 'bigtext-contrast']`, and so on.
- `patchFor(size, contrast)` returns the object to give `ctx.store.ext`, and refuses a size that is not offered.

Out of scope: choosing fonts or colours; per-screen sizes; changing the browser's own zoom.
Ideas for after: a dyslexia-friendly font choice; more line spacing; a "reduce motion" switch.
