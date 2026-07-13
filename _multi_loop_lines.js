// Multi-loop refactor by exact line replacement
// Based on verified line numbers from the backup file (207312-207832 range)
const fs = require("fs");
const p = "extension/webview/index.js";
let lines = fs.readFileSync(p, "utf8").split("\n");

function spliceLines(startLine, endLine, replacementLines) {
  // startLine, endLine are 1-indexed
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine); // endLine is exclusive in our system
  lines = before.concat(replacementLines, after);
  console.log(`Replaced L${startLine}-${endLine} with ${replacementLines.length} lines`);
}

// 1. LOOP_MARK + helpers + _nextLid (L207312-207315, 4 lines → 7 lines)
const newMarkHelpers = [
'  var LOOP_MARK = "\\x01\\x02LOOP\\x02\\x01";',
'  var LOOP_SEP = "\\x00";',
'  function _isLoopMark(t) { return typeof t === "string" && t.indexOf(LOOP_MARK) === 0; }',
'  function _loopId(t) { return _isLoopMark(t) ? t.slice(LOOP_MARK.length, t.indexOf(LOOP_SEP, LOOP_MARK.length)) : ""; }',
'  function _loopOrig(t) { var _idx = _isLoopMark(t) ? t.indexOf(LOOP_SEP, LOOP_MARK.length) : -1; return _idx >= 0 ? t.slice(_idx + 1) : (_isLoopMark(t) ? t.slice(LOOP_MARK.length) : t); }',
'  function _makeLoopMarked(id, text) { return LOOP_MARK + id + LOOP_SEP + text; }',
'  function _stripLoopMarks(arr) { return arr.map(function(t) { return _loopOrig(t); }); }',
'  var _nextLoopId = 0;',
'  function _nextLid() { return "l" + (++_nextLoopId); }',
];
spliceLines(207312, 207316, newMarkHelpers);
// Adjust: line numbers shift after each splice. We need to recalculate.
// Actually let me use a simpler approach: do all replaces in one pass from bottom to top

console.log("Aborting line-based approach — too fragile with shifting.");
console.log("Using regex replace on anchor strings instead.");
