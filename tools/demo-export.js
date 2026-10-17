#!/usr/bin/env node
'use strict';
// Prints the made-up person's records in the exact shape a saved copy has, so an agent can see that shape
// without anyone's real data.   Run:  node tools/demo-export.js [--ids]
//
// Why not just save a copy from the app: core/io.js leaves every source: "example" record out on purpose, so
// there is nothing in it to read. This loads the made-up person the way the page does (loadExample stamps
// `updated` and marks `source`), then hands the state to the real export writer with `source` put back to
// "user", which is what the page uses for the person's own records. The envelope, the field names and the
// date format all come from the real code, so this cannot drift from what the page writes.
//
//   node tools/demo-export.js          the whole file on stdout. The notes go to stderr, so
//                                      `node tools/demo-export.js > copy.json` gives valid JSON.
//   node tools/demo-export.js --ids    one line per record: id, type, updated
//
// Nothing is written to disk and no real data is read: the only thing that goes in is data/example.js.
//
// When you change a record that is already on the device, give it a NEW `updated`: the time you made the
// change. Never reuse the one you read here or in a real copy. The page then sees a tie, keeps its own copy,
// and your change quietly does nothing.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CORE = ['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js', 'data/example.js'];

function note(line) { process.stderr.write(line + '\n'); }

// The page is not running: give the core files the smallest window they need, the same way the unit tests do.
function desk(files) {
  const window = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    crypto: require('crypto').webcrypto,
  };
  window.window = window;
  const ctx = vm.createContext(window);
  for (const rel of files) {
    const file = path.join(ROOT, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return window.Desk;
}

const idsOnly = process.argv.slice(2).indexOf('--ids') >= 0;
const D = desk(CORE);
D.store.init({ now: () => Date.now(), device: 'demo-export' });

const added = D.io.loadExample();
if (!added) { note('No made-up person found. Is data/example.js empty?'); process.exit(1); }

const state = D.store.state();
// loadExample marked every record source "example", and the export writer drops those. Put them back to
// "user", what the page uses for the person's own records, so the real writer keeps them.
let n = 0;
for (const id of Object.keys(state.records)) {
  if (state.records[id].source === 'example') { state.records[id].source = 'user'; n++; }
}

note('The made-up person (Amira), shown as a saved copy would show it. Made-up data only.');
note('Records: ' + n + '. This is not anyone\'s real information.');
note('Editing one of these? Give it a NEW `updated`, the time you made the change. Never reuse the one shown.');
note('');

if (idsOnly) {
  for (const id of Object.keys(state.records)) {
    const r = state.records[id];
    process.stdout.write([id, r.type, r.updated || ''].join('\t') + '\n');
  }
} else {
  process.stdout.write(D.io.exportText(state, D.version));
}