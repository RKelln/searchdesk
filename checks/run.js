'use strict';
// Runs one feature's check file with no page. Node only for now; T1.6 adds the osascript (JXA) side.
//   node checks/run.js <id> [featureFile] [checkFile]
// By default: features/<id>.js and checks/<id>.check.js. The id `example` uses the files in docs/.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

// ---- the parts that differ between node and JXA (T1.6 swaps these) ----
const host = {
  read(file) { return fs.readFileSync(file, 'utf8'); },
  exists(file) { return fs.existsSync(file); },
  print(line) { console.log(line); },
  exit(code) { process.exitCode = code; },
  args() { return process.argv.slice(2); },
};

function stop(msg) { host.print('STOP: ' + msg); host.exit(2); }

function same(a, b) { // deep equality for plain data
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return a !== a && b !== b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}

function show(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }

function main() {
  const [id, featureArg, checkArg] = host.args();
  if (!id || !/^[a-z]+(-[a-z]+)*$/.test(id)) {
    return stop('Give the feature id: lowercase letters a-z and hyphens, for example "sites".');
  }
  const base = id === 'example' ? 'docs/example-feature' : null;
  const featureFile = path.resolve(root, featureArg || (base ? base + '.js' : 'features/' + id + '.js'));
  const checkFile = path.resolve(root, checkArg || (base ? base + '.check.js' : 'checks/' + id + '.check.js'));
  for (const f of [featureFile, checkFile]) {
    if (!host.exists(f)) return stop('I cannot find ' + path.relative(root, f) + '.');
  }

  // A fake page-less world: window, and a Desk that only captures register() and check().
  const features = {}, checks = [];
  const window = {};
  window.window = window;
  window.console = console;
  window.Desk = {
    register(def) { features[def.id] = def; },
    check(cid, fn) { checks.push({ id: cid, fn: fn }); },
  };
  const ctx = vm.createContext(window);
  try {
    vm.runInContext(host.read(featureFile), ctx, { filename: featureFile });
    vm.runInContext(host.read(checkFile), ctx, { filename: checkFile });
  } catch (e) {
    return stop('A file would not load: ' + (e && e.message));
  }
  const feature = features[id];
  if (!feature) return stop('The feature file did not register the id "' + id + '".');
  const mine = checks.filter((c) => c.id === id);
  if (!mine.length) return stop('The check file has no Desk.check("' + id + '", ...).');

  let pass = 0, fail = 0;
  const t = {
    ok(cond, msg) {
      if (cond) { pass++; host.print('PASS ' + msg); } else { fail++; host.print('FAIL ' + msg); }
    },
    eq(actual, expected, msg) {
      if (same(actual, expected)) { pass++; host.print('PASS ' + msg); }
      else { fail++; host.print('FAIL ' + msg + ' (got ' + show(actual) + ', wanted ' + show(expected) + ')'); }
    },
  };
  for (const c of mine) {
    try { c.fn(t, feature); }
    catch (e) { fail++; host.print('FAIL the check stopped with an error: ' + (e && e.message)); }
  }
  host.print((fail ? 'FAILED' : 'OK') + ' ' + id + ': ' + pass + ' passed, ' + fail + ' failed');
  host.exit(fail ? 1 : 0);
}

main();
