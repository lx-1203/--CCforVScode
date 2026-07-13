// MULTI-LOOP INJECTOR — Bottom-up function replacement
// Replaces from last function to first, so positions don't shift
const fs = require("fs"), cp = require("child_process");
const p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";

// Start from clean backup
cp.execSync('cp "' + p + '.multiloop_backup" "' + p + '"');
let s = fs.readFileSync(p, "utf8");

// Find exact positions ONCE before any modification
function findFuncPos(name) {
  const idx = s.indexOf("function " + name);
  if (idx < 0) { console.log("NOT FOUND: " + name); return null; }
  // Find matching closing brace from 1 char after opening brace
  let pos = s.indexOf("{", idx) + 1;
  let depth = 1;
  while (depth > 0 && pos < s.length) {
    if (s[pos] === "{") depth++;
    else if (s[pos] === "}") depth--;
    pos++;
  }
  console.log(name + ": chars " + idx + "-" + pos + " (" + (pos - idx) + " bytes)");
  return { start: idx, end: pos };
}

// 1. Find all new helpers for LOOP_MARK
const markersStart = s.indexOf('var LOOP_MARK = ');
const markersEnd = s.indexOf('\n', s.indexOf('_stripLoopMarks(arr)', markersStart)) + 1;
console.log("LOOP_MARK block: " + markersStart + "-" + markersEnd);

// 2. Find _doPoll
const doPoll = findFuncPos("_doPoll()");
if (!doPoll) process.exit(1);

// 3. Find _enqueueInLoopMode
const eilm = findFuncPos("_enqueueInLoopMode(text)");
if (!eilm) process.exit(1);

// 4. Find _insertNormalBeforeLoop
const inbl = findFuncPos("_insertNormalBeforeLoop(text)");
if (!inbl) process.exit(1);

// 5. Find _enqueueLoopItem
const eli = findFuncPos("_enqueueLoopItem(sourceText)");
if (!eli) process.exit(1);

// 6. Find _psLoopState in _createPreview (not a function, but a variable reference)
const psl = s.indexOf('var _psLoopState = window.__preSendState?.get(_key)?.loop || null;');
console.log("_psLoopState: char " + psl + (psl >= 0 ? " found" : " NOT FOUND"));

// Replace from BOTTOM to TOP

// A. LOOP_MARK block first (earliest position, affects everything)
s = s.substring(0, markersStart) + [
'  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";',
'  var LOOP_SEP = "\\x00";',
'  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }',
'  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }',
'  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }',
'  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }',
'  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }',
'  var _nextLoopId = 0;',
'  function _nextLid() { return "l" + (++_nextLoopId); }',
].join("\n") + s.substring(markersEnd);
console.log("A. LOOP_MARK replaced");

// B. Replace from BOTTOM: doPoll first (doesn't shift earlier positions)
// Actually positions shifted after A. Re-search.
s = s.substring(0, doPoll.start) + `function _doPoll() {
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
      setTimeout(function() { m5(); }, 50);
    }
  }` + s.substring(doPoll.end);
// Oops — positions shifted after A. Need to recompute.
// Aborting this approach. Too fragile.

fs.writeFileSync(p, "ABORTED - needs re-approach", "utf8");
console.log("Bottom-up approach abandoned. Need a fundamentally different strategy.");
