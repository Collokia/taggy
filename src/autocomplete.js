'use strict';

import sell from 'sell';
import crossvent from 'crossvent';
import bullseye from 'bullseye';
import fuzzysearch from 'fuzzysearch';
const KEY_BACKSPACE = 8;
const KEY_ENTER = 13;
const KEY_ESC = 27;
const KEY_UP = 38;
const KEY_DOWN = 40;
const KEY_TAB = 9;
const doc = document;
const docElement = doc.documentElement;

export default function autocomplete (el, options) {
  const o = options || {};
  const parent = o.appendTo || doc.body;
  const render = o.render || defaultRenderer;
  const {getText, getValue, form, suggestions} = o;
  const limit = typeof o.limit === 'number' ? o.limit : Infinity;
  const userFilter = o.filter || defaultFilter;
  const userSet = o.set || defaultSetter;
  const ul = tag('ul', 'tac-list');
  const deferredFiltering = defer(filtering);
  const state = { counter: 0, value: null };
  let selection = null;
  let eye;
  let attachment = el;
  let textInput;
  let anyInput;
  let ranchorleft;
  let ranchorright;

  if (o.autoHideOnBlur === void 0) { o.autoHideOnBlur = true; }
  if (o.autoHideOnClick === void 0) { o.autoHideOnClick = true; }
  if (o.autoShowOnUpDown === void 0) { o.autoShowOnUpDown = el.tagName === 'INPUT'; }
  if (o.anchor) {
    ranchorleft = new RegExp('^' + o.anchor);
    ranchorright = new RegExp(o.anchor + '$');
  }

  const api = {
    add,
    anchor: o.anchor,
    clear,
    show,
    hide,
    toggle,
    destroy,
    refreshPosition,
    appendText,
    appendHTML,
    filterAnchoredText,
    filterAnchoredHTML,
    defaultAppendText: appendText,
    defaultFilter,
    defaultRenderer,
    defaultSetter,
    retarget,
    attachment,
    list: ul,
    suggestions: []
  };

  retarget(el);
  parent.appendChild(ul);
  el.setAttribute('autocomplete', 'off');

  if (Array.isArray(suggestions)) {
    loaded(suggestions, false);
  }

  return api;

  function retarget (el) {
    inputEvents(true);
    attachment = api.attachment = el;
    textInput = attachment.tagName === 'INPUT' || attachment.tagName === 'TEXTAREA';
    anyInput = textInput || isEditable(attachment);
    inputEvents();
  }

  function refreshPosition () {
    if (eye) { eye.refresh(); }
  }

  function loading (forceShow) {
    if (typeof suggestions === 'function') {
      crossvent.remove(attachment, 'focus', loading);
      const value = readInput();
      if (value !== state.value) {
        state.counter++;
        state.value = value;

        const counter = state.counter;
        suggestions(value, function (s) {
          if (state.counter === counter) {
            loaded(s, forceShow);
          }
        });
      }
    }
  }

  function loaded (suggestions, forceShow) {
    clear();
    suggestions.forEach(add);
    api.suggestions = suggestions;
    if (forceShow) {
      show();
    }
    filtering();
  }

  function clear () {
    unselect();
    while (ul.lastChild) {
      ul.removeChild(ul.lastChild);
    }
  }

  function readInput () {
    return textInput ? el.value : el.innerHTML;
  }

  function add (suggestion) {
    let li = tag('li', 'tac-item');
    render(li, suggestion);
    breakupForHighlighter(li);
    crossvent.add(li, 'click', clickedSuggestion);
    crossvent.add(li, 'autocomplete-filter', filterItem);
    crossvent.add(li, 'autocomplete-hide', hideItem);
    ul.appendChild(li);
    api.suggestions.push(suggestion);
    return li;

    function clickedSuggestion () {
      const input = getText(suggestion);
      const value = getValue(suggestion);
      set(value);
      hide();
      attachment.focus();
      const prefix = o.prefix && o.prefix(input);
      if (prefix) {
        el.value = prefix;
        el.select();
        show();
        filtering();
      }
    }

    function filterItem () {
      const value = readInput();
      if (filter(value, suggestion)) {
        li.className = li.className.replace(/ tac-hide/g, '');
      } else {
        crossvent.fabricate(li, 'autocomplete-hide');
      }
    }

    function hideItem () {
      if (!hidden(li)) {
        li.className += ' tac-hide';
        if (selection === li) {
          unselect();
        }
      }
    }
  }

  function breakupForHighlighter (el) {
    getTextChildren(el).forEach(el => {
      const parent = el.parentElement;
      const text = el.textContent || el.nodeValue || '';
      if (text.length === 0) {
        return;
      }
      for (let char of text) {
        parent.insertBefore(spanFor(char), el);
      }
      parent.removeChild(el);
      function spanFor (char) {
        const span = doc.createElement('span');
        span.className = 'tac-char';
        span.textContent = span.innerText = char;
        return span;
      }
    });
  }

  function highlight (el, needle) {
    const chars = [...el.querySelectorAll('.tac-char')];

    for (let input of needle) {
      while (chars.length) {
        let char = chars.shift();
        let charText = char.innerText || char.textContent;
        if (charText === input) {
          on(char);
          break;
        } else {
          off(char);
        }
      }
    }
    while (chars.length) {
      off(chars.shift());
    }

    function on (ch) {
      ch.classList.add('tac-char-highlight');
    }
    function off (ch) {
      ch.classList.remove('tac-char-highlight');
    }
  }

  function getTextChildren (el) {
    const texts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      texts.push(node);
    }
    return texts;
  }

  function set (value) {
    if (o.anchor) {
      return (isText() ? api.appendText : api.appendHTML)(value);
    }
    userSet(value);
  }

  function filter (value, suggestion) {
    if (o.anchor) {
      const il = (isText() ? api.filterAnchoredText : api.filterAnchoredHTML)(value, suggestion);
      return il ? userFilter(il.input, il.suggestion) : false;
    }
    return userFilter(value, suggestion);
  }

  function isText () { return isInput(attachment); }
  function visible () { return ul.className.indexOf('tac-show') !== -1; }
  function hidden (li) { return li.className.indexOf('tac-hide') !== -1; }

  function show () {
    if (!visible()) {
      ul.className += ' tac-show';
      eye.refresh();
      crossvent.fabricate(attachment, 'autocomplete-show');
    }
  }

  function toggler (e) {
    const left = e.which === 1 && !e.metaKey && !e.ctrlKey;
    if (left === false) {
      return; // we only care about honest to god left-clicks
    }
    toggle();
  }

  function toggle () {
    if (!visible()) {
      show();
    } else {
      hide();
    }
  }

  function select (suggestion) {
    unselect();
    if (suggestion) {
      selection = suggestion;
      selection.className += ' tac-selected';
    }
  }

  function unselect () {
    if (selection) {
      selection.className = selection.className.replace(/ tac-selected/g, '');
      selection = null;
    }
  }

  function move (up, moves) {
    const total = ul.children.length;
    if (total < moves) {
      unselect();
      return;
    }
    if (total === 0) {
      return;
    }
    const first = up ? 'lastChild' : 'firstChild';
    const next = up ? 'previousSibling' : 'nextSibling';
    const suggestion = selection && selection[next] || ul[first];

    select(suggestion);

    if (hidden(suggestion)) {
      move(up, moves ? moves + 1 : 1);
    }
  }

  function hide () {
    eye.sleep();
    ul.className = ul.className.replace(/ tac-show/g, '');
    unselect();
    crossvent.fabricate(attachment, 'autocomplete-hide');
  }

  function keydown (e) {
    const shown = visible();
    const which = e.which || e.keyCode;
    if (which === KEY_DOWN) {
      if (anyInput && o.autoShowOnUpDown) {
        show();
      }
      if (shown) {
        move();
        stop(e);
      }
    } else if (which === KEY_UP) {
      if (anyInput && o.autoShowOnUpDown) {
        show();
      }
      if (shown) {
        move(true);
        stop(e);
      }
    } else if (which === KEY_BACKSPACE) {
      if (anyInput && o.autoShowOnUpDown) {
        show();
      }
    } else if (shown) {
      if (which === KEY_ENTER) {
        if (selection) {
          crossvent.fabricate(selection, 'click');
        } else {
          hide();
        }
        stop(e);
      } else if (which === KEY_ESC) {
        hide();
        stop(e);
      }
    }
  }

  function stop (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function filtering () {
    if (!visible()) {
      return;
    }
    loading(true);
    crossvent.fabricate(attachment, 'autocomplete-filter');
    const value = readInput().trim();
    let li = ul.firstChild;
    let count = 0;
    while (li) {
      if (count >= limit) {
        crossvent.fabricate(li, 'autocomplete-hide');
      } else {
        crossvent.fabricate(li, 'autocomplete-filter');
        if (li.className.indexOf('tac-hide') === -1) {
          count++;
          highlight(li, value);
        }
      }
      li = li.nextSibling;
    }
    if (!selection) {
      move();
    }
    if (!selection) {
      hide();
    }
  }

  function deferredFilteringNoEnter (e) {
    const which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    deferredFiltering();
  }

  function deferredShow (e) {
    const which = e.which || e.keyCode;
    if (which === KEY_ENTER || which === KEY_TAB) {
      return;
    }
    setTimeout(show, 0);
  }

  function autocompleteEventTarget (e) {
    let target = e.target;
    if (target === attachment) {
      return true;
    }
    while (target) {
      if (target === ul || target === attachment) {
        return true;
      }
      target = target.parentNode;
    }
  }

  function hideOnBlur (e) {
    const which = e.which || e.keyCode;
    if (which === KEY_TAB) {
      hide();
    }
  }

  function hideOnClick (e) {
    if (autocompleteEventTarget(e)) {
      return;
    }
    hide();
  }

  function inputEvents (remove) {
    const op = remove ? 'remove' : 'add';
    if (eye) {
      eye.destroy();
      eye = null;
    }
    if (!remove) {
      eye = bullseye(ul, attachment, { caret: anyInput && attachment.tagName !== 'INPUT' });
      if (!visible()) { eye.sleep(); }
    }
    if (remove || (anyInput && doc.activeElement !== attachment)) {
      crossvent[op](attachment, 'focus', loading);
    } else {
      loading();
    }
    if (anyInput) {
      crossvent[op](attachment, 'keypress', deferredShow);
      crossvent[op](attachment, 'keypress', deferredFiltering);
      crossvent[op](attachment, 'keydown', deferredFilteringNoEnter);
      crossvent[op](attachment, 'paste', deferredFiltering);
      crossvent[op](attachment, 'keydown', keydown);
      if (o.autoHideOnBlur) { crossvent[op](attachment, 'keydown', hideOnBlur); }
    } else {
      crossvent[op](attachment, 'click', toggler);
      crossvent[op](docElement, 'keydown', keydown);
    }
    if (o.autoHideOnClick) { crossvent[op](doc, 'click', hideOnClick); }
    if (form) { crossvent[op](form, 'submit', hide); }
  }

  function destroy () {
    inputEvents(true);
    if (parent.contains(ul)) { parent.removeChild(ul); }
  }

  function defaultSetter (value) {
    if (textInput) {
      el.value = value;
    } else {
      el.innerHTML = value;
    }
  }

  function defaultRenderer (li, suggestion) {
    li.innerText = li.textContent = getText(suggestion);
  }

  function defaultFilter (q, suggestion) {
    const needle = q.toLowerCase();
    const text = getText(suggestion) || '';
    if (fuzzysearch(needle, text.toLowerCase())) {
      return true;
    }
    const value = getValue(suggestion) || '';
    if (typeof value !== 'string') {
      return false;
    }
    return fuzzysearch(needle, value.toLowerCase());
  }

  function loopbackToAnchor (text, p) {
    let result = '';
    let anchored = false;
    let start = p.start;
    while (anchored === false && start >= 0) {
      result = text.substr(start - 1, p.start - start + 1);
      anchored = ranchorleft.test(result);
      start--;
    }
    return {
      text: anchored ? result : null,
      start
    };
  }

  function filterAnchoredText (q, suggestion) {
    const position = sell(el);
    const input = loopbackToAnchor(q, position).text;
    if (input) {
      return { input, suggestion };
    }
  }

  function appendText (value) {
    const current = el.value;
    const position = sell(el);
    const input = loopbackToAnchor(current, position);
    const left = current.substr(0, input.start);
    const right = current.substr(input.start + input.text.length + (position.end - position.start));
    const before = left + value + ' ';

    el.value = before + right;
    sell(el, { start: before.length, end: before.length });
  }

  function filterAnchoredHTML () {
    throw new Error('Anchoring in editable elements is disabled by default.');
  }

  function appendHTML () {
    throw new Error('Anchoring in editable elements is disabled by default.');
  }
}

function isInput (el) { return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'; }

function tag (type, className) {
  const el = doc.createElement(type);
  el.className = className;
  return el;
}

function defer (fn) { return function () { setTimeout(fn, 0); }; }

function isEditable (el) {
  const value = el.getAttribute('contentEditable');
  if (value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (el.parentElement) {
    return isEditable(el.parentElement);
  }
  return false;
}
