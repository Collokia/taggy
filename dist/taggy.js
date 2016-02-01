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

},{"./tailormade":10,"./throttle":11,"crossvent":17}],2:[function(require,module,exports){
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

},{"./throttle":11,"crossvent":17,"seleccion":8,"sell":21}],11:[function(require,module,exports){
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
'use strict';

var ticky = require('ticky');

module.exports = function debounce (fn, args, ctx) {
  if (!fn) { return; }
  ticky(function run () {
    fn.apply(ctx || null, args || []);
  });
};

},{"ticky":15}],13:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var debounce = require('./debounce');

module.exports = function emitter (thing, options) {
  var opts = options || {};
  var evt = {};
  if (thing === undefined) { thing = {}; }
  thing.on = function (type, fn) {
    if (!evt[type]) {
      evt[type] = [fn];
    } else {
      evt[type].push(fn);
    }
    return thing;
  };
  thing.once = function (type, fn) {
    fn._once = true; // thing.off(fn) still works!
    thing.on(type, fn);
    return thing;
  };
  thing.off = function (type, fn) {
    var c = arguments.length;
    if (c === 1) {
      delete evt[type];
    } else if (c === 0) {
      evt = {};
    } else {
      var et = evt[type];
      if (!et) { return thing; }
      et.splice(et.indexOf(fn), 1);
    }
    return thing;
  };
  thing.emit = function () {
    var args = atoa(arguments);
    return thing.emitterSnapshot(args.shift()).apply(this, args);
  };
  thing.emitterSnapshot = function (type) {
    var et = (evt[type] || []).slice(0);
    return function () {
      var args = atoa(arguments);
      var ctx = this || thing;
      if (type === 'error' && opts.throws !== false && !et.length) { throw args.length === 1 ? args[0] : args; }
      et.forEach(function emitter (listen) {
        if (opts.async) { debounce(listen, args, ctx); } else { listen.apply(ctx, args); }
        if (listen._once) { thing.off(type, listen); }
      });
      return thing;
    };
  };
  return thing;
};

},{"./debounce":12,"atoa":14}],14:[function(require,module,exports){
module.exports = function atoa (a, n) { return Array.prototype.slice.call(a, n); }

},{}],15:[function(require,module,exports){
var si = typeof setImmediate === 'function', tick;
if (si) {
  tick = function (fn) { setImmediate(fn); };
} else {
  tick = function (fn) { setTimeout(fn, 0); };
}

module.exports = tick;
},{}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
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

},{"./eventmap":18,"custom-event":16}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
'use strict';

function pad (hash, len) {
  while (hash.length < len) {
    hash = '0' + hash;
  }
  return hash;
}

function fold (hash, text) {
  var i;
  var chr;
  var len;
  if (text.length === 0) {
    return hash;
  }
  for (i = 0, len = text.length; i < len; i++) {
    chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash < 0 ? hash * -2 : hash;
}

function foldObject (hash, o, seen) {
  return Object.keys(o).sort().reduce(foldKey, hash);
  function foldKey (hash, key) {
    return foldValue(hash, o[key], key, seen);
  }
}

function foldValue (input, value, key, seen) {
  var hash = fold(fold(fold(input, key), toString(value)), typeof value);
  if (value === null) {
    return fold(hash, 'null');
  }
  if (value === undefined) {
    return fold(hash, 'undefined');
  }
  if (typeof value === 'object') {
    if (seen.indexOf(value) !== -1) {
      return fold(hash, '[Circular]' + key);
    }
    seen.push(value);
    return foldObject(hash, value, seen);
  }
  return fold(hash, value.toString());
}

function toString (o) {
  return Object.prototype.toString.call(o);
}

function sum (o) {
  return pad(foldValue(0, o, '', []).toString(16), 8);
}

module.exports = sum;

},{}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = autocomplete;

var _sell = require('sell');

var _sell2 = _interopRequireDefault(_sell);

var _crossvent = require('crossvent');

var _crossvent2 = _interopRequireDefault(_crossvent);

var _bullseye = require('bullseye');

var _bullseye2 = _interopRequireDefault(_bullseye);

var _fuzzysearch = require('fuzzysearch');

var _fuzzysearch2 = _interopRequireDefault(_fuzzysearch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

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
  var deferredFiltering = defer(filtering);
  var state = { counter: 0, query: null };
  var selection = null;
  var eye = undefined;
  var attachment = el;
  var textInput = undefined;
  var anyInput = undefined;
  var ranchorleft = undefined;
  var ranchorright = undefined;

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
      _crossvent2.default.remove(attachment, 'focus', loading);
      var query = readInput();
      if (query !== state.query) {
        (function () {
          state.counter++;
          state.query = query;

          var counter = state.counter;
          suggestions({ query: query, limit: limit }, function (s) {
            if (state.counter === counter) {
              loaded(s, forceShow);
            }
          });
        })();
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

  function readInput() {
    return textInput ? el.value : el.innerHTML;
  }

  function add(suggestion) {
    var li = tag('li', 'tac-item');
    render(li, suggestion);
    breakupForHighlighter(li);
    _crossvent2.default.add(li, 'click', clickedSuggestion);
    _crossvent2.default.add(li, 'autocomplete-filter', filterItem);
    _crossvent2.default.add(li, 'autocomplete-hide', hideItem);
    ul.appendChild(li);
    api.suggestions.push(suggestion);
    return li;

    function clickedSuggestion() {
      var input = getText(suggestion);
      var value = getValue(suggestion);
      set(value);
      hide();
      attachment.focus();
      var prefix = o.prefix && o.prefix(input);
      if (prefix) {
        el.value = prefix;
        el.select();
        show();
        filtering();
      }
    }

    function filterItem() {
      var value = readInput();
      if (filter(value, suggestion)) {
        li.className = li.className.replace(/ tac-hide/g, '');
      } else {
        _crossvent2.default.fabricate(li, 'autocomplete-hide');
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

  function breakupForHighlighter(el) {
    getTextChildren(el).forEach(function (el) {
      var parent = el.parentElement;
      var text = el.textContent || el.nodeValue || '';
      if (text.length === 0) {
        return;
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = text[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var char = _step.value;

          parent.insertBefore(spanFor(char), el);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      parent.removeChild(el);
      function spanFor(char) {
        var span = doc.createElement('span');
        span.className = 'tac-char';
        span.textContent = span.innerText = char;
        return span;
      }
    });
  }

  function highlight(el, needle) {
    var chars = [].concat(_toConsumableArray(el.querySelectorAll('.tac-char')));

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = needle[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var input = _step2.value;

        while (chars.length) {
          var char = chars.shift();
          var charText = char.innerText || char.textContent;
          if (charText === input) {
            on(char);
            break;
          } else {
            off(char);
          }
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    while (chars.length) {
      off(chars.shift());
    }

    function on(ch) {
      ch.classList.add('tac-char-highlight');
    }
    function off(ch) {
      ch.classList.remove('tac-char-highlight');
    }
  }

  function getTextChildren(el) {
    var texts = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var node = undefined;
    while (node = walker.nextNode()) {
      texts.push(node);
    }
    return texts;
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
      _crossvent2.default.fabricate(attachment, 'autocomplete-show');
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
    _crossvent2.default.fabricate(attachment, 'autocomplete-hide');
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
          _crossvent2.default.fabricate(selection, 'click');
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
    _crossvent2.default.fabricate(attachment, 'autocomplete-filter');
    var value = readInput().trim();
    var li = ul.firstChild;
    var count = 0;
    while (li) {
      if (count >= limit) {
        _crossvent2.default.fabricate(li, 'autocomplete-hide');
      } else {
        _crossvent2.default.fabricate(li, 'autocomplete-filter');
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

  function deferredFilteringNoEnter(e) {
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER) {
      return;
    }
    deferredFiltering();
  }

  function deferredShow(e) {
    var which = e.which || e.keyCode;
    if (which === KEY_ENTER || which === KEY_TAB) {
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
      eye = (0, _bullseye2.default)(ul, attachment, { caret: anyInput && attachment.tagName !== 'INPUT' });
      if (!visible()) {
        eye.sleep();
      }
    }
    if (remove || anyInput && doc.activeElement !== attachment) {
      _crossvent2.default[op](attachment, 'focus', loading);
    } else {
      loading();
    }
    if (anyInput) {
      _crossvent2.default[op](attachment, 'keypress', deferredShow);
      _crossvent2.default[op](attachment, 'keypress', deferredFiltering);
      _crossvent2.default[op](attachment, 'keydown', deferredFilteringNoEnter);
      _crossvent2.default[op](attachment, 'paste', deferredFiltering);
      _crossvent2.default[op](attachment, 'keydown', keydown);
      if (o.autoHideOnBlur) {
        _crossvent2.default[op](attachment, 'keydown', hideOnBlur);
      }
    } else {
      _crossvent2.default[op](attachment, 'click', toggler);
      _crossvent2.default[op](docElement, 'keydown', keydown);
    }
    if (o.autoHideOnClick) {
      _crossvent2.default[op](doc, 'click', hideOnClick);
    }
    if (form) {
      _crossvent2.default[op](form, 'submit', hide);
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
    if ((0, _fuzzysearch2.default)(needle, text.toLowerCase())) {
      return true;
    }
    var value = getValue(suggestion) || '';
    if (typeof value !== 'string') {
      return false;
    }
    return (0, _fuzzysearch2.default)(needle, value.toLowerCase());
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
    var position = (0, _sell2.default)(el);
    var input = loopbackToAnchor(q, position).text;
    if (input) {
      return { input: input, suggestion: suggestion };
    }
  }

  function appendText(value) {
    var current = el.value;
    var position = (0, _sell2.default)(el);
    var input = loopbackToAnchor(current, position);
    var left = current.substr(0, input.start);
    var right = current.substr(input.start + input.text.length + (position.end - position.start));
    var before = left + value + ' ';

    el.value = before + right;
    (0, _sell2.default)(el, { start: before.length, end: before.length });
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

},{"bullseye":1,"crossvent":17,"fuzzysearch":19,"sell":21}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = factory;

var _crossvent = require('crossvent');

var _crossvent2 = _interopRequireDefault(_crossvent);

var _dom = require('./dom');

var _dom2 = _interopRequireDefault(_dom);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent', 'webkitBoxSizing', 'mozBoxSizing', 'boxSizing', 'padding', 'border'];
var offset = 20;

function factory(el) {
  var mirror = (0, _dom2.default)('span');

  document.body.appendChild(mirror);
  remap();
  bind();

  return { remap: remap, refresh: refresh, destroy: destroy };

  function remap() {
    var c = computed();
    var value = undefined;
    for (var i = 0; i < props.length; i++) {
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

    (0, _text2.default)(mirror, value);

    var width = mirror.offsetWidth + offset;

    el.style.width = width + 'px';
  }

  function bind(remove) {
    var op = remove ? 'remove' : 'add';
    _crossvent2.default[op](el, 'keydown', refresh);
    _crossvent2.default[op](el, 'keyup', refresh);
    _crossvent2.default[op](el, 'input', refresh);
    _crossvent2.default[op](el, 'paste', refresh);
    _crossvent2.default[op](el, 'change', refresh);
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

},{"./dom":24,"./text":27,"crossvent":17}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = dom;
function dom(tagName, classes) {
  var el = document.createElement(tagName);
  if (classes) {
    el.className = classes;
  }
  return el;
};

},{}],25:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = selection;
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
  var marker = undefined;
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

},{}],26:[function(require,module,exports){
'use strict';

var _hashSum = require('hash-sum');

var _hashSum2 = _interopRequireDefault(_hashSum);

var _crossvent = require('crossvent');

var _crossvent2 = _interopRequireDefault(_crossvent);

var _emitter = require('contra/emitter');

var _emitter2 = _interopRequireDefault(_emitter);

var _dom = require('./dom');

var _dom2 = _interopRequireDefault(_dom);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

var _selection = require('./selection');

var _selection2 = _interopRequireDefault(_selection);

var _autosize = require('./autosize');

var _autosize2 = _interopRequireDefault(_autosize);

var _autocomplete = require('./autocomplete');

var _autocomplete2 = _interopRequireDefault(_autocomplete);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var inputTag = /^input$/i;
var ELEMENT = 1;
var BACKSPACE = 8;
var END = 35;
var HOME = 36;
var LEFT = 37;
var RIGHT = 39;
var sinkableKeys = [END, HOME];
var tagClass = /\btay-tag\b/;
var tagRemovalClass = /\btay-tag-remove\b/;
var editorClass = /\btay-editor\b/g;
var inputClass = /\btay-input\b/g;
var end = { start: 'end', end: 'end' };
var defaultDelimiter = ' ';

// module.exports because browserify standalone
module.exports = function taggy(el, options) {
  var currentValues = [];
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
  var convertOnBlur = o.convertOnBlur !== false;

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

  var before = (0, _dom2.default)('span', 'tay-tags tay-tags-before');
  var after = (0, _dom2.default)('span', 'tay-tags tay-tags-after');
  var parent = el.parentElement;
  el.className += ' tay-input';
  parent.className += ' tay-editor';
  parent.insertBefore(before, el);
  parent.insertBefore(after, el.nextSibling);

  var shrinker = (0, _autosize2.default)(el);
  var completer = o.autocomplete ? createAutocomplete() : null;
  var api = (0, _emitter2.default)({
    addItem: addItem,
    removeItem: removeItemByData,
    removeItemByElement: removeItemByElement,
    value: readValue,
    destroy: destroy
  });

  var placeholder = el.getAttribute('placeholder');
  var placeheld = true;

  bind();

  (document.activeElement === el ? evaluateSelect : evaluateNoSelect)([delimiter], true);

  return api;

  function findItem(value, prop) {
    for (var i = 0; i < currentValues.length; i++) {
      if (currentValues[i][prop || 'data'] === value) {
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
    api.emit('add', data, el);
    return api;
  }

  function removeItem(item) {
    if (item) {
      removeItemElement(item.el);
      currentValues.splice(currentValues.indexOf(item), 1);
      api.emit('remove', item.data);
    }
    return api;
  }

  function removeItemByData(data) {
    return removeItem(findItem(data));
  }

  function removeItemByElement(el) {
    return removeItem(findItem(el, 'el'));
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
    var el = (0, _dom2.default)('span', 'tay-tag');
    render(el, item);
    if (o.deletion) {
      el.appendChild((0, _dom2.default)('span', 'tay-tag-remove'));
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
    var config = o.autocomplete;
    var prefix = config.prefix;
    var cache = config.cache || {};
    var noSource = !config.source;
    if (noSource && !config.suggestions) {
      return;
    }
    var limit = Number(config.limit) || Infinity;
    var staticItems = Array.isArray(config.suggestions) ? config.suggestions.slice() : [];
    var suggestions = noSource ? staticItems : suggest;
    var completer = (0, _autocomplete2.default)(el, {
      suggestions: suggestions,
      limit: limit,
      getText: getText,
      getValue: getValue,
      prefix: prefix,
      set: function set(s) {
        el.value = '';
        addItem(s);
      },
      filter: function filter(q, suggestion) {
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
    function suggest(data, done) {
      var query = data.query.trim();
      if (query.length === 0) {
        done([]);return;
      }
      api.emit('autocomplete.beforeSource');
      var hash = (0, _hashSum2.default)(query); // fast, case insensitive, prevents collisions
      var entry = cache[hash];
      if (entry) {
        var start = entry.created.getTime();
        var duration = cache.duration || 60 * 60 * 24;
        var diff = duration * 1000;
        var fresh = new Date(start + diff) > new Date();
        if (fresh) {
          done(entry.items);return;
        }
      }
      config.source(data).then(function (result) {
        var items = Array.isArray(result) ? result : [];
        cache[hash] = { created: new Date(), items: items };
        done(items);
      }).catch(function (error) {
        console.log('Autocomplete source promise rejected', error, el);
        done([]);
      });
    }
  }

  function updatePlaceholder(e) {
    var any = parent.querySelector('.tay-tag');
    if (!any && !placeheld) {
      el.setAttribute('placeholder', placeholder);
      placeheld = true;
    } else if (any && placeheld) {
      el.removeAttribute('placeholder');
      placeheld = false;
    }
  }

  function bind(remove) {
    var op = remove ? 'remove' : 'add';
    var ev = remove ? 'off' : 'on';
    _crossvent2.default[op](el, 'keydown', keydown);
    _crossvent2.default[op](el, 'keypress', keypress);
    _crossvent2.default[op](el, 'paste', paste);
    _crossvent2.default[op](parent, 'click', click);
    if (convertOnBlur) {
      _crossvent2.default[op](document.documentElement, 'blur', documentblur, true);
    }
    if (placeholder) {
      api[ev]('add', updatePlaceholder);
      api[ev]('remove', updatePlaceholder);
      _crossvent2.default[op](el, 'keydown', updatePlaceholder);
      _crossvent2.default[op](el, 'keypress', updatePlaceholder);
      _crossvent2.default[op](el, 'paste', updatePlaceholder);
      _crossvent2.default[op](parent, 'click', updatePlaceholder);
      updatePlaceholder();
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

  function documentblur(e) {
    if (e.target !== el) {
      return;
    }
    convert(true);
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
    evaluateSelect([delimiter], true);
  }

  function convert(all) {
    (all ? evaluateNoSelect : evaluateSelect)([delimiter], all);
    if (all) {
      each(after, moveLeft);
    }
    return api;
  }

  function moveLeft(value, tag) {
    before.appendChild(tag);
  }

  function keydown(e) {
    var sel = (0, _selection2.default)(el);
    var key = e.which || e.keyCode || e.charCode;
    var canMoveLeft = sel.start === 0 && sel.end === 0 && before.lastChild;
    var canMoveRight = sel.start === el.value.length && sel.end === el.value.length && after.firstChild;
    if (free) {
      if (key === HOME) {
        if (before.firstChild) {
          focusTag(before.firstChild, {});
        } else {
          (0, _selection2.default)(el, { start: 0, end: 0 });
        }
      } else if (key === END) {
        if (after.lastChild) {
          focusTag(after.lastChild, end);
        } else {
          (0, _selection2.default)(el, end);
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
      } else if (sinkableKeys.indexOf(key) === -1) {
        // prevent default otherwise
        return;
      }
      if (completer) {
        completer.refreshPosition();
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
      return evaluateSelect();
    }, 0);
  }

  function evaluateNoSelect(extras, entirely) {
    evaluateInternal(extras, entirely); // necessary for blur events, initialization, unfocused evaluation
  }

  function evaluateSelect(extras, entirely) {
    evaluateInternal(extras, entirely, (0, _selection2.default)(el)); // only if we know the input has/should have focus
  }

  function evaluateInternal(extras, entirely, p) {
    var len = entirely || !p ? Infinity : p.start;
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
    reselect();
    shrinker.refresh();

    function reselect() {
      if (p) {
        p.start -= removal;
        p.end -= removal;
        (0, _selection2.default)(el, p);
      }
    }
  }

  function cleanup() {
    var tags = [];

    each(before, detect);
    each(after, detect);

    function detect(value, tagElement) {
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

  function defaultRenderer(container, item) {
    (0, _text2.default)(container, getText(item.data));
  }

  function readTag(tag) {
    return (0, _text2.default)(tag);
  }

  function focusTag(tag, p) {
    if (!tag) {
      return;
    }
    evaluateSelect([delimiter], true);
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
    (0, _selection2.default)(el, p);
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
};

},{"./autocomplete":22,"./autosize":23,"./dom":24,"./selection":25,"./text":27,"contra/emitter":13,"crossvent":17,"hash-sum":20}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = text;
function text(el, value) {
  if (arguments.length === 2) {
    el.innerText = el.textContent = value;
  }
  if (typeof el.innerText === 'string') {
    return el.innerText;
  }
  return el.textContent;
}

},{}]},{},[26])(26)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZGVib3VuY2UuanMiLCJub2RlX21vZHVsZXMvY29udHJhL2VtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy9hdG9hL2F0b2EuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9ub2RlX21vZHVsZXMvY3VzdG9tLWV2ZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvY3Jvc3N2ZW50LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvZXZlbnRtYXAuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZWFyY2gvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGFzaC1zdW0vaGFzaC1zdW0uanMiLCJub2RlX21vZHVsZXMvc2VsbC9zZWxsLmpzIiwic3JjL2F1dG9jb21wbGV0ZS5qcyIsInNyYy9hdXRvc2l6ZS5qcyIsInNyYy9kb20uanMiLCJzcmMvc2VsZWN0aW9uLmpzIiwic3JjL3RhZ2d5LmpzIiwic3JjL3RleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0EsWUFBWSxDQUFDOzs7OztrQkFlVyxZQUFZOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBVHBDLElBQU0sYUFBYSxHQUFHLENBQUMsQ0FBQztBQUN4QixJQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFDckIsSUFBTSxPQUFPLEdBQUcsRUFBRSxD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LENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQUEsQ0FBQyxDQUFDO0dBQ3ZFOztBQUVELFdBQVMsZUFBZSxDQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDckMsV0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0dBQ25DO0NBQ0YsQ0FBQTs7O0FDOWNELFlBQVksQ0FBQzs7Ozs7a0JBRVcsSUFBSTtBQUFiLFNBQVMsSUFBSSxDQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDdkMsTUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMxQixNQUFFLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO0dBQ3ZDO0FBQ0QsTUFBSSxPQUFPLEVBQUUsQ0FBQyxTQUFTLEtBQUssUUFBUSxFQUFFO0FBQ3BDLFdBQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQztHQUNyQjtBQUNELFNBQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQztDQUN2QiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJy4vdGhyb3R0bGUnKTtcbnZhciB0YWlsb3JtYWRlID0gcmVxdWlyZSgnLi90YWlsb3JtYWRlJyk7XG5cbmZ1bmN0aW9uIGJ1bGxzZXllIChlbCwgdGFyZ2V0LCBvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucztcbiAgdmFyIGRvbVRhcmdldCA9IHRhcmdldCAmJiB0YXJnZXQudGFnTmFtZTtcblxuICBpZiAoIWRvbVRhcmdldCAmJiBhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgbyA9IHRhcmdldDtcbiAgfVxuICBpZiAoIWRvbVRhcmdldCkge1xuICAgIHRhcmdldCA9IGVsO1xuICB9XG4gIGlmICghbykgeyBvID0ge307IH1cblxuICB2YXIgZGVzdHJveWVkID0gZmFsc2U7XG4gIHZhciB0aHJvdHRsZWRXcml0ZSA9IHRocm90dGxlKHdyaXRlLCAzMCk7XG4gIHZhciB0YWlsb3JPcHRpb25zID0geyB1cGRhdGU6IG8uYXV0b3VwZGF0ZVRvQ2FyZXQgIT09IGZhbHNlICYmIHVwZGF0ZSB9O1xuICB2YXIgdGFpbG9yID0gby5jYXJldCAmJiB0YWlsb3JtYWRlKHRhcmdldCwgdGFpbG9yT3B0aW9ucyk7XG5cbiAgd3JpdGUoKTtcblxuICBpZiAoby50cmFja2luZyAhPT0gZmFsc2UpIHtcbiAgICBjcm9zc3ZlbnQuYWRkKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcmVhZDogcmVhZE51bGwsXG4gICAgcmVmcmVzaDogd3JpdGUsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICBzbGVlcDogc2xlZXBcbiAgfTtcblxuICBmdW5jdGlvbiBzbGVlcCAoKSB7XG4gICAgdGFpbG9yT3B0aW9ucy5zbGVlcGluZyA9IHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkTnVsbCAoKSB7IHJldHVybiByZWFkKCk7IH1cblxuICBmdW5jdGlvbiByZWFkIChyZWFkaW5ncykge1xuICAgIHZhciBib3VuZHMgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdmFyIHNjcm9sbFRvcCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3A7XG4gICAgaWYgKHRhaWxvcikge1xuICAgICAgcmVhZGluZ3MgPSB0YWlsb3IucmVhZCgpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy5sZWZ0KSArIHJlYWRpbmdzLngsXG4gICAgICAgIHk6IChyZWFkaW5ncy5hYnNvbHV0ZSA/IDAgOiBib3VuZHMudG9wKSArIHNjcm9sbFRvcCArIHJlYWRpbmdzLnkgKyAyMFxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IGJvdW5kcy5sZWZ0LFxuICAgICAgeTogYm91bmRzLnRvcCArIHNjcm9sbFRvcFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGUgKHJlYWRpbmdzKSB7XG4gICAgd3JpdGUocmVhZGluZ3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKHJlYWRpbmdzKSB7XG4gICAgaWYgKGRlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCdWxsc2V5ZSBjYW5cXCd0IHJlZnJlc2ggYWZ0ZXIgYmVpbmcgZGVzdHJveWVkLiBDcmVhdGUgYW5vdGhlciBpbnN0YW5jZSBpbnN0ZWFkLicpO1xuICAgIH1cbiAgICBpZiAodGFpbG9yICYmICFyZWFkaW5ncykge1xuICAgICAgdGFpbG9yT3B0aW9ucy5zbGVlcGluZyA9IGZhbHNlO1xuICAgICAgdGFpbG9yLnJlZnJlc2goKTsgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcCA9IHJlYWQocmVhZGluZ3MpO1xuICAgIGlmICghdGFpbG9yICYmIHRhcmdldCAhPT0gZWwpIHtcbiAgICAgIHAueSArPSB0YXJnZXQub2Zmc2V0SGVpZ2h0O1xuICAgIH1cbiAgICBlbC5zdHlsZS5sZWZ0ID0gcC54ICsgJ3B4JztcbiAgICBlbC5zdHlsZS50b3AgPSBwLnkgKyAncHgnO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgaWYgKHRhaWxvcikgeyB0YWlsb3IuZGVzdHJveSgpOyB9XG4gICAgY3Jvc3N2ZW50LnJlbW92ZSh3aW5kb3csICdyZXNpemUnLCB0aHJvdHRsZWRXcml0ZSk7XG4gICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1bGxzZXllO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBnZXRTZWxlY3Rpb25SYXcgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblJhdycpO1xudmFyIGdldFNlbGVjdGlvbk51bGxPcCA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uTnVsbE9wJyk7XG52YXIgZ2V0U2VsZWN0aW9uU3ludGhldGljID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25TeW50aGV0aWMnKTtcbnZhciBpc0hvc3QgPSByZXF1aXJlKCcuL2lzSG9zdCcpO1xuaWYgKGlzSG9zdC5tZXRob2QoZ2xvYmFsLCAnZ2V0U2VsZWN0aW9uJykpIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uUmF3O1xufSBlbHNlIGlmICh0eXBlb2YgZG9jLnNlbGVjdGlvbiA9PT0gJ29iamVjdCcgJiYgZG9jLnNlbGVjdGlvbikge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25TeW50aGV0aWM7XG59IGVsc2Uge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wICgpIHt9XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbk51bGxPcCAoKSB7XG4gIHJldHVybiB7XG4gICAgcmVtb3ZlQWxsUmFuZ2VzOiBub29wLFxuICAgIGFkZFJhbmdlOiBub29wXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uTnVsbE9wO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25SYXcgKCkge1xuICByZXR1cm4gZ2xvYmFsLmdldFNlbGVjdGlvbigpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvblJhdztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuL3JhbmdlVG9UZXh0UmFuZ2UnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xudmFyIEdldFNlbGVjdGlvblByb3RvID0gR2V0U2VsZWN0aW9uLnByb3RvdHlwZTtcblxuZnVuY3Rpb24gR2V0U2VsZWN0aW9uIChzZWxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmFuZ2UgPSBzZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcblxuICB0aGlzLl9zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG4gIHRoaXMuX3JhbmdlcyA9IFtdO1xuXG4gIGlmIChzZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWxmKTtcbiAgfSBlbHNlIGlmIChpc1RleHRSYW5nZShyYW5nZSkpIHtcbiAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbGYsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWxmKTtcbiAgfVxufVxuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB0ZXh0UmFuZ2U7XG4gIHRyeSB7XG4gICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnTm9uZScpIHtcbiAgICAgIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgICB0ZXh0UmFuZ2Uuc2VsZWN0KCk7XG4gICAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICB1cGRhdGVFbXB0eVNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmFkZFJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocmFuZ2UpLnNlbGVjdCgpO1xuICAgIHRoaXMuX3Jhbmdlc1swXSA9IHJhbmdlO1xuICAgIHRoaXMucmFuZ2VDb3VudCA9IDE7XG4gICAgdGhpcy5pc0NvbGxhcHNlZCA9IHRoaXMuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UodGhpcywgcmFuZ2UsIGZhbHNlKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0UmFuZ2VzID0gZnVuY3Rpb24gKHJhbmdlcykge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB2YXIgcmFuZ2VDb3VudCA9IHJhbmdlcy5sZW5ndGg7XG4gIGlmIChyYW5nZUNvdW50ID4gMSkge1xuICAgIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2VzKTtcbiAgfSBlbHNlIGlmIChyYW5nZUNvdW50KSB7XG4gICAgdGhpcy5hZGRSYW5nZShyYW5nZXNbMF0pO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRSYW5nZUF0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5yYW5nZUNvdW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRSYW5nZUF0KCk6IGluZGV4IG91dCBvZiBib3VuZHMnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZ2VzW2luZGV4XS5jbG9uZVJhbmdlKCk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ0NvbnRyb2wnKSB7XG4gICAgcmVtb3ZlUmFuZ2VNYW51YWxseSh0aGlzLCByYW5nZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250cm9sUmFuZ2UgPSB0aGlzLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgdmFyIGVsO1xuICB2YXIgcmVtb3ZlZCA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBjb250cm9sUmFuZ2UuaXRlbShpKTtcbiAgICBpZiAoZWwgIT09IHJhbmdlRWxlbWVudCB8fCByZW1vdmVkKSB7XG4gICAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmVhY2hSYW5nZSA9IGZ1bmN0aW9uIChmbiwgcmV0dXJuVmFsdWUpIHtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuID0gdGhpcy5fcmFuZ2VzLmxlbmd0aDtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGZuKHRoaXMuZ2V0UmFuZ2VBdChpKSkpIHtcbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldEFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJhbmdlcyA9IFtdO1xuICB0aGlzLmVhY2hSYW5nZShmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICByYW5nZXMucHVzaChyYW5nZSk7XG4gIH0pO1xuICByZXR1cm4gcmFuZ2VzO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0U2luZ2xlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdGhpcy5hZGRSYW5nZShyYW5nZSk7XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDb250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlcykge1xuICB2YXIgY29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGVsLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB0cnkge1xuICAgICAgY29udHJvbFJhbmdlLmFkZChlbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXRSYW5nZXMoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgICB9XG4gIH1cbiAgY29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVJhbmdlTWFudWFsbHkgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIHJhbmdlcyA9IHNlbC5nZXRBbGxSYW5nZXMoKTtcbiAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc1NhbWVSYW5nZShyYW5nZSwgcmFuZ2VzW2ldKSkge1xuICAgICAgc2VsLmFkZFJhbmdlKHJhbmdlc1tpXSk7XG4gICAgfVxuICB9XG4gIGlmICghc2VsLnJhbmdlQ291bnQpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHZhciBhbmNob3JQcmVmaXggPSAnc3RhcnQnO1xuICB2YXIgZm9jdXNQcmVmaXggPSAnZW5kJztcbiAgc2VsLmFuY2hvck5vZGUgPSByYW5nZVthbmNob3JQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5hbmNob3JPZmZzZXQgPSByYW5nZVthbmNob3JQcmVmaXggKyAnT2Zmc2V0J107XG4gIHNlbC5mb2N1c05vZGUgPSByYW5nZVtmb2N1c1ByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmZvY3VzT2Zmc2V0ID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnT2Zmc2V0J107XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUVtcHR5U2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLmFuY2hvck5vZGUgPSBzZWwuZm9jdXNOb2RlID0gbnVsbDtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHNlbC5mb2N1c09mZnNldCA9IDA7XG4gIHNlbC5yYW5nZUNvdW50ID0gMDtcbiAgc2VsLmlzQ29sbGFwc2VkID0gdHJ1ZTtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQgKHJhbmdlTm9kZXMpIHtcbiAgaWYgKCFyYW5nZU5vZGVzLmxlbmd0aCB8fCByYW5nZU5vZGVzWzBdLm5vZGVUeXBlICE9PSAxKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAodmFyIGkgPSAxLCBsZW4gPSByYW5nZU5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc0FuY2VzdG9yT2YocmFuZ2VOb2Rlc1swXSwgcmFuZ2VOb2Rlc1tpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UgKHJhbmdlKSB7XG4gIHZhciBub2RlcyA9IHJhbmdlLmdldE5vZGVzKCk7XG4gIGlmICghcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQobm9kZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKCk6IHJhbmdlIGRpZCBub3QgY29uc2lzdCBvZiBhIHNpbmdsZSBlbGVtZW50Jyk7XG4gIH1cbiAgcmV0dXJuIG5vZGVzWzBdO1xufVxuXG5mdW5jdGlvbiBpc1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgcmV0dXJuIHJhbmdlICYmIHJhbmdlLnRleHQgIT09IHZvaWQgMDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRnJvbVRleHRSYW5nZSAoc2VsLCByYW5nZSkge1xuICBzZWwuX3JhbmdlcyA9IFtyYW5nZV07XG4gIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgcmFuZ2UsIGZhbHNlKTtcbiAgc2VsLnJhbmdlQ291bnQgPSAxO1xuICBzZWwuaXNDb2xsYXBzZWQgPSByYW5nZS5jb2xsYXBzZWQ7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xuICBpZiAoc2VsLl9zZWxlY3Rpb24udHlwZSA9PT0gJ05vbmUnKSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoaXNUZXh0UmFuZ2UoY29udHJvbFJhbmdlKSkge1xuICAgICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWwsIGNvbnRyb2xSYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbC5yYW5nZUNvdW50ID0gY29udHJvbFJhbmdlLmxlbmd0aDtcbiAgICAgIHZhciByYW5nZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlQ291bnQ7ICsraSkge1xuICAgICAgICByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgICAgICByYW5nZS5zZWxlY3ROb2RlKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICAgICAgc2VsLl9yYW5nZXMucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgICBzZWwuaXNDb2xsYXBzZWQgPSBzZWwucmFuZ2VDb3VudCA9PT0gMSAmJiBzZWwuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHNlbC5fcmFuZ2VzW3NlbC5yYW5nZUNvdW50IC0gMV0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgfVxuICB0cnkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQocmFuZ2VFbGVtZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignYWRkUmFuZ2UoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUmFuZ2UgKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiAoXG4gICAgbGVmdC5zdGFydENvbnRhaW5lciA9PT0gcmlnaHQuc3RhcnRDb250YWluZXIgJiZcbiAgICBsZWZ0LnN0YXJ0T2Zmc2V0ID09PSByaWdodC5zdGFydE9mZnNldCAmJlxuICAgIGxlZnQuZW5kQ29udGFpbmVyID09PSByaWdodC5lbmRDb250YWluZXIgJiZcbiAgICBsZWZ0LmVuZE9mZnNldCA9PT0gcmlnaHQuZW5kT2Zmc2V0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQW5jZXN0b3JPZiAoYW5jZXN0b3IsIGRlc2NlbmRhbnQpIHtcbiAgdmFyIG5vZGUgPSBkZXNjZW5kYW50O1xuICB3aGlsZSAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gYW5jZXN0b3IpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBHZXRTZWxlY3Rpb24oZ2xvYmFsLmRvY3VtZW50LnNlbGVjdGlvbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBpc0hvc3RNZXRob2QgKGhvc3QsIHByb3ApIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgaG9zdFtwcm9wXTtcbiAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgISEodHlwZSA9PT0gJ29iamVjdCcgJiYgaG9zdFtwcm9wXSkgfHwgdHlwZSA9PT0gJ3Vua25vd24nO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RQcm9wZXJ0eSAoaG9zdCwgcHJvcCkge1xuICByZXR1cm4gdHlwZW9mIGhvc3RbcHJvcF0gIT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBtYW55IChmbikge1xuICByZXR1cm4gZnVuY3Rpb24gYXJlSG9zdGVkIChob3N0LCBwcm9wcykge1xuICAgIHZhciBpID0gcHJvcHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGlmICghZm4oaG9zdCwgcHJvcHNbaV0pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRob2Q6IGlzSG9zdE1ldGhvZCxcbiAgbWV0aG9kczogbWFueShpc0hvc3RNZXRob2QpLFxuICBwcm9wZXJ0eTogaXNIb3N0UHJvcGVydHksXG4gIHByb3BlcnRpZXM6IG1hbnkoaXNIb3N0UHJvcGVydHkpXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gcmFuZ2VUb1RleHRSYW5nZSAocCkge1xuICBpZiAocC5jb2xsYXBzZWQpIHtcbiAgICByZXR1cm4gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHAuc3RhcnRPZmZzZXQgfSwgdHJ1ZSk7XG4gIH1cbiAgdmFyIHN0YXJ0UmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgdmFyIGVuZFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLmVuZENvbnRhaW5lciwgb2Zmc2V0OiBwLmVuZE9mZnNldCB9LCBmYWxzZSk7XG4gIHZhciB0ZXh0UmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICB0ZXh0UmFuZ2Uuc2V0RW5kUG9pbnQoJ1N0YXJ0VG9TdGFydCcsIHN0YXJ0UmFuZ2UpO1xuICB0ZXh0UmFuZ2Uuc2V0RW5kUG9pbnQoJ0VuZFRvRW5kJywgZW5kUmFuZ2UpO1xuICByZXR1cm4gdGV4dFJhbmdlO1xufVxuXG5mdW5jdGlvbiBpc0NoYXJhY3RlckRhdGFOb2RlIChub2RlKSB7XG4gIHZhciB0ID0gbm9kZS5ub2RlVHlwZTtcbiAgcmV0dXJuIHQgPT09IDMgfHwgdCA9PT0gNCB8fCB0ID09PSA4IDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UgKHAsIHN0YXJ0aW5nKSB7XG4gIHZhciBib3VuZDtcbiAgdmFyIHBhcmVudDtcbiAgdmFyIG9mZnNldCA9IHAub2Zmc2V0O1xuICB2YXIgd29ya2luZ05vZGU7XG4gIHZhciBjaGlsZE5vZGVzO1xuICB2YXIgcmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICB2YXIgZGF0YSA9IGlzQ2hhcmFjdGVyRGF0YU5vZGUocC5ub2RlKTtcblxuICBpZiAoZGF0YSkge1xuICAgIGJvdW5kID0gcC5ub2RlO1xuICAgIHBhcmVudCA9IGJvdW5kLnBhcmVudE5vZGU7XG4gIH0gZWxzZSB7XG4gICAgY2hpbGROb2RlcyA9IHAubm9kZS5jaGlsZE5vZGVzO1xuICAgIGJvdW5kID0gb2Zmc2V0IDwgY2hpbGROb2Rlcy5sZW5ndGggPyBjaGlsZE5vZGVzW29mZnNldF0gOiBudWxsO1xuICAgIHBhcmVudCA9IHAubm9kZTtcbiAgfVxuXG4gIHdvcmtpbmdOb2RlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgd29ya2luZ05vZGUuaW5uZXJIVE1MID0gJyYjZmVmZjsnO1xuXG4gIGlmIChib3VuZCkge1xuICAgIHBhcmVudC5pbnNlcnRCZWZvcmUod29ya2luZ05vZGUsIGJvdW5kKTtcbiAgfSBlbHNlIHtcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQod29ya2luZ05vZGUpO1xuICB9XG5cbiAgcmFuZ2UubW92ZVRvRWxlbWVudFRleHQod29ya2luZ05vZGUpO1xuICByYW5nZS5jb2xsYXBzZSghc3RhcnRpbmcpO1xuICBwYXJlbnQucmVtb3ZlQ2hpbGQod29ya2luZ05vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgcmFuZ2Vbc3RhcnRpbmcgPyAnbW92ZVN0YXJ0JyA6ICdtb3ZlRW5kJ10oJ2NoYXJhY3RlcicsIG9mZnNldCk7XG4gIH1cbiAgcmV0dXJuIHJhbmdlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmdlVG9UZXh0UmFuZ2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbicpO1xudmFyIHNldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vc2V0U2VsZWN0aW9uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXQ6IGdldFNlbGVjdGlvbixcbiAgc2V0OiBzZXRTZWxlY3Rpb25cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbicpO1xudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuL3JhbmdlVG9UZXh0UmFuZ2UnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIHNldFNlbGVjdGlvbiAocCkge1xuICBpZiAoZG9jLmNyZWF0ZVJhbmdlKSB7XG4gICAgbW9kZXJuU2VsZWN0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgb2xkU2VsZWN0aW9uKCk7XG4gIH1cblxuICBmdW5jdGlvbiBtb2Rlcm5TZWxlY3Rpb24gKCkge1xuICAgIHZhciBzZWwgPSBnZXRTZWxlY3Rpb24oKTtcbiAgICB2YXIgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoIXAuc3RhcnRDb250YWluZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHAuZW5kQ29udGFpbmVyKSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5lbmRDb250YWluZXIsIHAuZW5kT2Zmc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmFuZ2Uuc2V0RW5kKHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIH1cbiAgICByYW5nZS5zZXRTdGFydChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgc2VsLmFkZFJhbmdlKHJhbmdlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9sZFNlbGVjdGlvbiAoKSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShwKS5zZWxlY3QoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNlbGwgPSByZXF1aXJlKCdzZWxsJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgc2VsZWNjaW9uID0gcmVxdWlyZSgnc2VsZWNjaW9uJyk7XG52YXIgdGhyb3R0bGUgPSByZXF1aXJlKCcuL3Rocm90dGxlJyk7XG52YXIgZ2V0U2VsZWN0aW9uID0gc2VsZWNjaW9uLmdldDtcbnZhciBwcm9wcyA9IFtcbiAgJ2RpcmVjdGlvbicsXG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLFxuICAnaGVpZ2h0JyxcbiAgJ292ZXJmbG93WCcsXG4gICdvdmVyZmxvd1knLFxuICAnYm9yZGVyVG9wV2lkdGgnLFxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXG4gICdib3JkZXJCb3R0b21XaWR0aCcsXG4gICdib3JkZXJMZWZ0V2lkdGgnLFxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG4gICdmb250U3R5bGUnLFxuICAnZm9udFZhcmlhbnQnLFxuICAnZm9udFdlaWdodCcsXG4gICdmb250U3RyZXRjaCcsXG4gICdmb250U2l6ZScsXG4gICdmb250U2l6ZUFkanVzdCcsXG4gICdsaW5lSGVpZ2h0JyxcbiAgJ2ZvbnRGYW1pbHknLFxuICAndGV4dEFsaWduJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAndGV4dEluZGVudCcsXG4gICd0ZXh0RGVjb3JhdGlvbicsXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3dvcmRTcGFjaW5nJ1xuXTtcbnZhciB3aW4gPSBnbG9iYWw7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgZmYgPSB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSBudWxsICYmIHdpbi5tb3pJbm5lclNjcmVlblggIT09IHZvaWQgMDtcblxuZnVuY3Rpb24gdGFpbG9ybWFkZSAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRleHRJbnB1dCA9IGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgdmFyIHRocm90dGxlZFJlZnJlc2ggPSB0aHJvdHRsZShyZWZyZXNoLCAzMCk7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcblxuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkUG9zaXRpb24sXG4gICAgcmVmcmVzaDogdGhyb3R0bGVkUmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gbm9vcCAoKSB7fVxuICBmdW5jdGlvbiByZWFkUG9zaXRpb24gKCkgeyByZXR1cm4gKHRleHRJbnB1dCA/IGNvb3Jkc1RleHQgOiBjb29yZHNIVE1MKSgpOyB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgaWYgKG8uc2xlZXBpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIChvLnVwZGF0ZSB8fCBub29wKShyZWFkUG9zaXRpb24oKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNUZXh0ICgpIHtcbiAgICB2YXIgcCA9IHNlbGwoZWwpO1xuICAgIHZhciBjb250ZXh0ID0gcHJlcGFyZSgpO1xuICAgIHZhciByZWFkaW5ncyA9IHJlYWRUZXh0Q29vcmRzKGNvbnRleHQsIHAuc3RhcnQpO1xuICAgIGRvYy5ib2R5LnJlbW92ZUNoaWxkKGNvbnRleHQubWlycm9yKTtcbiAgICByZXR1cm4gcmVhZGluZ3M7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNIVE1MICgpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgaWYgKHNlbC5yYW5nZUNvdW50KSB7XG4gICAgICB2YXIgcmFuZ2UgPSBzZWwuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgIHZhciBuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcgPSByYW5nZS5zdGFydENvbnRhaW5lci5ub2RlTmFtZSA9PT0gJ1AnICYmIHJhbmdlLnN0YXJ0T2Zmc2V0ID09PSAwO1xuICAgICAgaWYgKG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1Zykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHg6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldExlZnQsXG4gICAgICAgICAgeTogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0VG9wLFxuICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2UuZ2V0Q2xpZW50UmVjdHMpIHtcbiAgICAgICAgdmFyIHJlY3RzID0gcmFuZ2UuZ2V0Q2xpZW50UmVjdHMoKTtcbiAgICAgICAgaWYgKHJlY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogcmVjdHNbMF0ubGVmdCxcbiAgICAgICAgICAgIHk6IHJlY3RzWzBdLnRvcCxcbiAgICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGV4dENvb3JkcyAoY29udGV4dCwgcCkge1xuICAgIHZhciByZXN0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICB2YXIgbWlycm9yID0gY29udGV4dC5taXJyb3I7XG4gICAgdmFyIGNvbXB1dGVkID0gY29udGV4dC5jb21wdXRlZDtcblxuICAgIHdyaXRlKG1pcnJvciwgcmVhZChlbCkuc3Vic3RyaW5nKDAsIHApKTtcblxuICAgIGlmIChlbC50YWdOYW1lID09PSAnSU5QVVQnKSB7XG4gICAgICBtaXJyb3IudGV4dENvbnRlbnQgPSBtaXJyb3IudGV4dENvbnRlbnQucmVwbGFjZSgvXFxzL2csICdcXHUwMGEwJyk7XG4gICAgfVxuXG4gICAgd3JpdGUocmVzdCwgcmVhZChlbCkuc3Vic3RyaW5nKHApIHx8ICcuJyk7XG5cbiAgICBtaXJyb3IuYXBwZW5kQ2hpbGQocmVzdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogcmVzdC5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcbiAgICAgIHk6IHJlc3Qub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGVsKSB7XG4gICAgcmV0dXJuIHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJlcGFyZSAoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gd2luLmdldENvbXB1dGVkU3R5bGUgPyBnZXRDb21wdXRlZFN0eWxlKGVsKSA6IGVsLmN1cnJlbnRTdHlsZTtcbiAgICB2YXIgbWlycm9yID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHZhciBzdHlsZSA9IG1pcnJvci5zdHlsZTtcblxuICAgIGRvYy5ib2R5LmFwcGVuZENoaWxkKG1pcnJvcik7XG5cbiAgICBpZiAoZWwudGFnTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgc3R5bGUud29yZFdyYXAgPSAnYnJlYWstd29yZCc7XG4gICAgfVxuICAgIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICAgIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBzdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgcHJvcHMuZm9yRWFjaChjb3B5KTtcblxuICAgIGlmIChmZikge1xuICAgICAgc3R5bGUud2lkdGggPSBwYXJzZUludChjb21wdXRlZC53aWR0aCkgLSAyICsgJ3B4JztcbiAgICAgIGlmIChlbC5zY3JvbGxIZWlnaHQgPiBwYXJzZUludChjb21wdXRlZC5oZWlnaHQpKSB7XG4gICAgICAgIHN0eWxlLm92ZXJmbG93WSA9ICdzY3JvbGwnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuICAgIH1cbiAgICByZXR1cm4geyBtaXJyb3I6IG1pcnJvciwgY29tcHV0ZWQ6IGNvbXB1dGVkIH07XG5cbiAgICBmdW5jdGlvbiBjb3B5IChwcm9wKSB7XG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChlbCwgdmFsdWUpIHtcbiAgICBpZiAodGV4dElucHV0KSB7XG4gICAgICBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRhaWxvcm1hZGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRocm90dGxlIChmbiwgYm91bmRhcnkpIHtcbiAgdmFyIGxhc3QgPSAtSW5maW5pdHk7XG4gIHZhciB0aW1lcjtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJvdW5jZWQgKCkge1xuICAgIGlmICh0aW1lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB1bmJvdW5kKCk7XG5cbiAgICBmdW5jdGlvbiB1bmJvdW5kICgpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICB0aW1lciA9IG51bGw7XG4gICAgICB2YXIgbmV4dCA9IGxhc3QgKyBib3VuZGFyeTtcbiAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyA+IG5leHQpIHtcbiAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgZm4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVyID0gc2V0VGltZW91dCh1bmJvdW5kLCBuZXh0IC0gbm93KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGhyb3R0bGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0aWNreSA9IHJlcXVpcmUoJ3RpY2t5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVib3VuY2UgKGZuLCBhcmdzLCBjdHgpIHtcbiAgaWYgKCFmbikgeyByZXR1cm47IH1cbiAgdGlja3koZnVuY3Rpb24gcnVuICgpIHtcbiAgICBmbi5hcHBseShjdHggfHwgbnVsbCwgYXJncyB8fCBbXSk7XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGF0b2EgPSByZXF1aXJlKCdhdG9hJyk7XG52YXIgZGVib3VuY2UgPSByZXF1aXJlKCcuL2RlYm91bmNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW1pdHRlciAodGhpbmcsIG9wdGlvbnMpIHtcbiAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZXZ0ID0ge307XG4gIGlmICh0aGluZyA9PT0gdW5kZWZpbmVkKSB7IHRoaW5nID0ge307IH1cbiAgdGhpbmcub24gPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICBpZiAoIWV2dFt0eXBlXSkge1xuICAgICAgZXZ0W3R5cGVdID0gW2ZuXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXZ0W3R5cGVdLnB1c2goZm4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9uY2UgPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICBmbi5fb25jZSA9IHRydWU7IC8vIHRoaW5nLm9mZihmbikgc3RpbGwgd29ya3MhXG4gICAgdGhpbmcub24odHlwZSwgZm4pO1xuICAgIHJldHVybiB0aGluZztcbiAgfTtcbiAgdGhpbmcub2ZmID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChjID09PSAxKSB7XG4gICAgICBkZWxldGUgZXZ0W3R5cGVdO1xuICAgIH0gZWxzZSBpZiAoYyA9PT0gMCkge1xuICAgICAgZXZ0ID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBldCA9IGV2dFt0eXBlXTtcbiAgICAgIGlmICghZXQpIHsgcmV0dXJuIHRoaW5nOyB9XG4gICAgICBldC5zcGxpY2UoZXQuaW5kZXhPZihmbiksIDEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLmVtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHRoaW5nLmVtaXR0ZXJTbmFwc2hvdChhcmdzLnNoaWZ0KCkpLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9O1xuICB0aGluZy5lbWl0dGVyU25hcHNob3QgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgIHZhciBldCA9IChldnRbdHlwZV0gfHwgW10pLnNsaWNlKDApO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgYXJncyA9IGF0b2EoYXJndW1lbnRzKTtcbiAgICAgIHZhciBjdHggPSB0aGlzIHx8IHRoaW5nO1xuICAgICAgaWYgKHR5cGUgPT09ICdlcnJvcicgJiYgb3B0cy50aHJvd3MgIT09IGZhbHNlICYmICFldC5sZW5ndGgpIHsgdGhyb3cgYXJncy5sZW5ndGggPT09IDEgPyBhcmdzWzBdIDogYXJnczsgfVxuICAgICAgZXQuZm9yRWFjaChmdW5jdGlvbiBlbWl0dGVyIChsaXN0ZW4pIHtcbiAgICAgICAgaWYgKG9wdHMuYXN5bmMpIHsgZGVib3VuY2UobGlzdGVuLCBhcmdzLCBjdHgpOyB9IGVsc2UgeyBsaXN0ZW4uYXBwbHkoY3R4LCBhcmdzKTsgfVxuICAgICAgICBpZiAobGlzdGVuLl9vbmNlKSB7IHRoaW5nLm9mZih0eXBlLCBsaXN0ZW4pOyB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGluZztcbiAgICB9O1xuICB9O1xuICByZXR1cm4gdGhpbmc7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuIiwidmFyIHNpID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJywgdGljaztcbmlmIChzaSkge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldEltbWVkaWF0ZShmbik7IH07XG59IGVsc2Uge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRpY2s7IiwiXG52YXIgTmF0aXZlQ3VzdG9tRXZlbnQgPSBnbG9iYWwuQ3VzdG9tRXZlbnQ7XG5cbmZ1bmN0aW9uIHVzZU5hdGl2ZSAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHAgPSBuZXcgTmF0aXZlQ3VzdG9tRXZlbnQoJ2NhdCcsIHsgZGV0YWlsOiB7IGZvbzogJ2JhcicgfSB9KTtcbiAgICByZXR1cm4gICdjYXQnID09PSBwLnR5cGUgJiYgJ2JhcicgPT09IHAuZGV0YWlsLmZvbztcbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcm9zcy1icm93c2VyIGBDdXN0b21FdmVudGAgY29uc3RydWN0b3IuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0N1c3RvbUV2ZW50LkN1c3RvbUV2ZW50XG4gKlxuICogQHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdXNlTmF0aXZlKCkgPyBOYXRpdmVDdXN0b21FdmVudCA6XG5cbi8vIElFID49IDlcbidmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA/IGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCk7XG4gIH0gZWxzZSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgZmFsc2UsIGZhbHNlLCB2b2lkIDApO1xuICB9XG4gIHJldHVybiBlO1xufSA6XG5cbi8vIElFIDw9IDhcbmZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICBlLnR5cGUgPSB0eXBlO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5idWJibGVzID0gQm9vbGVhbihwYXJhbXMuYnViYmxlcyk7XG4gICAgZS5jYW5jZWxhYmxlID0gQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSk7XG4gICAgZS5kZXRhaWwgPSBwYXJhbXMuZGV0YWlsO1xuICB9IGVsc2Uge1xuICAgIGUuYnViYmxlcyA9IGZhbHNlO1xuICAgIGUuY2FuY2VsYWJsZSA9IGZhbHNlO1xuICAgIGUuZGV0YWlsID0gdm9pZCAwO1xuICB9XG4gIHJldHVybiBlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3VzdG9tRXZlbnQgPSByZXF1aXJlKCdjdXN0b20tZXZlbnQnKTtcbnZhciBldmVudG1hcCA9IHJlcXVpcmUoJy4vZXZlbnRtYXAnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYWRkRXZlbnQgPSBhZGRFdmVudEVhc3k7XG52YXIgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEVhc3k7XG52YXIgaGFyZENhY2hlID0gW107XG5cbmlmICghZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgYWRkRXZlbnQgPSBhZGRFdmVudEhhcmQ7XG4gIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRIYXJkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRFdmVudCxcbiAgcmVtb3ZlOiByZW1vdmVFdmVudCxcbiAgZmFicmljYXRlOiBmYWJyaWNhdGVFdmVudFxufTtcblxuZnVuY3Rpb24gYWRkRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCB3cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgbGlzdGVuZXIgPSB1bndyYXAoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIGVsLmRldGFjaEV2ZW50KCdvbicgKyB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmFicmljYXRlRXZlbnQgKGVsLCB0eXBlLCBtb2RlbCkge1xuICB2YXIgZSA9IGV2ZW50bWFwLmluZGV4T2YodHlwZSkgPT09IC0xID8gbWFrZUN1c3RvbUV2ZW50KCkgOiBtYWtlQ2xhc3NpY0V2ZW50KCk7XG4gIGlmIChlbC5kaXNwYXRjaEV2ZW50KSB7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5maXJlRXZlbnQoJ29uJyArIHR5cGUsIGUpO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDbGFzc2ljRXZlbnQgKCkge1xuICAgIHZhciBlO1xuICAgIGlmIChkb2MuY3JlYXRlRXZlbnQpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG4gICAgICBlLmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGRvYy5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gZTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ3VzdG9tRXZlbnQgKCkge1xuICAgIHJldHVybiBuZXcgY3VzdG9tRXZlbnQodHlwZSwgeyBkZXRhaWw6IG1vZGVsIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBwZXJGYWN0b3J5IChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZXIgKG9yaWdpbmFsRXZlbnQpIHtcbiAgICB2YXIgZSA9IG9yaWdpbmFsRXZlbnQgfHwgZ2xvYmFsLmV2ZW50O1xuICAgIGUudGFyZ2V0ID0gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50O1xuICAgIGUucHJldmVudERlZmF1bHQgPSBlLnByZXZlbnREZWZhdWx0IHx8IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0ICgpIHsgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlOyB9O1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uID0gZS5zdG9wUHJvcGFnYXRpb24gfHwgZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uICgpIHsgZS5jYW5jZWxCdWJibGUgPSB0cnVlOyB9O1xuICAgIGUud2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBmbi5jYWxsKGVsLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciB3cmFwcGVyID0gdW53cmFwKGVsLCB0eXBlLCBmbikgfHwgd3JhcHBlckZhY3RvcnkoZWwsIHR5cGUsIGZuKTtcbiAgaGFyZENhY2hlLnB1c2goe1xuICAgIHdyYXBwZXI6IHdyYXBwZXIsXG4gICAgZWxlbWVudDogZWwsXG4gICAgdHlwZTogdHlwZSxcbiAgICBmbjogZm5cbiAgfSk7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiB1bndyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSA9IGZpbmQoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGkpIHtcbiAgICB2YXIgd3JhcHBlciA9IGhhcmRDYWNoZVtpXS53cmFwcGVyO1xuICAgIGhhcmRDYWNoZS5zcGxpY2UoaSwgMSk7IC8vIGZyZWUgdXAgYSB0YWQgb2YgbWVtb3J5XG4gICAgcmV0dXJuIHdyYXBwZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpLCBpdGVtO1xuICBmb3IgKGkgPSAwOyBpIDwgaGFyZENhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaXRlbSA9IGhhcmRDYWNoZVtpXTtcbiAgICBpZiAoaXRlbS5lbGVtZW50ID09PSBlbCAmJiBpdGVtLnR5cGUgPT09IHR5cGUgJiYgaXRlbS5mbiA9PT0gZm4pIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXZlbnRtYXAgPSBbXTtcbnZhciBldmVudG5hbWUgPSAnJztcbnZhciByb24gPSAvXm9uLztcblxuZm9yIChldmVudG5hbWUgaW4gZ2xvYmFsKSB7XG4gIGlmIChyb24udGVzdChldmVudG5hbWUpKSB7XG4gICAgZXZlbnRtYXAucHVzaChldmVudG5hbWUuc2xpY2UoMikpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRtYXA7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZ1enp5c2VhcmNoIChuZWVkbGUsIGhheXN0YWNrKSB7XG4gIHZhciB0bGVuID0gaGF5c3RhY2subGVuZ3RoO1xuICB2YXIgcWxlbiA9IG5lZWRsZS5sZW5ndGg7XG4gIGlmIChxbGVuID4gdGxlbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAocWxlbiA9PT0gdGxlbikge1xuICAgIHJldHVybiBuZWVkbGUgPT09IGhheXN0YWNrO1xuICB9XG4gIG91dGVyOiBmb3IgKHZhciBpID0gMCwgaiA9IDA7IGkgPCBxbGVuOyBpKyspIHtcbiAgICB2YXIgbmNoID0gbmVlZGxlLmNoYXJDb2RlQXQoaSk7XG4gICAgd2hpbGUgKGogPCB0bGVuKSB7XG4gICAgICBpZiAoaGF5c3RhY2suY2hhckNvZGVBdChqKyspID09PSBuY2gpIHtcbiAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdXp6eXNlYXJjaDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gcGFkIChoYXNoLCBsZW4pIHtcbiAgd2hpbGUgKGhhc2gubGVuZ3RoIDwgbGVuKSB7XG4gICAgaGFzaCA9ICcwJyArIGhhc2g7XG4gIH1cbiAgcmV0dXJuIGhhc2g7XG59XG5cbmZ1bmN0aW9uIGZvbGQgKGhhc2gsIHRleHQpIHtcbiAgdmFyIGk7XG4gIHZhciBjaHI7XG4gIHZhciBsZW47XG4gIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBoYXNoO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IHRleHQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjaHIgPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XG4gICAgaGFzaCA9ICgoaGFzaCA8PCA1KSAtIGhhc2gpICsgY2hyO1xuICAgIGhhc2ggfD0gMDtcbiAgfVxuICByZXR1cm4gaGFzaCA8IDAgPyBoYXNoICogLTIgOiBoYXNoO1xufVxuXG5mdW5jdGlvbiBmb2xkT2JqZWN0IChoYXNoLCBvLCBzZWVuKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvKS5zb3J0KCkucmVkdWNlKGZvbGRLZXksIGhhc2gpO1xuICBmdW5jdGlvbiBmb2xkS2V5IChoYXNoLCBrZXkpIHtcbiAgICByZXR1cm4gZm9sZFZhbHVlKGhhc2gsIG9ba2V5XSwga2V5LCBzZWVuKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb2xkVmFsdWUgKGlucHV0LCB2YWx1ZSwga2V5LCBzZWVuKSB7XG4gIHZhciBoYXNoID0gZm9sZChmb2xkKGZvbGQoaW5wdXQsIGtleSksIHRvU3RyaW5nKHZhbHVlKSksIHR5cGVvZiB2YWx1ZSk7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmb2xkKGhhc2gsICdudWxsJyk7XG4gIH1cbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZm9sZChoYXNoLCAndW5kZWZpbmVkJyk7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoc2Vlbi5pbmRleE9mKHZhbHVlKSAhPT0gLTEpIHtcbiAgICAgIHJldHVybiBmb2xkKGhhc2gsICdbQ2lyY3VsYXJdJyArIGtleSk7XG4gICAgfVxuICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG4gICAgcmV0dXJuIGZvbGRPYmplY3QoaGFzaCwgdmFsdWUsIHNlZW4pO1xuICB9XG4gIHJldHVybiBmb2xkKGhhc2gsIHZhbHVlLnRvU3RyaW5nKCkpO1xufVxuXG5mdW5jdGlvbiB0b1N0cmluZyAobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5mdW5jdGlvbiBzdW0gKG8pIHtcbiAgcmV0dXJuIHBhZChmb2xkVmFsdWUoMCwgbywgJycsIFtdKS50b1N0cmluZygxNiksIDgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN1bTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcblxuaWYgKGRvY3VtZW50LnNlbGVjdGlvbiAmJiBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UpIHtcbiAgZ2V0ID0gaGFyZEdldDtcbiAgc2V0ID0gaGFyZFNldDtcbn1cblxuZnVuY3Rpb24gZWFzeUdldCAoZWwpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZWwuc2VsZWN0aW9uU3RhcnQsXG4gICAgZW5kOiBlbC5zZWxlY3Rpb25FbmRcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFyZEdldCAoZWwpIHtcbiAgdmFyIGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGlmIChhY3RpdmUgIT09IGVsKSB7XG4gICAgZWwuZm9jdXMoKTtcbiAgfVxuXG4gIHZhciByYW5nZSA9IGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgYm9va21hcmsgPSByYW5nZS5nZXRCb29rbWFyaygpO1xuICB2YXIgb3JpZ2luYWwgPSBlbC52YWx1ZTtcbiAgdmFyIG1hcmtlciA9IGdldFVuaXF1ZU1hcmtlcihvcmlnaW5hbCk7XG4gIHZhciBwYXJlbnQgPSByYW5nZS5wYXJlbnRFbGVtZW50KCk7XG4gIGlmIChwYXJlbnQgPT09IG51bGwgfHwgIWlucHV0cyhwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdCgwLCAwKTtcbiAgfVxuICByYW5nZS50ZXh0ID0gbWFya2VyICsgcmFuZ2UudGV4dCArIG1hcmtlcjtcblxuICB2YXIgY29udGVudHMgPSBlbC52YWx1ZTtcblxuICBlbC52YWx1ZSA9IG9yaWdpbmFsO1xuICByYW5nZS5tb3ZlVG9Cb29rbWFyayhib29rbWFyayk7XG4gIHJhbmdlLnNlbGVjdCgpO1xuXG4gIHJldHVybiByZXN1bHQoY29udGVudHMuaW5kZXhPZihtYXJrZXIpLCBjb250ZW50cy5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aCk7XG5cbiAgZnVuY3Rpb24gcmVzdWx0IChzdGFydCwgZW5kKSB7XG4gICAgaWYgKGFjdGl2ZSAhPT0gZWwpIHsgLy8gZG9uJ3QgZGlzcnVwdCBwcmUtZXhpc3Rpbmcgc3RhdGVcbiAgICAgIGlmIChhY3RpdmUpIHtcbiAgICAgICAgYWN0aXZlLmZvY3VzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5ibHVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXJ0OiBzdGFydCwgZW5kOiBlbmQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRVbmlxdWVNYXJrZXIgKGNvbnRlbnRzKSB7XG4gIHZhciBtYXJrZXI7XG4gIGRvIHtcbiAgICBtYXJrZXIgPSAnQEBtYXJrZXIuJyArIE1hdGgucmFuZG9tKCkgKiBuZXcgRGF0ZSgpO1xuICB9IHdoaWxlIChjb250ZW50cy5pbmRleE9mKG1hcmtlcikgIT09IC0xKTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gaW5wdXRzIChlbCkge1xuICByZXR1cm4gKChlbC50YWdOYW1lID09PSAnSU5QVVQnICYmIGVsLnR5cGUgPT09ICd0ZXh0JykgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyk7XG59XG5cbmZ1bmN0aW9uIGVhc3lTZXQgKGVsLCBwKSB7XG4gIGVsLnNlbGVjdGlvblN0YXJ0ID0gcGFyc2UoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBwYXJzZShlbCwgcC5lbmQpO1xufVxuXG5mdW5jdGlvbiBoYXJkU2V0IChlbCwgcCkge1xuICB2YXIgcmFuZ2UgPSBlbC5jcmVhdGVUZXh0UmFuZ2UoKTtcblxuICBpZiAocC5zdGFydCA9PT0gJ2VuZCcgJiYgcC5lbmQgPT09ICdlbmQnKSB7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlLmNvbGxhcHNlKHRydWUpO1xuICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLmVuZCkpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcGFyc2UoZWwsIHAuc3RhcnQpKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZSAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxsIChlbCwgcCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHNldChlbCwgcCk7XG4gIH1cbiAgcmV0dXJuIGdldChlbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsbDtcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHNlbGwgZnJvbSAnc2VsbCc7XG5pbXBvcnQgY3Jvc3N2ZW50IGZyb20gJ2Nyb3NzdmVudCc7XG5pbXBvcnQgYnVsbHNleWUgZnJvbSAnYnVsbHNleWUnO1xuaW1wb3J0IGZ1enp5c2VhcmNoIGZyb20gJ2Z1enp5c2VhcmNoJztcbmNvbnN0IEtFWV9CQUNLU1BBQ0UgPSA4O1xuY29uc3QgS0VZX0VOVEVSID0gMTM7XG5jb25zdCBLRVlfRVNDID0gMjc7XG5jb25zdCBLRVlfVVAgPSAzODtcbmNvbnN0IEtFWV9ET1dOID0gNDA7XG5jb25zdCBLRVlfVEFCID0gOTtcbmNvbnN0IGRvYyA9IGRvY3VtZW50O1xuY29uc3QgZG9jRWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGF1dG9jb21wbGV0ZSAoZWwsIG9wdGlvbnMpIHtcbiAgY29uc3QgbyA9IG9wdGlvbnMgfHwge307XG4gIGNvbnN0IHBhcmVudCA9IG8uYXBwZW5kVG8gfHwgZG9jLmJvZHk7XG4gIGNvbnN0IHJlbmRlciA9IG8ucmVuZGVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcbiAgY29uc3Qge2dldFRleHQsIGdldFZhbHVlLCBmb3JtLCBzdWdnZXN0aW9uc30gPSBvO1xuICBjb25zdCBsaW1pdCA9IHR5cGVvZiBvLmxpbWl0ID09PSAnbnVtYmVyJyA/IG8ubGltaXQgOiBJbmZpbml0eTtcbiAgY29uc3QgdXNlckZpbHRlciA9IG8uZmlsdGVyIHx8IGRlZmF1bHRGaWx0ZXI7XG4gIGNvbnN0IHVzZXJTZXQgPSBvLnNldCB8fCBkZWZhdWx0U2V0dGVyO1xuICBjb25zdCB1bCA9IHRhZygndWwnLCAndGFjLWxpc3QnKTtcbiAgY29uc3QgZGVmZXJyZWRGaWx0ZXJpbmcgPSBkZWZlcihmaWx0ZXJpbmcpO1xuICBjb25zdCBzdGF0ZSA9IHsgY291bnRlcjogMCwgcXVlcnk6IG51bGwgfTtcbiAgbGV0IHNlbGVjdGlvbiA9IG51bGw7XG4gIGxldCBleWU7XG4gIGxldCBhdHRhY2htZW50ID0gZWw7XG4gIGxldCB0ZXh0SW5wdXQ7XG4gIGxldCBhbnlJbnB1dDtcbiAgbGV0IHJhbmNob3JsZWZ0O1xuICBsZXQgcmFuY2hvcnJpZ2h0O1xuXG4gIGlmIChvLmF1dG9IaWRlT25CbHVyID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQmx1ciA9IHRydWU7IH1cbiAgaWYgKG8uYXV0b0hpZGVPbkNsaWNrID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQ2xpY2sgPSB0cnVlOyB9XG4gIGlmIChvLmF1dG9TaG93T25VcERvd24gPT09IHZvaWQgMCkgeyBvLmF1dG9TaG93T25VcERvd24gPSBlbC50YWdOYW1lID09PSAnSU5QVVQnOyB9XG4gIGlmIChvLmFuY2hvcikge1xuICAgIHJhbmNob3JsZWZ0ID0gbmV3IFJlZ0V4cCgnXicgKyBvLmFuY2hvcik7XG4gICAgcmFuY2hvcnJpZ2h0ID0gbmV3IFJlZ0V4cChvLmFuY2hvciArICckJyk7XG4gIH1cblxuICBjb25zdCBhcGkgPSB7XG4gICAgYWRkLFxuICAgIGFuY2hvcjogby5hbmNob3IsXG4gICAgY2xlYXIsXG4gICAgc2hvdyxcbiAgICBoaWRlLFxuICAgIHRvZ2dsZSxcbiAgICBkZXN0cm95LFxuICAgIHJlZnJlc2hQb3NpdGlvbixcbiAgICBhcHBlbmRUZXh0LFxuICAgIGFwcGVuZEhUTUwsXG4gICAgZmlsdGVyQW5jaG9yZWRUZXh0LFxuICAgIGZpbHRlckFuY2hvcmVkSFRNTCxcbiAgICBkZWZhdWx0QXBwZW5kVGV4dDogYXBwZW5kVGV4dCxcbiAgICBkZWZhdWx0RmlsdGVyLFxuICAgIGRlZmF1bHRSZW5kZXJlcixcbiAgICBkZWZhdWx0U2V0dGVyLFxuICAgIHJldGFyZ2V0LFxuICAgIGF0dGFjaG1lbnQsXG4gICAgbGlzdDogdWwsXG4gICAgc3VnZ2VzdGlvbnM6IFtdXG4gIH07XG5cbiAgcmV0YXJnZXQoZWwpO1xuICBwYXJlbnQuYXBwZW5kQ2hpbGQodWwpO1xuICBlbC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcblxuICBpZiAoQXJyYXkuaXNBcnJheShzdWdnZXN0aW9ucykpIHtcbiAgICBsb2FkZWQoc3VnZ2VzdGlvbnMsIGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gcmV0YXJnZXQgKGVsKSB7XG4gICAgaW5wdXRFdmVudHModHJ1ZSk7XG4gICAgYXR0YWNobWVudCA9IGFwaS5hdHRhY2htZW50ID0gZWw7XG4gICAgdGV4dElucHV0ID0gYXR0YWNobWVudC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGF0dGFjaG1lbnQudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgICBhbnlJbnB1dCA9IHRleHRJbnB1dCB8fCBpc0VkaXRhYmxlKGF0dGFjaG1lbnQpO1xuICAgIGlucHV0RXZlbnRzKCk7XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoUG9zaXRpb24gKCkge1xuICAgIGlmIChleWUpIHsgZXllLnJlZnJlc2goKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGluZyAoZm9yY2VTaG93KSB7XG4gICAgaWYgKHR5cGVvZiBzdWdnZXN0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY3Jvc3N2ZW50LnJlbW92ZShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcmVhZElucHV0KCk7XG4gICAgICBpZiAocXVlcnkgIT09IHN0YXRlLnF1ZXJ5KSB7XG4gICAgICAgIHN0YXRlLmNvdW50ZXIrKztcbiAgICAgICAgc3RhdGUucXVlcnkgPSBxdWVyeTtcblxuICAgICAgICBjb25zdCBjb3VudGVyID0gc3RhdGUuY291bnRlcjtcbiAgICAgICAgc3VnZ2VzdGlvbnMoeyBxdWVyeSwgbGltaXQgfSwgZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICBpZiAoc3RhdGUuY291bnRlciA9PT0gY291bnRlcikge1xuICAgICAgICAgICAgbG9hZGVkKHMsIGZvcmNlU2hvdyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBsb2FkZWQgKHN1Z2dlc3Rpb25zLCBmb3JjZVNob3cpIHtcbiAgICBjbGVhcigpO1xuICAgIHN1Z2dlc3Rpb25zLmZvckVhY2goYWRkKTtcbiAgICBhcGkuc3VnZ2VzdGlvbnMgPSBzdWdnZXN0aW9ucztcbiAgICBpZiAoZm9yY2VTaG93KSB7XG4gICAgICBzaG93KCk7XG4gICAgfVxuICAgIGZpbHRlcmluZygpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYXIgKCkge1xuICAgIHVuc2VsZWN0KCk7XG4gICAgd2hpbGUgKHVsLmxhc3RDaGlsZCkge1xuICAgICAgdWwucmVtb3ZlQ2hpbGQodWwubGFzdENoaWxkKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkSW5wdXQgKCkge1xuICAgIHJldHVybiB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAoc3VnZ2VzdGlvbikge1xuICAgIGxldCBsaSA9IHRhZygnbGknLCAndGFjLWl0ZW0nKTtcbiAgICByZW5kZXIobGksIHN1Z2dlc3Rpb24pO1xuICAgIGJyZWFrdXBGb3JIaWdobGlnaHRlcihsaSk7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2NsaWNrJywgY2xpY2tlZFN1Z2dlc3Rpb24pO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdhdXRvY29tcGxldGUtZmlsdGVyJywgZmlsdGVySXRlbSk7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJywgaGlkZUl0ZW0pO1xuICAgIHVsLmFwcGVuZENoaWxkKGxpKTtcbiAgICBhcGkuc3VnZ2VzdGlvbnMucHVzaChzdWdnZXN0aW9uKTtcbiAgICByZXR1cm4gbGk7XG5cbiAgICBmdW5jdGlvbiBjbGlja2VkU3VnZ2VzdGlvbiAoKSB7XG4gICAgICBjb25zdCBpbnB1dCA9IGdldFRleHQoc3VnZ2VzdGlvbik7XG4gICAgICBjb25zdCB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pO1xuICAgICAgc2V0KHZhbHVlKTtcbiAgICAgIGhpZGUoKTtcbiAgICAgIGF0dGFjaG1lbnQuZm9jdXMoKTtcbiAgICAgIGNvbnN0IHByZWZpeCA9IG8ucHJlZml4ICYmIG8ucHJlZml4KGlucHV0KTtcbiAgICAgIGlmIChwcmVmaXgpIHtcbiAgICAgICAgZWwudmFsdWUgPSBwcmVmaXg7XG4gICAgICAgIGVsLnNlbGVjdCgpO1xuICAgICAgICBzaG93KCk7XG4gICAgICAgIGZpbHRlcmluZygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbHRlckl0ZW0gKCkge1xuICAgICAgY29uc3QgdmFsdWUgPSByZWFkSW5wdXQoKTtcbiAgICAgIGlmIChmaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSA9IGxpLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLWhpZGUvZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGlkZUl0ZW0gKCkge1xuICAgICAgaWYgKCFoaWRkZW4obGkpKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSArPSAnIHRhYy1oaWRlJztcbiAgICAgICAgaWYgKHNlbGVjdGlvbiA9PT0gbGkpIHtcbiAgICAgICAgICB1bnNlbGVjdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYnJlYWt1cEZvckhpZ2hsaWdodGVyIChlbCkge1xuICAgIGdldFRleHRDaGlsZHJlbihlbCkuZm9yRWFjaChlbCA9PiB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgICAgY29uc3QgdGV4dCA9IGVsLnRleHRDb250ZW50IHx8IGVsLm5vZGVWYWx1ZSB8fCAnJztcbiAgICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBjaGFyIG9mIHRleHQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShzcGFuRm9yKGNoYXIpLCBlbCk7XG4gICAgICB9XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgZnVuY3Rpb24gc3BhbkZvciAoY2hhcikge1xuICAgICAgICBjb25zdCBzcGFuID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgc3Bhbi5jbGFzc05hbWUgPSAndGFjLWNoYXInO1xuICAgICAgICBzcGFuLnRleHRDb250ZW50ID0gc3Bhbi5pbm5lclRleHQgPSBjaGFyO1xuICAgICAgICByZXR1cm4gc3BhbjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodCAoZWwsIG5lZWRsZSkge1xuICAgIGNvbnN0IGNoYXJzID0gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YWMtY2hhcicpXTtcblxuICAgIGZvciAobGV0IGlucHV0IG9mIG5lZWRsZSkge1xuICAgICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgICBsZXQgY2hhciA9IGNoYXJzLnNoaWZ0KCk7XG4gICAgICAgIGxldCBjaGFyVGV4dCA9IGNoYXIuaW5uZXJUZXh0IHx8IGNoYXIudGV4dENvbnRlbnQ7XG4gICAgICAgIGlmIChjaGFyVGV4dCA9PT0gaW5wdXQpIHtcbiAgICAgICAgICBvbihjaGFyKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmYoY2hhcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgb2ZmKGNoYXJzLnNoaWZ0KCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uIChjaCkge1xuICAgICAgY2guY2xhc3NMaXN0LmFkZCgndGFjLWNoYXItaGlnaGxpZ2h0Jyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG9mZiAoY2gpIHtcbiAgICAgIGNoLmNsYXNzTGlzdC5yZW1vdmUoJ3RhYy1jaGFyLWhpZ2hsaWdodCcpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFRleHRDaGlsZHJlbiAoZWwpIHtcbiAgICBjb25zdCB0ZXh0cyA9IFtdO1xuICAgIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWwsIE5vZGVGaWx0ZXIuU0hPV19URVhULCBudWxsLCBmYWxzZSk7XG4gICAgbGV0IG5vZGU7XG4gICAgd2hpbGUgKG5vZGUgPSB3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgdGV4dHMucHVzaChub2RlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRzO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh2YWx1ZSkge1xuICAgIGlmIChvLmFuY2hvcikge1xuICAgICAgcmV0dXJuIChpc1RleHQoKSA/IGFwaS5hcHBlbmRUZXh0IDogYXBpLmFwcGVuZEhUTUwpKHZhbHVlKTtcbiAgICB9XG4gICAgdXNlclNldCh2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXIgKHZhbHVlLCBzdWdnZXN0aW9uKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICBjb25zdCBpbCA9IChpc1RleHQoKSA/IGFwaS5maWx0ZXJBbmNob3JlZFRleHQgOiBhcGkuZmlsdGVyQW5jaG9yZWRIVE1MKSh2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gICAgICByZXR1cm4gaWwgPyB1c2VyRmlsdGVyKGlsLmlucHV0LCBpbC5zdWdnZXN0aW9uKSA6IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdXNlckZpbHRlcih2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpc1RleHQgKCkgeyByZXR1cm4gaXNJbnB1dChhdHRhY2htZW50KTsgfVxuICBmdW5jdGlvbiB2aXNpYmxlICgpIHsgcmV0dXJuIHVsLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtc2hvdycpICE9PSAtMTsgfVxuICBmdW5jdGlvbiBoaWRkZW4gKGxpKSB7IHJldHVybiBsaS5jbGFzc05hbWUuaW5kZXhPZigndGFjLWhpZGUnKSAhPT0gLTE7IH1cblxuICBmdW5jdGlvbiBzaG93ICgpIHtcbiAgICBpZiAoIXZpc2libGUoKSkge1xuICAgICAgdWwuY2xhc3NOYW1lICs9ICcgdGFjLXNob3cnO1xuICAgICAgZXllLnJlZnJlc2goKTtcbiAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1zaG93Jyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlciAoZSkge1xuICAgIGNvbnN0IGxlZnQgPSBlLndoaWNoID09PSAxICYmICFlLm1ldGFLZXkgJiYgIWUuY3RybEtleTtcbiAgICBpZiAobGVmdCA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybjsgLy8gd2Ugb25seSBjYXJlIGFib3V0IGhvbmVzdCB0byBnb2QgbGVmdC1jbGlja3NcbiAgICB9XG4gICAgdG9nZ2xlKCk7XG4gIH1cblxuICBmdW5jdGlvbiB0b2dnbGUgKCkge1xuICAgIGlmICghdmlzaWJsZSgpKSB7XG4gICAgICBzaG93KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhpZGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZWxlY3QgKHN1Z2dlc3Rpb24pIHtcbiAgICB1bnNlbGVjdCgpO1xuICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICBzZWxlY3Rpb24gPSBzdWdnZXN0aW9uO1xuICAgICAgc2VsZWN0aW9uLmNsYXNzTmFtZSArPSAnIHRhYy1zZWxlY3RlZCc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdW5zZWxlY3QgKCkge1xuICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgIHNlbGVjdGlvbi5jbGFzc05hbWUgPSBzZWxlY3Rpb24uY2xhc3NOYW1lLnJlcGxhY2UoLyB0YWMtc2VsZWN0ZWQvZywgJycpO1xuICAgICAgc2VsZWN0aW9uID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlICh1cCwgbW92ZXMpIHtcbiAgICBjb25zdCB0b3RhbCA9IHVsLmNoaWxkcmVuLmxlbmd0aDtcbiAgICBpZiAodG90YWwgPCBtb3Zlcykge1xuICAgICAgdW5zZWxlY3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRvdGFsID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGZpcnN0ID0gdXAgPyAnbGFzdENoaWxkJyA6ICdmaXJzdENoaWxkJztcbiAgICBjb25zdCBuZXh0ID0gdXAgPyAncHJldmlvdXNTaWJsaW5nJyA6ICduZXh0U2libGluZyc7XG4gICAgY29uc3Qgc3VnZ2VzdGlvbiA9IHNlbGVjdGlvbiAmJiBzZWxlY3Rpb25bbmV4dF0gfHwgdWxbZmlyc3RdO1xuXG4gICAgc2VsZWN0KHN1Z2dlc3Rpb24pO1xuXG4gICAgaWYgKGhpZGRlbihzdWdnZXN0aW9uKSkge1xuICAgICAgbW92ZSh1cCwgbW92ZXMgPyBtb3ZlcyArIDEgOiAxKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoaWRlICgpIHtcbiAgICBleWUuc2xlZXAoKTtcbiAgICB1bC5jbGFzc05hbWUgPSB1bC5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zaG93L2csICcnKTtcbiAgICB1bnNlbGVjdCgpO1xuICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlkb3duIChlKSB7XG4gICAgY29uc3Qgc2hvd24gPSB2aXNpYmxlKCk7XG4gICAgY29uc3Qgd2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAod2hpY2ggPT09IEtFWV9ET1dOKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93bikge1xuICAgICAgICBtb3ZlKCk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX1VQKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93bikge1xuICAgICAgICBtb3ZlKHRydWUpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9CQUNLU1BBQ0UpIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc2hvd24pIHtcbiAgICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKHNlbGVjdGlvbiwgJ2NsaWNrJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGlkZSgpO1xuICAgICAgICB9XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfRVNDKSB7XG4gICAgICAgIGhpZGUoKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJpbmcgKCkge1xuICAgIGlmICghdmlzaWJsZSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxvYWRpbmcodHJ1ZSk7XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLWZpbHRlcicpO1xuICAgIGNvbnN0IHZhbHVlID0gcmVhZElucHV0KCkudHJpbSgpO1xuICAgIGxldCBsaSA9IHVsLmZpcnN0Q2hpbGQ7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICB3aGlsZSAobGkpIHtcbiAgICAgIGlmIChjb3VudCA+PSBsaW1pdCkge1xuICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGxpLCAnYXV0b2NvbXBsZXRlLWhpZGUnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUobGksICdhdXRvY29tcGxldGUtZmlsdGVyJyk7XG4gICAgICAgIGlmIChsaS5jbGFzc05hbWUuaW5kZXhPZigndGFjLWhpZGUnKSA9PT0gLTEpIHtcbiAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgIGhpZ2hsaWdodChsaSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsaSA9IGxpLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgICBpZiAoIXNlbGVjdGlvbikge1xuICAgICAgbW92ZSgpO1xuICAgIH1cbiAgICBpZiAoIXNlbGVjdGlvbikge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlciAoZSkge1xuICAgIGNvbnN0IHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGVmZXJyZWRGaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmVycmVkU2hvdyAoZSkge1xuICAgIGNvbnN0IHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIgfHwgd2hpY2ggPT09IEtFWV9UQUIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2V0VGltZW91dChzaG93LCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGF1dG9jb21wbGV0ZUV2ZW50VGFyZ2V0IChlKSB7XG4gICAgbGV0IHRhcmdldCA9IGUudGFyZ2V0O1xuICAgIGlmICh0YXJnZXQgPT09IGF0dGFjaG1lbnQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICB3aGlsZSAodGFyZ2V0KSB7XG4gICAgICBpZiAodGFyZ2V0ID09PSB1bCB8fCB0YXJnZXQgPT09IGF0dGFjaG1lbnQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoaWRlT25CbHVyIChlKSB7XG4gICAgY29uc3Qgd2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAod2hpY2ggPT09IEtFWV9UQUIpIHtcbiAgICAgIGhpZGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBoaWRlT25DbGljayAoZSkge1xuICAgIGlmIChhdXRvY29tcGxldGVFdmVudFRhcmdldChlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoaWRlKCk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnB1dEV2ZW50cyAocmVtb3ZlKSB7XG4gICAgY29uc3Qgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGlmIChleWUpIHtcbiAgICAgIGV5ZS5kZXN0cm95KCk7XG4gICAgICBleWUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIXJlbW92ZSkge1xuICAgICAgZXllID0gYnVsbHNleWUodWwsIGF0dGFjaG1lbnQsIHsgY2FyZXQ6IGFueUlucHV0ICYmIGF0dGFjaG1lbnQudGFnTmFtZSAhPT0gJ0lOUFVUJyB9KTtcbiAgICAgIGlmICghdmlzaWJsZSgpKSB7IGV5ZS5zbGVlcCgpOyB9XG4gICAgfVxuICAgIGlmIChyZW1vdmUgfHwgKGFueUlucHV0ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBhdHRhY2htZW50KSkge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZGluZygpO1xuICAgIH1cbiAgICBpZiAoYW55SW5wdXQpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRTaG93KTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRGaWx0ZXJpbmcpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAna2V5ZG93bicsIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdwYXN0ZScsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICAgIGlmIChvLmF1dG9IaWRlT25CbHVyKSB7IGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBoaWRlT25CbHVyKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdjbGljaycsIHRvZ2dsZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2NFbGVtZW50LCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIH1cbiAgICBpZiAoby5hdXRvSGlkZU9uQ2xpY2spIHsgY3Jvc3N2ZW50W29wXShkb2MsICdjbGljaycsIGhpZGVPbkNsaWNrKTsgfVxuICAgIGlmIChmb3JtKSB7IGNyb3NzdmVudFtvcF0oZm9ybSwgJ3N1Ym1pdCcsIGhpZGUpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBpZiAocGFyZW50LmNvbnRhaW5zKHVsKSkgeyBwYXJlbnQucmVtb3ZlQ2hpbGQodWwpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0U2V0dGVyICh2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAobGksIHN1Z2dlc3Rpb24pIHtcbiAgICBsaS5pbm5lclRleHQgPSBsaS50ZXh0Q29udGVudCA9IGdldFRleHQoc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0RmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgY29uc3QgbmVlZGxlID0gcS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHRleHQgPSBnZXRUZXh0KHN1Z2dlc3Rpb24pIHx8ICcnO1xuICAgIGlmIChmdXp6eXNlYXJjaChuZWVkbGUsIHRleHQudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pIHx8ICcnO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBmdXp6eXNlYXJjaChuZWVkbGUsIHZhbHVlLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9vcGJhY2tUb0FuY2hvciAodGV4dCwgcCkge1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBsZXQgYW5jaG9yZWQgPSBmYWxzZTtcbiAgICBsZXQgc3RhcnQgPSBwLnN0YXJ0O1xuICAgIHdoaWxlIChhbmNob3JlZCA9PT0gZmFsc2UgJiYgc3RhcnQgPj0gMCkge1xuICAgICAgcmVzdWx0ID0gdGV4dC5zdWJzdHIoc3RhcnQgLSAxLCBwLnN0YXJ0IC0gc3RhcnQgKyAxKTtcbiAgICAgIGFuY2hvcmVkID0gcmFuY2hvcmxlZnQudGVzdChyZXN1bHQpO1xuICAgICAgc3RhcnQtLTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGFuY2hvcmVkID8gcmVzdWx0IDogbnVsbCxcbiAgICAgIHN0YXJ0XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlckFuY2hvcmVkVGV4dCAocSwgc3VnZ2VzdGlvbikge1xuICAgIGNvbnN0IHBvc2l0aW9uID0gc2VsbChlbCk7XG4gICAgY29uc3QgaW5wdXQgPSBsb29wYmFja1RvQW5jaG9yKHEsIHBvc2l0aW9uKS50ZXh0O1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgcmV0dXJuIHsgaW5wdXQsIHN1Z2dlc3Rpb24gfTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRUZXh0ICh2YWx1ZSkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSBlbC52YWx1ZTtcbiAgICBjb25zdCBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIGNvbnN0IGlucHV0ID0gbG9vcGJhY2tUb0FuY2hvcihjdXJyZW50LCBwb3NpdGlvbik7XG4gICAgY29uc3QgbGVmdCA9IGN1cnJlbnQuc3Vic3RyKDAsIGlucHV0LnN0YXJ0KTtcbiAgICBjb25zdCByaWdodCA9IGN1cnJlbnQuc3Vic3RyKGlucHV0LnN0YXJ0ICsgaW5wdXQudGV4dC5sZW5ndGggKyAocG9zaXRpb24uZW5kIC0gcG9zaXRpb24uc3RhcnQpKTtcbiAgICBjb25zdCBiZWZvcmUgPSBsZWZ0ICsgdmFsdWUgKyAnICc7XG5cbiAgICBlbC52YWx1ZSA9IGJlZm9yZSArIHJpZ2h0O1xuICAgIHNlbGwoZWwsIHsgc3RhcnQ6IGJlZm9yZS5sZW5ndGgsIGVuZDogYmVmb3JlLmxlbmd0aCB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlckFuY2hvcmVkSFRNTCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbmNob3JpbmcgaW4gZWRpdGFibGUgZWxlbWVudHMgaXMgZGlzYWJsZWQgYnkgZGVmYXVsdC4nKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGVuZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNJbnB1dCAoZWwpIHsgcmV0dXJuIGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJzsgfVxuXG5mdW5jdGlvbiB0YWcgKHR5cGUsIGNsYXNzTmFtZSkge1xuICBjb25zdCBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KHR5cGUpO1xuICBlbC5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gZGVmZXIgKGZuKSB7IHJldHVybiBmdW5jdGlvbiAoKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9OyB9XG5cbmZ1bmN0aW9uIGlzRWRpdGFibGUgKGVsKSB7XG4gIGNvbnN0IHZhbHVlID0gZWwuZ2V0QXR0cmlidXRlKCdjb250ZW50RWRpdGFibGUnKTtcbiAgaWYgKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gaXNFZGl0YWJsZShlbC5wYXJlbnRFbGVtZW50KTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBjcm9zc3ZlbnQgZnJvbSAnY3Jvc3N2ZW50JztcbmltcG9ydCBkb20gZnJvbSAnLi9kb20nO1xuaW1wb3J0IHRleHQgZnJvbSAnLi90ZXh0JztcbmNvbnN0IHByb3BzID0gW1xuICAnZm9udEZhbWlseScsXG4gICdmb250U2l6ZScsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHlsZScsXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAnd29yZFNwYWNpbmcnLFxuICAndGV4dEluZGVudCcsXG4gICd3ZWJraXRCb3hTaXppbmcnLFxuICAnbW96Qm94U2l6aW5nJyxcbiAgJ2JveFNpemluZycsXG4gICdwYWRkaW5nJyxcbiAgJ2JvcmRlcidcbl07XG5jb25zdCBvZmZzZXQgPSAyMDtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmFjdG9yeSAoZWwpIHtcbiAgY29uc3QgbWlycm9yID0gZG9tKCdzcGFuJyk7XG5cbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuICByZW1hcCgpO1xuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHsgcmVtYXAsIHJlZnJlc2gsIGRlc3Ryb3kgfTtcblxuICBmdW5jdGlvbiByZW1hcCAoKSB7XG4gICAgY29uc3QgYyA9IGNvbXB1dGVkKCk7XG4gICAgbGV0IHZhbHVlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlID0gY1twcm9wc1tpXV07XG4gICAgICBpZiAodmFsdWUgIT09IHZvaWQgMCAmJiB2YWx1ZSAhPT0gbnVsbCkgeyAvLyBvdGhlcndpc2UgSUUgYmxvd3MgdXBcbiAgICAgICAgbWlycm9yLnN0eWxlW3Byb3BzW2ldXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBtaXJyb3IuZGlzYWJsZWQgPSAnZGlzYWJsZWQnO1xuICAgIG1pcnJvci5zdHlsZS53aGl0ZVNwYWNlID0gJ3ByZSc7XG4gICAgbWlycm9yLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBtaXJyb3Iuc3R5bGUudG9wID0gbWlycm9yLnN0eWxlLmxlZnQgPSAnLTk5OTllbSc7XG4gIH1cblxuICBmdW5jdGlvbiByZWZyZXNoICgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGVsLnZhbHVlO1xuICAgIGlmICh2YWx1ZSA9PT0gbWlycm9yLnZhbHVlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGV4dChtaXJyb3IsIHZhbHVlKTtcblxuICAgIGNvbnN0IHdpZHRoID0gbWlycm9yLm9mZnNldFdpZHRoICsgb2Zmc2V0O1xuXG4gICAgZWwuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICBjb25zdCBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCByZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5dXAnLCByZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnaW5wdXQnLCByZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCByZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnY2hhbmdlJywgcmVmcmVzaCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICAgIG1pcnJvci5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG1pcnJvcik7XG4gICAgZWwuc3R5bGUud2lkdGggPSAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXB1dGVkICgpIHtcbiAgICBpZiAod2luZG93LmdldENvbXB1dGVkU3R5bGUpIHtcbiAgICAgIHJldHVybiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgfVxuICAgIHJldHVybiBlbC5jdXJyZW50U3R5bGU7XG4gIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGRvbSAodGFnTmFtZSwgY2xhc3Nlcykge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG4gIGlmIChjbGFzc2VzKSB7XG4gICAgZWwuY2xhc3NOYW1lID0gY2xhc3NlcztcbiAgfVxuICByZXR1cm4gZWw7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5sZXQgZ2V0ID0gZWFzeUdldDtcbmxldCBzZXQgPSBlYXN5U2V0O1xuY29uc3QgaW5wdXRUYWcgPSAvaW5wdXQvaTtcbmNvbnN0IHRleHRhcmVhVGFnID0gL3RleHRhcmVhL2k7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGlmIChhY3RpdmUgIT09IGVsKSB7XG4gICAgZWwuZm9jdXMoKTtcbiAgfVxuXG4gIGNvbnN0IHJhbmdlID0gZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIGNvbnN0IGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgY29uc3Qgb3JpZ2luYWwgPSBlbC52YWx1ZTtcbiAgY29uc3QgbWFya2VyID0gZ2V0VW5pcXVlTWFya2VyKG9yaWdpbmFsKTtcbiAgY29uc3QgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgY29uc3QgY29udGVudHMgPSBlbC52YWx1ZTtcblxuICBlbC52YWx1ZSA9IG9yaWdpbmFsO1xuICByYW5nZS5tb3ZlVG9Cb29rbWFyayhib29rbWFyayk7XG4gIHJhbmdlLnNlbGVjdCgpO1xuXG4gIHJldHVybiByZXN1bHQoY29udGVudHMuaW5kZXhPZihtYXJrZXIpLCBjb250ZW50cy5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aCk7XG5cbiAgZnVuY3Rpb24gcmVzdWx0IChzdGFydCwgZW5kKSB7XG4gICAgaWYgKGFjdGl2ZSAhPT0gZWwpIHsgLy8gZG9uJ3QgZGlzcnVwdCBwcmUtZXhpc3Rpbmcgc3RhdGVcbiAgICAgIGlmIChhY3RpdmUpIHtcbiAgICAgICAgYWN0aXZlLmZvY3VzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5ibHVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXJ0OiBzdGFydCwgZW5kOiBlbmQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRVbmlxdWVNYXJrZXIgKGNvbnRlbnRzKSB7XG4gIGxldCBtYXJrZXI7XG4gIGRvIHtcbiAgICBtYXJrZXIgPSAnQEBtYXJrZXIuJyArIE1hdGgucmFuZG9tKCkgKiBuZXcgRGF0ZSgpO1xuICB9IHdoaWxlIChjb250ZW50cy5pbmRleE9mKG1hcmtlcikgIT09IC0xKTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gaW5wdXRzIChlbCkge1xuICByZXR1cm4gKChpbnB1dFRhZy50ZXN0KGVsLnRhZ05hbWUpICYmIGVsLnR5cGUgPT09ICd0ZXh0JykgfHwgdGV4dGFyZWFUYWcudGVzdChlbC50YWdOYW1lKSk7XG59XG5cbmZ1bmN0aW9uIGVhc3lTZXQgKGVsLCBwKSB7XG4gIGVsLnNlbGVjdGlvblN0YXJ0ID0gc3BlY2lhbChlbCwgcC5zdGFydCk7XG4gIGVsLnNlbGVjdGlvbkVuZCA9IHNwZWNpYWwoZWwsIHAuZW5kKTtcbn1cblxuZnVuY3Rpb24gaGFyZFNldCAoZWwsIHApIHtcbiAgY29uc3QgcmFuZ2UgPSBlbC5jcmVhdGVUZXh0UmFuZ2UoKTtcblxuICBpZiAocC5zdGFydCA9PT0gJ2VuZCcgJiYgcC5lbmQgPT09ICdlbmQnKSB7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlLmNvbGxhcHNlKHRydWUpO1xuICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHAuZW5kKTtcbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHAuc3RhcnQpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNwZWNpYWwgKGVsLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09ICdlbmQnID8gZWwudmFsdWUubGVuZ3RoIDogdmFsdWUgfHwgMDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2VsZWN0aW9uIChlbCwgcCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHNldChlbCwgcCk7XG4gIH1cbiAgcmV0dXJuIGdldChlbCk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBzdW0gZnJvbSAnaGFzaC1zdW0nO1xuaW1wb3J0IGNyb3NzdmVudCBmcm9tICdjcm9zc3ZlbnQnO1xuaW1wb3J0IGVtaXR0ZXIgZnJvbSAnY29udHJhL2VtaXR0ZXInO1xuaW1wb3J0IGRvbSBmcm9tICcuL2RvbSc7XG5pbXBvcnQgdGV4dCBmcm9tICcuL3RleHQnO1xuaW1wb3J0IHNlbGVjdGlvbiBmcm9tICcuL3NlbGVjdGlvbic7XG5pbXBvcnQgYXV0b3NpemUgZnJvbSAnLi9hdXRvc2l6ZSc7XG5pbXBvcnQgYXV0b2NvbXBsZXRlIGZyb20gJy4vYXV0b2NvbXBsZXRlJztcbmNvbnN0IGlucHV0VGFnID0gL15pbnB1dCQvaTtcbmNvbnN0IEVMRU1FTlQgPSAxO1xuY29uc3QgQkFDS1NQQUNFID0gODtcbmNvbnN0IEVORCA9IDM1O1xuY29uc3QgSE9NRSA9IDM2O1xuY29uc3QgTEVGVCA9IDM3O1xuY29uc3QgUklHSFQgPSAzOTtcbmNvbnN0IHNpbmthYmxlS2V5cyA9IFtFTkQsIEhPTUVdO1xuY29uc3QgdGFnQ2xhc3MgPSAvXFxidGF5LXRhZ1xcYi87XG5jb25zdCB0YWdSZW1vdmFsQ2xhc3MgPSAvXFxidGF5LXRhZy1yZW1vdmVcXGIvO1xuY29uc3QgZWRpdG9yQ2xhc3MgPSAvXFxidGF5LWVkaXRvclxcYi9nO1xuY29uc3QgaW5wdXRDbGFzcyA9IC9cXGJ0YXktaW5wdXRcXGIvZztcbmNvbnN0IGVuZCA9IHsgc3RhcnQ6ICdlbmQnLCBlbmQ6ICdlbmQnIH07XG5jb25zdCBkZWZhdWx0RGVsaW1pdGVyID0gJyAnO1xuXG4vLyBtb2R1bGUuZXhwb3J0cyBiZWNhdXNlIGJyb3dzZXJpZnkgc3RhbmRhbG9uZVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0YWdneSAoZWwsIG9wdGlvbnMpIHtcbiAgY29uc3QgY3VycmVudFZhbHVlcyA9IFtdO1xuICBjb25zdCBvID0gb3B0aW9ucyB8fCB7fTtcbiAgY29uc3QgZGVsaW1pdGVyID0gby5kZWxpbWl0ZXIgfHwgZGVmYXVsdERlbGltaXRlcjtcbiAgaWYgKGRlbGltaXRlci5sZW5ndGggIT09IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ2d5IGV4cGVjdGVkIGEgc2luZ2xlLWNoYXJhY3RlciBkZWxpbWl0ZXIgc3RyaW5nJyk7XG4gIH1cbiAgY29uc3QgYW55ID0gaGFzU2libGluZ3MoZWwpO1xuICBpZiAoYW55IHx8ICFpbnB1dFRhZy50ZXN0KGVsLnRhZ05hbWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWdneSBleHBlY3RlZCBhbiBpbnB1dCBlbGVtZW50IHdpdGhvdXQgYW55IHNpYmxpbmdzJyk7XG4gIH1cbiAgY29uc3QgZnJlZSA9IG8uZnJlZSAhPT0gZmFsc2U7XG4gIGNvbnN0IHZhbGlkYXRlID0gby52YWxpZGF0ZSB8fCBkZWZhdWx0VmFsaWRhdGU7XG4gIGNvbnN0IHJlbmRlciA9IG8ucmVuZGVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcblx0Y29uc3QgY29udmVydE9uQmx1ciA9IG8uY29udmVydE9uQmx1ciAhPT0gZmFsc2U7XG5cbiAgY29uc3QgdG9JdGVtRGF0YSA9IGRlZmF1bHRUb0l0ZW1EYXRhO1xuXG4gIGNvbnN0IHBhcnNlVGV4dCA9IG8ucGFyc2VUZXh0O1xuICBjb25zdCBwYXJzZVZhbHVlID0gby5wYXJzZVZhbHVlO1xuICBjb25zdCBnZXRUZXh0ID0gKFxuICAgIHR5cGVvZiBwYXJzZVRleHQgPT09ICdzdHJpbmcnID8gZCA9PiBkW3BhcnNlVGV4dF0gOlxuICAgIHR5cGVvZiBwYXJzZVRleHQgPT09ICdmdW5jdGlvbicgPyBwYXJzZVRleHQgOlxuICAgIGQgPT4gZFxuICApO1xuICBjb25zdCBnZXRWYWx1ZSA9IChcbiAgICB0eXBlb2YgcGFyc2VWYWx1ZSA9PT0gJ3N0cmluZycgPyBkID0+IGRbcGFyc2VWYWx1ZV0gOlxuICAgIHR5cGVvZiBwYXJzZVZhbHVlID09PSAnZnVuY3Rpb24nID8gcGFyc2VWYWx1ZSA6XG4gICAgZCA9PiBkXG4gICk7XG5cbiAgY29uc3QgYmVmb3JlID0gZG9tKCdzcGFuJywgJ3RheS10YWdzIHRheS10YWdzLWJlZm9yZScpO1xuICBjb25zdCBhZnRlciA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1hZnRlcicpO1xuICBjb25zdCBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICBlbC5jbGFzc05hbWUgKz0gJyB0YXktaW5wdXQnO1xuICBwYXJlbnQuY2xhc3NOYW1lICs9ICcgdGF5LWVkaXRvcic7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYmVmb3JlLCBlbCk7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoYWZ0ZXIsIGVsLm5leHRTaWJsaW5nKTtcblxuICBjb25zdCBzaHJpbmtlciA9IGF1dG9zaXplKGVsKTtcbiAgY29uc3QgY29tcGxldGVyID0gby5hdXRvY29tcGxldGUgPyBjcmVhdGVBdXRvY29tcGxldGUoKSA6IG51bGw7XG4gIGNvbnN0IGFwaSA9IGVtaXR0ZXIoe1xuICAgIGFkZEl0ZW0sXG4gICAgcmVtb3ZlSXRlbTogcmVtb3ZlSXRlbUJ5RGF0YSxcbiAgICByZW1vdmVJdGVtQnlFbGVtZW50LFxuICAgIHZhbHVlOiByZWFkVmFsdWUsXG4gICAgZGVzdHJveVxuICB9KTtcblxuICBjb25zdCBwbGFjZWhvbGRlciA9IGVsLmdldEF0dHJpYnV0ZSgncGxhY2Vob2xkZXInKTtcbiAgbGV0IHBsYWNlaGVsZCA9IHRydWU7XG5cbiAgYmluZCgpO1xuXG4gIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBlbCA/XG4gICAgZXZhbHVhdGVTZWxlY3QgOlxuICAgIGV2YWx1YXRlTm9TZWxlY3RcbiAgKShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG5cbiAgcmV0dXJuIGFwaTtcblxuICBmdW5jdGlvbiBmaW5kSXRlbSAodmFsdWUsIHByb3ApIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnRWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjdXJyZW50VmFsdWVzW2ldW3Byb3AgfHwgJ2RhdGEnXSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZXNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkSXRlbSAoZGF0YSkge1xuICAgIGNvbnN0IGl0ZW0gPSB7IGRhdGEsIHZhbGlkOiB0cnVlIH07XG4gICAgY29uc3QgZWwgPSByZW5kZXJJdGVtKGl0ZW0pO1xuICAgIGlmICghZWwpIHtcbiAgICAgIHJldHVybiBhcGk7XG4gICAgfVxuICAgIGl0ZW0uZWwgPSBlbDtcbiAgICBjdXJyZW50VmFsdWVzLnB1c2goaXRlbSk7XG4gICAgYXBpLmVtaXQoJ2FkZCcsIGRhdGEsIGVsKTtcbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbSAoaXRlbSkge1xuICAgIGlmIChpdGVtKSB7XG4gICAgICByZW1vdmVJdGVtRWxlbWVudChpdGVtLmVsKTtcbiAgICAgIGN1cnJlbnRWYWx1ZXMuc3BsaWNlKGN1cnJlbnRWYWx1ZXMuaW5kZXhPZihpdGVtKSwgMSk7XG4gICAgICBhcGkuZW1pdCgncmVtb3ZlJywgaXRlbS5kYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW1CeURhdGEgKGRhdGEpIHtcbiAgICByZXR1cm4gcmVtb3ZlSXRlbShmaW5kSXRlbShkYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtQnlFbGVtZW50IChlbCkge1xuICAgIHJldHVybiByZW1vdmVJdGVtKGZpbmRJdGVtKGVsLCAnZWwnKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJJdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRhZyhiZWZvcmUsIGl0ZW0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbUVsZW1lbnQgKGVsKSB7XG4gICAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIGVsLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVRhZyAoYnVmZmVyLCBpdGVtKSB7XG4gICAgY29uc3Qge2RhdGF9ID0gaXRlbTtcbiAgICBjb25zdCBlbXB0eSA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyAmJiBkYXRhLnRyaW0oKS5sZW5ndGggPT09IDA7XG4gICAgaWYgKGVtcHR5KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZWwgPSBkb20oJ3NwYW4nLCAndGF5LXRhZycpO1xuICAgIHJlbmRlcihlbCwgaXRlbSk7XG4gICAgaWYgKG8uZGVsZXRpb24pIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGRvbSgnc3BhbicsICd0YXktdGFnLXJlbW92ZScpKTtcbiAgICB9XG4gICAgYnVmZmVyLmFwcGVuZENoaWxkKGVsKTtcbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VG9JdGVtRGF0YSAocykge1xuICAgIHJldHVybiBzO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFZhbHVlICgpIHtcbiAgICByZXR1cm4gY3VycmVudFZhbHVlcy5maWx0ZXIodiA9PiB2LnZhbGlkKS5tYXAodiA9PiB2LmRhdGEpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQXV0b2NvbXBsZXRlICgpIHtcbiAgICBjb25zdCBjb25maWcgPSBvLmF1dG9jb21wbGV0ZTtcbiAgICBjb25zdCBwcmVmaXggPSBjb25maWcucHJlZml4O1xuICAgIGNvbnN0IGNhY2hlID0gY29uZmlnLmNhY2hlIHx8IHt9O1xuICAgIGNvbnN0IG5vU291cmNlID0gIWNvbmZpZy5zb3VyY2U7XG4gICAgaWYgKG5vU291cmNlICYmICFjb25maWcuc3VnZ2VzdGlvbnMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGltaXQgPSBOdW1iZXIoY29uZmlnLmxpbWl0KSB8fCBJbmZpbml0eTtcbiAgICBjb25zdCBzdGF0aWNJdGVtcyA9IEFycmF5LmlzQXJyYXkoY29uZmlnLnN1Z2dlc3Rpb25zKSA/IGNvbmZpZy5zdWdnZXN0aW9ucy5zbGljZSgpIDogW107XG4gICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSBub1NvdXJjZSA/IHN0YXRpY0l0ZW1zIDogc3VnZ2VzdDtcbiAgICBjb25zdCBjb21wbGV0ZXIgPSBhdXRvY29tcGxldGUoZWwsIHtcbiAgICAgIHN1Z2dlc3Rpb25zLFxuICAgICAgbGltaXQsXG4gICAgICBnZXRUZXh0LFxuICAgICAgZ2V0VmFsdWUsXG4gICAgICBwcmVmaXgsXG4gICAgICBzZXQgKHMpIHtcbiAgICAgICAgZWwudmFsdWUgPSAnJztcbiAgICAgICAgYWRkSXRlbShzKTtcbiAgICAgIH0sXG4gICAgICBmaWx0ZXIgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICAgICAgaWYgKGNvbmZpZy5kdXBsaWNhdGVzICE9PSBmYWxzZSAmJiBmaW5kSXRlbShzdWdnZXN0aW9uKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZmlnLmZpbHRlcikge1xuICAgICAgICAgIHJldHVybiBjb25maWcuZmlsdGVyKHEsIHN1Z2dlc3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wbGV0ZXIuZGVmYXVsdEZpbHRlcihxLCBzdWdnZXN0aW9uKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29tcGxldGVyO1xuICAgIGZ1bmN0aW9uIHN1Z2dlc3QgKGRhdGEsIGRvbmUpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gZGF0YS5xdWVyeS50cmltKCk7XG4gICAgICBpZiAocXVlcnkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRvbmUoW10pOyByZXR1cm47XG4gICAgICB9XG4gICAgICBhcGkuZW1pdCgnYXV0b2NvbXBsZXRlLmJlZm9yZVNvdXJjZScpO1xuICAgICAgY29uc3QgaGFzaCA9IHN1bShxdWVyeSk7IC8vIGZhc3QsIGNhc2UgaW5zZW5zaXRpdmUsIHByZXZlbnRzIGNvbGxpc2lvbnNcbiAgICAgIGNvbnN0IGVudHJ5ID0gY2FjaGVbaGFzaF07XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBlbnRyeS5jcmVhdGVkLmdldFRpbWUoKTtcbiAgICAgICAgY29uc3QgZHVyYXRpb24gPSBjYWNoZS5kdXJhdGlvbiB8fCA2MCAqIDYwICogMjQ7XG4gICAgICAgIGNvbnN0IGRpZmYgPSBkdXJhdGlvbiAqIDEwMDA7XG4gICAgICAgIGNvbnN0IGZyZXNoID0gbmV3IERhdGUoc3RhcnQgKyBkaWZmKSA+IG5ldyBEYXRlKCk7XG4gICAgICAgIGlmIChmcmVzaCkge1xuICAgICAgICAgIGRvbmUoZW50cnkuaXRlbXMpOyByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbmZpZy5zb3VyY2UoZGF0YSlcbiAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICBjb25zdCBpdGVtcyA9IEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdCA6IFtdO1xuICAgICAgICAgIGNhY2hlW2hhc2hdID0geyBjcmVhdGVkOiBuZXcgRGF0ZSgpLCBpdGVtcyB9O1xuICAgICAgICAgIGRvbmUoaXRlbXMpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdBdXRvY29tcGxldGUgc291cmNlIHByb21pc2UgcmVqZWN0ZWQnLCBlcnJvciwgZWwpO1xuICAgICAgICAgIGRvbmUoW10pO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVQbGFjZWhvbGRlciAoZSkge1xuICAgIGNvbnN0IGFueSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcudGF5LXRhZycpO1xuICAgIGlmICghYW55ICYmICFwbGFjZWhlbGQpIHtcbiAgICAgIGVsLnNldEF0dHJpYnV0ZSgncGxhY2Vob2xkZXInLCBwbGFjZWhvbGRlcik7XG4gICAgICBwbGFjZWhlbGQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoYW55ICYmIHBsYWNlaGVsZCkge1xuICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKCdwbGFjZWhvbGRlcicpO1xuICAgICAgcGxhY2VoZWxkID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgY29uc3Qgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNvbnN0IGV2ID0gcmVtb3ZlID8gJ29mZicgOiAnb24nO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywga2V5ZG93bik7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXByZXNzJywga2V5cHJlc3MpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHBhc3RlKTtcbiAgICBjcm9zc3ZlbnRbb3BdKHBhcmVudCwgJ2NsaWNrJywgY2xpY2spO1xuXHRcdGlmIChjb252ZXJ0T25CbHVyKSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgJ2JsdXInLCBkb2N1bWVudGJsdXIsIHRydWUpO1xuICAgIH1cbiAgICBpZiAocGxhY2Vob2xkZXIpIHtcbiAgICAgIGFwaVtldl0oJ2FkZCcsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIGFwaVtldl0oJ3JlbW92ZScsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXByZXNzJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShwYXJlbnQsICdjbGljaycsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIHVwZGF0ZVBsYWNlaG9sZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBpZiAoY29tcGxldGVyKSB7IGNvbXBsZXRlci5kZXN0cm95KCk7IH1cbiAgICBlbC52YWx1ZSA9ICcnO1xuICAgIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKGlucHV0Q2xhc3MsICcnKTtcbiAgICBwYXJlbnQuY2xhc3NOYW1lID0gcGFyZW50LmNsYXNzTmFtZS5yZXBsYWNlKGVkaXRvckNsYXNzLCAnJyk7XG4gICAgaWYgKGJlZm9yZS5wYXJlbnRFbGVtZW50KSB7IGJlZm9yZS5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGJlZm9yZSk7IH1cbiAgICBpZiAoYWZ0ZXIucGFyZW50RWxlbWVudCkgeyBhZnRlci5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGFmdGVyKTsgfVxuICAgIHNocmlua2VyLmRlc3Ryb3koKTtcbiAgICBhcGkuZGVzdHJveWVkID0gdHJ1ZTtcbiAgICBhcGkuZGVzdHJveSA9IGFwaS5hZGRJdGVtID0gYXBpLnJlbW92ZUl0ZW0gPSAoKSA9PiBhcGk7XG4gICAgYXBpLnRhZ3MgPSBhcGkudmFsdWUgPSAoKSA9PiBudWxsO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBkb2N1bWVudGJsdXIgKGUpIHtcbiAgICBpZiAoZS50YXJnZXQgIT09IGVsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnZlcnQodHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGljayAoZSkge1xuICAgIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0O1xuICAgIGlmICh0YWdSZW1vdmFsQ2xhc3MudGVzdCh0YXJnZXQuY2xhc3NOYW1lKSkge1xuICAgICAgZm9jdXNUYWcodGFyZ2V0LnBhcmVudEVsZW1lbnQsIHsgc3RhcnQ6ICdlbmQnLCBlbmQ6ICdlbmQnLCByZW1vdmU6IHRydWUgfSk7XG4gICAgICBzaGlmdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgdG9wID0gdGFyZ2V0O1xuICAgIGxldCB0YWdnZWQgPSB0YWdDbGFzcy50ZXN0KHRvcC5jbGFzc05hbWUpO1xuICAgIHdoaWxlICh0YWdnZWQgPT09IGZhbHNlICYmIHRvcC5wYXJlbnRFbGVtZW50KSB7XG4gICAgICB0b3AgPSB0b3AucGFyZW50RWxlbWVudDtcbiAgICAgIHRhZ2dlZCA9IHRhZ0NsYXNzLnRlc3QodG9wLmNsYXNzTmFtZSk7XG4gICAgfVxuICAgIGlmICh0YWdnZWQgJiYgZnJlZSkge1xuICAgICAgZm9jdXNUYWcodG9wLCBlbmQpO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ICE9PSBlbCkge1xuICAgICAgc2hpZnQoKTtcbiAgICAgIGVsLmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2hpZnQgKCkge1xuICAgIGZvY3VzVGFnKGFmdGVyLmxhc3RDaGlsZCwgZW5kKTtcbiAgICBldmFsdWF0ZVNlbGVjdChbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb252ZXJ0IChhbGwpIHtcbiAgICAoYWxsID8gZXZhbHVhdGVOb1NlbGVjdCA6IGV2YWx1YXRlU2VsZWN0KShbZGVsaW1pdGVyXSwgYWxsKTtcbiAgICBpZiAoYWxsKSB7XG4gICAgICBlYWNoKGFmdGVyLCBtb3ZlTGVmdCk7XG4gICAgfVxuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlTGVmdCAodmFsdWUsIHRhZykge1xuICAgIGJlZm9yZS5hcHBlbmRDaGlsZCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICAgIGNvbnN0IHNlbCA9IHNlbGVjdGlvbihlbCk7XG4gICAgY29uc3Qga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGUgfHwgZS5jaGFyQ29kZTtcbiAgICBjb25zdCBjYW5Nb3ZlTGVmdCA9IHNlbC5zdGFydCA9PT0gMCAmJiBzZWwuZW5kID09PSAwICYmIGJlZm9yZS5sYXN0Q2hpbGQ7XG4gICAgY29uc3QgY2FuTW92ZVJpZ2h0ID0gc2VsLnN0YXJ0ID09PSBlbC52YWx1ZS5sZW5ndGggJiYgc2VsLmVuZCA9PT0gZWwudmFsdWUubGVuZ3RoICYmIGFmdGVyLmZpcnN0Q2hpbGQ7XG4gICAgaWYgKGZyZWUpIHtcbiAgICAgIGlmIChrZXkgPT09IEhPTUUpIHtcbiAgICAgICAgaWYgKGJlZm9yZS5maXJzdENoaWxkKSB7XG4gICAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmZpcnN0Q2hpbGQsIHt9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxlY3Rpb24oZWwsIHsgc3RhcnQ6IDAsIGVuZDogMCB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IEVORCkge1xuICAgICAgICBpZiAoYWZ0ZXIubGFzdENoaWxkKSB7XG4gICAgICAgICAgZm9jdXNUYWcoYWZ0ZXIubGFzdENoaWxkLCBlbmQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGVjdGlvbihlbCwgZW5kKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IEJBQ0tTUEFDRSAmJiBjYW5Nb3ZlTGVmdCkge1xuICAgICAgICBmb2N1c1RhZyhiZWZvcmUubGFzdENoaWxkLCBlbmQpO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IFJJR0hUICYmIGNhbk1vdmVSaWdodCkge1xuICAgICAgICBmb2N1c1RhZyhhZnRlci5maXJzdENoaWxkLCB7fSk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gTEVGVCAmJiBjYW5Nb3ZlTGVmdCkge1xuICAgICAgICBmb2N1c1RhZyhiZWZvcmUubGFzdENoaWxkLCBlbmQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoa2V5ID09PSBCQUNLU1BBQ0UgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgcmVtb3ZlSXRlbUJ5RWxlbWVudChiZWZvcmUubGFzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBSSUdIVCAmJiBjYW5Nb3ZlUmlnaHQpIHtcbiAgICAgICAgYmVmb3JlLmFwcGVuZENoaWxkKGFmdGVyLmZpcnN0Q2hpbGQpO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IExFRlQgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgYWZ0ZXIuaW5zZXJ0QmVmb3JlKGJlZm9yZS5sYXN0Q2hpbGQsIGFmdGVyLmZpcnN0Q2hpbGQpO1xuICAgICAgfSBlbHNlIGlmIChzaW5rYWJsZUtleXMuaW5kZXhPZihrZXkpID09PSAtMSkgeyAvLyBwcmV2ZW50IGRlZmF1bHQgb3RoZXJ3aXNlXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChjb21wbGV0ZXIpIHsgY29tcGxldGVyLnJlZnJlc2hQb3NpdGlvbigpOyB9XG4gICAgfVxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGtleXByZXNzIChlKSB7XG4gICAgY29uc3Qga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGUgfHwgZS5jaGFyQ29kZTtcbiAgICBpZiAoU3RyaW5nLmZyb21DaGFyQ29kZShrZXkpID09PSBkZWxpbWl0ZXIpIHtcbiAgICAgIGNvbnZlcnQoKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXN0ZSAoKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiBldmFsdWF0ZVNlbGVjdCgpLCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2YWx1YXRlTm9TZWxlY3QgKGV4dHJhcywgZW50aXJlbHkpIHtcbiAgICBldmFsdWF0ZUludGVybmFsKGV4dHJhcywgZW50aXJlbHkpOyAvLyBuZWNlc3NhcnkgZm9yIGJsdXIgZXZlbnRzLCBpbml0aWFsaXphdGlvbiwgdW5mb2N1c2VkIGV2YWx1YXRpb25cbiAgfVxuXG4gIGZ1bmN0aW9uIGV2YWx1YXRlU2VsZWN0IChleHRyYXMsIGVudGlyZWx5KSB7XG4gICAgZXZhbHVhdGVJbnRlcm5hbChleHRyYXMsIGVudGlyZWx5LCBzZWxlY3Rpb24oZWwpKTsgLy8gb25seSBpZiB3ZSBrbm93IHRoZSBpbnB1dCBoYXMvc2hvdWxkIGhhdmUgZm9jdXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGV2YWx1YXRlSW50ZXJuYWwgKGV4dHJhcywgZW50aXJlbHksIHApIHtcbiAgICBjb25zdCBsZW4gPSBlbnRpcmVseSB8fCAhcCA/IEluZmluaXR5IDogcC5zdGFydDtcbiAgICBjb25zdCB0YWdzID0gZWwudmFsdWUuc2xpY2UoMCwgbGVuKS5jb25jYXQoZXh0cmFzIHx8IFtdKS5zcGxpdChkZWxpbWl0ZXIpO1xuICAgIGlmICh0YWdzLmxlbmd0aCA8IDEgfHwgIWZyZWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByZXN0ID0gdGFncy5wb3AoKSArIGVsLnZhbHVlLnNsaWNlKGxlbik7XG4gICAgY29uc3QgcmVtb3ZhbCA9IHRhZ3Muam9pbihkZWxpbWl0ZXIpLmxlbmd0aDtcblxuICAgIHRhZ3MuZm9yRWFjaCh0YWcgPT4gYWRkSXRlbSh0b0l0ZW1EYXRhKHRhZykpKTtcbiAgICBjbGVhbnVwKCk7XG4gICAgZWwudmFsdWUgPSByZXN0O1xuICAgIHJlc2VsZWN0KCk7XG4gICAgc2hyaW5rZXIucmVmcmVzaCgpO1xuXG4gICAgZnVuY3Rpb24gcmVzZWxlY3QgKCkge1xuICAgICAgaWYgKHApIHtcbiAgICAgICAgcC5zdGFydCAtPSByZW1vdmFsO1xuICAgICAgICBwLmVuZCAtPSByZW1vdmFsO1xuICAgICAgICBzZWxlY3Rpb24oZWwsIHApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFudXAgKCkge1xuICAgIGNvbnN0IHRhZ3MgPSBbXTtcblxuICAgIGVhY2goYmVmb3JlLCBkZXRlY3QpO1xuICAgIGVhY2goYWZ0ZXIsIGRldGVjdCk7XG5cbiAgICBmdW5jdGlvbiBkZXRlY3QgKHZhbHVlLCB0YWdFbGVtZW50KSB7XG4gICAgICBpZiAodmFsaWRhdGUodmFsdWUsIHRhZ3Muc2xpY2UoKSkpIHtcbiAgICAgICAgdGFncy5wdXNoKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoby5wcmV2ZW50SW52YWxpZCkge1xuICAgICAgICB0YWdFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnRWxlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YWdFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3RheS1pbnZhbGlkJyk7XG4gICAgICAgIGFwaS5lbWl0KCdpbnZhbGlkJywgdmFsdWUsIHRhZ0VsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAoY29udGFpbmVyLCBpdGVtKSB7XG4gICAgdGV4dChjb250YWluZXIsIGdldFRleHQoaXRlbS5kYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGFnICh0YWcpIHtcbiAgICByZXR1cm4gdGV4dCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9jdXNUYWcgKHRhZywgcCkge1xuICAgIGlmICghdGFnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGV2YWx1YXRlU2VsZWN0KFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgICBjb25zdCBwYXJlbnQgPSB0YWcucGFyZW50RWxlbWVudDtcbiAgICBpZiAocGFyZW50ID09PSBiZWZvcmUpIHtcbiAgICAgIHdoaWxlIChwYXJlbnQubGFzdENoaWxkICE9PSB0YWcpIHtcbiAgICAgICAgYWZ0ZXIuaW5zZXJ0QmVmb3JlKHBhcmVudC5sYXN0Q2hpbGQsIGFmdGVyLmZpcnN0Q2hpbGQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB3aGlsZSAocGFyZW50LmZpcnN0Q2hpbGQgIT09IHRhZykge1xuICAgICAgICBiZWZvcmUuYXBwZW5kQ2hpbGQocGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgICAgfVxuICAgIH1cbiAgICB0YWcucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0YWcpO1xuICAgIGVsLnZhbHVlID0gcC5yZW1vdmUgPyAnJyA6IHJlYWRUYWcodGFnKTtcbiAgICBlbC5mb2N1cygpO1xuICAgIHNlbGVjdGlvbihlbCwgcCk7XG4gICAgc2hyaW5rZXIucmVmcmVzaCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFzU2libGluZ3MgKCkge1xuICAgIGNvbnN0IGNoaWxkcmVuID0gZWwucGFyZW50RWxlbWVudC5jaGlsZHJlbjtcbiAgICByZXR1cm4gWy4uLmNoaWxkcmVuXS5zb21lKHMgPT4gcyAhPT0gZWwgJiYgcy5ub2RlVHlwZSA9PT0gRUxFTUVOVCk7XG4gIH1cblxuICBmdW5jdGlvbiBlYWNoIChjb250YWluZXIsIGZuKSB7XG4gICAgWy4uLmNvbnRhaW5lci5jaGlsZHJlbl0uZm9yRWFjaCgodGFnLCBpKSA9PiBmbihyZWFkVGFnKHRhZyksIHRhZywgaSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdFZhbGlkYXRlICh2YWx1ZSwgdGFncykge1xuICAgIHJldHVybiB0YWdzLmluZGV4T2YodmFsdWUpID09PSAtMTtcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0ZXh0IChlbCwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBlbC5pbm5lclRleHQgPSBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICB9XG4gIGlmICh0eXBlb2YgZWwuaW5uZXJUZXh0ID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlbC5pbm5lclRleHQ7XG4gIH1cbiAgcmV0dXJuIGVsLnRleHRDb250ZW50O1xufVxuIl19
