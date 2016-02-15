'use strict';

import crossvent from 'crossvent';
import dom from './dom';
import text from './text';
const props = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'textTransform',
  'wordSpacing',
  'textIndent',
  'webkitBoxSizing',
  'mozBoxSizing',
  'boxSizing',
  'padding',
  'border'
];
const offset = 20;

export default function factory (el) {
  const mirror = dom('span');

  document.body.appendChild(mirror);
  remap();
  bind();

  return { remap, refresh, destroy };

  function remap () {
    const c = computed();
    let value;
    for (let i = 0; i < props.length; i++) {
      value = c[props[i]];
      if (value !== void 0 && value !== null) { // otherwise IE blows up
        mirror.style[props[i]] = value;
      }
    }
    mirror.disabled = 'disabled';
    mirror.style.whiteSpace = 'pre';
    mirror.style.position = 'absolute';
    mirror.style.top = mirror.style.left = '-9999em';
  }

  function refresh () {
    const value = el.value;
    if (value === mirror.value) {
      return;
    }

    text(mirror, value);

    const width = mirror.offsetWidth + offset;

    el.style.width = width + 'px';
  }

  function bind (remove) {
    const op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', refresh);
    crossvent[op](el, 'keyup', refresh);
    crossvent[op](el, 'input', refresh);
    crossvent[op](el, 'paste', refresh);
    crossvent[op](el, 'change', refresh);
  }

  function destroy () {
    bind(true);
    mirror.parentElement.removeChild(mirror);
    el.style.width = '';
  }

  function computed () {
    if (window.getComputedStyle) {
      return window.getComputedStyle(el);
    }
    return el.currentStyle;
  }
}
