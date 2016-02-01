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
  var lastPrefix = '';

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
    api.suggestions = [];
    suggestions.forEach(add);
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
    _crossvent2.default.add(li, 'mouseenter', hoverSuggestion);
    _crossvent2.default.add(li, 'click', clickedSuggestion);
    _crossvent2.default.add(li, 'autocomplete-filter', filterItem);
    _crossvent2.default.add(li, 'autocomplete-hide', hideItem);
    ul.appendChild(li);
    api.suggestions.push(suggestion);
    return li;

    function hoverSuggestion() {
      select(suggestion);
    }

    function clickedSuggestion() {
      var input = getText(suggestion);
      var value = getValue(suggestion);
      set(value);
      hide();
      attachment.focus();
      lastPrefix = o.prefix && o.prefix(input, api.suggestions.slice()) || '';
      if (lastPrefix) {
        el.value = lastPrefix;
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
    if (el.value === lastPrefix) {
      el.value = '';
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZGVib3VuY2UuanMiLCJub2RlX21vZHVsZXMvY29udHJhL2VtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy9hdG9hL2F0b2EuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9ub2RlX21vZHVsZXMvY3VzdG9tLWV2ZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvY3Jvc3N2ZW50LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvZXZlbnRtYXAuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZWFyY2gvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGFzaC1zdW0vaGFzaC1zdW0uanMiLCJub2RlX21vZHVsZXMvc2VsbC9zZWxsLmpzIiwic3JjL2F1dG9jb21wbGV0ZS5qcyIsInNyYy9hdXRvc2l6ZS5qcyIsInNyYy9kb20uanMiLCJzcmMvc2VsZWN0aW9uLmpzIiwic3JjL3RhZ2d5LmpzIiwic3JjL3RleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0EsWUFBWSxDQUFDOzs7OztrQkFlVyxZQUFZOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBVHBDLElBQU0sYUFBYSxHQUFHLENBQUMsQ0FBQztBQUN4QixJQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFDckIsSUFBTSxPQUFPLEdBQUcsRUFBRSxD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QWEsQ0FBQyxRQUFRLENBQUM7QUFDM0MsV0FBTyw2QkFBSSxRQUFRLEdBQUUsSUFBSSxDQUFDLFVBQUEsQ0FBQzthQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLFFBQVEsS0FBSyxPQUFPO0tBQUEsQ0FBQyxDQUFDO0dBQ3BFOztBQUVELFdBQVMsSUFBSSxDQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7QUFDNUIsaUNBQUksU0FBUyxDQUFDLFFBQVEsR0FBRSxPQUFPLENBQUMsVUFBQyxHQUFHLEVBQUUsQ0FBQzthQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztLQUFBLENBQUMsQ0FBQztHQUN2RTs7QUFFRCxXQUFTLGVBQWUsQ0FBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQ3JDLFdBQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztHQUNuQztDQUNGLENBQUE7OztBQzljRCxZQUFZLENBQUM7Ozs7O2tCQUVXLElBQUk7QUFBYixTQUFTLElBQUksQ0FBRSxFQUFFLEVBQUUsS0FBSyxFQUFFO0FBQ3ZDLE1BQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDMUIsTUFBRSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztHQUN2QztBQUNELE1BQUksT0FBTyxFQUFFLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRTtBQUNwQyxXQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUM7R0FDckI7QUFDRCxTQUFPLEVBQUUsQ0FBQyxXQUFXLENBQUM7Q0FDdkIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgdGhyb3R0bGUgPSByZXF1aXJlKCcuL3Rocm90dGxlJyk7XG52YXIgdGFpbG9ybWFkZSA9IHJlcXVpcmUoJy4vdGFpbG9ybWFkZScpO1xuXG5mdW5jdGlvbiBidWxsc2V5ZSAoZWwsIHRhcmdldCwgb3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnM7XG4gIHZhciBkb21UYXJnZXQgPSB0YXJnZXQgJiYgdGFyZ2V0LnRhZ05hbWU7XG5cbiAgaWYgKCFkb21UYXJnZXQgJiYgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIG8gPSB0YXJnZXQ7XG4gIH1cbiAgaWYgKCFkb21UYXJnZXQpIHtcbiAgICB0YXJnZXQgPSBlbDtcbiAgfVxuICBpZiAoIW8pIHsgbyA9IHt9OyB9XG5cbiAgdmFyIGRlc3Ryb3llZCA9IGZhbHNlO1xuICB2YXIgdGhyb3R0bGVkV3JpdGUgPSB0aHJvdHRsZSh3cml0ZSwgMzApO1xuICB2YXIgdGFpbG9yT3B0aW9ucyA9IHsgdXBkYXRlOiBvLmF1dG91cGRhdGVUb0NhcmV0ICE9PSBmYWxzZSAmJiB1cGRhdGUgfTtcbiAgdmFyIHRhaWxvciA9IG8uY2FyZXQgJiYgdGFpbG9ybWFkZSh0YXJnZXQsIHRhaWxvck9wdGlvbnMpO1xuXG4gIHdyaXRlKCk7XG5cbiAgaWYgKG8udHJhY2tpbmcgIT09IGZhbHNlKSB7XG4gICAgY3Jvc3N2ZW50LmFkZCh3aW5kb3csICdyZXNpemUnLCB0aHJvdHRsZWRXcml0ZSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlYWQ6IHJlYWROdWxsLFxuICAgIHJlZnJlc2g6IHdyaXRlLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgc2xlZXA6IHNsZWVwXG4gIH07XG5cbiAgZnVuY3Rpb24gc2xlZXAgKCkge1xuICAgIHRhaWxvck9wdGlvbnMuc2xlZXBpbmcgPSB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZE51bGwgKCkgeyByZXR1cm4gcmVhZCgpOyB9XG5cbiAgZnVuY3Rpb24gcmVhZCAocmVhZGluZ3MpIHtcbiAgICB2YXIgYm91bmRzID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xuICAgIGlmICh0YWlsb3IpIHtcbiAgICAgIHJlYWRpbmdzID0gdGFpbG9yLnJlYWQoKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IChyZWFkaW5ncy5hYnNvbHV0ZSA/IDAgOiBib3VuZHMubGVmdCkgKyByZWFkaW5ncy54LFxuICAgICAgICB5OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLnRvcCkgKyBzY3JvbGxUb3AgKyByZWFkaW5ncy55ICsgMjBcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB4OiBib3VuZHMubGVmdCxcbiAgICAgIHk6IGJvdW5kcy50b3AgKyBzY3JvbGxUb3BcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlIChyZWFkaW5ncykge1xuICAgIHdyaXRlKHJlYWRpbmdzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChyZWFkaW5ncykge1xuICAgIGlmIChkZXN0cm95ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQnVsbHNleWUgY2FuXFwndCByZWZyZXNoIGFmdGVyIGJlaW5nIGRlc3Ryb3llZC4gQ3JlYXRlIGFub3RoZXIgaW5zdGFuY2UgaW5zdGVhZC4nKTtcbiAgICB9XG4gICAgaWYgKHRhaWxvciAmJiAhcmVhZGluZ3MpIHtcbiAgICAgIHRhaWxvck9wdGlvbnMuc2xlZXBpbmcgPSBmYWxzZTtcbiAgICAgIHRhaWxvci5yZWZyZXNoKCk7IHJldHVybjtcbiAgICB9XG4gICAgdmFyIHAgPSByZWFkKHJlYWRpbmdzKTtcbiAgICBpZiAoIXRhaWxvciAmJiB0YXJnZXQgIT09IGVsKSB7XG4gICAgICBwLnkgKz0gdGFyZ2V0Lm9mZnNldEhlaWdodDtcbiAgICB9XG4gICAgZWwuc3R5bGUubGVmdCA9IHAueCArICdweCc7XG4gICAgZWwuc3R5bGUudG9wID0gcC55ICsgJ3B4JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0YWlsb3IpIHsgdGFpbG9yLmRlc3Ryb3koKTsgfVxuICAgIGNyb3NzdmVudC5yZW1vdmUod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICAgIGRlc3Ryb3llZCA9IHRydWU7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidWxsc2V5ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbjtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgZ2V0U2VsZWN0aW9uUmF3ID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25SYXcnKTtcbnZhciBnZXRTZWxlY3Rpb25OdWxsT3AgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbk51bGxPcCcpO1xudmFyIGdldFNlbGVjdGlvblN5bnRoZXRpYyA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uU3ludGhldGljJyk7XG52YXIgaXNIb3N0ID0gcmVxdWlyZSgnLi9pc0hvc3QnKTtcbmlmIChpc0hvc3QubWV0aG9kKGdsb2JhbCwgJ2dldFNlbGVjdGlvbicpKSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvblJhdztcbn0gZWxzZSBpZiAodHlwZW9mIGRvYy5zZWxlY3Rpb24gPT09ICdvYmplY3QnICYmIGRvYy5zZWxlY3Rpb24pIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uU3ludGhldGljO1xufSBlbHNlIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uTnVsbE9wO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25OdWxsT3AgKCkge1xuICByZXR1cm4ge1xuICAgIHJlbW92ZUFsbFJhbmdlczogbm9vcCxcbiAgICBhZGRSYW5nZTogbm9vcFxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbk51bGxPcDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uUmF3ICgpIHtcbiAgcmV0dXJuIGdsb2JhbC5nZXRTZWxlY3Rpb24oKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25SYXc7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByYW5nZVRvVGV4dFJhbmdlID0gcmVxdWlyZSgnLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcbnZhciBHZXRTZWxlY3Rpb25Qcm90byA9IEdldFNlbGVjdGlvbi5wcm90b3R5cGU7XG5cbmZ1bmN0aW9uIEdldFNlbGVjdGlvbiAoc2VsZWN0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHJhbmdlID0gc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG5cbiAgdGhpcy5fc2VsZWN0aW9uID0gc2VsZWN0aW9uO1xuICB0aGlzLl9yYW5nZXMgPSBbXTtcblxuICBpZiAoc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsZik7XG4gIH0gZWxzZSBpZiAoaXNUZXh0UmFuZ2UocmFuZ2UpKSB7XG4gICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWxmLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsZik7XG4gIH1cbn1cblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlQWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdGV4dFJhbmdlO1xuICB0cnkge1xuICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ05vbmUnKSB7XG4gICAgICB0ZXh0UmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICAgICAgdGV4dFJhbmdlLnNlbGVjdCgpO1xuICAgICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgdXBkYXRlRW1wdHlTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5hZGRSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHJhbmdlKS5zZWxlY3QoKTtcbiAgICB0aGlzLl9yYW5nZXNbMF0gPSByYW5nZTtcbiAgICB0aGlzLnJhbmdlQ291bnQgPSAxO1xuICAgIHRoaXMuaXNDb2xsYXBzZWQgPSB0aGlzLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHRoaXMsIHJhbmdlLCBmYWxzZSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFJhbmdlcyA9IGZ1bmN0aW9uIChyYW5nZXMpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdmFyIHJhbmdlQ291bnQgPSByYW5nZXMubGVuZ3RoO1xuICBpZiAocmFuZ2VDb3VudCA+IDEpIHtcbiAgICBjcmVhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlcyk7XG4gIH0gZWxzZSBpZiAocmFuZ2VDb3VudCkge1xuICAgIHRoaXMuYWRkUmFuZ2UocmFuZ2VzWzBdKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0UmFuZ2VBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMucmFuZ2VDb3VudCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0UmFuZ2VBdCgpOiBpbmRleCBvdXQgb2YgYm91bmRzJyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jhbmdlc1tpbmRleF0uY2xvbmVSYW5nZSgpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdDb250cm9sJykge1xuICAgIHJlbW92ZVJhbmdlTWFudWFsbHkodGhpcywgcmFuZ2UpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgY29udHJvbFJhbmdlID0gdGhpcy5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIHZhciBlbDtcbiAgdmFyIHJlbW92ZWQgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gY29udHJvbFJhbmdlLml0ZW0oaSk7XG4gICAgaWYgKGVsICE9PSByYW5nZUVsZW1lbnQgfHwgcmVtb3ZlZCkge1xuICAgICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5lYWNoUmFuZ2UgPSBmdW5jdGlvbiAoZm4sIHJldHVyblZhbHVlKSB7XG4gIHZhciBpID0gMDtcbiAgdmFyIGxlbiA9IHRoaXMuX3Jhbmdlcy5sZW5ndGg7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChmbih0aGlzLmdldFJhbmdlQXQoaSkpKSB7XG4gICAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gICAgfVxuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciByYW5nZXMgPSBbXTtcbiAgdGhpcy5lYWNoUmFuZ2UoZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICB9KTtcbiAgcmV0dXJuIHJhbmdlcztcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFNpbmdsZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHRoaXMuYWRkUmFuZ2UocmFuZ2UpO1xufTtcblxuZnVuY3Rpb24gY3JlYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZXMpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBlbCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlc1tpXSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnRyb2xSYW5nZS5hZGQoZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2V0UmFuZ2VzKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gICAgfVxuICB9XG4gIGNvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVSYW5nZU1hbnVhbGx5IChzZWwsIHJhbmdlKSB7XG4gIHZhciByYW5nZXMgPSBzZWwuZ2V0QWxsUmFuZ2VzKCk7XG4gIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNTYW1lUmFuZ2UocmFuZ2UsIHJhbmdlc1tpXSkpIHtcbiAgICAgIHNlbC5hZGRSYW5nZShyYW5nZXNbaV0pO1xuICAgIH1cbiAgfVxuICBpZiAoIXNlbC5yYW5nZUNvdW50KSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSAoc2VsLCByYW5nZSkge1xuICB2YXIgYW5jaG9yUHJlZml4ID0gJ3N0YXJ0JztcbiAgdmFyIGZvY3VzUHJlZml4ID0gJ2VuZCc7XG4gIHNlbC5hbmNob3JOb2RlID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ09mZnNldCddO1xuICBzZWwuZm9jdXNOb2RlID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5mb2N1c09mZnNldCA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ09mZnNldCddO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFbXB0eVNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5hbmNob3JOb2RlID0gc2VsLmZvY3VzTm9kZSA9IG51bGw7XG4gIHNlbC5hbmNob3JPZmZzZXQgPSBzZWwuZm9jdXNPZmZzZXQgPSAwO1xuICBzZWwucmFuZ2VDb3VudCA9IDA7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHRydWU7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIHJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50IChyYW5nZU5vZGVzKSB7XG4gIGlmICghcmFuZ2VOb2Rlcy5sZW5ndGggfHwgcmFuZ2VOb2Rlc1swXS5ub2RlVHlwZSAhPT0gMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKHZhciBpID0gMSwgbGVuID0gcmFuZ2VOb2Rlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNBbmNlc3Rvck9mKHJhbmdlTm9kZXNbMF0sIHJhbmdlTm9kZXNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlIChyYW5nZSkge1xuICB2YXIgbm9kZXMgPSByYW5nZS5nZXROb2RlcygpO1xuICBpZiAoIXJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50KG5vZGVzKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSgpOiByYW5nZSBkaWQgbm90IGNvbnNpc3Qgb2YgYSBzaW5nbGUgZWxlbWVudCcpO1xuICB9XG4gIHJldHVybiBub2Rlc1swXTtcbn1cblxuZnVuY3Rpb24gaXNUZXh0UmFuZ2UgKHJhbmdlKSB7XG4gIHJldHVybiByYW5nZSAmJiByYW5nZS50ZXh0ICE9PSB2b2lkIDA7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUZyb21UZXh0UmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgc2VsLl9yYW5nZXMgPSBbcmFuZ2VdO1xuICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHJhbmdlLCBmYWxzZSk7XG4gIHNlbC5yYW5nZUNvdW50ID0gMTtcbiAgc2VsLmlzQ29sbGFwc2VkID0gcmFuZ2UuY29sbGFwc2VkO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDb250cm9sU2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbiAgaWYgKHNlbC5fc2VsZWN0aW9uLnR5cGUgPT09ICdOb25lJykge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gICAgaWYgKGlzVGV4dFJhbmdlKGNvbnRyb2xSYW5nZSkpIHtcbiAgICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsLCBjb250cm9sUmFuZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWwucmFuZ2VDb3VudCA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7XG4gICAgICB2YXIgcmFuZ2U7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbC5yYW5nZUNvdW50OyArK2kpIHtcbiAgICAgICAgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZShjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgICAgIHNlbC5fcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgICAgc2VsLmlzQ29sbGFwc2VkID0gc2VsLnJhbmdlQ291bnQgPT09IDEgJiYgc2VsLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCBzZWwuX3Jhbmdlc1tzZWwucmFuZ2VDb3VudCAtIDFdLCBmYWxzZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gIH1cbiAgdHJ5IHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKHJhbmdlRWxlbWVudCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FkZFJhbmdlKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVJhbmdlIChsZWZ0LCByaWdodCkge1xuICByZXR1cm4gKFxuICAgIGxlZnQuc3RhcnRDb250YWluZXIgPT09IHJpZ2h0LnN0YXJ0Q29udGFpbmVyICYmXG4gICAgbGVmdC5zdGFydE9mZnNldCA9PT0gcmlnaHQuc3RhcnRPZmZzZXQgJiZcbiAgICBsZWZ0LmVuZENvbnRhaW5lciA9PT0gcmlnaHQuZW5kQ29udGFpbmVyICYmXG4gICAgbGVmdC5lbmRPZmZzZXQgPT09IHJpZ2h0LmVuZE9mZnNldFxuICApO1xufVxuXG5mdW5jdGlvbiBpc0FuY2VzdG9yT2YgKGFuY2VzdG9yLCBkZXNjZW5kYW50KSB7XG4gIHZhciBub2RlID0gZGVzY2VuZGFudDtcbiAgd2hpbGUgKG5vZGUucGFyZW50Tm9kZSkge1xuICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IGFuY2VzdG9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgR2V0U2VsZWN0aW9uKGdsb2JhbC5kb2N1bWVudC5zZWxlY3Rpb24pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNIb3N0TWV0aG9kIChob3N0LCBwcm9wKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIGhvc3RbcHJvcF07XG4gIHJldHVybiB0eXBlID09PSAnZnVuY3Rpb24nIHx8ICEhKHR5cGUgPT09ICdvYmplY3QnICYmIGhvc3RbcHJvcF0pIHx8IHR5cGUgPT09ICd1bmtub3duJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0UHJvcGVydHkgKGhvc3QsIHByb3ApIHtcbiAgcmV0dXJuIHR5cGVvZiBob3N0W3Byb3BdICE9PSAndW5kZWZpbmVkJztcbn1cblxuZnVuY3Rpb24gbWFueSAoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGFyZUhvc3RlZCAoaG9zdCwgcHJvcHMpIHtcbiAgICB2YXIgaSA9IHByb3BzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBpZiAoIWZuKGhvc3QsIHByb3BzW2ldKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0aG9kOiBpc0hvc3RNZXRob2QsXG4gIG1ldGhvZHM6IG1hbnkoaXNIb3N0TWV0aG9kKSxcbiAgcHJvcGVydHk6IGlzSG9zdFByb3BlcnR5LFxuICBwcm9wZXJ0aWVzOiBtYW55KGlzSG9zdFByb3BlcnR5KVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBib2R5ID0gZG9jLmJvZHk7XG5cbmZ1bmN0aW9uIHJhbmdlVG9UZXh0UmFuZ2UgKHApIHtcbiAgaWYgKHAuY29sbGFwc2VkKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB9XG4gIHZhciBzdGFydFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiBwLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHAuc3RhcnRPZmZzZXQgfSwgdHJ1ZSk7XG4gIHZhciBlbmRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5lbmRDb250YWluZXIsIG9mZnNldDogcC5lbmRPZmZzZXQgfSwgZmFsc2UpO1xuICB2YXIgdGV4dFJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgdGV4dFJhbmdlLnNldEVuZFBvaW50KCdTdGFydFRvU3RhcnQnLCBzdGFydFJhbmdlKTtcbiAgdGV4dFJhbmdlLnNldEVuZFBvaW50KCdFbmRUb0VuZCcsIGVuZFJhbmdlKTtcbiAgcmV0dXJuIHRleHRSYW5nZTtcbn1cblxuZnVuY3Rpb24gaXNDaGFyYWN0ZXJEYXRhTm9kZSAobm9kZSkge1xuICB2YXIgdCA9IG5vZGUubm9kZVR5cGU7XG4gIHJldHVybiB0ID09PSAzIHx8IHQgPT09IDQgfHwgdCA9PT0gOCA7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlIChwLCBzdGFydGluZykge1xuICB2YXIgYm91bmQ7XG4gIHZhciBwYXJlbnQ7XG4gIHZhciBvZmZzZXQgPSBwLm9mZnNldDtcbiAgdmFyIHdvcmtpbmdOb2RlO1xuICB2YXIgY2hpbGROb2RlcztcbiAgdmFyIHJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgdmFyIGRhdGEgPSBpc0NoYXJhY3RlckRhdGFOb2RlKHAubm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICBib3VuZCA9IHAubm9kZTtcbiAgICBwYXJlbnQgPSBib3VuZC5wYXJlbnROb2RlO1xuICB9IGVsc2Uge1xuICAgIGNoaWxkTm9kZXMgPSBwLm5vZGUuY2hpbGROb2RlcztcbiAgICBib3VuZCA9IG9mZnNldCA8IGNoaWxkTm9kZXMubGVuZ3RoID8gY2hpbGROb2Rlc1tvZmZzZXRdIDogbnVsbDtcbiAgICBwYXJlbnQgPSBwLm5vZGU7XG4gIH1cblxuICB3b3JraW5nTm9kZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHdvcmtpbmdOb2RlLmlubmVySFRNTCA9ICcmI2ZlZmY7JztcblxuICBpZiAoYm91bmQpIHtcbiAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHdvcmtpbmdOb2RlLCBib3VuZCk7XG4gIH0gZWxzZSB7XG4gICAgcGFyZW50LmFwcGVuZENoaWxkKHdvcmtpbmdOb2RlKTtcbiAgfVxuXG4gIHJhbmdlLm1vdmVUb0VsZW1lbnRUZXh0KHdvcmtpbmdOb2RlKTtcbiAgcmFuZ2UuY29sbGFwc2UoIXN0YXJ0aW5nKTtcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHdvcmtpbmdOb2RlKTtcblxuICBpZiAoZGF0YSkge1xuICAgIHJhbmdlW3N0YXJ0aW5nID8gJ21vdmVTdGFydCcgOiAnbW92ZUVuZCddKCdjaGFyYWN0ZXInLCBvZmZzZXQpO1xuICB9XG4gIHJldHVybiByYW5nZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByYW5nZVRvVGV4dFJhbmdlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb24nKTtcbnZhciBzZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL3NldFNlbGVjdGlvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0OiBnZXRTZWxlY3Rpb24sXG4gIHNldDogc2V0U2VsZWN0aW9uXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb24nKTtcbnZhciByYW5nZVRvVGV4dFJhbmdlID0gcmVxdWlyZSgnLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBzZXRTZWxlY3Rpb24gKHApIHtcbiAgaWYgKGRvYy5jcmVhdGVSYW5nZSkge1xuICAgIG1vZGVyblNlbGVjdGlvbigpO1xuICB9IGVsc2Uge1xuICAgIG9sZFNlbGVjdGlvbigpO1xuICB9XG5cbiAgZnVuY3Rpb24gbW9kZXJuU2VsZWN0aW9uICgpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgdmFyIHJhbmdlID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gICAgaWYgKCFwLnN0YXJ0Q29udGFpbmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChwLmVuZENvbnRhaW5lcikge1xuICAgICAgcmFuZ2Uuc2V0RW5kKHAuZW5kQ29udGFpbmVyLCBwLmVuZE9mZnNldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJhbmdlLnNldEVuZChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICB9XG4gICAgcmFuZ2Uuc2V0U3RhcnQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgIHNlbC5hZGRSYW5nZShyYW5nZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvbGRTZWxlY3Rpb24gKCkge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocCkuc2VsZWN0KCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzZWxsID0gcmVxdWlyZSgnc2VsbCcpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHNlbGVjY2lvbiA9IHJlcXVpcmUoJ3NlbGVjY2lvbicpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIGdldFNlbGVjdGlvbiA9IHNlbGVjY2lvbi5nZXQ7XG52YXIgcHJvcHMgPSBbXG4gICdkaXJlY3Rpb24nLFxuICAnYm94U2l6aW5nJyxcbiAgJ3dpZHRoJyxcbiAgJ2hlaWdodCcsXG4gICdvdmVyZmxvd1gnLFxuICAnb3ZlcmZsb3dZJyxcbiAgJ2JvcmRlclRvcFdpZHRoJyxcbiAgJ2JvcmRlclJpZ2h0V2lkdGgnLFxuICAnYm9yZGVyQm90dG9tV2lkdGgnLFxuICAnYm9yZGVyTGVmdFdpZHRoJyxcbiAgJ3BhZGRpbmdUb3AnLFxuICAncGFkZGluZ1JpZ2h0JyxcbiAgJ3BhZGRpbmdCb3R0b20nLFxuICAncGFkZGluZ0xlZnQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2ZvbnRWYXJpYW50JyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0cmV0Y2gnLFxuICAnZm9udFNpemUnLFxuICAnZm9udFNpemVBZGp1c3QnLFxuICAnbGluZUhlaWdodCcsXG4gICdmb250RmFtaWx5JyxcbiAgJ3RleHRBbGlnbicsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAndGV4dERlY29yYXRpb24nLFxuICAnbGV0dGVyU3BhY2luZycsXG4gICd3b3JkU3BhY2luZydcbl07XG52YXIgd2luID0gZ2xvYmFsO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGZmID0gd2luLm1veklubmVyU2NyZWVuWCAhPT0gbnVsbCAmJiB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSB2b2lkIDA7XG5cbmZ1bmN0aW9uIHRhaWxvcm1hZGUgKGVsLCBvcHRpb25zKSB7XG4gIHZhciB0ZXh0SW5wdXQgPSBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7XG4gIHZhciB0aHJvdHRsZWRSZWZyZXNoID0gdGhyb3R0bGUocmVmcmVzaCwgMzApO1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG5cbiAgYmluZCgpO1xuXG4gIHJldHVybiB7XG4gICAgcmVhZDogcmVhZFBvc2l0aW9uLFxuICAgIHJlZnJlc2g6IHRocm90dGxlZFJlZnJlc2gsXG4gICAgZGVzdHJveTogZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIG5vb3AgKCkge31cbiAgZnVuY3Rpb24gcmVhZFBvc2l0aW9uICgpIHsgcmV0dXJuICh0ZXh0SW5wdXQgPyBjb29yZHNUZXh0IDogY29vcmRzSFRNTCkoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2ggKCkge1xuICAgIGlmIChvLnNsZWVwaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiAoby51cGRhdGUgfHwgbm9vcCkocmVhZFBvc2l0aW9uKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzVGV4dCAoKSB7XG4gICAgdmFyIHAgPSBzZWxsKGVsKTtcbiAgICB2YXIgY29udGV4dCA9IHByZXBhcmUoKTtcbiAgICB2YXIgcmVhZGluZ3MgPSByZWFkVGV4dENvb3Jkcyhjb250ZXh0LCBwLnN0YXJ0KTtcbiAgICBkb2MuYm9keS5yZW1vdmVDaGlsZChjb250ZXh0Lm1pcnJvcik7XG4gICAgcmV0dXJuIHJlYWRpbmdzO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzSFRNTCAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIGlmIChzZWwucmFuZ2VDb3VudCkge1xuICAgICAgdmFyIHJhbmdlID0gc2VsLmdldFJhbmdlQXQoMCk7XG4gICAgICB2YXIgbmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnID0gcmFuZ2Uuc3RhcnRDb250YWluZXIubm9kZU5hbWUgPT09ICdQJyAmJiByYW5nZS5zdGFydE9mZnNldCA9PT0gMDtcbiAgICAgIGlmIChuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB4OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRMZWZ0LFxuICAgICAgICAgIHk6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldFRvcCxcbiAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlLmdldENsaWVudFJlY3RzKSB7XG4gICAgICAgIHZhciByZWN0cyA9IHJhbmdlLmdldENsaWVudFJlY3RzKCk7XG4gICAgICAgIGlmIChyZWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IHJlY3RzWzBdLmxlZnQsXG4gICAgICAgICAgICB5OiByZWN0c1swXS50b3AsXG4gICAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgeDogMCwgeTogMCB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFRleHRDb29yZHMgKGNvbnRleHQsIHApIHtcbiAgICB2YXIgcmVzdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgdmFyIG1pcnJvciA9IGNvbnRleHQubWlycm9yO1xuICAgIHZhciBjb21wdXRlZCA9IGNvbnRleHQuY29tcHV0ZWQ7XG5cbiAgICB3cml0ZShtaXJyb3IsIHJlYWQoZWwpLnN1YnN0cmluZygwLCBwKSk7XG5cbiAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJykge1xuICAgICAgbWlycm9yLnRleHRDb250ZW50ID0gbWlycm9yLnRleHRDb250ZW50LnJlcGxhY2UoL1xccy9nLCAnXFx1MDBhMCcpO1xuICAgIH1cblxuICAgIHdyaXRlKHJlc3QsIHJlYWQoZWwpLnN1YnN0cmluZyhwKSB8fCAnLicpO1xuXG4gICAgbWlycm9yLmFwcGVuZENoaWxkKHJlc3QpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHJlc3Qub2Zmc2V0TGVmdCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJMZWZ0V2lkdGgnXSksXG4gICAgICB5OiByZXN0Lm9mZnNldFRvcCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJUb3BXaWR0aCddKVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChlbCkge1xuICAgIHJldHVybiB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXBhcmUgKCkge1xuICAgIHZhciBjb21wdXRlZCA9IHdpbi5nZXRDb21wdXRlZFN0eWxlID8gZ2V0Q29tcHV0ZWRTdHlsZShlbCkgOiBlbC5jdXJyZW50U3R5bGU7XG4gICAgdmFyIG1pcnJvciA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB2YXIgc3R5bGUgPSBtaXJyb3Iuc3R5bGU7XG5cbiAgICBkb2MuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgIT09ICdJTlBVVCcpIHtcbiAgICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnO1xuICAgIH1cbiAgICBzdHlsZS53aGl0ZVNwYWNlID0gJ3ByZS13cmFwJztcbiAgICBzdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHByb3BzLmZvckVhY2goY29weSk7XG5cbiAgICBpZiAoZmYpIHtcbiAgICAgIHN0eWxlLndpZHRoID0gcGFyc2VJbnQoY29tcHV0ZWQud2lkdGgpIC0gMiArICdweCc7XG4gICAgICBpZiAoZWwuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSkge1xuICAgICAgICBzdHlsZS5vdmVyZmxvd1kgPSAnc2Nyb2xsJztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcbiAgICB9XG4gICAgcmV0dXJuIHsgbWlycm9yOiBtaXJyb3IsIGNvbXB1dGVkOiBjb21wdXRlZCB9O1xuXG4gICAgZnVuY3Rpb24gY29weSAocHJvcCkge1xuICAgICAgc3R5bGVbcHJvcF0gPSBjb21wdXRlZFtwcm9wXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAoZWwsIHZhbHVlKSB7XG4gICAgaWYgKHRleHRJbnB1dCkge1xuICAgICAgZWwudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXl1cCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdpbnB1dCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdjaGFuZ2UnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0YWlsb3JtYWRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0aHJvdHRsZSAoZm4sIGJvdW5kYXJ5KSB7XG4gIHZhciBsYXN0ID0gLUluZmluaXR5O1xuICB2YXIgdGltZXI7XG4gIHJldHVybiBmdW5jdGlvbiBib3VuY2VkICgpIHtcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdW5ib3VuZCgpO1xuXG4gICAgZnVuY3Rpb24gdW5ib3VuZCAoKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgdGltZXIgPSBudWxsO1xuICAgICAgdmFyIG5leHQgPSBsYXN0ICsgYm91bmRhcnk7XG4gICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmIChub3cgPiBuZXh0KSB7XG4gICAgICAgIGxhc3QgPSBub3c7XG4gICAgICAgIGZuKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQodW5ib3VuZCwgbmV4dCAtIG5vdyk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRocm90dGxlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGlja3kgPSByZXF1aXJlKCd0aWNreScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgYXJncywgY3R4KSB7XG4gIGlmICghZm4pIHsgcmV0dXJuOyB9XG4gIHRpY2t5KGZ1bmN0aW9uIHJ1biAoKSB7XG4gICAgZm4uYXBwbHkoY3R4IHx8IG51bGwsIGFyZ3MgfHwgW10pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdG9hID0gcmVxdWlyZSgnYXRvYScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnLi9kZWJvdW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gIHZhciBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGV2dCA9IHt9O1xuICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gIHRoaW5nLm9uID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgaWYgKCFldnRbdHlwZV0pIHtcbiAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2dFt0eXBlXS5wdXNoKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgZm4uX29uY2UgPSB0cnVlOyAvLyB0aGluZy5vZmYoZm4pIHN0aWxsIHdvcmtzIVxuICAgIHRoaW5nLm9uKHR5cGUsIGZuKTtcbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAoYyA9PT0gMSkge1xuICAgICAgZGVsZXRlIGV2dFt0eXBlXTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDApIHtcbiAgICAgIGV2dCA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAoIWV0KSB7IHJldHVybiB0aGluZzsgfVxuICAgICAgZXQuc3BsaWNlKGV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5lbWl0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGluZy5lbWl0dGVyU25hcHNob3QoYXJncy5zaGlmdCgpKS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgdGhpbmcuZW1pdHRlclNuYXBzaG90ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgZXQgPSAoZXZ0W3R5cGVdIHx8IFtdKS5zbGljZSgwKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgY3R4ID0gdGhpcyB8fCB0aGluZztcbiAgICAgIGlmICh0eXBlID09PSAnZXJyb3InICYmIG9wdHMudGhyb3dzICE9PSBmYWxzZSAmJiAhZXQubGVuZ3RoKSB7IHRocm93IGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3M7IH1cbiAgICAgIGV0LmZvckVhY2goZnVuY3Rpb24gZW1pdHRlciAobGlzdGVuKSB7XG4gICAgICAgIGlmIChvcHRzLmFzeW5jKSB7IGRlYm91bmNlKGxpc3RlbiwgYXJncywgY3R4KTsgfSBlbHNlIHsgbGlzdGVuLmFwcGx5KGN0eCwgYXJncyk7IH1cbiAgICAgICAgaWYgKGxpc3Rlbi5fb25jZSkgeyB0aGluZy5vZmYodHlwZSwgbGlzdGVuKTsgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpbmc7XG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIHRoaW5nO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXRvYSAoYSwgbikgeyByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYSwgbik7IH1cbiIsInZhciBzaSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicsIHRpY2s7XG5pZiAoc2kpIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRJbW1lZGlhdGUoZm4pOyB9O1xufSBlbHNlIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRUaW1lb3V0KGZuLCAwKTsgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0aWNrOyIsIlxudmFyIE5hdGl2ZUN1c3RvbUV2ZW50ID0gZ2xvYmFsLkN1c3RvbUV2ZW50O1xuXG5mdW5jdGlvbiB1c2VOYXRpdmUgKCkge1xuICB0cnkge1xuICAgIHZhciBwID0gbmV3IE5hdGl2ZUN1c3RvbUV2ZW50KCdjYXQnLCB7IGRldGFpbDogeyBmb286ICdiYXInIH0gfSk7XG4gICAgcmV0dXJuICAnY2F0JyA9PT0gcC50eXBlICYmICdiYXInID09PSBwLmRldGFpbC5mb287XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ3Jvc3MtYnJvd3NlciBgQ3VzdG9tRXZlbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DdXN0b21FdmVudC5DdXN0b21FdmVudFxuICpcbiAqIEBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHVzZU5hdGl2ZSgpID8gTmF0aXZlQ3VzdG9tRXZlbnQgOlxuXG4vLyBJRSA+PSA5XG4nZnVuY3Rpb24nID09PSB0eXBlb2YgZG9jdW1lbnQuY3JlYXRlRXZlbnQgPyBmdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwpO1xuICB9IGVsc2Uge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdm9pZCAwKTtcbiAgfVxuICByZXR1cm4gZTtcbn0gOlxuXG4vLyBJRSA8PSA4XG5mdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgZS50eXBlID0gdHlwZTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuYnViYmxlcyA9IEJvb2xlYW4ocGFyYW1zLmJ1YmJsZXMpO1xuICAgIGUuY2FuY2VsYWJsZSA9IEJvb2xlYW4ocGFyYW1zLmNhbmNlbGFibGUpO1xuICAgIGUuZGV0YWlsID0gcGFyYW1zLmRldGFpbDtcbiAgfSBlbHNlIHtcbiAgICBlLmJ1YmJsZXMgPSBmYWxzZTtcbiAgICBlLmNhbmNlbGFibGUgPSBmYWxzZTtcbiAgICBlLmRldGFpbCA9IHZvaWQgMDtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnY3VzdG9tLWV2ZW50Jyk7XG52YXIgZXZlbnRtYXAgPSByZXF1aXJlKCcuL2V2ZW50bWFwJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkRXZlbnQsXG4gIHJlbW92ZTogcmVtb3ZlRXZlbnQsXG4gIGZhYnJpY2F0ZTogZmFicmljYXRlRXZlbnRcbn07XG5cbmZ1bmN0aW9uIGFkZEV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgd3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGxpc3RlbmVyID0gdW53cmFwKGVsLCB0eXBlLCBmbik7XG4gIGlmIChsaXN0ZW5lcikge1xuICAgIHJldHVybiBlbC5kZXRhY2hFdmVudCgnb24nICsgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZhYnJpY2F0ZUV2ZW50IChlbCwgdHlwZSwgbW9kZWwpIHtcbiAgdmFyIGUgPSBldmVudG1hcC5pbmRleE9mKHR5cGUpID09PSAtMSA/IG1ha2VDdXN0b21FdmVudCgpIDogbWFrZUNsYXNzaWNFdmVudCgpO1xuICBpZiAoZWwuZGlzcGF0Y2hFdmVudCkge1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuZmlyZUV2ZW50KCdvbicgKyB0eXBlLCBlKTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ2xhc3NpY0V2ZW50ICgpIHtcbiAgICB2YXIgZTtcbiAgICBpZiAoZG9jLmNyZWF0ZUV2ZW50KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgZS5pbml0RXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChkb2MuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUN1c3RvbUV2ZW50ICgpIHtcbiAgICByZXR1cm4gbmV3IGN1c3RvbUV2ZW50KHR5cGUsIHsgZGV0YWlsOiBtb2RlbCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVyRmFjdG9yeSAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwcGVyIChvcmlnaW5hbEV2ZW50KSB7XG4gICAgdmFyIGUgPSBvcmlnaW5hbEV2ZW50IHx8IGdsb2JhbC5ldmVudDtcbiAgICBlLnRhcmdldCA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICBlLnByZXZlbnREZWZhdWx0ID0gZS5wcmV2ZW50RGVmYXVsdCB8fCBmdW5jdGlvbiBwcmV2ZW50RGVmYXVsdCAoKSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbiA9IGUuc3RvcFByb3BhZ2F0aW9uIHx8IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbiAoKSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfTtcbiAgICBlLndoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgZm4uY2FsbChlbCwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgd3JhcHBlciA9IHVud3JhcChlbCwgdHlwZSwgZm4pIHx8IHdyYXBwZXJGYWN0b3J5KGVsLCB0eXBlLCBmbik7XG4gIGhhcmRDYWNoZS5wdXNoKHtcbiAgICB3cmFwcGVyOiB3cmFwcGVyLFxuICAgIGVsZW1lbnQ6IGVsLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgZm46IGZuXG4gIH0pO1xuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuZnVuY3Rpb24gdW53cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGkgPSBmaW5kKGVsLCB0eXBlLCBmbik7XG4gIGlmIChpKSB7XG4gICAgdmFyIHdyYXBwZXIgPSBoYXJkQ2FjaGVbaV0ud3JhcHBlcjtcbiAgICBoYXJkQ2FjaGUuc3BsaWNlKGksIDEpOyAvLyBmcmVlIHVwIGEgdGFkIG9mIG1lbW9yeVxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSwgaXRlbTtcbiAgZm9yIChpID0gMDsgaSA8IGhhcmRDYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGl0ZW0gPSBoYXJkQ2FjaGVbaV07XG4gICAgaWYgKGl0ZW0uZWxlbWVudCA9PT0gZWwgJiYgaXRlbS50eXBlID09PSB0eXBlICYmIGl0ZW0uZm4gPT09IGZuKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50bWFwID0gW107XG52YXIgZXZlbnRuYW1lID0gJyc7XG52YXIgcm9uID0gL15vbi87XG5cbmZvciAoZXZlbnRuYW1lIGluIGdsb2JhbCkge1xuICBpZiAocm9uLnRlc3QoZXZlbnRuYW1lKSkge1xuICAgIGV2ZW50bWFwLnB1c2goZXZlbnRuYW1lLnNsaWNlKDIpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50bWFwO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmdXp6eXNlYXJjaCAobmVlZGxlLCBoYXlzdGFjaykge1xuICB2YXIgdGxlbiA9IGhheXN0YWNrLmxlbmd0aDtcbiAgdmFyIHFsZW4gPSBuZWVkbGUubGVuZ3RoO1xuICBpZiAocWxlbiA+IHRsZW4pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHFsZW4gPT09IHRsZW4pIHtcbiAgICByZXR1cm4gbmVlZGxlID09PSBoYXlzdGFjaztcbiAgfVxuICBvdXRlcjogZm9yICh2YXIgaSA9IDAsIGogPSAwOyBpIDwgcWxlbjsgaSsrKSB7XG4gICAgdmFyIG5jaCA9IG5lZWRsZS5jaGFyQ29kZUF0KGkpO1xuICAgIHdoaWxlIChqIDwgdGxlbikge1xuICAgICAgaWYgKGhheXN0YWNrLmNoYXJDb2RlQXQoaisrKSA9PT0gbmNoKSB7XG4gICAgICAgIGNvbnRpbnVlIG91dGVyO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnV6enlzZWFyY2g7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHBhZCAoaGFzaCwgbGVuKSB7XG4gIHdoaWxlIChoYXNoLmxlbmd0aCA8IGxlbikge1xuICAgIGhhc2ggPSAnMCcgKyBoYXNoO1xuICB9XG4gIHJldHVybiBoYXNoO1xufVxuXG5mdW5jdGlvbiBmb2xkIChoYXNoLCB0ZXh0KSB7XG4gIHZhciBpO1xuICB2YXIgY2hyO1xuICB2YXIgbGVuO1xuICBpZiAodGV4dC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gaGFzaDtcbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSB0ZXh0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY2hyID0gdGV4dC5jaGFyQ29kZUF0KGkpO1xuICAgIGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIGNocjtcbiAgICBoYXNoIHw9IDA7XG4gIH1cbiAgcmV0dXJuIGhhc2ggPCAwID8gaGFzaCAqIC0yIDogaGFzaDtcbn1cblxuZnVuY3Rpb24gZm9sZE9iamVjdCAoaGFzaCwgbywgc2Vlbikge1xuICByZXR1cm4gT2JqZWN0LmtleXMobykuc29ydCgpLnJlZHVjZShmb2xkS2V5LCBoYXNoKTtcbiAgZnVuY3Rpb24gZm9sZEtleSAoaGFzaCwga2V5KSB7XG4gICAgcmV0dXJuIGZvbGRWYWx1ZShoYXNoLCBvW2tleV0sIGtleSwgc2Vlbik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9sZFZhbHVlIChpbnB1dCwgdmFsdWUsIGtleSwgc2Vlbikge1xuICB2YXIgaGFzaCA9IGZvbGQoZm9sZChmb2xkKGlucHV0LCBrZXkpLCB0b1N0cmluZyh2YWx1ZSkpLCB0eXBlb2YgdmFsdWUpO1xuICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gZm9sZChoYXNoLCAnbnVsbCcpO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGZvbGQoaGFzaCwgJ3VuZGVmaW5lZCcpO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKHNlZW4uaW5kZXhPZih2YWx1ZSkgIT09IC0xKSB7XG4gICAgICByZXR1cm4gZm9sZChoYXNoLCAnW0NpcmN1bGFyXScgKyBrZXkpO1xuICAgIH1cbiAgICBzZWVuLnB1c2godmFsdWUpO1xuICAgIHJldHVybiBmb2xkT2JqZWN0KGhhc2gsIHZhbHVlLCBzZWVuKTtcbiAgfVxuICByZXR1cm4gZm9sZChoYXNoLCB2YWx1ZS50b1N0cmluZygpKTtcbn1cblxuZnVuY3Rpb24gdG9TdHJpbmcgKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuZnVuY3Rpb24gc3VtIChvKSB7XG4gIHJldHVybiBwYWQoZm9sZFZhbHVlKDAsIG8sICcnLCBbXSkudG9TdHJpbmcoMTYpLCA4KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXQgPSBlYXN5R2V0O1xudmFyIHNldCA9IGVhc3lTZXQ7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHBhcnNlKGVsLCBwLnN0YXJ0KTtcbiAgZWwuc2VsZWN0aW9uRW5kID0gcGFyc2UoZWwsIHAuZW5kKTtcbn1cblxuZnVuY3Rpb24gaGFyZFNldCAoZWwsIHApIHtcbiAgdmFyIHJhbmdlID0gZWwuY3JlYXRlVGV4dFJhbmdlKCk7XG5cbiAgaWYgKHAuc3RhcnQgPT09ICdlbmQnICYmIHAuZW5kID09PSAnZW5kJykge1xuICAgIHJhbmdlLmNvbGxhcHNlKGZhbHNlKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZS5jb2xsYXBzZSh0cnVlKTtcbiAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCBwYXJzZShlbCwgcC5lbmQpKTtcbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLnN0YXJ0KSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2UgKGVsLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09ICdlbmQnID8gZWwudmFsdWUubGVuZ3RoIDogdmFsdWUgfHwgMDtcbn1cblxuZnVuY3Rpb24gc2VsbCAoZWwsIHApIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBzZXQoZWwsIHApO1xuICB9XG4gIHJldHVybiBnZXQoZWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNlbGw7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBzZWxsIGZyb20gJ3NlbGwnO1xuaW1wb3J0IGNyb3NzdmVudCBmcm9tICdjcm9zc3ZlbnQnO1xuaW1wb3J0IGJ1bGxzZXllIGZyb20gJ2J1bGxzZXllJztcbmltcG9ydCBmdXp6eXNlYXJjaCBmcm9tICdmdXp6eXNlYXJjaCc7XG5jb25zdCBLRVlfQkFDS1NQQUNFID0gODtcbmNvbnN0IEtFWV9FTlRFUiA9IDEzO1xuY29uc3QgS0VZX0VTQyA9IDI3O1xuY29uc3QgS0VZX1VQID0gMzg7XG5jb25zdCBLRVlfRE9XTiA9IDQwO1xuY29uc3QgS0VZX1RBQiA9IDk7XG5jb25zdCBkb2MgPSBkb2N1bWVudDtcbmNvbnN0IGRvY0VsZW1lbnQgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhdXRvY29tcGxldGUgKGVsLCBvcHRpb25zKSB7XG4gIGNvbnN0IG8gPSBvcHRpb25zIHx8IHt9O1xuICBjb25zdCBwYXJlbnQgPSBvLmFwcGVuZFRvIHx8IGRvYy5ib2R5O1xuICBjb25zdCByZW5kZXIgPSBvLnJlbmRlciB8fCBkZWZhdWx0UmVuZGVyZXI7XG4gIGNvbnN0IHtnZXRUZXh0LCBnZXRWYWx1ZSwgZm9ybSwgc3VnZ2VzdGlvbnN9ID0gbztcbiAgY29uc3QgbGltaXQgPSB0eXBlb2Ygby5saW1pdCA9PT0gJ251bWJlcicgPyBvLmxpbWl0IDogSW5maW5pdHk7XG4gIGNvbnN0IHVzZXJGaWx0ZXIgPSBvLmZpbHRlciB8fCBkZWZhdWx0RmlsdGVyO1xuICBjb25zdCB1c2VyU2V0ID0gby5zZXQgfHwgZGVmYXVsdFNldHRlcjtcbiAgY29uc3QgdWwgPSB0YWcoJ3VsJywgJ3RhYy1saXN0Jyk7XG4gIGNvbnN0IGRlZmVycmVkRmlsdGVyaW5nID0gZGVmZXIoZmlsdGVyaW5nKTtcbiAgY29uc3Qgc3RhdGUgPSB7IGNvdW50ZXI6IDAsIHF1ZXJ5OiBudWxsIH07XG4gIGxldCBzZWxlY3Rpb24gPSBudWxsO1xuICBsZXQgZXllO1xuICBsZXQgYXR0YWNobWVudCA9IGVsO1xuICBsZXQgdGV4dElucHV0O1xuICBsZXQgYW55SW5wdXQ7XG4gIGxldCByYW5jaG9ybGVmdDtcbiAgbGV0IHJhbmNob3JyaWdodDtcbiAgbGV0IGxhc3RQcmVmaXggPSAnJztcblxuICBpZiAoby5hdXRvSGlkZU9uQmx1ciA9PT0gdm9pZCAwKSB7IG8uYXV0b0hpZGVPbkJsdXIgPSB0cnVlOyB9XG4gIGlmIChvLmF1dG9IaWRlT25DbGljayA9PT0gdm9pZCAwKSB7IG8uYXV0b0hpZGVPbkNsaWNrID0gdHJ1ZTsgfVxuICBpZiAoby5hdXRvU2hvd09uVXBEb3duID09PSB2b2lkIDApIHsgby5hdXRvU2hvd09uVXBEb3duID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJzsgfVxuICBpZiAoby5hbmNob3IpIHtcbiAgICByYW5jaG9ybGVmdCA9IG5ldyBSZWdFeHAoJ14nICsgby5hbmNob3IpO1xuICAgIHJhbmNob3JyaWdodCA9IG5ldyBSZWdFeHAoby5hbmNob3IgKyAnJCcpO1xuICB9XG5cbiAgY29uc3QgYXBpID0ge1xuICAgIGFkZCxcbiAgICBhbmNob3I6IG8uYW5jaG9yLFxuICAgIGNsZWFyLFxuICAgIHNob3csXG4gICAgaGlkZSxcbiAgICB0b2dnbGUsXG4gICAgZGVzdHJveSxcbiAgICByZWZyZXNoUG9zaXRpb24sXG4gICAgYXBwZW5kVGV4dCxcbiAgICBhcHBlbmRIVE1MLFxuICAgIGZpbHRlckFuY2hvcmVkVGV4dCxcbiAgICBmaWx0ZXJBbmNob3JlZEhUTUwsXG4gICAgZGVmYXVsdEFwcGVuZFRleHQ6IGFwcGVuZFRleHQsXG4gICAgZGVmYXVsdEZpbHRlcixcbiAgICBkZWZhdWx0UmVuZGVyZXIsXG4gICAgZGVmYXVsdFNldHRlcixcbiAgICByZXRhcmdldCxcbiAgICBhdHRhY2htZW50LFxuICAgIGxpc3Q6IHVsLFxuICAgIHN1Z2dlc3Rpb25zOiBbXVxuICB9O1xuXG4gIHJldGFyZ2V0KGVsKTtcbiAgcGFyZW50LmFwcGVuZENoaWxkKHVsKTtcbiAgZWwuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkoc3VnZ2VzdGlvbnMpKSB7XG4gICAgbG9hZGVkKHN1Z2dlc3Rpb25zLCBmYWxzZSk7XG4gIH1cblxuICByZXR1cm4gYXBpO1xuXG4gIGZ1bmN0aW9uIHJldGFyZ2V0IChlbCkge1xuICAgIGlucHV0RXZlbnRzKHRydWUpO1xuICAgIGF0dGFjaG1lbnQgPSBhcGkuYXR0YWNobWVudCA9IGVsO1xuICAgIHRleHRJbnB1dCA9IGF0dGFjaG1lbnQudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBhdHRhY2htZW50LnRhZ05hbWUgPT09ICdURVhUQVJFQSc7XG4gICAgYW55SW5wdXQgPSB0ZXh0SW5wdXQgfHwgaXNFZGl0YWJsZShhdHRhY2htZW50KTtcbiAgICBpbnB1dEV2ZW50cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaFBvc2l0aW9uICgpIHtcbiAgICBpZiAoZXllKSB7IGV5ZS5yZWZyZXNoKCk7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGxvYWRpbmcgKGZvcmNlU2hvdykge1xuICAgIGlmICh0eXBlb2Ygc3VnZ2VzdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNyb3NzdmVudC5yZW1vdmUoYXR0YWNobWVudCwgJ2ZvY3VzJywgbG9hZGluZyk7XG4gICAgICBjb25zdCBxdWVyeSA9IHJlYWRJbnB1dCgpO1xuICAgICAgaWYgKHF1ZXJ5ICE9PSBzdGF0ZS5xdWVyeSkge1xuICAgICAgICBzdGF0ZS5jb3VudGVyKys7XG4gICAgICAgIHN0YXRlLnF1ZXJ5ID0gcXVlcnk7XG5cbiAgICAgICAgY29uc3QgY291bnRlciA9IHN0YXRlLmNvdW50ZXI7XG4gICAgICAgIHN1Z2dlc3Rpb25zKHsgcXVlcnksIGxpbWl0IH0sIGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgaWYgKHN0YXRlLmNvdW50ZXIgPT09IGNvdW50ZXIpIHtcbiAgICAgICAgICAgIGxvYWRlZChzLCBmb3JjZVNob3cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9hZGVkIChzdWdnZXN0aW9ucywgZm9yY2VTaG93KSB7XG4gICAgY2xlYXIoKTtcbiAgICBhcGkuc3VnZ2VzdGlvbnMgPSBbXTtcbiAgICBzdWdnZXN0aW9ucy5mb3JFYWNoKGFkZCk7XG4gICAgaWYgKGZvcmNlU2hvdykge1xuICAgICAgc2hvdygpO1xuICAgIH1cbiAgICBmaWx0ZXJpbmcoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgICB1bnNlbGVjdCgpO1xuICAgIHdoaWxlICh1bC5sYXN0Q2hpbGQpIHtcbiAgICAgIHVsLnJlbW92ZUNoaWxkKHVsLmxhc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZElucHV0ICgpIHtcbiAgICByZXR1cm4gdGV4dElucHV0ID8gZWwudmFsdWUgOiBlbC5pbm5lckhUTUw7XG4gIH1cblxuICBmdW5jdGlvbiBhZGQgKHN1Z2dlc3Rpb24pIHtcbiAgICBsZXQgbGkgPSB0YWcoJ2xpJywgJ3RhYy1pdGVtJyk7XG4gICAgcmVuZGVyKGxpLCBzdWdnZXN0aW9uKTtcbiAgICBicmVha3VwRm9ySGlnaGxpZ2h0ZXIobGkpO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdtb3VzZWVudGVyJywgaG92ZXJTdWdnZXN0aW9uKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGxpLCAnY2xpY2snLCBjbGlja2VkU3VnZ2VzdGlvbik7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInLCBmaWx0ZXJJdGVtKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGxpLCAnYXV0b2NvbXBsZXRlLWhpZGUnLCBoaWRlSXRlbSk7XG4gICAgdWwuYXBwZW5kQ2hpbGQobGkpO1xuICAgIGFwaS5zdWdnZXN0aW9ucy5wdXNoKHN1Z2dlc3Rpb24pO1xuICAgIHJldHVybiBsaTtcblxuICAgIGZ1bmN0aW9uIGhvdmVyU3VnZ2VzdGlvbiAoKSB7XG4gICAgICBzZWxlY3Qoc3VnZ2VzdGlvbik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xpY2tlZFN1Z2dlc3Rpb24gKCkge1xuICAgICAgY29uc3QgaW5wdXQgPSBnZXRUZXh0KHN1Z2dlc3Rpb24pO1xuICAgICAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZShzdWdnZXN0aW9uKTtcbiAgICAgIHNldCh2YWx1ZSk7XG4gICAgICBoaWRlKCk7XG4gICAgICBhdHRhY2htZW50LmZvY3VzKCk7XG4gICAgICBsYXN0UHJlZml4ID0gby5wcmVmaXggJiYgby5wcmVmaXgoaW5wdXQsIGFwaS5zdWdnZXN0aW9ucy5zbGljZSgpKSB8fCAnJztcbiAgICAgIGlmIChsYXN0UHJlZml4KSB7XG4gICAgICAgIGVsLnZhbHVlID0gbGFzdFByZWZpeDtcbiAgICAgICAgZWwuc2VsZWN0KCk7XG4gICAgICAgIHNob3coKTtcbiAgICAgICAgZmlsdGVyaW5nKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVySXRlbSAoKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHJlYWRJbnB1dCgpO1xuICAgICAgaWYgKGZpbHRlcih2YWx1ZSwgc3VnZ2VzdGlvbikpIHtcbiAgICAgICAgbGkuY2xhc3NOYW1lID0gbGkuY2xhc3NOYW1lLnJlcGxhY2UoLyB0YWMtaGlkZS9nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGxpLCAnYXV0b2NvbXBsZXRlLWhpZGUnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoaWRlSXRlbSAoKSB7XG4gICAgICBpZiAoIWhpZGRlbihsaSkpIHtcbiAgICAgICAgbGkuY2xhc3NOYW1lICs9ICcgdGFjLWhpZGUnO1xuICAgICAgICBpZiAoc2VsZWN0aW9uID09PSBsaSkge1xuICAgICAgICAgIHVuc2VsZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBicmVha3VwRm9ySGlnaGxpZ2h0ZXIgKGVsKSB7XG4gICAgZ2V0VGV4dENoaWxkcmVuKGVsKS5mb3JFYWNoKGVsID0+IHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gICAgICBjb25zdCB0ZXh0ID0gZWwudGV4dENvbnRlbnQgfHwgZWwubm9kZVZhbHVlIHx8ICcnO1xuICAgICAgaWYgKHRleHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGNoYXIgb2YgdGV4dCkge1xuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHNwYW5Gb3IoY2hhciksIGVsKTtcbiAgICAgIH1cbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICBmdW5jdGlvbiBzcGFuRm9yIChjaGFyKSB7XG4gICAgICAgIGNvbnN0IHNwYW4gPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBzcGFuLmNsYXNzTmFtZSA9ICd0YWMtY2hhcic7XG4gICAgICAgIHNwYW4udGV4dENvbnRlbnQgPSBzcGFuLmlubmVyVGV4dCA9IGNoYXI7XG4gICAgICAgIHJldHVybiBzcGFuO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gaGlnaGxpZ2h0IChlbCwgbmVlZGxlKSB7XG4gICAgY29uc3QgY2hhcnMgPSBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnLnRhYy1jaGFyJyldO1xuXG4gICAgZm9yIChsZXQgaW5wdXQgb2YgbmVlZGxlKSB7XG4gICAgICB3aGlsZSAoY2hhcnMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjaGFyID0gY2hhcnMuc2hpZnQoKTtcbiAgICAgICAgbGV0IGNoYXJUZXh0ID0gY2hhci5pbm5lclRleHQgfHwgY2hhci50ZXh0Q29udGVudDtcbiAgICAgICAgaWYgKGNoYXJUZXh0ID09PSBpbnB1dCkge1xuICAgICAgICAgIG9uKGNoYXIpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZihjaGFyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB3aGlsZSAoY2hhcnMubGVuZ3RoKSB7XG4gICAgICBvZmYoY2hhcnMuc2hpZnQoKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb24gKGNoKSB7XG4gICAgICBjaC5jbGFzc0xpc3QuYWRkKCd0YWMtY2hhci1oaWdobGlnaHQnKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gb2ZmIChjaCkge1xuICAgICAgY2guY2xhc3NMaXN0LnJlbW92ZSgndGFjLWNoYXItaGlnaGxpZ2h0Jyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0VGV4dENoaWxkcmVuIChlbCkge1xuICAgIGNvbnN0IHRleHRzID0gW107XG4gICAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihlbCwgTm9kZUZpbHRlci5TSE9XX1RFWFQsIG51bGwsIGZhbHNlKTtcbiAgICBsZXQgbm9kZTtcbiAgICB3aGlsZSAobm9kZSA9IHdhbGtlci5uZXh0Tm9kZSgpKSB7XG4gICAgICB0ZXh0cy5wdXNoKG5vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dHM7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHZhbHVlKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICByZXR1cm4gKGlzVGV4dCgpID8gYXBpLmFwcGVuZFRleHQgOiBhcGkuYXBwZW5kSFRNTCkodmFsdWUpO1xuICAgIH1cbiAgICB1c2VyU2V0KHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlciAodmFsdWUsIHN1Z2dlc3Rpb24pIHtcbiAgICBpZiAoby5hbmNob3IpIHtcbiAgICAgIGNvbnN0IGlsID0gKGlzVGV4dCgpID8gYXBpLmZpbHRlckFuY2hvcmVkVGV4dCA6IGFwaS5maWx0ZXJBbmNob3JlZEhUTUwpKHZhbHVlLCBzdWdnZXN0aW9uKTtcbiAgICAgIHJldHVybiBpbCA/IHVzZXJGaWx0ZXIoaWwuaW5wdXQsIGlsLnN1Z2dlc3Rpb24pIDogZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB1c2VyRmlsdGVyKHZhbHVlLCBzdWdnZXN0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzVGV4dCAoKSB7IHJldHVybiBpc0lucHV0KGF0dGFjaG1lbnQpOyB9XG4gIGZ1bmN0aW9uIHZpc2libGUgKCkgeyByZXR1cm4gdWwuY2xhc3NOYW1lLmluZGV4T2YoJ3RhYy1zaG93JykgIT09IC0xOyB9XG4gIGZ1bmN0aW9uIGhpZGRlbiAobGkpIHsgcmV0dXJuIGxpLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtaGlkZScpICE9PSAtMTsgfVxuXG4gIGZ1bmN0aW9uIHNob3cgKCkge1xuICAgIGlmICghdmlzaWJsZSgpKSB7XG4gICAgICB1bC5jbGFzc05hbWUgKz0gJyB0YWMtc2hvdyc7XG4gICAgICBleWUucmVmcmVzaCgpO1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLXNob3cnKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0b2dnbGVyIChlKSB7XG4gICAgY29uc3QgbGVmdCA9IGUud2hpY2ggPT09IDEgJiYgIWUubWV0YUtleSAmJiAhZS5jdHJsS2V5O1xuICAgIGlmIChsZWZ0ID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuOyAvLyB3ZSBvbmx5IGNhcmUgYWJvdXQgaG9uZXN0IHRvIGdvZCBsZWZ0LWNsaWNrc1xuICAgIH1cbiAgICB0b2dnbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZSAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHNob3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdCAoc3VnZ2VzdGlvbikge1xuICAgIHVuc2VsZWN0KCk7XG4gICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgIHNlbGVjdGlvbiA9IHN1Z2dlc3Rpb247XG4gICAgICBzZWxlY3Rpb24uY2xhc3NOYW1lICs9ICcgdGFjLXNlbGVjdGVkJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1bnNlbGVjdCAoKSB7XG4gICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgc2VsZWN0aW9uLmNsYXNzTmFtZSA9IHNlbGVjdGlvbi5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zZWxlY3RlZC9nLCAnJyk7XG4gICAgICBzZWxlY3Rpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmUgKHVwLCBtb3Zlcykge1xuICAgIGNvbnN0IHRvdGFsID0gdWwuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmICh0b3RhbCA8IG1vdmVzKSB7XG4gICAgICB1bnNlbGVjdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodG90YWwgPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZmlyc3QgPSB1cCA/ICdsYXN0Q2hpbGQnIDogJ2ZpcnN0Q2hpbGQnO1xuICAgIGNvbnN0IG5leHQgPSB1cCA/ICdwcmV2aW91c1NpYmxpbmcnIDogJ25leHRTaWJsaW5nJztcbiAgICBjb25zdCBzdWdnZXN0aW9uID0gc2VsZWN0aW9uICYmIHNlbGVjdGlvbltuZXh0XSB8fCB1bFtmaXJzdF07XG5cbiAgICBzZWxlY3Qoc3VnZ2VzdGlvbik7XG5cbiAgICBpZiAoaGlkZGVuKHN1Z2dlc3Rpb24pKSB7XG4gICAgICBtb3ZlKHVwLCBtb3ZlcyA/IG1vdmVzICsgMSA6IDEpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGUgKCkge1xuICAgIGV5ZS5zbGVlcCgpO1xuICAgIHVsLmNsYXNzTmFtZSA9IHVsLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLXNob3cvZywgJycpO1xuICAgIHVuc2VsZWN0KCk7XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLWhpZGUnKTtcbiAgICBpZiAoZWwudmFsdWUgPT09IGxhc3RQcmVmaXgpIHtcbiAgICAgIGVsLnZhbHVlID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICAgIGNvbnN0IHNob3duID0gdmlzaWJsZSgpO1xuICAgIGNvbnN0IHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfRE9XTikge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd24pIHtcbiAgICAgICAgbW92ZSgpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9VUCkge1xuICAgICAgaWYgKGFueUlucHV0ICYmIG8uYXV0b1Nob3dPblVwRG93bikge1xuICAgICAgICBzaG93KCk7XG4gICAgICB9XG4gICAgICBpZiAoc2hvd24pIHtcbiAgICAgICAgbW92ZSh0cnVlKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfQkFDS1NQQUNFKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNob3duKSB7XG4gICAgICBpZiAod2hpY2ggPT09IEtFWV9FTlRFUikge1xuICAgICAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShzZWxlY3Rpb24sICdjbGljaycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhpZGUoKTtcbiAgICAgICAgfVxuICAgICAgICBzdG9wKGUpO1xuICAgICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX0VTQykge1xuICAgICAgICBoaWRlKCk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc3RvcCAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmlsdGVyaW5nICgpIHtcbiAgICBpZiAoIXZpc2libGUoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2FkaW5nKHRydWUpO1xuICAgIGNyb3NzdmVudC5mYWJyaWNhdGUoYXR0YWNobWVudCwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICBjb25zdCB2YWx1ZSA9IHJlYWRJbnB1dCgpLnRyaW0oKTtcbiAgICBsZXQgbGkgPSB1bC5maXJzdENoaWxkO1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgd2hpbGUgKGxpKSB7XG4gICAgICBpZiAoY291bnQgPj0gbGltaXQpIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGxpLCAnYXV0b2NvbXBsZXRlLWZpbHRlcicpO1xuICAgICAgICBpZiAobGkuY2xhc3NOYW1lLmluZGV4T2YoJ3RhYy1oaWRlJykgPT09IC0xKSB7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgICBoaWdobGlnaHQobGksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGkgPSBsaS5uZXh0U2libGluZztcbiAgICB9XG4gICAgaWYgKCFzZWxlY3Rpb24pIHtcbiAgICAgIG1vdmUoKTtcbiAgICB9XG4gICAgaWYgKCFzZWxlY3Rpb24pIHtcbiAgICAgIGhpZGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZlcnJlZEZpbHRlcmluZ05vRW50ZXIgKGUpIHtcbiAgICBjb25zdCB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRlZmVycmVkRmlsdGVyaW5nKCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZlcnJlZFNob3cgKGUpIHtcbiAgICBjb25zdCB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSIHx8IHdoaWNoID09PSBLRVlfVEFCKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFRpbWVvdXQoc2hvdywgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBhdXRvY29tcGxldGVFdmVudFRhcmdldCAoZSkge1xuICAgIGxldCB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgaWYgKHRhcmdldCA9PT0gdWwgfHwgdGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU9uQmx1ciAoZSkge1xuICAgIGNvbnN0IHdoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKHdoaWNoID09PSBLRVlfVEFCKSB7XG4gICAgICBoaWRlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGlkZU9uQ2xpY2sgKGUpIHtcbiAgICBpZiAoYXV0b2NvbXBsZXRlRXZlbnRUYXJnZXQoZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaGlkZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5wdXRFdmVudHMgKHJlbW92ZSkge1xuICAgIGNvbnN0IG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBpZiAoZXllKSB7XG4gICAgICBleWUuZGVzdHJveSgpO1xuICAgICAgZXllID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFyZW1vdmUpIHtcbiAgICAgIGV5ZSA9IGJ1bGxzZXllKHVsLCBhdHRhY2htZW50LCB7IGNhcmV0OiBhbnlJbnB1dCAmJiBhdHRhY2htZW50LnRhZ05hbWUgIT09ICdJTlBVVCcgfSk7XG4gICAgICBpZiAoIXZpc2libGUoKSkgeyBleWUuc2xlZXAoKTsgfVxuICAgIH1cbiAgICBpZiAocmVtb3ZlIHx8IChhbnlJbnB1dCAmJiBkb2MuYWN0aXZlRWxlbWVudCAhPT0gYXR0YWNobWVudCkpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2ZvY3VzJywgbG9hZGluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRpbmcoKTtcbiAgICB9XG4gICAgaWYgKGFueUlucHV0KSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdrZXlwcmVzcycsIGRlZmVycmVkU2hvdyk7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdrZXlwcmVzcycsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBkZWZlcnJlZEZpbHRlcmluZ05vRW50ZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAncGFzdGUnLCBkZWZlcnJlZEZpbHRlcmluZyk7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdrZXlkb3duJywga2V5ZG93bik7XG4gICAgICBpZiAoby5hdXRvSGlkZU9uQmx1cikgeyBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdrZXlkb3duJywgaGlkZU9uQmx1cik7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnY2xpY2snLCB0b2dnbGVyKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oZG9jRWxlbWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICB9XG4gICAgaWYgKG8uYXV0b0hpZGVPbkNsaWNrKSB7IGNyb3NzdmVudFtvcF0oZG9jLCAnY2xpY2snLCBoaWRlT25DbGljayk7IH1cbiAgICBpZiAoZm9ybSkgeyBjcm9zc3ZlbnRbb3BdKGZvcm0sICdzdWJtaXQnLCBoaWRlKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgaW5wdXRFdmVudHModHJ1ZSk7XG4gICAgaWYgKHBhcmVudC5jb250YWlucyh1bCkpIHsgcGFyZW50LnJlbW92ZUNoaWxkKHVsKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdFNldHRlciAodmFsdWUpIHtcbiAgICBpZiAodGV4dElucHV0KSB7XG4gICAgICBlbC52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UmVuZGVyZXIgKGxpLCBzdWdnZXN0aW9uKSB7XG4gICAgbGkuaW5uZXJUZXh0ID0gbGkudGV4dENvbnRlbnQgPSBnZXRUZXh0KHN1Z2dlc3Rpb24pO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdEZpbHRlciAocSwgc3VnZ2VzdGlvbikge1xuICAgIGNvbnN0IG5lZWRsZSA9IHEudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB0ZXh0ID0gZ2V0VGV4dChzdWdnZXN0aW9uKSB8fCAnJztcbiAgICBpZiAoZnV6enlzZWFyY2gobmVlZGxlLCB0ZXh0LnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZShzdWdnZXN0aW9uKSB8fCAnJztcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZnV6enlzZWFyY2gobmVlZGxlLCB2YWx1ZS50b0xvd2VyQ2FzZSgpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvb3BiYWNrVG9BbmNob3IgKHRleHQsIHApIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IGFuY2hvcmVkID0gZmFsc2U7XG4gICAgbGV0IHN0YXJ0ID0gcC5zdGFydDtcbiAgICB3aGlsZSAoYW5jaG9yZWQgPT09IGZhbHNlICYmIHN0YXJ0ID49IDApIHtcbiAgICAgIHJlc3VsdCA9IHRleHQuc3Vic3RyKHN0YXJ0IC0gMSwgcC5zdGFydCAtIHN0YXJ0ICsgMSk7XG4gICAgICBhbmNob3JlZCA9IHJhbmNob3JsZWZ0LnRlc3QocmVzdWx0KTtcbiAgICAgIHN0YXJ0LS07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB0ZXh0OiBhbmNob3JlZCA/IHJlc3VsdCA6IG51bGwsXG4gICAgICBzdGFydFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZFRleHQgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICBjb25zdCBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIGNvbnN0IGlucHV0ID0gbG9vcGJhY2tUb0FuY2hvcihxLCBwb3NpdGlvbikudGV4dDtcbiAgICBpZiAoaW5wdXQpIHtcbiAgICAgIHJldHVybiB7IGlucHV0LCBzdWdnZXN0aW9uIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwZW5kVGV4dCAodmFsdWUpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gZWwudmFsdWU7XG4gICAgY29uc3QgcG9zaXRpb24gPSBzZWxsKGVsKTtcbiAgICBjb25zdCBpbnB1dCA9IGxvb3BiYWNrVG9BbmNob3IoY3VycmVudCwgcG9zaXRpb24pO1xuICAgIGNvbnN0IGxlZnQgPSBjdXJyZW50LnN1YnN0cigwLCBpbnB1dC5zdGFydCk7XG4gICAgY29uc3QgcmlnaHQgPSBjdXJyZW50LnN1YnN0cihpbnB1dC5zdGFydCArIGlucHV0LnRleHQubGVuZ3RoICsgKHBvc2l0aW9uLmVuZCAtIHBvc2l0aW9uLnN0YXJ0KSk7XG4gICAgY29uc3QgYmVmb3JlID0gbGVmdCArIHZhbHVlICsgJyAnO1xuXG4gICAgZWwudmFsdWUgPSBiZWZvcmUgKyByaWdodDtcbiAgICBzZWxsKGVsLCB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggfSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRIVE1MICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcmluZyBpbiBlZGl0YWJsZSBlbGVtZW50cyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXQgKGVsKSB7IHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7IH1cblxuZnVuY3Rpb24gdGFnICh0eXBlLCBjbGFzc05hbWUpIHtcbiAgY29uc3QgZWwgPSBkb2MuY3JlYXRlRWxlbWVudCh0eXBlKTtcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIGRlZmVyIChmbikgeyByZXR1cm4gZnVuY3Rpb24gKCkgeyBzZXRUaW1lb3V0KGZuLCAwKTsgfTsgfVxuXG5mdW5jdGlvbiBpc0VkaXRhYmxlIChlbCkge1xuICBjb25zdCB2YWx1ZSA9IGVsLmdldEF0dHJpYnV0ZSgnY29udGVudEVkaXRhYmxlJyk7XG4gIGlmICh2YWx1ZSA9PT0gJ2ZhbHNlJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodmFsdWUgPT09ICd0cnVlJykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChlbC5wYXJlbnRFbGVtZW50KSB7XG4gICAgcmV0dXJuIGlzRWRpdGFibGUoZWwucGFyZW50RWxlbWVudCk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgY3Jvc3N2ZW50IGZyb20gJ2Nyb3NzdmVudCc7XG5pbXBvcnQgZG9tIGZyb20gJy4vZG9tJztcbmltcG9ydCB0ZXh0IGZyb20gJy4vdGV4dCc7XG5jb25zdCBwcm9wcyA9IFtcbiAgJ2ZvbnRGYW1pbHknLFxuICAnZm9udFNpemUnLFxuICAnZm9udFdlaWdodCcsXG4gICdmb250U3R5bGUnLFxuICAnbGV0dGVyU3BhY2luZycsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3dvcmRTcGFjaW5nJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAnd2Via2l0Qm94U2l6aW5nJyxcbiAgJ21vekJveFNpemluZycsXG4gICdib3hTaXppbmcnLFxuICAncGFkZGluZycsXG4gICdib3JkZXInXG5dO1xuY29uc3Qgb2Zmc2V0ID0gMjA7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZhY3RvcnkgKGVsKSB7XG4gIGNvbnN0IG1pcnJvciA9IGRvbSgnc3BhbicpO1xuXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWlycm9yKTtcbiAgcmVtYXAoKTtcbiAgYmluZCgpO1xuXG4gIHJldHVybiB7IHJlbWFwLCByZWZyZXNoLCBkZXN0cm95IH07XG5cbiAgZnVuY3Rpb24gcmVtYXAgKCkge1xuICAgIGNvbnN0IGMgPSBjb21wdXRlZCgpO1xuICAgIGxldCB2YWx1ZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZSA9IGNbcHJvcHNbaV1dO1xuICAgICAgaWYgKHZhbHVlICE9PSB2b2lkIDAgJiYgdmFsdWUgIT09IG51bGwpIHsgLy8gb3RoZXJ3aXNlIElFIGJsb3dzIHVwXG4gICAgICAgIG1pcnJvci5zdHlsZVtwcm9wc1tpXV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgbWlycm9yLmRpc2FibGVkID0gJ2Rpc2FibGVkJztcbiAgICBtaXJyb3Iuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnO1xuICAgIG1pcnJvci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgbWlycm9yLnN0eWxlLnRvcCA9IG1pcnJvci5zdHlsZS5sZWZ0ID0gJy05OTk5ZW0nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgY29uc3QgdmFsdWUgPSBlbC52YWx1ZTtcbiAgICBpZiAodmFsdWUgPT09IG1pcnJvci52YWx1ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRleHQobWlycm9yLCB2YWx1ZSk7XG5cbiAgICBjb25zdCB3aWR0aCA9IG1pcnJvci5vZmZzZXRXaWR0aCArIG9mZnNldDtcblxuICAgIGVsLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgY29uc3Qgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgICBtaXJyb3IucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChtaXJyb3IpO1xuICAgIGVsLnN0eWxlLndpZHRoID0gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wdXRlZCAoKSB7XG4gICAgaWYgKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgICByZXR1cm4gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIH1cbiAgICByZXR1cm4gZWwuY3VycmVudFN0eWxlO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBkb20gKHRhZ05hbWUsIGNsYXNzZXMpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICBpZiAoY2xhc3Nlcykge1xuICAgIGVsLmNsYXNzTmFtZSA9IGNsYXNzZXM7XG4gIH1cbiAgcmV0dXJuIGVsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubGV0IGdldCA9IGVhc3lHZXQ7XG5sZXQgc2V0ID0gZWFzeVNldDtcbmNvbnN0IGlucHV0VGFnID0gL2lucHV0L2k7XG5jb25zdCB0ZXh0YXJlYVRhZyA9IC90ZXh0YXJlYS9pO1xuXG5pZiAoZG9jdW1lbnQuc2VsZWN0aW9uICYmIGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSkge1xuICBnZXQgPSBoYXJkR2V0O1xuICBzZXQgPSBoYXJkU2V0O1xufVxuXG5mdW5jdGlvbiBlYXN5R2V0IChlbCkge1xuICByZXR1cm4ge1xuICAgIHN0YXJ0OiBlbC5zZWxlY3Rpb25TdGFydCxcbiAgICBlbmQ6IGVsLnNlbGVjdGlvbkVuZFxuICB9O1xufVxuXG5mdW5jdGlvbiBoYXJkR2V0IChlbCkge1xuICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICBjb25zdCByYW5nZSA9IGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICBjb25zdCBib29rbWFyayA9IHJhbmdlLmdldEJvb2ttYXJrKCk7XG4gIGNvbnN0IG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIGNvbnN0IG1hcmtlciA9IGdldFVuaXF1ZU1hcmtlcihvcmlnaW5hbCk7XG4gIGNvbnN0IHBhcmVudCA9IHJhbmdlLnBhcmVudEVsZW1lbnQoKTtcbiAgaWYgKHBhcmVudCA9PT0gbnVsbCB8fCAhaW5wdXRzKHBhcmVudCkpIHtcbiAgICByZXR1cm4gcmVzdWx0KDAsIDApO1xuICB9XG4gIHJhbmdlLnRleHQgPSBtYXJrZXIgKyByYW5nZS50ZXh0ICsgbWFya2VyO1xuXG4gIGNvbnN0IGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICBsZXQgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IHRleHRhcmVhVGFnLnRlc3QoZWwudGFnTmFtZSkpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHNwZWNpYWwoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBzcGVjaWFsKGVsLCBwLmVuZCk7XG59XG5cbmZ1bmN0aW9uIGhhcmRTZXQgKGVsLCBwKSB7XG4gIGNvbnN0IHJhbmdlID0gZWwuY3JlYXRlVGV4dFJhbmdlKCk7XG5cbiAgaWYgKHAuc3RhcnQgPT09ICdlbmQnICYmIHAuZW5kID09PSAnZW5kJykge1xuICAgIHJhbmdlLmNvbGxhcHNlKGZhbHNlKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZS5jb2xsYXBzZSh0cnVlKTtcbiAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCBwLmVuZCk7XG4gICAgcmFuZ2UubW92ZVN0YXJ0KCdjaGFyYWN0ZXInLCBwLnN0YXJ0KTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzcGVjaWFsIChlbCwgdmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSAnZW5kJyA/IGVsLnZhbHVlLmxlbmd0aCA6IHZhbHVlIHx8IDA7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNlbGVjdGlvbiAoZWwsIHApIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBzZXQoZWwsIHApO1xuICB9XG4gIHJldHVybiBnZXQoZWwpO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgc3VtIGZyb20gJ2hhc2gtc3VtJztcbmltcG9ydCBjcm9zc3ZlbnQgZnJvbSAnY3Jvc3N2ZW50JztcbmltcG9ydCBlbWl0dGVyIGZyb20gJ2NvbnRyYS9lbWl0dGVyJztcbmltcG9ydCBkb20gZnJvbSAnLi9kb20nO1xuaW1wb3J0IHRleHQgZnJvbSAnLi90ZXh0JztcbmltcG9ydCBzZWxlY3Rpb24gZnJvbSAnLi9zZWxlY3Rpb24nO1xuaW1wb3J0IGF1dG9zaXplIGZyb20gJy4vYXV0b3NpemUnO1xuaW1wb3J0IGF1dG9jb21wbGV0ZSBmcm9tICcuL2F1dG9jb21wbGV0ZSc7XG5jb25zdCBpbnB1dFRhZyA9IC9eaW5wdXQkL2k7XG5jb25zdCBFTEVNRU5UID0gMTtcbmNvbnN0IEJBQ0tTUEFDRSA9IDg7XG5jb25zdCBFTkQgPSAzNTtcbmNvbnN0IEhPTUUgPSAzNjtcbmNvbnN0IExFRlQgPSAzNztcbmNvbnN0IFJJR0hUID0gMzk7XG5jb25zdCBzaW5rYWJsZUtleXMgPSBbRU5ELCBIT01FXTtcbmNvbnN0IHRhZ0NsYXNzID0gL1xcYnRheS10YWdcXGIvO1xuY29uc3QgdGFnUmVtb3ZhbENsYXNzID0gL1xcYnRheS10YWctcmVtb3ZlXFxiLztcbmNvbnN0IGVkaXRvckNsYXNzID0gL1xcYnRheS1lZGl0b3JcXGIvZztcbmNvbnN0IGlucHV0Q2xhc3MgPSAvXFxidGF5LWlucHV0XFxiL2c7XG5jb25zdCBlbmQgPSB7IHN0YXJ0OiAnZW5kJywgZW5kOiAnZW5kJyB9O1xuY29uc3QgZGVmYXVsdERlbGltaXRlciA9ICcgJztcblxuLy8gbW9kdWxlLmV4cG9ydHMgYmVjYXVzZSBicm93c2VyaWZ5IHN0YW5kYWxvbmVcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdGFnZ3kgKGVsLCBvcHRpb25zKSB7XG4gIGNvbnN0IGN1cnJlbnRWYWx1ZXMgPSBbXTtcbiAgY29uc3QgbyA9IG9wdGlvbnMgfHwge307XG4gIGNvbnN0IGRlbGltaXRlciA9IG8uZGVsaW1pdGVyIHx8IGRlZmF1bHREZWxpbWl0ZXI7XG4gIGlmIChkZWxpbWl0ZXIubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YWdneSBleHBlY3RlZCBhIHNpbmdsZS1jaGFyYWN0ZXIgZGVsaW1pdGVyIHN0cmluZycpO1xuICB9XG4gIGNvbnN0IGFueSA9IGhhc1NpYmxpbmdzKGVsKTtcbiAgaWYgKGFueSB8fCAhaW5wdXRUYWcudGVzdChlbC50YWdOYW1lKSkge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFnZ3kgZXhwZWN0ZWQgYW4gaW5wdXQgZWxlbWVudCB3aXRob3V0IGFueSBzaWJsaW5ncycpO1xuICB9XG4gIGNvbnN0IGZyZWUgPSBvLmZyZWUgIT09IGZhbHNlO1xuICBjb25zdCB2YWxpZGF0ZSA9IG8udmFsaWRhdGUgfHwgZGVmYXVsdFZhbGlkYXRlO1xuICBjb25zdCByZW5kZXIgPSBvLnJlbmRlciB8fCBkZWZhdWx0UmVuZGVyZXI7XG5cdGNvbnN0IGNvbnZlcnRPbkJsdXIgPSBvLmNvbnZlcnRPbkJsdXIgIT09IGZhbHNlO1xuXG4gIGNvbnN0IHRvSXRlbURhdGEgPSBkZWZhdWx0VG9JdGVtRGF0YTtcblxuICBjb25zdCBwYXJzZVRleHQgPSBvLnBhcnNlVGV4dDtcbiAgY29uc3QgcGFyc2VWYWx1ZSA9IG8ucGFyc2VWYWx1ZTtcbiAgY29uc3QgZ2V0VGV4dCA9IChcbiAgICB0eXBlb2YgcGFyc2VUZXh0ID09PSAnc3RyaW5nJyA/IGQgPT4gZFtwYXJzZVRleHRdIDpcbiAgICB0eXBlb2YgcGFyc2VUZXh0ID09PSAnZnVuY3Rpb24nID8gcGFyc2VUZXh0IDpcbiAgICBkID0+IGRcbiAgKTtcbiAgY29uc3QgZ2V0VmFsdWUgPSAoXG4gICAgdHlwZW9mIHBhcnNlVmFsdWUgPT09ICdzdHJpbmcnID8gZCA9PiBkW3BhcnNlVmFsdWVdIDpcbiAgICB0eXBlb2YgcGFyc2VWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHBhcnNlVmFsdWUgOlxuICAgIGQgPT4gZFxuICApO1xuXG4gIGNvbnN0IGJlZm9yZSA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1iZWZvcmUnKTtcbiAgY29uc3QgYWZ0ZXIgPSBkb20oJ3NwYW4nLCAndGF5LXRhZ3MgdGF5LXRhZ3MtYWZ0ZXInKTtcbiAgY29uc3QgcGFyZW50ID0gZWwucGFyZW50RWxlbWVudDtcbiAgZWwuY2xhc3NOYW1lICs9ICcgdGF5LWlucHV0JztcbiAgcGFyZW50LmNsYXNzTmFtZSArPSAnIHRheS1lZGl0b3InO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGJlZm9yZSwgZWwpO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFmdGVyLCBlbC5uZXh0U2libGluZyk7XG5cbiAgY29uc3Qgc2hyaW5rZXIgPSBhdXRvc2l6ZShlbCk7XG4gIGNvbnN0IGNvbXBsZXRlciA9IG8uYXV0b2NvbXBsZXRlID8gY3JlYXRlQXV0b2NvbXBsZXRlKCkgOiBudWxsO1xuICBjb25zdCBhcGkgPSBlbWl0dGVyKHtcbiAgICBhZGRJdGVtLFxuICAgIHJlbW92ZUl0ZW06IHJlbW92ZUl0ZW1CeURhdGEsXG4gICAgcmVtb3ZlSXRlbUJ5RWxlbWVudCxcbiAgICB2YWx1ZTogcmVhZFZhbHVlLFxuICAgIGRlc3Ryb3lcbiAgfSk7XG5cbiAgY29uc3QgcGxhY2Vob2xkZXIgPSBlbC5nZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJyk7XG4gIGxldCBwbGFjZWhlbGQgPSB0cnVlO1xuXG4gIGJpbmQoKTtcblxuICAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gZWwgP1xuICAgIGV2YWx1YXRlU2VsZWN0IDpcbiAgICBldmFsdWF0ZU5vU2VsZWN0XG4gICkoW2RlbGltaXRlcl0sIHRydWUpO1xuXG4gIHJldHVybiBhcGk7XG5cbiAgZnVuY3Rpb24gZmluZEl0ZW0gKHZhbHVlLCBwcm9wKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50VmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoY3VycmVudFZhbHVlc1tpXVtwcm9wIHx8ICdkYXRhJ10gPT09IHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjdXJyZW50VmFsdWVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZEl0ZW0gKGRhdGEpIHtcbiAgICBjb25zdCBpdGVtID0geyBkYXRhLCB2YWxpZDogdHJ1ZSB9O1xuICAgIGNvbnN0IGVsID0gcmVuZGVySXRlbShpdGVtKTtcbiAgICBpZiAoIWVsKSB7XG4gICAgICByZXR1cm4gYXBpO1xuICAgIH1cbiAgICBpdGVtLmVsID0gZWw7XG4gICAgY3VycmVudFZhbHVlcy5wdXNoKGl0ZW0pO1xuICAgIGFwaS5lbWl0KCdhZGQnLCBkYXRhLCBlbCk7XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW0gKGl0ZW0pIHtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgcmVtb3ZlSXRlbUVsZW1lbnQoaXRlbS5lbCk7XG4gICAgICBjdXJyZW50VmFsdWVzLnNwbGljZShjdXJyZW50VmFsdWVzLmluZGV4T2YoaXRlbSksIDEpO1xuICAgICAgYXBpLmVtaXQoJ3JlbW92ZScsIGl0ZW0uZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtQnlEYXRhIChkYXRhKSB7XG4gICAgcmV0dXJuIHJlbW92ZUl0ZW0oZmluZEl0ZW0oZGF0YSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbUJ5RWxlbWVudCAoZWwpIHtcbiAgICByZXR1cm4gcmVtb3ZlSXRlbShmaW5kSXRlbShlbCwgJ2VsJykpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVySXRlbSAoaXRlbSkge1xuICAgIHJldHVybiBjcmVhdGVUYWcoYmVmb3JlLCBpdGVtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW1FbGVtZW50IChlbCkge1xuICAgIGlmIChlbC5wYXJlbnRFbGVtZW50KSB7XG4gICAgICBlbC5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVUYWcgKGJ1ZmZlciwgaXRlbSkge1xuICAgIGNvbnN0IHtkYXRhfSA9IGl0ZW07XG4gICAgY29uc3QgZW1wdHkgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgJiYgZGF0YS50cmltKCkubGVuZ3RoID09PSAwO1xuICAgIGlmIChlbXB0eSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGVsID0gZG9tKCdzcGFuJywgJ3RheS10YWcnKTtcbiAgICByZW5kZXIoZWwsIGl0ZW0pO1xuICAgIGlmIChvLmRlbGV0aW9uKSB7XG4gICAgICBlbC5hcHBlbmRDaGlsZChkb20oJ3NwYW4nLCAndGF5LXRhZy1yZW1vdmUnKSk7XG4gICAgfVxuICAgIGJ1ZmZlci5hcHBlbmRDaGlsZChlbCk7XG4gICAgcmV0dXJuIGVsO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdFRvSXRlbURhdGEgKHMpIHtcbiAgICByZXR1cm4gcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRWYWx1ZSAoKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWYWx1ZXMuZmlsdGVyKHYgPT4gdi52YWxpZCkubWFwKHYgPT4gdi5kYXRhKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUF1dG9jb21wbGV0ZSAoKSB7XG4gICAgY29uc3QgY29uZmlnID0gby5hdXRvY29tcGxldGU7XG4gICAgY29uc3QgcHJlZml4ID0gY29uZmlnLnByZWZpeDtcbiAgICBjb25zdCBjYWNoZSA9IGNvbmZpZy5jYWNoZSB8fCB7fTtcbiAgICBjb25zdCBub1NvdXJjZSA9ICFjb25maWcuc291cmNlO1xuICAgIGlmIChub1NvdXJjZSAmJiAhY29uZmlnLnN1Z2dlc3Rpb25zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGxpbWl0ID0gTnVtYmVyKGNvbmZpZy5saW1pdCkgfHwgSW5maW5pdHk7XG4gICAgY29uc3Qgc3RhdGljSXRlbXMgPSBBcnJheS5pc0FycmF5KGNvbmZpZy5zdWdnZXN0aW9ucykgPyBjb25maWcuc3VnZ2VzdGlvbnMuc2xpY2UoKSA6IFtdO1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gbm9Tb3VyY2UgPyBzdGF0aWNJdGVtcyA6IHN1Z2dlc3Q7XG4gICAgY29uc3QgY29tcGxldGVyID0gYXV0b2NvbXBsZXRlKGVsLCB7XG4gICAgICBzdWdnZXN0aW9ucyxcbiAgICAgIGxpbWl0LFxuICAgICAgZ2V0VGV4dCxcbiAgICAgIGdldFZhbHVlLFxuICAgICAgcHJlZml4LFxuICAgICAgc2V0IChzKSB7XG4gICAgICAgIGVsLnZhbHVlID0gJyc7XG4gICAgICAgIGFkZEl0ZW0ocyk7XG4gICAgICB9LFxuICAgICAgZmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgICAgIGlmIChjb25maWcuZHVwbGljYXRlcyAhPT0gZmFsc2UgJiYgZmluZEl0ZW0oc3VnZ2VzdGlvbikpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZpZy5maWx0ZXIpIHtcbiAgICAgICAgICByZXR1cm4gY29uZmlnLmZpbHRlcihxLCBzdWdnZXN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcGxldGVyLmRlZmF1bHRGaWx0ZXIocSwgc3VnZ2VzdGlvbik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbXBsZXRlcjtcbiAgICBmdW5jdGlvbiBzdWdnZXN0IChkYXRhLCBkb25lKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IGRhdGEucXVlcnkudHJpbSgpO1xuICAgICAgaWYgKHF1ZXJ5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBkb25lKFtdKTsgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXBpLmVtaXQoJ2F1dG9jb21wbGV0ZS5iZWZvcmVTb3VyY2UnKTtcbiAgICAgIGNvbnN0IGhhc2ggPSBzdW0ocXVlcnkpOyAvLyBmYXN0LCBjYXNlIGluc2Vuc2l0aXZlLCBwcmV2ZW50cyBjb2xsaXNpb25zXG4gICAgICBjb25zdCBlbnRyeSA9IGNhY2hlW2hhc2hdO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gZW50cnkuY3JlYXRlZC5nZXRUaW1lKCk7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gY2FjaGUuZHVyYXRpb24gfHwgNjAgKiA2MCAqIDI0O1xuICAgICAgICBjb25zdCBkaWZmID0gZHVyYXRpb24gKiAxMDAwO1xuICAgICAgICBjb25zdCBmcmVzaCA9IG5ldyBEYXRlKHN0YXJ0ICsgZGlmZikgPiBuZXcgRGF0ZSgpO1xuICAgICAgICBpZiAoZnJlc2gpIHtcbiAgICAgICAgICBkb25lKGVudHJ5Lml0ZW1zKTsgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25maWcuc291cmNlKGRhdGEpXG4gICAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHQgOiBbXTtcbiAgICAgICAgICBjYWNoZVtoYXNoXSA9IHsgY3JlYXRlZDogbmV3IERhdGUoKSwgaXRlbXMgfTtcbiAgICAgICAgICBkb25lKGl0ZW1zKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQXV0b2NvbXBsZXRlIHNvdXJjZSBwcm9taXNlIHJlamVjdGVkJywgZXJyb3IsIGVsKTtcbiAgICAgICAgICBkb25lKFtdKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlUGxhY2Vob2xkZXIgKGUpIHtcbiAgICBjb25zdCBhbnkgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLnRheS10YWcnKTtcbiAgICBpZiAoIWFueSAmJiAhcGxhY2VoZWxkKSB7XG4gICAgICBlbC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgcGxhY2Vob2xkZXIpO1xuICAgICAgcGxhY2VoZWxkID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGFueSAmJiBwbGFjZWhlbGQpIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZSgncGxhY2Vob2xkZXInKTtcbiAgICAgIHBsYWNlaGVsZCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIGNvbnN0IG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjb25zdCBldiA9IHJlbW92ZSA/ICdvZmYnIDogJ29uJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlwcmVzcycsIGtleXByZXNzKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCBwYXN0ZSk7XG4gICAgY3Jvc3N2ZW50W29wXShwYXJlbnQsICdjbGljaycsIGNsaWNrKTtcblx0XHRpZiAoY29udmVydE9uQmx1cikge1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsICdibHVyJywgZG9jdW1lbnRibHVyLCB0cnVlKTtcbiAgICB9XG4gICAgaWYgKHBsYWNlaG9sZGVyKSB7XG4gICAgICBhcGlbZXZdKCdhZGQnLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICBhcGlbZXZdKCdyZW1vdmUnLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlwcmVzcycsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHVwZGF0ZVBsYWNlaG9sZGVyKTtcbiAgICAgIGNyb3NzdmVudFtvcF0ocGFyZW50LCAnY2xpY2snLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICB1cGRhdGVQbGFjZWhvbGRlcigpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gICAgaWYgKGNvbXBsZXRlcikgeyBjb21wbGV0ZXIuZGVzdHJveSgpOyB9XG4gICAgZWwudmFsdWUgPSAnJztcbiAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShpbnB1dENsYXNzLCAnJyk7XG4gICAgcGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShlZGl0b3JDbGFzcywgJycpO1xuICAgIGlmIChiZWZvcmUucGFyZW50RWxlbWVudCkgeyBiZWZvcmUucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChiZWZvcmUpOyB9XG4gICAgaWYgKGFmdGVyLnBhcmVudEVsZW1lbnQpIHsgYWZ0ZXIucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChhZnRlcik7IH1cbiAgICBzaHJpbmtlci5kZXN0cm95KCk7XG4gICAgYXBpLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgYXBpLmRlc3Ryb3kgPSBhcGkuYWRkSXRlbSA9IGFwaS5yZW1vdmVJdGVtID0gKCkgPT4gYXBpO1xuICAgIGFwaS50YWdzID0gYXBpLnZhbHVlID0gKCkgPT4gbnVsbDtcbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gZG9jdW1lbnRibHVyIChlKSB7XG4gICAgaWYgKGUudGFyZ2V0ICE9PSBlbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb252ZXJ0KHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xpY2sgKGUpIHtcbiAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFnUmVtb3ZhbENsYXNzLnRlc3QodGFyZ2V0LmNsYXNzTmFtZSkpIHtcbiAgICAgIGZvY3VzVGFnKHRhcmdldC5wYXJlbnRFbGVtZW50LCB7IHN0YXJ0OiAnZW5kJywgZW5kOiAnZW5kJywgcmVtb3ZlOiB0cnVlIH0pO1xuICAgICAgc2hpZnQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHRvcCA9IHRhcmdldDtcbiAgICBsZXQgdGFnZ2VkID0gdGFnQ2xhc3MudGVzdCh0b3AuY2xhc3NOYW1lKTtcbiAgICB3aGlsZSAodGFnZ2VkID09PSBmYWxzZSAmJiB0b3AucGFyZW50RWxlbWVudCkge1xuICAgICAgdG9wID0gdG9wLnBhcmVudEVsZW1lbnQ7XG4gICAgICB0YWdnZWQgPSB0YWdDbGFzcy50ZXN0KHRvcC5jbGFzc05hbWUpO1xuICAgIH1cbiAgICBpZiAodGFnZ2VkICYmIGZyZWUpIHtcbiAgICAgIGZvY3VzVGFnKHRvcCwgZW5kKTtcbiAgICB9IGVsc2UgaWYgKHRhcmdldCAhPT0gZWwpIHtcbiAgICAgIHNoaWZ0KCk7XG4gICAgICBlbC5mb2N1cygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNoaWZ0ICgpIHtcbiAgICBmb2N1c1RhZyhhZnRlci5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgZXZhbHVhdGVTZWxlY3QoW2RlbGltaXRlcl0sIHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29udmVydCAoYWxsKSB7XG4gICAgKGFsbCA/IGV2YWx1YXRlTm9TZWxlY3QgOiBldmFsdWF0ZVNlbGVjdCkoW2RlbGltaXRlcl0sIGFsbCk7XG4gICAgaWYgKGFsbCkge1xuICAgICAgZWFjaChhZnRlciwgbW92ZUxlZnQpO1xuICAgIH1cbiAgICByZXR1cm4gYXBpO1xuICB9XG5cbiAgZnVuY3Rpb24gbW92ZUxlZnQgKHZhbHVlLCB0YWcpIHtcbiAgICBiZWZvcmUuYXBwZW5kQ2hpbGQodGFnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGtleWRvd24gKGUpIHtcbiAgICBjb25zdCBzZWwgPSBzZWxlY3Rpb24oZWwpO1xuICAgIGNvbnN0IGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlIHx8IGUuY2hhckNvZGU7XG4gICAgY29uc3QgY2FuTW92ZUxlZnQgPSBzZWwuc3RhcnQgPT09IDAgJiYgc2VsLmVuZCA9PT0gMCAmJiBiZWZvcmUubGFzdENoaWxkO1xuICAgIGNvbnN0IGNhbk1vdmVSaWdodCA9IHNlbC5zdGFydCA9PT0gZWwudmFsdWUubGVuZ3RoICYmIHNlbC5lbmQgPT09IGVsLnZhbHVlLmxlbmd0aCAmJiBhZnRlci5maXJzdENoaWxkO1xuICAgIGlmIChmcmVlKSB7XG4gICAgICBpZiAoa2V5ID09PSBIT01FKSB7XG4gICAgICAgIGlmIChiZWZvcmUuZmlyc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGJlZm9yZS5maXJzdENoaWxkLCB7fSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZWN0aW9uKGVsLCB7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBFTkQpIHtcbiAgICAgICAgaWYgKGFmdGVyLmxhc3RDaGlsZCkge1xuICAgICAgICAgIGZvY3VzVGFnKGFmdGVyLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxlY3Rpb24oZWwsIGVuZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBCQUNLU1BBQ0UgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBSSUdIVCAmJiBjYW5Nb3ZlUmlnaHQpIHtcbiAgICAgICAgZm9jdXNUYWcoYWZ0ZXIuZmlyc3RDaGlsZCwge30pO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IExFRlQgJiYgY2FuTW92ZUxlZnQpIHtcbiAgICAgICAgZm9jdXNUYWcoYmVmb3JlLmxhc3RDaGlsZCwgZW5kKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGtleSA9PT0gQkFDS1NQQUNFICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIHJlbW92ZUl0ZW1CeUVsZW1lbnQoYmVmb3JlLmxhc3RDaGlsZCk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gUklHSFQgJiYgY2FuTW92ZVJpZ2h0KSB7XG4gICAgICAgIGJlZm9yZS5hcHBlbmRDaGlsZChhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBMRUZUICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShiZWZvcmUubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH0gZWxzZSBpZiAoc2lua2FibGVLZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHsgLy8gcHJldmVudCBkZWZhdWx0IG90aGVyd2lzZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoY29tcGxldGVyKSB7IGNvbXBsZXRlci5yZWZyZXNoUG9zaXRpb24oKTsgfVxuICAgIH1cblxuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlwcmVzcyAoZSkge1xuICAgIGNvbnN0IGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlIHx8IGUuY2hhckNvZGU7XG4gICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUoa2V5KSA9PT0gZGVsaW1pdGVyKSB7XG4gICAgICBjb252ZXJ0KCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGFzdGUgKCkge1xuICAgIHNldFRpbWVvdXQoKCkgPT4gZXZhbHVhdGVTZWxlY3QoKSwgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBldmFsdWF0ZU5vU2VsZWN0IChleHRyYXMsIGVudGlyZWx5KSB7XG4gICAgZXZhbHVhdGVJbnRlcm5hbChleHRyYXMsIGVudGlyZWx5KTsgLy8gbmVjZXNzYXJ5IGZvciBibHVyIGV2ZW50cywgaW5pdGlhbGl6YXRpb24sIHVuZm9jdXNlZCBldmFsdWF0aW9uXG4gIH1cblxuICBmdW5jdGlvbiBldmFsdWF0ZVNlbGVjdCAoZXh0cmFzLCBlbnRpcmVseSkge1xuICAgIGV2YWx1YXRlSW50ZXJuYWwoZXh0cmFzLCBlbnRpcmVseSwgc2VsZWN0aW9uKGVsKSk7IC8vIG9ubHkgaWYgd2Uga25vdyB0aGUgaW5wdXQgaGFzL3Nob3VsZCBoYXZlIGZvY3VzXG4gIH1cblxuICBmdW5jdGlvbiBldmFsdWF0ZUludGVybmFsIChleHRyYXMsIGVudGlyZWx5LCBwKSB7XG4gICAgY29uc3QgbGVuID0gZW50aXJlbHkgfHwgIXAgPyBJbmZpbml0eSA6IHAuc3RhcnQ7XG4gICAgY29uc3QgdGFncyA9IGVsLnZhbHVlLnNsaWNlKDAsIGxlbikuY29uY2F0KGV4dHJhcyB8fCBbXSkuc3BsaXQoZGVsaW1pdGVyKTtcbiAgICBpZiAodGFncy5sZW5ndGggPCAxIHx8ICFmcmVlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdCA9IHRhZ3MucG9wKCkgKyBlbC52YWx1ZS5zbGljZShsZW4pO1xuICAgIGNvbnN0IHJlbW92YWwgPSB0YWdzLmpvaW4oZGVsaW1pdGVyKS5sZW5ndGg7XG5cbiAgICB0YWdzLmZvckVhY2godGFnID0+IGFkZEl0ZW0odG9JdGVtRGF0YSh0YWcpKSk7XG4gICAgY2xlYW51cCgpO1xuICAgIGVsLnZhbHVlID0gcmVzdDtcbiAgICByZXNlbGVjdCgpO1xuICAgIHNocmlua2VyLnJlZnJlc2goKTtcblxuICAgIGZ1bmN0aW9uIHJlc2VsZWN0ICgpIHtcbiAgICAgIGlmIChwKSB7XG4gICAgICAgIHAuc3RhcnQgLT0gcmVtb3ZhbDtcbiAgICAgICAgcC5lbmQgLT0gcmVtb3ZhbDtcbiAgICAgICAgc2VsZWN0aW9uKGVsLCBwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhbnVwICgpIHtcbiAgICBjb25zdCB0YWdzID0gW107XG5cbiAgICBlYWNoKGJlZm9yZSwgZGV0ZWN0KTtcbiAgICBlYWNoKGFmdGVyLCBkZXRlY3QpO1xuXG4gICAgZnVuY3Rpb24gZGV0ZWN0ICh2YWx1ZSwgdGFnRWxlbWVudCkge1xuICAgICAgaWYgKHZhbGlkYXRlKHZhbHVlLCB0YWdzLnNsaWNlKCkpKSB7XG4gICAgICAgIHRhZ3MucHVzaCh2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG8ucHJldmVudEludmFsaWQpIHtcbiAgICAgICAgdGFnRWxlbWVudC5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRhZ0VsZW1lbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFnRWxlbWVudC5jbGFzc0xpc3QuYWRkKCd0YXktaW52YWxpZCcpO1xuICAgICAgICBhcGkuZW1pdCgnaW52YWxpZCcsIHZhbHVlLCB0YWdFbGVtZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UmVuZGVyZXIgKGNvbnRhaW5lciwgaXRlbSkge1xuICAgIHRleHQoY29udGFpbmVyLCBnZXRUZXh0KGl0ZW0uZGF0YSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFRhZyAodGFnKSB7XG4gICAgcmV0dXJuIHRleHQodGFnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvY3VzVGFnICh0YWcsIHApIHtcbiAgICBpZiAoIXRhZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGVjdChbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gICAgY29uc3QgcGFyZW50ID0gdGFnLnBhcmVudEVsZW1lbnQ7XG4gICAgaWYgKHBhcmVudCA9PT0gYmVmb3JlKSB7XG4gICAgICB3aGlsZSAocGFyZW50Lmxhc3RDaGlsZCAhPT0gdGFnKSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShwYXJlbnQubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKHBhcmVudC5maXJzdENoaWxkICE9PSB0YWcpIHtcbiAgICAgICAgYmVmb3JlLmFwcGVuZENoaWxkKHBhcmVudC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGFnLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnKTtcbiAgICBlbC52YWx1ZSA9IHAucmVtb3ZlID8gJycgOiByZWFkVGFnKHRhZyk7XG4gICAgZWwuZm9jdXMoKTtcbiAgICBzZWxlY3Rpb24oZWwsIHApO1xuICAgIHNocmlua2VyLnJlZnJlc2goKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhc1NpYmxpbmdzICgpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGVsLnBhcmVudEVsZW1lbnQuY2hpbGRyZW47XG4gICAgcmV0dXJuIFsuLi5jaGlsZHJlbl0uc29tZShzID0+IHMgIT09IGVsICYmIHMubm9kZVR5cGUgPT09IEVMRU1FTlQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZWFjaCAoY29udGFpbmVyLCBmbikge1xuICAgIFsuLi5jb250YWluZXIuY2hpbGRyZW5dLmZvckVhY2goKHRhZywgaSkgPT4gZm4ocmVhZFRhZyh0YWcpLCB0YWcsIGkpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRWYWxpZGF0ZSAodmFsdWUsIHRhZ3MpIHtcbiAgICByZXR1cm4gdGFncy5pbmRleE9mKHZhbHVlKSA9PT0gLTE7XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdGV4dCAoZWwsIHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZWwuaW5uZXJUZXh0ID0gZWwudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgfVxuICBpZiAodHlwZW9mIGVsLmlubmVyVGV4dCA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZWwuaW5uZXJUZXh0O1xuICB9XG4gIHJldHVybiBlbC50ZXh0Q29udGVudDtcbn1cbiJdfQ==
