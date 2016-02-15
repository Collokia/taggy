'use strict';

export default function dom (tagName, classes) {
  const el = document.createElement(tagName);
  if (classes) {
    el.className = classes;
  }
  return el;
}
