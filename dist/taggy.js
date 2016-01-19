(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.taggy = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var throttle = require('./throttle');
var tailormade = require('./tailormade');

function bullseye (el, target, options) {
  var o = options;
  var domTarget = target && target.tagName;

  if (!domTarget && arguments.length === 2) {
    o = target;
  }
  if (!domTarget) {
    target = el;
  }
  if (!o) { o = {}; }

  var destroyed = false;
  var throttledWrite = throttle(write, 30);
  var tailorOptions = { update: o.autoupdateToCaret !== false && update };
  var tailor = o.caret && tailormade(target, tailorOptions);

  write();

  if (o.tracking !== false) {
    crossvent.add(window, 'resize', throttledWrite);
  }

  return {
    read: readNull,
    refresh: write,
    destroy: destroy,
    sleep: sleep
  };

  function sleep () {
    tailorOptions.sleeping = true;
  }

  function readNull () { return read(); }

  function read (readings) {
    var bounds = target.getBoundingClientRect();
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    if (tailor) {
      readings = tailor.read();
      return {
        x: (readings.absolute ? 0 : bounds.left) + readings.x,
        y: (readings.absolute ? 0 : bounds.top) + scrollTop + readings.y + 20
      };
    }
    return {
      x: bounds.left,
      y: bounds.top + scrollTop
    };
  }

  function update (readings) {
    write(readings);
  }

  function write (readings) {
    if (destroyed) {
      throw new Error('Bullseye can\'t refresh after being destroyed. Create another instance instead.');
    }
    if (tailor && !readings) {
      tailorOptions.sleeping = false;
      tailor.refresh(); return;
    }
    var p = read(readings);
    if (!tailor && target !== el) {
      p.y += target.offsetHeight;
    }
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  }

  function destroy () {
    if (tailor) { tailor.destroy(); }
    crossvent.remove(window, 'resize', throttledWrite);
    destroyed = true;
  }
}

module.exports = bullseye;

},{"./tailormade":10,"./throttle":11,"crossvent":13}],2:[function(require,module,exports){
(function (global){
'use strict';

var getSelection;
var doc = global.document;
var getSelectionRaw = require('./getSelectionRaw');
var getSelectionNullOp = require('./getSelectionNullOp');
var getSelectionSynthetic = require('./getSelectionSynthetic');
var isHost = require('./isHost');
if (isHost.method(global, 'getSelection')) {
  getSelection = getSelectionRaw;
} else if (typeof doc.selection === 'object' && doc.selection) {
  getSelection = getSelectionSynthetic;
} else {
  getSelection = getSelectionNullOp;
}

module.exports = getSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./getSelectionNullOp":3,"./getSelectionRaw":4,"./getSelectionSynthetic":5,"./isHost":6}],3:[function(require,module,exports){
'use strict';

function noop () {}

function getSelectionNullOp () {
  return {
    removeAllRanges: noop,
    addRange: noop
  };
}

module.exports = getSelectionNullOp;

},{}],4:[function(require,module,exports){
(function (global){
'use strict';

function getSelectionRaw () {
  return global.getSelection();
}

module.exports = getSelectionRaw;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
(function (global){
'use strict';

var rangeToTextRange = require('./rangeToTextRange');
var doc = global.document;
var body = doc.body;
var GetSelectionProto = GetSelection.prototype;

function GetSelection (selection) {
  var self = this;
  var range = selection.createRange();

  this._selection = selection;
  this._ranges = [];

  if (selection.type === 'Control') {
    updateControlSelection(self);
  } else if (isTextRange(range)) {
    updateFromTextRange(self, range);
  } else {
    updateEmptySelection(self);
  }
}

GetSelectionProto.removeAllRanges = function () {
  var textRange;
  try {
    this._selection.empty();
    if (this._selection.type !== 'None') {
      textRange = body.createTextRange();
      textRange.select();
      this._selection.empty();
    }
  } catch (e) {
  }
  updateEmptySelection(this);
};

GetSelectionProto.addRange = function (range) {
  if (this._selection.type === 'Control') {
    addRangeToControlSelection(this, range);
  } else {
    rangeToTextRange(range).select();
    this._ranges[0] = range;
    this.rangeCount = 1;
    this.isCollapsed = this._ranges[0].collapsed;
    updateAnchorAndFocusFromRange(this, range, false);
  }
};

GetSelectionProto.setRanges = function (ranges) {
  this.removeAllRanges();
  var rangeCount = ranges.length;
  if (rangeCount > 1) {
    createControlSelection(this, ranges);
  } else if (rangeCount) {
    this.addRange(ranges[0]);
  }
};

GetSelectionProto.getRangeAt = function (index) {
  if (index < 0 || index >= this.rangeCount) {
    throw new Error('getRangeAt(): index out of bounds');
  } else {
    return this._ranges[index].cloneRange();
  }
};

GetSelectionProto.removeRange = function (range) {
  if (this._selection.type !== 'Control') {
    removeRangeManually(this, range);
    return;
  }
  var controlRange = this._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  var el;
  var removed = false;
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    el = controlRange.item(i);
    if (el !== rangeElement || removed) {
      newControlRange.add(controlRange.item(i));
    } else {
      removed = true;
    }
  }
  newControlRange.select();
  updateControlSelection(this);
};

GetSelectionProto.eachRange = function (fn, returnValue) {
  var i = 0;
  var len = this._ranges.length;
  for (i = 0; i < len; ++i) {
    if (fn(this.getRangeAt(i))) {
      return returnValue;
    }
  }
};

GetSelectionProto.getAllRanges = function () {
  var ranges = [];
  this.eachRange(function (range) {
    ranges.push(range);
  });
  return ranges;
};

GetSelectionProto.setSingleRange = function (range) {
  this.removeAllRanges();
  this.addRange(range);
};

function createControlSelection (sel, ranges) {
  var controlRange = body.createControlRange();
  for (var i = 0, el, len = ranges.length; i < len; ++i) {
    el = getSingleElementFromRange(ranges[i]);
    try {
      controlRange.add(el);
    } catch (e) {
      throw new Error('setRanges(): Element could not be added to control selection');
    }
  }
  controlRange.select();
  updateControlSelection(sel);
}

function removeRangeManually (sel, range) {
  var ranges = sel.getAllRanges();
  sel.removeAllRanges();
  for (var i = 0, len = ranges.length; i < len; ++i) {
    if (!isSameRange(range, ranges[i])) {
      sel.addRange(ranges[i]);
    }
  }
  if (!sel.rangeCount) {
    updateEmptySelection(sel);
  }
}

function updateAnchorAndFocusFromRange (sel, range) {
  var anchorPrefix = 'start';
  var focusPrefix = 'end';
  sel.anchorNode = range[anchorPrefix + 'Container'];
  sel.anchorOffset = range[anchorPrefix + 'Offset'];
  sel.focusNode = range[focusPrefix + 'Container'];
  sel.focusOffset = range[focusPrefix + 'Offset'];
}

function updateEmptySelection (sel) {
  sel.anchorNode = sel.focusNode = null;
  sel.anchorOffset = sel.focusOffset = 0;
  sel.rangeCount = 0;
  sel.isCollapsed = true;
  sel._ranges.length = 0;
}

function rangeContainsSingleElement (rangeNodes) {
  if (!rangeNodes.length || rangeNodes[0].nodeType !== 1) {
    return false;
  }
  for (var i = 1, len = rangeNodes.length; i < len; ++i) {
    if (!isAncestorOf(rangeNodes[0], rangeNodes[i])) {
      return false;
    }
  }
  return true;
}

function getSingleElementFromRange (range) {
  var nodes = range.getNodes();
  if (!rangeContainsSingleElement(nodes)) {
    throw new Error('getSingleElementFromRange(): range did not consist of a single element');
  }
  return nodes[0];
}

function isTextRange (range) {
  return range && range.text !== void 0;
}

function updateFromTextRange (sel, range) {
  sel._ranges = [range];
  updateAnchorAndFocusFromRange(sel, range, false);
  sel.rangeCount = 1;
  sel.isCollapsed = range.collapsed;
}

function updateControlSelection (sel) {
  sel._ranges.length = 0;
  if (sel._selection.type === 'None') {
    updateEmptySelection(sel);
  } else {
    var controlRange = sel._selection.createRange();
    if (isTextRange(controlRange)) {
      updateFromTextRange(sel, controlRange);
    } else {
      sel.rangeCount = controlRange.length;
      var range;
      for (var i = 0; i < sel.rangeCount; ++i) {
        range = doc.createRange();
        range.selectNode(controlRange.item(i));
        sel._ranges.push(range);
      }
      sel.isCollapsed = sel.rangeCount === 1 && sel._ranges[0].collapsed;
      updateAnchorAndFocusFromRange(sel, sel._ranges[sel.rangeCount - 1], false);
    }
  }
}

function addRangeToControlSelection (sel, range) {
  var controlRange = sel._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    newControlRange.add(controlRange.item(i));
  }
  try {
    newControlRange.add(rangeElement);
  } catch (e) {
    throw new Error('addRange(): Element could not be added to control selection');
  }
  newControlRange.select();
  updateControlSelection(sel);
}

function isSameRange (left, right) {
  return (
    left.startContainer === right.startContainer &&
    left.startOffset === right.startOffset &&
    left.endContainer === right.endContainer &&
    left.endOffset === right.endOffset
  );
}

function isAncestorOf (ancestor, descendant) {
  var node = descendant;
  while (node.parentNode) {
    if (node.parentNode === ancestor) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

function getSelection () {
  return new GetSelection(global.document.selection);
}

module.exports = getSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./rangeToTextRange":7}],6:[function(require,module,exports){
'use strict';

function isHostMethod (host, prop) {
  var type = typeof host[prop];
  return type === 'function' || !!(type === 'object' && host[prop]) || type === 'unknown';
}

function isHostProperty (host, prop) {
  return typeof host[prop] !== 'undefined';
}

function many (fn) {
  return function areHosted (host, props) {
    var i = props.length;
    while (i--) {
      if (!fn(host, props[i])) {
        return false;
      }
    }
    return true;
  };
}

module.exports = {
  method: isHostMethod,
  methods: many(isHostMethod),
  property: isHostProperty,
  properties: many(isHostProperty)
};

},{}],7:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var body = doc.body;

function rangeToTextRange (p) {
  if (p.collapsed) {
    return createBoundaryTextRange({ node: p.startContainer, offset: p.startOffset }, true);
  }
  var startRange = createBoundaryTextRange({ node: p.startContainer, offset: p.startOffset }, true);
  var endRange = createBoundaryTextRange({ node: p.endContainer, offset: p.endOffset }, false);
  var textRange = body.createTextRange();
  textRange.setEndPoint('StartToStart', startRange);
  textRange.setEndPoint('EndToEnd', endRange);
  return textRange;
}

function isCharacterDataNode (node) {
  var t = node.nodeType;
  return t === 3 || t === 4 || t === 8 ;
}

function createBoundaryTextRange (p, starting) {
  var bound;
  var parent;
  var offset = p.offset;
  var workingNode;
  var childNodes;
  var range = body.createTextRange();
  var data = isCharacterDataNode(p.node);

  if (data) {
    bound = p.node;
    parent = bound.parentNode;
  } else {
    childNodes = p.node.childNodes;
    bound = offset < childNodes.length ? childNodes[offset] : null;
    parent = p.node;
  }

  workingNode = doc.createElement('span');
  workingNode.innerHTML = '&#feff;';

  if (bound) {
    parent.insertBefore(workingNode, bound);
  } else {
    parent.appendChild(workingNode);
  }

  range.moveToElementText(workingNode);
  range.collapse(!starting);
  parent.removeChild(workingNode);

  if (data) {
    range[starting ? 'moveStart' : 'moveEnd']('character', offset);
  }
  return range;
}

module.exports = rangeToTextRange;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){
'use strict';

var getSelection = require('./getSelection');
var setSelection = require('./setSelection');

module.exports = {
  get: getSelection,
  set: setSelection
};

},{"./getSelection":2,"./setSelection":9}],9:[function(require,module,exports){
(function (global){
'use strict';

var getSelection = require('./getSelection');
var rangeToTextRange = require('./rangeToTextRange');
var doc = global.document;

function setSelection (p) {
  if (doc.createRange) {
    modernSelection();
  } else {
    oldSelection();
  }

  function modernSelection () {
    var sel = getSelection();
    var range = doc.createRange();
    if (!p.startContainer) {
      return;
    }
    if (p.endContainer) {
      range.setEnd(p.endContainer, p.endOffset);
    } else {
      range.setEnd(p.startContainer, p.startOffset);
    }
    range.setStart(p.startContainer, p.startOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function oldSelection () {
    rangeToTextRange(p).select();
  }
}

module.exports = setSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./getSelection":2,"./rangeToTextRange":7}],10:[function(require,module,exports){
(function (global){
'use strict';

var sell = require('sell');
var crossvent = require('crossvent');
var seleccion = require('seleccion');
var throttle = require('./throttle');
var getSelection = seleccion.get;
var props = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing'
];
var win = global;
var doc = document;
var ff = win.mozInnerScreenX !== null && win.mozInnerScreenX !== void 0;

function tailormade (el, options) {
  var textInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  var throttledRefresh = throttle(refresh, 30);
  var o = options || {};

  bind();

  return {
    read: readPosition,
    refresh: throttledRefresh,
    destroy: destroy
  };

  function noop () {}
  function readPosition () { return (textInput ? coordsText : coordsHTML)(); }

  function refresh () {
    if (o.sleeping) {
      return;
    }
    return (o.update || noop)(readPosition());
  }

  function coordsText () {
    var p = sell(el);
    var context = prepare();
    var readings = readTextCoords(context, p.start);
    doc.body.removeChild(context.mirror);
    return readings;
  }

  function coordsHTML () {
    var sel = getSelection();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);
      var needsToWorkAroundNewlineBug = range.startContainer.nodeName === 'P' && range.startOffset === 0;
      if (needsToWorkAroundNewlineBug) {
        return {
          x: range.startContainer.offsetLeft,
          y: range.startContainer.offsetTop,
          absolute: true
        };
      }
      if (range.getClientRects) {
        var rects = range.getClientRects();
        if (rects.length > 0) {
          return {
            x: rects[0].left,
            y: rects[0].top,
            absolute: true
          };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  function readTextCoords (context, p) {
    var rest = doc.createElement('span');
    var mirror = context.mirror;
    var computed = context.computed;

    write(mirror, read(el).substring(0, p));

    if (el.tagName === 'INPUT') {
      mirror.textContent = mirror.textContent.replace(/\s/g, '\u00a0');
    }

    write(rest, read(el).substring(p) || '.');

    mirror.appendChild(rest);

    return {
      x: rest.offsetLeft + parseInt(computed['borderLeftWidth']),
      y: rest.offsetTop + parseInt(computed['borderTopWidth'])
    };
  }

  function read (el) {
    return textInput ? el.value : el.innerHTML;
  }

  function prepare () {
    var computed = win.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
    var mirror = doc.createElement('div');
    var style = mirror.style;

    doc.body.appendChild(mirror);

    if (el.tagName !== 'INPUT') {
      style.wordWrap = 'break-word';
    }
    style.whiteSpace = 'pre-wrap';
    style.position = 'absolute';
    style.visibility = 'hidden';
    props.forEach(copy);

    if (ff) {
      style.width = parseInt(computed.width) - 2 + 'px';
      if (el.scrollHeight > parseInt(computed.height)) {
        style.overflowY = 'scroll';
      }
    } else {
      style.overflow = 'hidden';
    }
    return { mirror: mirror, computed: computed };

    function copy (prop) {
      style[prop] = computed[prop];
    }
  }

  function write (el, value) {
    if (textInput) {
      el.textContent = value;
    } else {
      el.innerHTML = value;
    }
  }

  function bind (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', throttledRefresh);
    crossvent[op](el, 'keyup', throttledRefresh);
    crossvent[op](el, 'input', throttledRefresh);
    crossvent[op](el, 'paste', throttledRefresh);
    crossvent[op](el, 'change', throttledRefresh);
  }

  function destroy () {
    bind(true);
  }
}

module.exports = tailormade;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./throttle":11,"crossvent":13,"seleccion":8,"sell":16}],11:[function(require,module,exports){
'use strict';

function throttle (fn, boundary) {
  var last = -Infinity;
  var timer;
  return function bounced () {
    if (timer) {
      return;
    }
    unbound();

    function unbound () {
      clearTimeout(timer);
      timer = null;
      var next = last + boundary;
      var now = Date.now();
      if (now > next) {
        last = now;
        fn();
      } else {
        timer = setTimeout(unbound, next - now);
      }
    }
  };
}

module.exports = throttle;

},{}],12:[function(require,module,exports){
(function (global){

var NativeCustomEvent = global.CustomEvent;

function useNative () {
  try {
    var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
    return  'cat' === p.type && 'bar' === p.detail.foo;
  } catch (e) {
  }
  return false;
}

/**
 * Cross-browser `CustomEvent` constructor.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
 *
 * @public
 */

module.exports = useNative() ? NativeCustomEvent :

// IE >= 9
'function' === typeof document.createEvent ? function CustomEvent (type, params) {
  var e = document.createEvent('CustomEvent');
  if (params) {
    e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
  } else {
    e.initCustomEvent(type, false, false, void 0);
  }
  return e;
} :

// IE <= 8
function CustomEvent (type, params) {
  var e = document.createEventObject();
  e.type = type;
  if (params) {
    e.bubbles = Boolean(params.bubbles);
    e.cancelable = Boolean(params.cancelable);
    e.detail = params.detail;
  } else {
    e.bubbles = false;
    e.cancelable = false;
    e.detail = void 0;
  }
  return e;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],13:[function(require,module,exports){
(function (global){
'use strict';

var customEvent = require('custom-event');
var eventmap = require('./eventmap');
var doc = global.document;
var addEvent = addEventEasy;
var removeEvent = removeEventEasy;
var hardCache = [];

if (!global.addEventListener) {
  addEvent = addEventHard;
  removeEvent = removeEventHard;
}

module.exports = {
  add: addEvent,
  remove: removeEvent,
  fabricate: fabricateEvent
};

function addEventEasy (el, type, fn, capturing) {
  return el.addEventListener(type, fn, capturing);
}

function addEventHard (el, type, fn) {
  return el.attachEvent('on' + type, wrap(el, type, fn));
}

function removeEventEasy (el, type, fn, capturing) {
  return el.removeEventListener(type, fn, capturing);
}

function removeEventHard (el, type, fn) {
  var listener = unwrap(el, type, fn);
  if (listener) {
    return el.detachEvent('on' + type, listener);
  }
}

function fabricateEvent (el, type, model) {
  var e = eventmap.indexOf(type) === -1 ? makeCustomEvent() : makeClassicEvent();
  if (el.dispatchEvent) {
    el.dispatchEvent(e);
  } else {
    el.fireEvent('on' + type, e);
  }
  function makeClassicEvent () {
    var e;
    if (doc.createEvent) {
      e = doc.createEvent('Event');
      e.initEvent(type, true, true);
    } else if (doc.createEventObject) {
      e = doc.createEventObject();
    }
    return e;
  }
  function makeCustomEvent () {
    return new customEvent(type, { detail: model });
  }
}

function wrapperFactory (el, type, fn) {
  return function wrapper (originalEvent) {
    var e = originalEvent || global.event;
    e.target = e.target || e.srcElement;
    e.preventDefault = e.preventDefault || function preventDefault () { e.returnValue = false; };
    e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
    e.which = e.which || e.keyCode;
    fn.call(el, e);
  };
}

function wrap (el, type, fn) {
  var wrapper = unwrap(el, type, fn) || wrapperFactory(el, type, fn);
  hardCache.push({
    wrapper: wrapper,
    element: el,
    type: type,
    fn: fn
  });
  return wrapper;
}

function unwrap (el, type, fn) {
  var i = find(el, type, fn);
  if (i) {
    var wrapper = hardCache[i].wrapper;
    hardCache.splice(i, 1); // free up a tad of memory
    return wrapper;
  }
}

function find (el, type, fn) {
  var i, item;
  for (i = 0; i < hardCache.length; i++) {
    item = hardCache[i];
    if (item.element === el && item.type === type && item.fn === fn) {
      return i;
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./eventmap":14,"custom-event":12}],14:[function(require,module,exports){
(function (global){
'use strict';

var eventmap = [];
var eventname = '';
var ron = /^on/;

for (eventname in global) {
  if (ron.test(eventname)) {
    eventmap.push(eventname.slice(2));
  }
}

module.exports = eventmap;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],15:[function(require,module,exports){
'use strict';

function fuzzysearch (needle, haystack) {
  var tlen = haystack.length;
  var qlen = needle.length;
  if (qlen > tlen) {
    return false;
  }
  if (qlen === tlen) {
    return needle === haystack;
  }
  outer: for (var i = 0, j = 0; i < qlen; i++) {
    var nch = needle.charCodeAt(i);
    while (j < tlen) {
      if (haystack.charCodeAt(j++) === nch) {
        continue outer;
      }
    }
    return false;
  }
  return true;
}

module.exports = fuzzysearch;

},{}],16:[function(require,module,exports){
'use strict';

var get = easyGet;
var set = easySet;

if (document.selection && document.selection.createRange) {
  get = hardGet;
  set = hardSet;
}

function easyGet (el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function hardGet (el) {
  var active = document.activeElement;
  if (active !== el) {
    el.focus();
  }

  var range = document.selection.createRange();
  var bookmark = range.getBookmark();
  var original = el.value;
  var marker = getUniqueMarker(original);
  var parent = range.parentElement();
  if (parent === null || !inputs(parent)) {
    return result(0, 0);
  }
  range.text = marker + range.text + marker;

  var contents = el.value;

  el.value = original;
  range.moveToBookmark(bookmark);
  range.select();

  return result(contents.indexOf(marker), contents.lastIndexOf(marker) - marker.length);

  function result (start, end) {
    if (active !== el) { // don't disrupt pre-existing state
      if (active) {
        active.focus();
      } else {
        el.blur();
      }
    }
    return { start: start, end: end };
  }
}

function getUniqueMarker (contents) {
  var marker;
  do {
    marker = '@@marker.' + Math.random() * new Date();
  } while (contents.indexOf(marker) !== -1);
  return marker;
}

function inputs (el) {
  return ((el.tagName === 'INPUT' && el.type === 'text') || el.tagName === 'TEXTAREA');
}

function easySet (el, p) {
  el.selectionStart = parse(el, p.start);
  el.selectionEnd = parse(el, p.end);
}

function hardSet (el, p) {
  var range = el.createTextRange();

  if (p.start === 'end' && p.end === 'end') {
    range.collapse(false);
    range.select();
  } else {
    range.collapse(true);
    range.moveEnd('character', parse(el, p.end));
    range.moveStart('character', parse(el, p.start));
    range.select();
  }
}

function parse (el, value) {
  return value === 'end' ? el.value.length : value || 0;
}

function sell (el, p) {
  if (arguments.length === 2) {
    set(el, p);
  }
  return get(el);
}

module.exports = sell;

},{}],17:[function(require,module,exports){
'use strict';

var sell = require('sell');
var crossvent = require('crossvent');
var bullseye = require('bullseye');
var fuzzysearch = require('fuzzysearch');
var KEY_BACKSPACE = 8;
var KEY_ENTER = 13;
var KEY_ESC = 27;
var KEY_UP = 38;
var KEY_DOWN = 40;
var KEY_TAB = 9;
var doc = document;
var docElement = doc.documentElement;

function autocomplete (el, options) {
  var o = options || {};
  var parent = o.appendTo || doc.body;
  var render = o.render || defaultRenderer;
  var {getText, getValue, form, suggestions} = o;
  var limit = typeof o.limit === 'number' ? o.limit : Infinity;
  var userFilter = o.filter || defaultFilter;
  var userSet = o.set || defaultSetter;
  var ul = tag('ul', 'tac-list');
  var selection = null;
  var eye;
  var deferredFiltering = defer(filtering);
  var attachment = el;
  var textInput;
  var anyInput;
  var ranchorleft;
  var ranchorright;
  var suggestionsLoad = { counter: 0, value: null };

  if (o.autoHideOnBlur === void 0) { o.autoHideOnBlur = true; }
  if (o.autoHideOnClick === void 0) { o.autoHideOnClick = true; }
  if (o.autoShowOnUpDown === void 0) { o.autoShowOnUpDown = el.tagName === 'INPUT'; }
  if (o.anchor) {
    ranchorleft = new RegExp('^' + o.anchor);
    ranchorright = new RegExp(o.anchor + '$');
  }

  var api = {
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
  var entry = { el, api };

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
      var value = textInput ? el.value : el.innerHTML;
      if (value !== suggestionsLoad.value) {
        suggestionsLoad.counter++;
        suggestionsLoad.value = value;

        var counter = suggestionsLoad.counter;
        suggestions(value, function(s) {
          if (suggestionsLoad.counter === counter) {
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

  function add (suggestion) {
    var li = tag('li', 'tac-item');
    render(li, suggestion);
    crossvent.add(li, 'click', clickedSuggestion);
    crossvent.add(li, 'autocomplete-filter', filterItem);
    crossvent.add(li, 'autocomplete-hide', hideItem);
    ul.appendChild(li);
    api.suggestions.push(suggestion);
    return li;

    function clickedSuggestion () {
      var value = getValue(suggestion);
      set(value);
      hide();
      attachment.focus();
      crossvent.fabricate(attachment, 'autocomplete-selected', value);
    }

    function filterItem () {
      var value = textInput ? el.value : el.innerHTML;
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

  function set (value) {
    if (o.anchor) {
      return (isText() ? api.appendText : api.appendHTML)(value);
    }
    userSet(value);
  }

  function filter (value, suggestion) {
    if (o.anchor) {
      var il = (isText() ? api.filterAnchoredText : api.filterAnchoredHTML)(value, suggestion);
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
    var left = e.which === 1 && !e.metaKey && !e.ctrlKey;
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
    var total = ul.children.length;
    if (total < moves) {
      unselect();
      return;
    }
    if (total === 0) {
      return;
    }
    var first = up ? 'lastChild' : 'firstChild';
    var next = up ? 'previousSibling' : 'nextSibling';
    var suggestion = selection && selection[next] || ul[first];

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
    var shown = visible();
    var which = e.which || e.keyCode;
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
    var li = ul.firstChild;
    var count = 0;
    while (li) {
      if (count >= limit) {
        crossvent.fabricate(li, 'autocomplete-hide');
      }
      if (count < limit) {
        crossvent.fabricate(li, 'autocomplete-filter');
        if (li.className.indexOf('tac-hide') === -1) {
          count++;
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
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    deferredFiltering();
  }

  function deferredShow (e) {
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    setTimeout(show, 0);
  }

  function autocompleteEventTarget (e) {
    var target = e.target;
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
    var which = e.which || e.keyCode;
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
    var op = remove ? 'remove' : 'add';
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
    var needle = q.toLowerCase();
    var text = getText(suggestion) || '';
    if (fuzzysearch(needle, text.toLowerCase())) {
      return true;
    }
    var value = getValue(suggestion) || '';
    if (typeof value !== 'string') {
      return false;
    }
    return fuzzysearch(needle, value.toLowerCase());
  }

  function loopbackToAnchor (text, p) {
    var result = '';
    var anchored = false;
    var start = p.start;
    while (anchored === false && start >= 0) {
      result = text.substr(start - 1, p.start - start + 1);
      anchored = ranchorleft.test(result);
      start--;
    }
    return {
      text: anchored ? result : null,
      start: start
    };
  }

  function filterAnchoredText (q, suggestion) {
    var position = sell(el);
    var input = loopbackToAnchor(q, position).text;
    if (input) {
      return { input: input, suggestion: suggestion };
    }
  }

  function appendText (value) {
    var current = el.value;
    var position = sell(el);
    var input = loopbackToAnchor(current, position);
    var left = current.substr(0, input.start);
    var right = current.substr(input.start + input.text.length + (position.end - position.start));
    var before = left + value + ' ';

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
  var el = doc.createElement(type);
  el.className = className;
  return el;
}

function defer (fn) { return function () { setTimeout(fn, 0); }; }

function isEditable (el) {
  var value = el.getAttribute('contentEditable');
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

autocomplete.find = find;
module.exports = autocomplete;

},{"bullseye":1,"crossvent":13,"fuzzysearch":15,"sell":16}],18:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var dom = require('./dom');
var text = require('./text');
var props = [
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
var offset = 20;

module.exports = function factory (el) {
  var mirror = dom('span');

  document.body.appendChild(mirror);
  remap();
  bind();

  return {
    remap: remap,
    refresh: refresh,
    destroy: destroy
  };

  function remap () {
    var c = computed();
    var value;
    var i;
    for (i = 0; i < props.length; i++) {
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
    var value = el.value;
    if (value === mirror.value) {
      return;
    }

    text(mirror, value);

    var width = mirror.offsetWidth + offset;

    el.style.width = width + 'px';
  }

  function bind (remove) {
    var op = remove ? 'remove' : 'add';
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
};

},{"./dom":19,"./text":23,"crossvent":13}],19:[function(require,module,exports){
'use strict';

module.exports = function dom (tagName, classes) {
  var el = document.createElement(tagName);
  if (classes) {
    el.className = classes;
  }
  return el;
};

},{}],20:[function(require,module,exports){
'use strict';

var get = easyGet;
var set = easySet;
var inputTag = /input/i;
var textareaTag = /textarea/i;

if (document.selection && document.selection.createRange) {
  get = hardGet;
  set = hardSet;
}

function easyGet (el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function hardGet (el) {
  var active = document.activeElement;
  if (active !== el) {
    el.focus();
  }

  var range = document.selection.createRange();
  var bookmark = range.getBookmark();
  var original = el.value;
  var marker = getUniqueMarker(original);
  var parent = range.parentElement();
  if (parent === null || !inputs(parent)) {
    return result(0, 0);
  }
  range.text = marker + range.text + marker;

  var contents = el.value;

  el.value = original;
  range.moveToBookmark(bookmark);
  range.select();

  return result(contents.indexOf(marker), contents.lastIndexOf(marker) - marker.length);

  function result (start, end) {
    if (active !== el) { // don't disrupt pre-existing state
      if (active) {
        active.focus();
      } else {
        el.blur();
      }
    }
    return { start: start, end: end };
  }
}

function getUniqueMarker (contents) {
  var marker;
  do {
    marker = '@@marker.' + Math.random() * new Date();
  } while (contents.indexOf(marker) !== -1);
  return marker;
}

function inputs (el) {
  return ((inputTag.test(el.tagName) && el.type === 'text') || textareaTag.test(el.tagName));
}

function easySet (el, p) {
  el.selectionStart = special(el, p.start);
  el.selectionEnd = special(el, p.end);
}

function hardSet (el, p) {
  var range = el.createTextRange();

  if (p.start === 'end' && p.end === 'end') {
    range.collapse(false);
    range.select();
  } else {
    range.collapse(true);
    range.moveEnd('character', p.end);
    range.moveStart('character', p.start);
    range.select();
  }
}

function special (el, value) {
  return value === 'end' ? el.value.length : value || 0;
}

function selection (el, p) {
  if (arguments.length === 2) {
    set(el, p);
  }
  return get(el);
}

module.exports = selection;

},{}],21:[function(require,module,exports){
'use strict';

function slice (collection) { // because old IE
  var result = [];
  var i;
  for (i = 0; i < collection.length; i++) {
    result.push(collection[i]);
  }
  return result;
}

module.exports = slice;

},{}],22:[function(require,module,exports){
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
  var parse = o.parse || defaultParse;
  var free = o.free !== false;
  var validate = o.validate || defaultValidate;
  var render = o.render || defaultRenderer;
  var readTag = o.readTag || defaultReader;
	var convertOnFocus = o.convertOnFocus !== false;

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
    convert: convert,
    destroy: destroy
  };
  var entry = { el: el, api: api };

  evaluate([delimiter], true);
  _noselect = false;

  return api;

  function addItem (item) {
    console.log('AddItem', item);
    // renders item, adds it to list of outputs.
    return api;
  }

  function removeItem (item) {
    console.log('RemoveItem', item);
    // derenders item, removes it from list of outputs.
    return api;
  }

  function createAutocomplete () {
    var autoText = o.parseText;
    var autoValue = o.parseValue;
    var getText = (
      typeof autoText === 'string' ? s => s[autoText] :
      typeof autoText === 'function' ? autoText :
      s => s
    );
    var getValue = (
      typeof autoValue === 'string' ? s => s[autoValue] :
      typeof autoValue === 'function' ? autoValue :
      s => s
    );
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
    api.destroy = () => api;
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

  function createTag (buffer, value) {
    var trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    var el = dom('span', 'tay-tag');
    render(el, parse(trimmed));
    if (o.deletion) {
      el.appendChild(dom('span', 'tay-tag-remove'));
    }
    buffer.appendChild(el);
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

  function readValue () {
    return currentValues.filter(v => v.valid).map(v => v.data);
  }

  function defaultParse (value) {
    return value.trim().toLowerCase();
  }

  function defaultValidate (value, tags) {
    return tags.indexOf(value) === -1;
  }
}

taggy.find = find;
module.exports = taggy;

},{"./autocomplete":17,"./autosize":18,"./dom":19,"./selection":20,"./slice":21,"./text":23,"crossvent":13}],23:[function(require,module,exports){
'use strict';

function text (el, value) {
  if (arguments.length === 2) {
    el.innerText = el.textContent = value;
  }
  if (typeof el.innerText === 'string') {
    return el.innerText;
  }
  return el.textContent;
}

module.exports = text;

},{}]},{},[22])(22)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvbm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2Z1enp5c2VhcmNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NlbGwvc2VsbC5qcyIsInNyYy9hdXRvY29tcGxldGUuanMiLCJzcmMvYXV0b3NpemUuanMiLCJzcmMvZG9tLmpzIiwic3JjL3NlbGVjdGlvbi5qcyIsInNyYy9zbGljZS5qcyIsInNyYy90YWdneS5qcyIsInNyYy90ZXh0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgdGhyb3R0bGUgPSByZXF1aXJlKCcuL3Rocm90dGxlJyk7XG52YXIgdGFpbG9ybWFkZSA9IHJlcXVpcmUoJy4vdGFpbG9ybWFkZScpO1xuXG5mdW5jdGlvbiBidWxsc2V5ZSAoZWwsIHRhcmdldCwgb3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnM7XG4gIHZhciBkb21UYXJnZXQgPSB0YXJnZXQgJiYgdGFyZ2V0LnRhZ05hbWU7XG5cbiAgaWYgKCFkb21UYXJnZXQgJiYgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIG8gPSB0YXJnZXQ7XG4gIH1cbiAgaWYgKCFkb21UYXJnZXQpIHtcbiAgICB0YXJnZXQgPSBlbDtcbiAgfVxuICBpZiAoIW8pIHsgbyA9IHt9OyB9XG5cbiAgdmFyIGRlc3Ryb3llZCA9IGZhbHNlO1xuICB2YXIgdGhyb3R0bGVkV3JpdGUgPSB0aHJvdHRsZSh3cml0ZSwgMzApO1xuICB2YXIgdGFpbG9yT3B0aW9ucyA9IHsgdXBkYXRlOiBvLmF1dG91cGRhdGVUb0NhcmV0ICE9PSBmYWxzZSAmJiB1cGRhdGUgfTtcbiAgdmFyIHRhaWxvciA9IG8uY2FyZXQgJiYgdGFpbG9ybWFkZSh0YXJnZXQsIHRhaWxvck9wdGlvbnMpO1xuXG4gIHdyaXRlKCk7XG5cbiAgaWYgKG8udHJhY2tpbmcgIT09IGZhbHNlKSB7XG4gICAgY3Jvc3N2ZW50LmFkZCh3aW5kb3csICdyZXNpemUnLCB0aHJvdHRsZWRXcml0ZSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlYWQ6IHJlYWROdWxsLFxuICAgIHJlZnJlc2g6IHdyaXRlLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgc2xlZXA6IHNsZWVwXG4gIH07XG5cbiAgZnVuY3Rpb24gc2xlZXAgKCkge1xuICAgIHRhaWxvck9wdGlvbnMuc2xlZXBpbmcgPSB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZE51bGwgKCkgeyByZXR1cm4gcmVhZCgpOyB9XG5cbiAgZnVuY3Rpb24gcmVhZCAocmVhZGluZ3MpIHtcbiAgICB2YXIgYm91bmRzID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xuICAgIGlmICh0YWlsb3IpIHtcbiAgICAgIHJlYWRpbmdzID0gdGFpbG9yLnJlYWQoKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IChyZWFkaW5ncy5hYnNvbHV0ZSA/IDAgOiBib3VuZHMubGVmdCkgKyByZWFkaW5ncy54LFxuICAgICAgICB5OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLnRvcCkgKyBzY3JvbGxUb3AgKyByZWFkaW5ncy55ICsgMjBcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB4OiBib3VuZHMubGVmdCxcbiAgICAgIHk6IGJvdW5kcy50b3AgKyBzY3JvbGxUb3BcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlIChyZWFkaW5ncykge1xuICAgIHdyaXRlKHJlYWRpbmdzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChyZWFkaW5ncykge1xuICAgIGlmIChkZXN0cm95ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQnVsbHNleWUgY2FuXFwndCByZWZyZXNoIGFmdGVyIGJlaW5nIGRlc3Ryb3llZC4gQ3JlYXRlIGFub3RoZXIgaW5zdGFuY2UgaW5zdGVhZC4nKTtcbiAgICB9XG4gICAgaWYgKHRhaWxvciAmJiAhcmVhZGluZ3MpIHtcbiAgICAgIHRhaWxvck9wdGlvbnMuc2xlZXBpbmcgPSBmYWxzZTtcbiAgICAgIHRhaWxvci5yZWZyZXNoKCk7IHJldHVybjtcbiAgICB9XG4gICAgdmFyIHAgPSByZWFkKHJlYWRpbmdzKTtcbiAgICBpZiAoIXRhaWxvciAmJiB0YXJnZXQgIT09IGVsKSB7XG4gICAgICBwLnkgKz0gdGFyZ2V0Lm9mZnNldEhlaWdodDtcbiAgICB9XG4gICAgZWwuc3R5bGUubGVmdCA9IHAueCArICdweCc7XG4gICAgZWwuc3R5bGUudG9wID0gcC55ICsgJ3B4JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0YWlsb3IpIHsgdGFpbG9yLmRlc3Ryb3koKTsgfVxuICAgIGNyb3NzdmVudC5yZW1vdmUod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICAgIGRlc3Ryb3llZCA9IHRydWU7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWxsc2V5ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbjtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgZ2V0U2VsZWN0aW9uUmF3ID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25SYXcnKTtcbnZhciBnZXRTZWxlY3Rpb25OdWxsT3AgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbk51bGxPcCcpO1xudmFyIGdldFNlbGVjdGlvblN5bnRoZXRpYyA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uU3ludGhldGljJyk7XG52YXIgaXNIb3N0ID0gcmVxdWlyZSgnLi9pc0hvc3QnKTtcbmlmIChpc0hvc3QubWV0aG9kKGdsb2JhbCwgJ2dldFNlbGVjdGlvbicpKSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvblJhdztcbn0gZWxzZSBpZiAodHlwZW9mIGRvYy5zZWxlY3Rpb24gPT09ICdvYmplY3QnICYmIGRvYy5zZWxlY3Rpb24pIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uU3ludGhldGljO1xufSBlbHNlIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uTnVsbE9wO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25OdWxsT3AgKCkge1xuICByZXR1cm4ge1xuICAgIHJlbW92ZUFsbFJhbmdlczogbm9vcCxcbiAgICBhZGRSYW5nZTogbm9vcFxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbk51bGxPcDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uUmF3ICgpIHtcbiAgcmV0dXJuIGdsb2JhbC5nZXRTZWxlY3Rpb24oKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25SYXc7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByYW5nZVRvVGV4dFJhbmdlID0gcmVxdWlyZSgnLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcbnZhciBHZXRTZWxlY3Rpb25Qcm90byA9IEdldFNlbGVjdGlvbi5wcm90b3R5cGU7XG5cbmZ1bmN0aW9uIEdldFNlbGVjdGlvbiAoc2VsZWN0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHJhbmdlID0gc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG5cbiAgdGhpcy5fc2VsZWN0aW9uID0gc2VsZWN0aW9uO1xuICB0aGlzLl9yYW5nZXMgPSBbXTtcblxuICBpZiAoc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsZik7XG4gIH0gZWxzZSBpZiAoaXNUZXh0UmFuZ2UocmFuZ2UpKSB7XG4gICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWxmLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsZik7XG4gIH1cbn1cblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlQWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdGV4dFJhbmdlO1xuICB0cnkge1xuICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ05vbmUnKSB7XG4gICAgICB0ZXh0UmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICAgICAgdGV4dFJhbmdlLnNlbGVjdCgpO1xuICAgICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgdXBkYXRlRW1wdHlTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5hZGRSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHJhbmdlKS5zZWxlY3QoKTtcbiAgICB0aGlzLl9yYW5nZXNbMF0gPSByYW5nZTtcbiAgICB0aGlzLnJhbmdlQ291bnQgPSAxO1xuICAgIHRoaXMuaXNDb2xsYXBzZWQgPSB0aGlzLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHRoaXMsIHJhbmdlLCBmYWxzZSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFJhbmdlcyA9IGZ1bmN0aW9uIChyYW5nZXMpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdmFyIHJhbmdlQ291bnQgPSByYW5nZXMubGVuZ3RoO1xuICBpZiAocmFuZ2VDb3VudCA+IDEpIHtcbiAgICBjcmVhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlcyk7XG4gIH0gZWxzZSBpZiAocmFuZ2VDb3VudCkge1xuICAgIHRoaXMuYWRkUmFuZ2UocmFuZ2VzWzBdKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0UmFuZ2VBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMucmFuZ2VDb3VudCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0UmFuZ2VBdCgpOiBpbmRleCBvdXQgb2YgYm91bmRzJyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jhbmdlc1tpbmRleF0uY2xvbmVSYW5nZSgpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdDb250cm9sJykge1xuICAgIHJlbW92ZVJhbmdlTWFudWFsbHkodGhpcywgcmFuZ2UpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgY29udHJvbFJhbmdlID0gdGhpcy5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIHZhciBlbDtcbiAgdmFyIHJlbW92ZWQgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gY29udHJvbFJhbmdlLml0ZW0oaSk7XG4gICAgaWYgKGVsICE9PSByYW5nZUVsZW1lbnQgfHwgcmVtb3ZlZCkge1xuICAgICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5lYWNoUmFuZ2UgPSBmdW5jdGlvbiAoZm4sIHJldHVyblZhbHVlKSB7XG4gIHZhciBpID0gMDtcbiAgdmFyIGxlbiA9IHRoaXMuX3Jhbmdlcy5sZW5ndGg7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChmbih0aGlzLmdldFJhbmdlQXQoaSkpKSB7XG4gICAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gICAgfVxuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciByYW5nZXMgPSBbXTtcbiAgdGhpcy5lYWNoUmFuZ2UoZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICB9KTtcbiAgcmV0dXJuIHJhbmdlcztcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFNpbmdsZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHRoaXMuYWRkUmFuZ2UocmFuZ2UpO1xufTtcblxuZnVuY3Rpb24gY3JlYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZXMpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBlbCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlc1tpXSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnRyb2xSYW5nZS5hZGQoZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2V0UmFuZ2VzKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gICAgfVxuICB9XG4gIGNvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVSYW5nZU1hbnVhbGx5IChzZWwsIHJhbmdlKSB7XG4gIHZhciByYW5nZXMgPSBzZWwuZ2V0QWxsUmFuZ2VzKCk7XG4gIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNTYW1lUmFuZ2UocmFuZ2UsIHJhbmdlc1tpXSkpIHtcbiAgICAgIHNlbC5hZGRSYW5nZShyYW5nZXNbaV0pO1xuICAgIH1cbiAgfVxuICBpZiAoIXNlbC5yYW5nZUNvdW50KSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSAoc2VsLCByYW5nZSkge1xuICB2YXIgYW5jaG9yUHJlZml4ID0gJ3N0YXJ0JztcbiAgdmFyIGZvY3VzUHJlZml4ID0gJ2VuZCc7XG4gIHNlbC5hbmNob3JOb2RlID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ09mZnNldCddO1xuICBzZWwuZm9jdXNOb2RlID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5mb2N1c09mZnNldCA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ09mZnNldCddO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFbXB0eVNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5hbmNob3JOb2RlID0gc2VsLmZvY3VzTm9kZSA9IG51bGw7XG4gIHNlbC5hbmNob3JPZmZzZXQgPSBzZWwuZm9jdXNPZmZzZXQgPSAwO1xuICBzZWwucmFuZ2VDb3VudCA9IDA7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHRydWU7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIHJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50IChyYW5nZU5vZGVzKSB7XG4gIGlmICghcmFuZ2VOb2Rlcy5sZW5ndGggfHwgcmFuZ2VOb2Rlc1swXS5ub2RlVHlwZSAhPT0gMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKHZhciBpID0gMSwgbGVuID0gcmFuZ2VOb2Rlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNBbmNlc3Rvck9mKHJhbmdlTm9kZXNbMF0sIHJhbmdlTm9kZXNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlIChyYW5nZSkge1xuICB2YXIgbm9kZXMgPSByYW5nZS5nZXROb2RlcygpO1xuICBpZiAoIXJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50KG5vZGVzKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSgpOiByYW5nZSBkaWQgbm90IGNvbnNpc3Qgb2YgYSBzaW5nbGUgZWxlbWVudCcpO1xuICB9XG4gIHJldHVybiBub2Rlc1swXTtcbn1cblxuZnVuY3Rpb24gaXNUZXh0UmFuZ2UgKHJhbmdlKSB7XG4gIHJldHVybiByYW5nZSAmJiByYW5nZS50ZXh0ICE9PSB2b2lkIDA7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUZyb21UZXh0UmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgc2VsLl9yYW5nZXMgPSBbcmFuZ2VdO1xuICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHJhbmdlLCBmYWxzZSk7XG4gIHNlbC5yYW5nZUNvdW50ID0gMTtcbiAgc2VsLmlzQ29sbGFwc2VkID0gcmFuZ2UuY29sbGFwc2VkO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDb250cm9sU2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbiAgaWYgKHNlbC5fc2VsZWN0aW9uLnR5cGUgPT09ICdOb25lJykge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gICAgaWYgKGlzVGV4dFJhbmdlKGNvbnRyb2xSYW5nZSkpIHtcbiAgICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsLCBjb250cm9sUmFuZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWwucmFuZ2VDb3VudCA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7XG4gICAgICB2YXIgcmFuZ2U7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbC5yYW5nZUNvdW50OyArK2kpIHtcbiAgICAgICAgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZShjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgICAgIHNlbC5fcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgICAgc2VsLmlzQ29sbGFwc2VkID0gc2VsLnJhbmdlQ291bnQgPT09IDEgJiYgc2VsLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCBzZWwuX3Jhbmdlc1tzZWwucmFuZ2VDb3VudCAtIDFdLCBmYWxzZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gIH1cbiAgdHJ5IHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKHJhbmdlRWxlbWVudCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FkZFJhbmdlKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVJhbmdlIChsZWZ0LCByaWdodCkge1xuICByZXR1cm4gKFxuICAgIGxlZnQuc3RhcnRDb250YWluZXIgPT09IHJpZ2h0LnN0YXJ0Q29udGFpbmVyICYmXG4gICAgbGVmdC5zdGFydE9mZnNldCA9PT0gcmlnaHQuc3RhcnRPZmZzZXQgJiZcbiAgICBsZWZ0LmVuZENvbnRhaW5lciA9PT0gcmlnaHQuZW5kQ29udGFpbmVyICYmXG4gICAgbGVmdC5lbmRPZmZzZXQgPT09IHJpZ2h0LmVuZE9mZnNldFxuICApO1xufVxuXG5mdW5jdGlvbiBpc0FuY2VzdG9yT2YgKGFuY2VzdG9yLCBkZXNjZW5kYW50KSB7XG4gIHZhciBub2RlID0gZGVzY2VuZGFudDtcbiAgd2hpbGUgKG5vZGUucGFyZW50Tm9kZSkge1xuICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IGFuY2VzdG9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgR2V0U2VsZWN0aW9uKGdsb2JhbC5kb2N1bWVudC5zZWxlY3Rpb24pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNIb3N0TWV0aG9kIChob3N0LCBwcm9wKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIGhvc3RbcHJvcF07XG4gIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8ICEhKHR5cGUgPT09ICdvYmplY3QnICYmIGhvc3RbcHJvcF0pIHx8IHR5cGUgPT09ICd1bmtub3duJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0UHJvcGVydHkgKGhvc3QsIHByb3ApIHtcbiAgcmV0dXJuIHR5cGVvZiBob3N0W3Byb3BdICE9PSAndW5kZWZpbmVkJztcbn1cblxuZnVuY3Rpb24gbWFueSAoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGFyZUhvc3RlZCAoaG9zdCwgcHJvcHMpIHtcbiAgICB2YXIgaSA9IHByb3BzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBpZiAoIWZuKGhvc3QsIHByb3BzW2ldKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0aG9kOiBpc0hvc3RNZXRob2QsXG4gIG1ldGhvZHM6IG1hbnkoaXNIb3N0TWV0aG9kKSxcbiAgcHJvcGVydHk6IGlzSG9zdFByb3BlcnR5LFxuICBwcm9wZXJ0aWVzOiBtYW55KGlzSG9zdFByb3BlcnR5KVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBib2R5ID0gZG9jLmJvZHk7XG5cbmZ1bmN0aW9uIHJhbmdlVG9UZXh0UmFuZ2UgKHApIHtcbiAgaWYgKHAuY29sbGFwc2VkKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB9XG4gIHZhciBzdGFydFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHAuc3RhcnRPZmZzZXQgfSwgdHJ1ZSk7XG4gIHZhciBlbmRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5lbmRDb250YWluZXIsIG9mZnNldDogcC5lbmRPZmZzZXQgfSwgZmFsc2UpO1xuICB2YXIgdGV4dFJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgdGV4dFJhbmdlLnNldEVuZFBvaW50KCdTdGFydFRvU3RhcnQnLCBzdGFydFJhbmdlKTtcbiAgdGV4dFJhbmdlLnNldEVuZFBvaW50KCdFbmRUb0VuZCcsIGVuZFJhbmdlKTtcbiAgcmV0dXJuIHRleHRSYW5nZTtcbn1cblxuZnVuY3Rpb24gaXNDaGFyYWN0ZXJEYXRhTm9kZSAobm9kZSkge1xuICB2YXIgdCA9IG5vZGUubm9kZVR5cGU7XG4gIHJldHVybiB0ID09PSAzIHx8IHQgPT09IDQgfHwgdCA9PT0gOCA7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlIChwLCBzdGFydGluZykge1xuICB2YXIgYm91bmQ7XG4gIHZhciBwYXJlbnQ7XG4gIHZhciBvZmZzZXQgPSBwLm9mZnNldDtcbiAgdmFyIHdvcmtpbmdOb2RlO1xuICB2YXIgY2hpbGROb2RlcztcbiAgdmFyIHJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgdmFyIGRhdGEgPSBpc0NoYXJhY3RlckRhdGFOb2RlKHAubm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICBib3VuZCA9IHAubm9kZTtcbiAgICBwYXJlbnQgPSBib3VuZC5wYXJlbnROb2RlO1xuICB9IGVsc2Uge1xuICAgIGNoaWxkTm9kZXMgPSBwLm5vZGUuY2hpbGROb2RlcztcbiAgICBib3VuZCA9IG9mZnNldCA8IGNoaWxkTm9kZXMubGVuZ3RoID8gY2hpbGROb2Rlc1tvZmZzZXRdIDogbnVsbDtcbiAgICBwYXJlbnQgPSBwLm5vZGU7XG4gIH1cblxuICB3b3JraW5nTm9kZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHdvcmtpbmdOb2RlLmlubmVySFRNTCA9ICcmI2ZlZmY7JztcblxuICBpZiAoYm91bmQpIHtcbiAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHdvcmtpbmdOb2RlLCBib3VuZCk7XG4gIH0gZWxzZSB7XG4gICAgcGFyZW50LmFwcGVuZENoaWxkKHdvcmtpbmdOb2RlKTtcbiAgfVxuXG4gIHJhbmdlLm1vdmVUb0VsZW1lbnRUZXh0KHdvcmtpbmdOb2RlKTtcbiAgcmFuZ2UuY29sbGFwc2UoIXN0YXJ0aW5nKTtcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHdvcmtpbmdOb2RlKTtcblxuICBpZiAoZGF0YSkge1xuICAgIHJhbmdlW3N0YXJ0aW5nID8gJ21vdmVTdGFydCcgOiAnbW92ZUVuZCddKCdjaGFyYWN0ZXInLCBvZmZzZXQpO1xuICB9XG4gIHJldHVybiByYW5nZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByYW5nZVRvVGV4dFJhbmdlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb24nKTtcbnZhciBzZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL3NldFNlbGVjdGlvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0OiBnZXRTZWxlY3Rpb24sXG4gIHNldDogc2V0U2VsZWN0aW9uXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb24nKTtcbnZhciByYW5nZVRvVGV4dFJhbmdlID0gcmVxdWlyZSgnLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBzZXRTZWxlY3Rpb24gKHApIHtcbiAgaWYgKGRvYy5jcmVhdGVSYW5nZSkge1xuICAgIG1vZGVyblNlbGVjdGlvbigpO1xuICB9IGVsc2Uge1xuICAgIG9sZFNlbGVjdGlvbigpO1xuICB9XG5cbiAgZnVuY3Rpb24gbW9kZXJuU2VsZWN0aW9uICgpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgdmFyIHJhbmdlID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gICAgaWYgKCFwLnN0YXJ0Q29udGFpbmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChwLmVuZENvbnRhaW5lcikge1xuICAgICAgcmFuZ2Uuc2V0RW5kKHAuZW5kQ29udGFpbmVyLCBwLmVuZE9mZnNldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJhbmdlLnNldEVuZChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICB9XG4gICAgcmFuZ2Uuc2V0U3RhcnQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgIHNlbC5hZGRSYW5nZShyYW5nZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvbGRTZWxlY3Rpb24gKCkge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocCkuc2VsZWN0KCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzZWxsID0gcmVxdWlyZSgnc2VsbCcpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHNlbGVjY2lvbiA9IHJlcXVpcmUoJ3NlbGVjY2lvbicpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIGdldFNlbGVjdGlvbiA9IHNlbGVjY2lvbi5nZXQ7XG52YXIgcHJvcHMgPSBbXG4gICdkaXJlY3Rpb24nLFxuICAnYm94U2l6aW5nJyxcbiAgJ3dpZHRoJyxcbiAgJ2hlaWdodCcsXG4gICdvdmVyZmxvd1gnLFxuICAnb3ZlcmZsb3dZJyxcbiAgJ2JvcmRlclRvcFdpZHRoJyxcbiAgJ2JvcmRlclJpZ2h0V2lkdGgnLFxuICAnYm9yZGVyQm90dG9tV2lkdGgnLFxuICAnYm9yZGVyTGVmdFdpZHRoJyxcbiAgJ3BhZGRpbmdUb3AnLFxuICAncGFkZGluZ1JpZ2h0JyxcbiAgJ3BhZGRpbmdCb3R0b20nLFxuICAncGFkZGluZ0xlZnQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2ZvbnRWYXJpYW50JyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0cmV0Y2gnLFxuICAnZm9udFNpemUnLFxuICAnZm9udFNpemVBZGp1c3QnLFxuICAnbGluZUhlaWdodCcsXG4gICdmb250RmFtaWx5JyxcbiAgJ3RleHRBbGlnbicsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAndGV4dERlY29yYXRpb24nLFxuICAnbGV0dGVyU3BhY2luZycsXG4gICd3b3JkU3BhY2luZydcbl07XG52YXIgd2luID0gZ2xvYmFsO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGZmID0gd2luLm1veklubmVyU2NyZWVuWCAhPT0gbnVsbCAmJiB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSB2b2lkIDA7XG5cbmZ1bmN0aW9uIHRhaWxvcm1hZGUgKGVsLCBvcHRpb25zKSB7XG4gIHZhciB0ZXh0SW5wdXQgPSBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7XG4gIHZhciB0aHJvdHRsZWRSZWZyZXNoID0gdGhyb3R0bGUocmVmcmVzaCwgMzApO1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG5cbiAgYmluZCgpO1xuXG4gIHJldHVybiB7XG4gICAgcmVhZDogcmVhZFBvc2l0aW9uLFxuICAgIHJlZnJlc2g6IHRocm90dGxlZFJlZnJlc2gsXG4gICAgZGVzdHJveTogZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIG5vb3AgKCkge31cbiAgZnVuY3Rpb24gcmVhZFBvc2l0aW9uICgpIHsgcmV0dXJuICh0ZXh0SW5wdXQgPyBjb29yZHNUZXh0IDogY29vcmRzSFRNTCkoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2ggKCkge1xuICAgIGlmIChvLnNsZWVwaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiAoby51cGRhdGUgfHwgbm9vcCkocmVhZFBvc2l0aW9uKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzVGV4dCAoKSB7XG4gICAgdmFyIHAgPSBzZWxsKGVsKTtcbiAgICB2YXIgY29udGV4dCA9IHByZXBhcmUoKTtcbiAgICB2YXIgcmVhZGluZ3MgPSByZWFkVGV4dENvb3Jkcyhjb250ZXh0LCBwLnN0YXJ0KTtcbiAgICBkb2MuYm9keS5yZW1vdmVDaGlsZChjb250ZXh0Lm1pcnJvcik7XG4gICAgcmV0dXJuIHJlYWRpbmdzO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzSFRNTCAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIGlmIChzZWwucmFuZ2VDb3VudCkge1xuICAgICAgdmFyIHJhbmdlID0gc2VsLmdldFJhbmdlQXQoMCk7XG4gICAgICB2YXIgbmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnID0gcmFuZ2Uuc3RhcnRDb250YWluZXIubm9kZU5hbWUgPT09ICdQJyAmJiByYW5nZS5zdGFydE9mZnNldCA9PT0gMDtcbiAgICAgIGlmIChuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB4OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRMZWZ0LFxuICAgICAgICAgIHk6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldFRvcCxcbiAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlLmdldENsaWVudFJlY3RzKSB7XG4gICAgICAgIHZhciByZWN0cyA9IHJhbmdlLmdldENsaWVudFJlY3RzKCk7XG4gICAgICAgIGlmIChyZWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IHJlY3RzWzBdLmxlZnQsXG4gICAgICAgICAgICB5OiByZWN0c1swXS50b3AsXG4gICAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgeDogMCwgeTogMCB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFRleHRDb29yZHMgKGNvbnRleHQsIHApIHtcbiAgICB2YXIgcmVzdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgdmFyIG1pcnJvciA9IGNvbnRleHQubWlycm9yO1xuICAgIHZhciBjb21wdXRlZCA9IGNvbnRleHQuY29tcHV0ZWQ7XG5cbiAgICB3cml0ZShtaXJyb3IsIHJlYWQoZWwpLnN1YnN0cmluZygwLCBwKSk7XG5cbiAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJykge1xuICAgICAgbWlycm9yLnRleHRDb250ZW50ID0gbWlycm9yLnRleHRDb250ZW50LnJlcGxhY2UoL1xccy9nLCAnXFx1MDBhMCcpO1xuICAgIH1cblxuICAgIHdyaXRlKHJlc3QsIHJlYWQoZWwpLnN1YnN0cmluZyhwKSB8fCAnLicpO1xuXG4gICAgbWlycm9yLmFwcGVuZENoaWxkKHJlc3QpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHJlc3Qub2Zmc2V0TGVmdCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJMZWZ0V2lkdGgnXSksXG4gICAgICB5OiByZXN0Lm9mZnNldFRvcCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJUb3BXaWR0aCddKVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChlbCkge1xuICAgIHJldHVybiB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXBhcmUgKCkge1xuICAgIHZhciBjb21wdXRlZCA9IHdpbi5nZXRDb21wdXRlZFN0eWxlID8gZ2V0Q29tcHV0ZWRTdHlsZShlbCkgOiBlbC5jdXJyZW50U3R5bGU7XG4gICAgdmFyIG1pcnJvciA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB2YXIgc3R5bGUgPSBtaXJyb3Iuc3R5bGU7XG5cbiAgICBkb2MuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgIT09ICdJTlBVVCcpIHtcbiAgICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnO1xuICAgIH1cbiAgICBzdHlsZS53aGl0ZVNwYWNlID0gJ3ByZS13cmFwJztcbiAgICBzdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHByb3BzLmZvckVhY2goY29weSk7XG5cbiAgICBpZiAoZmYpIHtcbiAgICAgIHN0eWxlLndpZHRoID0gcGFyc2VJbnQoY29tcHV0ZWQud2lkdGgpIC0gMiArICdweCc7XG4gICAgICBpZiAoZWwuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSkge1xuICAgICAgICBzdHlsZS5vdmVyZmxvd1kgPSAnc2Nyb2xsJztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcbiAgICB9XG4gICAgcmV0dXJuIHsgbWlycm9yOiBtaXJyb3IsIGNvbXB1dGVkOiBjb21wdXRlZCB9O1xuXG4gICAgZnVuY3Rpb24gY29weSAocHJvcCkge1xuICAgICAgc3R5bGVbcHJvcF0gPSBjb21wdXRlZFtwcm9wXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAoZWwsIHZhbHVlKSB7XG4gICAgaWYgKHRleHRJbnB1dCkge1xuICAgICAgZWwudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXl1cCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdpbnB1dCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdjaGFuZ2UnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0YWlsb3JtYWRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0aHJvdHRsZSAoZm4sIGJvdW5kYXJ5KSB7XG4gIHZhciBsYXN0ID0gLUluZmluaXR5O1xuICB2YXIgdGltZXI7XG4gIHJldHVybiBmdW5jdGlvbiBib3VuY2VkICgpIHtcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdW5ib3VuZCgpO1xuXG4gICAgZnVuY3Rpb24gdW5ib3VuZCAoKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgdGltZXIgPSBudWxsO1xuICAgICAgdmFyIG5leHQgPSBsYXN0ICsgYm91bmRhcnk7XG4gICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmIChub3cgPiBuZXh0KSB7XG4gICAgICAgIGxhc3QgPSBub3c7XG4gICAgICAgIGZuKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQodW5ib3VuZCwgbmV4dCAtIG5vdyk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRocm90dGxlO1xuIiwiXG52YXIgTmF0aXZlQ3VzdG9tRXZlbnQgPSBnbG9iYWwuQ3VzdG9tRXZlbnQ7XG5cbmZ1bmN0aW9uIHVzZU5hdGl2ZSAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHAgPSBuZXcgTmF0aXZlQ3VzdG9tRXZlbnQoJ2NhdCcsIHsgZGV0YWlsOiB7IGZvbzogJ2JhcicgfSB9KTtcbiAgICByZXR1cm4gICdjYXQnID09PSBwLnR5cGUgJiYgJ2JhcicgPT09IHAuZGV0YWlsLmZvbztcbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcm9zcy1icm93c2VyIGBDdXN0b21FdmVudGAgY29uc3RydWN0b3IuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0N1c3RvbUV2ZW50LkN1c3RvbUV2ZW50XG4gKlxuICogQHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdXNlTmF0aXZlKCkgPyBOYXRpdmVDdXN0b21FdmVudCA6XG5cbi8vIElFID49IDlcbidmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA/IGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCk7XG4gIH0gZWxzZSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgZmFsc2UsIGZhbHNlLCB2b2lkIDApO1xuICB9XG4gIHJldHVybiBlO1xufSA6XG5cbi8vIElFIDw9IDhcbmZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICBlLnR5cGUgPSB0eXBlO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5idWJibGVzID0gQm9vbGVhbihwYXJhbXMuYnViYmxlcyk7XG4gICAgZS5jYW5jZWxhYmxlID0gQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSk7XG4gICAgZS5kZXRhaWwgPSBwYXJhbXMuZGV0YWlsO1xuICB9IGVsc2Uge1xuICAgIGUuYnViYmxlcyA9IGZhbHNlO1xuICAgIGUuY2FuY2VsYWJsZSA9IGZhbHNlO1xuICAgIGUuZGV0YWlsID0gdm9pZCAwO1xuICB9XG4gIHJldHVybiBlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3VzdG9tRXZlbnQgPSByZXF1aXJlKCdjdXN0b20tZXZlbnQnKTtcbnZhciBldmVudG1hcCA9IHJlcXVpcmUoJy4vZXZlbnRtYXAnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYWRkRXZlbnQgPSBhZGRFdmVudEVhc3k7XG52YXIgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEVhc3k7XG52YXIgaGFyZENhY2hlID0gW107XG5cbmlmICghZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgYWRkRXZlbnQgPSBhZGRFdmVudEhhcmQ7XG4gIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRIYXJkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRFdmVudCxcbiAgcmVtb3ZlOiByZW1vdmVFdmVudCxcbiAgZmFicmljYXRlOiBmYWJyaWNhdGVFdmVudFxufTtcblxuZnVuY3Rpb24gYWRkRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCB3cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgbGlzdGVuZXIgPSB1bndyYXAoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIGVsLmRldGFjaEV2ZW50KCdvbicgKyB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmFicmljYXRlRXZlbnQgKGVsLCB0eXBlLCBtb2RlbCkge1xuICB2YXIgZSA9IGV2ZW50bWFwLmluZGV4T2YodHlwZSkgPT09IC0xID8gbWFrZUN1c3RvbUV2ZW50KCkgOiBtYWtlQ2xhc3NpY0V2ZW50KCk7XG4gIGlmIChlbC5kaXNwYXRjaEV2ZW50KSB7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5maXJlRXZlbnQoJ29uJyArIHR5cGUsIGUpO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDbGFzc2ljRXZlbnQgKCkge1xuICAgIHZhciBlO1xuICAgIGlmIChkb2MuY3JlYXRlRXZlbnQpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG4gICAgICBlLmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGRvYy5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gZTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ3VzdG9tRXZlbnQgKCkge1xuICAgIHJldHVybiBuZXcgY3VzdG9tRXZlbnQodHlwZSwgeyBkZXRhaWw6IG1vZGVsIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBwZXJGYWN0b3J5IChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZXIgKG9yaWdpbmFsRXZlbnQpIHtcbiAgICB2YXIgZSA9IG9yaWdpbmFsRXZlbnQgfHwgZ2xvYmFsLmV2ZW50O1xuICAgIGUudGFyZ2V0ID0gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50O1xuICAgIGUucHJldmVudERlZmF1bHQgPSBlLnByZXZlbnREZWZhdWx0IHx8IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0ICgpIHsgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlOyB9O1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uID0gZS5zdG9wUHJvcGFnYXRpb24gfHwgZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uICgpIHsgZS5jYW5jZWxCdWJibGUgPSB0cnVlOyB9O1xuICAgIGUud2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBmbi5jYWxsKGVsLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciB3cmFwcGVyID0gdW53cmFwKGVsLCB0eXBlLCBmbikgfHwgd3JhcHBlckZhY3RvcnkoZWwsIHR5cGUsIGZuKTtcbiAgaGFyZENhY2hlLnB1c2goe1xuICAgIHdyYXBwZXI6IHdyYXBwZXIsXG4gICAgZWxlbWVudDogZWwsXG4gICAgdHlwZTogdHlwZSxcbiAgICBmbjogZm5cbiAgfSk7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiB1bndyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSA9IGZpbmQoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGkpIHtcbiAgICB2YXIgd3JhcHBlciA9IGhhcmRDYWNoZVtpXS53cmFwcGVyO1xuICAgIGhhcmRDYWNoZS5zcGxpY2UoaSwgMSk7IC8vIGZyZWUgdXAgYSB0YWQgb2YgbWVtb3J5XG4gICAgcmV0dXJuIHdyYXBwZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpLCBpdGVtO1xuICBmb3IgKGkgPSAwOyBpIDwgaGFyZENhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaXRlbSA9IGhhcmRDYWNoZVtpXTtcbiAgICBpZiAoaXRlbS5lbGVtZW50ID09PSBlbCAmJiBpdGVtLnR5cGUgPT09IHR5cGUgJiYgaXRlbS5mbiA9PT0gZm4pIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXZlbnRtYXAgPSBbXTtcbnZhciBldmVudG5hbWUgPSAnJztcbnZhciByb24gPSAvXm9uLztcblxuZm9yIChldmVudG5hbWUgaW4gZ2xvYmFsKSB7XG4gIGlmIChyb24udGVzdChldmVudG5hbWUpKSB7XG4gICAgZXZlbnRtYXAucHVzaChldmVudG5hbWUuc2xpY2UoMikpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRtYXA7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZ1enp5c2VhcmNoIChuZWVkbGUsIGhheXN0YWNrKSB7XG4gIHZhciB0bGVuID0gaGF5c3RhY2subGVuZ3RoO1xuICB2YXIgcWxlbiA9IG5lZWRsZS5sZW5ndGg7XG4gIGlmIChxbGVuID4gdGxlbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAocWxlbiA9PT0gdGxlbikge1xuICAgIHJldHVybiBuZWVkbGUgPT09IGhheXN0YWNrO1xuICB9XG4gIG91dGVyOiBmb3IgKHZhciBpID0gMCwgaiA9IDA7IGkgPCBxbGVuOyBpKyspIHtcbiAgICB2YXIgbmNoID0gbmVlZGxlLmNoYXJDb2RlQXQoaSk7XG4gICAgd2hpbGUgKGogPCB0bGVuKSB7XG4gICAgICBpZiAoaGF5c3RhY2suY2hhckNvZGVBdChqKyspID09PSBuY2gpIHtcbiAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdXp6eXNlYXJjaDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcblxuaWYgKGRvY3VtZW50LnNlbGVjdGlvbiAmJiBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UpIHtcbiAgZ2V0ID0gaGFyZEdldDtcbiAgc2V0ID0gaGFyZFNldDtcbn1cblxuZnVuY3Rpb24gZWFzeUdldCAoZWwpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZWwuc2VsZWN0aW9uU3RhcnQsXG4gICAgZW5kOiBlbC5zZWxlY3Rpb25FbmRcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFyZEdldCAoZWwpIHtcbiAgdmFyIGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGlmIChhY3RpdmUgIT09IGVsKSB7XG4gICAgZWwuZm9jdXMoKTtcbiAgfVxuXG4gIHZhciByYW5nZSA9IGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgYm9va21hcmsgPSByYW5nZS5nZXRCb29rbWFyaygpO1xuICB2YXIgb3JpZ2luYWwgPSBlbC52YWx1ZTtcbiAgdmFyIG1hcmtlciA9IGdldFVuaXF1ZU1hcmtlcihvcmlnaW5hbCk7XG4gIHZhciBwYXJlbnQgPSByYW5nZS5wYXJlbnRFbGVtZW50KCk7XG4gIGlmIChwYXJlbnQgPT09IG51bGwgfHwgIWlucHV0cyhwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdCgwLCAwKTtcbiAgfVxuICByYW5nZS50ZXh0ID0gbWFya2VyICsgcmFuZ2UudGV4dCArIG1hcmtlcjtcblxuICB2YXIgY29udGVudHMgPSBlbC52YWx1ZTtcblxuICBlbC52YWx1ZSA9IG9yaWdpbmFsO1xuICByYW5nZS5tb3ZlVG9Cb29rbWFyayhib29rbWFyayk7XG4gIHJhbmdlLnNlbGVjdCgpO1xuXG4gIHJldHVybiByZXN1bHQoY29udGVudHMuaW5kZXhPZihtYXJrZXIpLCBjb250ZW50cy5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aCk7XG5cbiAgZnVuY3Rpb24gcmVzdWx0IChzdGFydCwgZW5kKSB7XG4gICAgaWYgKGFjdGl2ZSAhPT0gZWwpIHsgLy8gZG9uJ3QgZGlzcnVwdCBwcmUtZXhpc3Rpbmcgc3RhdGVcbiAgICAgIGlmIChhY3RpdmUpIHtcbiAgICAgICAgYWN0aXZlLmZvY3VzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5ibHVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXJ0OiBzdGFydCwgZW5kOiBlbmQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRVbmlxdWVNYXJrZXIgKGNvbnRlbnRzKSB7XG4gIHZhciBtYXJrZXI7XG4gIGRvIHtcbiAgICBtYXJrZXIgPSAnQEBtYXJrZXIuJyArIE1hdGgucmFuZG9tKCkgKiBuZXcgRGF0ZSgpO1xuICB9IHdoaWxlIChjb250ZW50cy5pbmRleE9mKG1hcmtlcikgIT09IC0xKTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gaW5wdXRzIChlbCkge1xuICByZXR1cm4gKChlbC50YWdOYW1lID09PSAnSU5QVVQnICYmIGVsLnR5cGUgPT09ICd0ZXh0JykgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyk7XG59XG5cbmZ1bmN0aW9uIGVhc3lTZXQgKGVsLCBwKSB7XG4gIGVsLnNlbGVjdGlvblN0YXJ0ID0gcGFyc2UoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBwYXJzZShlbCwgcC5lbmQpO1xufVxuXG5mdW5jdGlvbiBoYXJkU2V0IChlbCwgcCkge1xuICB2YXIgcmFuZ2UgPSBlbC5jcmVhdGVUZXh0UmFuZ2UoKTtcblxuICBpZiAocC5zdGFydCA9PT0gJ2VuZCcgJiYgcC5lbmQgPT09ICdlbmQnKSB7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlLmNvbGxhcHNlKHRydWUpO1xuICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLmVuZCkpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcGFyc2UoZWwsIHAuc3RhcnQpKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZSAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxsIChlbCwgcCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHNldChlbCwgcCk7XG4gIH1cbiAgcmV0dXJuIGdldChlbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNlbGwgPSByZXF1aXJlKCdzZWxsJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgYnVsbHNleWUgPSByZXF1aXJlKCdidWxsc2V5ZScpO1xudmFyIGZ1enp5c2VhcmNoID0gcmVxdWlyZSgnZnV6enlzZWFyY2gnKTtcbnZhciBLRVlfQkFDS1NQQUNFID0gODtcbnZhciBLRVlfRU5URVIgPSAxMztcbnZhciBLRVlfRVNDID0gMjc7XG52YXIgS0VZX1VQID0gMzg7XG52YXIgS0VZX0RPV04gPSA0MDtcbnZhciBLRVlfVEFCID0gOTtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBkb2NFbGVtZW50ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuZnVuY3Rpb24gYXV0b2NvbXBsZXRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBwYXJlbnQgPSBvLmFwcGVuZFRvIHx8IGRvYy5ib2R5O1xuICB2YXIgcmVuZGVyID0gby5yZW5kZXIgfHwgZGVmYXVsdFJlbmRlcmVyO1xuICB2YXIge2dldFRleHQsIGdldFZhbHVlLCBmb3JtLCBzdWdnZXN0aW9uc30gPSBvO1xuICB2YXIgbGltaXQgPSB0eXBlb2Ygby5saW1pdCA9PT0gJ251bWJlcicgPyBvLmxpbWl0IDogSW5maW5pdHk7XG4gIHZhciB1c2VyRmlsdGVyID0gby5maWx0ZXIgfHwgZGVmYXVsdEZpbHRlcjtcbiAgdmFyIHVzZXJTZXQgPSBvLnNldCB8fCBkZWZhdWx0U2V0dGVyO1xuICB2YXIgdWwgPSB0YWcoJ3VsJywgJ3RhYy1saXN0Jyk7XG4gIHZhciBzZWxlY3Rpb24gPSBudWxsO1xuICB2YXIgZXllO1xuICB2YXIgZGVmZXJyZWRGaWx0ZXJpbmcgPSBkZWZlcihmaWx0ZXJpbmcpO1xuICB2YXIgYXR0YWNobWVudCA9IGVsO1xuICB2YXIgdGV4dElucHV0O1xuICB2YXIgYW55SW5wdXQ7XG4gIHZhciByYW5jaG9ybGVmdDtcbiAgdmFyIHJhbmNob3JyaWdodDtcbiAgdmFyIHN1Z2dlc3Rpb25zTG9hZCA9IHsgY291bnRlcjogMCwgdmFsdWU6IG51bGwgfTtcblxuICBpZiAoby5hdXRvSGlkZU9uQmx1ciA9PT0gdm9pZCAwKSB7IG8uYXV0b0hpZGVPbkJsdXIgPSB0cnVlOyB9XG4gIGlmIChvLmF1dG9IaWRlT25DbGljayA9PT0gdm9pZCAwKSB7IG8uYXV0b0hpZGVPbkNsaWNrID0gdHJ1ZTsgfVxuICBpZiAoby5hdXRvU2hvd09uVXBEb3duID09PSB2b2lkIDApIHsgby5hdXRvU2hvd09uVXBEb3duID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJzsgfVxuICBpZiAoby5hbmNob3IpIHtcbiAgICByYW5jaG9ybGVmdCA9IG5ldyBSZWdFeHAoJ14nICsgby5hbmNob3IpO1xuICAgIHJhbmNob3JyaWdodCA9IG5ldyBSZWdFeHAoby5hbmNob3IgKyAnJCcpO1xuICB9XG5cbiAgdmFyIGFwaSA9IHtcbiAgICBhZGQsXG4gICAgYW5jaG9yOiBvLmFuY2hvcixcbiAgICBjbGVhcixcbiAgICBzaG93LFxuICAgIGhpZGUsXG4gICAgdG9nZ2xlLFxuICAgIGRlc3Ryb3ksXG4gICAgcmVmcmVzaFBvc2l0aW9uLFxuICAgIGFwcGVuZFRleHQsXG4gICAgYXBwZW5kSFRNTCxcbiAgICBmaWx0ZXJBbmNob3JlZFRleHQsXG4gICAgZmlsdGVyQW5jaG9yZWRIVE1MLFxuICAgIGRlZmF1bHRBcHBlbmRUZXh0OiBhcHBlbmRUZXh0LFxuICAgIGRlZmF1bHRGaWx0ZXIsXG4gICAgZGVmYXVsdFJlbmRlcmVyLFxuICAgIGRlZmF1bHRTZXR0ZXIsXG4gICAgcmV0YXJnZXQsXG4gICAgYXR0YWNobWVudCxcbiAgICBsaXN0OiB1bCxcbiAgICBzdWdnZXN0aW9uczogW11cbiAgfTtcbiAgdmFyIGVudHJ5ID0geyBlbCwgYXBpIH07XG5cbiAgcmV0YXJnZXQoZWwpO1xuICBwYXJlbnQuYXBwZW5kQ2hpbGQodWwpO1xuICBlbC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShzdWdnZXN0aW9ucykpIHtcbiAgICBsb2FkZWQoc3VnZ2VzdGlvbnMsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gcmV0YXJnZXQgKGVsKSB7XG4gICAgaW5wdXRFdmVudHModHJ1ZSk7XG4gICAgYXR0YWNobWVudCA9IGFwaS5hdHRhY2htZW50ID0gZWw7XG4gICAgdGV4dElucHV0ID0gYXR0YWNobWVudC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGF0dGFjaG1lbnQudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgICBhbnlJbnB1dCA9IHRleHRJbnB1dCB8fCBpc0VkaXRhYmxlKGF0dGFjaG1lbnQpO1xuICAgIGlucHV0RXZlbnRzKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoUG9zaXRpb24gKCkge1xuICAgIGlmIChleWUpIHsgZXllLnJlZnJlc2goKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGluZyAoZm9yY2VTaG93KSB7XG4gICAgaWYgKHR5cGVvZiBzdWdnZXN0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY3Jvc3N2ZW50LnJlbW92ZShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICAgIHZhciB2YWx1ZSA9IHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICAgICAgaWYgKHZhbHVlICE9PSBzdWdnZXN0aW9uc0xvYWQudmFsdWUpIHtcbiAgICAgICAgc3VnZ2VzdGlvbnNMb2FkLmNvdW50ZXIrKztcbiAgICAgICAgc3VnZ2VzdGlvbnNMb2FkLnZhbHVlID0gdmFsdWU7XG5cbiAgICAgICAgdmFyIGNvdW50ZXIgPSBzdWdnZXN0aW9uc0xvYWQuY291bnRlcjtcbiAgICAgICAgc3VnZ2VzdGlvbnModmFsdWUsIGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICBpZiAoc3VnZ2VzdGlvbnNMb2FkLmNvdW50ZXIgPT09IGNvdW50ZXIpIHtcbiAgICAgICAgICAgIGxvYWRlZChzLCBmb3JjZVNob3cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGVkIChzdWdnZXN0aW9ucywgZm9yY2VTaG93KSB7XG4gICAgY2xlYXIoKTtcbiAgICBzdWdnZXN0aW9ucy5mb3JFYWNoKGFkZCk7XG4gICAgYXBpLnN1Z2dlc3Rpb25zID0gc3VnZ2VzdGlvbnM7XG4gICAgaWYgKGZvcmNlU2hvdykge1xuICAgICAgc2hvdygpO1xuICAgIH1cbiAgICBmaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgICB1bnNlbGVjdCgpO1xuICAgIHdoaWxlICh1bC5sYXN0Q2hpbGQpIHtcbiAgICAgIHVsLnJlbW92ZUNoaWxkKHVsLmxhc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkIChzdWdnZXN0aW9uKSB7XG4gICAgdmFyIGxpID0gdGFnKCdsaScsICd0YWMtaXRlbScpO1xuICAgIHJlbmRlcihsaSwgc3VnZ2VzdGlvbik7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2NsaWNrJywgY2xpY2tlZFN1Z2dlc3Rpb24pO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdhdXRvY29tcGxldGUtZmlsdGVyJywgZmlsdGVySXRlbSk7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJywgaGlkZUl0ZW0pO1xuICAgIHVsLmFwcGVuZENoaWxkKGxpKTtcbiAgICBhcGkuc3VnZ2VzdGlvbnMucHVzaChzdWdnZXN0aW9uKTtcbiAgICByZXR1cm4gbGk7XG5cbiAgICBmdW5jdGlvbiBjbGlja2VkU3VnZ2VzdGlvbiAoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBnZXRWYWx1ZShzdWdnZXN0aW9uKTtcbiAgICAgIHNldCh2YWx1ZSk7XG4gICAgICBoaWRlKCk7XG4gICAgICBhdHRhY2htZW50LmZvY3VzKCk7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtc2VsZWN0ZWQnLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVySXRlbSAoKSB7XG4gICAgICB2YXIgdmFsdWUgPSB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgICAgIGlmIChmaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSA9IGxpLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLWhpZGUvZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGlkZUl0ZW0gKCkge1xuICAgICAgaWYgKCFoaWRkZW4obGkpKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSArPSAnIHRhYy1oaWRlJztcbiAgICAgICAgaWYgKHNlbGVjdGlvbiA9PT0gbGkpIHtcbiAgICAgICAgICB1bnNlbGVjdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh2YWx1ZSkge1xuICAgIGlmIChvLmFuY2hvcikge1xuICAgICAgcmV0dXJuIChpc1RleHQoKSA/IGFwaS5hcHBlbmRUZXh0IDogYXBpLmFwcGVuZEhUTUwpKHZhbHVlKTtcbiAgICB9XG4gICAgdXNlclNldCh2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXIgKHZhbHVlLCBzdWdnZXN0aW9uKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICB2YXIgaWwgPSAoaXNUZXh0KCkgPyBhcGkuZmlsdGVyQW5jaG9yZWRUZXh0IDogYXBpLmZpbHRlckFuY2hvcmVkSFRNTCkodmFsdWUsIHN1Z2dlc3Rpb24pO1xuICAgICAgcmV0dXJuIGlsID8gdXNlckZpbHRlcihpbC5pbnB1dCwgaWwuc3VnZ2VzdGlvbikgOiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHVzZXJGaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNUZXh0ICgpIHsgcmV0dXJuIGlzSW5wdXQoYXR0YWNobWVudCk7IH1cbiAgZnVuY3Rpb24gdmlzaWJsZSAoKSB7IHJldHVybiB1bC5jbGFzc05hbWUuaW5kZXhPZigndGFjLXNob3cnKSAhPT0gLTE7IH1cbiAgZnVuY3Rpb24gaGlkZGVuIChsaSkgeyByZXR1cm4gbGkuY2xhc3NOYW1lLmluZGV4T2YoJ3RhYy1oaWRlJykgIT09IC0xOyB9XG5cbiAgZnVuY3Rpb24gc2hvdyAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHVsLmNsYXNzTmFtZSArPSAnIHRhYy1zaG93JztcbiAgICAgIGV5ZS5yZWZyZXNoKCk7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtc2hvdycpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZXIgKGUpIHtcbiAgICB2YXIgbGVmdCA9IGUud2hpY2ggPT09IDEgJiYgIWUubWV0YUtleSAmJiAhZS5jdHJsS2V5O1xuICAgIGlmIChsZWZ0ID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuOyAvLyB3ZSBvbmx5IGNhcmUgYWJvdXQgaG9uZXN0IHRvIGdvZCBsZWZ0LWNsaWNrc1xuICAgIH1cbiAgICB0b2dnbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZSAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHNob3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdCAoc3VnZ2VzdGlvbikge1xuICAgIHVuc2VsZWN0KCk7XG4gICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgIHNlbGVjdGlvbiA9IHN1Z2dlc3Rpb247XG4gICAgICBzZWxlY3Rpb24uY2xhc3NOYW1lICs9ICcgdGFjLXNlbGVjdGVkJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1bnNlbGVjdCAoKSB7XG4gICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgc2VsZWN0aW9uLmNsYXNzTmFtZSA9IHNlbGVjdGlvbi5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zZWxlY3RlZC9nLCAnJyk7XG4gICAgICBzZWxlY3Rpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmUgKHVwLCBtb3Zlcykge1xuICAgIHZhciB0b3RhbCA9IHVsLmNoaWxkcmVuLmxlbmd0aDtcbiAgICBpZiAodG90YWwgPCBtb3Zlcykge1xuICAgICAgdW5zZWxlY3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRvdGFsID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBmaXJzdCA9IHVwID8gJ2xhc3RDaGlsZCcgOiAnZmlyc3RDaGlsZCc7XG4gICAgdmFyIG5leHQgPSB1cCA/ICdwcmV2aW91c1NpYmxpbmcnIDogJ25leHRTaWJsaW5nJztcbiAgICB2YXIgc3VnZ2VzdGlvbiA9IHNlbGVjdGlvbiAmJiBzZWxlY3Rpb25bbmV4dF0gfHwgdWxbZmlyc3RdO1xuXG4gICAgc2VsZWN0KHN1Z2dlc3Rpb24pO1xuXG4gICAgaWYgKGhpZGRlbihzdWdnZXN0aW9uKSkge1xuICAgICAgbW92ZSh1cCwgbW92ZXMgPyBtb3ZlcyArIDEgOiAxKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoaWRlICgpIHtcbiAgICBleWUuc2xlZXAoKTtcbiAgICB1bC5jbGFzc05hbWUgPSB1bC5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zaG93L2csICcnKTtcbiAgICB1bnNlbGVjdCgpO1xuICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlkb3duIChlKSB7XG4gICAgdmFyIHNob3duID0gdmlzaWJsZSgpO1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0RPV04pIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgICAgaWYgKHNob3duKSB7XG4gICAgICAgIG1vdmUoKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfVVApIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgICAgaWYgKHNob3duKSB7XG4gICAgICAgIG1vdmUodHJ1ZSk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX0JBQ0tTUEFDRSkge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzaG93bikge1xuICAgICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoc2VsZWN0aW9uLCAnY2xpY2snKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoaWRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9FU0MpIHtcbiAgICAgICAgaGlkZSgpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlcmluZyAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbG9hZGluZyh0cnVlKTtcbiAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtZmlsdGVyJyk7XG4gICAgdmFyIGxpID0gdWwuZmlyc3RDaGlsZDtcbiAgICB2YXIgY291bnQgPSAwO1xuICAgIHdoaWxlIChsaSkge1xuICAgICAgaWYgKGNvdW50ID49IGxpbWl0KSB7XG4gICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUobGksICdhdXRvY29tcGxldGUtaGlkZScpO1xuICAgICAgfVxuICAgICAgaWYgKGNvdW50IDwgbGltaXQpIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICAgICAgaWYgKGxpLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtaGlkZScpID09PSAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpID0gbGkubmV4dFNpYmxpbmc7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBtb3ZlKCk7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBoaWRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmZXJyZWRGaWx0ZXJpbmdOb0VudGVyIChlKSB7XG4gICAgdmFyIHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGVmZXJyZWRGaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmVycmVkU2hvdyAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFRpbWVvdXQoc2hvdywgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBhdXRvY29tcGxldGVFdmVudFRhcmdldCAoZSkge1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgaWYgKHRhcmdldCA9PT0gdWwgfHwgdGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU9uQmx1ciAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX1RBQikge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGVPbkNsaWNrIChlKSB7XG4gICAgaWYgKGF1dG9jb21wbGV0ZUV2ZW50VGFyZ2V0KGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpZGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlucHV0RXZlbnRzIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGlmIChleWUpIHtcbiAgICAgIGV5ZS5kZXN0cm95KCk7XG4gICAgICBleWUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIXJlbW92ZSkge1xuICAgICAgZXllID0gYnVsbHNleWUodWwsIGF0dGFjaG1lbnQsIHsgY2FyZXQ6IGFueUlucHV0ICYmIGF0dGFjaG1lbnQudGFnTmFtZSAhPT0gJ0lOUFVUJyB9KTtcbiAgICAgIGlmICghdmlzaWJsZSgpKSB7IGV5ZS5zbGVlcCgpOyB9XG4gICAgfVxuICAgIGlmIChyZW1vdmUgfHwgKGFueUlucHV0ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBhdHRhY2htZW50KSkge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZGluZygpO1xuICAgIH1cbiAgICBpZiAoYW55SW5wdXQpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRTaG93KTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRGaWx0ZXJpbmcpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAna2V5ZG93bicsIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdwYXN0ZScsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICAgIGlmIChvLmF1dG9IaWRlT25CbHVyKSB7IGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBoaWRlT25CbHVyKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdjbGljaycsIHRvZ2dsZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2NFbGVtZW50LCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIH1cbiAgICBpZiAoby5hdXRvSGlkZU9uQ2xpY2spIHsgY3Jvc3N2ZW50W29wXShkb2MsICdjbGljaycsIGhpZGVPbkNsaWNrKTsgfVxuICAgIGlmIChmb3JtKSB7IGNyb3NzdmVudFtvcF0oZm9ybSwgJ3N1Ym1pdCcsIGhpZGUpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBpZiAocGFyZW50LmNvbnRhaW5zKHVsKSkgeyBwYXJlbnQucmVtb3ZlQ2hpbGQodWwpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0U2V0dGVyICh2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAobGksIHN1Z2dlc3Rpb24pIHtcbiAgICBsaS5pbm5lclRleHQgPSBsaS50ZXh0Q29udGVudCA9IGdldFRleHQoc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0RmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgdmFyIG5lZWRsZSA9IHEudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgdGV4dCA9IGdldFRleHQoc3VnZ2VzdGlvbikgfHwgJyc7XG4gICAgaWYgKGZ1enp5c2VhcmNoKG5lZWRsZSwgdGV4dC50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pIHx8ICcnO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBmdXp6eXNlYXJjaChuZWVkbGUsIHZhbHVlLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9vcGJhY2tUb0FuY2hvciAodGV4dCwgcCkge1xuICAgIHZhciByZXN1bHQgPSAnJztcbiAgICB2YXIgYW5jaG9yZWQgPSBmYWxzZTtcbiAgICB2YXIgc3RhcnQgPSBwLnN0YXJ0O1xuICAgIHdoaWxlIChhbmNob3JlZCA9PT0gZmFsc2UgJiYgc3RhcnQgPj0gMCkge1xuICAgICAgcmVzdWx0ID0gdGV4dC5zdWJzdHIoc3RhcnQgLSAxLCBwLnN0YXJ0IC0gc3RhcnQgKyAxKTtcbiAgICAgIGFuY2hvcmVkID0gcmFuY2hvcmxlZnQudGVzdChyZXN1bHQpO1xuICAgICAgc3RhcnQtLTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGFuY2hvcmVkID8gcmVzdWx0IDogbnVsbCxcbiAgICAgIHN0YXJ0OiBzdGFydFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZFRleHQgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICB2YXIgcG9zaXRpb24gPSBzZWxsKGVsKTtcbiAgICB2YXIgaW5wdXQgPSBsb29wYmFja1RvQW5jaG9yKHEsIHBvc2l0aW9uKS50ZXh0O1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgcmV0dXJuIHsgaW5wdXQ6IGlucHV0LCBzdWdnZXN0aW9uOiBzdWdnZXN0aW9uIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwZW5kVGV4dCAodmFsdWUpIHtcbiAgICB2YXIgY3VycmVudCA9IGVsLnZhbHVlO1xuICAgIHZhciBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIHZhciBpbnB1dCA9IGxvb3BiYWNrVG9BbmNob3IoY3VycmVudCwgcG9zaXRpb24pO1xuICAgIHZhciBsZWZ0ID0gY3VycmVudC5zdWJzdHIoMCwgaW5wdXQuc3RhcnQpO1xuICAgIHZhciByaWdodCA9IGN1cnJlbnQuc3Vic3RyKGlucHV0LnN0YXJ0ICsgaW5wdXQudGV4dC5sZW5ndGggKyAocG9zaXRpb24uZW5kIC0gcG9zaXRpb24uc3RhcnQpKTtcbiAgICB2YXIgYmVmb3JlID0gbGVmdCArIHZhbHVlICsgJyAnO1xuXG4gICAgZWwudmFsdWUgPSBiZWZvcmUgKyByaWdodDtcbiAgICBzZWxsKGVsLCB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggfSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRIVE1MICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcmluZyBpbiBlZGl0YWJsZSBlbGVtZW50cyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXQgKGVsKSB7IHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7IH1cblxuZnVuY3Rpb24gdGFnICh0eXBlLCBjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBkZWZlciAoZm4pIHsgcmV0dXJuIGZ1bmN0aW9uICgpIHsgc2V0VGltZW91dChmbiwgMCk7IH07IH1cblxuZnVuY3Rpb24gaXNFZGl0YWJsZSAoZWwpIHtcbiAgdmFyIHZhbHVlID0gZWwuZ2V0QXR0cmlidXRlKCdjb250ZW50RWRpdGFibGUnKTtcbiAgaWYgKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gaXNFZGl0YWJsZShlbC5wYXJlbnRFbGVtZW50KTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmF1dG9jb21wbGV0ZS5maW5kID0gZmluZDtcbm1vZHVsZS5leHBvcnRzID0gYXV0b2NvbXBsZXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZG9tID0gcmVxdWlyZSgnLi9kb20nKTtcbnZhciB0ZXh0ID0gcmVxdWlyZSgnLi90ZXh0Jyk7XG52YXIgcHJvcHMgPSBbXG4gICdmb250RmFtaWx5JyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd3b3JkU3BhY2luZycsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3dlYmtpdEJveFNpemluZycsXG4gICdtb3pCb3hTaXppbmcnLFxuICAnYm94U2l6aW5nJyxcbiAgJ3BhZGRpbmcnLFxuICAnYm9yZGVyJ1xuXTtcbnZhciBvZmZzZXQgPSAyMDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmYWN0b3J5IChlbCkge1xuICB2YXIgbWlycm9yID0gZG9tKCdzcGFuJyk7XG5cbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuICByZW1hcCgpO1xuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZW1hcDogcmVtYXAsXG4gICAgcmVmcmVzaDogcmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gcmVtYXAgKCkge1xuICAgIHZhciBjID0gY29tcHV0ZWQoKTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZSA9IGNbcHJvcHNbaV1dO1xuICAgICAgaWYgKHZhbHVlICE9PSB2b2lkIDAgJiYgdmFsdWUgIT09IG51bGwpIHsgLy8gb3RoZXJ3aXNlIElFIGJsb3dzIHVwXG4gICAgICAgIG1pcnJvci5zdHlsZVtwcm9wc1tpXV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgbWlycm9yLmRpc2FibGVkID0gJ2Rpc2FibGVkJztcbiAgICBtaXJyb3Iuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnO1xuICAgIG1pcnJvci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgbWlycm9yLnN0eWxlLnRvcCA9IG1pcnJvci5zdHlsZS5sZWZ0ID0gJy05OTk5ZW0nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgdmFyIHZhbHVlID0gZWwudmFsdWU7XG4gICAgaWYgKHZhbHVlID09PSBtaXJyb3IudmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0ZXh0KG1pcnJvciwgdmFsdWUpO1xuXG4gICAgdmFyIHdpZHRoID0gbWlycm9yLm9mZnNldFdpZHRoICsgb2Zmc2V0O1xuXG4gICAgZWwuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBtaXJyb3IucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChtaXJyb3IpO1xuICAgIGVsLnN0eWxlLndpZHRoID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wdXRlZCAoKSB7XG4gICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgICByZXR1cm4gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIH1cbiAgICByZXR1cm4gZWwuY3VycmVudFN0eWxlO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRvbSAodGFnTmFtZSwgY2xhc3Nlcykge1xuICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICBpZiAoY2xhc3Nlcykge1xuICAgIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXM7XG4gIH1cbiAgcmV0dXJuIGVsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcbnZhciBpbnB1dFRhZyA9IC9pbnB1dC9pO1xudmFyIHRleHRhcmVhVGFnID0gL3RleHRhcmVhL2k7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IHRleHRhcmVhVGFnLnRlc3QoZWwudGFnTmFtZSkpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHNwZWNpYWwoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBzcGVjaWFsKGVsLCBwLmVuZCk7XG59XG5cbmZ1bmN0aW9uIGhhcmRTZXQgKGVsLCBwKSB7XG4gIHZhciByYW5nZSA9IGVsLmNyZWF0ZVRleHRSYW5nZSgpO1xuXG4gIGlmIChwLnN0YXJ0ID09PSAnZW5kJyAmJiBwLmVuZCA9PT0gJ2VuZCcpIHtcbiAgICByYW5nZS5jb2xsYXBzZShmYWxzZSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2UuY29sbGFwc2UodHJ1ZSk7XG4gICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgcC5lbmQpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcC5zdGFydCk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BlY2lhbCAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxlY3Rpb24gKGVsLCBwKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgc2V0KGVsLCBwKTtcbiAgfVxuICByZXR1cm4gZ2V0KGVsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHNsaWNlIChjb2xsZWN0aW9uKSB7IC8vIGJlY2F1c2Ugb2xkIElFXG4gIHZhciByZXN1bHQgPSBbXTtcbiAgdmFyIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBjb2xsZWN0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0LnB1c2goY29sbGVjdGlvbltpXSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzbGljZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGRvbSA9IHJlcXVpcmUoJy4vZG9tJyk7XG52YXIgdGV4dCA9IHJlcXVpcmUoJy4vdGV4dCcpO1xudmFyIHNsaWNlID0gcmVxdWlyZSgnLi9zbGljZScpO1xudmFyIHNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vc2VsZWN0aW9uJyk7XG52YXIgYXV0b3NpemUgPSByZXF1aXJlKCcuL2F1dG9zaXplJyk7XG52YXIgYXV0b2NvbXBsZXRlID0gcmVxdWlyZSgnLi9hdXRvY29tcGxldGUnKTtcbnZhciBpbnB1dFRhZyA9IC9eaW5wdXQkL2k7XG52YXIgRUxFTUVOVCA9IDE7XG52YXIgQkFDS1NQQUNFID0gODtcbnZhciBFTkQgPSAzNTtcbnZhciBIT01FID0gMzY7XG52YXIgTEVGVCA9IDM3O1xudmFyIFJJR0hUID0gMzk7XG52YXIgdGFnQ2xhc3MgPSAvXFxidGF5LXRhZ1xcYi87XG52YXIgdGFnUmVtb3ZhbENsYXNzID0gL1xcYnRheS10YWctcmVtb3ZlXFxiLztcbnZhciBlZGl0b3JDbGFzcyA9IC9cXGJ0YXktZWRpdG9yXFxiL2c7XG52YXIgaW5wdXRDbGFzcyA9IC9cXGJ0YXktaW5wdXRcXGIvZztcbnZhciBlbmQgPSB7IHN0YXJ0OiAnZW5kJywgZW5kOiAnZW5kJyB9O1xudmFyIGRlZmF1bHREZWxpbWl0ZXIgPSAnICc7XG5cbmZ1bmN0aW9uIHRhZ2d5IChlbCwgb3B0aW9ucykge1xuICB2YXIgY3VycmVudFZhbHVlcyA9IFtdO1xuICB2YXIgX25vc2VsZWN0ID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gZWw7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGRlbGltaXRlciA9IG8uZGVsaW1pdGVyIHx8IGRlZmF1bHREZWxpbWl0ZXI7XG4gIGlmIChkZWxpbWl0ZXIubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWdneSBleHBlY3RlZCBhIHNpbmdsZS1jaGFyYWN0ZXIgZGVsaW1pdGVyIHN0cmluZycpO1xuICB9XG4gIHZhciBhbnkgPSBoYXNTaWJsaW5ncyhlbCk7XG4gIGlmIChhbnkgfHwgIWlucHV0VGFnLnRlc3QoZWwudGFnTmFtZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ2d5IGV4cGVjdGVkIGFuIGlucHV0IGVsZW1lbnQgd2l0aG91dCBhbnkgc2libGluZ3MnKTtcbiAgfVxuICB2YXIgcGFyc2UgPSBvLnBhcnNlIHx8IGRlZmF1bHRQYXJzZTtcbiAgdmFyIGZyZWUgPSBvLmZyZWUgIT09IGZhbHNlO1xuICB2YXIgdmFsaWRhdGUgPSBvLnZhbGlkYXRlIHx8IGRlZmF1bHRWYWxpZGF0ZTtcbiAgdmFyIHJlbmRlciA9IG8ucmVuZGVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcbiAgdmFyIHJlYWRUYWcgPSBvLnJlYWRUYWcgfHwgZGVmYXVsdFJlYWRlcjtcblx0dmFyIGNvbnZlcnRPbkZvY3VzID0gby5jb252ZXJ0T25Gb2N1cyAhPT0gZmFsc2U7XG5cbiAgdmFyIGJlZm9yZSA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1iZWZvcmUnKTtcbiAgdmFyIGFmdGVyID0gZG9tKCdzcGFuJywgJ3RheS10YWdzIHRheS10YWdzLWFmdGVyJyk7XG4gIHZhciBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICBlbC5jbGFzc05hbWUgKz0gJyB0YXktaW5wdXQnO1xuICBwYXJlbnQuY2xhc3NOYW1lICs9ICcgdGF5LWVkaXRvcic7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYmVmb3JlLCBlbCk7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYWZ0ZXIsIGVsLm5leHRTaWJsaW5nKTtcbiAgYmluZCgpO1xuXG4gIHZhciBzaHJpbmtlciA9IGF1dG9zaXplKGVsKTtcbiAgdmFyIGNvbXBsZXRlcjtcbiAgaWYgKG8uYXV0b2NvbXBsZXRlKSB7XG4gICAgY29tcGxldGVyID0gY3JlYXRlQXV0b2NvbXBsZXRlKCk7XG4gIH1cblxuICB2YXIgYXBpID0ge1xuICAgIGFkZEl0ZW0sXG4gICAgcmVtb3ZlSXRlbSxcbiAgICB2YWx1ZTogcmVhZFZhbHVlLFxuICAgIGNvbnZlcnQ6IGNvbnZlcnQsXG4gICAgZGVzdHJveTogZGVzdHJveVxuICB9O1xuICB2YXIgZW50cnkgPSB7IGVsOiBlbCwgYXBpOiBhcGkgfTtcblxuICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gIF9ub3NlbGVjdCA9IGZhbHNlO1xuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gYWRkSXRlbSAoaXRlbSkge1xuICAgIGNvbnNvbGUubG9nKCdBZGRJdGVtJywgaXRlbSk7XG4gICAgLy8gcmVuZGVycyBpdGVtLCBhZGRzIGl0IHRvIGxpc3Qgb2Ygb3V0cHV0cy5cbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbSAoaXRlbSkge1xuICAgIGNvbnNvbGUubG9nKCdSZW1vdmVJdGVtJywgaXRlbSk7XG4gICAgLy8gZGVyZW5kZXJzIGl0ZW0sIHJlbW92ZXMgaXQgZnJvbSBsaXN0IG9mIG91dHB1dHMuXG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUF1dG9jb21wbGV0ZSAoKSB7XG4gICAgdmFyIGF1dG9UZXh0ID0gby5wYXJzZVRleHQ7XG4gICAgdmFyIGF1dG9WYWx1ZSA9IG8ucGFyc2VWYWx1ZTtcbiAgICB2YXIgZ2V0VGV4dCA9IChcbiAgICAgIHR5cGVvZiBhdXRvVGV4dCA9PT0gJ3N0cmluZycgPyBzID0+IHNbYXV0b1RleHRdIDpcbiAgICAgIHR5cGVvZiBhdXRvVGV4dCA9PT0gJ2Z1bmN0aW9uJyA/IGF1dG9UZXh0IDpcbiAgICAgIHMgPT4gc1xuICAgICk7XG4gICAgdmFyIGdldFZhbHVlID0gKFxuICAgICAgdHlwZW9mIGF1dG9WYWx1ZSA9PT0gJ3N0cmluZycgPyBzID0+IHNbYXV0b1ZhbHVlXSA6XG4gICAgICB0eXBlb2YgYXV0b1ZhbHVlID09PSAnZnVuY3Rpb24nID8gYXV0b1ZhbHVlIDpcbiAgICAgIHMgPT4gc1xuICAgICk7XG4gICAgdmFyIGNvbXBsZXRlciA9IGF1dG9jb21wbGV0ZShlbCwge1xuICAgICAgc3VnZ2VzdGlvbnM6IG8uYXV0b2NvbXBsZXRlLFxuICAgICAgZ2V0VGV4dCxcbiAgICAgIGdldFZhbHVlLFxuICAgICAgc2V0OiBhZGRJdGVtXG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbXBsZXRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5cHJlc3MnLCBrZXlwcmVzcyk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcGFzdGUpO1xuICAgIGNyb3NzdmVudFtvcF0ocGFyZW50LCAnY2xpY2snLCBjbGljayk7XG5cdFx0aWYgKGNvbnZlcnRPbkZvY3VzKSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgJ2ZvY3VzJywgZG9jdW1lbnRmb2N1cywgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBpZiAoaG9yc2UpIHsgaG9yc2UuZGVzdHJveSgpOyB9XG4gICAgZWwudmFsdWUgPSAnJztcbiAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShpbnB1dENsYXNzLCAnJyk7XG4gICAgcGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShlZGl0b3JDbGFzcywgJycpO1xuICAgIGlmIChiZWZvcmUucGFyZW50RWxlbWVudCkgeyBiZWZvcmUucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChiZWZvcmUpOyB9XG4gICAgaWYgKGFmdGVyLnBhcmVudEVsZW1lbnQpIHsgYWZ0ZXIucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChhZnRlcik7IH1cbiAgICBzaHJpbmtlci5kZXN0cm95KCk7XG4gICAgYXBpLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgYXBpLmRlc3Ryb3kgPSAoKSA9PiBhcGk7XG4gICAgYXBpLnRhZ3MgPSBhcGkudmFsdWUgPSAoKSA9PiBudWxsO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBkb2N1bWVudGZvY3VzIChlKSB7XG4gICAgaWYgKGUudGFyZ2V0ICE9PSBlbCkge1xuICAgICAgX25vc2VsZWN0ID0gdHJ1ZTtcbiAgICAgIGNvbnZlcnQodHJ1ZSk7XG4gICAgICBfbm9zZWxlY3QgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjbGljayAoZSkge1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFnUmVtb3ZhbENsYXNzLnRlc3QodGFyZ2V0LmNsYXNzTmFtZSkpIHtcbiAgICAgIGZvY3VzVGFnKHRhcmdldC5wYXJlbnRFbGVtZW50LCB7IHN0YXJ0OiAnZW5kJywgZW5kOiAnZW5kJywgcmVtb3ZlOiB0cnVlIH0pO1xuICAgICAgc2hpZnQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRvcCA9IHRhcmdldDtcbiAgICB2YXIgdGFnZ2VkID0gdGFnQ2xhc3MudGVzdCh0b3AuY2xhc3NOYW1lKTtcbiAgICB3aGlsZSAodGFnZ2VkID09PSBmYWxzZSAmJiB0b3AucGFyZW50RWxlbWVudCkge1xuICAgICAgdG9wID0gdG9wLnBhcmVudEVsZW1lbnQ7XG4gICAgICB0YWdnZWQgPSB0YWdDbGFzcy50ZXN0KHRvcC5jbGFzc05hbWUpO1xuICAgIH1cbiAgICBpZiAodGFnZ2VkKSB7XG4gICAgICBmb2N1c1RhZyh0b3AsIGVuZCk7XG4gICAgfSBlbHNlIGlmICh0YXJnZXQgIT09IGVsKSB7XG4gICAgICBzaGlmdCgpO1xuICAgICAgZWwuZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzaGlmdCAoKSB7XG4gICAgZm9jdXNUYWcoYWZ0ZXIubGFzdENoaWxkLCBlbmQpO1xuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnZlcnQgKGFsbCkge1xuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCBhbGwpO1xuICAgIGlmIChhbGwpIHtcbiAgICAgIGVhY2goYWZ0ZXIsIG1vdmVMZWZ0KTtcbiAgICB9XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShlbCwgJ3RhZ2d5LWNvbnZlcnRlZCcpO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlTGVmdCAodmFsdWUsIHRhZykge1xuICAgIGJlZm9yZS5hcHBlbmRDaGlsZCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICAgIHZhciBzZWwgPSBzZWxlY3Rpb24oZWwpO1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIGlmIChrZXkgPT09IEhPTUUpIHtcbiAgICAgIGlmIChiZWZvcmUuZmlyc3RDaGlsZCkge1xuICAgICAgICBmb2N1c1RhZyhiZWZvcmUuZmlyc3RDaGlsZCwge30pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZWN0aW9uKGVsLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChrZXkgPT09IEVORCkge1xuICAgICAgaWYgKGFmdGVyLmxhc3RDaGlsZCkge1xuICAgICAgICBmb2N1c1RhZyhhZnRlci5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxlY3Rpb24oZWwsIGVuZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChrZXkgPT09IExFRlQgJiYgc2VsLnN0YXJ0ID09PSAwICYmIGJlZm9yZS5sYXN0Q2hpbGQpIHtcbiAgICAgIGZvY3VzVGFnKGJlZm9yZS5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgfSBlbHNlIGlmIChrZXkgPT09IEJBQ0tTUEFDRSAmJiBzZWwuc3RhcnQgPT09IDAgJiYgKHNlbC5lbmQgPT09IDAgfHwgc2VsLmVuZCAhPT0gZWwudmFsdWUubGVuZ3RoKSAmJiBiZWZvcmUubGFzdENoaWxkKSB7XG4gICAgICBmb2N1c1RhZyhiZWZvcmUubGFzdENoaWxkLCBlbmQpO1xuICAgIH0gZWxzZSBpZiAoa2V5ID09PSBSSUdIVCAmJiBzZWwuZW5kID09PSBlbC52YWx1ZS5sZW5ndGggJiYgYWZ0ZXIuZmlyc3RDaGlsZCkge1xuICAgICAgZm9jdXNUYWcoYWZ0ZXIuZmlyc3RDaGlsZCwge30pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGtleXByZXNzIChlKSB7XG4gICAgdmFyIGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlIHx8IGUuY2hhckNvZGU7XG4gICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUoa2V5KSA9PT0gZGVsaW1pdGVyKSB7XG4gICAgICBjb252ZXJ0KCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGFzdGUgKCkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gbGF0ZXIgKCkgeyBldmFsdWF0ZSgpOyB9LCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2YWx1YXRlIChleHRyYXMsIGVudGlyZWx5KSB7XG4gICAgdmFyIHAgPSBzZWxlY3Rpb24oZWwpO1xuICAgIHZhciBsZW4gPSBlbnRpcmVseSA/IEluZmluaXR5IDogcC5zdGFydDtcbiAgICB2YXIgdGFncyA9IGVsLnZhbHVlLnNsaWNlKDAsIGxlbikuY29uY2F0KGV4dHJhcyB8fCBbXSkuc3BsaXQoZGVsaW1pdGVyKTtcbiAgICBpZiAodGFncy5sZW5ndGggPCAxKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHJlc3QgPSB0YWdzLnBvcCgpICsgZWwudmFsdWUuc2xpY2UobGVuKTtcbiAgICB2YXIgcmVtb3ZhbCA9IHRhZ3Muam9pbihkZWxpbWl0ZXIpLmxlbmd0aDtcbiAgICB2YXIgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0YWdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjcmVhdGVUYWcoYmVmb3JlLCB0YWdzW2ldKTtcbiAgICB9XG4gICAgY2xlYW51cCgpO1xuICAgIGVsLnZhbHVlID0gcmVzdDtcbiAgICBwLnN0YXJ0IC09IHJlbW92YWw7XG4gICAgcC5lbmQgLT0gcmVtb3ZhbDtcbiAgICBpZiAoX25vc2VsZWN0ICE9PSB0cnVlKSB7IHNlbGVjdGlvbihlbCwgcCk7IH1cbiAgICBzaHJpbmtlci5yZWZyZXNoKCk7XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShlbCwgJ3RhZ2d5LWV2YWx1YXRlZCcpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYW51cCAoKSB7XG4gICAgdmFyIHRhZ3MgPSBbXTtcblxuICAgIGVhY2goYmVmb3JlLCBkZXRlY3QpO1xuICAgIGVhY2goYWZ0ZXIsIGRldGVjdCk7XG5cbiAgICBmdW5jdGlvbiBkZXRlY3QgKHZhbHVlLCB0YWdFbGVtZW50KSB7XG4gICAgICBpZiAodmFsaWRhdGUodmFsdWUsIHNsaWNlKHRhZ3MpKSkge1xuICAgICAgICB0YWdzLnB1c2godmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFnRWxlbWVudC5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRhZ0VsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAoY29udGFpbmVyLCB2YWx1ZSkge1xuICAgIHRleHQoY29udGFpbmVyLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UmVhZGVyICh0YWcpIHtcbiAgICByZXR1cm4gdGV4dCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGFnIChidWZmZXIsIHZhbHVlKSB7XG4gICAgdmFyIHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XG4gICAgaWYgKHRyaW1tZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBlbCA9IGRvbSgnc3BhbicsICd0YXktdGFnJyk7XG4gICAgcmVuZGVyKGVsLCBwYXJzZSh0cmltbWVkKSk7XG4gICAgaWYgKG8uZGVsZXRpb24pIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGRvbSgnc3BhbicsICd0YXktdGFnLXJlbW92ZScpKTtcbiAgICB9XG4gICAgYnVmZmVyLmFwcGVuZENoaWxkKGVsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvY3VzVGFnICh0YWcsIHApIHtcbiAgICBpZiAoIXRhZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gICAgdmFyIHBhcmVudCA9IHRhZy5wYXJlbnRFbGVtZW50O1xuICAgIGlmIChwYXJlbnQgPT09IGJlZm9yZSkge1xuICAgICAgd2hpbGUgKHBhcmVudC5sYXN0Q2hpbGQgIT09IHRhZykge1xuICAgICAgICBhZnRlci5pbnNlcnRCZWZvcmUocGFyZW50Lmxhc3RDaGlsZCwgYWZ0ZXIuZmlyc3RDaGlsZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlIChwYXJlbnQuZmlyc3RDaGlsZCAhPT0gdGFnKSB7XG4gICAgICAgIGJlZm9yZS5hcHBlbmRDaGlsZChwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRhZy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRhZyk7XG4gICAgZWwudmFsdWUgPSBwLnJlbW92ZSA/ICcnIDogcmVhZFRhZyh0YWcpO1xuICAgIGVsLmZvY3VzKCk7XG4gICAgc2VsZWN0aW9uKGVsLCBwKTtcbiAgICBzaHJpbmtlci5yZWZyZXNoKCk7XG4gIH1cblxuICBmdW5jdGlvbiBoYXNTaWJsaW5ncyAoKSB7XG4gICAgdmFyIGFsbCA9IGVsLnBhcmVudEVsZW1lbnQuY2hpbGRyZW47XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IGFsbC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFsbFtpXSAhPT0gZWwgJiYgYWxsW2ldLm5vZGVUeXBlID09PSBFTEVNRU5UKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBlYWNoIChzaWRlLCBmbikge1xuICAgIHZhciBjaGlsZHJlbiA9IHNsaWNlKHNpZGUuY2hpbGRyZW4pO1xuICAgIHZhciBpO1xuICAgIHZhciB0YWc7XG4gICAgZm9yIChpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0YWcgPSBjaGlsZHJlbltpXTtcbiAgICAgIGZuKHJlYWRUYWcodGFnKSwgdGFnLCBpKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVmFsdWUgKCkge1xuICAgIHJldHVybiBjdXJyZW50VmFsdWVzLmZpbHRlcih2ID0+IHYudmFsaWQpLm1hcCh2ID0+IHYuZGF0YSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UGFyc2UgKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdFZhbGlkYXRlICh2YWx1ZSwgdGFncykge1xuICAgIHJldHVybiB0YWdzLmluZGV4T2YodmFsdWUpID09PSAtMTtcbiAgfVxufVxuXG50YWdneS5maW5kID0gZmluZDtcbm1vZHVsZS5leHBvcnRzID0gdGFnZ3k7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRleHQgKGVsLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGVsLmlubmVyVGV4dCA9IGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gIH1cbiAgaWYgKHR5cGVvZiBlbC5pbm5lclRleHQgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVsLmlubmVyVGV4dDtcbiAgfVxuICByZXR1cm4gZWwudGV4dENvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGV4dDtcbiJdfQ==
