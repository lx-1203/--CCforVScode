// Atomic multi-loop refactor — all replacements in one pass
// Verified against current file before each replace
const fs = require("fs");
const cp = require("child_process");
const p = "extension/webview/index.js";
let s = fs.readFileSync(p, "utf8");

function replace(oldt, newt, label) {
  const pat = oldt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (s.match(new RegExp(pat, 'g')) || []).length;
  if (count === 0) { console.log("FAIL: " + label + " - NOT FOUND"); return false; }
  if (count > 1) { console.log("WARN: " + label + " - " + count + " matches, verify!"); }
  s = s.replaceAll(oldt, newt);
  console.log("OK: " + label + " (" + count + "x)");
  return true;
}

// ====== 1. LOOP_MARK + helpers + _nextLid ======
replace(
'  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopOrig(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length) : t; }\n  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }',
'  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  var LOOP_SEP = "\\x00";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }\n  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }\n  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }\n  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }\n  var _nextLoopId = 0;\n  function _nextLid() { return "l" + (++_nextLoopId); }',
"1. LOOP_MARK+helpers+_nextLid"
);

// ====== 2. _enqueueLoopItem → multi-loop ======
replace(
'  function _enqueueLoopItem(sourceText) {\n    var _sid = Z.sessionId.value;\n    var _key = _ensurePSKey();\n    var _marked = LOOP_MARK + sourceText;\n    var _intervalMin = parseInt(Z.loopIntervalMinutes?.value, 10) || 0;\n    var _loopMeta = { enabled: true, sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, nextLoopAt: null };\n    window.__preSendState = window.__preSendState || new Map();\n    var _existing = window.__preSendState.get(_key);\n    if (_existing) {\n      _existing.texts.push(_marked);\n      if (!_existing.loop) _existing.loop = _loopMeta;\n      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loop: _existing.loop }));\n      _createPreview(_existing.texts);\n    } else {\n      var texts = [_marked];\n      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loop: _loopMeta }));\n      var _isGuided = !localStorage.getItem("preSendGuided");\n      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }\n      _createPreview(texts, _isGuided);\n      var _psInterval = setInterval(_doPoll, 300);\n      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loop: _loopMeta });\n    }\n  }',
'  function _enqueueLoopItem(sourceText) {\n    var _sid = Z.sessionId.value;\n    var _key = _ensurePSKey();\n    var _lid = _nextLid();\n    var _marked = _makeLoopMarked(_lid, sourceText);\n    var _intervalMin = parseInt(Z.loopIntervalMinutes?.value, 10) || 0;\n    var _loopMeta = { sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, ttlStartedAt: null, nextLoopAt: null };\n    window.__preSendState = window.__preSendState || new Map();\n    var _existing = window.__preSendState.get(_key);\n    if (_existing) {\n      _existing.texts.push(_marked);\n      if (!_existing.loops) _existing.loops = {};\n      _existing.loops[_lid] = _loopMeta;\n      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));\n      _createPreview(_existing.texts);\n    } else {\n      var texts = [_marked];\n      var _loopsMap = {}; _loopsMap[_lid] = _loopMeta;\n      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _loopsMap }));\n      var _isGuided = !localStorage.getItem("preSendGuided");\n      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }\n      _createPreview(texts, _isGuided);\n      var _psInterval = setInterval(_doPoll, 300);\n      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _loopsMap });\n    }\n  }',
"2. _enqueueLoopItem"
);

// ====== 3. _insertNormalBeforeLoop ======
replace(
'  function _insertNormalBeforeLoop(text) {\n    var _sid = Z.sessionId.value;\n    var _key = _ensurePSKey();\n    var _existing = window.__preSendState?.get(_key);\n    if (!_existing) { _enqueueLoopItem(text); return; }\n    // 找到最后一个循环占位符的位置，插入到它之前\n    var _lastLoopIdx = -1;\n    for (var i = _existing.texts.length - 1; i >= 0; i--) {\n      if (_isLoopMark(_existing.texts[i])) { _lastLoopIdx = i; break; }\n    }\n    if (_lastLoopIdx < 0) _existing.texts.push(text);\n    else _existing.texts.splice(_lastLoopIdx, 0, text);\n    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loop: _existing.loop }));\n    _createPreview(_existing.texts);\n  }',
'  function _insertNormalBeforeLoop(text) {\n    var _sid = Z.sessionId.value;\n    var _key = _ensurePSKey();\n    window.__preSendState = window.__preSendState || new Map();\n    var _existing = window.__preSendState.get(_key);\n    if (!_existing) {\n      var _nTexts = [text];\n      var _isGuided = !localStorage.getItem("preSendGuided");\n      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }\n      _createPreview(_nTexts, _isGuided);\n      var _psInterval = setInterval(_doPoll, 300);\n      window.__preSendState.set(_key, { texts: _nTexts, interval: _psInterval, loops: {} });\n      return;\n    }\n    var _firstLoopIdx = -1;\n    for (var i = 0; i < _existing.texts.length; i++) {\n      if (_isLoopMark(_existing.texts[i])) { _firstLoopIdx = i; break; }\n    }\n    if (_firstLoopIdx < 0) _existing.texts.push(text);\n    else _existing.texts.splice(_firstLoopIdx, 0, text);\n    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));\n    _createPreview(_existing.texts);\n  }',
"3. _insertNormalBeforeLoop"
);

// ====== 4. _enqueueInLoopMode ======
replace(
'  function _enqueueInLoopMode(text) {\n    var _key = _ensurePSKey();\n    var _existing = window.__preSendState?.get(_key);\n    if (_existing && _existing.loop && _existing.loop.enabled) {\n      _insertNormalBeforeLoop(text);\n    } else {\n      _enqueueLoopItem(text);\n    }\n  }',
'  function _enqueueInLoopMode(text) {\n    var _key = _ensurePSKey();\n    var _existing = window.__preSendState?.get(_key);\n    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) {\n      _insertNormalBeforeLoop(text);\n    } else {\n      _enqueueLoopItem(text);\n    }\n  }',
"4. _enqueueInLoopMode"
);

// ====== 5. localStorage writes bulk replace (loop→loops) ======
let oldCount = (s.match(/loop: _state\.loop|loop: _existing\.loop|loop: _loopMeta|"loop":/g) || []).length;
s = s.replaceAll('loop: _state.loop', 'loops: _state.loops');
s = s.replaceAll('loop: _existing.loop', 'loops: _existing.loops');
s = s.replaceAll('loop: _loopMeta', 'loops: _loopsMap');
s = s.replaceAll('loop: null', 'loops: null');
let newCount = (s.match(/loops: _state\.loops|loops: _existing\.loops|loops: _loopsMap/g) || []).length;
console.log(`5. localStorage writes: ${oldCount}→${newCount} (loop→loops)`);

// ====== 6. _doPoll full rewrite ======
// This is the biggest one. Need exact matching.
const doPollStart = s.indexOf("function _doPoll() {");
const nextFuncIdx = s.indexOf("\nfunction W4", doPollStart);
const oldDoPoll = s.substring(doPollStart, nextFuncIdx);
console.log("6. _doPoll length: " + oldDoPoll.length + " chars");

// Write the new _doPoll
const newDoPoll = `function _doPoll() {
    if (!Y.preSend) {
      let _key = _ensurePSKey();
      let _ex = window.__preSendState.get(_key);
      if (_ex) { clearInterval(_ex.interval); window.__preSendState.delete(_key); }
      _clearPS();
      return;
    }
    let _key = _ensurePSKey();
    let _state = window.__preSendState.get(_key);
    if (!_state || _state.texts.length === 0) {
      _clearPS();
      window.__preSendState.delete(_key);
      let _sid = Z.sessionId.value;
      if (_sid) localStorage.removeItem("ps_q_" + _sid);
      return;
    }
    if (!document.getElementById("preSendPreview")) {
      _createPreview(_state.texts);
    }
    // 终止倒计时：按 loopId 逐个检查 TTL
    var _loops = _state.loops || {};
    for (var _lid in _loops) {
      var _lp = _loops[_lid];
      if (_lp.ttlMinutes !== null && _lp.ttlStartedAt && Date.now() >= _lp.ttlStartedAt + _lp.ttlMinutes * 60000) {
        delete _loops[_lid];
        _state.texts = _state.texts.filter(function(t) { return _loopId(t) !== _lid; });
      }
    }
    if (_state.texts.length === 0) {
      clearInterval(_state.interval);
      _clearPS();
      window.__preSendState.delete(_key);
      let _sid = Z.sessionId.value;
      if (_sid) localStorage.removeItem("ps_q_" + _sid);
      return;
    }
    if (!Z.busy.value) {
      if (_isOptMark(_state.texts[0])) return;
      var _sendIdx = -1, _sendLid = null;
      for (var _i = 0; _i < _state.texts.length; _i++) {
        var _t = _state.texts[_i];
        if (_isOptMark(_t)) break;
        if (_isLoopMark(_t)) {
          var __lid = _loopId(_t), __lp = _loops[__lid];
          if (__lp && __lp.nextLoopAt && __lp.completed > 0) {
            if (Date.now() < __lp.nextLoopAt) continue;
            __lp.nextLoopAt = null;
          }
          _sendLid = __lid;
        }
        _sendIdx = _i;
        break;
      }
      if (_sendIdx < 0) return;
      var _nextRaw = _state.texts.splice(_sendIdx, 1)[0];
      var _isLoopItem = _isLoopMark(_nextRaw);
      var _next = _isLoopItem ? _loopOrig(_nextRaw) : _nextRaw;
      // Round-robin re-enqueue
      if (_isLoopItem && _sendLid && _loops[_sendLid]) {
        var _rLp = _loops[_sendLid];
        _rLp.completed++;
        if (_rLp.ttlMinutes !== null && !_rLp.ttlStartedAt) _rLp.ttlStartedAt = Date.now();
        if (_rLp.totalCount === null || _rLp.completed < _rLp.totalCount) {
          _rLp.nextLoopAt = Date.now() + _rLp.intervalMinutes * 60000;
          var _insIdx = _state.texts.length;
          for (var _j = 0; _j < _state.texts.length; _j++) {
            if (_isLoopMark(_state.texts[_j]) && _loopId(_state.texts[_j]) !== _sendLid) { _insIdx = _j + 1; break; }
          }
          _state.texts.splice(_insIdx, 0, _makeLoopMarked(_sendLid, _rLp.sourceText));
        } else {
          delete _loops[_sendLid];
        }
      }
      let _sid = Z.sessionId.value;
      if (_state.texts.length === 0) {
        clearInterval(_state.interval);
        _clearPS();
        window.__preSendState.delete(_key);
        if (_sid) localStorage.removeItem("ps_q_" + _sid);
      } else {
        _createPreview(_state.texts);
        if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loops: _state.loops }));
      }
      if (b1.current) b1.current.textContent = _next;
      A(_next);
      setTimeout(() => m5(), 50);
    }
  }`;

// Replace only the function text, preserving the rest
s = s.substring(0, doPollStart) + newDoPoll + s.substring(nextFuncIdx);
console.log("6. _doPoll: replaced " + oldDoPoll.length + "→" + newDoPoll.length + " chars");

// ====== 7. Dialog confirm handler ======
// Old: sets _st.loop.totalCount etc
// New: sets on _st.loops[firstLoopId]
replace(
'_st.loop.totalCount = _totalCount; _st.loop.intervalMinutes = _intervalMinutes; _st.loop.ttlMinutes = _ttlVal',
'var _fdid = _st.loops ? Object.keys(_st.loops)[0] : null; if (_fdid && _st.loops[_fdid]) { var _fd = _st.loops[_fdid]; _fd.totalCount = _totalCount; _fd.intervalMinutes = _intervalMinutes; _fd.ttlMinutes = _ttlVal; }',
"7. Dialog sets on loops"
);

// ====== 8. _createPreview header: _psLoopState from loops ======
replace(
'    var _psLoopState = window.__preSendState?.get(_key)?.loop || null;',
'    var _loopsRef = window.__preSendState?.get(_key)?.loops || {};\n    var _psLoopState = (function(){ var _lk = Object.keys(_loopsRef); return _lk.length > 0 ? _loopsRef[_lk[0]] : null; })();',
"8. _createPreview _psLoopState"
);

// ====== 9. Escape handler: _ex.loop → _ex.loops ======
replace('_ex.loop && _ex.loop.enabled', '_ex.loops && Object.keys(_ex.loops).length > 0', "9a. Escape guard");
replace('_ex.loop = null;\n            // 移除队列中的循环标记项', '_ex.loops = {};\n            // 移除队列中的循环标记项', "9b. Escape clear loops");
replace('_ex.texts.filter(function(t) { return !_isLoopMark(t); });', '_ex.texts = _ex.texts.filter(function(t) { return !_isLoopMark(t); });', "9c. Escape filter fix");

// ====== 10. Delete button handler ======
replace('if (_delIsLoop && _psState.loops) {', 'if (_delIsLoop && _psState.loops) { var _delLid = _loopId(_psState.texts[idx] || ""); if (_delLid && _psState.loops) delete _psState.loops[_delLid];', "10. Delete per-lid");

// ====== 11. Restore logic (first text) ======
replace('if (_isLoopMark(_firstText)) _firstText = _loopOrig(_firstText);', 'if (_isLoopMark(_firstText)) _firstText = _loopOrig(_firstText);', "11. Restore logic - unchanged");

// ====== 12. SessionId migration ======
// _existing.loop already marked to replace — check if any remain
let remainingLoop = (s.match(/_existing\.loop\b/g) || []).length;
console.log(`12. Remaining _existing.loop: ${remainingLoop}`);

// ====== Syntax check ======
fs.writeFileSync(p, s, "utf8");
const result = cp.spawnSync("node", ["--check", p], {encoding:"utf8", cwd: __dirname});
if (result.status === 0) { console.log("\nSYNTAX OK — writing file"); }
else { console.log("\nSYNTAX ERROR:\n" + result.stderr.substring(0, 500)); process.exit(1); }

// Summary
console.log("=== Summary ===");
console.log("LOOP_SEP defined: " + (s.indexOf("LOOP_SEP") >= 0));
console.log("_loopId defined: " + (s.indexOf("function _loopId") >= 0));
console.log("_makeLoopMarked defined: " + (s.indexOf("function _makeLoopMarked") >= 0));
console.log("_nextLid defined: " + (s.indexOf("function _nextLid") >= 0));
console.log("loops object: " + (s.match(/_existing\.loops|_state\.loops|_loopsMap/g) || []).length + " refs");
console.log("round-robin insert: " + (s.indexOf("_insIdx") >= 0));
console.log("per-lid TTL: " + (s.indexOf("_loopId(t) !== _lid") >= 0));
