// Multi-loop final injector — block-splice + bulk replace
// Positions validated against restored backup file
const fs = require("fs"), cp = require("child_process");
const p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";
let s = fs.readFileSync(p, "utf8");
const orig = s;

function splice(start, end, newText, label) {
  // end is exclusive (position AFTER last byte of old block)
  const oldLen = end - start;
  console.log(label + ": replacing " + oldLen + "→" + newText.length + " bytes at pos " + start);
  s = s.substring(0, start) + newText + s.substring(end);
  return true;
}

// ====== 1. _enqueueLoopItem (6852143-6853410 exclusive) ======
splice(6852143, 6853410,
`  function _enqueueLoopItem(sourceText) {
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
      var _loopsMap = {}; _loopsMap[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _loopsMap }));
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _loopsMap });
    }
  }`,
"1. _enqueueLoopItem");

// ====== 2. _insertNormalBeforeLoop (6853491-6854183 exclusive) ======
splice(6853491, 6854183,
`  function _insertNormalBeforeLoop(text) {
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
  }`,
"2. _insertNormalBeforeLoop");

// ====== 3. _enqueueInLoopMode (6854231-6854514 exclusive) ======
splice(6854231, 6854514,
`  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  }`,
"3. _enqueueInLoopMode");

// ====== 4. _doPoll (6874451-6878000 exclusive) ======
splice(6874451, 6878000,
`function _doPoll() {
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
  }`,
"4. _doPoll");

// ====== 5. Bulk replace: all localStorage JSON: loop→loops ======
let cnt = (s.match(/loop: _state\.loop|loop: _existing\.loop|loop: _loopMeta|"loop":/g) || []).length;
s = s.replaceAll('loop: _state.loop', 'loops: _state.loops');
s = s.replaceAll('loop: _existing.loop', 'loops: _existing.loops');
s = s.replaceAll('loop: _loopMeta', 'loops: _loopsMap');
s = s.replaceAll('loop: null', 'loops: null');
let cnt2 = (s.match(/loops: _state\.loops|loops: _existing\.loops|loops: _loopsMap/g) || []).length;
console.log("5. localStorage writes: " + cnt + " old→" + cnt2 + " new");

// ====== 6. Dialog confirm: _st.loop → _st.loops[firstKey] ======
s = s.replace(
  '_st.loop.totalCount = _totalCount; _st.loop.intervalMinutes = _intervalMinutes; _st.loop.ttlMinutes = _ttlVal',
  'var _fdid = _st.loops ? Object.keys(_st.loops)[0] : null; if (_fdid && _st.loops[_fdid]) { var _fd = _st.loops[_fdid]; _fd.totalCount = _totalCount; _fd.intervalMinutes = _intervalMinutes; _fd.ttlMinutes = _ttlVal; }'
);
console.log("6. Dialog sets on loops: " + (s.indexOf('_fdid') >= 0));

// ====== 7. _createPreview: _psLoopState from loops ======
s = s.replace(
  'var _psLoopState = window.__preSendState?.get(_key)?.loop || null;',
  'var _loopsRef = window.__preSendState?.get(_key)?.loops || {};\n    var _psLoopState = (function(){ var _lk = Object.keys(_loopsRef); return _lk.length > 0 ? _loopsRef[_lk[0]] : null; })();'
);
console.log("7. _createPreview header: " + (s.indexOf('_loopsRef') >= 0));

// ====== 8. Escape handler: _ex.loop → _ex.loops ======
s = s.replace('_ex.loop && _ex.loop.enabled', '_ex.loops && Object.keys(_ex.loops).length > 0');
s = s.replace('_ex.loop = null;', '_ex.loops = {};');
console.log("8. Escape handler: loops");

// ====== 9. Delete button: per-lid cleanup ======
s = s.replace(
  'if (_delIsLoop && _psState.loops) {\n          _psState.loops = {};',
  'if (_delIsLoop) {\n          var _delLid = _loopId(_psState.texts[idx] || \"\"); if (_delLid && _psState.loops) delete _psState.loops[_delLid];'
);
console.log("9. Delete per-lid: " + (s.indexOf('_delLid') >= 0));

// ====== 10. SessionId migration: _existing.loop → loops ======
s = s.replaceAll('_existing.loop', '_existing.loops');
s = s.replaceAll('_existing.loops && _existing.loops.enabled', '_existing.loops && Object.keys(_existing.loops).length > 0');
console.log("10. SessionId migration: remaining _existing.loop = " + (s.indexOf('_existing.loop') >= 0));

// ====== Verify ======
fs.writeFileSync(p, s, "utf8");
const r = cp.spawnSync("D:/Program Files/node-v22.17.1-win-x64/node.exe", ["--check", p], {encoding:"utf8"});
if (r.status === 0) console.log("\nSYNTAX OK");
else { console.log("\nSYNTAX ERROR:\n" + r.stderr.replace(p, "index.js").substring(0, 400)); process.exit(1); }

// Confirm key features
["LOOP_SEP","_loopId","_makeLoopMarked","_nextLid","_insIdx","_loopsMap",
 "_sendLid","_loopId(t) !== _lid","_delLid","_loopsRef","_fdid"].forEach(k => {
  console.log("  " + k + ": " + (s.indexOf(k) >= 0 ? "✓" : "✗"));
});
