// Multi-loop refactoring script
// Converts single-loop model to multi-loop with round-robin alternation
// Usage: node _multi_loop_refactor.js

const fs = require("fs");
const p = "extension/webview/index.js";
let s = fs.readFileSync(p, "utf8");
const orig = s;
let changes = [];

function replace(oldStr, newStr, label) {
  const count = (s.match(new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count === 0) { console.log(`SKIP ${label}: not found`); return false; }
  if (count > 1) { console.log(`WARN ${label}: ${count} matches, replacing all`); }
  s = s.split(oldStr).join(newStr);
  changes.push(label);
  console.log(`OK ${label} (${count} replacement(s))`);
  return true;
}

// ====== 1. LOOP_MARK extraction helpers ======
// Old: LOOP_MARK + sourceText
// New: LOOP_MARK + loopId + "\x00" + sourceText

// _isLoopMark: check if starts with LOOP_MARK
// _loopId(t): extract loopId from marked text
// _loopOrig(t): extract sourceText from marked text
// _makeLoopMarked(loopId, sourceText): create marked text

// Replace LOOP_MARK definition and helpers
const oldLoopMarkBlock = '  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopOrig(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length) : t; }';

const newLoopMarkBlock = '  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  var LOOP_SEP = "\\x00";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }\n  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }\n  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }';

replace(oldLoopMarkBlock, newLoopMarkBlock, "1. LOOP_MARK helpers");

// ====== 2. Replace LOOP_MARK + text with _makeLoopMarked(loopId, text) in key spots ======
// We'll fix _enqueueLoopItem and _doPoll manually, but other spots need updating

// In _enqueueLoopItem: LOOP_MARK + sourceText → _makeLoopMarked(loopId, sourceText)
// In _doPoll re-enqueue: LOOP_MARK + _loop.sourceText

// Let's handle these in the specific function rewrites below.

// ====== 3. Keep _stripLoopMarks (used on reload) but remove _stripOptMarks dependency ======
// _stripLoopMarks needs to still work but now strips LOOP_MARK+loopId+SEP+text → text
// Actually _loopOrig already handles this, so _stripLoopMarks(arr) = arr.map(_loopOrig)

// ====== 4. _state.loop → _state.loops (object indexed by loopId) ======
// Add loopId counter

// Insert loopId counter after _stripLoopMarks
const oldStripper = 'function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }';
const newStripper = 'function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }\n  var _nextLoopId = 0;\n  function _nextLid() { return "l" + (++_nextLoopId); }';
replace(oldStripper, newStripper, "2. loopId counter");

// ====== 5. Rewrite _enqueueLoopItem ======
const oldEnqueueItem = `  function _enqueueLoopItem(sourceText) {
    var _sid = Z.sessionId.value;
    var _key = _ensurePSKey();
    var _marked = LOOP_MARK + sourceText;
    var _intervalMin = parseInt(Z.loopIntervalMinutes?.value, 10) || 0;
    var _loopMeta = { enabled: true, sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, nextLoopAt: null };
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (_existing) {
      _existing.texts.push(_marked);
      if (!_existing.loop) _existing.loop = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loop: _existing.loop }));
      _createPreview(_existing.texts);
    } else {
      var texts = [_marked];
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loop: _loopMeta }));
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loop: _loopMeta });
    }
  }`;

const newEnqueueItem = `  function _enqueueLoopItem(sourceText) {
    var _sid = Z.sessionId.value;
    var _key = _ensurePSKey();
    var _lid = _nextLid();
    var _marked = _makeLoopMarked(_lid, sourceText);
    var _intervalMin = parseInt(Z.loopIntervalMinutes?.value, 10) || 0;
    var _loopMeta = { sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, ttlStartedAt: null, nextLoopAt: null };
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (_existing) {
      _existing.texts.push(_marked);
      if (!_existing.loops) _existing.loops = {};
      _existing.loops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));
      _createPreview(_existing.texts);
    } else {
      var texts = [_marked];
      var _loops = {}; _loops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _loops }));
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _loops });
    }
  }`;

if (s.indexOf(oldEnqueueItem) >= 0) {
  s = s.split(oldEnqueueItem).join(newEnqueueItem);
  changes.push("3. _enqueueLoopItem multi-loop");
  console.log("OK 3. _enqueueLoopItem");
} else { console.log("SKIP 3. _enqueueLoopItem"); }

// ====== 6. _insertNormalBeforeLoop → insert before any loop item ======
// When adding a normal message, insert before the FIRST loop-marked item
// (all loop items cluster together at the end, normal items before them)
const oldInsertNormal = `  function _insertNormalBeforeLoop(text) {
    var _sid = Z.sessionId.value;
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (!_existing) { _enqueueLoopItem(text); return; }
    // 找到最后一个循环占位符的位置，插入到它之前
    var _lastLoopIdx = -1;
    for (var i = _existing.texts.length - 1; i >= 0; i--) {
      if (_isLoopMark(_existing.texts[i])) { _lastLoopIdx = i; break; }
    }
    if (_lastLoopIdx < 0) _existing.texts.push(text);
    else _existing.texts.splice(_lastLoopIdx, 0, text);
    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loop: _existing.loop }));
    _createPreview(_existing.texts);
  }`;

const newInsertNormal = `  function _insertNormalBeforeLoop(text) {
    var _sid = Z.sessionId.value;
    var _key = _ensurePSKey();
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (!_existing) {
      var texts = [text];
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: {} });
      return;
    }
    // 找到第一个循环占位符，插入到它之前（所有循环项在后面，普通项在前面）
    var _firstLoopIdx = -1;
    for (var i = 0; i < _existing.texts.length; i++) {
      if (_isLoopMark(_existing.texts[i])) { _firstLoopIdx = i; break; }
    }
    if (_firstLoopIdx < 0) _existing.texts.push(text);
    else _existing.texts.splice(_firstLoopIdx, 0, text);
    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));
    _createPreview(_existing.texts);
  }`;

if (s.indexOf(oldInsertNormal) >= 0) {
  s = s.split(oldInsertNormal).join(newInsertNormal);
  changes.push("6. _insertNormalBeforeLoop multi-loop");
  console.log("OK 6. _insertNormalBeforeLoop");
} else { console.log("SKIP 6. _insertNormalBeforeLoop"); }

// ====== 7. _enqueueInLoopMode → check loops object ======
// Old: _existing.loop && _existing.loop.enabled
// New: _existing.loops && Object.keys(_existing.loops).length > 0
const oldInLoopMode = `  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loop && _existing.loop.enabled) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  }`;

const newInLoopMode = `  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  }`;

if (s.indexOf(oldInLoopMode) >= 0) {
  s = s.split(oldInLoopMode).join(newInLoopMode);
  changes.push("7. _enqueueInLoopMode multi-loop");
  console.log("OK 7. _enqueueInLoopMode");
} else { console.log("SKIP 7. _enqueueInLoopMode"); }

// ====== 8. Update _ensurePSKey to handle loops (it's used by input handlers) ======
// No change needed to _ensurePSKey itself, but localStorage save format changes: loop → loops

// ====== MAJOR: _doPoll rewrite ======
// I'll do multiple targeted replacements for the different sections

// 8a. Timer-expired check: _loop.startedAt → per-loop
const oldTTLCheck = `    // 终止倒计时：设置了 ttlMinutes 且首条发出后超时，终止循环并保留普通消息
    var _loop = _state.loop || null;
    if (_loop && _loop.ttlMinutes !== null && _loop.ttlStartedAt && Date.now() >= _loop.ttlStartedAt + _loop.ttlMinutes * 60000) {`;

const newTTLCheck = `    // 终止倒计时：按 loopId 逐个检查 TTL，超时则清除该循环的所有项
    var _loops = _state.loops || {};
    for (var _lid in _loops) {
      var _lp = _loops[_lid];
      if (_lp.ttlMinutes !== null && _lp.ttlStartedAt && Date.now() >= _lp.ttlStartedAt + _lp.ttlMinutes * 60000) {
        delete _loops[_lid];
        _state.texts = _state.texts.filter(function(t) { return _loopId(t) !== _lid; });
      }
    }`;

if (s.indexOf(oldTTLCheck) >= 0) {
  s = s.split(oldTTLCheck).join(newTTLCheck);
  changes.push("8a. TTL per-loop");
  console.log("OK 8a. TTL per-loop");
} else { console.log("SKIP 8a. TTL"); }

// 8b. Remove the old TTL cleanup block (it was inside the old if)
// After the per-loop TTL check, we removed the old cleanup. We need to handle cleanup.
// The old code cleared _state.loop and filtered out all _isLoopMark items.
// Now we need: if _state.texts is empty after cleanup, clear everything.

// Find: "// 终止倒计时：" up to the "return;" line, inclusive
// The per-loop TTL check already does the filtering. We just need to handle the "texts empty → cleanup" part.

// Let me find the old cleanup block after the TTL check
const oldTTLCleanup = `      _state.loop = null;
      _loop = null;
      _state.texts = _state.texts.filter(function(t) { return !_isLoopMark(t); });
      var _sid = Z.sessionId.value;
      if (_state.texts.length === 0) {
        clearInterval(_state.interval);
        _clearPS();
        window.__preSendState.delete(_key);
        if (_sid) localStorage.removeItem("ps_q_" + _sid);
      } else {
        if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loop: null }));
        _createPreview(_state.texts);
      }
      return;`;

const newTTLCleanup = `      var _sid = Z.sessionId.value;
      if (_state.texts.length === 0) {
        clearInterval(_state.interval);
        _clearPS();
        window.__preSendState.delete(_key);
        if (_sid) localStorage.removeItem("ps_q_" + _sid);
      } else {
        if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loops: _state.loops }));
        _createPreview(_state.texts);
      }
      return;`;

if (s.indexOf(oldTTLCleanup) >= 0) {
  s = s.split(oldTTLCleanup).join(newTTLCleanup);
  changes.push("8b. TTL cleanup");
  console.log("OK 8b. TTL cleanup");
} else { console.log("SKIP 8b. TTL cleanup"); }

// ====== MAJOR CHANGES SAVED. BELOW THIS LINE NEEDS MORE WORK. ======
// Stopping here for now because the send-index and re-enqueue sections require
// very precise matching. I'll continue with a second pass.

// Write intermediate version
fs.writeFileSync(p, s, "utf8");
console.log("\n=== Changes applied so far: " + changes.length + " ===");
changes.forEach(c => console.log("  " + c));
console.log("\nPartial file written. Verify syntax:");
