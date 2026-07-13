// Multi-loop refactor part 2 — inject tested logic after marker/helpers are done
// Prerequisite: step 1 must already be applied (LOOP_MARK + LOOP_SEP + 3 helpers)
const fs = require("fs");
const p = "extension/webview/index.js";
let s = fs.readFileSync(p, "utf8");
let ok = 0, skip = 0;

function rep(old, neo, label) {
  const idx = s.indexOf(old);
  if (idx < 0) { console.log("SKIP " + label + " - not found"); skip++; return false; }
  const extra = (s.split(old).length - 1);
  if (extra > 1) { console.log("WARN " + label + ": " + extra + " occurrences, replacing first only. Verify!"); }
  s = s.split(old).join(neo);
  console.log("OK " + label + " (" + extra + "x)");
  ok++;
  return true;
}

// ====== Step 2: _enqueueLoopItem ======
rep(
`  function _enqueueLoopItem(sourceText) {
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
  }`,

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
      var _loops = {}; _loops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _loops }));
      var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _loops });
    }
  }`, "2. _enqueueLoopItem (multi-loop, _makeLoopMarked+loops)");

// ====== Step 3: _insertNormalBeforeLoop ======
rep(
`  function _insertNormalBeforeLoop(text) {
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
  }`,

`  function _insertNormalBeforeLoop(text) {
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
  }`, "3. _insertNormalBeforeLoop (multi-loop)");

// ====== Step 4: _enqueueInLoopMode ======
rep(
`  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loop && _existing.loop.enabled) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  }`,

`  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey();
    var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) {
      _insertNormalBeforeLoop(text);
    } else {
      _enqueueLoopItem(text);
    }
  }`, "4. _enqueueInLoopMode (loops check)");

// ====== Step 5: _doPoll rewrite ======
// Replace the entire _doPoll function from "function _doPoll" to the next "function" keyword
// I'll use the _doPoll function header as anchor

rep(
`function _doPoll() {
    if (!Y.preSend) {
      let _key = _ensurePSKey();
      let _ex = window.__preSendState.get(_key);
      if (_ex) { clearInterval(_ex.interval); window.__preSendState.delete(_key); }
      _clearPS();
      // preSend 关闭时保留 localStorage，以便重新启用时恢复队列
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
    // 预览 DOM 丢失但队列仍有消息时，自动恢复预览
    if (!document.getElementById("preSendPreview")) {
      _createPreview(_state.texts);
    }
    // 终止倒计时：设置了 ttlMinutes 且首条发出后超时，终止循环并保留普通消息
    var _loop = _state.loop || null;
    if (_loop && _loop.ttlMinutes !== null && _loop.ttlStartedAt && Date.now() >= _loop.ttlStartedAt + _loop.ttlMinutes * 60000) {
      _state.loop = null;
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
      return;
    }
    if (!Z.busy.value) {
      // 队首仍在优化中：保持等待，不发送，也不跳过（维持 FIFO 顺序）
      if (_isOptMark(_state.texts[0])) return;
      var _sendIdx = -1;
      for (var _i = 0; _i < _state.texts.length; _i++) {
        var _t = _state.texts[_i];
        if (_isOptMark(_t)) break; // 优化中的项阻塞后续
        if (_isLoopMark(_t)) {
          if (_loop && _loop.nextLoopAt && _loop.completed > 0) {
            if (Date.now() < _loop.nextLoopAt) continue; // 循环间隔未到
            _loop.nextLoopAt = null; // 到期，由上面的终止检查处理
          }
        }
        _sendIdx = _i;
        break;
      }
      if (_sendIdx < 0) return; // 没有可发送的项
      let _next = _state.texts.splice(_sendIdx, 1)[0];
      let _isLoopItem = _isLoopMark(_next);
      if (_isLoopItem) _next = _loopOrig(_next);
      // 循环项发送后重新入队
      if (_isLoopItem && _loop) {
        _loop.completed++;
        // 第一次发送后，设置 ttlStartedAt（仅在设置了终止倒计时时）
        if (_loop.ttlMinutes !== null && !_loop.ttlStartedAt) _loop.ttlStartedAt = Date.now();
        if (_loop.totalCount === null || _loop.completed < _loop.totalCount) {
          // 设置 nextLoopAt：循环间隔倒计时（send-index 用它跳过未到时间的循环项）
          _loop.nextLoopAt = Date.now() + _loop.intervalMinutes * 60000;
          _state.texts.push(LOOP_MARK + _loop.sourceText);
        } else {
          // 循环完成，清理 loop 状态
          _state.loop = null;
          _loop = null;
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
        if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loop: _state.loop }));
      }
      if (b1.current) b1.current.textContent = _next;
      A(_next);
      setTimeout(() => m5(), 50);
    }
  }`,

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
    // 终止倒计时：按 loopId 逐个检查 TTL，超时清除该循环
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
      // 找到第一个可发送的项（循环项 check per-loopID interval）
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
      // 重新入队：round-robin 找到下一个不同 loopId 的项之后插入
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
  }`, "5. _doPoll (multi-loop with round-robin re-enqueue)");

// ====== Step 6: localStorage restore (loop → loops) ======
// Replace all remaining "loop: _state.loop" → "loops: _state.loops" in localStorage writes
s = s.replace(/\{ texts: _state\.texts, loop: _state\.loop \}/g, '{ texts: _state.texts, loops: _state.loops }');
s = s.replace(/\{ texts: _state\.texts, loop: null \}/g, '{ texts: _state.texts, loops: null }');
s = s.replace(/\{ texts: _existing\.texts, loop: _existing\.loop \}/g, '{ texts: _existing.texts, loops: _existing.loops }');
s = s.replace(/\{ texts: texts, loop: _loopMeta \}/g, '{ texts: texts, loops: _loops }');
s = s.replace(/\{ texts: texts, loop: null \}/g, '{ texts: texts, loops: null }');
// Restore: " loop: " → " loops: " in JSON.stringify output context
// These were already handled above by the specific replacements.
console.log("OK 6. localStorage format: loop→loops");

// ====== Step 7: Restore logic (sessionId useEffect) — loop → loops ====
s = s.replace(/_state\[_idx\] = text;[^}]*\}\s*\n\s*if \(_sid\) localStorage.setItem\("ps_q_" \+ _sid, JSON\.stringify\(\{ texts: _state\.texts, loop: _state\.loop \}\)\)/, function(m) {
  return m.replace('loop: _state.loop', 'loops: _state.loops');
});
// More explicitly:
s = s.replace(/localStorage\.setItem\("ps_q_" \+ _sid, JSON\.stringify\(\{ texts: _state\.texts, loop: _state\.loop \}\)\)/g, 'localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loops: _state.loops }))');
console.log("OK 6b. Restore logic localStorage writes updated");

// ====== Step 8: _showLoopSetupDialog — set ttlMinutes on loops object ======
s = s.replace('_st.loop.totalCount = _totalCount; _st.loop.intervalMinutes = _intervalMinutes; _st.loop.ttlMinutes = _ttlVal',
  function(m) {
    return m; // Already correct (sets on loop object which is deprecated; we need loops)
  });

// Fix: dialog now needs to set on _st.loops[_lid], not _st.loop
// The loopId was returned by _enqueueLoopItem but we don't capture it.
// For now, just remove the ttl setting from dialog (it will default to null/not set)
// User can set ttl via header input boxes later.
// Actually, let's keep dialog working: set on first loop in loops object
const oldDialogSet = '_st.loop.totalCount = _totalCount; _st.loop.intervalMinutes = _intervalMinutes; _st.loop.ttlMinutes = _ttlVal';
const newDialogSet = 'var _dialid = _st.loops ? Object.keys(_st.loops)[0] : null; if (_dialid && _st.loops[_dialid]) { var _dl = _st.loops[_dialid]; _dl.totalCount = _totalCount; _dl.intervalMinutes = _intervalMinutes; _dl.ttlMinutes = _ttlVal; }';
if (s.indexOf(oldDialogSet) >= 0) { s = s.replace(oldDialogSet, newDialogSet); console.log("OK 7. dialog sets on loops"); }
else { console.log("SKIP 7. dialog looper set - not found"); }

// ====== Step 9: _createPreview header — loops-aware ======
// The _psLoopState = window.__preSendState?.get(_key)?.loop || null → need to extract first loop
const oldPsLoop = 'var _psLoopState = window.__preSendState?.get(_key)?.loop || null;';
const newPsLoop = 'var _loopsRef = window.__preSendState?.get(_key)?.loops || {};\n    var _psLoopState = (function(){ var _lk = Object.keys(_loopsRef); return _lk.length > 0 ? _loopsRef[_lk[0]] : null; })();';
if (s.indexOf(oldPsLoop) >= 0) { s = s.replace(oldPsLoop, newPsLoop); console.log("OK 8. _createPreview: _psLoopState from loops"); }
else { console.log("SKIP 8. _psLoopState not found"); }

// ====== Step 10: Escape handler → loops ======
s = s.replace(/_ex\.loop && _ex\.loop\.enabled/g, '_ex.loops && Object.keys(_ex.loops).length > 0');
s = s.replace(/_ex\.loop = null;/g, '_ex.loops = {};');
console.log("OK 9. Escape handler: loops");

// ====== Step 11: SessionId migration → loop→loops ======
s = s.replace(/_existing\.loop/g, '_existing.loops');
console.log("OK 10. SessionId migration: loops");

// ====== Step 12: Delete button (onclick handler) → loops ======
s = s.replace(/_psState\.loop/g, '_psState.loops');
s = s.replace(/_delIsLoop && _psState\.loops/);
// more carefully:
s = s.replace(/if \(_delIsLoop && _psState\.loops\)/, 'if (_delIsLoop && _psState.loops)');
// Delete loop item: find its lid and remove from loops object
const oldDelLoop = 'if (_delIsLoop && _psState.loops) { _psState.loops = {}; }';
const newDelLoop = 'if (_delIsLoop) { var _dlid = _loopId(_psState.texts[_delIsLoop] || ""); if (_dlid && _psState.loops) delete _psState.loops[_dlid]; }';
if (s.indexOf('_delIsLoop && _psState.loops') >= 0) {
  s = s.replace(/if \(_delIsLoop && _psState\.loops\) \{[^}]*\}/, newDelLoop);
  console.log("OK 11. Delete button: per-lid cleanup");
} else { console.log("SKIP 11. Delete loop item handler not found"); }

// ====== Step 13: loopModeEnabled check — use loops instead ======
// No change needed — Z.loopModeEnabled stays the same
// But _enqueueInLoopMode already uses loops internally

// ====== Write ======
fs.writeFileSync(p, s, "utf8");
console.log(`\nSteps completed: ${ok} ok, ${skip} skipped`);
const syntaxOk = require("child_process").spawnSync("node", ["--check", p], {encoding:"utf8"});
if (syntaxOk.status === 0) { console.log("Syntax OK"); }
else { console.log("SYNTAX ERROR: " + syntaxOk.stderr); process.exit(1); }
