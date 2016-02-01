'use strict';

import sum from 'hash-sum';
import crossvent from 'crossvent';
import emitter from 'contra/emitter';
import dom from './dom';
import text from './text';
import selection from './selection';
import autosize from './autosize';
import autocomplete from './autocomplete';
const inputTag = /^input$/i;
const ELEMENT = 1;
const BACKSPACE = 8;
const END = 35;
const HOME = 36;
const LEFT = 37;
const RIGHT = 39;
const sinkableKeys = [END, HOME];
const tagClass = /\btay-tag\b/;
const tagRemovalClass = /\btay-tag-remove\b/;
const editorClass = /\btay-editor\b/g;
const inputClass = /\btay-input\b/g;
const end = { start: 'end', end: 'end' };
const defaultDelimiter = ' ';

// module.exports because browserify standalone
module.exports = function taggy (el, options) {
  const currentValues = [];
  const o = options || {};
  const delimiter = o.delimiter || defaultDelimiter;
  if (delimiter.length !== 1) {
    throw new Error('taggy expected a single-character delimiter string');
  }
  const any = hasSiblings(el);
  if (any || !inputTag.test(el.tagName)) {
    throw new Error('taggy expected an input element without any siblings');
  }
  const free = o.free !== false;
  const validate = o.validate || defaultValidate;
  const render = o.render || defaultRenderer;
	const convertOnBlur = o.convertOnBlur !== false;

  const toItemData = defaultToItemData;

  const parseText = o.parseText;
  const parseValue = o.parseValue;
  const getText = (
    typeof parseText === 'string' ? d => d[parseText] :
    typeof parseText === 'function' ? parseText :
    d => d.toString()
  );
  const getValue = (
    typeof parseValue === 'string' ? d => d[parseValue] :
    typeof parseValue === 'function' ? parseValue :
    d => d.toString()
  );

  const before = dom('span', 'tay-tags tay-tags-before');
  const after = dom('span', 'tay-tags tay-tags-after');
  const parent = el.parentElement;
  el.className += ' tay-input';
  parent.className += ' tay-editor';
  parent.insertBefore(before, el);
  parent.insertBefore(after, el.nextSibling);

  const shrinker = autosize(el);
  const completer = o.autocomplete ? createAutocomplete() : null;
  const api = emitter({
    addItem,
    removeItem: removeItemByData,
    removeItemByElement,
    value: readValue,
    destroy
  });

  const placeholder = el.getAttribute('placeholder');
  let placeheld = true;

  bind();

  (document.activeElement === el ?
    evaluateSelect :
    evaluateNoSelect
  )([delimiter], true);

  return api;

  function findItem (value, prop) {
    for (let i = 0; i < currentValues.length; i++) {
      if (currentValues[i][prop || 'data'] === value) {
        return currentValues[i];
      }
    }
    return null;
  }

  function addItem (data) {
    const item = { data, valid: true };
    const el = renderItem(item);
    if (!el) {
      return api;
    }
    item.el = el;
    currentValues.push(item);
    api.emit('add', data, el);
    return api;
  }

  function removeItem (item) {
    if (item) {
      removeItemElement(item.el);
      currentValues.splice(currentValues.indexOf(item), 1);
      api.emit('remove', item.data);
    }
    return api;
  }

  function removeItemByData (data) {
    return removeItem(findItem(data));
  }

  function removeItemByElement (el) {
    return removeItem(findItem(el, 'el'));
  }

  function renderItem (item) {
    return createTag(before, item);
  }

  function removeItemElement (el) {
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
  }

  function createTag (buffer, item) {
    const {data} = item;
    const empty = typeof data === 'string' && data.trim().length === 0;
    if (empty) {
      return null;
    }
    const el = dom('span', 'tay-tag');
    render(el, item);
    if (o.deletion) {
      el.appendChild(dom('span', 'tay-tag-remove'));
    }
    buffer.appendChild(el);
    return el;
  }

  function defaultToItemData (s) {
    return s;
  }

  function readValue () {
    return currentValues.filter(v => v.valid).map(v => v.data);
  }

  function createAutocomplete () {
    const config = o.autocomplete;
    const prefix = config.prefix;
    const caching = config.cache !== false;
    const cache = config.cache || {};
    const noSource = !config.source;
    if (noSource && !config.suggestions) {
      return;
    }
    const limit = Number(config.limit) || Infinity;
    const staticItems = Array.isArray(config.suggestions) ? config.suggestions.slice() : [];
    const suggestions = noSource ? staticItems : suggest;
    const completer = autocomplete(el, {
      suggestions,
      limit,
      getText,
      getValue,
      prefix,
      debounce: config.debounce,
      set (s) {
        el.value = '';
        addItem(s);
      },
      filter (q, suggestion) {
        if (config.duplicates !== false && findItem(suggestion)) {
          return false;
        }
        if (config.filter) {
          return config.filter(q, suggestion);
        }
        return completer.defaultFilter(q, suggestion);
      }
    });
    return completer;
    function suggest (data, done) {
      const query = data.query.trim();
      if (query.length === 0) {
        done([]); return;
      }
      api.emit('autocomplete.beforeSource');
      const hash = sum(query); // fast, case insensitive, prevents collisions
      if (caching) {
        const entry = cache[hash];
        if (entry) {
          const start = entry.created.getTime();
          const duration = cache.duration || 60 * 60 * 24;
          const diff = duration * 1000;
          const fresh = new Date(start + diff) > new Date();
          if (fresh) {
            done(entry.items); return;
          }
        }
      }
      config.source(data)
        .then(result => {
          const items = Array.isArray(result) ? result : [];
          if (caching) {
            cache[hash] = { created: new Date(), items };
          }
          done(items);
        })
        .catch(error => {
          console.log('Autocomplete source promise rejected', error, el);
          done([]);
        });
    }
  }

  function updatePlaceholder (e) {
    const any = parent.querySelector('.tay-tag');
    if (!any && !placeheld) {
      el.setAttribute('placeholder', placeholder);
      placeheld = true;
    } else if (any && placeheld) {
      el.removeAttribute('placeholder');
      placeheld = false;
    }
  }

  function bind (remove) {
    const op = remove ? 'remove' : 'add';
    const ev = remove ? 'off' : 'on';
    crossvent[op](el, 'keydown', keydown);
    crossvent[op](el, 'keypress', keypress);
    crossvent[op](el, 'paste', paste);
    crossvent[op](parent, 'click', click);
		if (convertOnBlur) {
      crossvent[op](document.documentElement, 'blur', documentblur, true);
    }
    if (placeholder) {
      api[ev]('add', updatePlaceholder);
      api[ev]('remove', updatePlaceholder);
      crossvent[op](el, 'keydown', updatePlaceholder);
      crossvent[op](el, 'keypress', updatePlaceholder);
      crossvent[op](el, 'paste', updatePlaceholder);
      crossvent[op](parent, 'click', updatePlaceholder);
      updatePlaceholder();
    }
  }

  function destroy () {
    bind(true);
    if (completer) { completer.destroy(); }
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

  function documentblur (e) {
    if (e.target !== el) {
      return;
    }
    convert(true);
  }

  function click (e) {
    const target = e.target;
    if (tagRemovalClass.test(target.className)) {
      focusTag(target.parentElement, { start: 'end', end: 'end', remove: true });
      shift();
      return;
    }
    let top = target;
    let tagged = tagClass.test(top.className);
    while (tagged === false && top.parentElement) {
      top = top.parentElement;
      tagged = tagClass.test(top.className);
    }
    if (tagged && free) {
      focusTag(top, end);
    } else if (target !== el) {
      shift();
      el.focus();
    }
  }

  function shift () {
    focusTag(after.lastChild, end);
    evaluateSelect([delimiter], true);
  }

  function convert (all) {
    (all ? evaluateNoSelect : evaluateSelect)([delimiter], all);
    if (all) {
      each(after, moveLeft);
    }
    return api;
  }

  function moveLeft (value, tag) {
    before.appendChild(tag);
  }

  function keydown (e) {
    const sel = selection(el);
    const key = e.which || e.keyCode || e.charCode;
    const canMoveLeft = sel.start === 0 && sel.end === 0 && before.lastChild;
    const canMoveRight = sel.start === el.value.length && sel.end === el.value.length && after.firstChild;
    if (free) {
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
      } else if (key === BACKSPACE && canMoveLeft) {
        focusTag(before.lastChild, end);
      } else if (key === RIGHT && canMoveRight) {
        focusTag(after.firstChild, {});
      } else if (key === LEFT && canMoveLeft) {
        focusTag(before.lastChild, end);
      } else {
        return;
      }
    } else {
      if (key === BACKSPACE && canMoveLeft) {
        removeItemByElement(before.lastChild);
      } else if (key === RIGHT && canMoveRight) {
        before.appendChild(after.firstChild);
      } else if (key === LEFT && canMoveLeft) {
        after.insertBefore(before.lastChild, after.firstChild);
      } else if (sinkableKeys.indexOf(key) === -1) { // prevent default otherwise
        return;
      }
      if (completer) { completer.refreshPosition(); }
    }

    e.preventDefault();
    return false;
  }

  function keypress (e) {
    const key = e.which || e.keyCode || e.charCode;
    if (String.fromCharCode(key) === delimiter) {
      convert();
      e.preventDefault();
      return false;
    }
  }

  function paste () {
    setTimeout(() => evaluateSelect(), 0);
  }

  function evaluateNoSelect (extras, entirely) {
    evaluateInternal(extras, entirely); // necessary for blur events, initialization, unfocused evaluation
  }

  function evaluateSelect (extras, entirely) {
    evaluateInternal(extras, entirely, selection(el)); // only if we know the input has/should have focus
  }

  function evaluateInternal (extras, entirely, p) {
    const len = entirely || !p ? Infinity : p.start;
    const tags = el.value.slice(0, len).concat(extras || []).split(delimiter);
    if (tags.length < 1 || !free) {
      return;
    }

    const rest = tags.pop() + el.value.slice(len);
    const removal = tags.join(delimiter).length;

    tags.forEach(tag => addItem(toItemData(tag)));
    cleanup();
    el.value = rest;
    reselect();
    shrinker.refresh();

    function reselect () {
      if (p) {
        p.start -= removal;
        p.end -= removal;
        selection(el, p);
      }
    }
  }

  function cleanup () {
    const tags = [];

    each(before, detect);
    each(after, detect);

    function detect (value, tagElement) {
      if (validate(value, tags.slice())) {
        tags.push(value);
      } else if (o.preventInvalid) {
        tagElement.parentElement.removeChild(tagElement);
      } else {
        tagElement.classList.add('tay-invalid');
        api.emit('invalid', value, tagElement);
      }
    }
  }

  function defaultRenderer (container, item) {
    text(container, getText(item.data));
  }

  function readTag (tag) {
    return text(tag);
  }

  function focusTag (tag, p) {
    if (!tag) {
      return;
    }
    evaluateSelect([delimiter], true);
    const parent = tag.parentElement;
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
    const children = el.parentElement.children;
    return [...children].some(s => s !== el && s.nodeType === ELEMENT);
  }

  function each (container, fn) {
    [...container.children].forEach((tag, i) => fn(readTag(tag), tag, i));
  }

  function defaultValidate (value, tags) {
    return tags.indexOf(value) === -1;
  }
}
