// Robust function replacer: finds function by name, counts braces to find end
const fs = require("fs");
const cp = require("child_process");
const p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";

// Start clean
cp.execFileSync("cp", [p + ".multiloop_backup", p]);
let s = fs.readFileSync(p, "utf8");
let ok = 0;

function replaceFunction(fnSig, replacement, label) {
  const start = s.indexOf(fnSig);
  if (start < 0) { console.log(label + ": NOT FOUND"); return false; }

  // Find opening brace
  const openPos = s.indexOf("{", start);
  if (openPos < 0) { console.log(label + ": NO OPENING BRACE"); return false; }

  // Count braces to find matching close
  let depth = 1, pos = openPos + 1;
  while (depth > 0 && pos < s.length) {
    if (s[pos] === "{") depth++;
    else if (s[pos] === "}") depth--;
    pos++;
  }
  if (depth > 0) { console.log(label + ": UNBALANCED BRACES"); return false; }

  const oldEnd = pos;
  const oldLen = oldEnd - start;
  console.log(label + ": " + start + ".." + oldEnd + " (" + oldLen + "→" + replacement.length + " bytes)");

  // Store the position RELATIVE TO THE CURRENT s (which shifts)
  // We'll apply all replacements as start→end+replacement after collecting all
  s = s.substring(0, start) + replacement + s.substring(oldEnd);
  ok++;
  return true;
}

// 1. _doPoll (bottom-up, longest first - no impact on positions after it)
replaceFunction("function _doPoll() {",
`function _doPoll() {
    if (!Y.preSend) { let _key = _ensurePSKey(); let _ex = window.__preSendState.get(_key); if (_ex) { clearInterval(_ex.interval); window.__preSendState.delete(_key); } _clearPS(); return; }
    let _key = _ensurePSKey(); let _state = window.__preSendState.get(_key);
    if (!_state || _state.texts.length === 0) { _clearPS(); window.__preSendState.delete(_key); let _sid = Z.sessionId.value; if (_sid) localStorage.removeItem("ps_q_" + _sid); return; }
    if (!document.getElementById("preSendPreview")) { _createPreview(_state.texts); }
    var _loops = _state.loops || {};
    for (var _lid in _loops) { var _lp = _loops[_lid]; if (_lp.ttlMinutes !== null && _lp.ttlStartedAt && Date.now() >= _lp.ttlStartedAt + _lp.ttlMinutes * 60000) { delete _loops[_lid]; _state.texts = _state.texts.filter(function(t) { return _loopId(t) !== _lid; }); } }
    if (_state.texts.length === 0) { clearInterval(_state.interval); _clearPS(); window.__preSendState.delete(_key); let _sid = Z.sessionId.value; if (_sid) localStorage.removeItem("ps_q_" + _sid); return; }
    if (!Z.busy.value) {
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
"1._doPoll");

// 2. _enqueueInLoopMode
replaceFunction("function _enqueueInLoopMode(text) {",
`  function _enqueueInLoopMode(text) {
    var _key = _ensurePSKey(); var _existing = window.__preSendState?.get(_key);
    if (_existing && _existing.loops && Object.keys(_existing.loops).length > 0) { _insertNormalBeforeLoop(text); }
    else { _enqueueLoopItem(text); }
  }`,
"2._enqueueInLoopMode");

// 3. _insertNormalBeforeLoop
replaceFunction("function _insertNormalBeforeLoop(text) {",
`  function _insertNormalBeforeLoop(text) {
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
"3._insertNormalBeforeLoop");

// 4. _enqueueLoopItem
replaceFunction("function _enqueueLoopItem(sourceText) {",
`  function _enqueueLoopItem(sourceText) {
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
"4._enqueueLoopItem");

// 5. LOOP_MARK block
const lmStart = s.indexOf("var LOOP_MARK = ");
const nextLineAfterBlock = s.indexOf("\n", s.indexOf("_stripLoopMarks(arr)", lmStart)) + 1;
const oldLMBlock = s.substring(lmStart, nextLineAfterBlock);
const newLMBlock =
'  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";' + "\n" +
'  var LOOP_SEP = "\\x00";' + "\n" +
'  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }' + "\n" +
'  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }' + "\n" +
'  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }' + "\n" +
'  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }' + "\n" +
'  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }' + "\n" +
'  var _nextLoopId = 0;' + "\n" +
'  function _nextLid() { return "l" + (++_nextLoopId); }';
s = s.split(oldLMBlock).join(newLMBlock);
console.log("5. LOOP_MARK: " + oldLMBlock.length + "→" + newLMBlock.length + " bytes");

// 6. Dialog confirm — MUST run BEFORE bulk loop→loops
let d1 = s.indexOf("_st.loop.totalCount = _totalCount");
console.log("Dialog line found at: " + d1);
s = s.replace(
  "_st.loop.totalCount = _totalCount; _st.loop.intervalMinutes = _intervalMinutes; _st.loop.ttlMinutes = _ttlVal === '' ? null : (parseInt(_ttlVal, 10) || null)",
  "var _fdid = _st.loops ? Object.keys(_st.loops)[0] : null; if (_fdid && _st.loops[_fdid]) { var _fd = _st.loops[_fdid]; _fd.totalCount = _totalCount; _fd.intervalMinutes = _intervalMinutes; _fd.ttlMinutes = _ttlVal === '' ? null : (parseInt(_ttlVal, 10) || null); }");
console.log("6. Dialog: " + (s.indexOf("_fdid") >= 0));

// 7. _createPreview — BEFORE bulk replace
s = s.replace(
  "var _psLoopState = window.__preSendState?.get(_key)?.loop || null;",
  "var _loopsRef = window.__preSendState?.get(_key)?.loops || {};\n    var _psLoopState = (function(){ var _lk = Object.keys(_loopsRef); return _lk.length > 0 ? _loopsRef[_lk[0]] : null; })();");
console.log("7. _createPreview: " + (s.indexOf("_loopsRef") >= 0));

// 8. Escape handler — BEFORE bulk replace
s = s.replaceAll("_ex.loop && _ex.loop.enabled", "_ex.loops && Object.keys(_ex.loops).length > 0");
s = s.replaceAll("_ex.loop = null;", "_ex.loops = {};");
console.log("8. Escape");

// 9. Delete button — BEFORE bulk replace
let d9 = s.indexOf("if (_delIsLoop && _psState.loop)");
console.log("Delete line at: " + d9 + " text: " + s.substring(d9, d9+60));
if (d9 >= 0) {
  s = s.substring(0, d9) + "if (_delIsLoop) {\n          var _delLid = _loopId(_psState.texts[idx] || \"\"); if (_delLid && _psState.loops) delete _psState.loops[_delLid];" + s.substring(d9 + "if (_delIsLoop && _psState.loop) {\n          _psState.loop = {};".length);
  console.log("9. Delete: " + (s.indexOf("_delLid") >= 0));
}

// 10. Bulk: loop: → loops: (AFTER dialog/preview/escape/delete)
let c1 = (s.match(/loop: _state\.loop/g) || []).length;
let c2 = (s.match(/loop: _existing\.loop/g) || []).length;
let c3 = (s.match(/loop: _loopMeta/g) || []).length;
let c4 = (s.match(/"loop":/g) || []).length;
s = s.replaceAll("loop: _state.loop", "loops: _state.loops");
s = s.replaceAll("loop: _existing.loop", "loops: _existing.loops");
s = s.replaceAll("loop: _loopMeta", "loops: _tmpLoops");
if (c4 > 0) s = s.replaceAll('"loop":', '"loops":');
console.log("10. localStorage: " + c1 + "+" + c2 + "+" + c3 + "+" + c4 + " loop→loops");

// 11. SessionId — loop→loops
s = s.replaceAll("_existing.loop && _existing.loop.enabled", "_existing.loops && Object.keys(_existing.loops).length > 0");
s = s.replaceAll("_existing.loop =", "_existing.loops =");
s = s.replaceAll(".loop && .loop.enabled", ".loops && Object.keys(.loops).length > 0"); // catch variants
console.log("11. SessionId migration");

// WRITE + VERIFY
fs.writeFileSync(p, s, "utf8");
const r = cp.spawnSync("D:/Program Files/node-v22.17.1-win-x64/node.exe", ["--check", p], {encoding: "utf8"});
if (r.status === 0) {
  console.log("\nSYNTAX OK ✓");
  // Feature checklist
  const features = [
    "LOOP_SEP", "_loopId", "_makeLoopMarked", "_nextLid", "_insIdx",
    "_sendLid", "_loopId(t) !== _lid", "_delLid", "_loopsRef", "_fdid"
  ];
  features.forEach(function(k) { console.log("  " + k + ": " + (s.indexOf(k) >= 0 ? "✓" : "✗")); });
} else {
  console.log("\nSYNTAX ERROR:");
  const errMsg = r.stderr.replace(p, "index.js").replace(/\\/g, "/");
  console.log(errMsg.substring(0, 400));
  process.exit(1);
}
