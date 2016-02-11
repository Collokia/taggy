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

},{"./throttle":11,"crossvent":17,"seleccion":8,"sell":26}],11:[function(require,module,exports){
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
var isObject = require('./isObject'),
    now = require('./now'),
    toNumber = require('./toNumber');

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide an options object to indicate whether `func` should be invoked on
 * the leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent calls
 * to the debounced function return the result of the last `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
 * on the trailing edge of the timeout only if the the debounced function is
 * invoked more than once during the `wait` timeout.
 *
 * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.leading=false] Specify invoking on the leading
 *  edge of the timeout.
 * @param {number} [options.maxWait] The maximum time `func` is allowed to be
 *  delayed before it's invoked.
 * @param {boolean} [options.trailing=true] Specify invoking on the trailing
 *  edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // avoid costly calculations while the window size is in flux
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // invoke `sendMail` when clicked, debouncing subsequent calls
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // ensure `batchLog` is invoked once after 1 second of debounced calls
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // cancel a trailing debounced invocation
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var args,
      maxTimeoutId,
      result,
      stamp,
      thisArg,
      timeoutId,
      trailingCall,
      lastCalled = 0,
      leading = false,
      maxWait = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxWait = 'maxWait' in options && nativeMax(toNumber(options.maxWait) || 0, wait);
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
    }
    lastCalled = 0;
    args = maxTimeoutId = thisArg = timeoutId = trailingCall = undefined;
  }

  function complete(isCalled, id) {
    if (id) {
      clearTimeout(id);
    }
    maxTimeoutId = timeoutId = trailingCall = undefined;
    if (isCalled) {
      lastCalled = now();
      result = func.apply(thisArg, args);
      if (!timeoutId && !maxTimeoutId) {
        args = thisArg = undefined;
      }
    }
  }

  function delayed() {
    var remaining = wait - (now() - stamp);
    if (remaining <= 0 || remaining > wait) {
      complete(trailingCall, maxTimeoutId);
    } else {
      timeoutId = setTimeout(delayed, remaining);
    }
  }

  function flush() {
    if ((timeoutId && trailingCall) || (maxTimeoutId && trailing)) {
      result = func.apply(thisArg, args);
    }
    cancel();
    return result;
  }

  function maxDelayed() {
    complete(trailing, timeoutId);
  }

  function debounced() {
    args = arguments;
    stamp = now();
    thisArg = this;
    trailingCall = trailing && (timeoutId || !leading);

    if (maxWait === false) {
      var leadingCall = leading && !timeoutId;
    } else {
      if (!maxTimeoutId && !leading) {
        lastCalled = stamp;
      }
      var remaining = maxWait - (stamp - lastCalled),
          isCalled = remaining <= 0 || remaining > maxWait;

      if (isCalled) {
        if (maxTimeoutId) {
          maxTimeoutId = clearTimeout(maxTimeoutId);
        }
        lastCalled = stamp;
        result = func.apply(thisArg, args);
      }
      else if (!maxTimeoutId) {
        maxTimeoutId = setTimeout(maxDelayed, remaining);
      }
    }
    if (isCalled && timeoutId) {
      timeoutId = clearTimeout(timeoutId);
    }
    else if (!timeoutId && wait !== maxWait) {
      timeoutId = setTimeout(delayed, wait);
    }
    if (leadingCall) {
      isCalled = true;
      result = func.apply(thisArg, args);
    }
    if (isCalled && !timeoutId && !maxTimeoutId) {
      args = thisArg = undefined;
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

module.exports = debounce;

},{"./isObject":23,"./now":24,"./toNumber":25}],22:[function(require,module,exports){
(function (global){
var isObject = require('./isObject');

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = global.Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

module.exports = isFunction;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./isObject":23}],23:[function(require,module,exports){
/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],24:[function(require,module,exports){
/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @type Function
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => logs the number of milliseconds it took for the deferred function to be invoked
 */
var now = Date.now;

module.exports = now;

},{}],25:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isObject = require('./isObject');

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `global`. */
var freeParseInt = parseInt;

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = toNumber;

},{"./isFunction":22,"./isObject":23}],26:[function(require,module,exports){
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

},{}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = autocomplete;

var _sell = require('sell');

var _sell2 = _interopRequireDefault(_sell);

var _bullseye = require('bullseye');

var _bullseye2 = _interopRequireDefault(_bullseye);

var _crossvent = require('crossvent');

var _crossvent2 = _interopRequireDefault(_crossvent);

var _fuzzysearch = require('fuzzysearch');

var _fuzzysearch2 = _interopRequireDefault(_fuzzysearch);

var _debounce = require('lodash/debounce');

var _debounce2 = _interopRequireDefault(_debounce);

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
  var noMatches = o.noMatches;
  var noMatchesText = o.noMatchesText;

  var limit = typeof o.limit === 'number' ? o.limit : Infinity;
  var userFilter = o.filter || defaultFilter;
  var userSet = o.set || defaultSetter;
  var ul = tag('ul', 'tac-list');
  var container = tag('div', 'tac-container');
  var deferredFiltering = defer(filtering);
  var state = { counter: 0, query: null };
  var selection = null;
  var eye = undefined;
  var attachment = el;
  var noneMatch = undefined;
  var textInput = undefined;
  var anyInput = undefined;
  var ranchorleft = undefined;
  var ranchorright = undefined;
  var lastPrefix = '';
  var debounceTime = o.debounce || 300;
  var debouncedLoading = (0, _debounce2.default)(loading, debounceTime);

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
    suggestions: []
  };

  retarget(el);
  container.appendChild(ul);
  if (noMatches && noMatchesText) {
    noneMatch = tag('div', 'tac-empty tac-hide');
    text(noneMatch, noMatchesText);
    container.appendChild(noneMatch);
  }
  parent.appendChild(container);
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
    return (textInput ? el.value : el.innerHTML).trim();
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
      set(suggestion);
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
    return container.className.indexOf('tac-show') !== -1;
  }
  function hidden(li) {
    return li.className.indexOf('tac-hide') !== -1;
  }

  function show() {
    if (!visible()) {
      container.className += ' tac-show';
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
    container.className = container.className.replace(/ tac-show/g, '');
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
    debouncedLoading(true);
    _crossvent2.default.fabricate(attachment, 'autocomplete-filter');
    var value = readInput();
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
    var nomatch = noMatches({ query: value });
    if (count === 0 && nomatch) {
      noneMatch.classList.remove('tac-hide');
    } else {
      noneMatch.classList.add('tac-hide');
    }
    if (!selection) {
      move();
    }
    if (!selection && !nomatch) {
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
      if (target === container || target === attachment) {
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
      eye = (0, _bullseye2.default)(container, attachment, { caret: anyInput && attachment.tagName !== 'INPUT' });
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
    if (parent.contains(container)) {
      parent.removeChild(container);
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
    text(li, getText(suggestion));
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
function text(el, value) {
  el.innerText = el.textContent = value;
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

},{"bullseye":1,"crossvent":17,"fuzzysearch":19,"lodash/debounce":21,"sell":26}],28:[function(require,module,exports){
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

},{"./dom":29,"./text":32,"crossvent":17}],29:[function(require,module,exports){
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

},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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
    return d.toString();
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
    findItem: function findItem(data) {
      return _findItem(data);
    },
    findItemByElement: function findItemByElement(el) {
      return _findItem(el, 'el');
    },
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

  function _findItem(value, prop) {
    for (var i = 0; i < currentValues.length; i++) {
      if (currentValues[i][prop || 'data'] === value) {
        return currentValues[i];
      }
    }
    return null;
  }

  function addItem(data) {
    var valid = validate(data);
    var item = { data: data, valid: valid };
    if (o.preventInvalid) {
      return api;
    }
    var el = renderItem(item);
    if (!el) {
      return api;
    }
    item.el = el;
    currentValues.push(item);
    api.emit('add', data, el);
    invalidate();
    return api;
  }

  function removeItem(item) {
    if (!item) {
      return api;
    }
    removeItemElement(item.el);
    currentValues.splice(currentValues.indexOf(item), 1);
    api.emit('remove', item.data);
    invalidate();
    return api;
  }

  function invalidate() {
    currentValues.slice().forEach(function (v, i) {
      currentValues.splice(i, 1);

      var valid = validate(v.data);
      if (valid) {
        v.el.classList.add('tay-valid');
        v.el.classList.remove('tay-invalid');
      } else {
        v.el.classList.add('tay-invalid');
        v.el.classList.remove('tay-valid');
        api.emit('invalid', v.data, v.el);
      }
      v.valid = valid;

      currentValues.splice(i, 0, v);
    });
  }

  function removeItemByData(data) {
    return removeItem(_findItem(data));
  }

  function removeItemByElement(el) {
    return removeItem(_findItem(el, 'el'));
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
    var caching = config.cache !== false;
    var cache = config.cache || {};
    var source = config.suggestions;
    if (!source) {
      return;
    }
    var limit = Number(config.limit) || Infinity;
    var completer = (0, _autocomplete2.default)(el, {
      suggestions: suggestions,
      limit: limit,
      getText: getText,
      getValue: getValue,
      prefix: prefix,
      noMatches: noMatches,
      noMatchesText: config.noMatches,
      debounce: config.debounce,
      set: function set(s) {
        el.value = '';
        addItem(s);
      },
      filter: function filter(q, suggestion) {
        if (config.duplicates !== false && _findItem(suggestion)) {
          return false;
        }
        if (config.filter) {
          return config.filter(q, suggestion);
        }
        return completer.defaultFilter(q, suggestion);
      }
    });
    return completer;
    function noMatches(data) {
      if (!config.noMatches) {
        return false;
      }
      return data.query.length;
    }
    function suggestions(data, done) {
      var query = data.query;

      if (!config.blankSearch && query.length === 0) {
        done([]);return;
      }
      api.emit('autocomplete.beforeUpdate');
      var hash = (0, _hashSum2.default)(query); // fast, case insensitive, prevents collisions
      if (caching) {
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
      }
      config.suggestions(data).then(function (result) {
        var items = Array.isArray(result) ? result : [];
        if (caching) {
          cache[hash] = { created: new Date(), items: items };
        }
        done(items);
      }).catch(function (error) {
        console.log('Autocomplete suggestions promise rejected', error, el);
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
    var value = p.remove ? '' : readTag(tag);
    removeItemByElement(tag);
    el.value = value;
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

  function defaultValidate(value) {
    return _findItem(value) === null;
  }
};

},{"./autocomplete":27,"./autosize":28,"./dom":29,"./selection":30,"./text":32,"contra/emitter":13,"crossvent":17,"hash-sum":20}],32:[function(require,module,exports){
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

},{}]},{},[31])(31)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbk51bGxPcC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvbm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2lzSG9zdC5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NlbGVjY2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS9ub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9zZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZGVib3VuY2UuanMiLCJub2RlX21vZHVsZXMvY29udHJhL2VtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy9hdG9hL2F0b2EuanMiLCJub2RlX21vZHVsZXMvY29udHJhL25vZGVfbW9kdWxlcy90aWNreS90aWNreS1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9ub2RlX21vZHVsZXMvY3VzdG9tLWV2ZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvY3Jvc3N2ZW50LmpzIiwibm9kZV9tb2R1bGVzL2Nyb3NzdmVudC9zcmMvZXZlbnRtYXAuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZWFyY2gvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGFzaC1zdW0vaGFzaC1zdW0uanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2RlYm91bmNlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc0Z1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc09iamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvbm93LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC90b051bWJlci5qcyIsIm5vZGVfbW9kdWxlcy9zZWxsL3NlbGwuanMiLCJzcmMvYXV0b2NvbXBsZXRlLmpzIiwic3JjL2F1dG9zaXplLmpzIiwic3JjL2RvbS5qcyIsInNyYy9zZWxlY3Rpb24uanMiLCJzcmMvdGFnZ3kuanMiLCJzcmMvdGV4dC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMVBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0EsWUFBWSxDQUFDOzs7OztrQkFnQlcsWUFBWTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFUcEMsSUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLElBQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztBQUNyQixJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDbkIsSUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUNwQixJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDbEIsSUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDO0FBQ3JCLElBQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxlQUFlLENBQUM7O0FBRXhCLFNBQVMsWUFBWSxDQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7QUFDakQsTUFBTSxDQUFDLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztBQUN4QixNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDdEMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sSUFBSSxlQUFlLENBQUM7TUFDcEMsT0FBTyxHQUEyRCxDQUFDLENBQW5FLE9BQU87TUFBRSxRQUFRLEdBQWlELENBQUMsQ0FBMUQsUUFBUTtNQUFFLElBQUksR0FBMkMsQ0FBQyxDQUFoRCxJQUFJO01BQUUsV0FBVyxHQUE4QixDQUFDLENBQTFDLFdBQVc7TUFBRSxTQUFTLEdBQW1CLENBQUMsQ0FBN0IsU0FBUztNQUFFLGFBQWEsR0FBSSxDQUFDLENBQWxCLGFBQWE7O0FBQ3JFLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLEtBQUssS0FBSyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUM7QUFDL0QsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUM7QUFDN0MsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxhQUFhLENBQUM7QUFDdkMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztBQUNqQyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQzlDLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzNDLE1BQU0sS0FBSyxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDMUMsTUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3JCLE1BQUksR0FBRyxZQUFBLENBQUM7QUFDUixNQUFJLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDcEIsTUFBSSxTQUFTLFlBQUEsQ0FBQztBQUNkLE1BQUksU0FBUyxZQUFBLENBQUM7QUFDZCxNQUFJLFFBQVEsWUFBQSxDQUFDO0FBQ2IsTUFBSSxXQUFXLFlBQUEsQ0FBQztBQUNoQixNQUFJLFlBQVksWUFBQSxDQUFDO0FBQ2pCLE1BQUksVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUNwQixNQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQztBQUN2QyxNQUFNLGdCQUFnQixHQUFHLHdCQUFTLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQzs7QUFFekQsTUFBSSxDQUFDLENBQUMsY0FBYyxLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQUUsS0FBQyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7R0FBRTtBQUM3RCxNQUFJLENBQUMsQ0FBQyxlQUFlLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFBRSxLQUFDLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztHQUFFO0FBQy9ELE1BQUksQ0FBQyxDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQUUsS0FBQyxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDO0dBQUU7QUFDbkYsTUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFO0FBQ1osZUFBVyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsZ0JBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0dBQzNDOztBQUVELE1BQU0sR0FBRyxHQUFHO0FBQ1YsT0FBRyxFQUFILEdBQUc7QUFDSCxVQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU07QUFDaEIsU0FBSyxFQUFMLEtBQUs7QUFDTCxRQUFJLEVBQUosSUFBSTtBQUNKLFFBQUksRUFBSixJQUFJO0FBQ0osVUFBTSxFQUFOLE1BQU07QUFDTixXQUFPLEVBQVAsT0FBTztBQUNQLG1CQUFlLEVBQWYsZUFBZTtBQUNmLGNBQVUsRUFBVixVQUFVO0FBQ1YsY0FBVSxFQUFWLFVBQVU7QUFDVixzQkFBa0IsRUFBbEIsa0JBQWtCO0FBQ2xCLHNCQUFrQixFQUFsQixrQkFBa0I7QUFDbEIscUJBQWlCLEVBQUUsVUFBVTtBQUM3QixpQkFBYSxFQUFiLGFBQWE7QUFDYixtQkFBZSxFQUFmLGVBQWU7QUFDZixpQkFBYSxFQUFiLGFBQWE7QUFDYixZQUFRLEVBQVIsUUFBUTtBQUNSLGNBQVUsRUFBVixVQUFVO0FBQ1YsZUFBVyxFQUFFLEVBQUU7R0FDaEIsQ0FBQzs7QUFFRixVQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDYixXQUFTLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLE1BQUksU0FBUyxJQUFJLGFBQWEsRUFBRTtBQUM5QixhQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0FBQzdDLFFBQUksQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDL0IsYUFBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztHQUNsQztBQUNELFFBQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDOUIsSUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7O0FBRXZDLE1BQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRTtBQUM5QixVQUFNLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQzVCOztBQUVELFNBQU8sR0FBRyxDQUFDOztBQUVYLFdBQVMsUUFBUSxDQUFFLEVBQUUsRUFBRTtBQUNyQixlQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEIsY0FBVSxHQUFHLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ2pDLGFBQVMsR0FBRyxVQUFVLENBQUMsT0FBTyxLQUFLLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxLQUFLLFVBQVUsQ0FBQztBQUNoRixZQUFRLEdBQUcsU0FBUyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMvQyxlQUFXLEVBQUUsQ0FBQztHQUNmOztBQUVELFdBQVMsZUFBZSxHQUFJO0FBQzFCLFFBQUksR0FBRyxFQUFFO0FBQUUsU0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQUU7R0FDNUI7O0FBRUQsV0FBUyxPQUFPLENBQUUsU0FBUyxFQUFFO0FBQzNCLFFBQUksT0FBTyxXQUFXLEtBQUssVUFBVSxFQUFFO0FBQ3JDLDBCQUFVLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQy9DLFVBQU0sS0FBSyxHQUFHLFNBQVMsRUFBRSxDQUFDO0FBQzFCLFVBQUksS0FBSyxLQUFLLEtBQUssQ0FBQyxLQUFLLEVBQUU7O0FBQ3pCLGVBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNoQixlQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQzs7QUFFcEIsY0FBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztBQUM5QixxQkFBVyxDQUFDLEVBQUUsS0FBSyxFQUFMLEtBQUssRUFBRSxLQUFLLEVBQUwsS0FBSyxFQUFFLEVBQUUsVUFBVSxDQUFDLEVBQUU7QUFDekMsZ0JBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUU7QUFDN0Isb0JBQU0sQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7YUFDdEI7V0FDRixDQUFDLENBQUM7O09BQ0o7S0FDRjtHQUNGOztBQUVELFdBQVMsTUFBTSxDQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUU7QUFDdkMsU0FBSyxFQUFFLENBQUM7QUFDUixPQUFHLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUNyQixlQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLFFBQUksU0FBUyxFQUFFO0FBQ2IsVUFBSSxFQUFFLENBQUM7S0FDUjtBQUNELGFBQVMsRUFBRSxDQUFDO0dBQ2I7O0FBRUQsV0FBUyxLQUFLLEdBQUk7QUFDaEIsWUFBUSxFQUFFLENBQUM7QUFDWCxXQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUU7QUFDbkIsUUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDOUI7R0FDRjs7QUFFRCxXQUFTLFNBQVMsR0FBSTtBQUNwQixXQUFPLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQSxDQUFFLElBQUksRUFBRSxDQUFDO0dBQ3JEOztBQUVELFdBQVMsR0FBRyxDQUFFLFVBQVUsRUFBRTtBQUN4QixRQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2pDLFVBQU0sQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDdkIseUJBQXFCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDMUIsd0JBQVUsR0FBRyxDQUFDLEVBQUUsRUFBRSxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDakQsd0JBQVUsR0FBRyxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUM5Qyx3QkFBVSxHQUFHLENBQUMsRUFBRSxFQUFFLHFCQUFxQixFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3JELHdCQUFVLEdBQUcsQ0FBQyxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQsTUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNuQixPQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNqQyxXQUFPLEVBQUUsQ0FBQzs7QUFFVixhQUFTLGVBQWUsR0FBSTtBQUMxQixZQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDcEI7O0FBRUQsYUFBUyxpQkFBaUIsR0FBSTtBQUM1QixVQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsU0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2hCLFVBQUksRUFBRSxDQUFDO0FBQ1AsZ0JBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUNuQixnQkFBVSxHQUFHLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUN4RSxVQUFJLFVBQVUsRUFBRTtBQUNkLFVBQUUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDO0FBQ3RCLFVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNaLFlBQUksRUFBRSxDQUFDO0FBQ1AsaUJBQVMsRUFBRSxDQUFDO09BQ2I7S0FDRjs7QUFFRCxhQUFTLFVBQVUsR0FBSTtBQUNyQixVQUFNLEtBQUssR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUMxQixVQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLEVBQUU7QUFDN0IsVUFBRSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLENBQUM7T0FDdkQsTUFBTTtBQUNMLDRCQUFVLFNBQVMsQ0FBQyxFQUFFLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztPQUM5QztLQUNGOztBQUVELGFBQVMsUUFBUSxHQUFJO0FBQ25CLFVBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDZixVQUFFLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQztBQUM1QixZQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7QUFDcEIsa0JBQVEsRUFBRSxDQUFDO1NBQ1o7T0FDRjtLQUNGO0dBQ0Y7O0FBRUQsV0FBUyxxQkFBcUIsQ0FBRSxFQUFFLEVBQUU7QUFDbEMsbUJBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxFQUFFLEVBQUk7QUFDaEMsVUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQztBQUNoQyxVQUFNLElBQUksR0FBRyxFQUFFLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDO0FBQ2xELFVBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDckIsZUFBTztPQUNSOzs7Ozs7QUFDRCw2QkFBaUIsSUFBSSw4SEFBRTtjQUFkLElBQUk7O0FBQ1gsZ0JBQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ3hDOzs7Ozs7Ozs7Ozs7Ozs7O0FBQ0QsWUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN2QixlQUFTLE9BQU8sQ0FBRSxJQUFJLEVBQUU7QUFDdEIsWUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN2QyxZQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztBQUM1QixZQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3pDLGVBQU8sSUFBSSxDQUFDO09BQ2I7S0FDRixDQUFDLENBQUM7R0FDSjs7QUFFRCxXQUFTLFNBQVMsQ0FBRSxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQzlCLFFBQU0sS0FBSyxnQ0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLEVBQUMsQ0FBQzs7Ozs7OztBQUVwRCw0QkFBa0IsTUFBTSxtSUFBRTtZQUFqQixLQUFLOztBQUNaLGVBQU8sS0FBSyxDQUFDLE1BQU0sRUFBRTtBQUNuQixjQUFJLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDekIsY0FBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDO0FBQ2xELGNBQUksUUFBUSxLQUFLLEtBQUssRUFBRTtBQUN0QixjQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDVCxrQkFBTTtXQUNQLE1BQU07QUFDTCxlQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7V0FDWDtTQUNGO09BQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDRCxXQUFPLEtBQUssQ0FBQyxNQUFNLEVBQUU7QUFDbkIsU0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0tBQ3BCOztBQUVELGFBQVMsRUFBRSxDQUFFLEVBQUUsRUFBRTtBQUNmLFFBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7S0FDeEM7QUFDRCxhQUFTLEdBQUcsQ0FBRSxFQUFFLEVBQUU7QUFDaEIsUUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQztLQUMzQztHQUNGOztBQUVELFdBQVMsZUFBZSxDQUFFLEVBQUUsRUFBRTtBQUM1QixRQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDakIsUUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNoRixRQUFJLElBQUksWUFBQSxDQUFDO0FBQ1QsV0FBTyxJQUFJLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFO0FBQy9CLFdBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDbEI7QUFDRCxXQUFPLEtBQUssQ0FBQztHQUNkOztBQUVELFdBQVMsR0FBRyxDQUFFLEtBQUssRUFBRTtBQUNuQixRQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUU7QUFDWixhQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFBLENBQUUsS0FBSyxDQUFDLENBQUM7S0FDNUQ7QUFDRCxXQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7R0FDaEI7O0FBRUQsV0FBUyxNQUFNLENBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRTtBQUNsQyxRQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUU7QUFDWixVQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLENBQUMsa0JBQWtCLENBQUEsQ0FBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDM0YsYUFBTyxFQUFFLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEtBQUssQ0FBQztLQUN6RDtBQUNELFdBQU8sVUFBVSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztHQUN0Qzs7QUFFRCxXQUFTLE1BQU0sR0FBSTtBQUFFLFdBQU8sT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0dBQUU7QUFDbEQsV0FBUyxPQUFPLEdBQUk7QUFBRSxXQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0dBQUU7QUFDOUUsV0FBUyxNQUFNLENBQUUsRUFBRSxFQUFFO0FBQUUsV0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztHQUFFOztBQUV4RSxXQUFTLElBQUksR0FBSTtBQUNmLFFBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtBQUNkLGVBQVMsQ0FBQyxTQUFTLElBQUksV0FBVyxDQUFDO0FBQ25DLFNBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNkLDBCQUFVLFNBQVMsQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztLQUN0RDtHQUNGOztBQUVELFdBQVMsT0FBTyxDQUFFLENBQUMsRUFBRTtBQUNuQixRQUFNLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ3ZELFFBQUksSUFBSSxLQUFLLEtBQUssRUFBRTtBQUNsQjtBQUFPLEtBQ1I7QUFDRCxVQUFNLEVBQUUsQ0FBQztHQUNWOztBQUVELFdBQVMsTUFBTSxHQUFJO0FBQ2pCLFFBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtBQUNkLFVBQUksRUFBRSxDQUFDO0tBQ1IsTUFBTTtBQUNMLFVBQUksRUFBRSxDQUFDO0tBQ1I7R0FDRjs7QUFFRCxXQUFTLE1BQU0sQ0FBRSxVQUFVLEVBQUU7QUFDM0IsWUFBUSxFQUFFLENBQUM7QUFDWCxRQUFJLFVBQVUsRUFBRTtBQUNkLGVBQVMsR0FBRyxVQUFVLENBQUM7QUFDdkIsZUFBUyxDQUFDLFNBQVMsSUFBSSxlQUFlLENBQUM7S0FDeEM7R0FDRjs7QUFFRCxXQUFTLFFBQVEsR0FBSTtBQUNuQixRQUFJLFNBQVMsRUFBRTtBQUNiLGVBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDeEUsZUFBUyxHQUFHLElBQUksQ0FBQztLQUNsQjtHQUNGOztBQUVELFdBQVMsSUFBSSxDQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDeEIsUUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFDakMsUUFBSSxLQUFLLEdBQUcsS0FBSyxFQUFFO0FBQ2pCLGNBQVEsRUFBRSxDQUFDO0FBQ1gsYUFBTztLQUNSO0FBQ0QsUUFBSSxLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQ2YsYUFBTztLQUNSO0FBQ0QsUUFBTSxLQUFLLEdBQUcsRUFBRSxHQUFHLFdBQVcsR0FBRyxZQUFZLENBQUM7QUFDOUMsUUFBTSxJQUFJLEdBQUcsRUFBRSxHQUFHLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztBQUNwRCxRQUFNLFVBQVUsR0FBRyxTQUFTLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQzs7QUFFN0QsVUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDOztBQUVuQixRQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUN0QixVQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssR0FBRyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ2pDO0dBQ0Y7O0FBRUQsV0FBUyxJQUFJLEdBQUk7QUFDZixPQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDWixhQUFTLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNwRSxZQUFRLEVBQUUsQ0FBQztBQUNYLHdCQUFVLFNBQVMsQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztBQUNyRCxRQUFJLEVBQUUsQ0FBQyxLQUFLLEtBQUssVUFBVSxFQUFFO0FBQzNCLFFBQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0tBQ2Y7R0FDRjs7QUFFRCxXQUFTLE9BQU8sQ0FBRSxDQUFDLEVBQUU7QUFDbkIsUUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFDeEIsUUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ25DLFFBQUksS0FBSyxLQUFLLFFBQVEsRUFBRTtBQUN0QixVQUFJLFFBQVEsSUFBSSxDQUFDLENBQUMsZ0JBQWdCLEVBQUU7QUFDbEMsWUFBSSxFQUFFLENBQUM7T0FDUjtBQUNELFVBQUksS0FBSyxFQUFFO0FBQ1QsWUFBSSxFQUFFLENBQUM7QUFDUCxZQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDVDtLQUNGLE1BQU0sSUFBSSxLQUFLLEtBQUssTUFBTSxFQUFFO0FBQzNCLFVBQUksUUFBUSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRTtBQUNsQyxZQUFJLEVBQUUsQ0FBQztPQUNSO0FBQ0QsVUFBSSxLQUFLLEVBQUU7QUFDVCxZQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDWCxZQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDVDtLQUNGLE1BQU0sSUFBSSxLQUFLLEtBQUssYUFBYSxFQUFFO0FBQ2xDLFVBQUksUUFBUSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRTtBQUNsQyxZQUFJLEVBQUUsQ0FBQztPQUNSO0tBQ0YsTUFBTSxJQUFJLEtBQUssRUFBRTtBQUNoQixVQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7QUFDdkIsWUFBSSxTQUFTLEVBQUU7QUFDYiw4QkFBVSxTQUFTLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ3pDLE1BQU07QUFDTCxjQUFJLEVBQUUsQ0FBQztTQUNSO0FBQ0QsWUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ1QsTUFBTSxJQUFJLEtBQUssS0FBSyxPQUFPLEVBQUU7QUFDNUIsWUFBSSxFQUFFLENBQUM7QUFDUCxZQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDVDtLQUNGO0dBQ0Y7O0FBRUQsV0FBUyxJQUFJLENBQUUsQ0FBQyxFQUFFO0FBQ2hCLEtBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUNwQixLQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7R0FDcEI7O0FBRUQsV0FBUyxTQUFTLEdBQUk7QUFDcEIsUUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFO0FBQ2QsYUFBTztLQUNSO0FBQ0Qsb0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkIsd0JBQVUsU0FBUyxDQUFDLFVBQVUsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3ZELFFBQU0sS0FBSyxHQUFHLFNBQVMsRUFBRSxDQUFDO0FBQzFCLFFBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUM7QUFDdkIsUUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsV0FBTyxFQUFFLEVBQUU7QUFDVCxVQUFJLEtBQUssSUFBSSxLQUFLLEVBQUU7QUFDbEIsNEJBQVUsU0FBUyxDQUFDLEVBQUUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO09BQzlDLE1BQU07QUFDTCw0QkFBVSxTQUFTLENBQUMsRUFBRSxFQUFFLHFCQUFxQixDQUFDLENBQUM7QUFDL0MsWUFBSSxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUMzQyxlQUFLLEVBQUUsQ0FBQztBQUNSLG1CQUFTLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3RCO09BQ0Y7QUFDRCxRQUFFLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQztLQUNyQjtBQUNELFFBQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLFFBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxPQUFPLEVBQUU7QUFDMUIsZUFBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDeEMsTUFBTTtBQUNMLGVBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3JDO0FBQ0QsUUFBSSxDQUFDLFNBQVMsRUFBRTtBQUNkLFVBQUksRUFBRSxDQUFDO0tBQ1I7QUFDRCxRQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQzFCLFVBQUksRUFBRSxDQUFDO0tBQ1I7R0FDRjs7QUFFRCxXQUFTLHdCQUF3QixDQUFFLENBQUMsRUFBRTtBQUNwQyxRQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbkMsUUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO0FBQ3ZCLGFBQU87S0FDUjtBQUNELHFCQUFpQixFQUFFLENBQUM7R0FDckI7O0FBRUQsV0FBUyxZQUFZLENBQUUsQ0FBQyxFQUFFO0FBQ3hCLFFBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUNuQyxRQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLE9BQU8sRUFBRTtBQUM1QyxhQUFPO0tBQ1I7QUFDRCxjQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0dBQ3JCOztBQUVELFdBQVMsdUJBQXVCLENBQUUsQ0FBQyxFQUFFO0FBQ25DLFFBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDdEIsUUFBSSxNQUFNLEtBQUssVUFBVSxFQUFFO0FBQ3pCLGFBQU8sSUFBSSxDQUFDO0tBQ2I7QUFDRCxXQUFPLE1BQU0sRUFBRTtBQUNiLFVBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUssVUFBVSxFQUFFO0FBQ2pELGVBQU8sSUFBSSxDQUFDO09BQ2I7QUFDRCxZQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztLQUM1QjtHQUNGOztBQUVELFdBQVMsVUFBVSxDQUFFLENBQUMsRUFBRTtBQUN0QixRQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDbkMsUUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFO0FBQ3JCLFVBQUksRUFBRSxDQUFDO0tBQ1I7R0FDRjs7QUFFRCxXQUFTLFdBQVcsQ0FBRSxDQUFDLEVBQUU7QUFDdkIsUUFBSSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUM5QixhQUFPO0tBQ1I7QUFDRCxRQUFJLEVBQUUsQ0FBQztHQUNSOztBQUVELFdBQVMsV0FBVyxDQUFFLE1BQU0sRUFBRTtBQUM1QixRQUFNLEVBQUUsR0FBRyxNQUFNLEdBQUcsUUFBUSxHQUFHLEtBQUssQ0FBQztBQUNyQyxRQUFJLEdBQUcsRUFBRTtBQUNQLFNBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNkLFNBQUcsR0FBRyxJQUFJLENBQUM7S0FDWjtBQUNELFFBQUksQ0FBQyxNQUFNLEVBQUU7QUFDWCxTQUFHLEdBQUcsd0JBQVMsU0FBUyxFQUFFLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLElBQUksVUFBVSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzdGLFVBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtBQUFFLFdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztPQUFFO0tBQ2pDO0FBQ0QsUUFBSSxNQUFNLElBQUssUUFBUSxJQUFJLEdBQUcsQ0FBQyxhQUFhLEtBQUssVUFBVSxBQUFDLEVBQUU7QUFDNUQsMEJBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztLQUM3QyxNQUFNO0FBQ0wsYUFBTyxFQUFFLENBQUM7S0FDWDtBQUNELFFBQUksUUFBUSxFQUFFO0FBQ1osMEJBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNwRCwwQkFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDekQsMEJBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO0FBQy9ELDBCQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUN0RCwwQkFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLFVBQUksQ0FBQyxDQUFDLGNBQWMsRUFBRTtBQUFFLDRCQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7T0FBRTtLQUM1RSxNQUFNO0FBQ0wsMEJBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM1QywwQkFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQy9DO0FBQ0QsUUFBSSxDQUFDLENBQUMsZUFBZSxFQUFFO0FBQUUsMEJBQVUsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztLQUFFO0FBQ3BFLFFBQUksSUFBSSxFQUFFO0FBQUUsMEJBQVUsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUFFO0dBQ25EOztBQUVELFdBQVMsT0FBTyxHQUFJO0FBQ2xCLGVBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQixRQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUU7QUFBRSxZQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQUU7R0FDbkU7O0FBRUQsV0FBUyxhQUFhLENBQUUsS0FBSyxFQUFFO0FBQzdCLFFBQUksU0FBUyxFQUFFO0FBQ2IsUUFBRSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7S0FDbEIsTUFBTTtBQUNMLFFBQUUsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0tBQ3RCO0dBQ0Y7O0FBRUQsV0FBUyxlQUFlLENBQUUsRUFBRSxFQUFFLFVBQVUsRUFBRTtBQUN4QyxRQUFJLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0dBQy9COztBQUVELFdBQVMsYUFBYSxDQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7QUFDckMsUUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQy9CLFFBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDdkMsUUFBSSwyQkFBWSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUU7QUFDM0MsYUFBTyxJQUFJLENBQUM7S0FDYjtBQUNELFFBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDekMsUUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7QUFDN0IsYUFBTyxLQUFLLENBQUM7S0FDZDtBQUNELFdBQU8sMkJBQVksTUFBTSxFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0dBQ2pEOztBQUVELFdBQVMsZ0JBQWdCLENBQUUsSUFBSSxFQUFFLENBQUMsRUFBRTtBQUNsQyxRQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDaEIsUUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO0FBQ3JCLFFBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDcEIsV0FBTyxRQUFRLEtBQUssS0FBSyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDdkMsWUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNyRCxjQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNwQyxXQUFLLEVBQUUsQ0FBQztLQUNUO0FBQ0QsV0FBTztBQUNMLFVBQUksRUFBRSxRQUFRLEdBQUcsTUFBTSxHQUFHLElBQUk7QUFDOUIsV0FBSyxFQUFMLEtBQUs7S0FDTixDQUFDO0dBQ0g7O0FBRUQsV0FBUyxrQkFBa0IsQ0FBRSxDQUFDLEVBQUUsVUFBVSxFQUFFO0FBQzFDLFFBQU0sUUFBUSxHQUFHLG9CQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLFFBQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDakQsUUFBSSxLQUFLLEVBQUU7QUFDVCxhQUFPLEVBQUUsS0FBSyxFQUFMLEtBQUssRUFBRSxVQUFVLEVBQVYsVUFBVSxFQUFFLENBQUM7S0FDOUI7R0FDRjs7QUFFRCxXQUFTLFVBQVUsQ0FBRSxLQUFLLEVBQUU7QUFDMUIsUUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQztBQUN6QixRQUFNLFFBQVEsR0FBRyxvQkFBSyxFQUFFLENBQUMsQ0FBQztBQUMxQixRQUFNLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDbEQsUUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVDLFFBQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUEsQUFBQyxDQUFDLENBQUM7QUFDaEcsUUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxHQUFHLENBQUM7O0FBRWxDLE1BQUUsQ0FBQyxLQUFLLEdBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQztBQUMxQix3QkFBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7R0FDeEQ7O0FBRUQsV0FBUyxrQkFBa0IsR0FBSTtBQUM3QixVQUFNLElBQUksS0FBSyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7R0FDM0U7O0FBRUQsV0FBUyxVQUFVLEdBQUk7QUFDckIsVUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO0dBQzNFO0NBQ0Y7O0FBRUQsU0FBUyxPQUFPLENBQUUsRUFBRSxFQUFFO0FBQUUsU0FBTyxFQUFFLENBQUMsT0FBTyxLQUFLLE9BQU8sSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLFVBQVUsQ0FBQztDQUFFOztBQUVyRixTQUFTLEdBQUcsQ0FBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0FBQzdCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkMsSUFBRSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDekIsU0FBTyxFQUFFLENBQUM7Q0FDWDs7QUFFRCxTQUFTLEtBQUssQ0FBRSxFQUFFLEVBQUU7QUFBRSxTQUFPLFlBQVk7QUFBRSxjQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0dBQUUsQ0FBQztDQUFFO0FBQ2xFLFNBQVMsSUFBSSxDQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFBRSxJQUFFLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO0NBQUU7O0FBRXBFLFNBQVMsVUFBVSxDQUFFLEVBQUUsRUFBRTtBQUN2QixNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDakQsTUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFO0FBQ3JCLFdBQU8sS0FBSyxDQUFDO0dBQ2Q7QUFDRCxNQUFJLEtBQUssS0FBSyxNQUFNLEVBQUU7QUFDcEIsV0FBTyxJQUFJLENBQUM7R0FDYjtBQUNELE1BQUksRUFBRSxDQUFDLGFBQWEsRUFBRTtBQUNwQixXQUFPLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7R0FDckM7QUFDRCxTQUFPLEtBQUssQ0FBQztDQUNkOzs7QUNua0JELFlBQVksQ0FBQzs7Ozs7a0JBc0JXLE9BQU87Ozs7Ozs7Ozs7Ozs7Ozs7QUFqQi9CLElBQU0sS0FBSyxHQUFHLENBQ1osWUFBWSxFQUNaLFVBQVUsRUFDVixZQUFZLEVBQ1osV0FBVyxFQUNYLGVBQWUsRUFDZixlQUFlLEVBQ2YsYUFBYSxFQUNiLFlBQVksRUFDWixpQkFBaUIsRUFDakIsY0FBYyxFQUNkLFdBQVcsRUFDWCxTQUFTLEVBQ1QsUUFBUSxDQUNULENBQUM7QUFDRixJQUFNLE1BQU0sR0FBRyxFQUFFLENBQUM7O0FBRUgsU0FBUyxPQUFPLENBQUUsRUFBRSxFQUFFO0FBQ25DLE1BQU0sTUFBTSxHQUFHLG1CQUFJLE1BQU0sQ0FBQyxDQUFDOztBQUUzQixVQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNsQyxPQUFLLEVBQUUsQ0FBQztBQUNSLE1BQUksRUFBRSxDQUFDOztBQUVQLFNBQU8sRUFBRSxLQUFLLEVBQUwsS0FBSyxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsT0FBTyxFQUFQLE9BQU8sRUFBRSxDQUFDOztBQUVuQyxXQUFTLEtBQUssR0FBSTtBQUNoQixRQUFNLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUNyQixRQUFJLEtBQUssWUFBQSxDQUFDO0FBQ1YsU0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsV0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixVQUFJLEtBQUssS0FBSyxLQUFLLENBQUMsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFOztBQUN0QyxjQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztPQUNoQztLQUNGO0FBQ0QsVUFBTSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7QUFDN0IsVUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQ2hDLFVBQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztBQUNuQyxVQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7R0FDbEQ7O0FBRUQsV0FBUyxPQUFPLEdBQUk7QUFDbEIsUUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQztBQUN2QixRQUFJLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxFQUFFO0FBQzFCLGFBQU87S0FDUjs7QUFFRCx3QkFBSyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7O0FBRXBCLFFBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDOztBQUUxQyxNQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDO0dBQy9COztBQUVELFdBQVMsSUFBSSxDQUFFLE1BQU0sRUFBRTtBQUNyQixRQUFNLEVBQUUsR0FBRyxNQUFNLEdBQUcsUUFBUSxHQUFHLEtBQUssQ0FBQztBQUNyQyx3QkFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3RDLHdCQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDcEMsd0JBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNwQyx3QkFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3BDLHdCQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7R0FDdEM7O0FBRUQsV0FBUyxPQUFPLEdBQUk7QUFDbEIsUUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ1gsVUFBTSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsTUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0dBQ3JCOztBQUVELFdBQVMsUUFBUSxHQUFJO0FBQ25CLFFBQUksTUFBTSxDQUFDLGdCQUFnQixFQUFFO0FBQzNCLGFBQU8sTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ3BDO0FBQ0QsV0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO0dBQ3hCO0NBQ0YsQ0FBQzs7O0FDaEZGLFlBQVksQ0FBQzs7Ozs7a0JBRVcsR0FBRztBQUFaLFNBQVMsR0FBRyxDQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7QUFDN0MsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMzQyxNQUFJLE9BQU8sRUFBRTtBQUNYLE1BQUUsQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO0dBQ3hCO0FBQ0QsU0FBTyxFQUFFLENBQUM7Q0FDWCxDQUFDOzs7QUNSRixZQUFZLENBQUM7Ozs7O2tCQTBGVyxTQUFTO0FBeEZqQyxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUM7QUFDbEIsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDO0FBQ2xCLElBQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUMxQixJQUFNLFdBQVcsR0FBRyxXQUFXLENBQUM7O0FBRWhDLElBQUksUUFBUSxDQUFDLFNBQVMsSUFBSSxRQUFRLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRTtBQUN4RCxLQUFHLEdBQUcsT0FBTyxDQUFDO0FBQ2QsS0FBRyxHQUFHLE9BQU8sQ0FBQztDQUNmOztBQUVELFNBQVMsT0FBTyxDQUFFLEVBQUUsRUFBRTtBQUNwQixTQUFPO0FBQ0wsU0FBSyxFQUFFLEVBQUUsQ0FBQyxjQUFjO0FBQ3hCLE9BQUcsRUFBRSxFQUFFLENBQUMsWUFBWTtHQUNyQixDQUFDO0NBQ0g7O0FBRUQsU0FBUyxPQUFPLENBQUUsRUFBRSxFQUFFO0FBQ3BCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUM7QUFDdEMsTUFBSSxNQUFNLEtBQUssRUFBRSxFQUFFO0FBQ2pCLE1BQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztHQUNaOztBQUVELE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDL0MsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQ3JDLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUM7QUFDMUIsTUFBTSxNQUFNLEdBQUcsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3pDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQztBQUNyQyxNQUFJLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDdEMsV0FBTyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0dBQ3JCO0FBQ0QsT0FBSyxDQUFDLElBQUksR0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxNQUFNLENBQUM7O0FBRTFDLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUM7O0FBRTFCLElBQUUsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO0FBQ3BCLE9BQUssQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0IsT0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDOztBQUVmLFNBQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7O0FBRXRGLFdBQVMsTUFBTSxDQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDM0IsUUFBSSxNQUFNLEtBQUssRUFBRSxFQUFFOztBQUNqQixVQUFJLE1BQU0sRUFBRTtBQUNWLGNBQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztPQUNoQixNQUFNO0FBQ0wsVUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO09BQ1g7S0FDRjtBQUNELFdBQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztHQUNuQztDQUNGOztBQUVELFNBQVMsZUFBZSxDQUFFLFFBQVEsRUFBRTtBQUNsQyxNQUFJLE1BQU0sWUFBQSxDQUFDO0FBQ1gsS0FBRztBQUNELFVBQU0sR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7R0FDbkQsUUFBUSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQzFDLFNBQU8sTUFBTSxDQUFDO0NBQ2Y7O0FBRUQsU0FBUyxNQUFNLENBQUUsRUFBRSxFQUFFO0FBQ25CLFNBQVEsQUFBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFBSyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBRTtDQUM1Rjs7QUFFRCxTQUFTLE9BQU8sQ0FBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZCLElBQUUsQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekMsSUFBRSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUN0Qzs7QUFFRCxTQUFTLE9BQU8sQ0FBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZCLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQzs7QUFFbkMsTUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLEtBQUssRUFBRTtBQUN4QyxTQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLFNBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNoQixNQUFNO0FBQ0wsU0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQixTQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEMsU0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RDLFNBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNoQjtDQUNGOztBQUVELFNBQVMsT0FBTyxDQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDM0IsU0FBTyxLQUFLLEtBQUssS0FBSyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUM7Q0FDdkQ7O0FBRWMsU0FBUyxTQUFTLENBQUUsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN4QyxNQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLE9BQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7R0FDWjtBQUNELFNBQU8sR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQ2hCOzs7QUMvRkQsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVViLElBQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQztBQUM1QixJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDbEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLElBQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUNmLElBQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNoQixJQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsSUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ2pCLElBQU0sWUFBWSxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2pDLElBQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQztBQUMvQixJQUFNLGVBQWUsR0FBRyxvQkFBb0IsQ0FBQztBQUM3QyxJQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQztBQUN0QyxJQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztBQUNwQyxJQUFNLEdBQUcsR0FBRyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQ3pDLElBQU0sZ0JBQWdCLEdBQUcsR0FBRzs7O0FBQUMsQUFHN0IsTUFBTSxDQUFDLE9BQU8sR0FBRyxTQUFTLEtBQUssQ0FBRSxFQUFFLEVBQUUsT0FBTyxFQUFFO0FBQzVDLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN6QixNQUFNLENBQUMsR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO0FBQ3hCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxTQUFTLElBQUksZ0JBQWdCLENBQUM7QUFDbEQsTUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMxQixVQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7R0FDdkU7QUFDRCxNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUIsTUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUNyQyxVQUFNLElBQUksS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7R0FDekU7QUFDRCxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQztBQUM5QixNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLGVBQWUsQ0FBQztBQUMvQyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLGVBQWUsQ0FBQztBQUM1QyxNQUFNLGFBQWEsR0FBRyxDQUFDLENBQUMsYUFBYSxLQUFLLEtBQUssQ0FBQzs7QUFFL0MsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLENBQUM7O0FBRXJDLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDOUIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNoQyxNQUFNLE9BQU8sR0FDWCxPQUFPLFNBQVMsS0FBSyxRQUFRLEdBQUcsVUFBQSxDQUFDO1dBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQztHQUFBLEdBQ2pELE9BQU8sU0FBUyxLQUFLLFVBQVUsR0FBRyxTQUFTLEdBQzNDLFVBQUEsQ0FBQztXQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUU7R0FBQSxBQUNsQixDQUFDO0FBQ0YsTUFBTSxRQUFRLEdBQ1osT0FBTyxVQUFVLEtBQUssUUFBUSxHQUFHLFVBQUEsQ0FBQztXQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7R0FBQSxHQUNuRCxPQUFPLFVBQVUsS0FBSyxVQUFVLEdBQUcsVUFBVSxHQUM3QyxVQUFBLENBQUM7V0FBSSxDQUFDO0dBQUEsQUFDUCxDQUFDOztBQUVGLE1BQU0sTUFBTSxHQUFHLG1CQUFJLE1BQU0sRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sS0FBSyxHQUFHLG1CQUFJLE1BQU0sRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3JELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUM7QUFDaEMsSUFBRSxDQUFDLFNBQVMsSUFBSSxZQUFZLENBQUM7QUFDN0IsUUFBTSxDQUFDLFNBQVMsSUFBSSxhQUFhLENBQUM7QUFDbEMsUUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDaEMsUUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDOztBQUUzQyxNQUFNLFFBQVEsR0FBRyx3QkFBUyxFQUFFLENBQUMsQ0FBQztBQUM5QixNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsWUFBWSxHQUFHLGtCQUFrQixFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQy9ELE1BQU0sR0FBRyxHQUFHLHVCQUFRO0FBQ2xCLFdBQU8sRUFBUCxPQUFPO0FBQ1AsWUFBUSxFQUFFLGtCQUFBLElBQUk7YUFBSSxTQUFRLENBQUMsSUFBSSxDQUFDO0tBQUE7QUFDaEMscUJBQWlCLEVBQUUsMkJBQUEsRUFBRTthQUFJLFNBQVEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDO0tBQUE7QUFDM0MsY0FBVSxFQUFFLGdCQUFnQjtBQUM1Qix1QkFBbUIsRUFBbkIsbUJBQW1CO0FBQ25CLFNBQUssRUFBRSxTQUFTO0FBQ2hCLFdBQU8sRUFBUCxPQUFPO0dBQ1IsQ0FBQyxDQUFDOztBQUVILE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbkQsTUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDOztBQUVyQixNQUFJLEVBQUUsQ0FBQzs7QUFFUCxHQUFDLFFBQVEsQ0FBQyxhQUFhLEtBQUssRUFBRSxHQUM1QixjQUFjLEdBQ2QsZ0JBQWdCLENBQUEsQ0FDaEIsQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzs7QUFFckIsU0FBTyxHQUFHLENBQUM7O0FBRVgsV0FBUyxTQUFRLENBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtBQUM5QixTQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM3QyxVQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxFQUFFO0FBQzlDLGVBQU8sYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQ3pCO0tBQ0Y7QUFDRCxXQUFPLElBQUksQ0FBQztHQUNiOztBQUVELFdBQVMsT0FBTyxDQUFFLElBQUksRUFBRTtBQUN0QixRQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsUUFBTSxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLEtBQUssRUFBTCxLQUFLLEVBQUUsQ0FBQztBQUM3QixRQUFJLENBQUMsQ0FBQyxjQUFjLEVBQUU7QUFDcEIsYUFBTyxHQUFHLENBQUM7S0FDWjtBQUNELFFBQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QixRQUFJLENBQUMsRUFBRSxFQUFFO0FBQ1AsYUFBTyxHQUFHLENBQUM7S0FDWjtBQUNELFFBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ2IsaUJBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDekIsT0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzFCLGNBQVUsRUFBRSxDQUFDO0FBQ2IsV0FBTyxHQUFHLENBQUM7R0FDWjs7QUFFRCxXQUFTLFVBQVUsQ0FBRSxJQUFJLEVBQUU7QUFDekIsUUFBSSxDQUFDLElBQUksRUFBRTtBQUNULGFBQU8sR0FBRyxDQUFDO0tBQ1o7QUFDRCxxQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDM0IsaUJBQWEsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNyRCxPQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDOUIsY0FBVSxFQUFFLENBQUM7QUFDYixXQUFPLEdBQUcsQ0FBQztHQUNaOztBQUVELFdBQVMsVUFBVSxHQUFJO0FBQ3JCLGlCQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQUMsQ0FBQyxFQUFDLENBQUMsRUFBSztBQUNyQyxtQkFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7O0FBRTNCLFVBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0IsVUFBSSxLQUFLLEVBQUU7QUFDVCxTQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDaEMsU0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO09BQ3RDLE1BQU07QUFDTCxTQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbEMsU0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ25DLFdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO09BQ25DO0FBQ0QsT0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7O0FBRWhCLG1CQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDL0IsQ0FBQyxDQUFDO0dBQ0o7O0FBRUQsV0FBUyxnQkFBZ0IsQ0FBRSxJQUFJLEVBQUU7QUFDL0IsV0FBTyxVQUFVLENBQUMsU0FBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7R0FDbkM7O0FBRUQsV0FBUyxtQkFBbUIsQ0FBRSxFQUFFLEVBQUU7QUFDaEMsV0FBTyxVQUFVLENBQUMsU0FBUSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0dBQ3ZDOztBQUVELFdBQVMsVUFBVSxDQUFFLElBQUksRUFBRTtBQUN6QixXQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7R0FDaEM7O0FBRUQsV0FBUyxpQkFBaUIsQ0FBRSxFQUFFLEVBQUU7QUFDOUIsUUFBSSxFQUFFLENBQUMsYUFBYSxFQUFFO0FBQ3BCLFFBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0tBQ2xDO0dBQ0Y7O0FBRUQsV0FBUyxTQUFTLENBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtRQUN6QixJQUFJLEdBQUksSUFBSSxDQUFaLElBQUk7O0FBQ1gsUUFBTSxLQUFLLEdBQUcsT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO0FBQ25FLFFBQUksS0FBSyxFQUFFO0FBQ1QsYUFBTyxJQUFJLENBQUM7S0FDYjtBQUNELFFBQU0sRUFBRSxHQUFHLG1CQUFJLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQztBQUNsQyxVQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2pCLFFBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRTtBQUNkLFFBQUUsQ0FBQyxXQUFXLENBQUMsbUJBQUksTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztLQUMvQztBQUNELFVBQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdkIsV0FBTyxFQUFFLENBQUM7R0FDWDs7QUFFRCxXQUFTLGlCQUFpQixDQUFFLENBQUMsRUFBRTtBQUM3QixXQUFPLENBQUMsQ0FBQztHQUNWOztBQUVELFdBQVMsU0FBUyxHQUFJO0FBQ3BCLFdBQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQyxVQUFBLENBQUM7YUFBSSxDQUFDLENBQUMsS0FBSztLQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDO2FBQUksQ0FBQyxDQUFDLElBQUk7S0FBQSxDQUFDLENBQUM7R0FDNUQ7O0FBRUQsV0FBUyxrQkFBa0IsR0FBSTtBQUM3QixRQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDO0FBQzlCLFFBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDN0IsUUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUM7QUFDdkMsUUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7QUFDakMsUUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUNsQyxRQUFJLENBQUMsTUFBTSxFQUFFO0FBQ1gsYUFBTztLQUNSO0FBQ0QsUUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxRQUFRLENBQUM7QUFDL0MsUUFBTSxTQUFTLEdBQUcsNEJBQWEsRUFBRSxFQUFFO0FBQ2pDLGlCQUFXLEVBQVgsV0FBVztBQUNYLFdBQUssRUFBTCxLQUFLO0FBQ0wsYUFBTyxFQUFQLE9BQU87QUFDUCxjQUFRLEVBQVIsUUFBUTtBQUNSLFlBQU0sRUFBTixNQUFNO0FBQ04sZUFBUyxFQUFULFNBQVM7QUFDVCxtQkFBYSxFQUFFLE1BQU0sQ0FBQyxTQUFTO0FBQy9CLGNBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUN6QixTQUFHLGVBQUUsQ0FBQyxFQUFFO0FBQ04sVUFBRSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDZCxlQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7T0FDWjtBQUNELFlBQU0sa0JBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtBQUNyQixZQUFJLE1BQU0sQ0FBQyxVQUFVLEtBQUssS0FBSyxJQUFJLFNBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUN2RCxpQkFBTyxLQUFLLENBQUM7U0FDZDtBQUNELFlBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtBQUNqQixpQkFBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztTQUNyQztBQUNELGVBQU8sU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7T0FDL0M7S0FDRixDQUFDLENBQUM7QUFDSCxXQUFPLFNBQVMsQ0FBQztBQUNqQixhQUFTLFNBQVMsQ0FBRSxJQUFJLEVBQUU7QUFDeEIsVUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7QUFDckIsZUFBTyxLQUFLLENBQUM7T0FDZDtBQUNELGFBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7S0FDMUI7QUFDRCxhQUFTLFdBQVcsQ0FBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO1VBQ3pCLEtBQUssR0FBSSxJQUFJLENBQWIsS0FBSzs7QUFDWixVQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM3QyxZQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxPQUFPO09BQ2xCO0FBQ0QsU0FBRyxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBQ3RDLFVBQU0sSUFBSSxHQUFHLHVCQUFJLEtBQUssQ0FBQztBQUFDLEFBQ3hCLFVBQUksT0FBTyxFQUFFO0FBQ1gsWUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCLFlBQUksS0FBSyxFQUFFO0FBQ1QsY0FBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN0QyxjQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ2hELGNBQU0sSUFBSSxHQUFHLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDN0IsY0FBTSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDbEQsY0FBSSxLQUFLLEVBQUU7QUFDVCxnQkFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxBQUFDLE9BQU87V0FDM0I7U0FDRjtPQUNGO0FBQ0QsWUFBTSxDQUNILFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FDakIsSUFBSSxDQUFDLFVBQUEsTUFBTSxFQUFJO0FBQ2QsWUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2xELFlBQUksT0FBTyxFQUFFO0FBQ1gsZUFBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFMLEtBQUssRUFBRSxDQUFDO1NBQzlDO0FBQ0QsWUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO09BQ2IsQ0FBQyxDQUNELEtBQUssQ0FBQyxVQUFBLEtBQUssRUFBSTtBQUNkLGVBQU8sQ0FBQyxHQUFHLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3BFLFlBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUNWLENBQUMsQ0FBQztLQUNOO0dBQ0Y7O0FBRUQsV0FBUyxpQkFBaUIsQ0FBRSxDQUFDLEVBQUU7QUFDN0IsUUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUM3QyxRQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ3RCLFFBQUUsQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLGVBQVMsR0FBRyxJQUFJLENBQUM7S0FDbEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxTQUFTLEVBQUU7QUFDM0IsUUFBRSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQyxlQUFTLEdBQUcsS0FBSyxDQUFDO0tBQ25CO0dBQ0Y7O0FBRUQsV0FBUyxJQUFJLENBQUUsTUFBTSxFQUFFO0FBQ3JCLFFBQU0sRUFBRSxHQUFHLE1BQU0sR0FBRyxRQUFRLEdBQUcsS0FBSyxDQUFDO0FBQ3JDLFFBQU0sRUFBRSxHQUFHLE1BQU0sR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ2pDLHdCQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDdEMsd0JBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN4Qyx3QkFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLHdCQUFVLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDeEMsUUFBSSxhQUFhLEVBQUU7QUFDZiwwQkFBVSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDckU7QUFDRCxRQUFJLFdBQVcsRUFBRTtBQUNmLFNBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNsQyxTQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDckMsMEJBQVUsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2hELDBCQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUNqRCwwQkFBVSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDOUMsMEJBQVUsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELHVCQUFpQixFQUFFLENBQUM7S0FDckI7R0FDRjs7QUFFRCxXQUFTLE9BQU8sR0FBSTtBQUNsQixRQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDWCxRQUFJLFNBQVMsRUFBRTtBQUFFLGVBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUFFO0FBQ3ZDLE1BQUUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ2QsTUFBRSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDcEQsVUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDN0QsUUFBSSxNQUFNLENBQUMsYUFBYSxFQUFFO0FBQUUsWUFBTSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7S0FBRTtBQUN2RSxRQUFJLEtBQUssQ0FBQyxhQUFhLEVBQUU7QUFBRSxXQUFLLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUFFO0FBQ3BFLFlBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQixPQUFHLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUNyQixPQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLFVBQVUsR0FBRzthQUFNLEdBQUc7S0FBQSxDQUFDO0FBQ3ZELE9BQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssR0FBRzthQUFNLElBQUk7S0FBQSxDQUFDO0FBQ2xDLFdBQU8sR0FBRyxDQUFDO0dBQ1o7O0FBRUQsV0FBUyxZQUFZLENBQUUsQ0FBQyxFQUFFO0FBQ3hCLFFBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxFQUFFLEVBQUU7QUFDbkIsYUFBTztLQUNSO0FBQ0QsV0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0dBQ2Y7O0FBRUQsV0FBUyxLQUFLLENBQUUsQ0FBQyxFQUFFO0FBQ2pCLFFBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDeEIsUUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtBQUMxQyxjQUFRLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUMzRSxXQUFLLEVBQUUsQ0FBQztBQUNSLGFBQU87S0FDUjtBQUNELFFBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFJLE1BQU0sR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMxQyxXQUFPLE1BQU0sS0FBSyxLQUFLLElBQUksR0FBRyxDQUFDLGFBQWEsRUFBRTtBQUM1QyxTQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQztBQUN4QixZQUFNLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDdkM7QUFDRCxRQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUU7QUFDbEIsY0FBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztLQUNwQixNQUFNLElBQUksTUFBTSxLQUFLLEVBQUUsRUFBRTtBQUN4QixXQUFLLEVBQUUsQ0FBQztBQUNSLFFBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztLQUNaO0dBQ0Y7O0FBRUQsV0FBUyxLQUFLLEdBQUk7QUFDaEIsWUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDL0Isa0JBQWMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0dBQ25DOztBQUVELFdBQVMsT0FBTyxDQUFFLEdBQUcsRUFBRTtBQUNyQixLQUFDLEdBQUcsR0FBRyxnQkFBZ0IsR0FBRyxjQUFjLENBQUEsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzVELFFBQUksR0FBRyxFQUFFO0FBQ1AsVUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztLQUN2QjtBQUNELFdBQU8sR0FBRyxDQUFDO0dBQ1o7O0FBRUQsV0FBUyxRQUFRLENBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUM3QixVQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0dBQ3pCOztBQUVELFdBQVMsT0FBTyxDQUFFLENBQUMsRUFBRTtBQUNuQixRQUFNLEdBQUcsR0FBRyx5QkFBVSxFQUFFLENBQUMsQ0FBQztBQUMxQixRQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUMvQyxRQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQ3pFLFFBQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDO0FBQ3RHLFFBQUksSUFBSSxFQUFFO0FBQ1IsVUFBSSxHQUFHLEtBQUssSUFBSSxFQUFFO0FBQ2hCLFlBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtBQUNyQixrQkFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDakMsTUFBTTtBQUNMLG1DQUFVLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDckM7T0FDRixNQUFNLElBQUksR0FBRyxLQUFLLEdBQUcsRUFBRTtBQUN0QixZQUFJLEtBQUssQ0FBQyxTQUFTLEVBQUU7QUFDbkIsa0JBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQ2hDLE1BQU07QUFDTCxtQ0FBVSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDcEI7T0FDRixNQUFNLElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxXQUFXLEVBQUU7QUFDM0MsZ0JBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO09BQ2pDLE1BQU0sSUFBSSxHQUFHLEtBQUssS0FBSyxJQUFJLFlBQVksRUFBRTtBQUN4QyxnQkFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7T0FDaEMsTUFBTSxJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksV0FBVyxFQUFFO0FBQ3RDLGdCQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztPQUNqQyxNQUFNO0FBQ0wsZUFBTztPQUNSO0tBQ0YsTUFBTTtBQUNMLFVBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxXQUFXLEVBQUU7QUFDcEMsMkJBQW1CLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO09BQ3ZDLE1BQU0sSUFBSSxHQUFHLEtBQUssS0FBSyxJQUFJLFlBQVksRUFBRTtBQUN4QyxjQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztPQUN0QyxNQUFNLElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxXQUFXLEVBQUU7QUFDdEMsYUFBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztPQUN4RCxNQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTs7QUFDM0MsZUFBTztPQUNSO0FBQ0QsVUFBSSxTQUFTLEVBQUU7QUFBRSxpQkFBUyxDQUFDLGVBQWUsRUFBRSxDQUFDO09BQUU7S0FDaEQ7O0FBRUQsS0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQ25CLFdBQU8sS0FBSyxDQUFDO0dBQ2Q7O0FBRUQsV0FBUyxRQUFRLENBQUUsQ0FBQyxFQUFFO0FBQ3BCLFFBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQy9DLFFBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsS0FBSyxTQUFTLEVBQUU7QUFDMUMsYUFBTyxFQUFFLENBQUM7QUFDVixPQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7QUFDbkIsYUFBTyxLQUFLLENBQUM7S0FDZDtHQUNGOztBQUVELFdBQVMsS0FBSyxHQUFJO0FBQ2hCLGNBQVUsQ0FBQzthQUFNLGNBQWMsRUFBRTtLQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUM7R0FDdkM7O0FBRUQsV0FBUyxnQkFBZ0IsQ0FBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQzNDLG9CQUFnQixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7QUFBQyxHQUNwQzs7QUFFRCxXQUFTLGNBQWMsQ0FBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBQ3pDLG9CQUFnQixDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUseUJBQVUsRUFBRSxDQUFDLENBQUM7QUFBQyxHQUNuRDs7QUFFRCxXQUFTLGdCQUFnQixDQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO0FBQzlDLFFBQU0sR0FBRyxHQUFHLFFBQVEsSUFBSSxDQUFDLENBQUMsR0FBRyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNoRCxRQUFNLElBQUksR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDMUUsUUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtBQUM1QixhQUFPO0tBQ1I7O0FBRUQsUUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzlDLFFBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDOztBQUU1QyxRQUFJLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRzthQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7S0FBQSxDQUFDLENBQUM7QUFDOUMsTUFBRSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDaEIsWUFBUSxFQUFFLENBQUM7QUFDWCxZQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7O0FBRW5CLGFBQVMsUUFBUSxHQUFJO0FBQ25CLFVBQUksQ0FBQyxFQUFFO0FBQ0wsU0FBQyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUM7QUFDbkIsU0FBQyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUM7QUFDakIsaUNBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO09BQ2xCO0tBQ0Y7R0FDRjs7QUFFRCxXQUFTLGVBQWUsQ0FBRSxTQUFTLEVBQUUsSUFBSSxFQUFFO0FBQ3pDLHdCQUFLLFNBQVMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7R0FDckM7O0FBRUQsV0FBUyxPQUFPLENBQUUsR0FBRyxFQUFFO0FBQ3JCLFdBQU8sb0JBQUssR0FBRyxDQUFDLENBQUM7R0FDbEI7O0FBRUQsV0FBUyxRQUFRLENBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUN6QixRQUFJLENBQUMsR0FBRyxFQUFFO0FBQ1IsYUFBTztLQUNSO0FBQ0Qsa0JBQWMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ2xDLFFBQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUM7QUFDakMsUUFBSSxNQUFNLEtBQUssTUFBTSxFQUFFO0FBQ3JCLGFBQU8sTUFBTSxDQUFDLFNBQVMsS0FBSyxHQUFHLEVBQUU7QUFDL0IsYUFBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztPQUN4RDtLQUNGLE1BQU07QUFDTCxhQUFPLE1BQU0sQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFO0FBQ2hDLGNBQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO09BQ3ZDO0tBQ0Y7QUFDRCxRQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsTUFBTSxHQUFHLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0MsdUJBQW1CLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekIsTUFBRSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDakIsTUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ1gsNkJBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLFlBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztHQUNwQjs7QUFFRCxXQUFTLFdBQVcsR0FBSTtBQUN0QixRQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztBQUMzQyxXQUFPLDZCQUFJLFFBQVEsR0FBRSxJQUFJLENBQUMsVUFBQSxDQUFDO2FBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsUUFBUSxLQUFLLE9BQU87S0FBQSxDQUFDLENBQUM7R0FDcEU7O0FBRUQsV0FBUyxJQUFJLENBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtBQUM1QixpQ0FBSSxTQUFTLENBQUMsUUFBUSxHQUFFLE9BQU8sQ0FBQyxVQUFDLEdBQUcsRUFBRSxDQUFDO2FBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQUEsQ0FBQyxDQUFDO0dBQ3ZFOztBQUVELFdBQVMsZUFBZSxDQUFFLEtBQUssRUFBRTtBQUMvQixXQUFPLFNBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFJLENBQUM7R0FDakM7Q0FDRixDQUFBOzs7QUNyZUQsWUFBWSxDQUFDOzs7OztrQkFFVyxJQUFJO0FBQWIsU0FBUyxJQUFJLENBQUUsRUFBRSxFQUFFLEtBQUssRUFBRTtBQUN2QyxNQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLE1BQUUsQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7R0FDdkM7QUFDRCxNQUFJLE9BQU8sRUFBRSxDQUFDLFNBQVMsS0FBSyxRQUFRLEVBQUU7QUFDcEMsV0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDO0dBQ3JCO0FBQ0QsU0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDO0NBQ3ZCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIHRhaWxvcm1hZGUgPSByZXF1aXJlKCcuL3RhaWxvcm1hZGUnKTtcblxuZnVuY3Rpb24gYnVsbHNleWUgKGVsLCB0YXJnZXQsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zO1xuICB2YXIgZG9tVGFyZ2V0ID0gdGFyZ2V0ICYmIHRhcmdldC50YWdOYW1lO1xuXG4gIGlmICghZG9tVGFyZ2V0ICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBvID0gdGFyZ2V0O1xuICB9XG4gIGlmICghZG9tVGFyZ2V0KSB7XG4gICAgdGFyZ2V0ID0gZWw7XG4gIH1cbiAgaWYgKCFvKSB7IG8gPSB7fTsgfVxuXG4gIHZhciBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgdmFyIHRocm90dGxlZFdyaXRlID0gdGhyb3R0bGUod3JpdGUsIDMwKTtcbiAgdmFyIHRhaWxvck9wdGlvbnMgPSB7IHVwZGF0ZTogby5hdXRvdXBkYXRlVG9DYXJldCAhPT0gZmFsc2UgJiYgdXBkYXRlIH07XG4gIHZhciB0YWlsb3IgPSBvLmNhcmV0ICYmIHRhaWxvcm1hZGUodGFyZ2V0LCB0YWlsb3JPcHRpb25zKTtcblxuICB3cml0ZSgpO1xuXG4gIGlmIChvLnRyYWNraW5nICE9PSBmYWxzZSkge1xuICAgIGNyb3NzdmVudC5hZGQod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkTnVsbCxcbiAgICByZWZyZXNoOiB3cml0ZSxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHNsZWVwOiBzbGVlcFxuICB9O1xuXG4gIGZ1bmN0aW9uIHNsZWVwICgpIHtcbiAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROdWxsICgpIHsgcmV0dXJuIHJlYWQoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKHJlYWRpbmdzKSB7XG4gICAgdmFyIGJvdW5kcyA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICBpZiAodGFpbG9yKSB7XG4gICAgICByZWFkaW5ncyA9IHRhaWxvci5yZWFkKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLmxlZnQpICsgcmVhZGluZ3MueCxcbiAgICAgICAgeTogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy50b3ApICsgc2Nyb2xsVG9wICsgcmVhZGluZ3MueSArIDIwXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgeDogYm91bmRzLmxlZnQsXG4gICAgICB5OiBib3VuZHMudG9wICsgc2Nyb2xsVG9wXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZSAocmVhZGluZ3MpIHtcbiAgICB3cml0ZShyZWFkaW5ncyk7XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAocmVhZGluZ3MpIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1bGxzZXllIGNhblxcJ3QgcmVmcmVzaCBhZnRlciBiZWluZyBkZXN0cm95ZWQuIENyZWF0ZSBhbm90aGVyIGluc3RhbmNlIGluc3RlYWQuJyk7XG4gICAgfVxuICAgIGlmICh0YWlsb3IgJiYgIXJlYWRpbmdzKSB7XG4gICAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gZmFsc2U7XG4gICAgICB0YWlsb3IucmVmcmVzaCgpOyByZXR1cm47XG4gICAgfVxuICAgIHZhciBwID0gcmVhZChyZWFkaW5ncyk7XG4gICAgaWYgKCF0YWlsb3IgJiYgdGFyZ2V0ICE9PSBlbCkge1xuICAgICAgcC55ICs9IHRhcmdldC5vZmZzZXRIZWlnaHQ7XG4gICAgfVxuICAgIGVsLnN0eWxlLmxlZnQgPSBwLnggKyAncHgnO1xuICAgIGVsLnN0eWxlLnRvcCA9IHAueSArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpZiAodGFpbG9yKSB7IHRhaWxvci5kZXN0cm95KCk7IH1cbiAgICBjcm9zc3ZlbnQucmVtb3ZlKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVsbHNleWU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb247XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGdldFNlbGVjdGlvblJhdyA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uUmF3Jyk7XG52YXIgZ2V0U2VsZWN0aW9uTnVsbE9wID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25OdWxsT3AnKTtcbnZhciBnZXRTZWxlY3Rpb25TeW50aGV0aWMgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblN5bnRoZXRpYycpO1xudmFyIGlzSG9zdCA9IHJlcXVpcmUoJy4vaXNIb3N0Jyk7XG5pZiAoaXNIb3N0Lm1ldGhvZChnbG9iYWwsICdnZXRTZWxlY3Rpb24nKSkge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25SYXc7XG59IGVsc2UgaWYgKHR5cGVvZiBkb2Muc2VsZWN0aW9uID09PSAnb2JqZWN0JyAmJiBkb2Muc2VsZWN0aW9uKSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvblN5bnRoZXRpYztcbn0gZWxzZSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvbk51bGxPcDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AgKCkge31cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uTnVsbE9wICgpIHtcbiAgcmV0dXJuIHtcbiAgICByZW1vdmVBbGxSYW5nZXM6IG5vb3AsXG4gICAgYWRkUmFuZ2U6IG5vb3BcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvblJhdyAoKSB7XG4gIHJldHVybiBnbG9iYWwuZ2V0U2VsZWN0aW9uKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uUmF3O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBib2R5ID0gZG9jLmJvZHk7XG52YXIgR2V0U2VsZWN0aW9uUHJvdG8gPSBHZXRTZWxlY3Rpb24ucHJvdG90eXBlO1xuXG5mdW5jdGlvbiBHZXRTZWxlY3Rpb24gKHNlbGVjdGlvbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciByYW5nZSA9IHNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuXG4gIHRoaXMuX3NlbGVjdGlvbiA9IHNlbGVjdGlvbjtcbiAgdGhpcy5fcmFuZ2VzID0gW107XG5cbiAgaWYgKHNlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbGYpO1xuICB9IGVsc2UgaWYgKGlzVGV4dFJhbmdlKHJhbmdlKSkge1xuICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsZiwgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbGYpO1xuICB9XG59XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZUFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHRleHRSYW5nZTtcbiAgdHJ5IHtcbiAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdOb25lJykge1xuICAgICAgdGV4dFJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgIHRleHRSYW5nZS5zZWxlY3QoKTtcbiAgICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uYWRkUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShyYW5nZSkuc2VsZWN0KCk7XG4gICAgdGhpcy5fcmFuZ2VzWzBdID0gcmFuZ2U7XG4gICAgdGhpcy5yYW5nZUNvdW50ID0gMTtcbiAgICB0aGlzLmlzQ29sbGFwc2VkID0gdGhpcy5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSh0aGlzLCByYW5nZSwgZmFsc2UpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRSYW5nZXMgPSBmdW5jdGlvbiAocmFuZ2VzKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHZhciByYW5nZUNvdW50ID0gcmFuZ2VzLmxlbmd0aDtcbiAgaWYgKHJhbmdlQ291bnQgPiAxKSB7XG4gICAgY3JlYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZXMpO1xuICB9IGVsc2UgaWYgKHJhbmdlQ291bnQpIHtcbiAgICB0aGlzLmFkZFJhbmdlKHJhbmdlc1swXSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldFJhbmdlQXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgaWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLnJhbmdlQ291bnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFJhbmdlQXQoKTogaW5kZXggb3V0IG9mIGJvdW5kcycpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9yYW5nZXNbaW5kZXhdLmNsb25lUmFuZ2UoKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnQ29udHJvbCcpIHtcbiAgICByZW1vdmVSYW5nZU1hbnVhbGx5KHRoaXMsIHJhbmdlKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHRoaXMuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICB2YXIgZWw7XG4gIHZhciByZW1vdmVkID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGNvbnRyb2xSYW5nZS5pdGVtKGkpO1xuICAgIGlmIChlbCAhPT0gcmFuZ2VFbGVtZW50IHx8IHJlbW92ZWQpIHtcbiAgICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZWFjaFJhbmdlID0gZnVuY3Rpb24gKGZuLCByZXR1cm5WYWx1ZSkge1xuICB2YXIgaSA9IDA7XG4gIHZhciBsZW4gPSB0aGlzLl9yYW5nZXMubGVuZ3RoO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoZm4odGhpcy5nZXRSYW5nZUF0KGkpKSkge1xuICAgICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICAgIH1cbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0QWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmFuZ2VzID0gW107XG4gIHRoaXMuZWFjaFJhbmdlKGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJhbmdlcy5wdXNoKHJhbmdlKTtcbiAgfSk7XG4gIHJldHVybiByYW5nZXM7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRTaW5nbGVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB0aGlzLmFkZFJhbmdlKHJhbmdlKTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2VzKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgZWwsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZXNbaV0pO1xuICAgIHRyeSB7XG4gICAgICBjb250cm9sUmFuZ2UuYWRkKGVsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFJhbmdlcygpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICAgIH1cbiAgfVxuICBjb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUmFuZ2VNYW51YWxseSAoc2VsLCByYW5nZSkge1xuICB2YXIgcmFuZ2VzID0gc2VsLmdldEFsbFJhbmdlcygpO1xuICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzU2FtZVJhbmdlKHJhbmdlLCByYW5nZXNbaV0pKSB7XG4gICAgICBzZWwuYWRkUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFzZWwucmFuZ2VDb3VudCkge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGFuY2hvclByZWZpeCA9ICdzdGFydCc7XG4gIHZhciBmb2N1c1ByZWZpeCA9ICdlbmQnO1xuICBzZWwuYW5jaG9yTm9kZSA9IHJhbmdlW2FuY2hvclByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHJhbmdlW2FuY2hvclByZWZpeCArICdPZmZzZXQnXTtcbiAgc2VsLmZvY3VzTm9kZSA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuZm9jdXNPZmZzZXQgPSByYW5nZVtmb2N1c1ByZWZpeCArICdPZmZzZXQnXTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRW1wdHlTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuYW5jaG9yTm9kZSA9IHNlbC5mb2N1c05vZGUgPSBudWxsO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gc2VsLmZvY3VzT2Zmc2V0ID0gMDtcbiAgc2VsLnJhbmdlQ291bnQgPSAwO1xuICBzZWwuaXNDb2xsYXBzZWQgPSB0cnVlO1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xufVxuXG5mdW5jdGlvbiByYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudCAocmFuZ2VOb2Rlcykge1xuICBpZiAoIXJhbmdlTm9kZXMubGVuZ3RoIHx8IHJhbmdlTm9kZXNbMF0ubm9kZVR5cGUgIT09IDEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDEsIGxlbiA9IHJhbmdlTm9kZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzQW5jZXN0b3JPZihyYW5nZU5vZGVzWzBdLCByYW5nZU5vZGVzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSAocmFuZ2UpIHtcbiAgdmFyIG5vZGVzID0gcmFuZ2UuZ2V0Tm9kZXMoKTtcbiAgaWYgKCFyYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudChub2RlcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UoKTogcmFuZ2UgZGlkIG5vdCBjb25zaXN0IG9mIGEgc2luZ2xlIGVsZW1lbnQnKTtcbiAgfVxuICByZXR1cm4gbm9kZXNbMF07XG59XG5cbmZ1bmN0aW9uIGlzVGV4dFJhbmdlIChyYW5nZSkge1xuICByZXR1cm4gcmFuZ2UgJiYgcmFuZ2UudGV4dCAhPT0gdm9pZCAwO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGcm9tVGV4dFJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHNlbC5fcmFuZ2VzID0gW3JhbmdlXTtcbiAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCByYW5nZSwgZmFsc2UpO1xuICBzZWwucmFuZ2VDb3VudCA9IDE7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHJhbmdlLmNvbGxhcHNlZDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG4gIGlmIChzZWwuX3NlbGVjdGlvbi50eXBlID09PSAnTm9uZScpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICAgIGlmIChpc1RleHRSYW5nZShjb250cm9sUmFuZ2UpKSB7XG4gICAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbCwgY29udHJvbFJhbmdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsLnJhbmdlQ291bnQgPSBjb250cm9sUmFuZ2UubGVuZ3RoO1xuICAgICAgdmFyIHJhbmdlO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWwucmFuZ2VDb3VudDsgKytpKSB7XG4gICAgICAgIHJhbmdlID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGUoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgICAgICBzZWwuX3Jhbmdlcy5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICAgIHNlbC5pc0NvbGxhcHNlZCA9IHNlbC5yYW5nZUNvdW50ID09PSAxICYmIHNlbC5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgc2VsLl9yYW5nZXNbc2VsLnJhbmdlQ291bnQgLSAxXSwgZmFsc2UpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZSkge1xuICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICB9XG4gIHRyeSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChyYW5nZUVsZW1lbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhZGRSYW5nZSgpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiBpc1NhbWVSYW5nZSAobGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIChcbiAgICBsZWZ0LnN0YXJ0Q29udGFpbmVyID09PSByaWdodC5zdGFydENvbnRhaW5lciAmJlxuICAgIGxlZnQuc3RhcnRPZmZzZXQgPT09IHJpZ2h0LnN0YXJ0T2Zmc2V0ICYmXG4gICAgbGVmdC5lbmRDb250YWluZXIgPT09IHJpZ2h0LmVuZENvbnRhaW5lciAmJlxuICAgIGxlZnQuZW5kT2Zmc2V0ID09PSByaWdodC5lbmRPZmZzZXRcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNBbmNlc3Rvck9mIChhbmNlc3RvciwgZGVzY2VuZGFudCkge1xuICB2YXIgbm9kZSA9IGRlc2NlbmRhbnQ7XG4gIHdoaWxlIChub2RlLnBhcmVudE5vZGUpIHtcbiAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBhbmNlc3Rvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb24gKCkge1xuICByZXR1cm4gbmV3IEdldFNlbGVjdGlvbihnbG9iYWwuZG9jdW1lbnQuc2VsZWN0aW9uKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzSG9zdE1ldGhvZCAoaG9zdCwgcHJvcCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBob3N0W3Byb3BdO1xuICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCAhISh0eXBlID09PSAnb2JqZWN0JyAmJiBob3N0W3Byb3BdKSB8fCB0eXBlID09PSAndW5rbm93bic7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdFByb3BlcnR5IChob3N0LCBwcm9wKSB7XG4gIHJldHVybiB0eXBlb2YgaG9zdFtwcm9wXSAhPT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBhcmVIb3N0ZWQgKGhvc3QsIHByb3BzKSB7XG4gICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKCFmbihob3N0LCBwcm9wc1tpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGhvZDogaXNIb3N0TWV0aG9kLFxuICBtZXRob2RzOiBtYW55KGlzSG9zdE1ldGhvZCksXG4gIHByb3BlcnR5OiBpc0hvc3RQcm9wZXJ0eSxcbiAgcHJvcGVydGllczogbWFueShpc0hvc3RQcm9wZXJ0eSlcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xuXG5mdW5jdGlvbiByYW5nZVRvVGV4dFJhbmdlIChwKSB7XG4gIGlmIChwLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgfVxuICB2YXIgc3RhcnRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB2YXIgZW5kUmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuZW5kQ29udGFpbmVyLCBvZmZzZXQ6IHAuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgc2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9zZXRTZWxlY3Rpb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldDogZ2V0U2VsZWN0aW9uLFxuICBzZXQ6IHNldFNlbGVjdGlvblxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gc2V0U2VsZWN0aW9uIChwKSB7XG4gIGlmIChkb2MuY3JlYXRlUmFuZ2UpIHtcbiAgICBtb2Rlcm5TZWxlY3Rpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBvbGRTZWxlY3Rpb24oKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vZGVyblNlbGVjdGlvbiAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIHZhciByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgIGlmICghcC5zdGFydENvbnRhaW5lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAocC5lbmRDb250YWluZXIpIHtcbiAgICAgIHJhbmdlLnNldEVuZChwLmVuZENvbnRhaW5lciwgcC5lbmRPZmZzZXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgfVxuICAgIHJhbmdlLnNldFN0YXJ0KHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICBzZWwuYWRkUmFuZ2UocmFuZ2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gb2xkU2VsZWN0aW9uICgpIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHApLnNlbGVjdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2V0U2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2VsbCA9IHJlcXVpcmUoJ3NlbGwnKTtcbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBzZWxlY2Npb24gPSByZXF1aXJlKCdzZWxlY2Npb24nKTtcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJy4vdGhyb3R0bGUnKTtcbnZhciBnZXRTZWxlY3Rpb24gPSBzZWxlY2Npb24uZ2V0O1xudmFyIHByb3BzID0gW1xuICAnZGlyZWN0aW9uJyxcbiAgJ2JveFNpemluZycsXG4gICd3aWR0aCcsXG4gICdoZWlnaHQnLFxuICAnb3ZlcmZsb3dYJyxcbiAgJ292ZXJmbG93WScsXG4gICdib3JkZXJUb3BXaWR0aCcsXG4gICdib3JkZXJSaWdodFdpZHRoJyxcbiAgJ2JvcmRlckJvdHRvbVdpZHRoJyxcbiAgJ2JvcmRlckxlZnRXaWR0aCcsXG4gICdwYWRkaW5nVG9wJyxcbiAgJ3BhZGRpbmdSaWdodCcsXG4gICdwYWRkaW5nQm90dG9tJyxcbiAgJ3BhZGRpbmdMZWZ0JyxcbiAgJ2ZvbnRTdHlsZScsXG4gICdmb250VmFyaWFudCcsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHJldGNoJyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRTaXplQWRqdXN0JyxcbiAgJ2xpbmVIZWlnaHQnLFxuICAnZm9udEZhbWlseScsXG4gICd0ZXh0QWxpZ24nLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3RleHREZWNvcmF0aW9uJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAnd29yZFNwYWNpbmcnXG5dO1xudmFyIHdpbiA9IGdsb2JhbDtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBmZiA9IHdpbi5tb3pJbm5lclNjcmVlblggIT09IG51bGwgJiYgd2luLm1veklubmVyU2NyZWVuWCAhPT0gdm9pZCAwO1xuXG5mdW5jdGlvbiB0YWlsb3JtYWRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGV4dElucHV0ID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnO1xuICB2YXIgdGhyb3R0bGVkUmVmcmVzaCA9IHRocm90dGxlKHJlZnJlc2gsIDMwKTtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuXG4gIGJpbmQoKTtcblxuICByZXR1cm4ge1xuICAgIHJlYWQ6IHJlYWRQb3NpdGlvbixcbiAgICByZWZyZXNoOiB0aHJvdHRsZWRSZWZyZXNoLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3lcbiAgfTtcblxuICBmdW5jdGlvbiBub29wICgpIHt9XG4gIGZ1bmN0aW9uIHJlYWRQb3NpdGlvbiAoKSB7IHJldHVybiAodGV4dElucHV0ID8gY29vcmRzVGV4dCA6IGNvb3Jkc0hUTUwpKCk7IH1cblxuICBmdW5jdGlvbiByZWZyZXNoICgpIHtcbiAgICBpZiAoby5zbGVlcGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXR1cm4gKG8udXBkYXRlIHx8IG5vb3ApKHJlYWRQb3NpdGlvbigpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc1RleHQgKCkge1xuICAgIHZhciBwID0gc2VsbChlbCk7XG4gICAgdmFyIGNvbnRleHQgPSBwcmVwYXJlKCk7XG4gICAgdmFyIHJlYWRpbmdzID0gcmVhZFRleHRDb29yZHMoY29udGV4dCwgcC5zdGFydCk7XG4gICAgZG9jLmJvZHkucmVtb3ZlQ2hpbGQoY29udGV4dC5taXJyb3IpO1xuICAgIHJldHVybiByZWFkaW5ncztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc0hUTUwgKCkge1xuICAgIHZhciBzZWwgPSBnZXRTZWxlY3Rpb24oKTtcbiAgICBpZiAoc2VsLnJhbmdlQ291bnQpIHtcbiAgICAgIHZhciByYW5nZSA9IHNlbC5nZXRSYW5nZUF0KDApO1xuICAgICAgdmFyIG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1ZyA9IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm5vZGVOYW1lID09PSAnUCcgJiYgcmFuZ2Uuc3RhcnRPZmZzZXQgPT09IDA7XG4gICAgICBpZiAobmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgeDogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0TGVmdCxcbiAgICAgICAgICB5OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRUb3AsXG4gICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZS5nZXRDbGllbnRSZWN0cykge1xuICAgICAgICB2YXIgcmVjdHMgPSByYW5nZS5nZXRDbGllbnRSZWN0cygpO1xuICAgICAgICBpZiAocmVjdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiByZWN0c1swXS5sZWZ0LFxuICAgICAgICAgICAgeTogcmVjdHNbMF0udG9wLFxuICAgICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHg6IDAsIHk6IDAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRUZXh0Q29vcmRzIChjb250ZXh0LCBwKSB7XG4gICAgdmFyIHJlc3QgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHZhciBtaXJyb3IgPSBjb250ZXh0Lm1pcnJvcjtcbiAgICB2YXIgY29tcHV0ZWQgPSBjb250ZXh0LmNvbXB1dGVkO1xuXG4gICAgd3JpdGUobWlycm9yLCByZWFkKGVsKS5zdWJzdHJpbmcoMCwgcCkpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgPT09ICdJTlBVVCcpIHtcbiAgICAgIG1pcnJvci50ZXh0Q29udGVudCA9IG1pcnJvci50ZXh0Q29udGVudC5yZXBsYWNlKC9cXHMvZywgJ1xcdTAwYTAnKTtcbiAgICB9XG5cbiAgICB3cml0ZShyZXN0LCByZWFkKGVsKS5zdWJzdHJpbmcocCkgfHwgJy4nKTtcblxuICAgIG1pcnJvci5hcHBlbmRDaGlsZChyZXN0KTtcblxuICAgIHJldHVybiB7XG4gICAgICB4OiByZXN0Lm9mZnNldExlZnQgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyTGVmdFdpZHRoJ10pLFxuICAgICAgeTogcmVzdC5vZmZzZXRUb3AgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyVG9wV2lkdGgnXSlcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoZWwpIHtcbiAgICByZXR1cm4gdGV4dElucHV0ID8gZWwudmFsdWUgOiBlbC5pbm5lckhUTUw7XG4gIH1cblxuICBmdW5jdGlvbiBwcmVwYXJlICgpIHtcbiAgICB2YXIgY29tcHV0ZWQgPSB3aW4uZ2V0Q29tcHV0ZWRTdHlsZSA/IGdldENvbXB1dGVkU3R5bGUoZWwpIDogZWwuY3VycmVudFN0eWxlO1xuICAgIHZhciBtaXJyb3IgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdmFyIHN0eWxlID0gbWlycm9yLnN0eWxlO1xuXG4gICAgZG9jLmJvZHkuYXBwZW5kQ2hpbGQobWlycm9yKTtcblxuICAgIGlmIChlbC50YWdOYW1lICE9PSAnSU5QVVQnKSB7XG4gICAgICBzdHlsZS53b3JkV3JhcCA9ICdicmVhay13b3JkJztcbiAgICB9XG4gICAgc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUtd3JhcCc7XG4gICAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICBwcm9wcy5mb3JFYWNoKGNvcHkpO1xuXG4gICAgaWYgKGZmKSB7XG4gICAgICBzdHlsZS53aWR0aCA9IHBhcnNlSW50KGNvbXB1dGVkLndpZHRoKSAtIDIgKyAncHgnO1xuICAgICAgaWYgKGVsLnNjcm9sbEhlaWdodCA+IHBhcnNlSW50KGNvbXB1dGVkLmhlaWdodCkpIHtcbiAgICAgICAgc3R5bGUub3ZlcmZsb3dZID0gJ3Njcm9sbCc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG4gICAgfVxuICAgIHJldHVybiB7IG1pcnJvcjogbWlycm9yLCBjb21wdXRlZDogY29tcHV0ZWQgfTtcblxuICAgIGZ1bmN0aW9uIGNvcHkgKHByb3ApIHtcbiAgICAgIHN0eWxlW3Byb3BdID0gY29tcHV0ZWRbcHJvcF07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKGVsLCB2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5dXAnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnaW5wdXQnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnY2hhbmdlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGFpbG9ybWFkZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gdGhyb3R0bGUgKGZuLCBib3VuZGFyeSkge1xuICB2YXIgbGFzdCA9IC1JbmZpbml0eTtcbiAgdmFyIHRpbWVyO1xuICByZXR1cm4gZnVuY3Rpb24gYm91bmNlZCAoKSB7XG4gICAgaWYgKHRpbWVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHVuYm91bmQoKTtcblxuICAgIGZ1bmN0aW9uIHVuYm91bmQgKCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgIHZhciBuZXh0ID0gbGFzdCArIGJvdW5kYXJ5O1xuICAgICAgdmFyIG5vdyA9IERhdGUubm93KCk7XG4gICAgICBpZiAobm93ID4gbmV4dCkge1xuICAgICAgICBsYXN0ID0gbm93O1xuICAgICAgICBmbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KHVuYm91bmQsIG5leHQgLSBub3cpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0aHJvdHRsZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRpY2t5ID0gcmVxdWlyZSgndGlja3knKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGFyZ3MsIGN0eCkge1xuICBpZiAoIWZuKSB7IHJldHVybjsgfVxuICB0aWNreShmdW5jdGlvbiBydW4gKCkge1xuICAgIGZuLmFwcGx5KGN0eCB8fCBudWxsLCBhcmdzIHx8IFtdKTtcbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXRvYSA9IHJlcXVpcmUoJ2F0b2EnKTtcbnZhciBkZWJvdW5jZSA9IHJlcXVpcmUoJy4vZGVib3VuY2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbWl0dGVyICh0aGluZywgb3B0aW9ucykge1xuICB2YXIgb3B0cyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBldnQgPSB7fTtcbiAgaWYgKHRoaW5nID09PSB1bmRlZmluZWQpIHsgdGhpbmcgPSB7fTsgfVxuICB0aGluZy5vbiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIGlmICghZXZ0W3R5cGVdKSB7XG4gICAgICBldnRbdHlwZV0gPSBbZm5dO1xuICAgIH0gZWxzZSB7XG4gICAgICBldnRbdHlwZV0ucHVzaChmbik7XG4gICAgfVxuICAgIHJldHVybiB0aGluZztcbiAgfTtcbiAgdGhpbmcub25jZSA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIGZuLl9vbmNlID0gdHJ1ZTsgLy8gdGhpbmcub2ZmKGZuKSBzdGlsbCB3b3JrcyFcbiAgICB0aGluZy5vbih0eXBlLCBmbik7XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vZmYgPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgaWYgKGMgPT09IDEpIHtcbiAgICAgIGRlbGV0ZSBldnRbdHlwZV07XG4gICAgfSBlbHNlIGlmIChjID09PSAwKSB7XG4gICAgICBldnQgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGV0ID0gZXZ0W3R5cGVdO1xuICAgICAgaWYgKCFldCkgeyByZXR1cm4gdGhpbmc7IH1cbiAgICAgIGV0LnNwbGljZShldC5pbmRleE9mKGZuKSwgMSk7XG4gICAgfVxuICAgIHJldHVybiB0aGluZztcbiAgfTtcbiAgdGhpbmcuZW1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgYXJncyA9IGF0b2EoYXJndW1lbnRzKTtcbiAgICByZXR1cm4gdGhpbmcuZW1pdHRlclNuYXBzaG90KGFyZ3Muc2hpZnQoKSkuYXBwbHkodGhpcywgYXJncyk7XG4gIH07XG4gIHRoaW5nLmVtaXR0ZXJTbmFwc2hvdCA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgdmFyIGV0ID0gKGV2dFt0eXBlXSB8fCBbXSkuc2xpY2UoMCk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgICAgdmFyIGN0eCA9IHRoaXMgfHwgdGhpbmc7XG4gICAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJyAmJiBvcHRzLnRocm93cyAhPT0gZmFsc2UgJiYgIWV0Lmxlbmd0aCkgeyB0aHJvdyBhcmdzLmxlbmd0aCA9PT0gMSA/IGFyZ3NbMF0gOiBhcmdzOyB9XG4gICAgICBldC5mb3JFYWNoKGZ1bmN0aW9uIGVtaXR0ZXIgKGxpc3Rlbikge1xuICAgICAgICBpZiAob3B0cy5hc3luYykgeyBkZWJvdW5jZShsaXN0ZW4sIGFyZ3MsIGN0eCk7IH0gZWxzZSB7IGxpc3Rlbi5hcHBseShjdHgsIGFyZ3MpOyB9XG4gICAgICAgIGlmIChsaXN0ZW4uX29uY2UpIHsgdGhpbmcub2ZmKHR5cGUsIGxpc3Rlbik7IH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaW5nO1xuICAgIH07XG4gIH07XG4gIHJldHVybiB0aGluZztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGF0b2EgKGEsIG4pIHsgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGEsIG4pOyB9XG4iLCJ2YXIgc2kgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nLCB0aWNrO1xuaWYgKHNpKSB7XG4gIHRpY2sgPSBmdW5jdGlvbiAoZm4pIHsgc2V0SW1tZWRpYXRlKGZuKTsgfTtcbn0gZWxzZSB7XG4gIHRpY2sgPSBmdW5jdGlvbiAoZm4pIHsgc2V0VGltZW91dChmbiwgMCk7IH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGljazsiLCJcbnZhciBOYXRpdmVDdXN0b21FdmVudCA9IGdsb2JhbC5DdXN0b21FdmVudDtcblxuZnVuY3Rpb24gdXNlTmF0aXZlICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgcCA9IG5ldyBOYXRpdmVDdXN0b21FdmVudCgnY2F0JywgeyBkZXRhaWw6IHsgZm9vOiAnYmFyJyB9IH0pO1xuICAgIHJldHVybiAgJ2NhdCcgPT09IHAudHlwZSAmJiAnYmFyJyA9PT0gcC5kZXRhaWwuZm9vO1xuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENyb3NzLWJyb3dzZXIgYEN1c3RvbUV2ZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ3VzdG9tRXZlbnQuQ3VzdG9tRXZlbnRcbiAqXG4gKiBAcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB1c2VOYXRpdmUoKSA/IE5hdGl2ZUN1c3RvbUV2ZW50IDpcblxuLy8gSUUgPj0gOVxuJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUV2ZW50ID8gZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdDdXN0b21FdmVudCcpO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgcGFyYW1zLmJ1YmJsZXMsIHBhcmFtcy5jYW5jZWxhYmxlLCBwYXJhbXMuZGV0YWlsKTtcbiAgfSBlbHNlIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBmYWxzZSwgZmFsc2UsIHZvaWQgMCk7XG4gIH1cbiAgcmV0dXJuIGU7XG59IDpcblxuLy8gSUUgPD0gOFxuZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gIGUudHlwZSA9IHR5cGU7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmJ1YmJsZXMgPSBCb29sZWFuKHBhcmFtcy5idWJibGVzKTtcbiAgICBlLmNhbmNlbGFibGUgPSBCb29sZWFuKHBhcmFtcy5jYW5jZWxhYmxlKTtcbiAgICBlLmRldGFpbCA9IHBhcmFtcy5kZXRhaWw7XG4gIH0gZWxzZSB7XG4gICAgZS5idWJibGVzID0gZmFsc2U7XG4gICAgZS5jYW5jZWxhYmxlID0gZmFsc2U7XG4gICAgZS5kZXRhaWwgPSB2b2lkIDA7XG4gIH1cbiAgcmV0dXJuIGU7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjdXN0b21FdmVudCA9IHJlcXVpcmUoJ2N1c3RvbS1ldmVudCcpO1xudmFyIGV2ZW50bWFwID0gcmVxdWlyZSgnLi9ldmVudG1hcCcpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBhZGRFdmVudCA9IGFkZEV2ZW50RWFzeTtcbnZhciByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50RWFzeTtcbnZhciBoYXJkQ2FjaGUgPSBbXTtcblxuaWYgKCFnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuICBhZGRFdmVudCA9IGFkZEV2ZW50SGFyZDtcbiAgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEhhcmQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhZGQ6IGFkZEV2ZW50LFxuICByZW1vdmU6IHJlbW92ZUV2ZW50LFxuICBmYWJyaWNhdGU6IGZhYnJpY2F0ZUV2ZW50XG59O1xuXG5mdW5jdGlvbiBhZGRFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZWwuYXR0YWNoRXZlbnQoJ29uJyArIHR5cGUsIHdyYXAoZWwsIHR5cGUsIGZuKSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBsaXN0ZW5lciA9IHVud3JhcChlbCwgdHlwZSwgZm4pO1xuICBpZiAobGlzdGVuZXIpIHtcbiAgICByZXR1cm4gZWwuZGV0YWNoRXZlbnQoJ29uJyArIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmYWJyaWNhdGVFdmVudCAoZWwsIHR5cGUsIG1vZGVsKSB7XG4gIHZhciBlID0gZXZlbnRtYXAuaW5kZXhPZih0eXBlKSA9PT0gLTEgPyBtYWtlQ3VzdG9tRXZlbnQoKSA6IG1ha2VDbGFzc2ljRXZlbnQoKTtcbiAgaWYgKGVsLmRpc3BhdGNoRXZlbnQpIHtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGUpO1xuICB9IGVsc2Uge1xuICAgIGVsLmZpcmVFdmVudCgnb24nICsgdHlwZSwgZSk7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUNsYXNzaWNFdmVudCAoKSB7XG4gICAgdmFyIGU7XG4gICAgaWYgKGRvYy5jcmVhdGVFdmVudCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudCgnRXZlbnQnKTtcbiAgICAgIGUuaW5pdEV2ZW50KHR5cGUsIHRydWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoZG9jLmNyZWF0ZUV2ZW50T2JqZWN0KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiBlO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDdXN0b21FdmVudCAoKSB7XG4gICAgcmV0dXJuIG5ldyBjdXN0b21FdmVudCh0eXBlLCB7IGRldGFpbDogbW9kZWwgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlckZhY3RvcnkgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcHBlciAob3JpZ2luYWxFdmVudCkge1xuICAgIHZhciBlID0gb3JpZ2luYWxFdmVudCB8fCBnbG9iYWwuZXZlbnQ7XG4gICAgZS50YXJnZXQgPSBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQ7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCA9IGUucHJldmVudERlZmF1bHQgfHwgZnVuY3Rpb24gcHJldmVudERlZmF1bHQgKCkgeyBlLnJldHVyblZhbHVlID0gZmFsc2U7IH07XG4gICAgZS5zdG9wUHJvcGFnYXRpb24gPSBlLnN0b3BQcm9wYWdhdGlvbiB8fCBmdW5jdGlvbiBzdG9wUHJvcGFnYXRpb24gKCkgeyBlLmNhbmNlbEJ1YmJsZSA9IHRydWU7IH07XG4gICAgZS53aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGZuLmNhbGwoZWwsIGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB3cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIHdyYXBwZXIgPSB1bndyYXAoZWwsIHR5cGUsIGZuKSB8fCB3cmFwcGVyRmFjdG9yeShlbCwgdHlwZSwgZm4pO1xuICBoYXJkQ2FjaGUucHVzaCh7XG4gICAgd3JhcHBlcjogd3JhcHBlcixcbiAgICBlbGVtZW50OiBlbCxcbiAgICB0eXBlOiB0eXBlLFxuICAgIGZuOiBmblxuICB9KTtcbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbmZ1bmN0aW9uIHVud3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpID0gZmluZChlbCwgdHlwZSwgZm4pO1xuICBpZiAoaSkge1xuICAgIHZhciB3cmFwcGVyID0gaGFyZENhY2hlW2ldLndyYXBwZXI7XG4gICAgaGFyZENhY2hlLnNwbGljZShpLCAxKTsgLy8gZnJlZSB1cCBhIHRhZCBvZiBtZW1vcnlcbiAgICByZXR1cm4gd3JhcHBlcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGksIGl0ZW07XG4gIGZvciAoaSA9IDA7IGkgPCBoYXJkQ2FjaGUubGVuZ3RoOyBpKyspIHtcbiAgICBpdGVtID0gaGFyZENhY2hlW2ldO1xuICAgIGlmIChpdGVtLmVsZW1lbnQgPT09IGVsICYmIGl0ZW0udHlwZSA9PT0gdHlwZSAmJiBpdGVtLmZuID09PSBmbikge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBldmVudG1hcCA9IFtdO1xudmFyIGV2ZW50bmFtZSA9ICcnO1xudmFyIHJvbiA9IC9eb24vO1xuXG5mb3IgKGV2ZW50bmFtZSBpbiBnbG9iYWwpIHtcbiAgaWYgKHJvbi50ZXN0KGV2ZW50bmFtZSkpIHtcbiAgICBldmVudG1hcC5wdXNoKGV2ZW50bmFtZS5zbGljZSgyKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBldmVudG1hcDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZnV6enlzZWFyY2ggKG5lZWRsZSwgaGF5c3RhY2spIHtcbiAgdmFyIHRsZW4gPSBoYXlzdGFjay5sZW5ndGg7XG4gIHZhciBxbGVuID0gbmVlZGxlLmxlbmd0aDtcbiAgaWYgKHFsZW4gPiB0bGVuKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChxbGVuID09PSB0bGVuKSB7XG4gICAgcmV0dXJuIG5lZWRsZSA9PT0gaGF5c3RhY2s7XG4gIH1cbiAgb3V0ZXI6IGZvciAodmFyIGkgPSAwLCBqID0gMDsgaSA8IHFsZW47IGkrKykge1xuICAgIHZhciBuY2ggPSBuZWVkbGUuY2hhckNvZGVBdChpKTtcbiAgICB3aGlsZSAoaiA8IHRsZW4pIHtcbiAgICAgIGlmIChoYXlzdGFjay5jaGFyQ29kZUF0KGorKykgPT09IG5jaCkge1xuICAgICAgICBjb250aW51ZSBvdXRlcjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1enp5c2VhcmNoO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBwYWQgKGhhc2gsIGxlbikge1xuICB3aGlsZSAoaGFzaC5sZW5ndGggPCBsZW4pIHtcbiAgICBoYXNoID0gJzAnICsgaGFzaDtcbiAgfVxuICByZXR1cm4gaGFzaDtcbn1cblxuZnVuY3Rpb24gZm9sZCAoaGFzaCwgdGV4dCkge1xuICB2YXIgaTtcbiAgdmFyIGNocjtcbiAgdmFyIGxlbjtcbiAgaWYgKHRleHQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGhhc2g7XG4gIH1cbiAgZm9yIChpID0gMCwgbGVuID0gdGV4dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNociA9IHRleHQuY2hhckNvZGVBdChpKTtcbiAgICBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBjaHI7XG4gICAgaGFzaCB8PSAwO1xuICB9XG4gIHJldHVybiBoYXNoIDwgMCA/IGhhc2ggKiAtMiA6IGhhc2g7XG59XG5cbmZ1bmN0aW9uIGZvbGRPYmplY3QgKGhhc2gsIG8sIHNlZW4pIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG8pLnNvcnQoKS5yZWR1Y2UoZm9sZEtleSwgaGFzaCk7XG4gIGZ1bmN0aW9uIGZvbGRLZXkgKGhhc2gsIGtleSkge1xuICAgIHJldHVybiBmb2xkVmFsdWUoaGFzaCwgb1trZXldLCBrZXksIHNlZW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZvbGRWYWx1ZSAoaW5wdXQsIHZhbHVlLCBrZXksIHNlZW4pIHtcbiAgdmFyIGhhc2ggPSBmb2xkKGZvbGQoZm9sZChpbnB1dCwga2V5KSwgdG9TdHJpbmcodmFsdWUpKSwgdHlwZW9mIHZhbHVlKTtcbiAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGZvbGQoaGFzaCwgJ251bGwnKTtcbiAgfVxuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBmb2xkKGhhc2gsICd1bmRlZmluZWQnKTtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgIGlmIChzZWVuLmluZGV4T2YodmFsdWUpICE9PSAtMSkge1xuICAgICAgcmV0dXJuIGZvbGQoaGFzaCwgJ1tDaXJjdWxhcl0nICsga2V5KTtcbiAgICB9XG4gICAgc2Vlbi5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gZm9sZE9iamVjdChoYXNoLCB2YWx1ZSwgc2Vlbik7XG4gIH1cbiAgcmV0dXJuIGZvbGQoaGFzaCwgdmFsdWUudG9TdHJpbmcoKSk7XG59XG5cbmZ1bmN0aW9uIHRvU3RyaW5nIChvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cbmZ1bmN0aW9uIHN1bSAobykge1xuICByZXR1cm4gcGFkKGZvbGRWYWx1ZSgwLCBvLCAnJywgW10pLnRvU3RyaW5nKDE2KSwgOCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3VtO1xuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZSgnLi9pc09iamVjdCcpLFxuICAgIG5vdyA9IHJlcXVpcmUoJy4vbm93JyksXG4gICAgdG9OdW1iZXIgPSByZXF1aXJlKCcuL3RvTnVtYmVyJyk7XG5cbi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlTWF4ID0gTWF0aC5tYXg7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGRlYm91bmNlZCBmdW5jdGlvbiB0aGF0IGRlbGF5cyBpbnZva2luZyBgZnVuY2AgdW50aWwgYWZ0ZXIgYHdhaXRgXG4gKiBtaWxsaXNlY29uZHMgaGF2ZSBlbGFwc2VkIHNpbmNlIHRoZSBsYXN0IHRpbWUgdGhlIGRlYm91bmNlZCBmdW5jdGlvbiB3YXNcbiAqIGludm9rZWQuIFRoZSBkZWJvdW5jZWQgZnVuY3Rpb24gY29tZXMgd2l0aCBhIGBjYW5jZWxgIG1ldGhvZCB0byBjYW5jZWxcbiAqIGRlbGF5ZWQgYGZ1bmNgIGludm9jYXRpb25zIGFuZCBhIGBmbHVzaGAgbWV0aG9kIHRvIGltbWVkaWF0ZWx5IGludm9rZSB0aGVtLlxuICogUHJvdmlkZSBhbiBvcHRpb25zIG9iamVjdCB0byBpbmRpY2F0ZSB3aGV0aGVyIGBmdW5jYCBzaG91bGQgYmUgaW52b2tlZCBvblxuICogdGhlIGxlYWRpbmcgYW5kL29yIHRyYWlsaW5nIGVkZ2Ugb2YgdGhlIGB3YWl0YCB0aW1lb3V0LiBUaGUgYGZ1bmNgIGlzIGludm9rZWRcbiAqIHdpdGggdGhlIGxhc3QgYXJndW1lbnRzIHByb3ZpZGVkIHRvIHRoZSBkZWJvdW5jZWQgZnVuY3Rpb24uIFN1YnNlcXVlbnQgY2FsbHNcbiAqIHRvIHRoZSBkZWJvdW5jZWQgZnVuY3Rpb24gcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGxhc3QgYGZ1bmNgIGludm9jYXRpb24uXG4gKlxuICogKipOb3RlOioqIElmIGBsZWFkaW5nYCBhbmQgYHRyYWlsaW5nYCBvcHRpb25zIGFyZSBgdHJ1ZWAsIGBmdW5jYCBpcyBpbnZva2VkXG4gKiBvbiB0aGUgdHJhaWxpbmcgZWRnZSBvZiB0aGUgdGltZW91dCBvbmx5IGlmIHRoZSB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uIGlzXG4gKiBpbnZva2VkIG1vcmUgdGhhbiBvbmNlIGR1cmluZyB0aGUgYHdhaXRgIHRpbWVvdXQuXG4gKlxuICogU2VlIFtEYXZpZCBDb3JiYWNobydzIGFydGljbGVdKGh0dHA6Ly9kcnVwYWxtb3Rpb24uY29tL2FydGljbGUvZGVib3VuY2UtYW5kLXRocm90dGxlLXZpc3VhbC1leHBsYW5hdGlvbilcbiAqIGZvciBkZXRhaWxzIG92ZXIgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gYF8uZGVib3VuY2VgIGFuZCBgXy50aHJvdHRsZWAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gZGVib3VuY2UuXG4gKiBAcGFyYW0ge251bWJlcn0gW3dhaXQ9MF0gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFRoZSBvcHRpb25zIG9iamVjdC5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubGVhZGluZz1mYWxzZV0gU3BlY2lmeSBpbnZva2luZyBvbiB0aGUgbGVhZGluZ1xuICogIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4V2FpdF0gVGhlIG1heGltdW0gdGltZSBgZnVuY2AgaXMgYWxsb3dlZCB0byBiZVxuICogIGRlbGF5ZWQgYmVmb3JlIGl0J3MgaW52b2tlZC5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudHJhaWxpbmc9dHJ1ZV0gU3BlY2lmeSBpbnZva2luZyBvbiB0aGUgdHJhaWxpbmdcbiAqICBlZGdlIG9mIHRoZSB0aW1lb3V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZGVib3VuY2VkIGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiAvLyBhdm9pZCBjb3N0bHkgY2FsY3VsYXRpb25zIHdoaWxlIHRoZSB3aW5kb3cgc2l6ZSBpcyBpbiBmbHV4XG4gKiBqUXVlcnkod2luZG93KS5vbigncmVzaXplJywgXy5kZWJvdW5jZShjYWxjdWxhdGVMYXlvdXQsIDE1MCkpO1xuICpcbiAqIC8vIGludm9rZSBgc2VuZE1haWxgIHdoZW4gY2xpY2tlZCwgZGVib3VuY2luZyBzdWJzZXF1ZW50IGNhbGxzXG4gKiBqUXVlcnkoZWxlbWVudCkub24oJ2NsaWNrJywgXy5kZWJvdW5jZShzZW5kTWFpbCwgMzAwLCB7XG4gKiAgICdsZWFkaW5nJzogdHJ1ZSxcbiAqICAgJ3RyYWlsaW5nJzogZmFsc2VcbiAqIH0pKTtcbiAqXG4gKiAvLyBlbnN1cmUgYGJhdGNoTG9nYCBpcyBpbnZva2VkIG9uY2UgYWZ0ZXIgMSBzZWNvbmQgb2YgZGVib3VuY2VkIGNhbGxzXG4gKiB2YXIgZGVib3VuY2VkID0gXy5kZWJvdW5jZShiYXRjaExvZywgMjUwLCB7ICdtYXhXYWl0JzogMTAwMCB9KTtcbiAqIHZhciBzb3VyY2UgPSBuZXcgRXZlbnRTb3VyY2UoJy9zdHJlYW0nKTtcbiAqIGpRdWVyeShzb3VyY2UpLm9uKCdtZXNzYWdlJywgZGVib3VuY2VkKTtcbiAqXG4gKiAvLyBjYW5jZWwgYSB0cmFpbGluZyBkZWJvdW5jZWQgaW52b2NhdGlvblxuICogalF1ZXJ5KHdpbmRvdykub24oJ3BvcHN0YXRlJywgZGVib3VuY2VkLmNhbmNlbCk7XG4gKi9cbmZ1bmN0aW9uIGRlYm91bmNlKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgdmFyIGFyZ3MsXG4gICAgICBtYXhUaW1lb3V0SWQsXG4gICAgICByZXN1bHQsXG4gICAgICBzdGFtcCxcbiAgICAgIHRoaXNBcmcsXG4gICAgICB0aW1lb3V0SWQsXG4gICAgICB0cmFpbGluZ0NhbGwsXG4gICAgICBsYXN0Q2FsbGVkID0gMCxcbiAgICAgIGxlYWRpbmcgPSBmYWxzZSxcbiAgICAgIG1heFdhaXQgPSBmYWxzZSxcbiAgICAgIHRyYWlsaW5nID0gdHJ1ZTtcblxuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoRlVOQ19FUlJPUl9URVhUKTtcbiAgfVxuICB3YWl0ID0gdG9OdW1iZXIod2FpdCkgfHwgMDtcbiAgaWYgKGlzT2JqZWN0KG9wdGlvbnMpKSB7XG4gICAgbGVhZGluZyA9ICEhb3B0aW9ucy5sZWFkaW5nO1xuICAgIG1heFdhaXQgPSAnbWF4V2FpdCcgaW4gb3B0aW9ucyAmJiBuYXRpdmVNYXgodG9OdW1iZXIob3B0aW9ucy5tYXhXYWl0KSB8fCAwLCB3YWl0KTtcbiAgICB0cmFpbGluZyA9ICd0cmFpbGluZycgaW4gb3B0aW9ucyA/ICEhb3B0aW9ucy50cmFpbGluZyA6IHRyYWlsaW5nO1xuICB9XG5cbiAgZnVuY3Rpb24gY2FuY2VsKCkge1xuICAgIGlmICh0aW1lb3V0SWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgIH1cbiAgICBpZiAobWF4VGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQobWF4VGltZW91dElkKTtcbiAgICB9XG4gICAgbGFzdENhbGxlZCA9IDA7XG4gICAgYXJncyA9IG1heFRpbWVvdXRJZCA9IHRoaXNBcmcgPSB0aW1lb3V0SWQgPSB0cmFpbGluZ0NhbGwgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBmdW5jdGlvbiBjb21wbGV0ZShpc0NhbGxlZCwgaWQpIHtcbiAgICBpZiAoaWQpIHtcbiAgICAgIGNsZWFyVGltZW91dChpZCk7XG4gICAgfVxuICAgIG1heFRpbWVvdXRJZCA9IHRpbWVvdXRJZCA9IHRyYWlsaW5nQ2FsbCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoaXNDYWxsZWQpIHtcbiAgICAgIGxhc3RDYWxsZWQgPSBub3coKTtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICBpZiAoIXRpbWVvdXRJZCAmJiAhbWF4VGltZW91dElkKSB7XG4gICAgICAgIGFyZ3MgPSB0aGlzQXJnID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlbGF5ZWQoKSB7XG4gICAgdmFyIHJlbWFpbmluZyA9IHdhaXQgLSAobm93KCkgLSBzdGFtcCk7XG4gICAgaWYgKHJlbWFpbmluZyA8PSAwIHx8IHJlbWFpbmluZyA+IHdhaXQpIHtcbiAgICAgIGNvbXBsZXRlKHRyYWlsaW5nQ2FsbCwgbWF4VGltZW91dElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChkZWxheWVkLCByZW1haW5pbmcpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZsdXNoKCkge1xuICAgIGlmICgodGltZW91dElkICYmIHRyYWlsaW5nQ2FsbCkgfHwgKG1heFRpbWVvdXRJZCAmJiB0cmFpbGluZykpIHtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgfVxuICAgIGNhbmNlbCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBmdW5jdGlvbiBtYXhEZWxheWVkKCkge1xuICAgIGNvbXBsZXRlKHRyYWlsaW5nLCB0aW1lb3V0SWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVib3VuY2VkKCkge1xuICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgc3RhbXAgPSBub3coKTtcbiAgICB0aGlzQXJnID0gdGhpcztcbiAgICB0cmFpbGluZ0NhbGwgPSB0cmFpbGluZyAmJiAodGltZW91dElkIHx8ICFsZWFkaW5nKTtcblxuICAgIGlmIChtYXhXYWl0ID09PSBmYWxzZSkge1xuICAgICAgdmFyIGxlYWRpbmdDYWxsID0gbGVhZGluZyAmJiAhdGltZW91dElkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIW1heFRpbWVvdXRJZCAmJiAhbGVhZGluZykge1xuICAgICAgICBsYXN0Q2FsbGVkID0gc3RhbXA7XG4gICAgICB9XG4gICAgICB2YXIgcmVtYWluaW5nID0gbWF4V2FpdCAtIChzdGFtcCAtIGxhc3RDYWxsZWQpLFxuICAgICAgICAgIGlzQ2FsbGVkID0gcmVtYWluaW5nIDw9IDAgfHwgcmVtYWluaW5nID4gbWF4V2FpdDtcblxuICAgICAgaWYgKGlzQ2FsbGVkKSB7XG4gICAgICAgIGlmIChtYXhUaW1lb3V0SWQpIHtcbiAgICAgICAgICBtYXhUaW1lb3V0SWQgPSBjbGVhclRpbWVvdXQobWF4VGltZW91dElkKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0Q2FsbGVkID0gc3RhbXA7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICghbWF4VGltZW91dElkKSB7XG4gICAgICAgIG1heFRpbWVvdXRJZCA9IHNldFRpbWVvdXQobWF4RGVsYXllZCwgcmVtYWluaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGlzQ2FsbGVkICYmIHRpbWVvdXRJZCkge1xuICAgICAgdGltZW91dElkID0gY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKCF0aW1lb3V0SWQgJiYgd2FpdCAhPT0gbWF4V2FpdCkge1xuICAgICAgdGltZW91dElkID0gc2V0VGltZW91dChkZWxheWVkLCB3YWl0KTtcbiAgICB9XG4gICAgaWYgKGxlYWRpbmdDYWxsKSB7XG4gICAgICBpc0NhbGxlZCA9IHRydWU7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgIH1cbiAgICBpZiAoaXNDYWxsZWQgJiYgIXRpbWVvdXRJZCAmJiAhbWF4VGltZW91dElkKSB7XG4gICAgICBhcmdzID0gdGhpc0FyZyA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBkZWJvdW5jZWQuY2FuY2VsID0gY2FuY2VsO1xuICBkZWJvdW5jZWQuZmx1c2ggPSBmbHVzaDtcbiAgcmV0dXJuIGRlYm91bmNlZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWJvdW5jZTtcbiIsInZhciBpc09iamVjdCA9IHJlcXVpcmUoJy4vaXNPYmplY3QnKTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IGdsb2JhbC5PYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMsIGFuZFxuICAvLyBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Z1bmN0aW9uO1xuIiwiLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc09iamVjdDtcbiIsIi8qKlxuICogR2V0cyB0aGUgdGltZXN0YW1wIG9mIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoYXQgaGF2ZSBlbGFwc2VkIHNpbmNlXG4gKiB0aGUgVW5peCBlcG9jaCAoMSBKYW51YXJ5IDE5NzAgMDA6MDA6MDAgVVRDKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHR5cGUgRnVuY3Rpb25cbiAqIEBjYXRlZ29yeSBEYXRlXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSB0aW1lc3RhbXAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uZGVmZXIoZnVuY3Rpb24oc3RhbXApIHtcbiAqICAgY29uc29sZS5sb2coXy5ub3coKSAtIHN0YW1wKTtcbiAqIH0sIF8ubm93KCkpO1xuICogLy8gPT4gbG9ncyB0aGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBpdCB0b29rIGZvciB0aGUgZGVmZXJyZWQgZnVuY3Rpb24gdG8gYmUgaW52b2tlZFxuICovXG52YXIgbm93ID0gRGF0ZS5ub3c7XG5cbm1vZHVsZS5leHBvcnRzID0gbm93O1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCcuL2lzRnVuY3Rpb24nKSxcbiAgICBpc09iamVjdCA9IHJlcXVpcmUoJy4vaXNPYmplY3QnKTtcblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgTkFOID0gMCAvIDA7XG5cbi8qKiBVc2VkIHRvIG1hdGNoIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuICovXG52YXIgcmVUcmltID0gL15cXHMrfFxccyskL2c7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiYWQgc2lnbmVkIGhleGFkZWNpbWFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JhZEhleCA9IC9eWy0rXTB4WzAtOWEtZl0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmluYXJ5IHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JpbmFyeSA9IC9eMGJbMDFdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IG9jdGFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc09jdGFsID0gL14wb1swLTddKyQvaTtcblxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGBnbG9iYWxgLiAqL1xudmFyIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBudW1iZXIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbnVtYmVyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvTnVtYmVyKDMpO1xuICogLy8gPT4gM1xuICpcbiAqIF8udG9OdW1iZXIoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiA1ZS0zMjRcbiAqXG4gKiBfLnRvTnVtYmVyKEluZmluaXR5KTtcbiAqIC8vID0+IEluZmluaXR5XG4gKlxuICogXy50b051bWJlcignMycpO1xuICogLy8gPT4gM1xuICovXG5mdW5jdGlvbiB0b051bWJlcih2YWx1ZSkge1xuICBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgdmFyIG90aGVyID0gaXNGdW5jdGlvbih2YWx1ZS52YWx1ZU9mKSA/IHZhbHVlLnZhbHVlT2YoKSA6IHZhbHVlO1xuICAgIHZhbHVlID0gaXNPYmplY3Qob3RoZXIpID8gKG90aGVyICsgJycpIDogb3RoZXI7XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gMCA/IHZhbHVlIDogK3ZhbHVlO1xuICB9XG4gIHZhbHVlID0gdmFsdWUucmVwbGFjZShyZVRyaW0sICcnKTtcbiAgdmFyIGlzQmluYXJ5ID0gcmVJc0JpbmFyeS50ZXN0KHZhbHVlKTtcbiAgcmV0dXJuIChpc0JpbmFyeSB8fCByZUlzT2N0YWwudGVzdCh2YWx1ZSkpXG4gICAgPyBmcmVlUGFyc2VJbnQodmFsdWUuc2xpY2UoMiksIGlzQmluYXJ5ID8gMiA6IDgpXG4gICAgOiAocmVJc0JhZEhleC50ZXN0KHZhbHVlKSA/IE5BTiA6ICt2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9OdW1iZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXQgPSBlYXN5R2V0O1xudmFyIHNldCA9IGVhc3lTZXQ7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHBhcnNlKGVsLCBwLnN0YXJ0KTtcbiAgZWwuc2VsZWN0aW9uRW5kID0gcGFyc2UoZWwsIHAuZW5kKTtcbn1cblxuZnVuY3Rpb24gaGFyZFNldCAoZWwsIHApIHtcbiAgdmFyIHJhbmdlID0gZWwuY3JlYXRlVGV4dFJhbmdlKCk7XG5cbiAgaWYgKHAuc3RhcnQgPT09ICdlbmQnICYmIHAuZW5kID09PSAnZW5kJykge1xuICAgIHJhbmdlLmNvbGxhcHNlKGZhbHNlKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZS5jb2xsYXBzZSh0cnVlKTtcbiAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCBwYXJzZShlbCwgcC5lbmQpKTtcbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLnN0YXJ0KSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2UgKGVsLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09ICdlbmQnID8gZWwudmFsdWUubGVuZ3RoIDogdmFsdWUgfHwgMDtcbn1cblxuZnVuY3Rpb24gc2VsbCAoZWwsIHApIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBzZXQoZWwsIHApO1xuICB9XG4gIHJldHVybiBnZXQoZWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNlbGw7XG4iLCIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBzZWxsIGZyb20gJ3NlbGwnO1xuaW1wb3J0IGJ1bGxzZXllIGZyb20gJ2J1bGxzZXllJztcbmltcG9ydCBjcm9zc3ZlbnQgZnJvbSAnY3Jvc3N2ZW50JztcbmltcG9ydCBmdXp6eXNlYXJjaCBmcm9tICdmdXp6eXNlYXJjaCc7XG5pbXBvcnQgZGVib3VuY2UgZnJvbSAnbG9kYXNoL2RlYm91bmNlJztcbmNvbnN0IEtFWV9CQUNLU1BBQ0UgPSA4O1xuY29uc3QgS0VZX0VOVEVSID0gMTM7XG5jb25zdCBLRVlfRVNDID0gMjc7XG5jb25zdCBLRVlfVVAgPSAzODtcbmNvbnN0IEtFWV9ET1dOID0gNDA7XG5jb25zdCBLRVlfVEFCID0gOTtcbmNvbnN0IGRvYyA9IGRvY3VtZW50O1xuY29uc3QgZG9jRWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGF1dG9jb21wbGV0ZSAoZWwsIG9wdGlvbnMpIHtcbiAgY29uc3QgbyA9IG9wdGlvbnMgfHwge307XG4gIGNvbnN0IHBhcmVudCA9IG8uYXBwZW5kVG8gfHwgZG9jLmJvZHk7XG4gIGNvbnN0IHJlbmRlciA9IG8ucmVuZGVyIHx8IGRlZmF1bHRSZW5kZXJlcjtcbiAgY29uc3Qge2dldFRleHQsIGdldFZhbHVlLCBmb3JtLCBzdWdnZXN0aW9ucywgbm9NYXRjaGVzLCBub01hdGNoZXNUZXh0fSA9IG87XG4gIGNvbnN0IGxpbWl0ID0gdHlwZW9mIG8ubGltaXQgPT09ICdudW1iZXInID8gby5saW1pdCA6IEluZmluaXR5O1xuICBjb25zdCB1c2VyRmlsdGVyID0gby5maWx0ZXIgfHwgZGVmYXVsdEZpbHRlcjtcbiAgY29uc3QgdXNlclNldCA9IG8uc2V0IHx8IGRlZmF1bHRTZXR0ZXI7XG4gIGNvbnN0IHVsID0gdGFnKCd1bCcsICd0YWMtbGlzdCcpO1xuICBjb25zdCBjb250YWluZXIgPSB0YWcoJ2RpdicsICd0YWMtY29udGFpbmVyJyk7XG4gIGNvbnN0IGRlZmVycmVkRmlsdGVyaW5nID0gZGVmZXIoZmlsdGVyaW5nKTtcbiAgY29uc3Qgc3RhdGUgPSB7IGNvdW50ZXI6IDAsIHF1ZXJ5OiBudWxsIH07XG4gIGxldCBzZWxlY3Rpb24gPSBudWxsO1xuICBsZXQgZXllO1xuICBsZXQgYXR0YWNobWVudCA9IGVsO1xuICBsZXQgbm9uZU1hdGNoO1xuICBsZXQgdGV4dElucHV0O1xuICBsZXQgYW55SW5wdXQ7XG4gIGxldCByYW5jaG9ybGVmdDtcbiAgbGV0IHJhbmNob3JyaWdodDtcbiAgbGV0IGxhc3RQcmVmaXggPSAnJztcbiAgY29uc3QgZGVib3VuY2VUaW1lID0gby5kZWJvdW5jZSB8fCAzMDA7XG4gIGNvbnN0IGRlYm91bmNlZExvYWRpbmcgPSBkZWJvdW5jZShsb2FkaW5nLCBkZWJvdW5jZVRpbWUpO1xuXG4gIGlmIChvLmF1dG9IaWRlT25CbHVyID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQmx1ciA9IHRydWU7IH1cbiAgaWYgKG8uYXV0b0hpZGVPbkNsaWNrID09PSB2b2lkIDApIHsgby5hdXRvSGlkZU9uQ2xpY2sgPSB0cnVlOyB9XG4gIGlmIChvLmF1dG9TaG93T25VcERvd24gPT09IHZvaWQgMCkgeyBvLmF1dG9TaG93T25VcERvd24gPSBlbC50YWdOYW1lID09PSAnSU5QVVQnOyB9XG4gIGlmIChvLmFuY2hvcikge1xuICAgIHJhbmNob3JsZWZ0ID0gbmV3IFJlZ0V4cCgnXicgKyBvLmFuY2hvcik7XG4gICAgcmFuY2hvcnJpZ2h0ID0gbmV3IFJlZ0V4cChvLmFuY2hvciArICckJyk7XG4gIH1cblxuICBjb25zdCBhcGkgPSB7XG4gICAgYWRkLFxuICAgIGFuY2hvcjogby5hbmNob3IsXG4gICAgY2xlYXIsXG4gICAgc2hvdyxcbiAgICBoaWRlLFxuICAgIHRvZ2dsZSxcbiAgICBkZXN0cm95LFxuICAgIHJlZnJlc2hQb3NpdGlvbixcbiAgICBhcHBlbmRUZXh0LFxuICAgIGFwcGVuZEhUTUwsXG4gICAgZmlsdGVyQW5jaG9yZWRUZXh0LFxuICAgIGZpbHRlckFuY2hvcmVkSFRNTCxcbiAgICBkZWZhdWx0QXBwZW5kVGV4dDogYXBwZW5kVGV4dCxcbiAgICBkZWZhdWx0RmlsdGVyLFxuICAgIGRlZmF1bHRSZW5kZXJlcixcbiAgICBkZWZhdWx0U2V0dGVyLFxuICAgIHJldGFyZ2V0LFxuICAgIGF0dGFjaG1lbnQsXG4gICAgc3VnZ2VzdGlvbnM6IFtdXG4gIH07XG5cbiAgcmV0YXJnZXQoZWwpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodWwpO1xuICBpZiAobm9NYXRjaGVzICYmIG5vTWF0Y2hlc1RleHQpIHtcbiAgICBub25lTWF0Y2ggPSB0YWcoJ2RpdicsICd0YWMtZW1wdHkgdGFjLWhpZGUnKTtcbiAgICB0ZXh0KG5vbmVNYXRjaCwgbm9NYXRjaGVzVGV4dCk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKG5vbmVNYXRjaCk7XG4gIH1cbiAgcGFyZW50LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gIGVsLnNldEF0dHJpYnV0ZSgnYXV0b2NvbXBsZXRlJywgJ29mZicpO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KHN1Z2dlc3Rpb25zKSkge1xuICAgIGxvYWRlZChzdWdnZXN0aW9ucywgZmFsc2UpO1xuICB9XG5cbiAgcmV0dXJuIGFwaTtcblxuICBmdW5jdGlvbiByZXRhcmdldCAoZWwpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBhdHRhY2htZW50ID0gYXBpLmF0dGFjaG1lbnQgPSBlbDtcbiAgICB0ZXh0SW5wdXQgPSBhdHRhY2htZW50LnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgYXR0YWNobWVudC50YWdOYW1lID09PSAnVEVYVEFSRUEnO1xuICAgIGFueUlucHV0ID0gdGV4dElucHV0IHx8IGlzRWRpdGFibGUoYXR0YWNobWVudCk7XG4gICAgaW5wdXRFdmVudHMoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2hQb3NpdGlvbiAoKSB7XG4gICAgaWYgKGV5ZSkgeyBleWUucmVmcmVzaCgpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBsb2FkaW5nIChmb3JjZVNob3cpIHtcbiAgICBpZiAodHlwZW9mIHN1Z2dlc3Rpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjcm9zc3ZlbnQucmVtb3ZlKGF0dGFjaG1lbnQsICdmb2N1cycsIGxvYWRpbmcpO1xuICAgICAgY29uc3QgcXVlcnkgPSByZWFkSW5wdXQoKTtcbiAgICAgIGlmIChxdWVyeSAhPT0gc3RhdGUucXVlcnkpIHtcbiAgICAgICAgc3RhdGUuY291bnRlcisrO1xuICAgICAgICBzdGF0ZS5xdWVyeSA9IHF1ZXJ5O1xuXG4gICAgICAgIGNvbnN0IGNvdW50ZXIgPSBzdGF0ZS5jb3VudGVyO1xuICAgICAgICBzdWdnZXN0aW9ucyh7IHF1ZXJ5LCBsaW1pdCB9LCBmdW5jdGlvbiAocykge1xuICAgICAgICAgIGlmIChzdGF0ZS5jb3VudGVyID09PSBjb3VudGVyKSB7XG4gICAgICAgICAgICBsb2FkZWQocywgZm9yY2VTaG93KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGxvYWRlZCAoc3VnZ2VzdGlvbnMsIGZvcmNlU2hvdykge1xuICAgIGNsZWFyKCk7XG4gICAgYXBpLnN1Z2dlc3Rpb25zID0gW107XG4gICAgc3VnZ2VzdGlvbnMuZm9yRWFjaChhZGQpO1xuICAgIGlmIChmb3JjZVNob3cpIHtcbiAgICAgIHNob3coKTtcbiAgICB9XG4gICAgZmlsdGVyaW5nKCk7XG4gIH1cblxuICBmdW5jdGlvbiBjbGVhciAoKSB7XG4gICAgdW5zZWxlY3QoKTtcbiAgICB3aGlsZSAodWwubGFzdENoaWxkKSB7XG4gICAgICB1bC5yZW1vdmVDaGlsZCh1bC5sYXN0Q2hpbGQpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRJbnB1dCAoKSB7XG4gICAgcmV0dXJuICh0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTCkudHJpbSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkIChzdWdnZXN0aW9uKSB7XG4gICAgY29uc3QgbGkgPSB0YWcoJ2xpJywgJ3RhYy1pdGVtJyk7XG4gICAgcmVuZGVyKGxpLCBzdWdnZXN0aW9uKTtcbiAgICBicmVha3VwRm9ySGlnaGxpZ2h0ZXIobGkpO1xuICAgIGNyb3NzdmVudC5hZGQobGksICdtb3VzZWVudGVyJywgaG92ZXJTdWdnZXN0aW9uKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGxpLCAnY2xpY2snLCBjbGlja2VkU3VnZ2VzdGlvbik7XG4gICAgY3Jvc3N2ZW50LmFkZChsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInLCBmaWx0ZXJJdGVtKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGxpLCAnYXV0b2NvbXBsZXRlLWhpZGUnLCBoaWRlSXRlbSk7XG4gICAgdWwuYXBwZW5kQ2hpbGQobGkpO1xuICAgIGFwaS5zdWdnZXN0aW9ucy5wdXNoKHN1Z2dlc3Rpb24pO1xuICAgIHJldHVybiBsaTtcblxuICAgIGZ1bmN0aW9uIGhvdmVyU3VnZ2VzdGlvbiAoKSB7XG4gICAgICBzZWxlY3Qoc3VnZ2VzdGlvbik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xpY2tlZFN1Z2dlc3Rpb24gKCkge1xuICAgICAgY29uc3QgaW5wdXQgPSBnZXRUZXh0KHN1Z2dlc3Rpb24pO1xuICAgICAgc2V0KHN1Z2dlc3Rpb24pO1xuICAgICAgaGlkZSgpO1xuICAgICAgYXR0YWNobWVudC5mb2N1cygpO1xuICAgICAgbGFzdFByZWZpeCA9IG8ucHJlZml4ICYmIG8ucHJlZml4KGlucHV0LCBhcGkuc3VnZ2VzdGlvbnMuc2xpY2UoKSkgfHwgJyc7XG4gICAgICBpZiAobGFzdFByZWZpeCkge1xuICAgICAgICBlbC52YWx1ZSA9IGxhc3RQcmVmaXg7XG4gICAgICAgIGVsLnNlbGVjdCgpO1xuICAgICAgICBzaG93KCk7XG4gICAgICAgIGZpbHRlcmluZygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbHRlckl0ZW0gKCkge1xuICAgICAgY29uc3QgdmFsdWUgPSByZWFkSW5wdXQoKTtcbiAgICAgIGlmIChmaWx0ZXIodmFsdWUsIHN1Z2dlc3Rpb24pKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSA9IGxpLmNsYXNzTmFtZS5yZXBsYWNlKC8gdGFjLWhpZGUvZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1oaWRlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGlkZUl0ZW0gKCkge1xuICAgICAgaWYgKCFoaWRkZW4obGkpKSB7XG4gICAgICAgIGxpLmNsYXNzTmFtZSArPSAnIHRhYy1oaWRlJztcbiAgICAgICAgaWYgKHNlbGVjdGlvbiA9PT0gbGkpIHtcbiAgICAgICAgICB1bnNlbGVjdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYnJlYWt1cEZvckhpZ2hsaWdodGVyIChlbCkge1xuICAgIGdldFRleHRDaGlsZHJlbihlbCkuZm9yRWFjaChlbCA9PiB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgICAgY29uc3QgdGV4dCA9IGVsLnRleHRDb250ZW50IHx8IGVsLm5vZGVWYWx1ZSB8fCAnJztcbiAgICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBjaGFyIG9mIHRleHQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShzcGFuRm9yKGNoYXIpLCBlbCk7XG4gICAgICB9XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgZnVuY3Rpb24gc3BhbkZvciAoY2hhcikge1xuICAgICAgICBjb25zdCBzcGFuID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgc3Bhbi5jbGFzc05hbWUgPSAndGFjLWNoYXInO1xuICAgICAgICBzcGFuLnRleHRDb250ZW50ID0gc3Bhbi5pbm5lclRleHQgPSBjaGFyO1xuICAgICAgICByZXR1cm4gc3BhbjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodCAoZWwsIG5lZWRsZSkge1xuICAgIGNvbnN0IGNoYXJzID0gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy50YWMtY2hhcicpXTtcblxuICAgIGZvciAobGV0IGlucHV0IG9mIG5lZWRsZSkge1xuICAgICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgICBsZXQgY2hhciA9IGNoYXJzLnNoaWZ0KCk7XG4gICAgICAgIGxldCBjaGFyVGV4dCA9IGNoYXIuaW5uZXJUZXh0IHx8IGNoYXIudGV4dENvbnRlbnQ7XG4gICAgICAgIGlmIChjaGFyVGV4dCA9PT0gaW5wdXQpIHtcbiAgICAgICAgICBvbihjaGFyKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmYoY2hhcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd2hpbGUgKGNoYXJzLmxlbmd0aCkge1xuICAgICAgb2ZmKGNoYXJzLnNoaWZ0KCkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uIChjaCkge1xuICAgICAgY2guY2xhc3NMaXN0LmFkZCgndGFjLWNoYXItaGlnaGxpZ2h0Jyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG9mZiAoY2gpIHtcbiAgICAgIGNoLmNsYXNzTGlzdC5yZW1vdmUoJ3RhYy1jaGFyLWhpZ2hsaWdodCcpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFRleHRDaGlsZHJlbiAoZWwpIHtcbiAgICBjb25zdCB0ZXh0cyA9IFtdO1xuICAgIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWwsIE5vZGVGaWx0ZXIuU0hPV19URVhULCBudWxsLCBmYWxzZSk7XG4gICAgbGV0IG5vZGU7XG4gICAgd2hpbGUgKG5vZGUgPSB3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgdGV4dHMucHVzaChub2RlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRzO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh2YWx1ZSkge1xuICAgIGlmIChvLmFuY2hvcikge1xuICAgICAgcmV0dXJuIChpc1RleHQoKSA/IGFwaS5hcHBlbmRUZXh0IDogYXBpLmFwcGVuZEhUTUwpKHZhbHVlKTtcbiAgICB9XG4gICAgdXNlclNldCh2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXIgKHZhbHVlLCBzdWdnZXN0aW9uKSB7XG4gICAgaWYgKG8uYW5jaG9yKSB7XG4gICAgICBjb25zdCBpbCA9IChpc1RleHQoKSA/IGFwaS5maWx0ZXJBbmNob3JlZFRleHQgOiBhcGkuZmlsdGVyQW5jaG9yZWRIVE1MKSh2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gICAgICByZXR1cm4gaWwgPyB1c2VyRmlsdGVyKGlsLmlucHV0LCBpbC5zdWdnZXN0aW9uKSA6IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdXNlckZpbHRlcih2YWx1ZSwgc3VnZ2VzdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpc1RleHQgKCkgeyByZXR1cm4gaXNJbnB1dChhdHRhY2htZW50KTsgfVxuICBmdW5jdGlvbiB2aXNpYmxlICgpIHsgcmV0dXJuIGNvbnRhaW5lci5jbGFzc05hbWUuaW5kZXhPZigndGFjLXNob3cnKSAhPT0gLTE7IH1cbiAgZnVuY3Rpb24gaGlkZGVuIChsaSkgeyByZXR1cm4gbGkuY2xhc3NOYW1lLmluZGV4T2YoJ3RhYy1oaWRlJykgIT09IC0xOyB9XG5cbiAgZnVuY3Rpb24gc2hvdyAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIGNvbnRhaW5lci5jbGFzc05hbWUgKz0gJyB0YWMtc2hvdyc7XG4gICAgICBleWUucmVmcmVzaCgpO1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLXNob3cnKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0b2dnbGVyIChlKSB7XG4gICAgY29uc3QgbGVmdCA9IGUud2hpY2ggPT09IDEgJiYgIWUubWV0YUtleSAmJiAhZS5jdHJsS2V5O1xuICAgIGlmIChsZWZ0ID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuOyAvLyB3ZSBvbmx5IGNhcmUgYWJvdXQgaG9uZXN0IHRvIGdvZCBsZWZ0LWNsaWNrc1xuICAgIH1cbiAgICB0b2dnbGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvZ2dsZSAoKSB7XG4gICAgaWYgKCF2aXNpYmxlKCkpIHtcbiAgICAgIHNob3coKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdCAoc3VnZ2VzdGlvbikge1xuICAgIHVuc2VsZWN0KCk7XG4gICAgaWYgKHN1Z2dlc3Rpb24pIHtcbiAgICAgIHNlbGVjdGlvbiA9IHN1Z2dlc3Rpb247XG4gICAgICBzZWxlY3Rpb24uY2xhc3NOYW1lICs9ICcgdGFjLXNlbGVjdGVkJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1bnNlbGVjdCAoKSB7XG4gICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgc2VsZWN0aW9uLmNsYXNzTmFtZSA9IHNlbGVjdGlvbi5jbGFzc05hbWUucmVwbGFjZSgvIHRhYy1zZWxlY3RlZC9nLCAnJyk7XG4gICAgICBzZWxlY3Rpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmUgKHVwLCBtb3Zlcykge1xuICAgIGNvbnN0IHRvdGFsID0gdWwuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmICh0b3RhbCA8IG1vdmVzKSB7XG4gICAgICB1bnNlbGVjdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodG90YWwgPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZmlyc3QgPSB1cCA/ICdsYXN0Q2hpbGQnIDogJ2ZpcnN0Q2hpbGQnO1xuICAgIGNvbnN0IG5leHQgPSB1cCA/ICdwcmV2aW91c1NpYmxpbmcnIDogJ25leHRTaWJsaW5nJztcbiAgICBjb25zdCBzdWdnZXN0aW9uID0gc2VsZWN0aW9uICYmIHNlbGVjdGlvbltuZXh0XSB8fCB1bFtmaXJzdF07XG5cbiAgICBzZWxlY3Qoc3VnZ2VzdGlvbik7XG5cbiAgICBpZiAoaGlkZGVuKHN1Z2dlc3Rpb24pKSB7XG4gICAgICBtb3ZlKHVwLCBtb3ZlcyA/IG1vdmVzICsgMSA6IDEpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGUgKCkge1xuICAgIGV5ZS5zbGVlcCgpO1xuICAgIGNvbnRhaW5lci5jbGFzc05hbWUgPSBjb250YWluZXIuY2xhc3NOYW1lLnJlcGxhY2UoLyB0YWMtc2hvdy9nLCAnJyk7XG4gICAgdW5zZWxlY3QoKTtcbiAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGF0dGFjaG1lbnQsICdhdXRvY29tcGxldGUtaGlkZScpO1xuICAgIGlmIChlbC52YWx1ZSA9PT0gbGFzdFByZWZpeCkge1xuICAgICAgZWwudmFsdWUgPSAnJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBrZXlkb3duIChlKSB7XG4gICAgY29uc3Qgc2hvd24gPSB2aXNpYmxlKCk7XG4gICAgY29uc3Qgd2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAod2hpY2ggPT09IEtFWV9ET1dOKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93bikge1xuICAgICAgICBtb3ZlKCk7XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3aGljaCA9PT0gS0VZX1VQKSB7XG4gICAgICBpZiAoYW55SW5wdXQgJiYgby5hdXRvU2hvd09uVXBEb3duKSB7XG4gICAgICAgIHNob3coKTtcbiAgICAgIH1cbiAgICAgIGlmIChzaG93bikge1xuICAgICAgICBtb3ZlKHRydWUpO1xuICAgICAgICBzdG9wKGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAod2hpY2ggPT09IEtFWV9CQUNLU1BBQ0UpIHtcbiAgICAgIGlmIChhbnlJbnB1dCAmJiBvLmF1dG9TaG93T25VcERvd24pIHtcbiAgICAgICAgc2hvdygpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc2hvd24pIHtcbiAgICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKHNlbGVjdGlvbiwgJ2NsaWNrJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGlkZSgpO1xuICAgICAgICB9XG4gICAgICAgIHN0b3AoZSk7XG4gICAgICB9IGVsc2UgaWYgKHdoaWNoID09PSBLRVlfRVNDKSB7XG4gICAgICAgIGhpZGUoKTtcbiAgICAgICAgc3RvcChlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJpbmcgKCkge1xuICAgIGlmICghdmlzaWJsZSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRlYm91bmNlZExvYWRpbmcodHJ1ZSk7XG4gICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShhdHRhY2htZW50LCAnYXV0b2NvbXBsZXRlLWZpbHRlcicpO1xuICAgIGNvbnN0IHZhbHVlID0gcmVhZElucHV0KCk7XG4gICAgbGV0IGxpID0gdWwuZmlyc3RDaGlsZDtcbiAgICBsZXQgY291bnQgPSAwO1xuICAgIHdoaWxlIChsaSkge1xuICAgICAgaWYgKGNvdW50ID49IGxpbWl0KSB7XG4gICAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUobGksICdhdXRvY29tcGxldGUtaGlkZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShsaSwgJ2F1dG9jb21wbGV0ZS1maWx0ZXInKTtcbiAgICAgICAgaWYgKGxpLmNsYXNzTmFtZS5pbmRleE9mKCd0YWMtaGlkZScpID09PSAtMSkge1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgaGlnaGxpZ2h0KGxpLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpID0gbGkubmV4dFNpYmxpbmc7XG4gICAgfVxuICAgIGNvbnN0IG5vbWF0Y2ggPSBub01hdGNoZXMoeyBxdWVyeTogdmFsdWUgfSk7XG4gICAgaWYgKGNvdW50ID09PSAwICYmIG5vbWF0Y2gpIHtcbiAgICAgIG5vbmVNYXRjaC5jbGFzc0xpc3QucmVtb3ZlKCd0YWMtaGlkZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub25lTWF0Y2guY2xhc3NMaXN0LmFkZCgndGFjLWhpZGUnKTtcbiAgICB9XG4gICAgaWYgKCFzZWxlY3Rpb24pIHtcbiAgICAgIG1vdmUoKTtcbiAgICB9XG4gICAgaWYgKCFzZWxlY3Rpb24gJiYgIW5vbWF0Y2gpIHtcbiAgICAgIGhpZGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZlcnJlZEZpbHRlcmluZ05vRW50ZXIgKGUpIHtcbiAgICBjb25zdCB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRlZmVycmVkRmlsdGVyaW5nKCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZlcnJlZFNob3cgKGUpIHtcbiAgICBjb25zdCB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX0VOVEVSIHx8IHdoaWNoID09PSBLRVlfVEFCKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFRpbWVvdXQoc2hvdywgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBhdXRvY29tcGxldGVFdmVudFRhcmdldCAoZSkge1xuICAgIGxldCB0YXJnZXQgPSBlLnRhcmdldDtcbiAgICBpZiAodGFyZ2V0ID09PSBhdHRhY2htZW50KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgaWYgKHRhcmdldCA9PT0gY29udGFpbmVyIHx8IHRhcmdldCA9PT0gYXR0YWNobWVudCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGVPbkJsdXIgKGUpIHtcbiAgICBjb25zdCB3aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmICh3aGljaCA9PT0gS0VZX1RBQikge1xuICAgICAgaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGhpZGVPbkNsaWNrIChlKSB7XG4gICAgaWYgKGF1dG9jb21wbGV0ZUV2ZW50VGFyZ2V0KGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhpZGUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlucHV0RXZlbnRzIChyZW1vdmUpIHtcbiAgICBjb25zdCBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgaWYgKGV5ZSkge1xuICAgICAgZXllLmRlc3Ryb3koKTtcbiAgICAgIGV5ZSA9IG51bGw7XG4gICAgfVxuICAgIGlmICghcmVtb3ZlKSB7XG4gICAgICBleWUgPSBidWxsc2V5ZShjb250YWluZXIsIGF0dGFjaG1lbnQsIHsgY2FyZXQ6IGFueUlucHV0ICYmIGF0dGFjaG1lbnQudGFnTmFtZSAhPT0gJ0lOUFVUJyB9KTtcbiAgICAgIGlmICghdmlzaWJsZSgpKSB7IGV5ZS5zbGVlcCgpOyB9XG4gICAgfVxuICAgIGlmIChyZW1vdmUgfHwgKGFueUlucHV0ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBhdHRhY2htZW50KSkge1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAnZm9jdXMnLCBsb2FkaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZGluZygpO1xuICAgIH1cbiAgICBpZiAoYW55SW5wdXQpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRTaG93KTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleXByZXNzJywgZGVmZXJyZWRGaWx0ZXJpbmcpO1xuICAgICAgY3Jvc3N2ZW50W29wXShhdHRhY2htZW50LCAna2V5ZG93bicsIGRlZmVycmVkRmlsdGVyaW5nTm9FbnRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdwYXN0ZScsIGRlZmVycmVkRmlsdGVyaW5nKTtcbiAgICAgIGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICAgIGlmIChvLmF1dG9IaWRlT25CbHVyKSB7IGNyb3NzdmVudFtvcF0oYXR0YWNobWVudCwgJ2tleWRvd24nLCBoaWRlT25CbHVyKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGF0dGFjaG1lbnQsICdjbGljaycsIHRvZ2dsZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShkb2NFbGVtZW50LCAna2V5ZG93bicsIGtleWRvd24pO1xuICAgIH1cbiAgICBpZiAoby5hdXRvSGlkZU9uQ2xpY2spIHsgY3Jvc3N2ZW50W29wXShkb2MsICdjbGljaycsIGhpZGVPbkNsaWNrKTsgfVxuICAgIGlmIChmb3JtKSB7IGNyb3NzdmVudFtvcF0oZm9ybSwgJ3N1Ym1pdCcsIGhpZGUpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpbnB1dEV2ZW50cyh0cnVlKTtcbiAgICBpZiAocGFyZW50LmNvbnRhaW5zKGNvbnRhaW5lcikpIHsgcGFyZW50LnJlbW92ZUNoaWxkKGNvbnRhaW5lcik7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRTZXR0ZXIgKHZhbHVlKSB7XG4gICAgaWYgKHRleHRJbnB1dCkge1xuICAgICAgZWwudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdFJlbmRlcmVyIChsaSwgc3VnZ2VzdGlvbikge1xuICAgIHRleHQobGksIGdldFRleHQoc3VnZ2VzdGlvbikpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVmYXVsdEZpbHRlciAocSwgc3VnZ2VzdGlvbikge1xuICAgIGNvbnN0IG5lZWRsZSA9IHEudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB0ZXh0ID0gZ2V0VGV4dChzdWdnZXN0aW9uKSB8fCAnJztcbiAgICBpZiAoZnV6enlzZWFyY2gobmVlZGxlLCB0ZXh0LnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBnZXRWYWx1ZShzdWdnZXN0aW9uKSB8fCAnJztcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZnV6enlzZWFyY2gobmVlZGxlLCB2YWx1ZS50b0xvd2VyQ2FzZSgpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvb3BiYWNrVG9BbmNob3IgKHRleHQsIHApIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IGFuY2hvcmVkID0gZmFsc2U7XG4gICAgbGV0IHN0YXJ0ID0gcC5zdGFydDtcbiAgICB3aGlsZSAoYW5jaG9yZWQgPT09IGZhbHNlICYmIHN0YXJ0ID49IDApIHtcbiAgICAgIHJlc3VsdCA9IHRleHQuc3Vic3RyKHN0YXJ0IC0gMSwgcC5zdGFydCAtIHN0YXJ0ICsgMSk7XG4gICAgICBhbmNob3JlZCA9IHJhbmNob3JsZWZ0LnRlc3QocmVzdWx0KTtcbiAgICAgIHN0YXJ0LS07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB0ZXh0OiBhbmNob3JlZCA/IHJlc3VsdCA6IG51bGwsXG4gICAgICBzdGFydFxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZFRleHQgKHEsIHN1Z2dlc3Rpb24pIHtcbiAgICBjb25zdCBwb3NpdGlvbiA9IHNlbGwoZWwpO1xuICAgIGNvbnN0IGlucHV0ID0gbG9vcGJhY2tUb0FuY2hvcihxLCBwb3NpdGlvbikudGV4dDtcbiAgICBpZiAoaW5wdXQpIHtcbiAgICAgIHJldHVybiB7IGlucHV0LCBzdWdnZXN0aW9uIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwZW5kVGV4dCAodmFsdWUpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gZWwudmFsdWU7XG4gICAgY29uc3QgcG9zaXRpb24gPSBzZWxsKGVsKTtcbiAgICBjb25zdCBpbnB1dCA9IGxvb3BiYWNrVG9BbmNob3IoY3VycmVudCwgcG9zaXRpb24pO1xuICAgIGNvbnN0IGxlZnQgPSBjdXJyZW50LnN1YnN0cigwLCBpbnB1dC5zdGFydCk7XG4gICAgY29uc3QgcmlnaHQgPSBjdXJyZW50LnN1YnN0cihpbnB1dC5zdGFydCArIGlucHV0LnRleHQubGVuZ3RoICsgKHBvc2l0aW9uLmVuZCAtIHBvc2l0aW9uLnN0YXJ0KSk7XG4gICAgY29uc3QgYmVmb3JlID0gbGVmdCArIHZhbHVlICsgJyAnO1xuXG4gICAgZWwudmFsdWUgPSBiZWZvcmUgKyByaWdodDtcbiAgICBzZWxsKGVsLCB7IHN0YXJ0OiBiZWZvcmUubGVuZ3RoLCBlbmQ6IGJlZm9yZS5sZW5ndGggfSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJBbmNob3JlZEhUTUwgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQW5jaG9yaW5nIGluIGVkaXRhYmxlIGVsZW1lbnRzIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQuJyk7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBlbmRIVE1MICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuY2hvcmluZyBpbiBlZGl0YWJsZSBlbGVtZW50cyBpcyBkaXNhYmxlZCBieSBkZWZhdWx0LicpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXQgKGVsKSB7IHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7IH1cblxuZnVuY3Rpb24gdGFnICh0eXBlLCBjbGFzc05hbWUpIHtcbiAgY29uc3QgZWwgPSBkb2MuY3JlYXRlRWxlbWVudCh0eXBlKTtcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIGRlZmVyIChmbikgeyByZXR1cm4gZnVuY3Rpb24gKCkgeyBzZXRUaW1lb3V0KGZuLCAwKTsgfTsgfVxuZnVuY3Rpb24gdGV4dCAoZWwsIHZhbHVlKSB7IGVsLmlubmVyVGV4dCA9IGVsLnRleHRDb250ZW50ID0gdmFsdWU7IH1cblxuZnVuY3Rpb24gaXNFZGl0YWJsZSAoZWwpIHtcbiAgY29uc3QgdmFsdWUgPSBlbC5nZXRBdHRyaWJ1dGUoJ2NvbnRlbnRFZGl0YWJsZScpO1xuICBpZiAodmFsdWUgPT09ICdmYWxzZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHZhbHVlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoZWwucGFyZW50RWxlbWVudCkge1xuICAgIHJldHVybiBpc0VkaXRhYmxlKGVsLnBhcmVudEVsZW1lbnQpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IGNyb3NzdmVudCBmcm9tICdjcm9zc3ZlbnQnO1xuaW1wb3J0IGRvbSBmcm9tICcuL2RvbSc7XG5pbXBvcnQgdGV4dCBmcm9tICcuL3RleHQnO1xuY29uc3QgcHJvcHMgPSBbXG4gICdmb250RmFtaWx5JyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd3b3JkU3BhY2luZycsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3dlYmtpdEJveFNpemluZycsXG4gICdtb3pCb3hTaXppbmcnLFxuICAnYm94U2l6aW5nJyxcbiAgJ3BhZGRpbmcnLFxuICAnYm9yZGVyJ1xuXTtcbmNvbnN0IG9mZnNldCA9IDIwO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmYWN0b3J5IChlbCkge1xuICBjb25zdCBtaXJyb3IgPSBkb20oJ3NwYW4nKTtcblxuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1pcnJvcik7XG4gIHJlbWFwKCk7XG4gIGJpbmQoKTtcblxuICByZXR1cm4geyByZW1hcCwgcmVmcmVzaCwgZGVzdHJveSB9O1xuXG4gIGZ1bmN0aW9uIHJlbWFwICgpIHtcbiAgICBjb25zdCBjID0gY29tcHV0ZWQoKTtcbiAgICBsZXQgdmFsdWU7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWUgPSBjW3Byb3BzW2ldXTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gdm9pZCAwICYmIHZhbHVlICE9PSBudWxsKSB7IC8vIG90aGVyd2lzZSBJRSBibG93cyB1cFxuICAgICAgICBtaXJyb3Iuc3R5bGVbcHJvcHNbaV1dID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIG1pcnJvci5kaXNhYmxlZCA9ICdkaXNhYmxlZCc7XG4gICAgbWlycm9yLnN0eWxlLndoaXRlU3BhY2UgPSAncHJlJztcbiAgICBtaXJyb3Iuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIG1pcnJvci5zdHlsZS50b3AgPSBtaXJyb3Iuc3R5bGUubGVmdCA9ICctOTk5OWVtJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2ggKCkge1xuICAgIGNvbnN0IHZhbHVlID0gZWwudmFsdWU7XG4gICAgaWYgKHZhbHVlID09PSBtaXJyb3IudmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0ZXh0KG1pcnJvciwgdmFsdWUpO1xuXG4gICAgY29uc3Qgd2lkdGggPSBtaXJyb3Iub2Zmc2V0V2lkdGggKyBvZmZzZXQ7XG5cbiAgICBlbC5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIGNvbnN0IG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIHJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXl1cCcsIHJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdpbnB1dCcsIHJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdjaGFuZ2UnLCByZWZyZXNoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gICAgbWlycm9yLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQobWlycm9yKTtcbiAgICBlbC5zdHlsZS53aWR0aCA9ICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gY29tcHV0ZWQgKCkge1xuICAgIGlmICh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSkge1xuICAgICAgcmV0dXJuIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICB9XG4gICAgcmV0dXJuIGVsLmN1cnJlbnRTdHlsZTtcbiAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZG9tICh0YWdOYW1lLCBjbGFzc2VzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbiAgaWYgKGNsYXNzZXMpIHtcbiAgICBlbC5jbGFzc05hbWUgPSBjbGFzc2VzO1xuICB9XG4gIHJldHVybiBlbDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmxldCBnZXQgPSBlYXN5R2V0O1xubGV0IHNldCA9IGVhc3lTZXQ7XG5jb25zdCBpbnB1dFRhZyA9IC9pbnB1dC9pO1xuY29uc3QgdGV4dGFyZWFUYWcgPSAvdGV4dGFyZWEvaTtcblxuaWYgKGRvY3VtZW50LnNlbGVjdGlvbiAmJiBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UpIHtcbiAgZ2V0ID0gaGFyZEdldDtcbiAgc2V0ID0gaGFyZFNldDtcbn1cblxuZnVuY3Rpb24gZWFzeUdldCAoZWwpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZWwuc2VsZWN0aW9uU3RhcnQsXG4gICAgZW5kOiBlbC5zZWxlY3Rpb25FbmRcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFyZEdldCAoZWwpIHtcbiAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgaWYgKGFjdGl2ZSAhPT0gZWwpIHtcbiAgICBlbC5mb2N1cygpO1xuICB9XG5cbiAgY29uc3QgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgY29uc3QgYm9va21hcmsgPSByYW5nZS5nZXRCb29rbWFyaygpO1xuICBjb25zdCBvcmlnaW5hbCA9IGVsLnZhbHVlO1xuICBjb25zdCBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICBjb25zdCBwYXJlbnQgPSByYW5nZS5wYXJlbnRFbGVtZW50KCk7XG4gIGlmIChwYXJlbnQgPT09IG51bGwgfHwgIWlucHV0cyhwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdCgwLCAwKTtcbiAgfVxuICByYW5nZS50ZXh0ID0gbWFya2VyICsgcmFuZ2UudGV4dCArIG1hcmtlcjtcblxuICBjb25zdCBjb250ZW50cyA9IGVsLnZhbHVlO1xuXG4gIGVsLnZhbHVlID0gb3JpZ2luYWw7XG4gIHJhbmdlLm1vdmVUb0Jvb2ttYXJrKGJvb2ttYXJrKTtcbiAgcmFuZ2Uuc2VsZWN0KCk7XG5cbiAgcmV0dXJuIHJlc3VsdChjb250ZW50cy5pbmRleE9mKG1hcmtlciksIGNvbnRlbnRzLmxhc3RJbmRleE9mKG1hcmtlcikgLSBtYXJrZXIubGVuZ3RoKTtcblxuICBmdW5jdGlvbiByZXN1bHQgKHN0YXJ0LCBlbmQpIHtcbiAgICBpZiAoYWN0aXZlICE9PSBlbCkgeyAvLyBkb24ndCBkaXNydXB0IHByZS1leGlzdGluZyBzdGF0ZVxuICAgICAgaWYgKGFjdGl2ZSkge1xuICAgICAgICBhY3RpdmUuZm9jdXMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLmJsdXIoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgc3RhcnQ6IHN0YXJ0LCBlbmQ6IGVuZCB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFVuaXF1ZU1hcmtlciAoY29udGVudHMpIHtcbiAgbGV0IG1hcmtlcjtcbiAgZG8ge1xuICAgIG1hcmtlciA9ICdAQG1hcmtlci4nICsgTWF0aC5yYW5kb20oKSAqIG5ldyBEYXRlKCk7XG4gIH0gd2hpbGUgKGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSAhPT0gLTEpO1xuICByZXR1cm4gbWFya2VyO1xufVxuXG5mdW5jdGlvbiBpbnB1dHMgKGVsKSB7XG4gIHJldHVybiAoKGlucHV0VGFnLnRlc3QoZWwudGFnTmFtZSkgJiYgZWwudHlwZSA9PT0gJ3RleHQnKSB8fCB0ZXh0YXJlYVRhZy50ZXN0KGVsLnRhZ05hbWUpKTtcbn1cblxuZnVuY3Rpb24gZWFzeVNldCAoZWwsIHApIHtcbiAgZWwuc2VsZWN0aW9uU3RhcnQgPSBzcGVjaWFsKGVsLCBwLnN0YXJ0KTtcbiAgZWwuc2VsZWN0aW9uRW5kID0gc3BlY2lhbChlbCwgcC5lbmQpO1xufVxuXG5mdW5jdGlvbiBoYXJkU2V0IChlbCwgcCkge1xuICBjb25zdCByYW5nZSA9IGVsLmNyZWF0ZVRleHRSYW5nZSgpO1xuXG4gIGlmIChwLnN0YXJ0ID09PSAnZW5kJyAmJiBwLmVuZCA9PT0gJ2VuZCcpIHtcbiAgICByYW5nZS5jb2xsYXBzZShmYWxzZSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2UuY29sbGFwc2UodHJ1ZSk7XG4gICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgcC5lbmQpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcC5zdGFydCk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BlY2lhbCAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzZWxlY3Rpb24gKGVsLCBwKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgc2V0KGVsLCBwKTtcbiAgfVxuICByZXR1cm4gZ2V0KGVsKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IHN1bSBmcm9tICdoYXNoLXN1bSc7XG5pbXBvcnQgY3Jvc3N2ZW50IGZyb20gJ2Nyb3NzdmVudCc7XG5pbXBvcnQgZW1pdHRlciBmcm9tICdjb250cmEvZW1pdHRlcic7XG5pbXBvcnQgZG9tIGZyb20gJy4vZG9tJztcbmltcG9ydCB0ZXh0IGZyb20gJy4vdGV4dCc7XG5pbXBvcnQgc2VsZWN0aW9uIGZyb20gJy4vc2VsZWN0aW9uJztcbmltcG9ydCBhdXRvc2l6ZSBmcm9tICcuL2F1dG9zaXplJztcbmltcG9ydCBhdXRvY29tcGxldGUgZnJvbSAnLi9hdXRvY29tcGxldGUnO1xuY29uc3QgaW5wdXRUYWcgPSAvXmlucHV0JC9pO1xuY29uc3QgRUxFTUVOVCA9IDE7XG5jb25zdCBCQUNLU1BBQ0UgPSA4O1xuY29uc3QgRU5EID0gMzU7XG5jb25zdCBIT01FID0gMzY7XG5jb25zdCBMRUZUID0gMzc7XG5jb25zdCBSSUdIVCA9IDM5O1xuY29uc3Qgc2lua2FibGVLZXlzID0gW0VORCwgSE9NRV07XG5jb25zdCB0YWdDbGFzcyA9IC9cXGJ0YXktdGFnXFxiLztcbmNvbnN0IHRhZ1JlbW92YWxDbGFzcyA9IC9cXGJ0YXktdGFnLXJlbW92ZVxcYi87XG5jb25zdCBlZGl0b3JDbGFzcyA9IC9cXGJ0YXktZWRpdG9yXFxiL2c7XG5jb25zdCBpbnB1dENsYXNzID0gL1xcYnRheS1pbnB1dFxcYi9nO1xuY29uc3QgZW5kID0geyBzdGFydDogJ2VuZCcsIGVuZDogJ2VuZCcgfTtcbmNvbnN0IGRlZmF1bHREZWxpbWl0ZXIgPSAnICc7XG5cbi8vIG1vZHVsZS5leHBvcnRzIGJlY2F1c2UgYnJvd3NlcmlmeSBzdGFuZGFsb25lXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRhZ2d5IChlbCwgb3B0aW9ucykge1xuICBjb25zdCBjdXJyZW50VmFsdWVzID0gW107XG4gIGNvbnN0IG8gPSBvcHRpb25zIHx8IHt9O1xuICBjb25zdCBkZWxpbWl0ZXIgPSBvLmRlbGltaXRlciB8fCBkZWZhdWx0RGVsaW1pdGVyO1xuICBpZiAoZGVsaW1pdGVyLmxlbmd0aCAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFnZ3kgZXhwZWN0ZWQgYSBzaW5nbGUtY2hhcmFjdGVyIGRlbGltaXRlciBzdHJpbmcnKTtcbiAgfVxuICBjb25zdCBhbnkgPSBoYXNTaWJsaW5ncyhlbCk7XG4gIGlmIChhbnkgfHwgIWlucHV0VGFnLnRlc3QoZWwudGFnTmFtZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ2d5IGV4cGVjdGVkIGFuIGlucHV0IGVsZW1lbnQgd2l0aG91dCBhbnkgc2libGluZ3MnKTtcbiAgfVxuICBjb25zdCBmcmVlID0gby5mcmVlICE9PSBmYWxzZTtcbiAgY29uc3QgdmFsaWRhdGUgPSBvLnZhbGlkYXRlIHx8IGRlZmF1bHRWYWxpZGF0ZTtcbiAgY29uc3QgcmVuZGVyID0gby5yZW5kZXIgfHwgZGVmYXVsdFJlbmRlcmVyO1xuXHRjb25zdCBjb252ZXJ0T25CbHVyID0gby5jb252ZXJ0T25CbHVyICE9PSBmYWxzZTtcblxuICBjb25zdCB0b0l0ZW1EYXRhID0gZGVmYXVsdFRvSXRlbURhdGE7XG5cbiAgY29uc3QgcGFyc2VUZXh0ID0gby5wYXJzZVRleHQ7XG4gIGNvbnN0IHBhcnNlVmFsdWUgPSBvLnBhcnNlVmFsdWU7XG4gIGNvbnN0IGdldFRleHQgPSAoXG4gICAgdHlwZW9mIHBhcnNlVGV4dCA9PT0gJ3N0cmluZycgPyBkID0+IGRbcGFyc2VUZXh0XSA6XG4gICAgdHlwZW9mIHBhcnNlVGV4dCA9PT0gJ2Z1bmN0aW9uJyA/IHBhcnNlVGV4dCA6XG4gICAgZCA9PiBkLnRvU3RyaW5nKClcbiAgKTtcbiAgY29uc3QgZ2V0VmFsdWUgPSAoXG4gICAgdHlwZW9mIHBhcnNlVmFsdWUgPT09ICdzdHJpbmcnID8gZCA9PiBkW3BhcnNlVmFsdWVdIDpcbiAgICB0eXBlb2YgcGFyc2VWYWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IHBhcnNlVmFsdWUgOlxuICAgIGQgPT4gZFxuICApO1xuXG4gIGNvbnN0IGJlZm9yZSA9IGRvbSgnc3BhbicsICd0YXktdGFncyB0YXktdGFncy1iZWZvcmUnKTtcbiAgY29uc3QgYWZ0ZXIgPSBkb20oJ3NwYW4nLCAndGF5LXRhZ3MgdGF5LXRhZ3MtYWZ0ZXInKTtcbiAgY29uc3QgcGFyZW50ID0gZWwucGFyZW50RWxlbWVudDtcbiAgZWwuY2xhc3NOYW1lICs9ICcgdGF5LWlucHV0JztcbiAgcGFyZW50LmNsYXNzTmFtZSArPSAnIHRheS1lZGl0b3InO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGJlZm9yZSwgZWwpO1xuICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGFmdGVyLCBlbC5uZXh0U2libGluZyk7XG5cbiAgY29uc3Qgc2hyaW5rZXIgPSBhdXRvc2l6ZShlbCk7XG4gIGNvbnN0IGNvbXBsZXRlciA9IG8uYXV0b2NvbXBsZXRlID8gY3JlYXRlQXV0b2NvbXBsZXRlKCkgOiBudWxsO1xuICBjb25zdCBhcGkgPSBlbWl0dGVyKHtcbiAgICBhZGRJdGVtLFxuICAgIGZpbmRJdGVtOiBkYXRhID0+IGZpbmRJdGVtKGRhdGEpLFxuICAgIGZpbmRJdGVtQnlFbGVtZW50OiBlbCA9PiBmaW5kSXRlbShlbCwgJ2VsJyksXG4gICAgcmVtb3ZlSXRlbTogcmVtb3ZlSXRlbUJ5RGF0YSxcbiAgICByZW1vdmVJdGVtQnlFbGVtZW50LFxuICAgIHZhbHVlOiByZWFkVmFsdWUsXG4gICAgZGVzdHJveVxuICB9KTtcblxuICBjb25zdCBwbGFjZWhvbGRlciA9IGVsLmdldEF0dHJpYnV0ZSgncGxhY2Vob2xkZXInKTtcbiAgbGV0IHBsYWNlaGVsZCA9IHRydWU7XG5cbiAgYmluZCgpO1xuXG4gIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBlbCA/XG4gICAgZXZhbHVhdGVTZWxlY3QgOlxuICAgIGV2YWx1YXRlTm9TZWxlY3RcbiAgKShbZGVsaW1pdGVyXSwgdHJ1ZSk7XG5cbiAgcmV0dXJuIGFwaTtcblxuICBmdW5jdGlvbiBmaW5kSXRlbSAodmFsdWUsIHByb3ApIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnRWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjdXJyZW50VmFsdWVzW2ldW3Byb3AgfHwgJ2RhdGEnXSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRWYWx1ZXNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkSXRlbSAoZGF0YSkge1xuICAgIGNvbnN0IHZhbGlkID0gdmFsaWRhdGUoZGF0YSk7XG4gICAgY29uc3QgaXRlbSA9IHsgZGF0YSwgdmFsaWQgfTtcbiAgICBpZiAoby5wcmV2ZW50SW52YWxpZCkge1xuICAgICAgcmV0dXJuIGFwaTtcbiAgICB9XG4gICAgY29uc3QgZWwgPSByZW5kZXJJdGVtKGl0ZW0pO1xuICAgIGlmICghZWwpIHtcbiAgICAgIHJldHVybiBhcGk7XG4gICAgfVxuICAgIGl0ZW0uZWwgPSBlbDtcbiAgICBjdXJyZW50VmFsdWVzLnB1c2goaXRlbSk7XG4gICAgYXBpLmVtaXQoJ2FkZCcsIGRhdGEsIGVsKTtcbiAgICBpbnZhbGlkYXRlKCk7XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW0gKGl0ZW0pIHtcbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIHJldHVybiBhcGk7XG4gICAgfVxuICAgIHJlbW92ZUl0ZW1FbGVtZW50KGl0ZW0uZWwpO1xuICAgIGN1cnJlbnRWYWx1ZXMuc3BsaWNlKGN1cnJlbnRWYWx1ZXMuaW5kZXhPZihpdGVtKSwgMSk7XG4gICAgYXBpLmVtaXQoJ3JlbW92ZScsIGl0ZW0uZGF0YSk7XG4gICAgaW52YWxpZGF0ZSgpO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBmdW5jdGlvbiBpbnZhbGlkYXRlICgpIHtcbiAgICBjdXJyZW50VmFsdWVzLnNsaWNlKCkuZm9yRWFjaCgodixpKSA9PiB7XG4gICAgICBjdXJyZW50VmFsdWVzLnNwbGljZShpLCAxKTtcblxuICAgICAgY29uc3QgdmFsaWQgPSB2YWxpZGF0ZSh2LmRhdGEpO1xuICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgIHYuZWwuY2xhc3NMaXN0LmFkZCgndGF5LXZhbGlkJyk7XG4gICAgICAgIHYuZWwuY2xhc3NMaXN0LnJlbW92ZSgndGF5LWludmFsaWQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHYuZWwuY2xhc3NMaXN0LmFkZCgndGF5LWludmFsaWQnKTtcbiAgICAgICAgdi5lbC5jbGFzc0xpc3QucmVtb3ZlKCd0YXktdmFsaWQnKTtcbiAgICAgICAgYXBpLmVtaXQoJ2ludmFsaWQnLCB2LmRhdGEsIHYuZWwpO1xuICAgICAgfVxuICAgICAgdi52YWxpZCA9IHZhbGlkO1xuXG4gICAgICBjdXJyZW50VmFsdWVzLnNwbGljZShpLCAwLCB2KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZUl0ZW1CeURhdGEgKGRhdGEpIHtcbiAgICByZXR1cm4gcmVtb3ZlSXRlbShmaW5kSXRlbShkYXRhKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVJdGVtQnlFbGVtZW50IChlbCkge1xuICAgIHJldHVybiByZW1vdmVJdGVtKGZpbmRJdGVtKGVsLCAnZWwnKSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJJdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRhZyhiZWZvcmUsIGl0ZW0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlSXRlbUVsZW1lbnQgKGVsKSB7XG4gICAgaWYgKGVsLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIGVsLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVRhZyAoYnVmZmVyLCBpdGVtKSB7XG4gICAgY29uc3Qge2RhdGF9ID0gaXRlbTtcbiAgICBjb25zdCBlbXB0eSA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyAmJiBkYXRhLnRyaW0oKS5sZW5ndGggPT09IDA7XG4gICAgaWYgKGVtcHR5KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZWwgPSBkb20oJ3NwYW4nLCAndGF5LXRhZycpO1xuICAgIHJlbmRlcihlbCwgaXRlbSk7XG4gICAgaWYgKG8uZGVsZXRpb24pIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGRvbSgnc3BhbicsICd0YXktdGFnLXJlbW92ZScpKTtcbiAgICB9XG4gICAgYnVmZmVyLmFwcGVuZENoaWxkKGVsKTtcbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VG9JdGVtRGF0YSAocykge1xuICAgIHJldHVybiBzO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFZhbHVlICgpIHtcbiAgICByZXR1cm4gY3VycmVudFZhbHVlcy5maWx0ZXIodiA9PiB2LnZhbGlkKS5tYXAodiA9PiB2LmRhdGEpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQXV0b2NvbXBsZXRlICgpIHtcbiAgICBjb25zdCBjb25maWcgPSBvLmF1dG9jb21wbGV0ZTtcbiAgICBjb25zdCBwcmVmaXggPSBjb25maWcucHJlZml4O1xuICAgIGNvbnN0IGNhY2hpbmcgPSBjb25maWcuY2FjaGUgIT09IGZhbHNlO1xuICAgIGNvbnN0IGNhY2hlID0gY29uZmlnLmNhY2hlIHx8IHt9O1xuICAgIGNvbnN0IHNvdXJjZSA9IGNvbmZpZy5zdWdnZXN0aW9ucztcbiAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBsaW1pdCA9IE51bWJlcihjb25maWcubGltaXQpIHx8IEluZmluaXR5O1xuICAgIGNvbnN0IGNvbXBsZXRlciA9IGF1dG9jb21wbGV0ZShlbCwge1xuICAgICAgc3VnZ2VzdGlvbnMsXG4gICAgICBsaW1pdCxcbiAgICAgIGdldFRleHQsXG4gICAgICBnZXRWYWx1ZSxcbiAgICAgIHByZWZpeCxcbiAgICAgIG5vTWF0Y2hlcyxcbiAgICAgIG5vTWF0Y2hlc1RleHQ6IGNvbmZpZy5ub01hdGNoZXMsXG4gICAgICBkZWJvdW5jZTogY29uZmlnLmRlYm91bmNlLFxuICAgICAgc2V0IChzKSB7XG4gICAgICAgIGVsLnZhbHVlID0gJyc7XG4gICAgICAgIGFkZEl0ZW0ocyk7XG4gICAgICB9LFxuICAgICAgZmlsdGVyIChxLCBzdWdnZXN0aW9uKSB7XG4gICAgICAgIGlmIChjb25maWcuZHVwbGljYXRlcyAhPT0gZmFsc2UgJiYgZmluZEl0ZW0oc3VnZ2VzdGlvbikpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZpZy5maWx0ZXIpIHtcbiAgICAgICAgICByZXR1cm4gY29uZmlnLmZpbHRlcihxLCBzdWdnZXN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcGxldGVyLmRlZmF1bHRGaWx0ZXIocSwgc3VnZ2VzdGlvbik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvbXBsZXRlcjtcbiAgICBmdW5jdGlvbiBub01hdGNoZXMgKGRhdGEpIHtcbiAgICAgIGlmICghY29uZmlnLm5vTWF0Y2hlcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0YS5xdWVyeS5sZW5ndGg7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHN1Z2dlc3Rpb25zIChkYXRhLCBkb25lKSB7XG4gICAgICBjb25zdCB7cXVlcnl9ID0gZGF0YTtcbiAgICAgIGlmICghY29uZmlnLmJsYW5rU2VhcmNoICYmIHF1ZXJ5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBkb25lKFtdKTsgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXBpLmVtaXQoJ2F1dG9jb21wbGV0ZS5iZWZvcmVVcGRhdGUnKTtcbiAgICAgIGNvbnN0IGhhc2ggPSBzdW0ocXVlcnkpOyAvLyBmYXN0LCBjYXNlIGluc2Vuc2l0aXZlLCBwcmV2ZW50cyBjb2xsaXNpb25zXG4gICAgICBpZiAoY2FjaGluZykge1xuICAgICAgICBjb25zdCBlbnRyeSA9IGNhY2hlW2hhc2hdO1xuICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICBjb25zdCBzdGFydCA9IGVudHJ5LmNyZWF0ZWQuZ2V0VGltZSgpO1xuICAgICAgICAgIGNvbnN0IGR1cmF0aW9uID0gY2FjaGUuZHVyYXRpb24gfHwgNjAgKiA2MCAqIDI0O1xuICAgICAgICAgIGNvbnN0IGRpZmYgPSBkdXJhdGlvbiAqIDEwMDA7XG4gICAgICAgICAgY29uc3QgZnJlc2ggPSBuZXcgRGF0ZShzdGFydCArIGRpZmYpID4gbmV3IERhdGUoKTtcbiAgICAgICAgICBpZiAoZnJlc2gpIHtcbiAgICAgICAgICAgIGRvbmUoZW50cnkuaXRlbXMpOyByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25maWdcbiAgICAgICAgLnN1Z2dlc3Rpb25zKGRhdGEpXG4gICAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHQgOiBbXTtcbiAgICAgICAgICBpZiAoY2FjaGluZykge1xuICAgICAgICAgICAgY2FjaGVbaGFzaF0gPSB7IGNyZWF0ZWQ6IG5ldyBEYXRlKCksIGl0ZW1zIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIGRvbmUoaXRlbXMpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdBdXRvY29tcGxldGUgc3VnZ2VzdGlvbnMgcHJvbWlzZSByZWplY3RlZCcsIGVycm9yLCBlbCk7XG4gICAgICAgICAgZG9uZShbXSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZVBsYWNlaG9sZGVyIChlKSB7XG4gICAgY29uc3QgYW55ID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy50YXktdGFnJyk7XG4gICAgaWYgKCFhbnkgJiYgIXBsYWNlaGVsZCkge1xuICAgICAgZWwuc2V0QXR0cmlidXRlKCdwbGFjZWhvbGRlcicsIHBsYWNlaG9sZGVyKTtcbiAgICAgIHBsYWNlaGVsZCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChhbnkgJiYgcGxhY2VoZWxkKSB7XG4gICAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJyk7XG4gICAgICBwbGFjZWhlbGQgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICBjb25zdCBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY29uc3QgZXYgPSByZW1vdmUgPyAnb2ZmJyA6ICdvbic7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCBrZXlkb3duKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5cHJlc3MnLCBrZXlwcmVzcyk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgcGFzdGUpO1xuICAgIGNyb3NzdmVudFtvcF0ocGFyZW50LCAnY2xpY2snLCBjbGljayk7XG5cdFx0aWYgKGNvbnZlcnRPbkJsdXIpIHtcbiAgICAgIGNyb3NzdmVudFtvcF0oZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCAnYmx1cicsIGRvY3VtZW50Ymx1ciwgdHJ1ZSk7XG4gICAgfVxuICAgIGlmIChwbGFjZWhvbGRlcikge1xuICAgICAgYXBpW2V2XSgnYWRkJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgYXBpW2V2XSgncmVtb3ZlJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5cHJlc3MnLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCB1cGRhdGVQbGFjZWhvbGRlcik7XG4gICAgICBjcm9zc3ZlbnRbb3BdKHBhcmVudCwgJ2NsaWNrJywgdXBkYXRlUGxhY2Vob2xkZXIpO1xuICAgICAgdXBkYXRlUGxhY2Vob2xkZXIoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICAgIGlmIChjb21wbGV0ZXIpIHsgY29tcGxldGVyLmRlc3Ryb3koKTsgfVxuICAgIGVsLnZhbHVlID0gJyc7XG4gICAgZWwuY2xhc3NOYW1lID0gZWwuY2xhc3NOYW1lLnJlcGxhY2UoaW5wdXRDbGFzcywgJycpO1xuICAgIHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UoZWRpdG9yQ2xhc3MsICcnKTtcbiAgICBpZiAoYmVmb3JlLnBhcmVudEVsZW1lbnQpIHsgYmVmb3JlLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoYmVmb3JlKTsgfVxuICAgIGlmIChhZnRlci5wYXJlbnRFbGVtZW50KSB7IGFmdGVyLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoYWZ0ZXIpOyB9XG4gICAgc2hyaW5rZXIuZGVzdHJveSgpO1xuICAgIGFwaS5kZXN0cm95ZWQgPSB0cnVlO1xuICAgIGFwaS5kZXN0cm95ID0gYXBpLmFkZEl0ZW0gPSBhcGkucmVtb3ZlSXRlbSA9ICgpID0+IGFwaTtcbiAgICBhcGkudGFncyA9IGFwaS52YWx1ZSA9ICgpID0+IG51bGw7XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRvY3VtZW50Ymx1ciAoZSkge1xuICAgIGlmIChlLnRhcmdldCAhPT0gZWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29udmVydCh0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsaWNrIChlKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQ7XG4gICAgaWYgKHRhZ1JlbW92YWxDbGFzcy50ZXN0KHRhcmdldC5jbGFzc05hbWUpKSB7XG4gICAgICBmb2N1c1RhZyh0YXJnZXQucGFyZW50RWxlbWVudCwgeyBzdGFydDogJ2VuZCcsIGVuZDogJ2VuZCcsIHJlbW92ZTogdHJ1ZSB9KTtcbiAgICAgIHNoaWZ0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCB0b3AgPSB0YXJnZXQ7XG4gICAgbGV0IHRhZ2dlZCA9IHRhZ0NsYXNzLnRlc3QodG9wLmNsYXNzTmFtZSk7XG4gICAgd2hpbGUgKHRhZ2dlZCA9PT0gZmFsc2UgJiYgdG9wLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgIHRvcCA9IHRvcC5wYXJlbnRFbGVtZW50O1xuICAgICAgdGFnZ2VkID0gdGFnQ2xhc3MudGVzdCh0b3AuY2xhc3NOYW1lKTtcbiAgICB9XG4gICAgaWYgKHRhZ2dlZCAmJiBmcmVlKSB7XG4gICAgICBmb2N1c1RhZyh0b3AsIGVuZCk7XG4gICAgfSBlbHNlIGlmICh0YXJnZXQgIT09IGVsKSB7XG4gICAgICBzaGlmdCgpO1xuICAgICAgZWwuZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzaGlmdCAoKSB7XG4gICAgZm9jdXNUYWcoYWZ0ZXIubGFzdENoaWxkLCBlbmQpO1xuICAgIGV2YWx1YXRlU2VsZWN0KFtkZWxpbWl0ZXJdLCB0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnZlcnQgKGFsbCkge1xuICAgIChhbGwgPyBldmFsdWF0ZU5vU2VsZWN0IDogZXZhbHVhdGVTZWxlY3QpKFtkZWxpbWl0ZXJdLCBhbGwpO1xuICAgIGlmIChhbGwpIHtcbiAgICAgIGVhY2goYWZ0ZXIsIG1vdmVMZWZ0KTtcbiAgICB9XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmVMZWZ0ICh2YWx1ZSwgdGFnKSB7XG4gICAgYmVmb3JlLmFwcGVuZENoaWxkKHRhZyk7XG4gIH1cblxuICBmdW5jdGlvbiBrZXlkb3duIChlKSB7XG4gICAgY29uc3Qgc2VsID0gc2VsZWN0aW9uKGVsKTtcbiAgICBjb25zdCBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIGNvbnN0IGNhbk1vdmVMZWZ0ID0gc2VsLnN0YXJ0ID09PSAwICYmIHNlbC5lbmQgPT09IDAgJiYgYmVmb3JlLmxhc3RDaGlsZDtcbiAgICBjb25zdCBjYW5Nb3ZlUmlnaHQgPSBzZWwuc3RhcnQgPT09IGVsLnZhbHVlLmxlbmd0aCAmJiBzZWwuZW5kID09PSBlbC52YWx1ZS5sZW5ndGggJiYgYWZ0ZXIuZmlyc3RDaGlsZDtcbiAgICBpZiAoZnJlZSkge1xuICAgICAgaWYgKGtleSA9PT0gSE9NRSkge1xuICAgICAgICBpZiAoYmVmb3JlLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICBmb2N1c1RhZyhiZWZvcmUuZmlyc3RDaGlsZCwge30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGVjdGlvbihlbCwgeyBzdGFydDogMCwgZW5kOiAwIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gRU5EKSB7XG4gICAgICAgIGlmIChhZnRlci5sYXN0Q2hpbGQpIHtcbiAgICAgICAgICBmb2N1c1RhZyhhZnRlci5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZWN0aW9uKGVsLCBlbmQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gQkFDS1NQQUNFICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIGZvY3VzVGFnKGJlZm9yZS5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gUklHSFQgJiYgY2FuTW92ZVJpZ2h0KSB7XG4gICAgICAgIGZvY3VzVGFnKGFmdGVyLmZpcnN0Q2hpbGQsIHt9KTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBMRUZUICYmIGNhbk1vdmVMZWZ0KSB7XG4gICAgICAgIGZvY3VzVGFnKGJlZm9yZS5sYXN0Q2hpbGQsIGVuZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChrZXkgPT09IEJBQ0tTUEFDRSAmJiBjYW5Nb3ZlTGVmdCkge1xuICAgICAgICByZW1vdmVJdGVtQnlFbGVtZW50KGJlZm9yZS5sYXN0Q2hpbGQpO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IFJJR0hUICYmIGNhbk1vdmVSaWdodCkge1xuICAgICAgICBiZWZvcmUuYXBwZW5kQ2hpbGQoYWZ0ZXIuZmlyc3RDaGlsZCk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gTEVGVCAmJiBjYW5Nb3ZlTGVmdCkge1xuICAgICAgICBhZnRlci5pbnNlcnRCZWZvcmUoYmVmb3JlLmxhc3RDaGlsZCwgYWZ0ZXIuZmlyc3RDaGlsZCk7XG4gICAgICB9IGVsc2UgaWYgKHNpbmthYmxlS2V5cy5pbmRleE9mKGtleSkgPT09IC0xKSB7IC8vIHByZXZlbnQgZGVmYXVsdCBvdGhlcndpc2VcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGNvbXBsZXRlcikgeyBjb21wbGV0ZXIucmVmcmVzaFBvc2l0aW9uKCk7IH1cbiAgICB9XG5cbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24ga2V5cHJlc3MgKGUpIHtcbiAgICBjb25zdCBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZSB8fCBlLmNoYXJDb2RlO1xuICAgIGlmIChTdHJpbmcuZnJvbUNoYXJDb2RlKGtleSkgPT09IGRlbGltaXRlcikge1xuICAgICAgY29udmVydCgpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhc3RlICgpIHtcbiAgICBzZXRUaW1lb3V0KCgpID0+IGV2YWx1YXRlU2VsZWN0KCksIDApO1xuICB9XG5cbiAgZnVuY3Rpb24gZXZhbHVhdGVOb1NlbGVjdCAoZXh0cmFzLCBlbnRpcmVseSkge1xuICAgIGV2YWx1YXRlSW50ZXJuYWwoZXh0cmFzLCBlbnRpcmVseSk7IC8vIG5lY2Vzc2FyeSBmb3IgYmx1ciBldmVudHMsIGluaXRpYWxpemF0aW9uLCB1bmZvY3VzZWQgZXZhbHVhdGlvblxuICB9XG5cbiAgZnVuY3Rpb24gZXZhbHVhdGVTZWxlY3QgKGV4dHJhcywgZW50aXJlbHkpIHtcbiAgICBldmFsdWF0ZUludGVybmFsKGV4dHJhcywgZW50aXJlbHksIHNlbGVjdGlvbihlbCkpOyAvLyBvbmx5IGlmIHdlIGtub3cgdGhlIGlucHV0IGhhcy9zaG91bGQgaGF2ZSBmb2N1c1xuICB9XG5cbiAgZnVuY3Rpb24gZXZhbHVhdGVJbnRlcm5hbCAoZXh0cmFzLCBlbnRpcmVseSwgcCkge1xuICAgIGNvbnN0IGxlbiA9IGVudGlyZWx5IHx8ICFwID8gSW5maW5pdHkgOiBwLnN0YXJ0O1xuICAgIGNvbnN0IHRhZ3MgPSBlbC52YWx1ZS5zbGljZSgwLCBsZW4pLmNvbmNhdChleHRyYXMgfHwgW10pLnNwbGl0KGRlbGltaXRlcik7XG4gICAgaWYgKHRhZ3MubGVuZ3RoIDwgMSB8fCAhZnJlZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3QgPSB0YWdzLnBvcCgpICsgZWwudmFsdWUuc2xpY2UobGVuKTtcbiAgICBjb25zdCByZW1vdmFsID0gdGFncy5qb2luKGRlbGltaXRlcikubGVuZ3RoO1xuXG4gICAgdGFncy5mb3JFYWNoKHRhZyA9PiBhZGRJdGVtKHRvSXRlbURhdGEodGFnKSkpO1xuICAgIGVsLnZhbHVlID0gcmVzdDtcbiAgICByZXNlbGVjdCgpO1xuICAgIHNocmlua2VyLnJlZnJlc2goKTtcblxuICAgIGZ1bmN0aW9uIHJlc2VsZWN0ICgpIHtcbiAgICAgIGlmIChwKSB7XG4gICAgICAgIHAuc3RhcnQgLT0gcmVtb3ZhbDtcbiAgICAgICAgcC5lbmQgLT0gcmVtb3ZhbDtcbiAgICAgICAgc2VsZWN0aW9uKGVsLCBwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0UmVuZGVyZXIgKGNvbnRhaW5lciwgaXRlbSkge1xuICAgIHRleHQoY29udGFpbmVyLCBnZXRUZXh0KGl0ZW0uZGF0YSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFRhZyAodGFnKSB7XG4gICAgcmV0dXJuIHRleHQodGFnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvY3VzVGFnICh0YWcsIHApIHtcbiAgICBpZiAoIXRhZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGVjdChbZGVsaW1pdGVyXSwgdHJ1ZSk7XG4gICAgY29uc3QgcGFyZW50ID0gdGFnLnBhcmVudEVsZW1lbnQ7XG4gICAgaWYgKHBhcmVudCA9PT0gYmVmb3JlKSB7XG4gICAgICB3aGlsZSAocGFyZW50Lmxhc3RDaGlsZCAhPT0gdGFnKSB7XG4gICAgICAgIGFmdGVyLmluc2VydEJlZm9yZShwYXJlbnQubGFzdENoaWxkLCBhZnRlci5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKHBhcmVudC5maXJzdENoaWxkICE9PSB0YWcpIHtcbiAgICAgICAgYmVmb3JlLmFwcGVuZENoaWxkKHBhcmVudC5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBwLnJlbW92ZSA/ICcnIDogcmVhZFRhZyh0YWcpO1xuICAgIHJlbW92ZUl0ZW1CeUVsZW1lbnQodGFnKTtcbiAgICBlbC52YWx1ZSA9IHZhbHVlO1xuICAgIGVsLmZvY3VzKCk7XG4gICAgc2VsZWN0aW9uKGVsLCBwKTtcbiAgICBzaHJpbmtlci5yZWZyZXNoKCk7XG4gIH1cblxuICBmdW5jdGlvbiBoYXNTaWJsaW5ncyAoKSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBlbC5wYXJlbnRFbGVtZW50LmNoaWxkcmVuO1xuICAgIHJldHVybiBbLi4uY2hpbGRyZW5dLnNvbWUocyA9PiBzICE9PSBlbCAmJiBzLm5vZGVUeXBlID09PSBFTEVNRU5UKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVhY2ggKGNvbnRhaW5lciwgZm4pIHtcbiAgICBbLi4uY29udGFpbmVyLmNoaWxkcmVuXS5mb3JFYWNoKCh0YWcsIGkpID0+IGZuKHJlYWRUYWcodGFnKSwgdGFnLCBpKSk7XG4gIH1cblxuICBmdW5jdGlvbiBkZWZhdWx0VmFsaWRhdGUgKHZhbHVlKSB7XG4gICAgcmV0dXJuIGZpbmRJdGVtKHZhbHVlKSA9PT0gbnVsbDtcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0ZXh0IChlbCwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBlbC5pbm5lclRleHQgPSBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICB9XG4gIGlmICh0eXBlb2YgZWwuaW5uZXJUZXh0ID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlbC5pbm5lclRleHQ7XG4gIH1cbiAgcmV0dXJuIGVsLnRleHRDb250ZW50O1xufVxuIl19
