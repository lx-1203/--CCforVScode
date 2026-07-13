// MULTI-LOOP: One-pass bottom-up splice.
// Positions from fresh backup analysis:
//   LOOP_MARK block:   char 6847978 (var LOOP_MARK) → 6848273 (after _stripLoopMarks)
//   _enqueueLoopItem:  char 6851737 → 6853084 (ends at char before _insertNormalBeforeLoop)
//   _insertNormalBeforeLoop: char 6853085 → 6853824
//   _enqueueInLoopMode:     char 6853825 → 6854145
//   _doPoll:                char 6874045 → 6877592

const fs = require("fs"), cp = require("child_process");
const p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";

// Start clean
cp.execSync('cp "' + p + '.multiloop_backup" "' + p + '"');
let s = fs.readFileSync(p, "utf8");

const blocks = {
  // Ordered from end to start (bottom-up splice, no position shift)
  _doPoll:                { start: 6874045, end: 6877592 },
  _enqueueInLoopMode:     { start: 6853825, end: 6854145 },
  _insertNormalBeforeLoop: { start: 6853085, end: 6853824 },
  _enqueueLoopItem:        { start: 6851737, end: 6853084 },
  LOOP_MARK_block:         { start: 6847978, end: 6848273 },
};

// Replace functions bottom-up
const replacements = {

_doPoll: `function _doPoll() {
    if (!Y.preSend) { let _key = _ensurePSKey(); let _ex = window.__preSendState.get(_key); if (_ex) { clearInterval(_ex.interval); window.__preSendState.delete(_key); } _clearPS(); return; }
    let _key = _ensurePSKey(); let _state = window.__preSendState.get(_key);
    if (!_state || _state.texts.length === 0) { _clearPS(); window.__preSendState.delete(_key); let _sid = Z.sessionId.value; if (_sid) localStorage.removeItem("ps_q_" + _sid); return; }
    if (!document.getElementById("preSendPreview")) { _createPreview(_state.texts); }
    var _loops = _state.loops || {};
    for (var _lid in _loops) { var _lp = _loops[_lid]; if (_lp.ttlMinutes !== null && _lp.ttlStartedAt && Date.now() >= _lp.ttlStartedAt + _lp.ttlMinutes * 60000) { delete _loops[_lid]; _state.texts = _state.texts.filter(function(t) { return _loopId(t) !== _lid; }); } }
    if (_state.texts.length === 0) { clearInterval(_state.interval); _clearPS(); window.__preSendState.delete(_key); let _sid = Z.sessionId.value; if (_sid) localStorage.removeItem("ps_q_" + _sid); return; }
    if (!Z.busy.value && !Z._compactBusy && !Z._queuePaused) {
      if (_isOptMark(_state.texts[0])) return;
      var _sendIdx = -1, _sendLid = null;
      for (var _i = 0; _i < _state.texts.length; _i++) { var _t = _state.texts[_i]; if (_isOptMark(_t)) break; if (_isLoopMark(_t)) { var __lid = _loopId(_t), __lp = _loops[__lid]; if (__lp && __lp.nextLoopAt && __lp.completed > 0) { if (Date.now() < __lp.nextLoopAt) continue; __lp.nextLoopAt = null; } _sendLid = __lid; } _sendIdx = _i; break; }
      if (_sendIdx < 0) return;
      var _nextRaw = _state.texts.splice(_sendIdx, 1)[0];
      var _isLoopItem = _isLoopMark(_nextRaw);
      var _next = _isLoopItem ? _loopOrig(_nextRaw) : _nextRaw;
      if (_isLoopItem && _sendLid && _loops[_sendLid]) {
        var _rLp = _loops[_sendLid]; _rLp.completed++;
        if (_rLp.ttlMinutes !== null && !_rLp.ttlStartedAt) _rLp.ttlStartedAt = Date.now();
        if (_rLp.totalCount === null || _rLp.completed < _rLp.totalCount) {
          _rLp.nextLoopAt = Date.now() + _rLp.intervalMinutes * 60000;
          var _insIdx = _state.texts.length; for (var _j = 0; _j < _state.texts.length; _j++) { if (_isLoopMark(_state.texts[_j]) && _loopId(_state.texts[_j]) !== _sendLid) { _insIdx = _j + 1; break; } }
          _state.texts.splice(_insIdx, 0, _makeLoopMarked(_sendLid, _rLp.sourceText));
        } else { delete _loops[_sendLid]; }
      }
      let _sid = Z.sessionId.value;
      if (_state.texts.length === 0) { clearInterval(_state.interval); _clearPS(); window.__preSendState.delete(_key); if (_sid) localStorage.removeItem("ps_q_" + _sid); }
      else { _createPreview(_state.texts); if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _state.texts, loops: _state.loops })); }
      if (b1.current) b1.current.textContent = _next;
      A(_next); setTimeout(function() { m5(); }, 50);
    }
  }`,

_enqueueInLoopMode: `  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey(); var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) { _insertNormalBeforeLoop(text); }
    else { _enqueueLoopItem(text); }
  }`,

_insertNormalBeforeLoop: `  function _insertNormalBeforeLoop(text) {
    var _sid = Z.sessionId.value; var _key = _ensurePSKey();
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (!_existing) {
      var _nTexts = [text]; var _isGuided = !localStorage.getItem("preSendGuided");
      if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(_nTexts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: _nTexts, interval: _psInterval, loops: {} });
      return;
    }
    var _firstLoopIdx = -1;
    for (var i = 0; i < _existing.texts.length; i++) { if (_isLoopMark(_existing.texts[i])) { _firstLoopIdx = i; break; } }
    if (_firstLoopIdx < 0) _existing.texts.push(text);
    else _existing.texts.splice(_firstLoopIdx, 0, text);
    if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));
    _createPreview(_existing.texts);
  }`,

_enqueueLoopItem: `  function _enqueueLoopItem(sourceText) {
    var _sid = Z.sessionId.value; var _key = _ensurePSKey();
    var _lid = _nextLid();
    var _marked = _makeLoopMarked(_lid, sourceText);
    var _intervalMin = parseInt(Z.loopIntervalMinutes?.value, 10) || 0;
    var _loopMeta = { sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, ttlStartedAt: null, nextLoopAt: null };
    window.__preSendState = window.__preSendState || new Map();
    var _existing = window.__preSendState.get(_key);
    if (_existing) {
      _existing.texts.push(_marked); if (!_existing.loops) _existing.loops = {};
      _existing.loops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: _existing.texts, loops: _existing.loops }));
      _createPreview(_existing.texts);
    } else {
      var texts = [_marked]; var _tmpLoops = {}; _tmpLoops[_lid] = _loopMeta;
      if (_sid) localStorage.setItem("ps_q_" + _sid, JSON.stringify({ texts: texts, loops: _tmpLoops }));
      var _isGuided = !localStorage.getItem("preSendGuided"); if (_isGuided) { localStorage.setItem("preSendGuided", "1"); }
      _createPreview(texts, _isGuided);
      var _psInterval = setInterval(_doPoll, 300);
      window.__preSendState.set(_key, { texts: texts, interval: _psInterval, loops: _tmpLoops });
    }
  }`,

LOOP_MARK_block: `  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";
  var LOOP_SEP = "\\x00";
  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }
  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }
  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }
  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }
  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }
  var _nextLoopId = 0;
  function _nextLid() { return "l" + (++_nextLoopId); }`,
};

// Apply bottom-up (reverse order)
const keys = Object.keys(blocks).reverse();
for (const key of keys) {
  const b = blocks[key];
  const oldLen = b.end - b.start;
  console.log(key + ": replacing " + oldLen + "→" + replacements[key].length + " bytes at char " + b.start);
  s = s.substring(0, b.start) + replacements[key] + s.substring(b.end);
}

// Bulk replace localStorage writes: loop: → loops:
s = s.replaceAll('loop: _state.loop', 'loops: _state.loops');
s = s.replaceAll('loop: _existing.loop', 'loops: _existing.loops');
s = s.replaceAll('loop: _loopMeta', 'loops: _tmpLoops');
s = s.replaceAll('loop: null', 'loops: null');
s = s.replaceAll('_st.loop.totalCount', '_st.loops ? Object.keys(_st.loops)[0] ? _st.loops[Object.keys(_st.loops)[0]].totalCount : 0 : 0');
// Revert the replacement above for setting (dialog confirm)
s = s.replaceAll('_st.loops ? Object.keys(_st.loops)[0] ? _st.loops[Object.keys(_st.loops)[0]].totalCount : 0 : 0 = _totalCount',
  '_fdid = _st.loops ? Object.keys(_st.loops)[0] : null; if (_fdid && _st.loops[_fdid]) { var _fd = _st.loops[_fdid]; _fd.totalCount = _totalCount; _fd.intervalMinutes = _intervalMinutes; _fd.ttlMinutes = _ttlVal; }');
console.log("Bulk localStorage + dialog done");

// _createPreview: _psLoopState from loops
s = s.replace('var _psLoopState = window.__preSendState?.get(_key)?.loop || null;', 'var _loopsRef = window.__preSendState?.get(_key)?.loops || {};\n    var _psLoopState = (function(){ var _lk = Object.keys(_loopsRef); return _lk.length > 0 ? _loopsRef[_lk[0]] : null; })();');
console.log("_createPreview loops: " + (s.indexOf('_loopsRef') >= 0));

// Escape: _ex.loop → _ex.loops
s = s.replaceAll('_ex.loop && _ex.loop.enabled', '_ex.loops && Object.keys(_ex.loops).length > 0');
s = s.replaceAll('_ex.loop = null;', '_ex.loops = {};');
console.log("Escape handler: loops");

// Delete: per-lid
s = s.replace('if (_delIsLoop && _psState.loops) {\n          _psState.loops = {};', 'if (_delIsLoop) {\n          var _delLid = _loopId(_psState.texts[idx] || ""); if (_delLid && _psState.loops) delete _psState.loops[_delLid];');
console.log("Delete per-lid: " + (s.indexOf('_delLid') >= 0));

// SessionId migration
s = s.replaceAll('_existing.loop', '_existing.loops');
console.log("SessionId migration: " + (s.indexOf('_existing.loops') >= 0 && s.indexOf('_existing.loop') < 0));

// Write + verify
fs.writeFileSync(p, s, "utf8");
const r = cp.spawnSync("D:/Program Files/node-v22.17.1-win-x64/node.exe", ["--check", p], {encoding:"utf8"});
if (r.status === 0) console.log("\nSYNTAX OK ✓");
else { console.log("\nSYNTAX ERROR:"); console.log(r.stderr.replace(p, "index.js").substring(0, 500)); process.exit(1); }

// Feature check
["LOOP_SEP","_loopId","_makeLoopMarked","_nextLid","_insIdx",
 "_sendLid","_loopId(t) !== _lid","_delLid","_loopsRef","_fdid","_tmpLoops"].forEach(k => {
  console.log("  " + k + ": " + (s.indexOf(k) >= 0 ? "✓" : "✗"));
});
console.log("  _existing.loop remaining: " + ((s.match(/_existing\.loop\b/g)||[]).length));
