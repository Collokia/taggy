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

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

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
  var state = { counter: 0, value: null };

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
      var value = readInput();
      if (value !== state.value) {
        state.counter++;
        state.value = value;

        var counter = state.counter;
        suggestions(value, function (s) {
          if (state.counter === counter) {
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

  function readInput() {
    return textInput ? el.value : el.innerHTML;
  }

  function add(suggestion) {
    var li = tag('li', 'tac-item');
    render(li, suggestion);
    breakupForHighlighter(li);
    crossvent.add(li, 'click', clickedSuggestion);
    crossvent.add(li, 'autocomplete-filter', filterItem);
    crossvent.add(li, 'autocomplete-hide', hideItem);
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
    var node;
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
    var value = readInput().trim();
    var count = 0;
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

},{"bullseye":1,"crossvent":17,"fuzzysearch":19,"sell":21}],23:[function(require,module,exports){
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

},{"./dom":24,"./text":27,"crossvent":17}],24:[function(require,module,exports){
'use strict';

module.exports = function dom(tagName, classes) {
  var el = document.createElement(tagName);
  if (classes) {
    el.className = classes;
  }
  return el;
};

},{}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var sum = require('hash-sum');
var crossvent = require('crossvent');
var emitter = require('contra/emitter');
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
var sinkableKeys = [END, HOME];
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

  var api = emitter({
    addItem: addItem,
    removeItem: removeItemByData,
    removeItemByElement: removeItemByElement,
    value: readValue,
    destroy: destroy
  });

  evaluate([delimiter], true);
  _noselect = false;

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
    var config = o.autocomplete;
    var prefix = config.prefix;
    var cache = config.cache || {};
    var noSource = !config.source;
    if (noSource && !config.suggestions) {
      return;
    }
    var req;
    var limit = Number(config.limit) || Infinity;
    var suggestions = noSource && config.suggestions || suggest;
    var completer = autocomplete(el, {
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
    function suggest(q, done) {
      var query = q.trim();
      if (query.length === 0) {
        done([]);return;
      }
      if (req) {
        try {
          req.abort();
          req = null;
        } catch (e) {}
      }
      var hash = sum(query); // fast, case insensitive, prevents collisions
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
      config.source(query).then(function (data) {
        var items = Array.isArray(data) ? data : [];
        cache[hash] = { created: new Date(), items: items };
        done(items);
      }).catch(function (error) {
        console.log('Autocomplete source promise rejected', error, el);
        done([]);
      });
    }
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
    return api;
  }

  function moveLeft(value, tag) {
    before.appendChild(tag);
  }

  function keydown(e) {
    var sel = selection(el);
    var key = e.which || e.keyCode || e.charCode;
    var canMoveLeft = sel.start === 0 && sel.end === 0 && before.lastChild;
    var canMoveRight = sel.start === el.value.length && sel.end === el.value.length && after.firstChild;
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
    text(container, getText(item.data));
  }

  function readTag(tag) {
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

},{"./autocomplete":22,"./autosize":23,"./dom":24,"./selection":25,"./text":27,"contra/emitter":13,"crossvent":17,"hash-sum":20}],27:[function(require,module,exports){
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

},{}]},{},[26])(26)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZGVib3VuY2UuanMiLCJub2RlX21vZHVsZXMvY29udHJhL2VtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy9hdG9hL2F0b2EuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9ub2RlX21vZHVsZXMvY3VzdG9tLWV2ZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvY3Jvc3N2ZW50LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvZXZlbnRtYXAuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZWFyY2gvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGFzaC1zdW0vaGFzaC1zdW0uanMiLCJub2RlX21vZHVsZXMvc2VsbC9zZWxsLmpzIiwic3JjL2F1dG9jb21wbGV0ZS5qcyIsInNyYy9hdXRvc2l6ZS5qcyIsInNyYy9kb20uanMiLCJzcmMvc2VsZWN0aW9uLmpzIiwic3JjL3RhZ2d5LmpzIiwic3JjL3RleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0EsWUFBWSxDQUFDOzs7O0FBRWIsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzNCLElBQUksU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNyQyxJQUFJLFFBQVEsR0FBRyxPQUFPLENBQUMs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SSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMxQixNQUFFLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO0dBQ3ZDO0FBQ0QsTUFBSSxPQUFPLEVBQUUsQ0FBQyxTQUFTLEtBQUssUUFBUSxFQUFFO0FBQ3BDLFdBQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQztHQUNyQjtBQUNELFNBQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQztDQUN2Qjs7QUFFRCxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJy4vdGhyb3R0bGUnKTtcbnZhciB0YWlsb3JtYWRlID0gcmVxdWlyZSgnLi90YWlsb3JtYWRlJyk7XG5cbmZ1bmN0aW9uIGJ1bGxzZXllIChlbCwgdGFyZ2V0LCBvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucztcbiAgdmFyIGRvbVRhcmdldCA9IHRhcmdldCAmJiB0YXJnZXQudGFnTmFtZTtcblxuICBpZiAoIWRvbVRhcmdldCAmJiBhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgbyA9IHRhcmdldDtcbiAgfVxuICBpZiAoIWRvbVRhcmdldCkge1xuICAgIHRhcmdldCA9IGVsO1xuICB9XG4gIGlmICghbykgeyBvID0ge307IH1cblxuICB2YXIgZGVzdHJveWVkID0gZmFsc2U7XG4gIHZhciB0aHJvdHRsZWRXcml0ZSA9IHRocm90dGxlKHdyaXRlLCAzMCk7XG4gIHZhciB0YWlsb3JPcHRpb25zID0geyB1cGRhdGU6IG8uYXV0b3VwZGF0ZVRvQ2FyZXQgIT09IGZhbHNlICYmIHVwZGF0ZSB9O1xuICB2YXIgdGFpbG9yID0gby5jYXJldCAmJiB0YWlsb3JtYWRlKHRhcmdldCwgdGFpbG9yT3B0aW9ucyk7XG5cbiAgd3JpdGUoKTtcblxuICBpZiAoby50cmFja2luZyAhPT0gZmFsc2UpIHtcbiAgICBjcm9zc3ZlbnQuYWRkKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcmVhZDogcmVhZE51bGwsXG4gICAgcmVmcmVzaDogd3JpdGUsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICBzbGVlcDogc2xlZXBcbiAgfTtcblxuICBmdW5jdGlvbiBzbGVlcCAoKSB7XG4gICAgdGFpbG9yT3B0aW9ucy5zbGVlcGluZyA9IHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkTnVsbCAoKSB7IHJldHVybiByZWFkKCk7IH1cblxuICBmdW5jdGlvbiByZWFkIChyZWFkaW5ncykge1xuICAgIHZhciBib3VuZHMgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdmFyIHNjcm9sbFRvcCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3A7XG4gICAgaWYgKHRhaWxvcikge1xuICAgICAgcmVhZGluZ3MgPSB0YWlsb3IucmVhZCgpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy5sZWZ0KSArIHJlYWRpbmdzLngsXG4gICAgICAgIHk6IChyZWFkaW5ncy5hYnNvbHV0ZSA/IDAgOiBib3VuZHMudG9wKSArIHNjcm9sbFRvcCArIHJlYWRpbmdzLnkgKyAyMFxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IGJvdW5kcy5sZWZ0LFxuICAgICAgeTogYm91bmRzLnRvcCArIHNjcm9sbFRvcFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGUgKHJlYWRpbmdzKSB7XG4gICAgd3JpdGUocmVhZGluZ3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKHJlYWRpbmdzKSB7XG4gICAgaWYgKGRlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCdWxsc2V5ZSBjYW5cXCd0IHJlZnJlc2ggYWZ0ZXIgYmVpbmcgZGVzdHJveWVkLiBDcmVhdGUgYW5vdGhlciBpbnN0YW5jZSBpbnN0ZWFkLicpO1xuICAgIH1cbiAgICBpZiAodGFpbG9yICYmICFyZWFkaW5ncykge1xuICAgICAgdGFpbG9yT3B0aW9ucy5zbGVlcGluZyA9IGZhbHNlO1xuICAgICAgdGFpbG9yLnJlZnJlc2goKTsgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcCA9IHJlYWQocmVhZGluZ3MpO1xuICAgIGlmICghdGFpbG9yICYmIHRhcmdldCAhPT0gZWwpIHtcbiAgICAgIHAueSArPSB0YXJnZXQub2Zmc2V0SGVpZ2h0O1xuICAgIH1cbiAgICBlbC5zdHlsZS5sZWZ0ID0gcC54ICsgJ3B4JztcbiAgICBlbC5zdHlsZS50b3AgPSBwLnkgKyAncHgnO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgaWYgKHRhaWxvcikgeyB0YWlsb3IuZGVzdHJveSgpOyB9XG4gICAgY3Jvc3N2ZW50LnJlbW92ZSh3aW5kb3csICdyZXNpemUnLCB0aHJvdHRsZWRXcml0ZSk7XG4gICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ1bGxzZXllO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBnZXRTZWxlY3Rpb25SYXcgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblJhdycpO1xudmFyIGdldFNlbGVjdGlvbk51bGxPcCA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uTnVsbE9wJyk7XG52YXIgZ2V0U2VsZWN0aW9uU3ludGhldGljID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25TeW50aGV0aWMnKTtcbnZhciBpc0hvc3QgPSByZXF1aXJlKCcuL2lzSG9zdCcpO1xuaWYgKGlzSG9zdC5tZXRob2QoZ2xvYmFsLCAnZ2V0U2VsZWN0aW9uJykpIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uUmF3O1xufSBlbHNlIGlmICh0eXBlb2YgZG9jLnNlbGVjdGlvbiA9PT0gJ29iamVjdCcgJiYgZG9jLnNlbGVjdGlvbikge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25TeW50aGV0aWM7XG59IGVsc2Uge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wICgpIHt9XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbk51bGxPcCAoKSB7XG4gIHJldHVybiB7XG4gICAgcmVtb3ZlQWxsUmFuZ2VzOiBub29wLFxuICAgIGFkZFJhbmdlOiBub29wXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uTnVsbE9wO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25SYXcgKCkge1xuICByZXR1cm4gZ2xvYmFsLmdldFNlbGVjdGlvbigpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvblJhdztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuL3JhbmdlVG9UZXh0UmFuZ2UnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xudmFyIEdldFNlbGVjdGlvblByb3RvID0gR2V0U2VsZWN0aW9uLnByb3RvdHlwZTtcblxuZnVuY3Rpb24gR2V0U2VsZWN0aW9uIChzZWxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmFuZ2UgPSBzZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcblxuICB0aGlzLl9zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG4gIHRoaXMuX3JhbmdlcyA9IFtdO1xuXG4gIGlmIChzZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWxmKTtcbiAgfSBlbHNlIGlmIChpc1RleHRSYW5nZShyYW5nZSkpIHtcbiAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbGYsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWxmKTtcbiAgfVxufVxuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB0ZXh0UmFuZ2U7XG4gIHRyeSB7XG4gICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnTm9uZScpIHtcbiAgICAgIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgICB0ZXh0UmFuZ2Uuc2VsZWN0KCk7XG4gICAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICB1cGRhdGVFbXB0eVNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmFkZFJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocmFuZ2UpLnNlbGVjdCgpO1xuICAgIHRoaXMuX3Jhbmdlc1swXSA9IHJhbmdlO1xuICAgIHRoaXMucmFuZ2VDb3VudCA9IDE7XG4gICAgdGhpcy5pc0NvbGxhcHNlZCA9IHRoaXMuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UodGhpcywgcmFuZ2UsIGZhbHNlKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0UmFuZ2VzID0gZnVuY3Rpb24gKHJhbmdlcykge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB2YXIgcmFuZ2VDb3VudCA9IHJhbmdlcy5sZW5ndGg7XG4gIGlmIChyYW5nZUNvdW50ID4gMSkge1xuICAgIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2VzKTtcbiAgfSBlbHNlIGlmIChyYW5nZUNvdW50KSB7XG4gICAgdGhpcy5hZGRSYW5nZShyYW5nZXNbMF0pO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRSYW5nZUF0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5yYW5nZUNvdW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRSYW5nZUF0KCk6IGluZGV4IG91dCBvZiBib3VuZHMnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZ2VzW2luZGV4XS5jbG9uZVJhbmdlKCk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ0NvbnRyb2wnKSB7XG4gICAgcmVtb3ZlUmFuZ2VNYW51YWxseSh0aGlzLCByYW5nZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250cm9sUmFuZ2UgPSB0aGlzLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgdmFyIGVsO1xuICB2YXIgcmVtb3ZlZCA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBjb250cm9sUmFuZ2UuaXRlbShpKTtcbiAgICBpZiAoZWwgIT09IHJhbmdlRWxlbWVudCB8fCByZW1vdmVkKSB7XG4gICAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmVhY2hSYW5nZSA9IGZ1bmN0aW9uIChmbiwgcmV0dXJuVmFsdWUpIHtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuID0gdGhpcy5fcmFuZ2VzLmxlbmd0aDtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGZuKHRoaXMuZ2V0UmFuZ2VBdChpKSkpIHtcbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldEFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJhbmdlcyA9IFtdO1xuICB0aGlzLmVhY2hSYW5nZShmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICByYW5nZXMucHVzaChyYW5nZSk7XG4gIH0pO1xuICByZXR1cm4gcmFuZ2VzO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0U2luZ2xlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdGhpcy5hZGRSYW5nZShyYW5nZSk7XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDb250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlcykge1xuICB2YXIgY29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGVsLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB0cnkge1xuICAgICAgY29udHJvbFJhbmdlLmFkZChlbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXRSYW5nZXMoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgICB9XG4gIH1cbiAgY29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVJhbmdlTWFudWFsbHkgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIHJhbmdlcyA9IHNlbC5nZXRBbGxSYW5nZXMoKTtcbiAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc1NhbWVSYW5nZShyYW5nZSwgcmFuZ2VzW2ldKSkge1xuICAgICAgc2VsLmFkZFJhbmdlKHJhbmdlc1tpXSk7XG4gICAgfVxuICB9XG4gIGlmICghc2VsLnJhbmdlQ291bnQpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHZhciBhbmNob3JQcmVmaXggPSAnc3RhcnQnO1xuICB2YXIgZm9jdXNQcmVmaXggPSAnZW5kJztcbiAgc2VsLmFuY2hvck5vZGUgPSByYW5nZVthbmNob3JQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5hbmNob3JPZmZzZXQgPSByYW5nZVthbmNob3JQcmVmaXggKyAnT2Zmc2V0J107XG4gIHNlbC5mb2N1c05vZGUgPSByYW5nZVtmb2N1c1ByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmZvY3VzT2Zmc2V0ID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnT2Zmc2V0J107XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUVtcHR5U2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLmFuY2hvck5vZGUgPSBzZWwuZm9jdXNOb2RlID0gbnVsbDtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHNlbC5mb2N1c09mZnNldCA9IDA7XG4gIHNlbC5yYW5nZUNvdW50ID0gMDtcbiAgc2VsLmlzQ29sbGFwc2VkID0gdHJ1ZTtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQgKHJhbmdlTm9kZXMpIHtcbiAgaWYgKCFyYW5nZU5vZGVzLmxlbmd0aCB8fCByYW5nZU5vZGVzWzBdLm5vZGVUeXBlICE9PSAxKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAodmFyIGkgPSAxLCBsZW4gPSByYW5nZU5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc0FuY2VzdG9yT2YocmFuZ2VOb2Rlc1swXSwgcmFuZ2VOb2Rlc1tpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UgKHJhbmdlKSB7XG4gIHZhciBub2RlcyA9IHJhbmdlLmdldE5vZGVzKCk7XG4gIGlmICghcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQobm9kZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKCk6IHJhbmdlIGRpZCBub3QgY29uc2lzdCBvZiBhIHNpbmdsZSBlbGVtZW50Jyk7XG4gIH1cbiAgcmV0dXJuIG5vZGVzWzBdO1xufVxuXG5mdW5jdGlvbiBpc1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgcmV0dXJuIHJhbmdlICYmIHJhbmdlLnRleHQgIT09IHZvaWQgMDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRnJvbVRleHRSYW5nZSAoc2VsLCByYW5nZSkge1xuICBzZWwuX3JhbmdlcyA9IFtyYW5nZV07XG4gIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgcmFuZ2UsIGZhbHNlKTtcbiAgc2VsLnJhbmdlQ291bnQgPSAxO1xuICBzZWwuaXNDb2xsYXBzZWQgPSByYW5nZS5jb2xsYXBzZWQ7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xuICBpZiAoc2VsLl9zZWxlY3Rpb24udHlwZSA9PT0gJ05vbmUnKSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoaXNUZXh0UmFuZ2UoY29udHJvbFJhbmdlKSkge1xuICAgICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWwsIGNvbnRyb2xSYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbC5yYW5nZUNvdW50ID0gY29udHJvbFJhbmdlLmxlbmd0aDtcbiAgICAgIHZhciByYW5nZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlQ291bnQ7ICsraSkge1xuICAgICAgICByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgICAgICByYW5nZS5zZWxlY3ROb2RlKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICAgICAgc2VsLl9yYW5nZXMucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgICBzZWwuaXNDb2xsYXBzZWQgPSBzZWwucmFuZ2VDb3VudCA9PT0gMSAmJiBzZWwuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHNlbC5fcmFuZ2VzW3NlbC5yYW5nZUNvdW50IC0gMV0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgfVxuICB0cnkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQocmFuZ2VFbGVtZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignYWRkUmFuZ2UoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUmFuZ2UgKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiAoXG4gICAgbGVmdC5zdGFydENvbnRhaW5lciA9PT0gcmlnaHQuc3RhcnRDb250YWluZXIgJiZcbiAgICBsZWZ0LnN0YXJ0T2Zmc2V0ID09PSByaWdodC5zdGFydE9mZnNldCAmJlxuICAgIGxlZnQuZW5kQ29udGFpbmVyID09PSByaWdodC5lbmRDb250YWluZXIgJiZcbiAgICBsZWZ0LmVuZE9mZnNldCA9PT0gcmlnaHQuZW5kT2Zmc2V0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQW5jZXN0b3JPZiAoYW5jZXN0b3IsIGRlc2NlbmRhbnQpIHtcbiAgdmFyIG5vZGUgPSBkZXNjZW5kYW50O1xuICB3aGlsZSAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gYW5jZXN0b3IpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBHZXRTZWxlY3Rpb24oZ2xvYmFsLmRvY3VtZW50LnNlbGVjdGlvbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBpc0hvc3RNZXRob2QgKGhvc3QsIHByb3ApIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgaG9zdFtwcm9wXTtcbiAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgISEodHlwZSA9PT0gJ29iamVjdCcgJiYgaG9zdFtwcm9wXSkgfHwgdHlwZSA9PT0gJ3Vua25vd24nO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RQcm9wZXJ0eSAoaG9zdCwgcHJvcCkge1xuICByZXR1cm4gdHlwZW9mIGhvc3RbcHJvcF0gIT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBtYW55IChmbikge1xuICByZXR1cm4gZnVuY3Rpb24gYXJlSG9zdGVkIChob3N0LCBwcm9wcykge1xuICAgIHZhciBpID0gcHJvcHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGlmICghZm4oaG9zdCwgcHJvcHNbaV0pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRob2Q6IGlzSG9zdE1ldGhvZCxcbiAgbWV0aG9kczogbWFueShpc0hvc3RNZXRob2QpLFxuICBwcm9wZXJ0eTogaXNIb3N0UHJvcGVydHksXG4gIHByb3BlcnRpZXM6IG1hbnkoaXNIb3N0UHJvcGVydHkpXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gcmFuZ2VUb1RleHRSYW5nZSAocCkge1xuICBpZiAocC5jb2xsYXBzZWQpIHtcbiAgICByZXR1cm4gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHAuc3RhcnRPZmZzZXQgfSwgdHJ1ZSk7XG4gIH1cbiAgdmFyIHN0YXJ0UmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgdmFyIGVuZFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLmVuZENvbnRhaW5lciwgb2Zmc2V0OiBwLmVuZE9mZnNldCB9LCBmYWxzZSk7XG4gIHZhciB0ZXh0UmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICB0ZXh0UmFuZ2Uuc2V0RW5kUG9pbnQoJ1N0YXJ0VG9TdGFydCcsIHN0YXJ0UmFuZ2UpO1xuICB0ZXh0UmFuZ2Uuc2V0RW5kUG9pbnQoJ0VuZFRvRW5kJywgZW5kUmFuZ2UpO1xuICByZXR1cm4gdGV4dFJhbmdlO1xufVxuXG5mdW5jdGlvbiBpc0NoYXJhY3RlckRhdGFOb2RlIChub2RlKSB7XG4gIHZhciB0ID0gbm9kZS5ub2RlVHlwZTtcbiAgcmV0dXJuIHQgPT09IDMgfHwgdCA9PT0gNCB8fCB0ID09PSA4IDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UgKHAsIHN0YXJ0aW5nKSB7XG4gIHZhciBib3VuZDtcbiAgdmFyIHBhcmVudDtcbiAgdmFyIG9mZnNldCA9IHAub2Zmc2V0O1xuICB2YXIgd29ya2luZ05vZGU7XG4gIHZhciBjaGlsZE5vZGVzO1xuICB2YXIgcmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICB2YXIgZGF0YSA9IGlzQ2hhcmFjdGVyRGF0YU5vZGUocC5ub2RlKTtcblxuICBpZiAoZGF0YSkge1xuICAgIGJvdW5kID0gcC5ub2RlO1xuICAgIHBhcmVudCA9IGJvdW5kLnBhcmVudE5vZGU7XG4gIH0gZWxzZSB7XG4gICAgY2hpbGROb2RlcyA9IHAubm9kZS5jaGlsZE5vZGVzO1xuICAgIGJvdW5kID0gb2Zmc2V0IDwgY2hpbGROb2Rlcy5sZW5ndGggPyBjaGlsZE5vZGVzW29mZnNldF0gOiBudWxsO1xuICAgIHBhcmVudCA9IHAubm9kZTtcbiAgfVxuXG4gIHdvcmtpbmdOb2RlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgd29ya2luZ05vZGUuaW5uZXJIVE1MID0gJyYjZmVmZjsnO1xuXG4gIGlmIChib3VuZCkge1xuICAgIHBhcmVudC5pbnNlcnRCZWZvcmUod29ya2luZ05vZGUsIGJvdW5kKTtcbiAgfSBlbHNlIHtcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQod29ya2luZ05vZGUpO1xuICB9XG5cbiAgcmFuZ2UubW92ZVRvRWxlbWVudFRleHQod29ya2luZ05vZGUpO1xuICByYW5nZS5jb2xsYXBzZSghc3RhcnRpbmcpO1xuICBwYXJlbnQucmVtb3ZlQ2hpbGQod29ya2luZ05vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgcmFuZ2Vbc3RhcnRpbmcgPyAnbW92ZVN0YXJ0JyA6ICdtb3ZlRW5kJ10oJ2NoYXJhY3RlcicsIG9mZnNldCk7XG4gIH1cbiAgcmV0dXJuIHJhbmdlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmdlVG9UZXh0UmFuZ2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbicpO1xudmFyIHNldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vc2V0U2VsZWN0aW9uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXQ6IGdldFNlbGVjdGlvbixcbiAgc2V0OiBzZXRTZWxlY3Rpb25cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbicpO1xudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuL3JhbmdlVG9UZXh0UmFuZ2UnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIHNldFNlbGVjdGlvbiAocCkge1xuICBpZiAoZG9jLmNyZWF0ZVJhbmdlKSB7XG4gICAgbW9kZXJuU2VsZWN0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgb2xkU2VsZWN0aW9uKCk7XG4gIH1cblxuICBmdW5jdGlvbiBtb2Rlcm5TZWxlY3Rpb24gKCkge1xuICAgIHZhciBzZWwgPSBnZXRTZWxlY3Rpb24oKTtcbiAgICB2YXIgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoIXAuc3RhcnRDb250YWluZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHAuZW5kQ29udGFpbmVyKSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5lbmRDb250YWluZXIsIHAuZW5kT2Zmc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmFuZ2Uuc2V0RW5kKHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIH1cbiAgICByYW5nZS5zZXRTdGFydChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgc2VsLmFkZFJhbmdlKHJhbmdlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9sZFNlbGVjdGlvbiAoKSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShwKS5zZWxlY3QoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNlbGwgPSByZXF1aXJlKCdzZWxsJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgc2VsZWNjaW9uID0gcmVxdWlyZSgnc2VsZWNjaW9uJyk7XG52YXIgdGhyb3R0bGUgPSByZXF1aXJlKCcuL3Rocm90dGxlJyk7XG52YXIgZ2V0U2VsZWN0aW9uID0gc2VsZWNjaW9uLmdldDtcbnZhciBwcm9wcyA9IFtcbiAgJ2RpcmVjdGlvbicsXG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLFxuICAnaGVpZ2h0JyxcbiAgJ292ZXJmbG93WCcsXG4gICdvdmVyZmxvd1knLFxuICAnYm9yZGVyVG9wV2lkdGgnLFxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXG4gICdib3JkZXJCb3R0b21XaWR0aCcsXG4gICdib3JkZXJMZWZ0V2lkdGgnLFxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG4gICdmb250U3R5bGUnLFxuICAnZm9udFZhcmlhbnQnLFxuICAnZm9udFdlaWdodCcsXG4gICdmb250U3RyZXRjaCcsXG4gICdmb250U2l6ZScsXG4gICdmb250U2l6ZUFkanVzdCcsXG4gICdsaW5lSGVpZ2h0JyxcbiAgJ2ZvbnRGYW1pbHknLFxuICAndGV4dEFsaWduJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAndGV4dEluZGVudCcsXG4gICd0ZXh0RGVjb3JhdGlvbicsXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3dvcmRTcGFjaW5nJ1xuXTtcbnZhciB3aW4gPSBnbG9iYWw7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgZmYgPSB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSBudWxsICYmIHdpbi5tb3pJbm5lclNjcmVlblggIT09IHZvaWQgMDtcblxuZnVuY3Rpb24gdGFpbG9ybWFkZSAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRleHRJbnB1dCA9IGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgdmFyIHRocm90dGxlZFJlZnJlc2ggPSB0aHJvdHRsZShyZWZyZXNoLCAzMCk7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcblxuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkUG9zaXRpb24sXG4gICAgcmVmcmVzaDogdGhyb3R0bGVkUmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gbm9vcCAoKSB7fVxuICBmdW5jdGlvbiByZWFkUG9zaXRpb24gKCkgeyByZXR1cm4gKHRleHRJbnB1dCA/IGNvb3Jkc1RleHQgOiBjb29yZHNIVE1MKSgpOyB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgaWYgKG8uc2xlZXBpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIChvLnVwZGF0ZSB8fCBub29wKShyZWFkUG9zaXRpb24oKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNUZXh0ICgpIHtcbiAgICB2YXIgcCA9IHNlbGwoZWwpO1xuICAgIHZhciBjb250ZXh0ID0gcHJlcGFyZSgpO1xuICAgIHZhciByZWFkaW5ncyA9IHJlYWRUZXh0Q29vcmRzKGNvbnRleHQsIHAuc3RhcnQpO1xuICAgIGRvYy5ib2R5LnJlbW92ZUNoaWxkKGNvbnRleHQubWlycm9yKTtcbiAgICByZXR1cm4gcmVhZGluZ3M7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNIVE1MICgpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgaWYgKHNlbC5yYW5nZUNvdW50KSB7XG4gICAgICB2YXIgcmFuZ2UgPSBzZWwuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgIHZhciBuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcgPSByYW5nZS5zdGFydENvbnRhaW5lci5ub2RlTmFtZSA9PT0gJ1AnICYmIHJhbmdlLnN0YXJ0T2Zmc2V0ID09PSAwO1xuICAgICAgaWYgKG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1Zykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHg6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldExlZnQsXG4gICAgICAgICAgeTogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0VG9wLFxuICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2UuZ2V0Q2xpZW50UmVjdHMpIHtcbiAgICAgICAgdmFyIHJlY3RzID0gcmFuZ2UuZ2V0Q2xpZW50UmVjdHMoKTtcbiAgICAgICAgaWYgKHJlY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogcmVjdHNbMF0ubGVmdCxcbiAgICAgICAgICAgIHk6IHJlY3RzWzBdLnRvcCxcbiAgICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGV4dENvb3JkcyAoY29udGV4dCwgcCkge1xuICAgIHZhciByZXN0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICB2YXIgbWlycm9yID0gY29udGV4dC5taXJyb3I7XG4gICAgdmFyIGNvbXB1dGVkID0gY29udGV4dC5jb21wdXRlZDtcblxuICAgIHdyaXRlKG1pcnJvciwgcmVhZChlbCkuc3Vic3RyaW5nKDAsIHApKTtcblxuICAgIGlmIChlbC50YWdOYW1lID09PSAnSU5QVVQnKSB7XG4gICAgICBtaXJyb3IudGV4dENvbnRlbnQgPSBtaXJyb3IudGV4dENvbnRlbnQucmVwbGFjZSgvXFxzL2csICdcXHUwMGEwJyk7XG4gICAgfVxuXG4gICAgd3JpdGUocmVzdCwgcmVhZChlbCkuc3Vic3RyaW5nKHApIHx8ICcuJyk7XG5cbiAgICBtaXJyb3IuYXBwZW5kQ2hpbGQocmVzdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogcmVzdC5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcbiAgICAgIHk6IHJlc3Qub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGVsKSB7XG4gICAgcmV0dXJuIHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJlcGFyZSAoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gd2luLmdldENvbXB1dGVkU3R5bGUgPyBnZXRDb21wdXRlZFN0eWxlKGVsKSA6IGVsLmN1cnJlbnRTdHlsZTtcbiAgICB2YXIgbWlycm9yID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHZhciBzdHlsZSA9IG1pcnJvci5zdHlsZTtcblxuICAgIGRvYy5ib2R5LmFwcGVuZENoaWxkKG1pcnJvcik7XG5cbiAgICBpZiAoZWwudGFnTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgc3R5bGUud29yZFdyYXAgPSAnYnJlYWstd29yZCc7XG4gICAgfVxuICAgIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICAgIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBzdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgcHJvcHMuZm9yRWFjaChjb3B5KTtcblxuICAgIGlmIChmZikge1xuICAgICAgc3R5bGUud2lkdGggPSBwYXJzZUludChjb21wdXRlZC53aWR0aCkgLSAyICsgJ3B4JztcbiAgICAgIGlmIChlbC5zY3JvbGxIZWlnaHQgPiBwYXJzZUludChjb21wdXRlZC5oZWlnaHQpKSB7XG4gICAgICAgIHN0eWxlLm92ZXJmbG93WSA9ICdzY3JvbGwnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuICAgIH1cbiAgICByZXR1cm4geyBtaXJyb3I6IG1pcnJvciwgY29tcHV0ZWQ6IGNvbXB1dGVkIH07XG5cbiAgICBmdW5jdGlvbiBjb3B5IChwcm9wKSB7XG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChlbCwgdmFsdWUpIHtcbiAgICBpZiAodGV4dElucHV0KSB7XG4gICAgICBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRhaWxvcm1hZGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRocm90dGxlIChmbiwgYm91bmRhcnkpIHtcbiAgdmFyIGxhc3QgPSAtSW5maW5pdHk7XG4gIHZhciB0aW1lcjtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJvdW5jZWQgKCkge1xuICAgIGlmICh0aW1lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB1bmJvdW5kKCk7XG5cbiAgICBmdW5jdGlvbiB1bmJvdW5kICgpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICB0aW1lciA9IG51bGw7XG4gICAgICB2YXIgbmV4dCA9IGxhc3QgKyBib3VuZGFyeTtcbiAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyA+IG5leHQpIHtcbiAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgZm4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVyID0gc2V0VGltZW91dCh1bmJvdW5kLCBuZXh0IC0gbm93KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGhyb3R0bGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0aWNreSA9IHJlcXVpcmUoJ3RpY2t5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVib3VuY2UgKGZuLCBhcmdzLCBjdHgpIHtcbiAgaWYgKCFmbikgeyByZXR1cm47IH1cbiAgdGlja3koZnVuY3Rpb24gcnVuICgpIHtcbiAgICBmbi5hcHBseShjdHggfHwgbnVsbCwgYXJncyB8fCBbXSk7XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGF0b2EgPSByZXF1aXJlKCdhdG9hJyk7XG52YXIgZGVib3VuY2UgPSByZXF1aXJlKCcuL2RlYm91bmNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW1pdHRlciAodGhpbmcsIG9wdGlvbnMpIHtcbiAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZXZ0ID0ge307XG4gIGlmICh0aGluZyA9PT0gdW5kZWZpbmVkKSB7IHRoaW5nID0ge307IH1cbiAgdGhpbmcub24gPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICBpZiAoIWV2dFt0eXBlXSkge1xuICAgICAgZXZ0W3R5cGVdID0gW2ZuXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXZ0W3R5cGVdLnB1c2goZm4pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9uY2UgPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICBmbi5fb25jZSA9IHRydWU7IC8vIHRoaW5nLm9mZihmbikgc3RpbGwgd29ya3MhXG4gICAgdGhpbmcub24odHlwZSwgZm4pO1xuICAgIHJldHVybiB0aGluZztcbiAgfTtcbiAgdGhpbmcub2ZmID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChjID09PSAxKSB7XG4gICAgICBkZWxldGUgZXZ0W3R5cGVdO1xuICAgIH0gZWxzZSBpZiAoYyA9PT0gMCkge1xuICAgICAgZXZ0ID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBldCA9IGV2dFt0eXBlXTtcbiAgICAgIGlmICghZXQpIHsgcmV0dXJuIHRoaW5nOyB9XG4gICAgICBldC5zcGxpY2UoZXQuaW5kZXhPZihmbiksIDEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLmVtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHRoaW5nLmVtaXR0ZXJTbmFwc2hvdChhcmdzLnNoaWZ0KCkpLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9O1xuICB0aGluZy5lbWl0dGVyU25hcHNob3QgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgIHZhciBldCA9IChldnRbdHlwZV0gfHwgW10pLnNsaWNlKDApO1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgYXJncyA9IGF0b2EoYXJndW1lbnRzKTtcbiAgICAgIHZhciBjdHggPSB0aGlzIHx8IHRoaW5nO1xuICAgICAgaWYgKHR5cGUgPT09ICdlcnJvcicgJiYgb3B0cy50aHJvd3MgIT09IGZhbHNlICYmICFldC5sZW5ndGgpIHsgdGhyb3cgYXJncy5sZW5ndGggPT09IDEgPyBhcmdzWzBdIDogYXJnczsgfVxuICAgICAgZXQuZm9yRWFjaChmdW5jdGlvbiBlbWl0dGVyIChsaXN0ZW4pIHtcbiAgICAgICAgaWYgKG9wdHMuYXN5bmMpIHsgZGVib3VuY2UobGlzdGVuLCBhcmdzLCBjdHgpOyB9IGVsc2UgeyBsaXN0ZW4uYXBwbHkoY3R4LCBhcmdzKTsgfVxuICAgICAgICBpZiAobGlzdGVuLl9vbmNlKSB7IHRoaW5nLm9mZih0eXBlLCBsaXN0ZW4pOyB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGluZztcbiAgICB9O1xuICB9O1xuICByZXR1cm4gdGhpbmc7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuIiwidmFyIHNpID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJywgdGljaztcbmlmIChzaSkge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldEltbWVkaWF0ZShmbik7IH07XG59IGVsc2Uge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRpY2s7IiwiXG52YXIgTmF0aXZlQ3VzdG9tRXZlbnQgPSBnbG9iYWwuQ3VzdG9tRXZlbnQ7XG5cbmZ1bmN0aW9uIHVzZU5hdGl2ZSAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHAgPSBuZXcgTmF0aXZlQ3VzdG9tRXZlbnQoJ2NhdCcsIHsgZGV0YWlsOiB7IGZvbzogJ2JhcicgfSB9KTtcbiAgICByZXR1cm4gICdjYXQnID09PSBwLnR5cGUgJiYgJ2JhcicgPT09IHAuZGV0YWlsLmZvbztcbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcm9zcy1icm93c2VyIGBDdXN0b21FdmVudGAgY29uc3RydWN0b3IuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0N1c3RvbUV2ZW50LkN1c3RvbUV2ZW50XG4gKlxuICogQHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdXNlTmF0aXZlKCkgPyBOYXRpdmVDdXN0b21FdmVudCA6XG5cbi8vIElFID49IDlcbidmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA/IGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCk7XG4gIH0gZWxzZSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgZmFsc2UsIGZhbHNlLCB2b2lkIDApO1xuICB9XG4gIHJldHVybiBlO1xufSA6XG5cbi8vIElFIDw9IDhcbmZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICBlLnR5cGUgPSB0eXBlO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5idWJibGVzID0gQm9vbGVhbihwYXJhbXMuYnViYmxlcyk7XG4gICAgZS5jYW5jZWxhYmxlID0gQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSk7XG4gICAgZS5kZXRhaWwgPSBwYXJhbXMuZGV0YWlsO1xuICB9IGVsc2Uge1xuICAgIGUuYnViYmxlcyA9IGZhbHNlO1xuICAgIGUuY2FuY2VsYWJsZSA9IGZhbHNlO1xuICAgIGUuZGV0YWlsID0gdm9pZCAwO1xuICB9XG4gIHJldHVybiBlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3VzdG9tRXZlbnQgPSByZXF1aXJlKCdjdXN0b20tZXZlbnQnKTtcbnZhciBldmVudG1hcCA9IHJlcXVpcmUoJy4vZXZlbnRtYXAnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYWRkRXZlbnQgPSBhZGRFdmVudEVhc3k7XG52YXIgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEVhc3k7XG52YXIgaGFyZENhY2hlID0gW107XG5cbmlmICghZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgYWRkRXZlbnQgPSBhZGRFdmVudEhhcmQ7XG4gIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRIYXJkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRFdmVudCxcbiAgcmVtb3ZlOiByZW1vdmVFdmVudCxcbiAgZmFicmljYXRlOiBmYWJyaWNhdGVFdmVudFxufTtcblxuZnVuY3Rpb24gYWRkRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCB3cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgbGlzdGVuZXIgPSB1bndyYXAoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIGVsLmRldGFjaEV2ZW50KCdvbicgKyB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmFicmljYXRlRXZlbnQgKGVsLCB0eXBlLCBtb2RlbCkge1xuICB2YXIgZSA9IGV2ZW50bWFwLmluZGV4T2YodHlwZSkgPT09IC0xID8gbWFrZUN1c3RvbUV2ZW50KCkgOiBtYWtlQ2xhc3NpY0V2ZW50KCk7XG4gIGlmIChlbC5kaXNwYXRjaEV2ZW50KSB7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5maXJlRXZlbnQoJ29uJyArIHR5cGUsIGUpO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDbGFzc2ljRXZlbnQgKCkge1xuICAgIHZhciBlO1xuICAgIGlmIChkb2MuY3JlYXRlRXZlbnQpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG4gICAgICBlLmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGRvYy5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gZTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ3VzdG9tRXZlbnQgKCkge1xuICAgIHJldHVybiBuZXcgY3VzdG9tRXZlbnQodHlwZSwgeyBkZXRhaWw6IG1vZGVsIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBwZXJGYWN0b3J5IChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZXIgKG9yaWdpbmFsRXZlbnQpIHtcbiAgICB2YXIgZSA9IG9yaWdpbmFsRXZlbnQgfHwgZ2xvYmFsLmV2ZW50O1xuICAgIGUudGFyZ2V0ID0gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50O1xuICAgIGUucHJldmVudERlZmF1bHQgPSBlLnByZXZlbnREZWZhdWx0IHx8IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0ICgpIHsgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlOyB9O1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uID0gZS5zdG9wUHJvcGFnYXRpb24gfHwgZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uICgpIHsgZS5jYW5jZWxCdWJibGUgPSB0cnVlOyB9O1xuICAgIGUud2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBmbi5jYWxsKGVsLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciB3cmFwcGVyID0gdW53cmFwKGVsLCB0eXBlLCBmbikgfHwgd3JhcHBlckZhY3RvcnkoZWwsIHR5cGUsIGZuKTtcbiAgaGFyZENhY2hlLnB1c2goe1xuICAgIHdyYXBwZXI6IHdyYXBwZXIsXG4gICAgZWxlbWVudDogZWwsXG4gICAgdHlwZTogdHlwZSxcbiAgICBmbjogZm5cbiAgfSk7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiB1bndyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSA9IGZpbmQoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGkpIHtcbiAgICB2YXIgd3JhcHBlciA9IGhhcmRDYWNoZVtpXS53cmFwcGVyO1xuICAgIGhhcmRDYWNoZS5zcGxpY2UoaSwgMSk7IC8vIGZyZWUgdXAgYSB0YWQgb2YgbWVtb3J5XG4gICAgcmV0dXJuIHdyYXBwZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpLCBpdGVtO1xuICBmb3IgKGkgPSAwOyBpIDwgaGFyZENhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaXRlbSA9IGhhcmRDYWNoZVtpXTtcbiAgICBpZiAoaXRlbS5lbGVtZW50ID09PSBlbCAmJiBpdGVtLnR5cGUgPT09IHR5cGUgJiYgaXRlbS5mbiA9PT0gZm4pIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXZlbnRtYXAgPSBbXTtcbnZhciBldmVudG5hbWUgPSAnJztcbnZhciByb24gPSAvXm9uLztcblxuZm9yIChldmVudG5hbWUgaW4gZ2xvYmFsKSB7XG4gIGlmIChyb24udGVzdChldmVudG5hbWUpKSB7XG4gICAgZXZlbnRtYXAucHVzaChldmVudG5hbWUuc2xpY2UoMikpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRtYXA7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZ1enp5c2VhcmNoIChuZWVkbGUsIGhheXN0YWNrKSB7XG4gIHZhciB0bGVuID0gaGF5c3RhY2subGVuZ3RoO1xuICB2YXIgcWxlbiA9IG5lZWRsZS5sZW5ndGg7XG4gIGlmIChxbGVuID4gdGxlbikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAocWxlbiA9PT0gdGxlbikge1xuICAgIHJldHVybiBuZWVkbGUgPT09IGhheXN0YWNrO1xuICB9XG4gIG91dGVyOiBmb3IgKHZhciBpID0gMCwgaiA9IDA7IGkgPCBxbGVuOyBpKyspIHtcbiAgICB2YXIgbmNoID0gbmVlZGxlLmNoYXJDb2RlQXQoaSk7XG4gICAgd2hpbGUgKGogPCB0bGVuKSB7XG4gICAgICBpZiAoaGF5c3RhY2suY2hhckNvZGVBdChqKyspID09PSBuY2gpIHtcbiAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdXp6eXNlYXJjaDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gcGFkIChoYXNoLCBsZW4pIHtcbiAgd2hpbGUgKGhhc2gubGVuZ3RoIDwgbGVuKSB7XG4gICAgaGFzaCA9ICcwJyArIGhhc2g7XG4gIH1cbiAgcmV0dXJuIGhhc2g7XG59XG5cbmZ1bmN0aW9uIGZvbGQgKGhhc2gsIHRleHQpIHtcbiAgdmFyIGk7XG4gIHZhciBjaHI7XG4gIHZhciBsZW47XG4gIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBoYXNoO1xuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IHRleHQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjaHIgPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XG4gICAgaGFzaCA9ICgoaGFzaCA8PCA1KSAtIGhhc2gpICsgY2hyO1xuICAgIGhhc2ggfD0gMDtcbiAgfVxuICByZXR1cm4gaGFzaCA8IDAgPyBoYXNoICogLTIgOiBoYXNoO1xufVxuXG5mdW5jdGlvbiBmb2xkT2JqZWN0IChoYXNoLCBvLCBzZWVuKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvKS5zb3J0KCkucmVkdWNlKGZvbGRLZXksIGhhc2gpO1xuICBmdW5jdGlvbiBmb2xkS2V5IChoYXNoLCBrZXkpIHtcbiAgICByZXR1cm4gZm9sZFZhbHVlKGhhc2gsIG9ba2V5XSwga2V5LCBzZWVuKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb2xkVmFsdWUgKGlucHV0LCB2YWx1ZSwga2V5LCBzZWVuKSB7XG4gIHZhciBoYXNoID0gZm9sZChmb2xkKGZvbGQoaW5wdXQsIGtleSksIHRvU3RyaW5nKHZhbHVlKSksIHR5cGVvZiB2YWx1ZSk7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBmb2xkKGhhc2gsICdudWxsJyk7XG4gIH1cbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZm9sZChoYXNoLCAndW5kZWZpbmVkJyk7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoc2Vlbi5pbmRleE9mKHZhbHVlKSAhPT0gLTEpIHtcbiAgICAgIHJldHVybiBmb2xkKGhhc2gsICdbQ2lyY3VsYXJdJyArIGtleSk7XG4gICAgfVxuICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG4gICAgcmV0dXJuIGZvbGRPYmplY3QoaGFzaCwgdmFsdWUsIHNlZW4pO1xuICB9XG4gIHJldHVybiBmb2xkKGhhc2gsIHZhbHVlLnRvU3RyaW5nKCkpO1xufVxuXG5mdW5jdGlvbiB0b1N0cmluZyAobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5mdW5jdGlvbiBzdW0gKG8pIHtcbiAgcmV0dXJuIHBhZChmb2xkVmFsdWUoMCwgbywgJycsIFtdKS50b1N0cmluZygxNiksIDgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN1bTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcblxuaWYgKGRvY3VtZW50LnNlbGVjdGlvbiAmJiBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UpIHtcbiAgZ2V0ID0gaGFyZEdldDtcbiAgc2V0ID0gaGFyZFNldDtcbn1cblxuZnVuY3Rpb24gZWFzeUdldCAoZWwpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZWwuc2VsZWN0aW9uU3RhcnQsXG4gICAgZW5kOiBlbC5zZWxlY3Rpb25FbmRcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFyZEdldCAoZWwpIHtcbiAgdmFyIGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGlmIChhY3RpdmUgIT09IGVsKSB7XG4gICAgZWwuZm9jdXMoKTtcbiAgfVxuXG4gIHZhciByYW5nZSA9IGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgYm9va21hcmsgPSByYW5nZS5nZXRCb29rbWFyaygpO1xuICB2YXIgb3JpZ2luYWwgPSBlbC52YWx1ZTtcbiAgdmFyIG1hcmtlciA9IGdldFVuaXF1ZU1hcmtlcihvcmlnaW5hbCk7XG4gIHZhciBwYXJlbnQgPSByYW5nZS5wYXJlbnRFbGVtZW50KCk7XG4gIGlmIChwYXJlbnQgPT09IG51bGwgfHwgIWlucHV0cyhwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdCgwLCAwKTtcbiAgfVxuICByYW5nZS50ZXh0ID0gbWFya2VyICsgcmFuZ2UudGV4dCArIG1hcmtlcjtcblxuICB2YXIgY29udGVudHMgPSBlbC52YWx1ZTtcblxuICBlbC52YWx1ZSA9IG9yaWdpbmFsO1xuICByYW5nZS5tb3ZlVG9Cb29rbWFyayhib29rbWFyayk7XG4gIHJhbmdlLnNlbGVjdCgpO1xuXG4gIHJldHVybiByZXN1bHQoY29udGVudHMuaW5kZXhPZihtYXJrZXIpLCBjb250ZW50cy5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aCk7XG5cbiAgZnVuY3Rpb24gcmVzdWx0IChzdGFydCwgZW5kKSB7XG4gICAgaWYgKGFjdGl2ZSAhPT0gZWwpIHsgLy8gZG9uJ3QgZGlzcnVwdCBwcmUtZXhpc3Rpbmcgc3RhdGVcbiAgICAgIGlmIChhY3RpdmUpIHtcbiAgICAgICAgYWN0aXZlLmZvY3VzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5ibHVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXJ0OiBzdGFydCwgZW5kOiBlbmQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRVbmlxdWVNYXJrZXIgKGNvbnRlbnRzKSB7XG4gIHZhciBtYXJrZXI7XG4gIGRvIHtcbiAgICBtYXJrZXIgPSAnQEBtYXJrZXIuJyArIE1hdGgucmFuZG9tKCkgKiBuZXcgRGF0ZSgpO1xuICB9IHdoaWxlIChjb250ZW50cy5pbmRleE9mKG1hcmtlcikgIT09IC0xKTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gaW5wdXRzIChlbCkge1xuICByZXR1cm4gKChlbC50YWdOYW1lID09PSAnSU5QVVQnICYmIGVsLnR5cGUgPT09ICd0ZXh0JykgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyk7XG59XG5cbmZ1bmN0aW9uIGVhc3lTZXQgKGVsLCBwKSB7XG4gIGVsLnNlbGVjdGlvblN0YXJ0ID0gcGFyc2UoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBwYXJzZShlbCwgcC5lbmQpO1xufVxuXG5mdW5jdGlvbiBoYXJkU2V0IChlbCwgcCkge1xuICB2YXIgcmFuZ2UgPSBlbC5jcmVhdGVUZXh0UmFuZ2UoKTtcblxuICBpZiAocC5zdGFydCA9PT0gJ2VuZCcgJiYgcC5lbmQgPT09ICdlbmQnKSB7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlLmNvbGxhcHNlKHRydWUpO1xuICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLmVuZCkpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcGFyc2UoZWwsIHAuc3RhcnQpKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZSAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxsIChlbCwgcCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHNldChlbCwgcCk7XG4gIH1cbiAgcmV0dXJuIGdldChlbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNlbGwgPSByZXF1aXJlKCdzZWxsJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgYnVsbHNleWUgPSByZXF1aXJlKCdidWxsc2V5ZScpO1xudmFyIGZ1enp5c2VhcmNoID0gcmVxdWlyZSgnZnV6enlzZWFyY2gnKTtcbnZhciBLRVlfQkFDS1NQQUNFID0gODtcbnZhciBLRVlfRU5URVIgPSAxMztcbnZhciBLRVlfRVNDID0gMjc7XG52YXIgS0VZX1VQID0gMzg7XG52YXIgS0VZX0RPV04gPSA0MDtcbnZhciBLRVlfVEFCID0gOTtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBkb2NFbGVtZW50ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuZnVuY3Rpb24gYXV0b2NvbXBsZXRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBwYXJlbnQgPSBvLmFwcGVuZFRvIHx8IGRvYy5ib2R5O1xuICB2YXIgcmVuZGVyID0gby5yZW5kZXIgfHwgZGVmYXVsdFJlbmRlcmVyO1xuICB2YXIge2dldFRleHQsIGdldFZhbHVlLCBmb3JtLCBzdWdnZXN0aW9uc30gPSBvO1xuICB2YXIgbGltaXQgPSB0eXBlb2Ygby5saW1pdCA9PT0gJ251bWJlcicgPyBvLmxpbWl0IDogSW5maW5pdHk7XG4gIHZhciB1c2VyRmlsdGVyID0gby5maWx0ZXIgfHwgZGVmYXVsdEZpbHRlcjtcbiAgdmFyIHVzZXJTZXQgPSBvLnNldCB8fCBkZWZhdWx0U2V0dGVyO1xuICB2YXIgdWwgPSB0YWcoJ3VsJywgJ3RhYy1saXN0Jyk7XG4gIHZhciBzZWxlY3Rpb24gPSBudWxsO1xuICB2YXIgZXllO1xuICB2YXIgZGVmZXJyZWRGaWx0ZXJpbmcgPSBkZWZlcihmaWx0ZXJpbmcpO1xuICB2YXIgYXR0YWNobWVudCA9IGVsO1xuICB2YXIgdGV4dElucHV0O1xuICB2YXIgYW55SW5wdXQ7XG4gIHZhciByYW5jaG9ybGVmdDtcbiAgdmFyIHJhbmNob3JyaWdodDtcbiAgdmFyIHN0YXRlID0geyBjb3VudGVyOiAwLCB2YWx1ZTogbnVsbCB9O1xuXG4gIGlmIChvLmF1dG9IaWRlT25CbHVyID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQmx1ciA9IHRydWU7IH1cbiAgaWYgKG8uYXV0b0hpZGVPbkNsaWNrID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQ2xpY2sgPSB0cnVlOyB9XG4gIGlmIChvLmF1dG9TaG93T25VcERvd24gPT09IHZvaWQgMCkgeyBvLmF1dG9TaG93T25VcERvd24gPSBlbC50YWdOYW1lID09PSAnSU5QVVQnOyB9XG4gIGlmIChvLmFuY2hvcikge1xuICAgIHJhbmNob3JsZWZ0ID0gbmV3IFJlZ0V4cCgnXicgKyBvLmFuY2hvcik7XG4gICAgcmFuY2hvcnJpZ2h0ID0gbmV3IFJlZ0V4cChvLmFuY2hvciArICckJyk7XG4gIH1cblxuICB2YXIgYXBpID0ge1xuICAgIGFkZCxcbiAgICBhbmNob3I6IG8uYW5jaG9yLFxuICAgIGNsZWFyLFxuICAgIHNob3csXG4gICAgaGlkZSxcbiAgICB0b2dnbGUsXG4gICAgZGVzdHJveSxcbiAgICByZWZyZXNoUG9zaXRpb24sXG4gICAgYXBwZW5kVGV4dCxcbiAgICBhcHBlbmRIVE1MLFxuICAgIGZpbHRlckFuY2hvcmVkVGV4dCxcbiAgICBmaWx0ZXJBbmNob3JlZEhUTUwsXG4gICAgZGVmYXVsdEFwcGVuZFRleHQ6IGFwcGVuZFRleHQsXG4gICAgZGVmYXVsdEZpbHRlcixcbiAgICBkZWZhdWx0UmVuZGVyZXIsXG4gICAgZGVmYXVsdFNldHRlcixcbiAgICByZXRhcmdldCxcbiAgICBhdHRhY2htZW50LFxuICAgIGxpc3Q6IHVsLFxuICAgIHN1Z2dlc3Rpb25zOiBbXVxuICB9O1xuXG4gIHJldGFyZ2V0KGVsKTtcbiAgcGFyZW50LmFwcGVuZENoaWxkKHVsKTtcbiAgZWwuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoc3VnZ2VzdGlvbnMpKSB7XG4gICAgbG9hZGVkKHN1Z2dlc3Rpb25zLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4gYXBpO1xuXG4gIGZ1bmN0aW9uIHJldGFyZ2V0IChlbCkge1xuICAgIGlucHV0RXZlbnRzKHRydWUpO1xuICAgIGF0dGFjaG1lbnQgPSBhcGkuYXR0YWNobWVudCA9IGVsO1xuICAgIHRleHRJbnB1dCA9IGF0dGFjaG1lbnQudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBhdHRhY2htZW50LnRhZ05hbWUgPT09ICdURVhUQVJFQSc7XG4gICAgYW55SW5wdXQgPSB0ZXh0SW5wdXQgfHwgaXNFZGl0YWJsZShhdHRhY2htZW50KTtcbiAgICBpbnB1dEV2ZW50cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaFBvc2l0aW9uICgpIHtcbiAgICBpZiAoZXllKSB7IGV5ZS5yZWZyZXNoKCk7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGxvYWRpbmcgKGZvcmNlU2hvdykge1xuICAgIGlmICh0eXBlb2Ygc3VnZ2VzdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNyb3NzdmVudC5yZW1vdmUoYXR0YWNobWVudCwgJ2ZvY3VzJywgbG9hZGluZyk7XG4gICAgICB2YXIgdmFsdWUgPSByZWFkSW5wdXQoKTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gc3RhdGUudmFsdWUpIHtcbiAgICAgICAgc3RhdGUuY291bnRlcisrO1xuICAgICAgICBzdGF0ZS52YWx1ZSA9IHZhbHVlO1xuXG4gICAgICAgIHZhciBjb3VudGVyID0gc3RhdGUuY291bnRlcjtcbiAgICAgICAgc3VnZ2VzdGlvbnModmFsdWUsIGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgaWYgKHN0YXRlLmNvdW50ZXIgPT09IGNvdW50ZXIpIHtcbiAgICAgICAgICAgIGxvYWRlZChzLCBmb3JjZVNob3cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGVkIChzdWdnZXN0aW9ucywgZm9yY2VTaG93KSB7XG4gICAgY2xlYXIoKTtcbiAgICBzdWdnZXN0aW9ucy5mb3JFYWNoKGFkZCk7XG4gICAgYXBpLnN1Z2dlc3Rpb25zID0gc3VnZ2VzdGlvbnM7XG4gICAgaWYgKGZvcmNlU2hvdykge1xuICAgICAgc2hvdygpO1xuICAgIH1cbiAgICBmaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgICB1bnNlbGVjdCgpO1xuICAgIHdoaWxlICh1bC5sYXN0Q2hpbGQpIHtcbiAgICAgIHVsLnJlbW92ZUNoaWxkKHVsLmxhc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZElucHV0ICgpIHtcbiAgICByZXR1cm4gdGV4dElucHV0ID8gZWwudmFsdWUgOiBlbC5pbm5lckhUTUw7XG4gIH1cblxuICBmdW5jdGlvbiBhZGQgKHN1Z2dlc3Rpb24pIHtcbiAgICB2YXIgbGkgPSB0YWcoJ2xpJywgJ3RhYy1pdGVtJyk7XG4gICAgcmVuZGVyKGxpLCBzdWdnZXN0aW9uKTtcbiAgICBicmVha3VwRm9ySGlnaGxpZ2h0ZXIobGkpO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdjbGljaycsIGNsaWNrZWRTdWdnZXN0aW9uKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGxpLCAnYXV0b2NvbXBsZXRlLWZpbHRlcicsIGZpbHRlckl0ZW0pO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdhdXRvY29tcGxldGUtaGlkZScsIGhpZGVJdGVtKTtcbiAgICB1bC5hcHBlbmRDaGlsZChsaSk7XG4gICAgYXBpLnN1Z2dlc3Rpb25zLnB1c2goc3VnZ2VzdGlvbik7XG4gICAgcmV0dXJuIGxpO1xuXG4gICAgZnVuY3Rpb24gY2xpY2tlZFN1Z2dlc3Rpb24gKCkge1xuICAgICAgdmFyIGlucHV0ID0gZ2V0VGV4dChzdWdnZXN0aW9uKTtcbiAgICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pO1xuICAgICAgc2V0KHZhbHVlKTtcbiAgICAgIGhpZGUoKTtcbiAgICAgIGF0dGFjaG1lbnQuZm9jdXMoKTtcbiAgICAgIHZhciBwcmVmaXggPSBvLnByZWZpeCAmJiBvLnByZWZpeChpbnB1dCk7XG4gICAgICBpZiAocHJlZml4KSB7XG4gICAgICAgIGVsLnZhbHVlID0gcHJlZml4O1xuICAgICAgICBlbC5zZWxlY3QoKTtcbiAgICAgICAgc2hvdygpO1xuICAgICAgICBmaWx0ZXJpbmcoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXJJdGVtICgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHJlYWRJbnB1dCgpO1xuICAgICAgaWYgKGZpbHRlcih2YWx1ZSwgc3VnZ2VzdGlvbikpIHtcbiAgICAgICAgbGkuY2xhc3NOYW1lID0gbGkuY2xhc3NOYW1lLnJlcGxhY2UoLyB0YWMtaGlkZS9nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGxpLCAnYXV0b2NvbXBsZXRlLWhpZGUnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoaWRlSXRlbSAoKSB7XG4gICAgICBpZiAoIWhpZGRlbihsaSkpIHtcbiAgICAgICAgbGkuY2xhc3NOYW1lICs9ICcgdGFjLWhpZGUnO1xuICAgICAgICBpZiAoc2VsZWN0aW9uID09PSBsaSkge1xuICAgICAgICAgIHVuc2VsZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBicmVha3VwRm9ySGlnaGxpZ2h0ZXIgKGVsKSB7XG4gICAgZ2V0VGV4dENoaWxkcmVuKGVsKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgIHZhciBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgICAgdmFyIHRleHQgPSBlbC50ZXh0Q29udGVudCB8fCBlbC5ub2RlVmFsdWUgfHwgJyc7XG4gICAgICBpZiAodGV4dC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yIChsZXQgY2hhciBvZiB0ZXh0KSB7XG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoc3BhbkZvcihjaGFyKSwgZWwpO1xuICAgICAgfVxuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgIGZ1bmN0aW9uIHNwYW5Gb3IgKGNoYXIpIHtcbiAgICAgICAgdmFyIHNwYW4gPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBzcGFuLmNsYXNzTmFtZSA9ICd0YWMtY2hhcic7XG4gICAgICAgIHNwYW4udGV4dENvbnRlbnQgPSBzcGFuLmlubmVyVGV4dCA9IGNoYXI7XG4gICAgICAgIHJldHVybiBzcGFuO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gaGlnaGxpZ2h0IChlbCwgbmVlZGxlKSB7XG4gICAgdmFyIGNoYXJzID0gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YWMtY2hhcicpXTtcblxuICAgIGZvciAobGV0IGlucHV0IG9mIG5lZWRsZSkge1xuICAgICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgICBsZXQgY2hhciA9IGNoYXJzLnNoaWZ0KCk7XG4gICAgICAgIGxldCBjaGFyVGV4dCA9IGNoYXIuaW5uZXJUZXh0IHx8IGNoYXIudGV4dENvbnRlbnQ7XG4gICAgICAgIGlmIChjaGFyVGV4dCA9PT0gaW5wdXQpIHtcbiAgICAgICAgICBvbihjaGFyKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmYoY2hhcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgb2ZmKGNoYXJzLnNoaWZ0KCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uIChjaCkge1xuICAgICAgY2guY2xhc3NMaXN0LmFkZCgndGFjLWNoYXItaGlnaGxpZ2h0Jyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG9mZiAoY2gpIHtcbiAgICAgIGNoLmNsYXNzTGlzdC5yZW1vdmUoJ3RhYy1jaGFyLWhpZ2hsaWdodCcpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFRleHRDaGlsZHJlbiAoZWwpIHtcbiAgICB2YXIgdGV4dHMgPSBbXTtcbiAgICB2YXIgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihlbCwgTm9kZUZpbHRlci5TSE9XX1RFWFQsIG51bGwsIGZhbHNlKTtcbiAgICB2YXIgbm9kZTtcbiAgICB3aGlsZSAobm9kZSA9IHdhbGtlci5uZXh0Tm9kZSgpKSB7XG4gICAgICB0ZXh0cy5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dHM7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHZhbHVlKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICByZXR1cm4gKGlzVGV4dCgpID8gYXBpLmFwcGVuZFRleHQgOiBhcGkuYXBwZW5kSFRNTCkodmFsdWUpO1xuICAgIH1cbiAgICB1c2VyU2V0KHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlciAodmFsdWUsIHN1Z2dlc3Rpb24pIHtcbiAgICBpZiAoby5hbmNob3IpIHtcbiAgICAgIHZhciBpbCA9IChpc1RleHQoKSA/IGFwaS5maWx0ZXJBbmNob3JlZFRleHQgOiBhcGkuZmlsdGVyQW5jaG9yZWRIVE1MKSh2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gICAgICByZXR1cm4gaWwgPyB1c2VyRmlsdGVyKGlsLmlucHV0LCBpbC5zdWdnZXN0aW9uKSA6IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdXNlckZpbHRlcih2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpc1RleHQgKCkgeyByZXR1cm4gaXNJbnB1dChhdHRhY2htZW50KTsgfVxuICBmdW5jdGlvbiB2aXNpYmxlICgpIHsgcmV0dXJuIHVsLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtc2hvdycpICE9PSAtMTsgfVxuICBmdW5jdGlvbiBoaWRkZW4gKGxpKSB7IHJldHVybiBsaS5jbGFzc05hbWUuaW5kZXhPZigndGFjLWhpZGUnKSAhPT0gLTE7IH1cblxuICBmdW5jdGlvbiBzaG93ICgpIHtcbiAgICBpZiAoIXZpc2libGUoKSkge1xuICAgICAgdWwuY2xhc3NOYW1lICs9ICcgdGFjLXNob3cnO1xuICAgICAgZXllLnJlZnJlc2goKTtcbiAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1zaG93Jyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlciAoZSkge1xuICAgIHZhciBsZWZ0ID0gZS53aGljaCA9PT0gMSAmJiAhZS5tZXRhS2V5ICYmICFlLmN0cmxLZXk7XG4gICAgaWYgKGxlZnQgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm47IC8vIHdlIG9ubHkgY2FyZSBhYm91dCBob25lc3QgdG8gZ29kIGxlZnQtY2xpY2tzXG4gICAgfVxuICAgIHRvZ2dsZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9nZ2xlICgpIHtcbiAgICBpZiAoIXZpc2libGUoKSkge1xuICAgICAgc2hvdygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoaWRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2VsZWN0IChzdWdnZXN0aW9uKSB7XG4gICAgdW5zZWxlY3QoKTtcbiAgICBpZiAoc3VnZ2VzdGlvbikge1xuICAgICAgc2VsZWN0aW9uID0gc3VnZ2VzdGlvbjtcbiAgICAgIHNlbGVjdGlvbi5jbGFzc05hbWUgKz0gJyB0YWMtc2VsZWN0ZWQnO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVuc2VsZWN0ICgpIHtcbiAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICBzZWxlY3Rpb24uY2xhc3NOYW1lID0gc2VsZWN0aW9uLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLXNlbGVjdGVkL2csICcnKTtcbiAgICAgIHNlbGVjdGlvbiA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbW92ZSAodXAsIG1vdmVzKSB7XG4gICAgdmFyIHRvdGFsID0gdWwuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmICh0b3RhbCA8IG1vdmVzKSB7XG4gICAgICB1bnNlbGVjdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodG90YWwgPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGZpcnN0ID0gdXAgPyAnbGFzdENoaWxkJyA6ICdmaXJzdENoaWxkJztcbiAgICB2YXIgbmV4dCA9IHVwID8gJ3ByZXZpb3VzU2libGluZycgOiAnbmV4dFNpYmxpbmcnO1xuICAgIHZhciBzdWdnZXN0aW9uID0gc2VsZWN0aW9uICYmIHNlbGVjdGlvbltuZXh0XSB8fCB1bFtmaXJzdF07XG5cbiAgICBzZWxlY3Qoc3VnZ2VzdGlvbik7XG5cbiAgICBpZiAoaGlkZGVuKHN1Z2dlc3Rpb24pKSB7XG4gICAgICBtb3ZlKHVwLCBtb3ZlcyA/IG1vdmVzICsgMSA6IDEpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGUgKCkge1xuICAgIGV5ZS5zbGVlcCgpO1xuICAgIHVsLmNsYXNzTmFtZSA9IHVsLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLXNob3cvZywgJycpO1xuICAgIHVuc2VsZWN0KCk7XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLWhpZGUnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGtleWRvd24gKGUpIHtcbiAgICB2YXIgc2hvd24gPSB2aXNpYmxlKCk7XG4gICAgdmFyIHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRE9XTikge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd24pIHtcbiAgICAgICAgbW92ZSgpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9VUCkge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd24pIHtcbiAgICAgICAgbW92ZSh0cnVlKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfQkFDS1NQQUNFKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNob3duKSB7XG4gICAgICBpZiAod2hpY2ggPT09IEtFWV9FTlRFUikge1xuICAgICAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShzZWxlY3Rpb24sICdjbGljaycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhpZGUoKTtcbiAgICAgICAgfVxuICAgICAgICBzdG9wKGUpO1xuICAgICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX0VTQykge1xuICAgICAgICBoaWRlKCk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc3RvcCAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmlsdGVyaW5nICgpIHtcbiAgICBpZiAoIXZpc2libGUoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2FkaW5nKHRydWUpO1xuICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICB2YXIgbGkgPSB1bC5maXJzdENoaWxkO1xuICAgIHZhciB2YWx1ZSA9IHJlYWRJbnB1dCgpLnRyaW0oKTtcbiAgICB2YXIgY291bnQgPSAwO1xuICAgIHdoaWxlIChsaSkge1xuICAgICAgaWYgKGNvdW50ID49IGxpbWl0KSB7XG4gICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUobGksICdhdXRvY29tcGxldGUtaGlkZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICAgICAgaWYgKGxpLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtaGlkZScpID09PSAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgaGlnaGxpZ2h0KGxpLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpID0gbGkubmV4dFNpYmxpbmc7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBtb3ZlKCk7XG4gICAgfVxuICAgIGlmICghc2VsZWN0aW9uKSB7XG4gICAgICBoaWRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmZXJyZWRGaWx0ZXJpbmdOb0VudGVyIChlKSB7XG4gICAgdmFyIHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRU5URVIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGVmZXJyZWRGaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmVycmVkU2hvdyAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFRpbWVvdXQoc2hvdywgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBhdXRvY29tcGxldGVFdmVudFRhcmdldCAoZSkge1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgaWYgKHRhcmdldCA9PT0gdWwgfHwgdGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU9uQmx1ciAoZSkge1xuICAgIHZhciB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX1RBQikge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGVPbkNsaWNrIChlKSB7XG4gICAgaWYgKGF1dG9jb21wbGV0ZUV2ZW50VGFyZ2V0KGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpZGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlucHV0RXZlbnRzIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGlmIChleWUpIHtcbiAgICAgIGV5ZS5kZXN0cm95KCk7XG4gICAgICBleWUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoIXJlbW92ZSkge1xuICAgICAgZXllID0gYnVsbHNleWUodWwsIGF0dGFjaG1lbnQsIHsgY2FyZXQ6IGFueUlucHV0ICYmIGF0dGFjaG1lbnQudGFnTmFtZSAhPT0gJ0lOUFVUJyB9KTtcbiAgICAgIGlmICghdmlzaWJsZSgpKSB7IGV5ZS5zbGVlcCgpOyB9XG4gICAgfVxuICAgIGlmIChyZW1vdmUgfHwgKGFueUlucHV0ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBhdHRhY2htZW50KSkge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZGluZygpO1xuICAgIH1cbiAgICBpZiAoYW55SW5wdXQpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRTaG93KTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRGaWx0ZXJpbmcpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAna2V5ZG93bicsIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdwYXN0ZScsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICAgIGlmIChvLmF1dG9IaWRlT25CbHVyKSB7IGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBoaWRlT25CbHVyKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdjbGljaycsIHRvZ2dsZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2NFbGVtZW50LCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIH1cbiAgICBpZiAoby5hdXRvSGlkZU9uQ2xpY2spIHsgY3Jvc3N2ZW50W29wXShkb2MsICdjbGljaycsIGhpZGVPbkNsaWNrKTsgfVxuICAgIGlmIChmb3JtKSB7IGNyb3NzdmVudFtvcF0oZm9ybSwgJ3N1Ym1pdCcsIGhpZGUpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBpZiAocGFyZW50LmNvbnRhaW5zKHVsKSkgeyBwYXJlbnQucmVtb3ZlQ2hpbGQodWwpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0U2V0dGVyICh2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAobGksIHN1Z2dlc3Rpb24pIHtcbiAgICBsaS5pbm5lclRleHQgPSBsaS50ZXh0Q29udGVudCA9IGdldFRleHQoc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0RmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgdmFyIG5lZWRsZSA9IHEudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgdGV4dCA9IGdldFRleHQoc3VnZ2VzdGlvbikgfHwgJyc7XG4gICAgaWYgKGZ1enp5c2VhcmNoKG5lZWRsZSwgdGV4dC50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKHN1Z2dlc3Rpb24pIHx8ICcnO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBmdXp6eXNlYXJjaChuZWVkbGUsIHZhbHVlLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9vcGJhY2tUb0FuY2hvciAodGV4dCwgcCkge1xuICAgIHZhciByZXN1bHQgPSAnJztcbiAgICB2YXIgYW5jaG9yZWQgPSBmYWxzZTtcbiAgICB2YXIgc3RhcnQgPSBwLnN0YXJ0O1xuICAgIHdoaWxlIChhbmNob3JlZCA9PT0gZmFsc2UgJiYgc3RhcnQgPj0gMCkge1xuICAgICAgcmVzdWx0ID0gdGV4dC5zdWJzdHIoc3RhcnQgLSAxLCBwLnN0YXJ0IC0gc3RhcnQgKyAxKTtcbiAgICAgIGFuY2hvcmVkID0gcmFuY2hvcmxlZnQudGVzdChyZXN1bHQpO1xuICAgICAgc3RhcnQtLTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGFuY2hvcmVkID8gcmVzdWx0IDogbnVsbCxcbiAgICAgIHN0YXJ0OiBzdGFydFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZFRleHQgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICB2YXIgcG9zaXRpb24gPSBzZWxsKGVsKTtcbiAgICB2YXIgaW5wdXQgPSBsb29wYmFja1RvQW5jaG9yKHEsIHBvc2l0aW9uKS50ZXh0O1xuICAgIGlmIChpbnB1dCkge1xuICAgICAgcmV0dXJuIHsgaW5wdXQ6IGlucHV0LCBzdWdnZXN0aW9uOiBzdWdnZXN0aW9uIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwZW5kVGV4dCAodmFsdWUpIHtcbiAgICB2YXIgY3VycmVudCA9IGVsLnZhbHVlO1xuICAgIHZhciBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIHZhciBpbnB1dCA9IGxvb3BiYWNrVG9BbmNob3IoY3VycmVudCwgcG9zaXRpb24pO1xuICAgIHZhciBsZWZ0ID0gY3VycmVudC5zdWJzdHIoMCwgaW5wdXQuc3RhcnQpO1xuICAgIHZhciByaWdodCA9IGN1cnJlbnQuc3Vic3RyKGlucHV0LnN0YXJ0ICsgaW5wdXQudGV4dC5sZW5ndGggKyAocG9zaXRpb24uZW5kIC0gcG9zaXRpb24uc3RhcnQpKTtcbiAgICB2YXIgYmVmb3JlID0gbGVmdCArIHZhbHVlICsgJyAnO1xuXG4gICAgZWwudmFsdWUgPSBiZWZvcmUgKyByaWdodDtcbiAgICBzZWxsKGVsLCB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggfSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRIVE1MICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcmluZyBpbiBlZGl0YWJsZSBlbGVtZW50cyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXQgKGVsKSB7IHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7IH1cblxuZnVuY3Rpb24gdGFnICh0eXBlLCBjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBkZWZlciAoZm4pIHsgcmV0dXJuIGZ1bmN0aW9uICgpIHsgc2V0VGltZW91dChmbiwgMCk7IH07IH1cblxuZnVuY3Rpb24gaXNFZGl0YWJsZSAoZWwpIHtcbiAgdmFyIHZhbHVlID0gZWwuZ2V0QXR0cmlidXRlKCdjb250ZW50RWRpdGFibGUnKTtcbiAgaWYgKHZhbHVlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gJ3RydWUnKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gaXNFZGl0YWJsZShlbC5wYXJlbnRFbGVtZW50KTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXV0b2NvbXBsZXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZG9tID0gcmVxdWlyZSgnLi9kb20nKTtcbnZhciB0ZXh0ID0gcmVxdWlyZSgnLi90ZXh0Jyk7XG52YXIgcHJvcHMgPSBbXG4gICdmb250RmFtaWx5JyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd3b3JkU3BhY2luZycsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3dlYmtpdEJveFNpemluZycsXG4gICdtb3pCb3hTaXppbmcnLFxuICAnYm94U2l6aW5nJyxcbiAgJ3BhZGRpbmcnLFxuICAnYm9yZGVyJ1xuXTtcbnZhciBvZmZzZXQgPSAyMDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmYWN0b3J5IChlbCkge1xuICB2YXIgbWlycm9yID0gZG9tKCdzcGFuJyk7XG5cbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuICByZW1hcCgpO1xuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZW1hcDogcmVtYXAsXG4gICAgcmVmcmVzaDogcmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gcmVtYXAgKCkge1xuICAgIHZhciBjID0gY29tcHV0ZWQoKTtcbiAgICB2YXIgdmFsdWU7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZSA9IGNbcHJvcHNbaV1dO1xuICAgICAgaWYgKHZhbHVlICE9PSB2b2lkIDAgJiYgdmFsdWUgIT09IG51bGwpIHsgLy8gb3RoZXJ3aXNlIElFIGJsb3dzIHVwXG4gICAgICAgIG1pcnJvci5zdHlsZVtwcm9wc1tpXV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgbWlycm9yLmRpc2FibGVkID0gJ2Rpc2FibGVkJztcbiAgICBtaXJyb3Iuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnO1xuICAgIG1pcnJvci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgbWlycm9yLnN0eWxlLnRvcCA9IG1pcnJvci5zdHlsZS5sZWZ0ID0gJy05OTk5ZW0nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgdmFyIHZhbHVlID0gZWwudmFsdWU7XG4gICAgaWYgKHZhbHVlID09PSBtaXJyb3IudmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0ZXh0KG1pcnJvciwgdmFsdWUpO1xuXG4gICAgdmFyIHdpZHRoID0gbWlycm9yLm9mZnNldFdpZHRoICsgb2Zmc2V0O1xuXG4gICAgZWwuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBtaXJyb3IucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChtaXJyb3IpO1xuICAgIGVsLnN0eWxlLndpZHRoID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wdXRlZCAoKSB7XG4gICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgICByZXR1cm4gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIH1cbiAgICByZXR1cm4gZWwuY3VycmVudFN0eWxlO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRvbSAodGFnTmFtZSwgY2xhc3Nlcykge1xuICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICBpZiAoY2xhc3Nlcykge1xuICAgIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXM7XG4gIH1cbiAgcmV0dXJuIGVsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcbnZhciBpbnB1dFRhZyA9IC9pbnB1dC9pO1xudmFyIHRleHRhcmVhVGFnID0gL3RleHRhcmVhL2k7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IHRleHRhcmVhVGFnLnRlc3QoZWwudGFnTmFtZSkpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHNwZWNpYWwoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBzcGVjaWFsKGVsLCBwLmVuZCk7XG59XG5cbmZ1bmN0aW9uIGhhcmRTZXQgKGVsLCBwKSB7XG4gIHZhciByYW5nZSA9IGVsLmNyZWF0ZVRleHRSYW5nZSgpO1xuXG4gIGlmIChwLnN0YXJ0ID09PSAnZW5kJyAmJiBwLmVuZCA9PT0gJ2VuZCcpIHtcbiAgICByYW5nZS5jb2xsYXBzZShmYWxzZSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2UuY29sbGFwc2UodHJ1ZSk7XG4gICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgcC5lbmQpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcC5zdGFydCk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BlY2lhbCAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxlY3Rpb24gKGVsLCBwKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgc2V0KGVsLCBwKTtcbiAgfVxuICByZXR1cm4gZ2V0KGVsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdW0gPSByZXF1aXJlKCdoYXNoLXN1bScpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGVtaXR0ZXIgPSByZXF1aXJlKCdjb250cmEvZW1pdHRlcicpO1xudmFyIGRvbSA9IHJlcXVpcmUoJy4vZG9tJyk7XG52YXIgdGV4dCA9IHJlcXVpcmUoJy4vdGV4dCcpO1xudmFyIHNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vc2VsZWN0aW9uJyk7XG52YXIgYXV0b3NpemUgPSByZXF1aXJlKCcuL2F1dG9zaXplJyk7XG52YXIgYXV0b2NvbXBsZXRlID0gcmVxdWlyZSgnLi9hdXRvY29tcGxldGUnKTtcbnZhciBpbnB1dFRhZyA9IC9eaW5wdXQkL2k7XG52YXIgRUxFTUVOVCA9IDE7XG52YXIgQkFDS1NQQUNFID0gODtcbnZhciBFTkQgPSAzNTtcbnZhciBIT01FID0gMzY7XG52YXIgTEVGVCA9IDM3O1xudmFyIFJJR0hUID0gMzk7XG52YXIgc2lua2FibGVLZXlzID0gW0VORCwgSE9NRV07XG52YXIgdGFnQ2xhc3MgPSAvXFxidGF5LXRhZ1xcYi87XG52YXIgdGFnUmVtb3ZhbENsYXNzID0gL1xcYnRheS10YWctcmVtb3ZlXFxiLztcbnZhciBlZGl0b3JDbGFzcyA9IC9cXGJ0YXktZWRpdG9yXFxiL2c7XG52YXIgaW5wdXRDbGFzcyA9IC9cXGJ0YXktaW5wdXRcXGIvZztcbnZhciBlbmQgPSB7IHN0YXJ0OiAnZW5kJywgZW5kOiAnZW5kJyB9O1xudmFyIGRlZmF1bHREZWxpbWl0ZXIgPSAnICc7XG5cbmZ1bmN0aW9uIHRhZ2d5IChlbCwgb3B0aW9ucykge1xuICB2YXIgY3VycmVudFZhbHVlcyA9IFtdO1xuICB2YXIgX25vc2VsZWN0ID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gZWw7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGRlbGltaXRlciA9IG8uZGVsaW1pdGVyIHx8IGRlZmF1bHREZWxpbWl0ZXI7XG4gIGlmIChkZWxpbWl0ZXIubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWdneSBleHBlY3RlZCBhIHNpbmdsZS1jaGFyYWN0ZXIgZGVsaW1pdGVyIHN0cmluZycpO1xuICB9XG4gIHZhciBhbnkgPSBoYXNTaWJsaW5ncyhlbCk7XG4gIGlmIChhbnkgfHwgIWlucHV0VGFnLnRlc3QoZWwudGFnTmFtZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ2d5IGV4cGVjdGVkIGFuIGlucHV0IGVsZW1lbnQgd2l0aG91dCBhbnkgc2libGluZ3MnKTtcbiAgfVxuICB2YXIgZnJlZSA9IG8uZnJlZSAhPT0gZmFsc2U7XG4gIHZhciB2YWxpZGF0ZSA9IG8udmFsaWRhdGUgfHwgZGVmYXVsdFZhbGlkYXRlO1xuICB2YXIgcmVuZGVyID0gby5yZW5kZXIgfHwgZGVmYXVsdFJlbmRlcmVyO1xuXHR2YXIgY29udmVydE9uRm9jdXMgPSBvLmNvbnZlcnRPbkZvY3VzICE9PSBmYWxzZTtcblxuICB2YXIgdG9JdGVtRGF0YSA9IGRlZmF1bHRUb0l0ZW1EYXRhO1xuXG4gIHZhciBwYXJzZVRleHQgPSBvLnBhcnNlVGV4dDtcbiAgdmFyIHBhcnNlVmFsdWUgPSBvLnBhcnNlVmFsdWU7XG4gIHZhciBnZXRUZXh0ID0gKFxuICAgIHR5cGVvZiBwYXJzZVRleHQgPT09ICdzdHJpbmcnID8gZCA9PiBkW3BhcnNlVGV4dF0gOlxuICAgIHR5cGVvZiBwYXJzZVRleHQgPT09ICdmdW5jdGlvbicgPyBwYXJzZVRleHQgOlxuICAgIGQgPT4gZFxuICApO1xuICB2YXIgZ2V0VmFsdWUgPSAoXG4gICAgdHlwZW9mIHBhcnNlVmFsdWUgPT09ICdzdHJpbmcnID8gZCA9PiBkW3BhcnNlVmFsdWVdIDpcbiAgICB0eXBlb2YgcGFyc2VWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHBhcnNlVmFsdWUgOlxuICAgIGQgPT4gZFxuICApO1xuXG4gIHZhciBiZWZvcmUgPSBkb20oJ3NwYW4nLCAndGF5LXRhZ3MgdGF5LXRhZ3MtYmVmb3JlJyk7XG4gIHZhciBhZnRlciA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1hZnRlcicpO1xuICB2YXIgcGFyZW50ID0gZWwucGFyZW50RWxlbWVudDtcbiAgZWwuY2xhc3NOYW1lICs9ICcgdGF5LWlucHV0JztcbiAgcGFyZW50LmNsYXNzTmFtZSArPSAnIHRheS1lZGl0b3InO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGJlZm9yZSwgZWwpO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFmdGVyLCBlbC5uZXh0U2libGluZyk7XG4gIGJpbmQoKTtcblxuICB2YXIgc2hyaW5rZXIgPSBhdXRvc2l6ZShlbCk7XG4gIHZhciBjb21wbGV0ZXI7XG4gIGlmIChvLmF1dG9jb21wbGV0ZSkge1xuICAgIGNvbXBsZXRlciA9IGNyZWF0ZUF1dG9jb21wbGV0ZSgpO1xuICB9XG5cbiAgdmFyIGFwaSA9IGVtaXR0ZXIoe1xuICAgIGFkZEl0ZW0sXG4gICAgcmVtb3ZlSXRlbTogcmVtb3ZlSXRlbUJ5RGF0YSxcbiAgICByZW1vdmVJdGVtQnlFbGVtZW50LFxuICAgIHZhbHVlOiByZWFkVmFsdWUsXG4gICAgZGVzdHJveVxuICB9KTtcblxuICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gIF9ub3NlbGVjdCA9IGZhbHNlO1xuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gZmluZEl0ZW0gKHZhbHVlLCBwcm9wKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50VmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoY3VycmVudFZhbHVlc1tpXVtwcm9wIHx8ICdkYXRhJ10gPT09IHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjdXJyZW50VmFsdWVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZEl0ZW0gKGRhdGEpIHtcbiAgICB2YXIgaXRlbSA9IHsgZGF0YSwgdmFsaWQ6IHRydWUgfTtcbiAgICB2YXIgZWwgPSByZW5kZXJJdGVtKGl0ZW0pO1xuICAgIGlmICghZWwpIHtcbiAgICAgIHJldHVybiBhcGk7XG4gICAgfVxuICAgIGl0ZW0uZWwgPSBlbDtcbiAgICBjdXJyZW50VmFsdWVzLnB1c2goaXRlbSk7XG4gICAgYXBpLmVtaXQoJ2FkZCcsIGRhdGEsIGVsKTtcbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbSAoaXRlbSkge1xuICAgIGlmIChpdGVtKSB7XG4gICAgICByZW1vdmVJdGVtRWxlbWVudChpdGVtLmVsKTtcbiAgICAgIGN1cnJlbnRWYWx1ZXMuc3BsaWNlKGN1cnJlbnRWYWx1ZXMuaW5kZXhPZihpdGVtKSwgMSk7XG4gICAgICBhcGkuZW1pdCgncmVtb3ZlJywgaXRlbS5kYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW1CeURhdGEgKGRhdGEpIHtcbiAgICByZXR1cm4gcmVtb3ZlSXRlbShmaW5kSXRlbShkYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtQnlFbGVtZW50IChlbCkge1xuICAgIHJldHVybiByZW1vdmVJdGVtKGZpbmRJdGVtKGVsLCAnZWwnKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJJdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRhZyhiZWZvcmUsIGl0ZW0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbUVsZW1lbnQgKGVsKSB7XG4gICAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIGVsLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVRhZyAoYnVmZmVyLCBpdGVtKSB7XG4gICAgdmFyIHtkYXRhfSA9IGl0ZW07XG4gICAgdmFyIGVtcHR5ID0gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnICYmIGRhdGEudHJpbSgpLmxlbmd0aCA9PT0gMDtcbiAgICBpZiAoZW1wdHkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgZWwgPSBkb20oJ3NwYW4nLCAndGF5LXRhZycpO1xuICAgIHJlbmRlcihlbCwgaXRlbSk7XG4gICAgaWYgKG8uZGVsZXRpb24pIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGRvbSgnc3BhbicsICd0YXktdGFnLXJlbW92ZScpKTtcbiAgICB9XG4gICAgYnVmZmVyLmFwcGVuZENoaWxkKGVsKTtcbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VG9JdGVtRGF0YSAocykge1xuICAgIHJldHVybiBzO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFZhbHVlICgpIHtcbiAgICByZXR1cm4gY3VycmVudFZhbHVlcy5maWx0ZXIodiA9PiB2LnZhbGlkKS5tYXAodiA9PiB2LmRhdGEpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQXV0b2NvbXBsZXRlICgpIHtcbiAgICB2YXIgY29uZmlnID0gby5hdXRvY29tcGxldGU7XG4gICAgdmFyIHByZWZpeCA9IGNvbmZpZy5wcmVmaXg7XG4gICAgdmFyIGNhY2hlID0gY29uZmlnLmNhY2hlIHx8IHt9O1xuICAgIHZhciBub1NvdXJjZSA9ICFjb25maWcuc291cmNlO1xuICAgIGlmIChub1NvdXJjZSAmJiAhY29uZmlnLnN1Z2dlc3Rpb25zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciByZXE7XG4gICAgdmFyIGxpbWl0ID0gTnVtYmVyKGNvbmZpZy5saW1pdCkgfHwgSW5maW5pdHk7XG4gICAgdmFyIHN1Z2dlc3Rpb25zID0gbm9Tb3VyY2UgJiYgY29uZmlnLnN1Z2dlc3Rpb25zIHx8IHN1Z2dlc3Q7XG4gICAgdmFyIGNvbXBsZXRlciA9IGF1dG9jb21wbGV0ZShlbCwge1xuICAgICAgc3VnZ2VzdGlvbnMsXG4gICAgICBsaW1pdCxcbiAgICAgIGdldFRleHQsXG4gICAgICBnZXRWYWx1ZSxcbiAgICAgIHByZWZpeCxcbiAgICAgIHNldCAocykge1xuICAgICAgICBlbC52YWx1ZSA9ICcnO1xuICAgICAgICBhZGRJdGVtKHMpO1xuICAgICAgfSxcbiAgICAgIGZpbHRlciAocSwgc3VnZ2VzdGlvbikge1xuICAgICAgICBpZiAoY29uZmlnLmR1cGxpY2F0ZXMgIT09IGZhbHNlICYmIGZpbmRJdGVtKHN1Z2dlc3Rpb24pKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25maWcuZmlsdGVyKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbmZpZy5maWx0ZXIocSwgc3VnZ2VzdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBsZXRlci5kZWZhdWx0RmlsdGVyKHEsIHN1Z2dlc3Rpb24pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjb21wbGV0ZXI7XG4gICAgZnVuY3Rpb24gc3VnZ2VzdCAocSwgZG9uZSkge1xuICAgICAgdmFyIHF1ZXJ5ID0gcS50cmltKCk7XG4gICAgICBpZiAocXVlcnkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGRvbmUoW10pOyByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAocmVxKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVxLmFib3J0KCk7XG4gICAgICAgICAgcmVxID0gbnVsbDtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgaGFzaCA9IHN1bShxdWVyeSk7IC8vIGZhc3QsIGNhc2UgaW5zZW5zaXRpdmUsIHByZXZlbnRzIGNvbGxpc2lvbnNcbiAgICAgIHZhciBlbnRyeSA9IGNhY2hlW2hhc2hdO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIGxldCBzdGFydCA9IGVudHJ5LmNyZWF0ZWQuZ2V0VGltZSgpO1xuICAgICAgICBsZXQgZHVyYXRpb24gPSBjYWNoZS5kdXJhdGlvbiB8fCA2MCAqIDYwICogMjQ7XG4gICAgICAgIGxldCBkaWZmID0gZHVyYXRpb24gKiAxMDAwO1xuICAgICAgICBsZXQgZnJlc2ggPSBuZXcgRGF0ZShzdGFydCArIGRpZmYpID4gbmV3IERhdGUoKTtcbiAgICAgICAgaWYgKGZyZXNoKSB7XG4gICAgICAgICAgZG9uZShlbnRyeS5pdGVtcyk7IHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uZmlnLnNvdXJjZShxdWVyeSlcbiAgICAgICAgLnRoZW4oZGF0YSA9PiB7XG4gICAgICAgICAgdmFyIGl0ZW1zID0gQXJyYXkuaXNBcnJheShkYXRhKSA/IGRhdGEgOiBbXTtcbiAgICAgICAgICBjYWNoZVtoYXNoXSA9IHsgY3JlYXRlZDogbmV3IERhdGUoKSwgaXRlbXMgfTtcbiAgICAgICAgICBkb25lKGl0ZW1zKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0b2NvbXBsZXRlIHNvdXJjZSBwcm9taXNlIHJlamVjdGVkJywgZXJyb3IsIGVsKTtcbiAgICAgICAgICBkb25lKFtdKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlwcmVzcycsIGtleXByZXNzKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCBwYXN0ZSk7XG4gICAgY3Jvc3N2ZW50W29wXShwYXJlbnQsICdjbGljaycsIGNsaWNrKTtcblx0XHRpZiAoY29udmVydE9uRm9jdXMpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCAnZm9jdXMnLCBkb2N1bWVudGZvY3VzLCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICAgIGlmIChjb21wbGV0ZXIpIHsgY29tcGxldGVyLmRlc3Ryb3koKTsgfVxuICAgIGVsLnZhbHVlID0gJyc7XG4gICAgZWwuY2xhc3NOYW1lID0gZWwuY2xhc3NOYW1lLnJlcGxhY2UoaW5wdXRDbGFzcywgJycpO1xuICAgIHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UoZWRpdG9yQ2xhc3MsICcnKTtcbiAgICBpZiAoYmVmb3JlLnBhcmVudEVsZW1lbnQpIHsgYmVmb3JlLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoYmVmb3JlKTsgfVxuICAgIGlmIChhZnRlci5wYXJlbnRFbGVtZW50KSB7IGFmdGVyLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoYWZ0ZXIpOyB9XG4gICAgc2hyaW5rZXIuZGVzdHJveSgpO1xuICAgIGFwaS5kZXN0cm95ZWQgPSB0cnVlO1xuICAgIGFwaS5kZXN0cm95ID0gYXBpLmFkZEl0ZW0gPSBhcGkucmVtb3ZlSXRlbSA9ICgpID0+IGFwaTtcbiAgICBhcGkudGFncyA9IGFwaS52YWx1ZSA9ICgpID0+IG51bGw7XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRvY3VtZW50Zm9jdXMgKGUpIHtcbiAgICBpZiAoZS50YXJnZXQgIT09IGVsKSB7XG4gICAgICBfbm9zZWxlY3QgPSB0cnVlO1xuICAgICAgY29udmVydCh0cnVlKTtcbiAgICAgIF9ub3NlbGVjdCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNsaWNrIChlKSB7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0O1xuICAgIGlmICh0YWdSZW1vdmFsQ2xhc3MudGVzdCh0YXJnZXQuY2xhc3NOYW1lKSkge1xuICAgICAgZm9jdXNUYWcodGFyZ2V0LnBhcmVudEVsZW1lbnQsIHsgc3RhcnQ6ICdlbmQnLCBlbmQ6ICdlbmQnLCByZW1vdmU6IHRydWUgfSk7XG4gICAgICBzaGlmdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdG9wID0gdGFyZ2V0O1xuICAgIHZhciB0YWdnZWQgPSB0YWdDbGFzcy50ZXN0KHRvcC5jbGFzc05hbWUpO1xuICAgIHdoaWxlICh0YWdnZWQgPT09IGZhbHNlICYmIHRvcC5wYXJlbnRFbGVtZW50KSB7XG4gICAgICB0b3AgPSB0b3AucGFyZW50RWxlbWVudDtcbiAgICAgIHRhZ2dlZCA9IHRhZ0NsYXNzLnRlc3QodG9wLmNsYXNzTmFtZSk7XG4gICAgfVxuICAgIGlmICh0YWdnZWQgJiYgZnJlZSkge1xuICAgICAgZm9jdXNUYWcodG9wLCBlbmQpO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ICE9PSBlbCkge1xuICAgICAgc2hpZnQoKTtcbiAgICAgIGVsLmZvY3VzKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2hpZnQgKCkge1xuICAgIGZvY3VzVGFnKGFmdGVyLmxhc3RDaGlsZCwgZW5kKTtcbiAgICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb252ZXJ0IChhbGwpIHtcbiAgICBldmFsdWF0ZShbZGVsaW1pdGVyXSwgYWxsKTtcbiAgICBpZiAoYWxsKSB7XG4gICAgICBlYWNoKGFmdGVyLCBtb3ZlTGVmdCk7XG4gICAgfVxuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlTGVmdCAodmFsdWUsIHRhZykge1xuICAgIGJlZm9yZS5hcHBlbmRDaGlsZCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICAgIHZhciBzZWwgPSBzZWxlY3Rpb24oZWwpO1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIHZhciBjYW5Nb3ZlTGVmdCA9IHNlbC5zdGFydCA9PT0gMCAmJiBzZWwuZW5kID09PSAwICYmIGJlZm9yZS5sYXN0Q2hpbGQ7XG4gICAgdmFyIGNhbk1vdmVSaWdodCA9IHNlbC5zdGFydCA9PT0gZWwudmFsdWUubGVuZ3RoICYmIHNlbC5lbmQgPT09IGVsLnZhbHVlLmxlbmd0aCAmJiBhZnRlci5maXJzdENoaWxkO1xuICAgIGlmIChmcmVlKSB7XG4gICAgICBpZiAoa2V5ID09PSBIT01FKSB7XG4gICAgICAgIGlmIChiZWZvcmUuZmlyc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGJlZm9yZS5maXJzdENoaWxkLCB7fSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZWN0aW9uKGVsLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBFTkQpIHtcbiAgICAgICAgaWYgKGFmdGVyLmxhc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGFmdGVyLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxlY3Rpb24oZWwsIGVuZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBCQUNLU1BBQ0UgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBSSUdIVCAmJiBjYW5Nb3ZlUmlnaHQpIHtcbiAgICAgICAgZm9jdXNUYWcoYWZ0ZXIuZmlyc3RDaGlsZCwge30pO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IExFRlQgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGtleSA9PT0gQkFDS1NQQUNFICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIHJlbW92ZUl0ZW1CeUVsZW1lbnQoYmVmb3JlLmxhc3RDaGlsZCk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gUklHSFQgJiYgY2FuTW92ZVJpZ2h0KSB7XG4gICAgICAgIGJlZm9yZS5hcHBlbmRDaGlsZChhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBMRUZUICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShiZWZvcmUubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoc2lua2FibGVLZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHsgLy8gcHJldmVudCBkZWZhdWx0IG90aGVyd2lzZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoY29tcGxldGVyKSB7IGNvbXBsZXRlci5yZWZyZXNoUG9zaXRpb24oKTsgfVxuICAgIH1cblxuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlwcmVzcyAoZSkge1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIGlmIChTdHJpbmcuZnJvbUNoYXJDb2RlKGtleSkgPT09IGRlbGltaXRlcikge1xuICAgICAgY29udmVydCgpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhc3RlICgpIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IGV2YWx1YXRlKCksIDApO1xuICB9XG5cbiAgZnVuY3Rpb24gZXZhbHVhdGUgKGV4dHJhcywgZW50aXJlbHkpIHtcbiAgICB2YXIgcCA9IHNlbGVjdGlvbihlbCk7XG4gICAgdmFyIGxlbiA9IGVudGlyZWx5ID8gSW5maW5pdHkgOiBwLnN0YXJ0O1xuICAgIHZhciB0YWdzID0gZWwudmFsdWUuc2xpY2UoMCwgbGVuKS5jb25jYXQoZXh0cmFzIHx8IFtdKS5zcGxpdChkZWxpbWl0ZXIpO1xuICAgIGlmICh0YWdzLmxlbmd0aCA8IDEgfHwgIWZyZWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcmVzdCA9IHRhZ3MucG9wKCkgKyBlbC52YWx1ZS5zbGljZShsZW4pO1xuICAgIHZhciByZW1vdmFsID0gdGFncy5qb2luKGRlbGltaXRlcikubGVuZ3RoO1xuXG4gICAgdGFncy5mb3JFYWNoKHRhZyA9PiBhZGRJdGVtKHRvSXRlbURhdGEodGFnKSkpO1xuICAgIGNsZWFudXAoKTtcbiAgICBlbC52YWx1ZSA9IHJlc3Q7XG4gICAgcC5zdGFydCAtPSByZW1vdmFsO1xuICAgIHAuZW5kIC09IHJlbW92YWw7XG4gICAgaWYgKF9ub3NlbGVjdCAhPT0gdHJ1ZSkgeyBzZWxlY3Rpb24oZWwsIHApOyB9XG4gICAgc2hyaW5rZXIucmVmcmVzaCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYW51cCAoKSB7XG4gICAgdmFyIHRhZ3MgPSBbXTtcblxuICAgIGVhY2goYmVmb3JlLCBkZXRlY3QpO1xuICAgIGVhY2goYWZ0ZXIsIGRldGVjdCk7XG5cbiAgICBmdW5jdGlvbiBkZXRlY3QgKHZhbHVlLCB0YWdFbGVtZW50KSB7XG4gICAgICBpZiAodmFsaWRhdGUodmFsdWUsIHRhZ3Muc2xpY2UoKSkpIHtcbiAgICAgICAgdGFncy5wdXNoKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoby5wcmV2ZW50SW52YWxpZCkge1xuICAgICAgICB0YWdFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnRWxlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YWdFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3RheS1pbnZhbGlkJyk7XG4gICAgICAgIGFwaS5lbWl0KCdpbnZhbGlkJywgdmFsdWUsIHRhZ0VsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRSZW5kZXJlciAoY29udGFpbmVyLCBpdGVtKSB7XG4gICAgdGV4dChjb250YWluZXIsIGdldFRleHQoaXRlbS5kYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGFnICh0YWcpIHtcbiAgICByZXR1cm4gdGV4dCh0YWcpO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9jdXNUYWcgKHRhZywgcCkge1xuICAgIGlmICghdGFnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGV2YWx1YXRlKFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgICB2YXIgcGFyZW50ID0gdGFnLnBhcmVudEVsZW1lbnQ7XG4gICAgaWYgKHBhcmVudCA9PT0gYmVmb3JlKSB7XG4gICAgICB3aGlsZSAocGFyZW50Lmxhc3RDaGlsZCAhPT0gdGFnKSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShwYXJlbnQubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKHBhcmVudC5maXJzdENoaWxkICE9PSB0YWcpIHtcbiAgICAgICAgYmVmb3JlLmFwcGVuZENoaWxkKHBhcmVudC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGFnLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnKTtcbiAgICBlbC52YWx1ZSA9IHAucmVtb3ZlID8gJycgOiByZWFkVGFnKHRhZyk7XG4gICAgZWwuZm9jdXMoKTtcbiAgICBzZWxlY3Rpb24oZWwsIHApO1xuICAgIHNocmlua2VyLnJlZnJlc2goKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhc1NpYmxpbmdzICgpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBlbC5wYXJlbnRFbGVtZW50LmNoaWxkcmVuO1xuICAgIHJldHVybiBbLi4uY2hpbGRyZW5dLnNvbWUocyA9PiBzICE9PSBlbCAmJiBzLm5vZGVUeXBlID09PSBFTEVNRU5UKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2ggKGNvbnRhaW5lciwgZm4pIHtcbiAgICBbLi4uY29udGFpbmVyLmNoaWxkcmVuXS5mb3JFYWNoKCh0YWcsIGkpID0+IGZuKHJlYWRUYWcodGFnKSwgdGFnLCBpKSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VmFsaWRhdGUgKHZhbHVlLCB0YWdzKSB7XG4gICAgcmV0dXJuIHRhZ3MuaW5kZXhPZih2YWx1ZSkgPT09IC0xO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGFnZ3k7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRleHQgKGVsLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGVsLmlubmVyVGV4dCA9IGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gIH1cbiAgaWYgKHR5cGVvZiBlbC5pbm5lclRleHQgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGVsLmlubmVyVGV4dDtcbiAgfVxuICByZXR1cm4gZWwudGV4dENvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGV4dDtcbiJdfQ==
