'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');
const Desk = load(['core/contract.js']);
const words = (src) => Desk.contract.scan(src).map((f) => f.word);
const J = (x) => JSON.parse(JSON.stringify(x));

test('each banned word is found', () => {
  const cases = {
    innerHTML: 'el.innerHTML = x', outerHTML: 'a.outerHTML', insertAdjacentHTML: 'a.insertAdjacentHTML("x", y)',
    'document.write': 'document.write(1)', eval: 'eval("1")', 'new Function': 'new  Function("a")',
    fetch: 'fetch(url)', XMLHttpRequest: 'new XMLHttpRequest()', 'import(': 'import ("x")',
    localStorage: 'window.localStorage.x', setInterval: 'setInterval(f, 5)',
  };
  assert.deepStrictEqual(Object.keys(cases).sort(), J(Desk.contract.banned).sort());
  for (const [word, src] of Object.entries(cases)) assert.ok(words(src).includes(word), word);
});

test('whole words only', () => {
  assert.deepStrictEqual(J(words('evaluate(1); prefetch(2); myeval(); x.evalued; refetch; setIntervals; importance(1)')), []);
  assert.deepStrictEqual(J(words('const fetchSize = 1; let innerHTMLish; Function("a"); document.writer')), []);
  assert.deepStrictEqual(J(words('foo.import(1)')), []);
  assert.deepStrictEqual(J(words('net.fetch(1)')), ['fetch']);
});

test('comments do not count, code after them does', () => {
  assert.deepStrictEqual(J(words('// eval is bad\nvar a = 1; /* innerHTML\n fetch */ var b;')), []);
  assert.deepStrictEqual(J(words('/* x */ eval(1) // ok')), ['eval']);
});

test('strings and regular expressions do not hide or start comments', () => {
  assert.deepStrictEqual(J(words('var u = "http://x"; eval(1)')), ['eval']);
  assert.deepStrictEqual(J(words('var r = /\\/\\//; eval(1)')), ['eval']);
  assert.deepStrictEqual(J(words("var s = 'a // b'; var t = `/* ${x}`; fetch(1)")), ['fetch']);
  assert.deepStrictEqual(J(words('el["inner" + "HTML"]')), []); // documented: not caught
  assert.deepStrictEqual(J(words('say("fetch it")')), ['fetch']); // documented: quoted words still count
});

test('line numbers', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Desk.contract.scan('a\n/* x\ny */\neval(1)'))), [{ word: 'eval', line: 4 }]);
});

test('scanFeature looks at mount, other functions and every logic function', () => {
  const def = { id: 'x', mount() { el.innerHTML = 1; }, logic: { a() { return 1; }, b() { return fetch(1); }, n: 5 }, strings: { s: 'eval' } };
  const r = JSON.parse(JSON.stringify(Desk.contract.scanFeature(def)));
  assert.deepStrictEqual(r.map((f) => f.where + ':' + f.word).sort(), ['logic.b:fetch', 'mount:innerHTML']);
});

test('Desk.check registers; runCheck counts passes and failures', () => {
  Desk.check('demo', () => {});
  assert.strictEqual(typeof Desk.checks.demo, 'function');
  const r = Desk.contract.runCheck((t, f) => {
    t.ok(true, 'a'); t.eq([1, { a: 2 }], [1, { a: 2 }], 'b'); t.eq(1, 2, 'c'); t.ok(f.x, 'd');
  }, { x: 0 });
  assert.deepStrictEqual([r.pass, r.fail], [2, 2]);
  assert.ok(r.results[2].msg.includes('got 1, wanted 2'));
  const r2 = Desk.contract.runCheck(() => { throw new Error('boom'); }, {});
  assert.strictEqual(r2.fail, 1);
  assert.ok(r2.results[0].msg.includes('boom'));
});
