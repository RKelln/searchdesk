'use strict';
// A tiny fake document, just enough for h(). Not a real DOM.
function node(type) { return { nodeType: type, childNodes: [] }; }
function makeDoc() {
  return {
    createTextNode(text) { const n = node(3); n.textContent = String(text); return n; },
    createElement(tag) {
      const el = node(1);
      el.tagName = tag.toUpperCase();
      el.attrs = {};
      el.listeners = {};
      el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
      el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
      el.addEventListener = (ev, fn) => { (el.listeners[ev] = el.listeners[ev] || []).push(fn); };
      el.appendChild = (c) => { el.childNodes.push(c); return c; };
      Object.defineProperty(el, 'textContent', {
        get() { return el.childNodes.map((c) => c.textContent).join(''); },
      });
      return el;
    },
  };
}
module.exports = { makeDoc };
