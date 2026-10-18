'use strict';
// Loads core files into a vm context with a fake window; returns window.Desk.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');

function load(relPaths, extras) {
  const list = Array.isArray(relPaths) ? relPaths : [relPaths];
  const window = Object.assign({
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    crypto: require('crypto').webcrypto,
  }, extras || {});
  window.window = window;
  const ctx = vm.createContext(window);
  for (const rel of list) {
    const file = path.join(root, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return window.Desk;
}

// `skip: gone('tools/kit.py')` for a test that reads a file outside the app.
//
// Some of these files are development tools: tools/, tests/e2e, and the project's
// own plan and design notes. A host who wants to run the app for people -- a
// library workshop copy, say -- reasonably leaves them out, and a suite that
// fails because of that is a suite nobody runs. So a test that needs one of them
// skips, naming what is missing, instead of failing.
//
// Skipped is not passed. The count of skips is reported, so a suite that skips
// half of itself is visible rather than quietly green. And a missing *runtime*
// (no python3, no git) is a different reason to skip, and keeps its own message.
function gone(rel) {
  return fs.existsSync(path.join(root, rel)) ? false : rel + ' is not in this copy';
}

// The same, for the .git folder: a copy made from an archive, or a USB stick, has
// no repository in it, and git cannot answer a question about a repository it is
// not in. `git --version` succeeding does not mean that.
function noRepo() {
  return fs.existsSync(path.join(root, '.git')) ? false : 'this copy has no .git folder';
}

module.exports = { load, root, gone, noRepo };
