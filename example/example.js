void function () {
  'use strict';

  taggy(ty, {
    autocomplete: [
      {tagId:"dev:android", descriptionText:"android", taxonomy:"devWorld"},
      {tagId:"dev:java", descriptionText:"java", taxonomy:"langs"},
      {tagId:"dev:jvm", descriptionText:"jvm", taxonomy:"other"}
    ],
    parseText: s => s.descriptionText
  });

  function events (el, type, fn) {
    if (el.addEventListener) {
      el.addEventListener(type, fn);
    } else if (el.attachEvent) {
      el.attachEvent('on' + type, wrap(fn));
    } else {
      el['on' + type] = wrap(fn);
    }
    function wrap (originalEvent) {
      var e = originalEvent || global.event;
      e.target = e.target || e.srcElement;
      e.preventDefault  = e.preventDefault  || function preventDefault () { e.returnValue = false; };
      e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
      fn.call(el, e);
    }
  }
}();
