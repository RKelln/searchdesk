# Bigger text  (id: bigtext, size: S)
In plain words: Larger text and stronger contrast, remembered on this device.
Why someone wants it: Small grey text is hard to read for many people, on a phone or a library computer.

Done when:
- [ ] An agent in the folder adds `checks/bigtext.check.js`, and `node checks/run.js bigtext` passes.
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
Slots: none of your own. `ctx.pref` puts the block on the `settings` slot for you.   Soft uses: none.
How it works: declare the two preferences with `ctx.pref` in `mount`, and it saves them, draws the control, and puts
the block on the Data screen. You do not build the control, save it, or read it back yourself:

```js
ctx.pref({ key: 'size', type: 'choice', label: ctx.t('sizeLabel'), def: 'normal', onChange: apply,
           options: [{ value: 'normal', label: ctx.t('normal') },
                     { value: 'big', label: ctx.t('big') },
                     { value: 'bigger', label: ctx.t('bigger') }] });
ctx.pref({ key: 'contrast', type: 'toggle', label: ctx.t('contrastLabel'), def: false, onChange: apply });
ctx.pref.note(ctx.t('saveNote'));   // the line under the block, in your own words
```

What is left for you is the part only this feature knows: the page. `core/desk.css` uses `rem` for sizes and colour
variables (`--text`, `--muted`, `--line`), so putting a class on `document.documentElement` (for example
`bigtext-big`) and setting `html.bigtext-big { font-size: 125%; }` and those variables in your feature's `css` is
enough. `onChange` runs after the choice is saved, so `apply` can read the new value with `ctx.pref('size')` and
`ctx.pref('contrast')`. Call `apply()` once at the end of `mount` too, so the page starts in the saved state.
`document` and `classList` are not banned words.
ctx calls: `ctx.pref`, `ctx.t`.

A value that is not one you offer — an old file, or one someone edited by hand — comes back as your `def`, so the
control never shows a blank option and `apply` never has to cope with a value it was not expecting.

Checks to write (in `logic`):
- `classesFor(size, contrast)` returns the class names to put on the page: `[]` for the default, `['bigtext-big']`,
  `['bigtext-bigger', 'bigtext-contrast']`, and so on. Unknown values give no size class.

`readChoice` and `patchFor` are not needed: `ctx.pref` reads the saved value and refuses one you do not offer, and
`Desk.prefs.read` / `Desk.prefs.allowed` in `core/prefs.js` are already checked in `tests/unit/prefs.test.js`.

Test hooks: this feature needs no names of its own. `ctx.pref` makes `pref-size` and `pref-reset-size`, and
`pref-contrast` and `pref-reset-contrast`, so do not add those yourself. The page change is read from the class
list on `document.documentElement`, not from a `data-test`. Add any new ones to `tests/e2e/README.md`.

Out of scope: choosing fonts or colours; per-screen sizes; changing the browser's own zoom.
Ideas for after: a dyslexia-friendly font choice; more line spacing; a "reduce motion" switch.
