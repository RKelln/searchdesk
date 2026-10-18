// Safe element builder: text only, safe links (DESIGN 7.4, 12).
// h(tag, attrs, ...children). Strings and numbers become text nodes; there is no way to pass HTML.
window.Desk = window.Desk || {};
(function () {
  var BAD_TAGS = /^(script|style|iframe|frame|frameset|object|embed|link|meta|base|template|noscript)$/i;
  var BAD_ATTRS = /^(style|srcdoc|innerhtml|outerhtml|html|textcontent|innertext|is)$/i;
  var LINK_OK = /^(https?:|mailto:)/i;
  var TEL_OK = /^tel:\+?[0-9][0-9\-(). ]{0,30}$/i; // phone numbers only
  var IMG_OK = /^data:image\/(png|jpeg|gif|webp);/i;

  // Only http:, https:, mailto: and tel: (digits only) survive. Whitespace and control characters are stripped first,
  // because browsers ignore them inside a scheme ("java\tscript:").
  function safeHref(v) {
    var s = String(v).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '');
    if (TEL_OK.test(String(v).trim())) return String(v).trim();
    return LINK_OK.test(s) ? String(v).trim() : null;
  }

  function addChildren(el, list, doc) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c === null || c === undefined || c === false || c === true) continue;
      if (Array.isArray(c)) { addChildren(el, c, doc); continue; }
      if (typeof c === 'string' || typeof c === 'number') { el.appendChild(doc.createTextNode(String(c))); continue; }
      if (typeof c === 'object' && typeof c.nodeType === 'number') { el.appendChild(c); continue; }
      el.appendChild(doc.createTextNode(String(c)));
    }
  }

  function h(tag, attrs) {
    var doc = window.document;
    if (typeof tag !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tag) || BAD_TAGS.test(tag)) {
      throw new Error('h(): this tag is not allowed: ' + tag);
    }
    var el = doc.createElement(tag);
    var selectValue; // a value waiting for a select's options to exist (see below)
    var children = Array.prototype.slice.call(arguments, 2);
    // A non-plain second argument (string, node, array) is a child, so h('p', 'text') works.
    if (attrs !== null && attrs !== undefined &&
        (typeof attrs !== 'object' || Array.isArray(attrs) || typeof attrs.nodeType === 'number')) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        var v = attrs[name];
        if (v === null || v === undefined || v === false) return;
        if (name === 'on') {
          if (typeof v !== 'object') return;
          Object.keys(v).forEach(function (ev) {
            if (typeof v[ev] === 'function') el.addEventListener(ev, v[ev]);
          });
          return;
        }
        if (/^on/i.test(name) || BAD_ATTRS.test(name)) return; // handlers only through on: {}
        // A select's value is a property, not an attribute. <select value="big"> is not a thing: every browser
        // ignores it and shows the first option, so a control built to show a saved choice would quietly
        // disagree with it. Hold it until the options are in, or there is nothing to select.
        if (name === 'value' && String(tag).toLowerCase() === 'select') { selectValue = String(v); return; }
        if (typeof v === 'function' || typeof v === 'object') return;
        if (name === 'href') {
          var href = safeHref(v);
          if (href === null) return;
          el.setAttribute('href', href);
          el.setAttribute('rel', 'noopener noreferrer');
          el.setAttribute('target', '_blank');
          return;
        }
        if (name === 'rel' || name === 'target') {
          if (attrs.href !== undefined) return; // set by the link rule above
        }
        if (/^(src|action|formaction|srcset|poster|data|xlink:href|ping|background)$/i.test(name)) {
          if (name.toLowerCase() === 'src' && IMG_OK.test(String(v))) el.setAttribute('src', String(v));
          return; // no network and no scripts: only inline images pass
        }
        if (!/^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/.test(name)) return;
        el.setAttribute(name, v === true ? '' : String(v));
      });
    }
    addChildren(el, children, doc);
    if (selectValue !== undefined) {
      el.value = selectValue;
      // Nothing matched, which happens when a saved value has gone stale. Go back to the first option rather than
      // showing a blank control: the rest of the app treats an unrecognised value as the default, not as nothing.
      if (el.value !== selectValue && el.options.length) el.selectedIndex = 0;
    }
    return el;
  }

  h.safeHref = safeHref;
  window.Desk.h = h;
})();
