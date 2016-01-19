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

function autocomplete(el, options) {
  var o = options || {};
  var parent = o.appendTo || doc.body;
  var render = o.render || defaultRenderer;
  var getText = o.getText;
  var getValue = o.getValue;
  var form = o.form;
  var suggestions = o.suggestions;

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

  if (o.autoHideOnBlur === void 0) {
    o.autoHideOnBlur = true;
  }
  if (o.autoHideOnClick === void 0) {
    o.autoHideOnClick = true;
  }
  if (o.autoShowOnUpDown === void 0) {
    o.autoShowOnUpDown = el.tagName === 'INPUT';
  }
  if (o.anchor) {
    ranchorleft = new RegExp('^' + o.anchor);
    ranchorright = new RegExp(o.anchor + '$');
  }

  var api = {
    add: add,
    anchor: o.anchor,
    clear: clear,
    show: show,
    hide: hide,
    toggle: toggle,
    destroy: destroy,
    refreshPosition: refreshPosition,
    appendText: appendText,
    appendHTML: appendHTML,
    filterAnchoredText: filterAnchoredText,
    filterAnchoredHTML: filterAnchoredHTML,
    defaultAppendText: appendText,
    defaultFilter: defaultFilter,
    defaultRenderer: defaultRenderer,
    defaultSetter: defaultSetter,
    retarget: retarget,
    attachment: attachment,
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

  function retarget(el) {
    inputEvents(true);
    attachment = api.attachment = el;
    textInput = attachment.tagName === 'INPUT' || attachment.tagName === 'TEXTAREA';
    anyInput = textInput || isEditable(attachment);
    inputEvents();
  }

  function refreshPosition() {
    if (eye) {
      eye.refresh();
    }
  }

  function loading(forceShow) {
    if (typeof suggestions === 'function') {
      crossvent.remove(attachment, 'focus', loading);
      var value = textInput ? el.value : el.innerHTML;
      if (value !== suggestionsLoad.value) {
        suggestionsLoad.counter++;
        suggestionsLoad.value = value;

        var counter = suggestionsLoad.counter;
        suggestions(value, function (s) {
          if (suggestionsLoad.counter === counter) {
            loaded(s, forceShow);
          }
        });
      }
    }
  }

  function loaded(suggestions, forceShow) {
    clear();
    suggestions.forEach(add);
    api.suggestions = suggestions;
    if (forceShow) {
      show();
    }
    filtering();
  }

  function clear() {
    unselect();
    while (ul.lastChild) {
      ul.removeChild(ul.lastChild);
    }
  }

  function add(suggestion) {
    var li = tag('li', 'tac-item');
    render(li, suggestion);
    crossvent.add(li, 'click', clickedSuggestion);
    crossvent.add(li, 'autocomplete-filter', filterItem);
    crossvent.add(li, 'autocomplete-hide', hideItem);
    ul.appendChild(li);
    api.suggestions.push(suggestion);
    return li;

    function clickedSuggestion() {
      var value = getValue(suggestion);
      set(value);
      hide();
      attachment.focus();
      crossvent.fabricate(attachment, 'autocomplete-selected', value);
    }

    function filterItem() {
      var value = textInput ? el.value : el.innerHTML;
      if (filter(value, suggestion)) {
        li.className = li.className.replace(/ tac-hide/g, '');
      } else {
        crossvent.fabricate(li, 'autocomplete-hide');
      }
    }

    function hideItem() {
      if (!hidden(li)) {
        li.className += ' tac-hide';
        if (selection === li) {
          unselect();
        }
      }
    }
  }

  function set(value) {
    if (o.anchor) {
      return (isText() ? api.appendText : api.appendHTML)(value);
    }
    userSet(value);
  }

  function filter(value, suggestion) {
    if (o.anchor) {
      var il = (isText() ? api.filterAnchoredText : api.filterAnchoredHTML)(value, suggestion);
      return il ? userFilter(il.input, il.suggestion) : false;
    }
    return userFilter(value, suggestion);
  }

  function isText() {
    return isInput(attachment);
  }
  function visible() {
    return ul.className.indexOf('tac-show') !== -1;
  }
  function hidden(li) {
    return li.className.indexOf('tac-hide') !== -1;
  }

  function show() {
    if (!visible()) {
      ul.className += ' tac-show';
      eye.refresh();
      crossvent.fabricate(attachment, 'autocomplete-show');
    }
  }

  function toggler(e) {
    var left = e.which === 1 && !e.metaKey && !e.ctrlKey;
    if (left === false) {
      return; // we only care about honest to god left-clicks
    }
    toggle();
  }

  function toggle() {
    if (!visible()) {
      show();
    } else {
      hide();
    }
  }

  function select(suggestion) {
    unselect();
    if (suggestion) {
      selection = suggestion;
      selection.className += ' tac-selected';
    }
  }

  function unselect() {
    if (selection) {
      selection.className = selection.className.replace(/ tac-selected/g, '');
      selection = null;
    }
  }

  function move(up, moves) {
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

  function hide() {
    eye.sleep();
    ul.className = ul.className.replace(/ tac-show/g, '');
    unselect();
    crossvent.fabricate(attachment, 'autocomplete-hide');
  }

  function keydown(e) {
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

  function stop(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function filtering() {
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

  function deferredFilteringNoEnter(e) {
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    deferredFiltering();
  }

  function deferredShow(e) {
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    setTimeout(show, 0);
  }

  function autocompleteEventTarget(e) {
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

  function hideOnBlur(e) {
    var which = e.which || e.keyCode;
    if (which === KEY_TAB) {
      hide();
    }
  }

  function hideOnClick(e) {
    if (autocompleteEventTarget(e)) {
      return;
    }
    hide();
  }

  function inputEvents(remove) {
    var op = remove ? 'remove' : 'add';
    if (eye) {
      eye.destroy();
      eye = null;
    }
    if (!remove) {
      eye = bullseye(ul, attachment, { caret: anyInput && attachment.tagName !== 'INPUT' });
      if (!visible()) {
        eye.sleep();
      }
    }
    if (remove || anyInput && doc.activeElement !== attachment) {
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
      if (o.autoHideOnBlur) {
        crossvent[op](attachment, 'keydown', hideOnBlur);
      }
    } else {
      crossvent[op](attachment, 'click', toggler);
      crossvent[op](docElement, 'keydown', keydown);
    }
    if (o.autoHideOnClick) {
      crossvent[op](doc, 'click', hideOnClick);
    }
    if (form) {
      crossvent[op](form, 'submit', hide);
    }
  }

  function destroy() {
    inputEvents(true);
    if (parent.contains(ul)) {
      parent.removeChild(ul);
    }
  }

  function defaultSetter(value) {
    if (textInput) {
      el.value = value;
    } else {
      el.innerHTML = value;
    }
  }

  function defaultRenderer(li, suggestion) {
    li.innerText = li.textContent = getText(suggestion);
  }

  function defaultFilter(q, suggestion) {
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

  function loopbackToAnchor(text, p) {
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

  function filterAnchoredText(q, suggestion) {
    var position = sell(el);
    var input = loopbackToAnchor(q, position).text;
    if (input) {
      return { input: input, suggestion: suggestion };
    }
  }

  function appendText(value) {
    var current = el.value;
    var position = sell(el);
    var input = loopbackToAnchor(current, position);
    var left = current.substr(0, input.start);
    var right = current.substr(input.start + input.text.length + (position.end - position.start));
    var before = left + value + ' ';

    el.value = before + right;
    sell(el, { start: before.length, end: before.length });
  }

  function filterAnchoredHTML() {
    throw new Error('Anchoring in editable elements is disabled by default.');
  }

  function appendHTML() {
    throw new Error('Anchoring in editable elements is disabled by default.');
  }
}

function isInput(el) {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function tag(type, className) {
  var el = doc.createElement(type);
  el.className = className;
  return el;
}

function defer(fn) {
  return function () {
    setTimeout(fn, 0);
  };
}

function isEditable(el) {
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

module.exports = autocomplete;

},{"bullseye":1,"crossvent":13,"fuzzysearch":15,"sell":16}],18:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var dom = require('./dom');
var text = require('./text');
var props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent', 'webkitBoxSizing', 'mozBoxSizing', 'boxSizing', 'padding', 'border'];
var offset = 20;

module.exports = function factory(el) {
  var mirror = dom('span');

  document.body.appendChild(mirror);
  remap();
  bind();

  return {
    remap: remap,
    refresh: refresh,
    destroy: destroy
  };

  function remap() {
    var c = computed();
    var value;
    var i;
    for (i = 0; i < props.length; i++) {
      value = c[props[i]];
      if (value !== void 0 && value !== null) {
        // otherwise IE blows up
        mirror.style[props[i]] = value;
      }
    }
    mirror.disabled = 'disabled';
    mirror.style.whiteSpace = 'pre';
    mirror.style.position = 'absolute';
    mirror.style.top = mirror.style.left = '-9999em';
  }

  function refresh() {
    var value = el.value;
    if (value === mirror.value) {
      return;
    }

    text(mirror, value);

    var width = mirror.offsetWidth + offset;

    el.style.width = width + 'px';
  }

  function bind(remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', refresh);
    crossvent[op](el, 'keyup', refresh);
    crossvent[op](el, 'input', refresh);
    crossvent[op](el, 'paste', refresh);
    crossvent[op](el, 'change', refresh);
  }

  function destroy() {
    bind(true);
    mirror.parentElement.removeChild(mirror);
    el.style.width = '';
  }

  function computed() {
    if (window.getComputedStyle) {
      return window.getComputedStyle(el);
    }
    return el.currentStyle;
  }
};

},{"./dom":19,"./text":22,"crossvent":13}],19:[function(require,module,exports){
'use strict';

module.exports = function dom(tagName, classes) {
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

function easyGet(el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function hardGet(el) {
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

  function result(start, end) {
    if (active !== el) {
      // don't disrupt pre-existing state
      if (active) {
        active.focus();
      } else {
        el.blur();
      }
    }
    return { start: start, end: end };
  }
}

function getUniqueMarker(contents) {
  var marker;
  do {
    marker = '@@marker.' + Math.random() * new Date();
  } while (contents.indexOf(marker) !== -1);
  return marker;
}

function inputs(el) {
  return inputTag.test(el.tagName) && el.type === 'text' || textareaTag.test(el.tagName);
}

function easySet(el, p) {
  el.selectionStart = special(el, p.start);
  el.selectionEnd = special(el, p.end);
}

function hardSet(el, p) {
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

function special(el, value) {
  return value === 'end' ? el.value.length : value || 0;
}

function selection(el, p) {
  if (arguments.length === 2) {
    set(el, p);
  }
  return get(el);
}

module.exports = selection;

},{}],21:[function(require,module,exports){
'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var crossvent = require('crossvent');
var dom = require('./dom');
var text = require('./text');
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
var sinkableKeys = [END, HOME, LEFT, RIGHT];
var tagClass = /\btay-tag\b/;
var tagRemovalClass = /\btay-tag-remove\b/;
var editorClass = /\btay-editor\b/g;
var inputClass = /\btay-input\b/g;
var end = { start: 'end', end: 'end' };
var defaultDelimiter = ' ';

function taggy(el, options) {
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

  var toItemData = defaultToItemData;

  var parseText = o.parseText;
  var parseValue = o.parseValue;
  var getText = typeof parseText === 'string' ? function (d) {
    return d[parseText];
  } : typeof parseText === 'function' ? parseText : function (d) {
    return d;
  };
  var getValue = typeof parseValue === 'string' ? function (d) {
    return d[parseValue];
  } : typeof parseValue === 'function' ? parseValue : function (d) {
    return d;
  };

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
    addItem: addItem,
    removeItem: removeItem,
    value: readValue,
    destroy: destroy
  };

  evaluate([delimiter], true);
  _noselect = false;

  return api;

  function findItem(data) {
    for (var i = 0; i < currentValues.length; i++) {
      if (currentValues[i].data === data) {
        return currentValues[i];
      }
    }
    return null;
  }

  function addItem(data) {
    var item = { data: data, valid: true };
    var el = renderItem(item);
    if (!el) {
      return api;
    }
    item.el = el;
    currentValues.push(item);
    return api;
  }

  function removeItem(data) {
    var item = findItem(data);
    if (item) {
      removeItemElement(item.el);
      currentValues.splice(currentValues.indexOf(item), 1);
    }
    return api;
  }

  function renderItem(item) {
    return createTag(before, item);
  }

  function removeItemElement(el) {
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
  }

  function createTag(buffer, item) {
    var data = item.data;

    var empty = typeof data === 'string' && data.trim().length === 0;
    if (empty) {
      return null;
    }
    var el = dom('span', 'tay-tag');
    render(el, item);
    if (o.deletion) {
      el.appendChild(dom('span', 'tay-tag-remove'));
    }
    buffer.appendChild(el);
    return el;
  }

  function defaultToItemData(s) {
    return s;
  }

  function readValue() {
    return currentValues.filter(function (v) {
      return v.valid;
    }).map(function (v) {
      return v.data;
    });
  }

  function createAutocomplete() {
    var completer = autocomplete(el, {
      suggestions: o.autocomplete,
      getText: getText,
      getValue: getValue,
      set: function set(s) {
        el.value = '';
        addItem(s);
      }
    });
    return completer;
  }

  function bind(remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', keydown);
    crossvent[op](el, 'keypress', keypress);
    crossvent[op](el, 'paste', paste);
    crossvent[op](parent, 'click', click);
    if (convertOnFocus) {
      crossvent[op](document.documentElement, 'focus', documentfocus, true);
    }
  }

  function destroy() {
    bind(true);
    if (completer) {
      completer.destroy();
    }
    el.value = '';
    el.className = el.className.replace(inputClass, '');
    parent.className = parent.className.replace(editorClass, '');
    if (before.parentElement) {
      before.parentElement.removeChild(before);
    }
    if (after.parentElement) {
      after.parentElement.removeChild(after);
    }
    shrinker.destroy();
    api.destroyed = true;
    api.destroy = api.addItem = api.removeItem = function () {
      return api;
    };
    api.tags = api.value = function () {
      return null;
    };
    return api;
  }

  function documentfocus(e) {
    if (e.target !== el) {
      _noselect = true;
      convert(true);
      _noselect = false;
    }
  }

  function click(e) {
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
    if (tagged && free) {
      focusTag(top, end);
    } else if (target !== el) {
      shift();
      el.focus();
    }
  }

  function shift() {
    focusTag(after.lastChild, end);
    evaluate([delimiter], true);
  }

  function convert(all) {
    evaluate([delimiter], all);
    if (all) {
      each(after, moveLeft);
    }
    crossvent.fabricate(el, 'taggy-converted');
    return api;
  }

  function moveLeft(value, tag) {
    before.appendChild(tag);
  }

  function keydown(e) {
    var sel = selection(el);
    var key = e.which || e.keyCode || e.charCode;
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
      } else if (key === LEFT && sel.start === 0 && before.lastChild) {
        focusTag(before.lastChild, end);
      } else if (key === BACKSPACE && sel.start === 0 && (sel.end === 0 || sel.end !== el.value.length) && before.lastChild) {
        focusTag(before.lastChild, end);
      } else if (key === RIGHT && sel.end === el.value.length && after.firstChild) {
        focusTag(after.firstChild, {});
      } else {
        return;
      }
    } else {
      if (key === BACKSPACE && sel.start === 0 && (sel.end === 0 || sel.end !== el.value.length) && before.lastChild) {
        before.removeChild(before.lastChild);
      } else if (sinkableKeys.indexOf(key) !== -1) {
        // just prevent default
      } else {
          return;
        }
    }

    e.preventDefault();
    return false;
  }

  function keypress(e) {
    var key = e.which || e.keyCode || e.charCode;
    if (String.fromCharCode(key) === delimiter) {
      convert();
      e.preventDefault();
      return false;
    }
  }

  function paste() {
    setTimeout(function () {
      return evaluate();
    }, 0);
  }

  function evaluate(extras, entirely) {
    var p = selection(el);
    var len = entirely ? Infinity : p.start;
    var tags = el.value.slice(0, len).concat(extras || []).split(delimiter);
    if (tags.length < 1 || !free) {
      return;
    }

    var rest = tags.pop() + el.value.slice(len);
    var removal = tags.join(delimiter).length;

    tags.forEach(function (tag) {
      return addItem(toItemData(tag));
    });
    cleanup();
    el.value = rest;
    p.start -= removal;
    p.end -= removal;
    if (_noselect !== true) {
      selection(el, p);
    }
    shrinker.refresh();
    crossvent.fabricate(el, 'taggy-evaluated');
  }

  function cleanup() {
    var tags = [];

    each(before, detect);
    each(after, detect);

    function detect(value, tagElement) {
      if (validate(value, tags.slice())) {
        tags.push(value);
      } else if (o.preventDuplicates) {
        tagElement.parentElement.removeChild(tagElement);
      } else {
        tagElement.classList.add('tay-duplicate');
      }
    }
  }

  function defaultRenderer(container, item) {
    text(container, getText(item.data));
  }

  function defaultReader(tag) {
    return text(tag);
  }

  function focusTag(tag, p) {
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

  function hasSiblings() {
    var children = el.parentElement.children;
    return [].concat(_toConsumableArray(children)).some(function (s) {
      return s !== el && s.nodeType === ELEMENT;
    });
  }

  function each(container, fn) {
    [].concat(_toConsumableArray(container.children)).forEach(function (tag, i) {
      return fn(readTag(tag), tag, i);
    });
  }

  function defaultValidate(value, tags) {
    return tags.indexOf(value) === -1;
  }
}

module.exports = taggy;

},{"./autocomplete":17,"./autosize":18,"./dom":19,"./selection":20,"./text":22,"crossvent":13}],22:[function(require,module,exports){
'use strict';

function text(el, value) {
  if (arguments.length === 2) {
    el.innerText = el.textContent = value;
  }
  if (typeof el.innerText === 'string') {
    return el.innerText;
  }
  return el.textContent;
}

module.exports = text;

},{}]},{},[21])(21)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvbm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2Z1enp5c2VhcmNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NlbGwvc2VsbC5qcyIsInNyYy9hdXRvY29tcGxldGUuanMiLCJzcmMvYXV0b3NpemUuanMiLCJzcmMvZG9tLmpzIiwic3JjL3NlbGVjdGlvbi5qcyIsInNyYy90YWdneS5qcyIsInNyYy90ZXh0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0EsWUFBWSxDQUFDOztBQUViLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMzQixJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDckMsSUFBSSxRQUFRLEdBQUcsT0FB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QUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7S0FBQSxDQUFDLENBQUM7R0FDdkU7O0FBRUQsV0FBUyxlQUFlLENBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtBQUNyQyxXQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7R0FDbkM7Q0FDRjs7QUFFRCxNQUFNLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQzs7O0FDN1d2QixZQUFZLENBQUM7O0FBRWIsU0FBUyxJQUFJLENBQUUsRUFBRSxFQUFFLEtBQUssRUFBRTtBQUN4QixNQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLE1BQUUsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7R0FDdkM7QUFDRCxNQUFJLE9BQU8sRUFBRSxDQUFDLFNBQVMsS0FBSyxRQUFRLEVBQUU7QUFDcEMsV0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDO0dBQ3JCO0FBQ0QsU0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDO0NBQ3ZCOztBQUVELE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIHRhaWxvcm1hZGUgPSByZXF1aXJlKCcuL3RhaWxvcm1hZGUnKTtcblxuZnVuY3Rpb24gYnVsbHNleWUgKGVsLCB0YXJnZXQsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zO1xuICB2YXIgZG9tVGFyZ2V0ID0gdGFyZ2V0ICYmIHRhcmdldC50YWdOYW1lO1xuXG4gIGlmICghZG9tVGFyZ2V0ICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBvID0gdGFyZ2V0O1xuICB9XG4gIGlmICghZG9tVGFyZ2V0KSB7XG4gICAgdGFyZ2V0ID0gZWw7XG4gIH1cbiAgaWYgKCFvKSB7IG8gPSB7fTsgfVxuXG4gIHZhciBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgdmFyIHRocm90dGxlZFdyaXRlID0gdGhyb3R0bGUod3JpdGUsIDMwKTtcbiAgdmFyIHRhaWxvck9wdGlvbnMgPSB7IHVwZGF0ZTogby5hdXRvdXBkYXRlVG9DYXJldCAhPT0gZmFsc2UgJiYgdXBkYXRlIH07XG4gIHZhciB0YWlsb3IgPSBvLmNhcmV0ICYmIHRhaWxvcm1hZGUodGFyZ2V0LCB0YWlsb3JPcHRpb25zKTtcblxuICB3cml0ZSgpO1xuXG4gIGlmIChvLnRyYWNraW5nICE9PSBmYWxzZSkge1xuICAgIGNyb3NzdmVudC5hZGQod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkTnVsbCxcbiAgICByZWZyZXNoOiB3cml0ZSxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHNsZWVwOiBzbGVlcFxuICB9O1xuXG4gIGZ1bmN0aW9uIHNsZWVwICgpIHtcbiAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROdWxsICgpIHsgcmV0dXJuIHJlYWQoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKHJlYWRpbmdzKSB7XG4gICAgdmFyIGJvdW5kcyA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICBpZiAodGFpbG9yKSB7XG4gICAgICByZWFkaW5ncyA9IHRhaWxvci5yZWFkKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLmxlZnQpICsgcmVhZGluZ3MueCxcbiAgICAgICAgeTogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy50b3ApICsgc2Nyb2xsVG9wICsgcmVhZGluZ3MueSArIDIwXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgeDogYm91bmRzLmxlZnQsXG4gICAgICB5OiBib3VuZHMudG9wICsgc2Nyb2xsVG9wXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZSAocmVhZGluZ3MpIHtcbiAgICB3cml0ZShyZWFkaW5ncyk7XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAocmVhZGluZ3MpIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1bGxzZXllIGNhblxcJ3QgcmVmcmVzaCBhZnRlciBiZWluZyBkZXN0cm95ZWQuIENyZWF0ZSBhbm90aGVyIGluc3RhbmNlIGluc3RlYWQuJyk7XG4gICAgfVxuICAgIGlmICh0YWlsb3IgJiYgIXJlYWRpbmdzKSB7XG4gICAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gZmFsc2U7XG4gICAgICB0YWlsb3IucmVmcmVzaCgpOyByZXR1cm47XG4gICAgfVxuICAgIHZhciBwID0gcmVhZChyZWFkaW5ncyk7XG4gICAgaWYgKCF0YWlsb3IgJiYgdGFyZ2V0ICE9PSBlbCkge1xuICAgICAgcC55ICs9IHRhcmdldC5vZmZzZXRIZWlnaHQ7XG4gICAgfVxuICAgIGVsLnN0eWxlLmxlZnQgPSBwLnggKyAncHgnO1xuICAgIGVsLnN0eWxlLnRvcCA9IHAueSArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpZiAodGFpbG9yKSB7IHRhaWxvci5kZXN0cm95KCk7IH1cbiAgICBjcm9zc3ZlbnQucmVtb3ZlKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVsbHNleWU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb247XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGdldFNlbGVjdGlvblJhdyA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uUmF3Jyk7XG52YXIgZ2V0U2VsZWN0aW9uTnVsbE9wID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25OdWxsT3AnKTtcbnZhciBnZXRTZWxlY3Rpb25TeW50aGV0aWMgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblN5bnRoZXRpYycpO1xudmFyIGlzSG9zdCA9IHJlcXVpcmUoJy4vaXNIb3N0Jyk7XG5pZiAoaXNIb3N0Lm1ldGhvZChnbG9iYWwsICdnZXRTZWxlY3Rpb24nKSkge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25SYXc7XG59IGVsc2UgaWYgKHR5cGVvZiBkb2Muc2VsZWN0aW9uID09PSAnb2JqZWN0JyAmJiBkb2Muc2VsZWN0aW9uKSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvblN5bnRoZXRpYztcbn0gZWxzZSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvbk51bGxPcDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AgKCkge31cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uTnVsbE9wICgpIHtcbiAgcmV0dXJuIHtcbiAgICByZW1vdmVBbGxSYW5nZXM6IG5vb3AsXG4gICAgYWRkUmFuZ2U6IG5vb3BcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvblJhdyAoKSB7XG4gIHJldHVybiBnbG9iYWwuZ2V0U2VsZWN0aW9uKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uUmF3O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBib2R5ID0gZG9jLmJvZHk7XG52YXIgR2V0U2VsZWN0aW9uUHJvdG8gPSBHZXRTZWxlY3Rpb24ucHJvdG90eXBlO1xuXG5mdW5jdGlvbiBHZXRTZWxlY3Rpb24gKHNlbGVjdGlvbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciByYW5nZSA9IHNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuXG4gIHRoaXMuX3NlbGVjdGlvbiA9IHNlbGVjdGlvbjtcbiAgdGhpcy5fcmFuZ2VzID0gW107XG5cbiAgaWYgKHNlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbGYpO1xuICB9IGVsc2UgaWYgKGlzVGV4dFJhbmdlKHJhbmdlKSkge1xuICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsZiwgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbGYpO1xuICB9XG59XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZUFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHRleHRSYW5nZTtcbiAgdHJ5IHtcbiAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdOb25lJykge1xuICAgICAgdGV4dFJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgIHRleHRSYW5nZS5zZWxlY3QoKTtcbiAgICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uYWRkUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShyYW5nZSkuc2VsZWN0KCk7XG4gICAgdGhpcy5fcmFuZ2VzWzBdID0gcmFuZ2U7XG4gICAgdGhpcy5yYW5nZUNvdW50ID0gMTtcbiAgICB0aGlzLmlzQ29sbGFwc2VkID0gdGhpcy5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSh0aGlzLCByYW5nZSwgZmFsc2UpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRSYW5nZXMgPSBmdW5jdGlvbiAocmFuZ2VzKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHZhciByYW5nZUNvdW50ID0gcmFuZ2VzLmxlbmd0aDtcbiAgaWYgKHJhbmdlQ291bnQgPiAxKSB7XG4gICAgY3JlYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZXMpO1xuICB9IGVsc2UgaWYgKHJhbmdlQ291bnQpIHtcbiAgICB0aGlzLmFkZFJhbmdlKHJhbmdlc1swXSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldFJhbmdlQXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgaWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLnJhbmdlQ291bnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFJhbmdlQXQoKTogaW5kZXggb3V0IG9mIGJvdW5kcycpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9yYW5nZXNbaW5kZXhdLmNsb25lUmFuZ2UoKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnQ29udHJvbCcpIHtcbiAgICByZW1vdmVSYW5nZU1hbnVhbGx5KHRoaXMsIHJhbmdlKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHRoaXMuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICB2YXIgZWw7XG4gIHZhciByZW1vdmVkID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGNvbnRyb2xSYW5nZS5pdGVtKGkpO1xuICAgIGlmIChlbCAhPT0gcmFuZ2VFbGVtZW50IHx8IHJlbW92ZWQpIHtcbiAgICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZWFjaFJhbmdlID0gZnVuY3Rpb24gKGZuLCByZXR1cm5WYWx1ZSkge1xuICB2YXIgaSA9IDA7XG4gIHZhciBsZW4gPSB0aGlzLl9yYW5nZXMubGVuZ3RoO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoZm4odGhpcy5nZXRSYW5nZUF0KGkpKSkge1xuICAgICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICAgIH1cbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0QWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmFuZ2VzID0gW107XG4gIHRoaXMuZWFjaFJhbmdlKGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJhbmdlcy5wdXNoKHJhbmdlKTtcbiAgfSk7XG4gIHJldHVybiByYW5nZXM7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRTaW5nbGVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB0aGlzLmFkZFJhbmdlKHJhbmdlKTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2VzKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgZWwsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZXNbaV0pO1xuICAgIHRyeSB7XG4gICAgICBjb250cm9sUmFuZ2UuYWRkKGVsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFJhbmdlcygpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICAgIH1cbiAgfVxuICBjb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUmFuZ2VNYW51YWxseSAoc2VsLCByYW5nZSkge1xuICB2YXIgcmFuZ2VzID0gc2VsLmdldEFsbFJhbmdlcygpO1xuICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzU2FtZVJhbmdlKHJhbmdlLCByYW5nZXNbaV0pKSB7XG4gICAgICBzZWwuYWRkUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFzZWwucmFuZ2VDb3VudCkge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGFuY2hvclByZWZpeCA9ICdzdGFydCc7XG4gIHZhciBmb2N1c1ByZWZpeCA9ICdlbmQnO1xuICBzZWwuYW5jaG9yTm9kZSA9IHJhbmdlW2FuY2hvclByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHJhbmdlW2FuY2hvclByZWZpeCArICdPZmZzZXQnXTtcbiAgc2VsLmZvY3VzTm9kZSA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuZm9jdXNPZmZzZXQgPSByYW5nZVtmb2N1c1ByZWZpeCArICdPZmZzZXQnXTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRW1wdHlTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuYW5jaG9yTm9kZSA9IHNlbC5mb2N1c05vZGUgPSBudWxsO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gc2VsLmZvY3VzT2Zmc2V0ID0gMDtcbiAgc2VsLnJhbmdlQ291bnQgPSAwO1xuICBzZWwuaXNDb2xsYXBzZWQgPSB0cnVlO1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xufVxuXG5mdW5jdGlvbiByYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudCAocmFuZ2VOb2Rlcykge1xuICBpZiAoIXJhbmdlTm9kZXMubGVuZ3RoIHx8IHJhbmdlTm9kZXNbMF0ubm9kZVR5cGUgIT09IDEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDEsIGxlbiA9IHJhbmdlTm9kZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzQW5jZXN0b3JPZihyYW5nZU5vZGVzWzBdLCByYW5nZU5vZGVzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSAocmFuZ2UpIHtcbiAgdmFyIG5vZGVzID0gcmFuZ2UuZ2V0Tm9kZXMoKTtcbiAgaWYgKCFyYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudChub2RlcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UoKTogcmFuZ2UgZGlkIG5vdCBjb25zaXN0IG9mIGEgc2luZ2xlIGVsZW1lbnQnKTtcbiAgfVxuICByZXR1cm4gbm9kZXNbMF07XG59XG5cbmZ1bmN0aW9uIGlzVGV4dFJhbmdlIChyYW5nZSkge1xuICByZXR1cm4gcmFuZ2UgJiYgcmFuZ2UudGV4dCAhPT0gdm9pZCAwO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGcm9tVGV4dFJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHNlbC5fcmFuZ2VzID0gW3JhbmdlXTtcbiAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCByYW5nZSwgZmFsc2UpO1xuICBzZWwucmFuZ2VDb3VudCA9IDE7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHJhbmdlLmNvbGxhcHNlZDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG4gIGlmIChzZWwuX3NlbGVjdGlvbi50eXBlID09PSAnTm9uZScpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICAgIGlmIChpc1RleHRSYW5nZShjb250cm9sUmFuZ2UpKSB7XG4gICAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbCwgY29udHJvbFJhbmdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsLnJhbmdlQ291bnQgPSBjb250cm9sUmFuZ2UubGVuZ3RoO1xuICAgICAgdmFyIHJhbmdlO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWwucmFuZ2VDb3VudDsgKytpKSB7XG4gICAgICAgIHJhbmdlID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGUoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgICAgICBzZWwuX3Jhbmdlcy5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICAgIHNlbC5pc0NvbGxhcHNlZCA9IHNlbC5yYW5nZUNvdW50ID09PSAxICYmIHNlbC5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgc2VsLl9yYW5nZXNbc2VsLnJhbmdlQ291bnQgLSAxXSwgZmFsc2UpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZSkge1xuICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICB9XG4gIHRyeSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChyYW5nZUVsZW1lbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhZGRSYW5nZSgpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiBpc1NhbWVSYW5nZSAobGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIChcbiAgICBsZWZ0LnN0YXJ0Q29udGFpbmVyID09PSByaWdodC5zdGFydENvbnRhaW5lciAmJlxuICAgIGxlZnQuc3RhcnRPZmZzZXQgPT09IHJpZ2h0LnN0YXJ0T2Zmc2V0ICYmXG4gICAgbGVmdC5lbmRDb250YWluZXIgPT09IHJpZ2h0LmVuZENvbnRhaW5lciAmJlxuICAgIGxlZnQuZW5kT2Zmc2V0ID09PSByaWdodC5lbmRPZmZzZXRcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNBbmNlc3Rvck9mIChhbmNlc3RvciwgZGVzY2VuZGFudCkge1xuICB2YXIgbm9kZSA9IGRlc2NlbmRhbnQ7XG4gIHdoaWxlIChub2RlLnBhcmVudE5vZGUpIHtcbiAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBhbmNlc3Rvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb24gKCkge1xuICByZXR1cm4gbmV3IEdldFNlbGVjdGlvbihnbG9iYWwuZG9jdW1lbnQuc2VsZWN0aW9uKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzSG9zdE1ldGhvZCAoaG9zdCwgcHJvcCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBob3N0W3Byb3BdO1xuICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCAhISh0eXBlID09PSAnb2JqZWN0JyAmJiBob3N0W3Byb3BdKSB8fCB0eXBlID09PSAndW5rbm93bic7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdFByb3BlcnR5IChob3N0LCBwcm9wKSB7XG4gIHJldHVybiB0eXBlb2YgaG9zdFtwcm9wXSAhPT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBhcmVIb3N0ZWQgKGhvc3QsIHByb3BzKSB7XG4gICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKCFmbihob3N0LCBwcm9wc1tpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGhvZDogaXNIb3N0TWV0aG9kLFxuICBtZXRob2RzOiBtYW55KGlzSG9zdE1ldGhvZCksXG4gIHByb3BlcnR5OiBpc0hvc3RQcm9wZXJ0eSxcbiAgcHJvcGVydGllczogbWFueShpc0hvc3RQcm9wZXJ0eSlcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xuXG5mdW5jdGlvbiByYW5nZVRvVGV4dFJhbmdlIChwKSB7XG4gIGlmIChwLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgfVxuICB2YXIgc3RhcnRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB2YXIgZW5kUmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuZW5kQ29udGFpbmVyLCBvZmZzZXQ6IHAuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgc2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9zZXRTZWxlY3Rpb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldDogZ2V0U2VsZWN0aW9uLFxuICBzZXQ6IHNldFNlbGVjdGlvblxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gc2V0U2VsZWN0aW9uIChwKSB7XG4gIGlmIChkb2MuY3JlYXRlUmFuZ2UpIHtcbiAgICBtb2Rlcm5TZWxlY3Rpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBvbGRTZWxlY3Rpb24oKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vZGVyblNlbGVjdGlvbiAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIHZhciByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgIGlmICghcC5zdGFydENvbnRhaW5lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAocC5lbmRDb250YWluZXIpIHtcbiAgICAgIHJhbmdlLnNldEVuZChwLmVuZENvbnRhaW5lciwgcC5lbmRPZmZzZXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgfVxuICAgIHJhbmdlLnNldFN0YXJ0KHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICBzZWwuYWRkUmFuZ2UocmFuZ2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gb2xkU2VsZWN0aW9uICgpIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHApLnNlbGVjdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2VsbCA9IHJlcXVpcmUoJ3NlbGwnKTtcbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBzZWxlY2Npb24gPSByZXF1aXJlKCdzZWxlY2Npb24nKTtcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJy4vdGhyb3R0bGUnKTtcbnZhciBnZXRTZWxlY3Rpb24gPSBzZWxlY2Npb24uZ2V0O1xudmFyIHByb3BzID0gW1xuICAnZGlyZWN0aW9uJyxcbiAgJ2JveFNpemluZycsXG4gICd3aWR0aCcsXG4gICdoZWlnaHQnLFxuICAnb3ZlcmZsb3dYJyxcbiAgJ292ZXJmbG93WScsXG4gICdib3JkZXJUb3BXaWR0aCcsXG4gICdib3JkZXJSaWdodFdpZHRoJyxcbiAgJ2JvcmRlckJvdHRvbVdpZHRoJyxcbiAgJ2JvcmRlckxlZnRXaWR0aCcsXG4gICdwYWRkaW5nVG9wJyxcbiAgJ3BhZGRpbmdSaWdodCcsXG4gICdwYWRkaW5nQm90dG9tJyxcbiAgJ3BhZGRpbmdMZWZ0JyxcbiAgJ2ZvbnRTdHlsZScsXG4gICdmb250VmFyaWFudCcsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHJldGNoJyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRTaXplQWRqdXN0JyxcbiAgJ2xpbmVIZWlnaHQnLFxuICAnZm9udEZhbWlseScsXG4gICd0ZXh0QWxpZ24nLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3RleHREZWNvcmF0aW9uJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAnd29yZFNwYWNpbmcnXG5dO1xudmFyIHdpbiA9IGdsb2JhbDtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBmZiA9IHdpbi5tb3pJbm5lclNjcmVlblggIT09IG51bGwgJiYgd2luLm1veklubmVyU2NyZWVuWCAhPT0gdm9pZCAwO1xuXG5mdW5jdGlvbiB0YWlsb3JtYWRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGV4dElucHV0ID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnO1xuICB2YXIgdGhyb3R0bGVkUmVmcmVzaCA9IHRocm90dGxlKHJlZnJlc2gsIDMwKTtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuXG4gIGJpbmQoKTtcblxuICByZXR1cm4ge1xuICAgIHJlYWQ6IHJlYWRQb3NpdGlvbixcbiAgICByZWZyZXNoOiB0aHJvdHRsZWRSZWZyZXNoLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3lcbiAgfTtcblxuICBmdW5jdGlvbiBub29wICgpIHt9XG4gIGZ1bmN0aW9uIHJlYWRQb3NpdGlvbiAoKSB7IHJldHVybiAodGV4dElucHV0ID8gY29vcmRzVGV4dCA6IGNvb3Jkc0hUTUwpKCk7IH1cblxuICBmdW5jdGlvbiByZWZyZXNoICgpIHtcbiAgICBpZiAoby5zbGVlcGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXR1cm4gKG8udXBkYXRlIHx8IG5vb3ApKHJlYWRQb3NpdGlvbigpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc1RleHQgKCkge1xuICAgIHZhciBwID0gc2VsbChlbCk7XG4gICAgdmFyIGNvbnRleHQgPSBwcmVwYXJlKCk7XG4gICAgdmFyIHJlYWRpbmdzID0gcmVhZFRleHRDb29yZHMoY29udGV4dCwgcC5zdGFydCk7XG4gICAgZG9jLmJvZHkucmVtb3ZlQ2hpbGQoY29udGV4dC5taXJyb3IpO1xuICAgIHJldHVybiByZWFkaW5ncztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc0hUTUwgKCkge1xuICAgIHZhciBzZWwgPSBnZXRTZWxlY3Rpb24oKTtcbiAgICBpZiAoc2VsLnJhbmdlQ291bnQpIHtcbiAgICAgIHZhciByYW5nZSA9IHNlbC5nZXRSYW5nZUF0KDApO1xuICAgICAgdmFyIG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1ZyA9IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm5vZGVOYW1lID09PSAnUCcgJiYgcmFuZ2Uuc3RhcnRPZmZzZXQgPT09IDA7XG4gICAgICBpZiAobmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgeDogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0TGVmdCxcbiAgICAgICAgICB5OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRUb3AsXG4gICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZS5nZXRDbGllbnRSZWN0cykge1xuICAgICAgICB2YXIgcmVjdHMgPSByYW5nZS5nZXRDbGllbnRSZWN0cygpO1xuICAgICAgICBpZiAocmVjdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiByZWN0c1swXS5sZWZ0LFxuICAgICAgICAgICAgeTogcmVjdHNbMF0udG9wLFxuICAgICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHg6IDAsIHk6IDAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRUZXh0Q29vcmRzIChjb250ZXh0LCBwKSB7XG4gICAgdmFyIHJlc3QgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHZhciBtaXJyb3IgPSBjb250ZXh0Lm1pcnJvcjtcbiAgICB2YXIgY29tcHV0ZWQgPSBjb250ZXh0LmNvbXB1dGVkO1xuXG4gICAgd3JpdGUobWlycm9yLCByZWFkKGVsKS5zdWJzdHJpbmcoMCwgcCkpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgPT09ICdJTlBVVCcpIHtcbiAgICAgIG1pcnJvci50ZXh0Q29udGVudCA9IG1pcnJvci50ZXh0Q29udGVudC5yZXBsYWNlKC9cXHMvZywgJ1xcdTAwYTAnKTtcbiAgICB9XG5cbiAgICB3cml0ZShyZXN0LCByZWFkKGVsKS5zdWJzdHJpbmcocCkgfHwgJy4nKTtcblxuICAgIG1pcnJvci5hcHBlbmRDaGlsZChyZXN0KTtcblxuICAgIHJldHVybiB7XG4gICAgICB4OiByZXN0Lm9mZnNldExlZnQgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyTGVmdFdpZHRoJ10pLFxuICAgICAgeTogcmVzdC5vZmZzZXRUb3AgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyVG9wV2lkdGgnXSlcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoZWwpIHtcbiAgICByZXR1cm4gdGV4dElucHV0ID8gZWwudmFsdWUgOiBlbC5pbm5lckhUTUw7XG4gIH1cblxuICBmdW5jdGlvbiBwcmVwYXJlICgpIHtcbiAgICB2YXIgY29tcHV0ZWQgPSB3aW4uZ2V0Q29tcHV0ZWRTdHlsZSA/IGdldENvbXB1dGVkU3R5bGUoZWwpIDogZWwuY3VycmVudFN0eWxlO1xuICAgIHZhciBtaXJyb3IgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdmFyIHN0eWxlID0gbWlycm9yLnN0eWxlO1xuXG4gICAgZG9jLmJvZHkuYXBwZW5kQ2hpbGQobWlycm9yKTtcblxuICAgIGlmIChlbC50YWdOYW1lICE9PSAnSU5QVVQnKSB7XG4gICAgICBzdHlsZS53b3JkV3JhcCA9ICdicmVhay13b3JkJztcbiAgICB9XG4gICAgc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUtd3JhcCc7XG4gICAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICBwcm9wcy5mb3JFYWNoKGNvcHkpO1xuXG4gICAgaWYgKGZmKSB7XG4gICAgICBzdHlsZS53aWR0aCA9IHBhcnNlSW50KGNvbXB1dGVkLndpZHRoKSAtIDIgKyAncHgnO1xuICAgICAgaWYgKGVsLnNjcm9sbEhlaWdodCA+IHBhcnNlSW50KGNvbXB1dGVkLmhlaWdodCkpIHtcbiAgICAgICAgc3R5bGUub3ZlcmZsb3dZID0gJ3Njcm9sbCc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG4gICAgfVxuICAgIHJldHVybiB7IG1pcnJvcjogbWlycm9yLCBjb21wdXRlZDogY29tcHV0ZWQgfTtcblxuICAgIGZ1bmN0aW9uIGNvcHkgKHByb3ApIHtcbiAgICAgIHN0eWxlW3Byb3BdID0gY29tcHV0ZWRbcHJvcF07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKGVsLCB2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5dXAnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnaW5wdXQnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnY2hhbmdlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGFpbG9ybWFkZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gdGhyb3R0bGUgKGZuLCBib3VuZGFyeSkge1xuICB2YXIgbGFzdCA9IC1JbmZpbml0eTtcbiAgdmFyIHRpbWVyO1xuICByZXR1cm4gZnVuY3Rpb24gYm91bmNlZCAoKSB7XG4gICAgaWYgKHRpbWVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHVuYm91bmQoKTtcblxuICAgIGZ1bmN0aW9uIHVuYm91bmQgKCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgIHZhciBuZXh0ID0gbGFzdCArIGJvdW5kYXJ5O1xuICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XG4gICAgICBpZiAobm93ID4gbmV4dCkge1xuICAgICAgICBsYXN0ID0gbm93O1xuICAgICAgICBmbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KHVuYm91bmQsIG5leHQgLSBub3cpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0aHJvdHRsZTtcbiIsIlxudmFyIE5hdGl2ZUN1c3RvbUV2ZW50ID0gZ2xvYmFsLkN1c3RvbUV2ZW50O1xuXG5mdW5jdGlvbiB1c2VOYXRpdmUgKCkge1xuICB0cnkge1xuICAgIHZhciBwID0gbmV3IE5hdGl2ZUN1c3RvbUV2ZW50KCdjYXQnLCB7IGRldGFpbDogeyBmb286ICdiYXInIH0gfSk7XG4gICAgcmV0dXJuICAnY2F0JyA9PT0gcC50eXBlICYmICdiYXInID09PSBwLmRldGFpbC5mb287XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ3Jvc3MtYnJvd3NlciBgQ3VzdG9tRXZlbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DdXN0b21FdmVudC5DdXN0b21FdmVudFxuICpcbiAqIEBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHVzZU5hdGl2ZSgpID8gTmF0aXZlQ3VzdG9tRXZlbnQgOlxuXG4vLyBJRSA+PSA5XG4nZnVuY3Rpb24nID09PSB0eXBlb2YgZG9jdW1lbnQuY3JlYXRlRXZlbnQgPyBmdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwpO1xuICB9IGVsc2Uge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdm9pZCAwKTtcbiAgfVxuICByZXR1cm4gZTtcbn0gOlxuXG4vLyBJRSA8PSA4XG5mdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgZS50eXBlID0gdHlwZTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuYnViYmxlcyA9IEJvb2xlYW4ocGFyYW1zLmJ1YmJsZXMpO1xuICAgIGUuY2FuY2VsYWJsZSA9IEJvb2xlYW4ocGFyYW1zLmNhbmNlbGFibGUpO1xuICAgIGUuZGV0YWlsID0gcGFyYW1zLmRldGFpbDtcbiAgfSBlbHNlIHtcbiAgICBlLmJ1YmJsZXMgPSBmYWxzZTtcbiAgICBlLmNhbmNlbGFibGUgPSBmYWxzZTtcbiAgICBlLmRldGFpbCA9IHZvaWQgMDtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnY3VzdG9tLWV2ZW50Jyk7XG52YXIgZXZlbnRtYXAgPSByZXF1aXJlKCcuL2V2ZW50bWFwJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkRXZlbnQsXG4gIHJlbW92ZTogcmVtb3ZlRXZlbnQsXG4gIGZhYnJpY2F0ZTogZmFicmljYXRlRXZlbnRcbn07XG5cbmZ1bmN0aW9uIGFkZEV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgd3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGxpc3RlbmVyID0gdW53cmFwKGVsLCB0eXBlLCBmbik7XG4gIGlmIChsaXN0ZW5lcikge1xuICAgIHJldHVybiBlbC5kZXRhY2hFdmVudCgnb24nICsgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZhYnJpY2F0ZUV2ZW50IChlbCwgdHlwZSwgbW9kZWwpIHtcbiAgdmFyIGUgPSBldmVudG1hcC5pbmRleE9mKHR5cGUpID09PSAtMSA/IG1ha2VDdXN0b21FdmVudCgpIDogbWFrZUNsYXNzaWNFdmVudCgpO1xuICBpZiAoZWwuZGlzcGF0Y2hFdmVudCkge1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuZmlyZUV2ZW50KCdvbicgKyB0eXBlLCBlKTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ2xhc3NpY0V2ZW50ICgpIHtcbiAgICB2YXIgZTtcbiAgICBpZiAoZG9jLmNyZWF0ZUV2ZW50KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgZS5pbml0RXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChkb2MuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUN1c3RvbUV2ZW50ICgpIHtcbiAgICByZXR1cm4gbmV3IGN1c3RvbUV2ZW50KHR5cGUsIHsgZGV0YWlsOiBtb2RlbCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVyRmFjdG9yeSAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwcGVyIChvcmlnaW5hbEV2ZW50KSB7XG4gICAgdmFyIGUgPSBvcmlnaW5hbEV2ZW50IHx8IGdsb2JhbC5ldmVudDtcbiAgICBlLnRhcmdldCA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICBlLnByZXZlbnREZWZhdWx0ID0gZS5wcmV2ZW50RGVmYXVsdCB8fCBmdW5jdGlvbiBwcmV2ZW50RGVmYXVsdCAoKSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbiA9IGUuc3RvcFByb3BhZ2F0aW9uIHx8IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbiAoKSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfTtcbiAgICBlLndoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgZm4uY2FsbChlbCwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgd3JhcHBlciA9IHVud3JhcChlbCwgdHlwZSwgZm4pIHx8IHdyYXBwZXJGYWN0b3J5KGVsLCB0eXBlLCBmbik7XG4gIGhhcmRDYWNoZS5wdXNoKHtcbiAgICB3cmFwcGVyOiB3cmFwcGVyLFxuICAgIGVsZW1lbnQ6IGVsLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgZm46IGZuXG4gIH0pO1xuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuZnVuY3Rpb24gdW53cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGkgPSBmaW5kKGVsLCB0eXBlLCBmbik7XG4gIGlmIChpKSB7XG4gICAgdmFyIHdyYXBwZXIgPSBoYXJkQ2FjaGVbaV0ud3JhcHBlcjtcbiAgICBoYXJkQ2FjaGUuc3BsaWNlKGksIDEpOyAvLyBmcmVlIHVwIGEgdGFkIG9mIG1lbW9yeVxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSwgaXRlbTtcbiAgZm9yIChpID0gMDsgaSA8IGhhcmRDYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGl0ZW0gPSBoYXJkQ2FjaGVbaV07XG4gICAgaWYgKGl0ZW0uZWxlbWVudCA9PT0gZWwgJiYgaXRlbS50eXBlID09PSB0eXBlICYmIGl0ZW0uZm4gPT09IGZuKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50bWFwID0gW107XG52YXIgZXZlbnRuYW1lID0gJyc7XG52YXIgcm9uID0gL15vbi87XG5cbmZvciAoZXZlbnRuYW1lIGluIGdsb2JhbCkge1xuICBpZiAocm9uLnRlc3QoZXZlbnRuYW1lKSkge1xuICAgIGV2ZW50bWFwLnB1c2goZXZlbnRuYW1lLnNsaWNlKDIpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50bWFwO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmdXp6eXNlYXJjaCAobmVlZGxlLCBoYXlzdGFjaykge1xuICB2YXIgdGxlbiA9IGhheXN0YWNrLmxlbmd0aDtcbiAgdmFyIHFsZW4gPSBuZWVkbGUubGVuZ3RoO1xuICBpZiAocWxlbiA+IHRsZW4pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHFsZW4gPT09IHRsZW4pIHtcbiAgICByZXR1cm4gbmVlZGxlID09PSBoYXlzdGFjaztcbiAgfVxuICBvdXRlcjogZm9yICh2YXIgaSA9IDAsIGogPSAwOyBpIDwgcWxlbjsgaSsrKSB7XG4gICAgdmFyIG5jaCA9IG5lZWRsZS5jaGFyQ29kZUF0KGkpO1xuICAgIHdoaWxlIChqIDwgdGxlbikge1xuICAgICAgaWYgKGhheXN0YWNrLmNoYXJDb2RlQXQoaisrKSA9PT0gbmNoKSB7XG4gICAgICAgIGNvbnRpbnVlIG91dGVyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnV6enlzZWFyY2g7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXQgPSBlYXN5R2V0O1xudmFyIHNldCA9IGVhc3lTZXQ7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHBhcnNlKGVsLCBwLnN0YXJ0KTtcbiAgZWwuc2VsZWN0aW9uRW5kID0gcGFyc2UoZWwsIHAuZW5kKTtcbn1cblxuZnVuY3Rpb24gaGFyZFNldCAoZWwsIHApIHtcbiAgdmFyIHJhbmdlID0gZWwuY3JlYXRlVGV4dFJhbmdlKCk7XG5cbiAgaWYgKHAuc3RhcnQgPT09ICdlbmQnICYmIHAuZW5kID09PSAnZW5kJykge1xuICAgIHJhbmdlLmNvbGxhcHNlKGZhbHNlKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZS5jb2xsYXBzZSh0cnVlKTtcbiAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCBwYXJzZShlbCwgcC5lbmQpKTtcbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLnN0YXJ0KSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2UgKGVsLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09ICdlbmQnID8gZWwudmFsdWUubGVuZ3RoIDogdmFsdWUgfHwgMDtcbn1cblxuZnVuY3Rpb24gc2VsbCAoZWwsIHApIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBzZXQoZWwsIHApO1xuICB9XG4gIHJldHVybiBnZXQoZWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNlbGw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzZWxsID0gcmVxdWlyZSgnc2VsbCcpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGJ1bGxzZXllID0gcmVxdWlyZSgnYnVsbHNleWUnKTtcbnZhciBmdXp6eXNlYXJjaCA9IHJlcXVpcmUoJ2Z1enp5c2VhcmNoJyk7XG52YXIgS0VZX0JBQ0tTUEFDRSA9IDg7XG52YXIgS0VZX0VOVEVSID0gMTM7XG52YXIgS0VZX0VTQyA9IDI3O1xudmFyIEtFWV9VUCA9IDM4O1xudmFyIEtFWV9ET1dOID0gNDA7XG52YXIgS0VZX1RBQiA9IDk7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgZG9jRWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbmZ1bmN0aW9uIGF1dG9jb21wbGV0ZSAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgcGFyZW50ID0gby5hcHBlbmRUbyB8fCBkb2MuYm9keTtcbiAgdmFyIHJlbmRlciA9IG8ucmVuZGVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcbiAgdmFyIHtnZXRUZXh0LCBnZXRWYWx1ZSwgZm9ybSwgc3VnZ2VzdGlvbnN9ID0gbztcbiAgdmFyIGxpbWl0ID0gdHlwZW9mIG8ubGltaXQgPT09ICdudW1iZXInID8gby5saW1pdCA6IEluZmluaXR5O1xuICB2YXIgdXNlckZpbHRlciA9IG8uZmlsdGVyIHx8IGRlZmF1bHRGaWx0ZXI7XG4gIHZhciB1c2VyU2V0ID0gby5zZXQgfHwgZGVmYXVsdFNldHRlcjtcbiAgdmFyIHVsID0gdGFnKCd1bCcsICd0YWMtbGlzdCcpO1xuICB2YXIgc2VsZWN0aW9uID0gbnVsbDtcbiAgdmFyIGV5ZTtcbiAgdmFyIGRlZmVycmVkRmlsdGVyaW5nID0gZGVmZXIoZmlsdGVyaW5nKTtcbiAgdmFyIGF0dGFjaG1lbnQgPSBlbDtcbiAgdmFyIHRleHRJbnB1dDtcbiAgdmFyIGFueUlucHV0O1xuICB2YXIgcmFuY2hvcmxlZnQ7XG4gIHZhciByYW5jaG9ycmlnaHQ7XG4gIHZhciBzdWdnZXN0aW9uc0xvYWQgPSB7IGNvdW50ZXI6IDAsIHZhbHVlOiBudWxsIH07XG5cbiAgaWYgKG8uYXV0b0hpZGVPbkJsdXIgPT09IHZvaWQgMCkgeyBvLmF1dG9IaWRlT25CbHVyID0gdHJ1ZTsgfVxuICBpZiAoby5hdXRvSGlkZU9uQ2xpY2sgPT09IHZvaWQgMCkgeyBvLmF1dG9IaWRlT25DbGljayA9IHRydWU7IH1cbiAgaWYgKG8uYXV0b1Nob3dPblVwRG93biA9PT0gdm9pZCAwKSB7IG8uYXV0b1Nob3dPblVwRG93biA9IGVsLnRhZ05hbWUgPT09ICdJTlBVVCc7IH1cbiAgaWYgKG8uYW5jaG9yKSB7XG4gICAgcmFuY2hvcmxlZnQgPSBuZXcgUmVnRXhwKCdeJyArIG8uYW5jaG9yKTtcbiAgICByYW5jaG9ycmlnaHQgPSBuZXcgUmVnRXhwKG8uYW5jaG9yICsgJyQnKTtcbiAgfVxuXG4gIHZhciBhcGkgPSB7XG4gICAgYWRkLFxuICAgIGFuY2hvcjogby5hbmNob3IsXG4gICAgY2xlYXIsXG4gICAgc2hvdyxcbiAgICBoaWRlLFxuICAgIHRvZ2dsZSxcbiAgICBkZXN0cm95LFxuICAgIHJlZnJlc2hQb3NpdGlvbixcbiAgICBhcHBlbmRUZXh0LFxuICAgIGFwcGVuZEhUTUwsXG4gICAgZmlsdGVyQW5jaG9yZWRUZXh0LFxuICAgIGZpbHRlckFuY2hvcmVkSFRNTCxcbiAgICBkZWZhdWx0QXBwZW5kVGV4dDogYXBwZW5kVGV4dCxcbiAgICBkZWZhdWx0RmlsdGVyLFxuICAgIGRlZmF1bHRSZW5kZXJlcixcbiAgICBkZWZhdWx0U2V0dGVyLFxuICAgIHJldGFyZ2V0LFxuICAgIGF0dGFjaG1lbnQsXG4gICAgbGlzdDogdWwsXG4gICAgc3VnZ2VzdGlvbnM6IFtdXG4gIH07XG5cbiAgcmV0YXJnZXQoZWwpO1xuICBwYXJlbnQuYXBwZW5kQ2hpbGQodWwpO1xuICBlbC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShzdWdnZXN0aW9ucykpIHtcbiAgICBsb2FkZWQoc3VnZ2VzdGlvbnMsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gcmV0YXJnZXQgKGVsKSB7XG4gICAgaW5wdXRFdmVudHModHJ1ZSk7XG4gICAgYXR0YWNobWVudCA9IGFwaS5hdHRhY2htZW50ID0gZWw7XG4gICAgdGV4dElucHV0ID0gYXR0YWNobWVudC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGF0dGFjaG1lbnQudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgICBhbnlJbnB1dCA9IHRleHRJbnB1dCB8fCBpc0VkaXRhYmxlKGF0dGFjaG1lbnQpO1xuICAgIGlucHV0RXZlbnRzKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoUG9zaXRpb24gKCkge1xuICAgIGlmIChleWUpIHsgZXllLnJlZnJlc2goKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGluZyAoZm9yY2VTaG93KSB7XG4gICAgaWYgKHR5cGVvZiBzdWdnZXN0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY3Jvc3N2ZW50LnJlbW92ZShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICAgIHZhciB2YWx1ZSA9IHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICAgICAgaWYgKHZhbHVlICE9PSBzdWdnZXN0aW9uc0xvYWQudmFsdWUpIHtcbiAgICAgICAgc3VnZ2VzdGlvbnNMb2FkLmNvdW50ZXIrKztcbiAgICAgICAgc3VnZ2VzdGlvbnNMb2FkLnZhbHVlID0gdmFsdWU7XG5cbiAgICAgICAgdmFyIGNvdW50ZXIgPSBzdWdnZXN0aW9uc0xvYWQuY291bnRlcjtcbiAgICAgICAgc3VnZ2VzdGlvbnModmFsdWUsIGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICBpZiAoc3VnZ2VzdGlvbnNMb2FkLmNvdW50ZXIgPT09IGNvdW50ZXIpIHtcbiAgICAgICAgICAgIGxvYWRlZChzLCBmb3JjZVNob3cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGVkIChzdWdnZXN0aW9ucywgZm9yY2VTaG93KSB7XG4gICAgY2xlYXIoKTtcbiAgICBzdWdnZXN0aW9ucy5mb3JFYWNoKGFkZCk7XG4gICAgYXBpLnN1Z2dlc3Rpb25zID0gc3VnZ2VzdGlvbnM7XG4gICAgaWYgKGZvcmNlU2hvdykge1xuICAgICAgc2hvdygpO1xuICAgIH1cbiAgICBmaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgICB1bnNlbGVjdCgpO1xuICAgIHdoaWxlICh1bC5sYXN0Q2hpbGQpIHtcbiAgICAgIHVsLnJlbW92ZUNoaWxkKHVsLmxhc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkIChzdWdnZXN0aW9uKSB7XG4gICAgdmFyIGxpID0gdGFnKCdsaScsICd0YWMtaXRlbScpO1xuICAgIHJlbmRlcihsaSwgc3VnZ2VzdGlvbik7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2NsaWNrJywgY2xpY2tlZFN1Z2dlc3Rpb24pO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdhdXRvY29tcGxldGUtZmlsdGVyJywgZmlsdGVySXRlbSk7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJywgaGlkZUl0ZW0pO1xuICAgIHVsLmFwcGVuZENoaWxkKGxpKTtcbiAgICBhcGkuc3VnZ2VzdGlvbnMucHVzaChzdWdnZXN0aW9uKTtcbiAgICByZXR1cm4gbGk7XG5cbiAgICBmdW5jdGlvbiBjbGlja2VkU3VnZ2VzdGlvbiAoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBnZXRWYWx1ZShzdWdnZXN0aW9uKTtcbiAgICAgIHNldCh2YWx1ZSk7XG4gICAgICBoaWRlKCk7XG4gICAgICBhdHRhY2htZW50LmZvY3VzKCk7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtc2VsZWN0ZWQnLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVySXRlbSAoKSB7XG4gICAgICB2YXIgdmFsdWUgPSB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgICAgIGlmIChmaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSA9IGxpLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLWhpZGUvZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGlkZUl0ZW0gKCkge1xuICAgICAgaWYgKCFoaWRkZW4obGkpKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSArPSAnIHRhYy1oaWRlJztcbiAgICAgICAgaWYgKHNlbGVjdGlvbiA9PT0gbGkpIHtcbiAgICAgICAgICB1bnNlbGVjdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh2YWx1ZSkge1xuICAgIGlmIChvLmFuY2hvcikge1xuICAgICAgcmV0dXJuIChpc1RleHQoKSA/IGFwaS5hcHBlbmRUZXh0IDogYXBpLmFwcGVuZEhUTUwpKHZhbHVlKTtcbiAgICB9XG4gICAgdXNlclNldCh2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXIgKHZhbHVlLCBzdWdnZXN0aW9uKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICB2YXIgaWwgPSAoaXNUZXh0KCkgPyBhcGkuZmlsdGVyQW5jaG9yZWRUZXh0IDogYXBpLmZpbHRlckFuY2hvcmVkSFRNTCkodmFsdWUsIHN1Z2dlc3Rpb24pO1xuICAgICAgcmV0dXJuIGlsID8gdXNlckZpbHRlcihpbC5pbnB1dCwgaWwuc3VnZ2VzdGlvbikgOiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHVzZXJGaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNUZXh0ICgpIHsgcmV0dXJuIGlzSW5wdXQoYXR0YWNobWVudCk7IH1cbiAgZnVuY3Rpb24gdmlzaWJsZSAoKSB7IHJldHVybiB1bC5jbGFzc05hbWUuaW5kZXhPZigndGFjLXNob3cnKSAhPT0gLTE7IH1cbiAgZnVuY3Rpb24gaGlkZGVuIChsaSkgeyByZXR1cm4gbGkuY2xhc3NOYW1lLmluZGV4T2YoJ3RhYy1oaWRlJykgIT09IC0xOyB9XG5cbiAgZnVuY3Rpb24gc2hvdyAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHVsLmNsYXNzTmFtZSArPSAnIHRhYy1zaG93JztcbiAgICAgIGV5ZS5yZWZyZXNoKCk7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtc2hvdycpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZXIgKGUpIHtcbiAgICB2YXIgbGVmdCA9IGUud2hpY2ggPT09IDEgJiYgIWUubWV0YUtleSAmJiAhZS5jdHJsS2V5O1xuICAgIGlmIChsZWZ0ID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuOyAvLyB3ZSBvbmx5IGNhcmUgYWJvdXQgaG9uZXN0IHRvIGdvZCBsZWZ0LWNsaWNrc1xuICAgIH1cbiAgICB0b2dnbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZSAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHNob3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdCAoc3VnZ2VzdGlvbikge1xuICAgIHVuc2VsZWN0KCk7XG4gICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgIHNlbGVjdGlvbiA9IHN1Z2dlc3Rpb247XG4gICAgICBzZWxlY3Rpb24uY2xhc3NOYW1lICs9ICcgdGFjLXNlbGVjdGVkJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1bnNlbGVjdCAoKSB7XG4gICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgc2VsZWN0aW9uLmNsYXNzTmFtZSA9IHNlbGVjdGlvbi5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zZWxlY3RlZC9nLCAnJyk7XG4gICAgICBzZWxlY3Rpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmUgKHVwLCBtb3Zlcykge1xuICAgIHZhciB0b3RhbCA9IHVsLmNoaWxkcmVuLmxlbmd0aDtcbiAgICBpZiAodG90YWwgPCBtb3Zlcykge1xuICAgICAgdW5zZWxlY3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRvdGFsID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBmaXJzdCA9IHVwID8gJ2xhc3RDaGlsZCcgOiAnZmlyc3RDaGlsZCc7XG4gICAgdmFyIG5leHQgPSB1cCA/ICdwcmV2aW91c1NpYmxpbmcnIDogJ25leHRTaWJsaW5nJztcbiAgICB2YXIgc3VnZ2VzdGlvbiA9IHNlbGVjdGlvbiAmJiBzZWxlY3Rpb25bbmV4dF0gfHwgdWxbZmlyc3RdO1xuXG4gICAgc2VsZWN0KHN1Z2dlc3Rpb24pO1xuXG4gICAgaWYgKGhpZGRlbihzdWdnZXN0aW9uKSkge1xuICAgICAgbW92ZSh1cCwgbW92ZXMgPyBtb3ZlcyArIDEgOiAxKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoaWRlICgpIHtcbiAgICBleWUuc2xlZXAoKTtcbiAgICB1bC5jbGFzc05hbWUgPSB1bC5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zaG93L2csICcnKTtcbiAgICB1bnNlbGVjdCgpO1xuICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlkb3duIChlKSB7XG4gICAgdmFyIHNob3duID0gdmlzaWJsZSgpO1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0RPV04pIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgICAgaWYgKHNob3duKSB7XG4gICAgICAgIG1vdmUoKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfVVApIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgICAgaWYgKHNob3duKSB7XG4gICAgICAgIG1vdmUodHJ1ZSk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX0JBQ0tTUEFDRSkge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChzaG93bikge1xuICAgICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoc2VsZWN0aW9uLCAnY2xpY2snKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoaWRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9FU0MpIHtcbiAgICAgICAgaGlkZSgpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlcmluZyAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbG9hZGluZyh0cnVlKTtcbiAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtZmlsdGVyJyk7XG4gICAgdmFyIGxpID0gdWwuZmlyc3RDaGlsZDtcbiAgICB2YXIgY291bnQgPSAwO1xuICAgIHdoaWxlIChsaSkge1xuICAgICAgaWYgKGNvdW50ID49IGxpbWl0KSB7XG4gICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUobGksICdhdXRvY29tcGxldGUtaGlkZScpO1xuICAgICAgfVxuICAgICAgaWYgKGNvdW50IDwgbGltaXQpIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICAgICAgaWYgKGxpLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtaGlkZScpID09PSAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpID0gbGkubmV4dFNpYmxpbmc7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBtb3ZlKCk7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBoaWRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmZXJyZWRGaWx0ZXJpbmdOb0VudGVyIChlKSB7XG4gICAgdmFyIHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGVmZXJyZWRGaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmVycmVkU2hvdyAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFRpbWVvdXQoc2hvdywgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBhdXRvY29tcGxldGVFdmVudFRhcmdldCAoZSkge1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgaWYgKHRhcmdldCA9PT0gdWwgfHwgdGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU9uQmx1ciAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX1RBQikge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGVPbkNsaWNrIChlKSB7XG4gICAgaWYgKGF1dG9jb21wbGV0ZUV2ZW50VGFyZ2V0KGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpZGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlucHV0RXZlbnRzIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGlmIChleWUpIHtcbiAgICAgIGV5ZS5kZXN0cm95KCk7XG4gICAgICBleWUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIXJlbW92ZSkge1xuICAgICAgZXllID0gYnVsbHNleWUodWwsIGF0dGFjaG1lbnQsIHsgY2FyZXQ6IGFueUlucHV0ICYmIGF0dGFjaG1lbnQudGFnTmFtZSAhPT0gJ0lOUFVUJyB9KTtcbiAgICAgIGlmICghdmlzaWJsZSgpKSB7IGV5ZS5zbGVlcCgpOyB9XG4gICAgfVxuICAgIGlmIChyZW1vdmUgfHwgKGFueUlucHV0ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBhdHRhY2htZW50KSkge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZGluZygpO1xuICAgIH1cbiAgICBpZiAoYW55SW5wdXQpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRTaG93KTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRGaWx0ZXJpbmcpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAna2V5ZG93bicsIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdwYXN0ZScsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICAgIGlmIChvLmF1dG9IaWRlT25CbHVyKSB7IGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBoaWRlT25CbHVyKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdjbGljaycsIHRvZ2dsZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2NFbGVtZW50LCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIH1cbiAgICBpZiAoby5hdXRvSGlkZU9uQ2xpY2spIHsgY3Jvc3N2ZW50W29wXShkb2MsICdjbGljaycsIGhpZGVPbkNsaWNrKTsgfVxuICAgIGlmIChmb3JtKSB7IGNyb3NzdmVudFtvcF0oZm9ybSwgJ3N1Ym1pdCcsIGhpZGUpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBpZiAocGFyZW50LmNvbnRhaW5zKHVsKSkgeyBwYXJlbnQucmVtb3ZlQ2hpbGQodWwpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0U2V0dGVyICh2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAobGksIHN1Z2dlc3Rpb24pIHtcbiAgICBsaS5pbm5lclRleHQgPSBsaS50ZXh0Q29udGVudCA9IGdldFRleHQoc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0RmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgdmFyIG5lZWRsZSA9IHEudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgdGV4dCA9IGdldFRleHQoc3VnZ2VzdGlvbikgfHwgJyc7XG4gICAgaWYgKGZ1enp5c2VhcmNoKG5lZWRsZSwgdGV4dC50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pIHx8ICcnO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBmdXp6eXNlYXJjaChuZWVkbGUsIHZhbHVlLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9vcGJhY2tUb0FuY2hvciAodGV4dCwgcCkge1xuICAgIHZhciByZXN1bHQgPSAnJztcbiAgICB2YXIgYW5jaG9yZWQgPSBmYWxzZTtcbiAgICB2YXIgc3RhcnQgPSBwLnN0YXJ0O1xuICAgIHdoaWxlIChhbmNob3JlZCA9PT0gZmFsc2UgJiYgc3RhcnQgPj0gMCkge1xuICAgICAgcmVzdWx0ID0gdGV4dC5zdWJzdHIoc3RhcnQgLSAxLCBwLnN0YXJ0IC0gc3RhcnQgKyAxKTtcbiAgICAgIGFuY2hvcmVkID0gcmFuY2hvcmxlZnQudGVzdChyZXN1bHQpO1xuICAgICAgc3RhcnQtLTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGFuY2hvcmVkID8gcmVzdWx0IDogbnVsbCxcbiAgICAgIHN0YXJ0OiBzdGFydFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZFRleHQgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICB2YXIgcG9zaXRpb24gPSBzZWxsKGVsKTtcbiAgICB2YXIgaW5wdXQgPSBsb29wYmFja1RvQW5jaG9yKHEsIHBvc2l0aW9uKS50ZXh0O1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgcmV0dXJuIHsgaW5wdXQ6IGlucHV0LCBzdWdnZXN0aW9uOiBzdWdnZXN0aW9uIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwZW5kVGV4dCAodmFsdWUpIHtcbiAgICB2YXIgY3VycmVudCA9IGVsLnZhbHVlO1xuICAgIHZhciBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIHZhciBpbnB1dCA9IGxvb3BiYWNrVG9BbmNob3IoY3VycmVudCwgcG9zaXRpb24pO1xuICAgIHZhciBsZWZ0ID0gY3VycmVudC5zdWJzdHIoMCwgaW5wdXQuc3RhcnQpO1xuICAgIHZhciByaWdodCA9IGN1cnJlbnQuc3Vic3RyKGlucHV0LnN0YXJ0ICsgaW5wdXQudGV4dC5sZW5ndGggKyAocG9zaXRpb24uZW5kIC0gcG9zaXRpb24uc3RhcnQpKTtcbiAgICB2YXIgYmVmb3JlID0gbGVmdCArIHZhbHVlICsgJyAnO1xuXG4gICAgZWwudmFsdWUgPSBiZWZvcmUgKyByaWdodDtcbiAgICBzZWxsKGVsLCB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggfSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRIVE1MICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcmluZyBpbiBlZGl0YWJsZSBlbGVtZW50cyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXQgKGVsKSB7IHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7IH1cblxuZnVuY3Rpb24gdGFnICh0eXBlLCBjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBkZWZlciAoZm4pIHsgcmV0dXJuIGZ1bmN0aW9uICgpIHsgc2V0VGltZW91dChmbiwgMCk7IH07IH1cblxuZnVuY3Rpb24gaXNFZGl0YWJsZSAoZWwpIHtcbiAgdmFyIHZhbHVlID0gZWwuZ2V0QXR0cmlidXRlKCdjb250ZW50RWRpdGFibGUnKTtcbiAgaWYgKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gaXNFZGl0YWJsZShlbC5wYXJlbnRFbGVtZW50KTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXV0b2NvbXBsZXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZG9tID0gcmVxdWlyZSgnLi9kb20nKTtcbnZhciB0ZXh0ID0gcmVxdWlyZSgnLi90ZXh0Jyk7XG52YXIgcHJvcHMgPSBbXG4gICdmb250RmFtaWx5JyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd3b3JkU3BhY2luZycsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3dlYmtpdEJveFNpemluZycsXG4gICdtb3pCb3hTaXppbmcnLFxuICAnYm94U2l6aW5nJyxcbiAgJ3BhZGRpbmcnLFxuICAnYm9yZGVyJ1xuXTtcbnZhciBvZmZzZXQgPSAyMDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmYWN0b3J5IChlbCkge1xuICB2YXIgbWlycm9yID0gZG9tKCdzcGFuJyk7XG5cbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuICByZW1hcCgpO1xuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZW1hcDogcmVtYXAsXG4gICAgcmVmcmVzaDogcmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gcmVtYXAgKCkge1xuICAgIHZhciBjID0gY29tcHV0ZWQoKTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZSA9IGNbcHJvcHNbaV1dO1xuICAgICAgaWYgKHZhbHVlICE9PSB2b2lkIDAgJiYgdmFsdWUgIT09IG51bGwpIHsgLy8gb3RoZXJ3aXNlIElFIGJsb3dzIHVwXG4gICAgICAgIG1pcnJvci5zdHlsZVtwcm9wc1tpXV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgbWlycm9yLmRpc2FibGVkID0gJ2Rpc2FibGVkJztcbiAgICBtaXJyb3Iuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnO1xuICAgIG1pcnJvci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgbWlycm9yLnN0eWxlLnRvcCA9IG1pcnJvci5zdHlsZS5sZWZ0ID0gJy05OTk5ZW0nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgdmFyIHZhbHVlID0gZWwudmFsdWU7XG4gICAgaWYgKHZhbHVlID09PSBtaXJyb3IudmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0ZXh0KG1pcnJvciwgdmFsdWUpO1xuXG4gICAgdmFyIHdpZHRoID0gbWlycm9yLm9mZnNldFdpZHRoICsgb2Zmc2V0O1xuXG4gICAgZWwuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBtaXJyb3IucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChtaXJyb3IpO1xuICAgIGVsLnN0eWxlLndpZHRoID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wdXRlZCAoKSB7XG4gICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgICByZXR1cm4gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIH1cbiAgICByZXR1cm4gZWwuY3VycmVudFN0eWxlO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRvbSAodGFnTmFtZSwgY2xhc3Nlcykge1xuICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICBpZiAoY2xhc3Nlcykge1xuICAgIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXM7XG4gIH1cbiAgcmV0dXJuIGVsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcbnZhciBpbnB1dFRhZyA9IC9pbnB1dC9pO1xudmFyIHRleHRhcmVhVGFnID0gL3RleHRhcmVhL2k7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IHRleHRhcmVhVGFnLnRlc3QoZWwudGFnTmFtZSkpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHNwZWNpYWwoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBzcGVjaWFsKGVsLCBwLmVuZCk7XG59XG5cbmZ1bmN0aW9uIGhhcmRTZXQgKGVsLCBwKSB7XG4gIHZhciByYW5nZSA9IGVsLmNyZWF0ZVRleHRSYW5nZSgpO1xuXG4gIGlmIChwLnN0YXJ0ID09PSAnZW5kJyAmJiBwLmVuZCA9PT0gJ2VuZCcpIHtcbiAgICByYW5nZS5jb2xsYXBzZShmYWxzZSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2UuY29sbGFwc2UodHJ1ZSk7XG4gICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgcC5lbmQpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcC5zdGFydCk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BlY2lhbCAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxlY3Rpb24gKGVsLCBwKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgc2V0KGVsLCBwKTtcbiAgfVxuICByZXR1cm4gZ2V0KGVsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBkb20gPSByZXF1aXJlKCcuL2RvbScpO1xudmFyIHRleHQgPSByZXF1aXJlKCcuL3RleHQnKTtcbnZhciBzZWxlY3Rpb24gPSByZXF1aXJlKCcuL3NlbGVjdGlvbicpO1xudmFyIGF1dG9zaXplID0gcmVxdWlyZSgnLi9hdXRvc2l6ZScpO1xudmFyIGF1dG9jb21wbGV0ZSA9IHJlcXVpcmUoJy4vYXV0b2NvbXBsZXRlJyk7XG52YXIgaW5wdXRUYWcgPSAvXmlucHV0JC9pO1xudmFyIEVMRU1FTlQgPSAxO1xudmFyIEJBQ0tTUEFDRSA9IDg7XG52YXIgRU5EID0gMzU7XG52YXIgSE9NRSA9IDM2O1xudmFyIExFRlQgPSAzNztcbnZhciBSSUdIVCA9IDM5O1xudmFyIHNpbmthYmxlS2V5cyA9IFtFTkQsIEhPTUUsIExFRlQsIFJJR0hUXTtcbnZhciB0YWdDbGFzcyA9IC9cXGJ0YXktdGFnXFxiLztcbnZhciB0YWdSZW1vdmFsQ2xhc3MgPSAvXFxidGF5LXRhZy1yZW1vdmVcXGIvO1xudmFyIGVkaXRvckNsYXNzID0gL1xcYnRheS1lZGl0b3JcXGIvZztcbnZhciBpbnB1dENsYXNzID0gL1xcYnRheS1pbnB1dFxcYi9nO1xudmFyIGVuZCA9IHsgc3RhcnQ6ICdlbmQnLCBlbmQ6ICdlbmQnIH07XG52YXIgZGVmYXVsdERlbGltaXRlciA9ICcgJztcblxuZnVuY3Rpb24gdGFnZ3kgKGVsLCBvcHRpb25zKSB7XG4gIHZhciBjdXJyZW50VmFsdWVzID0gW107XG4gIHZhciBfbm9zZWxlY3QgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBlbDtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZGVsaW1pdGVyID0gby5kZWxpbWl0ZXIgfHwgZGVmYXVsdERlbGltaXRlcjtcbiAgaWYgKGRlbGltaXRlci5sZW5ndGggIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ2d5IGV4cGVjdGVkIGEgc2luZ2xlLWNoYXJhY3RlciBkZWxpbWl0ZXIgc3RyaW5nJyk7XG4gIH1cbiAgdmFyIGFueSA9IGhhc1NpYmxpbmdzKGVsKTtcbiAgaWYgKGFueSB8fCAhaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSkge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFnZ3kgZXhwZWN0ZWQgYW4gaW5wdXQgZWxlbWVudCB3aXRob3V0IGFueSBzaWJsaW5ncycpO1xuICB9XG4gIHZhciBmcmVlID0gby5mcmVlICE9PSBmYWxzZTtcbiAgdmFyIHZhbGlkYXRlID0gby52YWxpZGF0ZSB8fCBkZWZhdWx0VmFsaWRhdGU7XG4gIHZhciByZW5kZXIgPSBvLnJlbmRlciB8fCBkZWZhdWx0UmVuZGVyZXI7XG4gIHZhciByZWFkVGFnID0gby5yZWFkVGFnIHx8IGRlZmF1bHRSZWFkZXI7XG5cdHZhciBjb252ZXJ0T25Gb2N1cyA9IG8uY29udmVydE9uRm9jdXMgIT09IGZhbHNlO1xuXG4gIHZhciB0b0l0ZW1EYXRhID0gZGVmYXVsdFRvSXRlbURhdGE7XG5cbiAgdmFyIHBhcnNlVGV4dCA9IG8ucGFyc2VUZXh0O1xuICB2YXIgcGFyc2VWYWx1ZSA9IG8ucGFyc2VWYWx1ZTtcbiAgdmFyIGdldFRleHQgPSAoXG4gICAgdHlwZW9mIHBhcnNlVGV4dCA9PT0gJ3N0cmluZycgPyBkID0+IGRbcGFyc2VUZXh0XSA6XG4gICAgdHlwZW9mIHBhcnNlVGV4dCA9PT0gJ2Z1bmN0aW9uJyA/IHBhcnNlVGV4dCA6XG4gICAgZCA9PiBkXG4gICk7XG4gIHZhciBnZXRWYWx1ZSA9IChcbiAgICB0eXBlb2YgcGFyc2VWYWx1ZSA9PT0gJ3N0cmluZycgPyBkID0+IGRbcGFyc2VWYWx1ZV0gOlxuICAgIHR5cGVvZiBwYXJzZVZhbHVlID09PSAnZnVuY3Rpb24nID8gcGFyc2VWYWx1ZSA6XG4gICAgZCA9PiBkXG4gICk7XG5cbiAgdmFyIGJlZm9yZSA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1iZWZvcmUnKTtcbiAgdmFyIGFmdGVyID0gZG9tKCdzcGFuJywgJ3RheS10YWdzIHRheS10YWdzLWFmdGVyJyk7XG4gIHZhciBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICBlbC5jbGFzc05hbWUgKz0gJyB0YXktaW5wdXQnO1xuICBwYXJlbnQuY2xhc3NOYW1lICs9ICcgdGF5LWVkaXRvcic7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYmVmb3JlLCBlbCk7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYWZ0ZXIsIGVsLm5leHRTaWJsaW5nKTtcbiAgYmluZCgpO1xuXG4gIHZhciBzaHJpbmtlciA9IGF1dG9zaXplKGVsKTtcbiAgdmFyIGNvbXBsZXRlcjtcbiAgaWYgKG8uYXV0b2NvbXBsZXRlKSB7XG4gICAgY29tcGxldGVyID0gY3JlYXRlQXV0b2NvbXBsZXRlKCk7XG4gIH1cblxuICB2YXIgYXBpID0ge1xuICAgIGFkZEl0ZW0sXG4gICAgcmVtb3ZlSXRlbSxcbiAgICB2YWx1ZTogcmVhZFZhbHVlLFxuICAgIGRlc3Ryb3lcbiAgfTtcblxuICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gIF9ub3NlbGVjdCA9IGZhbHNlO1xuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gZmluZEl0ZW0gKGRhdGEpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnRWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjdXJyZW50VmFsdWVzW2ldLmRhdGEgPT09IGRhdGEpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZXNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkSXRlbSAoZGF0YSkge1xuICAgIHZhciBpdGVtID0geyBkYXRhLCB2YWxpZDogdHJ1ZSB9O1xuICAgIHZhciBlbCA9IHJlbmRlckl0ZW0oaXRlbSk7XG4gICAgaWYgKCFlbCkge1xuICAgICAgcmV0dXJuIGFwaTtcbiAgICB9XG4gICAgaXRlbS5lbCA9IGVsO1xuICAgIGN1cnJlbnRWYWx1ZXMucHVzaChpdGVtKTtcbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbSAoZGF0YSkge1xuICAgIHZhciBpdGVtID0gZmluZEl0ZW0oZGF0YSk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIHJlbW92ZUl0ZW1FbGVtZW50KGl0ZW0uZWwpO1xuICAgICAgY3VycmVudFZhbHVlcy5zcGxpY2UoY3VycmVudFZhbHVlcy5pbmRleE9mKGl0ZW0pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlckl0ZW0gKGl0ZW0pIHtcbiAgICByZXR1cm4gY3JlYXRlVGFnKGJlZm9yZSwgaXRlbSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtRWxlbWVudCAoZWwpIHtcbiAgICBpZiAoZWwucGFyZW50RWxlbWVudCkge1xuICAgICAgZWwucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlVGFnIChidWZmZXIsIGl0ZW0pIHtcbiAgICB2YXIge2RhdGF9ID0gaXRlbTtcbiAgICB2YXIgZW1wdHkgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgJiYgZGF0YS50cmltKCkubGVuZ3RoID09PSAwO1xuICAgIGlmIChlbXB0eSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCBlbCA9IGRvbSgnc3BhbicsICd0YXktdGFnJyk7XG4gICAgcmVuZGVyKGVsLCBpdGVtKTtcbiAgICBpZiAoby5kZWxldGlvbikge1xuICAgICAgZWwuYXBwZW5kQ2hpbGQoZG9tKCdzcGFuJywgJ3RheS10YWctcmVtb3ZlJykpO1xuICAgIH1cbiAgICBidWZmZXIuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIHJldHVybiBlbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRUb0l0ZW1EYXRhIChzKSB7XG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVmFsdWUgKCkge1xuICAgIHJldHVybiBjdXJyZW50VmFsdWVzLmZpbHRlcih2ID0+IHYudmFsaWQpLm1hcCh2ID0+IHYuZGF0YSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVBdXRvY29tcGxldGUgKCkge1xuICAgIHZhciBjb21wbGV0ZXIgPSBhdXRvY29tcGxldGUoZWwsIHtcbiAgICAgIHN1Z2dlc3Rpb25zOiBvLmF1dG9jb21wbGV0ZSxcbiAgICAgIGdldFRleHQsXG4gICAgICBnZXRWYWx1ZSxcbiAgICAgIHNldCAocykge1xuICAgICAgICBlbC52YWx1ZSA9ICcnO1xuICAgICAgICBhZGRJdGVtKHMpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjb21wbGV0ZXI7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywga2V5ZG93bik7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXByZXNzJywga2V5cHJlc3MpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHBhc3RlKTtcbiAgICBjcm9zc3ZlbnRbb3BdKHBhcmVudCwgJ2NsaWNrJywgY2xpY2spO1xuXHRcdGlmIChjb252ZXJ0T25Gb2N1cykge1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsICdmb2N1cycsIGRvY3VtZW50Zm9jdXMsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gICAgaWYgKGNvbXBsZXRlcikgeyBjb21wbGV0ZXIuZGVzdHJveSgpOyB9XG4gICAgZWwudmFsdWUgPSAnJztcbiAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShpbnB1dENsYXNzLCAnJyk7XG4gICAgcGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShlZGl0b3JDbGFzcywgJycpO1xuICAgIGlmIChiZWZvcmUucGFyZW50RWxlbWVudCkgeyBiZWZvcmUucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChiZWZvcmUpOyB9XG4gICAgaWYgKGFmdGVyLnBhcmVudEVsZW1lbnQpIHsgYWZ0ZXIucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChhZnRlcik7IH1cbiAgICBzaHJpbmtlci5kZXN0cm95KCk7XG4gICAgYXBpLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgYXBpLmRlc3Ryb3kgPSBhcGkuYWRkSXRlbSA9IGFwaS5yZW1vdmVJdGVtID0gKCkgPT4gYXBpO1xuICAgIGFwaS50YWdzID0gYXBpLnZhbHVlID0gKCkgPT4gbnVsbDtcbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gZG9jdW1lbnRmb2N1cyAoZSkge1xuICAgIGlmIChlLnRhcmdldCAhPT0gZWwpIHtcbiAgICAgIF9ub3NlbGVjdCA9IHRydWU7XG4gICAgICBjb252ZXJ0KHRydWUpO1xuICAgICAgX25vc2VsZWN0ID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2xpY2sgKGUpIHtcbiAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXQ7XG4gICAgaWYgKHRhZ1JlbW92YWxDbGFzcy50ZXN0KHRhcmdldC5jbGFzc05hbWUpKSB7XG4gICAgICBmb2N1c1RhZyh0YXJnZXQucGFyZW50RWxlbWVudCwgeyBzdGFydDogJ2VuZCcsIGVuZDogJ2VuZCcsIHJlbW92ZTogdHJ1ZSB9KTtcbiAgICAgIHNoaWZ0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0b3AgPSB0YXJnZXQ7XG4gICAgdmFyIHRhZ2dlZCA9IHRhZ0NsYXNzLnRlc3QodG9wLmNsYXNzTmFtZSk7XG4gICAgd2hpbGUgKHRhZ2dlZCA9PT0gZmFsc2UgJiYgdG9wLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIHRvcCA9IHRvcC5wYXJlbnRFbGVtZW50O1xuICAgICAgdGFnZ2VkID0gdGFnQ2xhc3MudGVzdCh0b3AuY2xhc3NOYW1lKTtcbiAgICB9XG4gICAgaWYgKHRhZ2dlZCAmJiBmcmVlKSB7XG4gICAgICBmb2N1c1RhZyh0b3AsIGVuZCk7XG4gICAgfSBlbHNlIGlmICh0YXJnZXQgIT09IGVsKSB7XG4gICAgICBzaGlmdCgpO1xuICAgICAgZWwuZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzaGlmdCAoKSB7XG4gICAgZm9jdXNUYWcoYWZ0ZXIubGFzdENoaWxkLCBlbmQpO1xuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnZlcnQgKGFsbCkge1xuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCBhbGwpO1xuICAgIGlmIChhbGwpIHtcbiAgICAgIGVhY2goYWZ0ZXIsIG1vdmVMZWZ0KTtcbiAgICB9XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShlbCwgJ3RhZ2d5LWNvbnZlcnRlZCcpO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlTGVmdCAodmFsdWUsIHRhZykge1xuICAgIGJlZm9yZS5hcHBlbmRDaGlsZCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICAgIHZhciBzZWwgPSBzZWxlY3Rpb24oZWwpO1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIGlmIChmcmVlKSB7XG4gICAgICBpZiAoa2V5ID09PSBIT01FKSB7XG4gICAgICAgIGlmIChiZWZvcmUuZmlyc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGJlZm9yZS5maXJzdENoaWxkLCB7fSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZWN0aW9uKGVsLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBFTkQpIHtcbiAgICAgICAgaWYgKGFmdGVyLmxhc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGFmdGVyLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxlY3Rpb24oZWwsIGVuZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBMRUZUICYmIHNlbC5zdGFydCA9PT0gMCAmJiBiZWZvcmUubGFzdENoaWxkKSB7XG4gICAgICAgIGZvY3VzVGFnKGJlZm9yZS5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gQkFDS1NQQUNFICYmIHNlbC5zdGFydCA9PT0gMCAmJiAoc2VsLmVuZCA9PT0gMCB8fCBzZWwuZW5kICE9PSBlbC52YWx1ZS5sZW5ndGgpICYmIGJlZm9yZS5sYXN0Q2hpbGQpIHtcbiAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBSSUdIVCAmJiBzZWwuZW5kID09PSBlbC52YWx1ZS5sZW5ndGggJiYgYWZ0ZXIuZmlyc3RDaGlsZCkge1xuICAgICAgICBmb2N1c1RhZyhhZnRlci5maXJzdENoaWxkLCB7fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChrZXkgPT09IEJBQ0tTUEFDRSAmJiBzZWwuc3RhcnQgPT09IDAgJiYgKHNlbC5lbmQgPT09IDAgfHwgc2VsLmVuZCAhPT0gZWwudmFsdWUubGVuZ3RoKSAmJiBiZWZvcmUubGFzdENoaWxkKSB7XG4gICAgICAgIGJlZm9yZS5yZW1vdmVDaGlsZChiZWZvcmUubGFzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoc2lua2FibGVLZXlzLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgLy8ganVzdCBwcmV2ZW50IGRlZmF1bHRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5cHJlc3MgKGUpIHtcbiAgICB2YXIga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGUgfHwgZS5jaGFyQ29kZTtcbiAgICBpZiAoU3RyaW5nLmZyb21DaGFyQ29kZShrZXkpID09PSBkZWxpbWl0ZXIpIHtcbiAgICAgIGNvbnZlcnQoKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXN0ZSAoKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiBldmFsdWF0ZSgpLCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2YWx1YXRlIChleHRyYXMsIGVudGlyZWx5KSB7XG4gICAgdmFyIHAgPSBzZWxlY3Rpb24oZWwpO1xuICAgIHZhciBsZW4gPSBlbnRpcmVseSA/IEluZmluaXR5IDogcC5zdGFydDtcbiAgICB2YXIgdGFncyA9IGVsLnZhbHVlLnNsaWNlKDAsIGxlbikuY29uY2F0KGV4dHJhcyB8fCBbXSkuc3BsaXQoZGVsaW1pdGVyKTtcbiAgICBpZiAodGFncy5sZW5ndGggPCAxIHx8ICFmcmVlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHJlc3QgPSB0YWdzLnBvcCgpICsgZWwudmFsdWUuc2xpY2UobGVuKTtcbiAgICB2YXIgcmVtb3ZhbCA9IHRhZ3Muam9pbihkZWxpbWl0ZXIpLmxlbmd0aDtcblxuICAgIHRhZ3MuZm9yRWFjaCh0YWcgPT4gYWRkSXRlbSh0b0l0ZW1EYXRhKHRhZykpKTtcbiAgICBjbGVhbnVwKCk7XG4gICAgZWwudmFsdWUgPSByZXN0O1xuICAgIHAuc3RhcnQgLT0gcmVtb3ZhbDtcbiAgICBwLmVuZCAtPSByZW1vdmFsO1xuICAgIGlmIChfbm9zZWxlY3QgIT09IHRydWUpIHsgc2VsZWN0aW9uKGVsLCBwKTsgfVxuICAgIHNocmlua2VyLnJlZnJlc2goKTtcbiAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGVsLCAndGFnZ3ktZXZhbHVhdGVkJyk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhbnVwICgpIHtcbiAgICB2YXIgdGFncyA9IFtdO1xuXG4gICAgZWFjaChiZWZvcmUsIGRldGVjdCk7XG4gICAgZWFjaChhZnRlciwgZGV0ZWN0KTtcblxuICAgIGZ1bmN0aW9uIGRldGVjdCAodmFsdWUsIHRhZ0VsZW1lbnQpIHtcbiAgICAgIGlmICh2YWxpZGF0ZSh2YWx1ZSwgdGFncy5zbGljZSgpKSkge1xuICAgICAgICB0YWdzLnB1c2godmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChvLnByZXZlbnREdXBsaWNhdGVzKSB7XG4gICAgICAgIHRhZ0VsZW1lbnQucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0YWdFbGVtZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhZ0VsZW1lbnQuY2xhc3NMaXN0LmFkZCgndGF5LWR1cGxpY2F0ZScpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAoY29udGFpbmVyLCBpdGVtKSB7XG4gICAgdGV4dChjb250YWluZXIsIGdldFRleHQoaXRlbS5kYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UmVhZGVyICh0YWcpIHtcbiAgICByZXR1cm4gdGV4dCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9jdXNUYWcgKHRhZywgcCkge1xuICAgIGlmICghdGFnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgICB2YXIgcGFyZW50ID0gdGFnLnBhcmVudEVsZW1lbnQ7XG4gICAgaWYgKHBhcmVudCA9PT0gYmVmb3JlKSB7XG4gICAgICB3aGlsZSAocGFyZW50Lmxhc3RDaGlsZCAhPT0gdGFnKSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShwYXJlbnQubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKHBhcmVudC5maXJzdENoaWxkICE9PSB0YWcpIHtcbiAgICAgICAgYmVmb3JlLmFwcGVuZENoaWxkKHBhcmVudC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGFnLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnKTtcbiAgICBlbC52YWx1ZSA9IHAucmVtb3ZlID8gJycgOiByZWFkVGFnKHRhZyk7XG4gICAgZWwuZm9jdXMoKTtcbiAgICBzZWxlY3Rpb24oZWwsIHApO1xuICAgIHNocmlua2VyLnJlZnJlc2goKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhc1NpYmxpbmdzICgpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBlbC5wYXJlbnRFbGVtZW50LmNoaWxkcmVuO1xuICAgIHJldHVybiBbLi4uY2hpbGRyZW5dLnNvbWUocyA9PiBzICE9PSBlbCAmJiBzLm5vZGVUeXBlID09PSBFTEVNRU5UKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2ggKGNvbnRhaW5lciwgZm4pIHtcbiAgICBbLi4uY29udGFpbmVyLmNoaWxkcmVuXS5mb3JFYWNoKCh0YWcsIGkpID0+IGZuKHJlYWRUYWcodGFnKSwgdGFnLCBpKSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VmFsaWRhdGUgKHZhbHVlLCB0YWdzKSB7XG4gICAgcmV0dXJuIHRhZ3MuaW5kZXhPZih2YWx1ZSkgPT09IC0xO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGFnZ3k7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRleHQgKGVsLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGVsLmlubmVyVGV4dCA9IGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gIH1cbiAgaWYgKHR5cGVvZiBlbC5pbm5lclRleHQgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVsLmlubmVyVGV4dDtcbiAgfVxuICByZXR1cm4gZWwudGV4dENvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGV4dDtcbiJdfQ==
