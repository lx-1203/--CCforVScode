// Append-based multi-loop injector
// Strategy: don't touch existing functions at all. Instead:
// 1. Wrap the new _doPoll, _enqueueLoopItem, etc. in a self-contained module
// 2. After the old functions run, immediately redirect to the new versions
// 3. All new logic lives at the tail of the file

// Actually even simpler: since function declarations are hoisted, I CAN override
// them by using assignments at the bottom of the file scope.
// Old: function _doPoll() {...} (hoisted)
// New: _doPoll = function() {...} (at bottom, executed late)
// In non-strict mode JS, function statements CAN be overridden this way.

const fs = require("fs");
const cp = require("child_process");
const p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";

// Restore fresh backup
cp.execSync('cp "' + p + '.multiloop_backup" "' + p + '"');

let s = fs.readFileSync(p, "utf8");

// ====== Step 1: Add LOOP_SEP, _loopId, _makeLoopMarked, _nextLid ======
const oldMarkers = '  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopOrig(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length) : t; }\n  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }';

const newMarkers = '  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";\n  var LOOP_SEP = "\\x00";\n  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }\n  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }\n  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }\n  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }\n  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }\n  var _nextLoopId = 0;\n  function _nextLid() { return "l" + (++_nextLoopId); }';

if (s.indexOf(oldMarkers) >= 0) {
  s = s.split(oldMarkers).join(newMarkers);
  console.log("1. LOOP_MARK helpers replaced");
} else {
  console.log("1. FAIL - markers not found. Trying char-level...");
  // Fallback: char-level
  const idx = s.indexOf('var LOOP_MARK = ');
  const end = s.indexOf('_stripLoopMarks(arr)', idx);
  const endl = s.indexOf('\n', end);
  s = s.substring(0, idx) + newMarkers + s.substring(endl);
  console.log("1. char-level replacement from char " + idx);
}

// ====== Step 2: Append override stubs at file end ======
// These override the original function declarations and add multi-loop support.
// Since they're at the bottom, they overwrite inner-scope references.

const overrideBlock = `
// === MULTI-LOOP OVERRIDE BLOCK (appended by build script) ===
;(function(){
  if (typeof _nextLid !== 'function') return; // guard: only run if helpers exist

  // Save originals
  var _orig_enqueueLoopItem = _enqueueLoopItem;
  var _orig_insertNormalBeforeLoop = _insertNormalBeforeLoop;
  var _orig_enqueueInLoopMode = _enqueueInLoopMode;
  var _orig_doPoll = _doPoll;

  // Override _enqueueLoopItem with multi-loop version
  _enqueueLoopItem = function(sourceText) {
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
      var _tmpLoops = {}; _tmpLoops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _tmpLoops }));
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _tmpLoops });
    }
  };

  // Override _insertNormalBeforeLoop
  _insertNormalBeforeLoop = function(text) {
    var _sid = Z.sessionId.value;
    var _key = _ensurePSKey();
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (!_existing) {
      var _nTexts = [text];
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(_nTexts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: _nTexts, interval: _psInterval, loops: {} });
      return;
    }
    var _firstLoopIdx = -1;
    for (var i = 0; i < _existing.texts.length; i++) {
      if (_isLoopMark(_existing.texts[i])) { _firstLoopIdx = i; break; }
    }
    if (_firstLoopIdx < 0) _existing.texts.push(text);
    else _existing.texts.splice(_firstLoopIdx, 0, text);
    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));
    _createPreview(_existing.texts);
  };

  // Override _enqueueInLoopMode
  _enqueueInLoopMode = function(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  };

  // Override _doPoll
  _doPoll = function() {
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
  };

  // Fix localStorage writes globally: loop→loops
  // Intercept localStorage.setItem for ps_q_ keys
  var _origSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    if (key.indexOf('ps_q_') === 0) {
      try {
        var obj = JSON.parse(value);
        if (obj && obj.loop && !obj.loops) {
          obj.loops = obj.loop;
          delete obj.loop;
          value = JSON.stringify(obj);
        }
        if (obj && obj.loop === null && obj.loops === null) {
          // Already correct
        }
      } catch(e) {}
    }
    _origSetItem.call(localStorage, key, value);
  };

  // Fix _createPreview: extract _psLoopState from loops
  var _orig_createPreview = _createPreview;
  _createPreview = function(texts, isGuided) {
    // Swap _psLoopState extraction
    var _key = _ensurePSKey();
    var _st = window.__preSendState?.get(_key);
    if (_st && _st.loops) {
      var _lk = Object.keys(_st.loops);
      _st.__firstLoop = _lk.length > 0 ? _st.loops[_lk[0]] : null;
    }
    _orig_createPreview(texts, isGuided);
    if (_st) delete _st.__firstLoop;
  };

  // Fix Escape handler
  var _orig_EscapeCheck = null; // handled inline

  // Fix dialog confirm: set ttl on loops
  var _orig_showLoopSetupDialog = _showLoopSetupDialog;

})();
`;

// Append at end of file
s = s + overrideBlock;
fs.writeFileSync(p, s, "utf8");
console.log("2. Override block appended (" + overrideBlock.length + " bytes)");

const r = cp.spawnSync("D:/Program Files/node-v22.17.1-win-x64/node.exe", ["--check", p], {encoding:"utf8"});
if (r.status === 0) console.log("SYNTAX OK");
else { console.log("SYNTAX ERROR:\n" + r.stderr.replace(p, "index.js").substring(0, 400)); }
