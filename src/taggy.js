'use strict';

var crossvent = require('crossvent');
var dom = require('./dom');
var text = require('./text');
var slice = require('./slice');
var selection = require('./selection');
var autosize = require('./autosize');
var autocomplete = require('./autocomplete');
var inputTag = /^input$/i;
var ELEMENT = 1;
var BACKSPACE = 8;
var END = 35;
var HOME = 36;
var LEFT = 37;
var RIGHT = 39;
var tagClass = /\btay-tag\b/;
var tagRemovalClass = /\btay-tag-remove\b/;
var editorClass = /\btay-editor\b/g;
var inputClass = /\btay-input\b/g;
var end = { start: 'end', end: 'end' };
var defaultDelimiter = ' ';

function taggy (el, options) {
  var currentValues = [];
  var _noselect = document.activeElement !== el;
  var o = options || {};
  var delimiter = o.delimiter || defaultDelimiter;
  if (delimiter.length !== 1) {
    throw new Error('taggy expected a single-character delimiter string');
  }
  var any = hasSiblings(el);
  if (any || !inputTag.test(el.tagName)) {
    throw new Error('taggy expected an input element without any siblings');
  }
  var free = o.free !== false;
  var validate = o.validate || defaultValidate;
  var render = o.render || defaultRenderer;
  var readTag = o.readTag || defaultReader;
	var convertOnFocus = o.convertOnFocus !== false;

  var parseText = o.parseText;
  var parseValue = o.parseValue;
  var getText = (
    typeof parseText === 'string' ? s => s[parseText] :
    typeof parseText === 'function' ? parseText :
    s => s
  );
  var getValue = (
    typeof parseValue === 'string' ? s => s[parseValue] :
    typeof parseValue === 'function' ? parseValue :
    s => s
  );

  var before = dom('span', 'tay-tags tay-tags-before');
  var after = dom('span', 'tay-tags tay-tags-after');
  var parent = el.parentElement;
  el.className += ' tay-input';
  parent.className += ' tay-editor';
  parent.insertBefore(before, el);
  parent.insertBefore(after, el.nextSibling);
  bind();

  var shrinker = autosize(el);
  var completer;
  if (o.autocomplete) {
    completer = createAutocomplete();
  }

  var api = {
    addItem,
    removeItem,
    value: readValue,
    destroy
  };
  var entry = { el, api };

  evaluate([delimiter], true);
  _noselect = false;

  return api;

  function findItem (data) {
    for (let i = 0; i < currentValues.length; i++) {
      if (currentValues[i].data === data) {
        return currentValues[i];
      }
    }
    return null;
  }

  function addItem (data) {
    if (findItem(data)) {
      return api;
    }
    let el = renderItem(item);
    let item = { data, el, valid: true };
    currentValues.push(item);
    return api;
  }

  function removeItem (data) {
    var item = findItem(data);
    if (item) {
      removeItemElement(item.el);
      currentValues.splice(currentValues.indexOf(item), 1);
    }
    return api;
  }

  function renderItem (item) {
    createTag(before, item);
  }

  function removeItemElement (el) {
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
  }

  function createTag (buffer, item) {
    var empty = typeof item === 'string' && item.trim().length === 0;
    if (empty) {
      return;
    }
    let el = dom('span', 'tay-tag');
    render(el, getText(item));
    if (o.deletion) {
      el.appendChild(dom('span', 'tay-tag-remove'));
    }
    buffer.appendChild(el);
  }

  function readValue () {
    return currentValues.filter(v => v.valid).map(v => v.data);
  }

  function createAutocomplete () {
    var completer = autocomplete(el, {
      suggestions: o.autocomplete,
      getText,
      getValue,
      set: addItem
    });
    return completer;
  }

  function bind (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', keydown);
    crossvent[op](el, 'keypress', keypress);
    crossvent[op](el, 'paste', paste);
    crossvent[op](parent, 'click', click);
		if (convertOnFocus) {
      crossvent[op](document.documentElement, 'focus', documentfocus, true);
    }
  }

  function destroy () {
    bind(true);
    if (horse) { horse.destroy(); }
    el.value = '';
    el.className = el.className.replace(inputClass, '');
    parent.className = parent.className.replace(editorClass, '');
    if (before.parentElement) { before.parentElement.removeChild(before); }
    if (after.parentElement) { after.parentElement.removeChild(after); }
    shrinker.destroy();
    api.destroyed = true;
    api.destroy = api.addItem = api.removeItem = () => api;
    api.tags = api.value = () => null;
    return api;
  }

  function documentfocus (e) {
    if (e.target !== el) {
      _noselect = true;
      convert(true);
      _noselect = false;
    }
  }

  function click (e) {
    var target = e.target;
    if (tagRemovalClass.test(target.className)) {
      focusTag(target.parentElement, { start: 'end', end: 'end', remove: true });
      shift();
      return;
    }
    var top = target;
    var tagged = tagClass.test(top.className);
    while (tagged === false && top.parentElement) {
      top = top.parentElement;
      tagged = tagClass.test(top.className);
    }
    if (tagged) {
      focusTag(top, end);
    } else if (target !== el) {
      shift();
      el.focus();
    }
  }

  function shift () {
    focusTag(after.lastChild, end);
    evaluate([delimiter], true);
  }

  function convert (all) {
    evaluate([delimiter], all);
    if (all) {
      each(after, moveLeft);
    }
    crossvent.fabricate(el, 'taggy-converted');
    return api;
  }

  function moveLeft (value, tag) {
    before.appendChild(tag);
  }

  function keydown (e) {
    var sel = selection(el);
    var key = e.which || e.keyCode || e.charCode;
    if (key === HOME) {
      if (before.firstChild) {
        focusTag(before.firstChild, {});
      } else {
        selection(el, { start: 0, end: 0 });
      }
    } else if (key === END) {
      if (after.lastChild) {
        focusTag(after.lastChild, end);
      } else {
        selection(el, end);
      }
    } else if (key === LEFT && sel.start === 0 && before.lastChild) {
      focusTag(before.lastChild, end);
    } else if (key === BACKSPACE && sel.start === 0 && (sel.end === 0 || sel.end !== el.value.length) && before.lastChild) {
      focusTag(before.lastChild, end);
    } else if (key === RIGHT && sel.end === el.value.length && after.firstChild) {
      focusTag(after.firstChild, {});
    } else {
      return;
    }

    e.preventDefault();
    return false;
  }

  function keypress (e) {
    var key = e.which || e.keyCode || e.charCode;
    if (String.fromCharCode(key) === delimiter) {
      convert();
      e.preventDefault();
      return false;
    }
  }

  function paste () {
    setTimeout(function later () { evaluate(); }, 0);
  }

  function evaluate (extras, entirely) {
    var p = selection(el);
    var len = entirely ? Infinity : p.start;
    var tags = el.value.slice(0, len).concat(extras || []).split(delimiter);
    if (tags.length < 1) {
      return;
    }

    var rest = tags.pop() + el.value.slice(len);
    var removal = tags.join(delimiter).length;
    var i;

    for (i = 0; i < tags.length; i++) {
      createTag(before, tags[i]);
    }
    cleanup();
    el.value = rest;
    p.start -= removal;
    p.end -= removal;
    if (_noselect !== true) { selection(el, p); }
    shrinker.refresh();
    crossvent.fabricate(el, 'taggy-evaluated');
  }

  function cleanup () {
    var tags = [];

    each(before, detect);
    each(after, detect);

    function detect (value, tagElement) {
      if (validate(value, slice(tags))) {
        tags.push(value);
      } else {
        tagElement.parentElement.removeChild(tagElement);
      }
    }
  }

  function defaultRenderer (container, value) {
    text(container, value);
  }

  function defaultReader (tag) {
    return text(tag);
  }

  function focusTag (tag, p) {
    if (!tag) {
      return;
    }
    evaluate([delimiter], true);
    var parent = tag.parentElement;
    if (parent === before) {
      while (parent.lastChild !== tag) {
        after.insertBefore(parent.lastChild, after.firstChild);
      }
    } else {
      while (parent.firstChild !== tag) {
        before.appendChild(parent.firstChild);
      }
    }
    tag.parentElement.removeChild(tag);
    el.value = p.remove ? '' : readTag(tag);
    el.focus();
    selection(el, p);
    shrinker.refresh();
  }

  function hasSiblings () {
    var all = el.parentElement.children;
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] !== el && all[i].nodeType === ELEMENT) {
        return true;
      }
    }
    return false;
  }

  function each (side, fn) {
    var children = slice(side.children);
    var i;
    var tag;
    for (i = 0; i < children.length; i++) {
      tag = children[i];
      fn(readTag(tag), tag, i);
    }
  }

  function defaultValidate (value, tags) {
    return tags.indexOf(value) === -1;
  }
}

taggy.find = find;
module.exports = taggy;
