'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');
const { makeDoc } = require('./_fakedom');

const doc = makeDoc();
const Desk = load(['core/h.js'], { document: doc });
const h = Desk.h;

test('loads without touching document', () => {
  const D = load(['core/h.js']); // no document at all
  assert.strictEqual(typeof D.h, 'function');
});

test('text-only children: strings and numbers become text nodes', () => {
  const el = h('p', null, '<b>hi</b>', 3);
  assert.strictEqual(el.tagName, 'P');
  assert.deepStrictEqual(el.childNodes.map((c) => c.nodeType), [3, 3]);
  assert.strictEqual(el.textContent, '<b>hi</b>3');
  assert.strictEqual(h('p', 'just text').textContent, 'just text');
});

test('children: arrays flattened, null/false/undefined skipped, nodes appended', () => {
  const inner = h('b', null, 'x');
  const el = h('div', {}, ['a', ['b', null]], false, undefined, null, inner, 0);
  assert.strictEqual(el.childNodes.length, 4);
  assert.strictEqual(el.childNodes[3 - 1], inner);
  assert.strictEqual(el.textContent, 'abx0');
});

test('javascript: and other schemes in href are dropped', () => {
  for (const bad of ['javascript:alert(1)', ' JaVa\tScRiPt:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.com', '/rel', '#x', 'ftp://x', 'tel:javascript:x', 'tel:211;x=1', 'tel:']) {
    const a = h('a', { href: bad }, 'x');
    assert.strictEqual(a.getAttribute('href'), null, bad);
    assert.strictEqual(a.getAttribute('target'), null, bad);
  }
});

test('good links get rel and target', () => {
  for (const ok of ['https://example.com/a', 'http://example.com', 'mailto:a@b.ca', 'HTTPS://EXAMPLE.COM', 'tel:211', 'tel:+1 (416) 555-0100']) {
    const a = h('a', { href: ok }, 'x');
    assert.strictEqual(a.getAttribute('href'), ok);
    assert.strictEqual(a.getAttribute('rel'), 'noopener noreferrer');
    assert.strictEqual(a.getAttribute('target'), '_blank');
  }
  const a = h('a', { href: 'https://x.ca', rel: 'opener', target: '_self' });
  assert.strictEqual(a.getAttribute('rel'), 'noopener noreferrer');
  assert.strictEqual(a.getAttribute('target'), '_blank');
});

test('on: { click } attaches functions; on* attributes, style and srcdoc are refused', () => {
  const fn = () => {};
  const b = h('button', { on: { click: fn, bad: 'alert(1)' }, onclick: 'alert(1)', style: 'x:y', srcdoc: '<p>' }, 'go');
  assert.deepStrictEqual(b.listeners.click, [fn]);
  assert.strictEqual(b.listeners.bad, undefined);
  assert.deepStrictEqual(b.attrs, {});
});

test('class, aria-*, data-* and form attributes pass through', () => {
  const i = h('input', { class: 'big', 'aria-label': 'Name', 'data-x': 1, type: 'text', required: true, disabled: false, value: 'v' });
  assert.deepStrictEqual(i.attrs, { class: 'big', 'aria-label': 'Name', 'data-x': '1', type: 'text', required: '', value: 'v' });
});

test('src and action are dropped except inline images', () => {
  assert.strictEqual(h('img', { src: 'https://x.ca/a.png' }).getAttribute('src'), null);
  assert.strictEqual(h('form', { action: 'https://x.ca' }).getAttribute('action'), null);
  assert.ok(h('img', { src: 'data:image/png;base64,AAA' }).getAttribute('src'));
  assert.strictEqual(h('img', { src: 'data:image/svg+xml;base64,AAA' }).getAttribute('src'), null);
});

test('dangerous tags and bad tag names throw', () => {
  for (const t of ['script', 'IFRAME', 'style', 'object', 'a b', '', 'img onerror=x']) {
    assert.throws(() => h(t), /not allowed/, t);
  }
});
