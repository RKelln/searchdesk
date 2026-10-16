'use strict';
// Runs one feature's check file with no page. Works two ways:
//   node checks/run.js <id> [featureFile] [checkFile]
//   osascript -l JavaScript checks/run.js <id> [featureFile] [checkFile]     (run from the repo root; see check.sh)
// By default: features/<id>.js and checks/<id>.check.js. The id `example` uses the files in docs/.
// Order: the pure core files, then the feature file, then its check file. Then the contract scan (banned words).
// Exit code: 0 all passed, 1 a check failed, 2 STOP (could not run). This is tooling, not a feature, so the
// indirect eval used in the JXA branch is fine here.

var IS_NODE = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
var CORE = ['core/strings.js', 'core/h.js', 'core/contract.js', 'core/merge.js', 'core/prompt.js']; // pure: safe with no page
var ID_RE = /^[a-z]+(-[a-z]+)*$/; // same rule as validId in core/desk.js and the test in check.sh

// ---- the parts that differ between node and JXA --------------------------------------------------
function makeHost() {
  if (IS_NODE) {
    var fs = require('fs'), path = require('path'), vm = require('vm');
    var ctx = null;
    return {
      root: function () { return path.resolve(__dirname, '..'); },
      read: function (file) { return fs.readFileSync(file, 'utf8'); },
      exists: function (file) { return fs.existsSync(file); },
      print: function (line) { console.log(line); },
      exit: function (code) { process.exitCode = code; },
      // A page-less world: the context's global object is `window`.
      newWorld: function () {
        var w = { console: console };
        w.window = w;
        ctx = vm.createContext(w);
        return w;
      },
      evalFile: function (src, file) { vm.runInContext(src, ctx, { filename: file }); },
    };
  }
  // JXA (osascript -l JavaScript). Unverified on a Mac until V4; kept small on purpose.
  ObjC.import('Foundation');
  ObjC.import('stdlib');
  return {
    root: function () { return ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath); },
    read: function (file) { return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError($(file), $.NSUTF8StringEncoding, null)); },
    exists: function (file) { return $.NSFileManager.defaultManager.fileExistsAtPath($(file)); },
    print: function (line) { $.NSFileHandle.fileHandleWithStandardOutput.writeData($(line + '\n').dataUsingEncoding($.NSUTF8StringEncoding)); },
    exit: function (code) { $.exit(code); },
    newWorld: function () { globalThis.window = globalThis; return globalThis; },
    evalFile: function (src) { (0, eval)(src); }, // indirect eval runs in the global scope
  };
}

function main(args, host) {
  function stop(msg) { host.print('STOP: ' + msg); host.exit(2); }
  var id = args[0];
  if (!id || !ID_RE.test(id)) {
    return stop('Give the feature id: lowercase letters a-z and hyphens, for example "sites".');
  }
  var root = host.root();
  function abs(rel) { return rel.charAt(0) === '/' ? rel : root + '/' + rel; }
  var base = id === 'example' ? 'docs/example-feature' : null;
  var featureRel = args[1] || (base ? base + '.js' : 'features/' + id + '.js');
  var checkRel = args[2] || (base ? base + '.check.js' : 'checks/' + id + '.check.js');
  var files = [featureRel, checkRel].concat(CORE);
  for (var i = 0; i < files.length; i++) {
    if (!host.exists(abs(files[i]))) return stop('I cannot find ' + files[i] + '.');
  }

  // A fake page-less world with a Desk that captures register(); the real Desk.check comes from contract.js.
  var world = host.newWorld();
  var features = {};
  world.Desk = { register: function (def) { features[def.id] = def; return def; } };
  try {
    CORE.forEach(function (f) { host.evalFile(host.read(abs(f)), abs(f)); });
    host.evalFile(host.read(abs(featureRel)), abs(featureRel));
    host.evalFile(host.read(abs(checkRel)), abs(checkRel));
  } catch (e) {
    return stop('A file would not load: ' + (e && e.message));
  }
  var Desk = world.Desk;
  var feature = features[id];
  if (!feature) return stop('The feature file did not register the id "' + id + '".');
  if (typeof Desk.checks[id] !== 'function') return stop('The check file has no Desk.check("' + id + '", ...).');

  var pass = 0, fail = 0;
  var res = Desk.contract.runCheck(Desk.checks[id], feature);
  res.results.forEach(function (r) { host.print((r.ok ? 'PASS ' : 'FAIL ') + r.msg); });
  pass += res.pass; fail += res.fail;

  var found = Desk.contract.scanFeature(feature);
  if (!found.length) { pass++; host.print('PASS the contract scan found no banned words'); }
  found.forEach(function (f) {
    fail++;
    host.print('FAIL the contract scan found "' + f.word + '" in ' + f.where + ' (line ' + f.line + ' of that function)');
  });

  host.print((fail ? 'FAILED' : 'OK') + ' ' + id + ': ' + pass + ' passed, ' + fail + ' failed');
  host.exit(fail ? 1 : 0);
}

// osascript calls run(argv); node calls it below.
function run(argv) { main(Array.prototype.map.call(argv, String), makeHost()); }
if (IS_NODE) run(process.argv.slice(2));
