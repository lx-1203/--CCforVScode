// Two-timer refactoring script
// Adds ttlMinutes (termination TTL) separate from intervalMinutes (loop interval)
// Safe: backs up original file first

const fs = require("fs");
const p = "extension/webview/index.js";
const orig = fs.readFileSync(p, "utf8");

// Backup
fs.writeFileSync(p + ".timer_backup", orig);
console.log("Backed up to " + p + ".timer_backup");

let s = orig;

// ====== 1. Add ttlMinutes to loopMeta initialization ======
const oldMeta = "var _loopMeta = { enabled: true, sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, nextLoopAt: null };";
const newMeta = "var _loopMeta = { enabled: true, sourceText: sourceText, totalCount: null, completed: 0, intervalMinutes: _intervalMin, ttlMinutes: null, nextLoopAt: null };";
if (s.indexOf(oldMeta) >= 0) { s = s.split(oldMeta).join(newMeta); console.log("1. loopMeta: added ttlMinutes"); }
else { console.log("1. SKIP - meta not found"); }

// ====== 2. Change send-index guard: _loop.startedAt → _loop.completed > 0 ======
// In the send-index search: if (_loop && _loop.nextLoopAt && _loop.startedAt)
const oldSendGuard = "if (_loop && _loop.nextLoopAt && _loop.startedAt)";
const newSendGuard = "if (_loop && _loop.nextLoopAt && _loop.completed > 0)";
if (s.indexOf(oldSendGuard) >= 0) { s = s.split(oldSendGuard).join(newSendGuard); console.log("2. send-index guard: completed>0"); }
else { console.log("2. SKIP - send guard not found: " + (s.indexOf("_loop && _loop.nextLoopAt &&") >= 0 ? "found partial" : "not found")); }

// ====== 3. Replace startedAt with ttlStartedAt in TTL termination check ======
// Old TTL check: if (_loop && _loop.startedAt && Date.now() > _loop.startedAt + _loop.intervalMinutes * 60000)
const oldTTLCheck = "if (_loop && _loop.startedAt && Date.now() > _loop.startedAt + _loop.intervalMinutes * 60000) {";
const newTTLCheck = "if (_loop && _loop.ttlMinutes !== null && _loop.ttlStartedAt && Date.now() > _loop.ttlStartedAt + _loop.ttlMinutes * 60000) {";
if (s.indexOf(oldTTLCheck) >= 0) { s = s.split(oldTTLCheck).join(newTTLCheck); console.log("3. TTL check: ttlMinutes + ttlStartedAt"); }
else { console.log("3. SKIP - TTL check not found, searching...");
  var idx = s.indexOf("_loop.startedAt && Date.now()");
  if (idx >= 0) console.log("   found at: " + s.substring(idx-40, idx+40));
}

// ====== 4. Replace re-enqueue startedAt with ttlStartedAt ======
// if (!_loop.startedAt) _loop.startedAt = Date.now();
const oldStartedSet = "if (!_loop.startedAt) _loop.startedAt = Date.now();";
const newStartedSet = "if (_loop.ttlMinutes !== null && !_loop.ttlStartedAt) _loop.ttlStartedAt = Date.now();";
if (s.indexOf(oldStartedSet) >= 0) { s = s.split(oldStartedSet).join(newStartedSet); console.log("4. re-enqueue: ttlStartedAt"); }
else { console.log("4. SKIP - startedAt set not found"); }

// ====== 5. Update _showLoopSetupDialog: add TTL input ======
// Find the dialog HTML and add a TTL row
const oldDialogRow = "'<div class=\"loopSetupRow\"><label>间隔</label><input type=\"number\" class=\"loopSetupInput\" id=\"loopSetupInterval\" min=\"1\" value=\"' + _esc(_defaultInterval) + '\" /><span style=\"font-size:12px;opacity:0.6\">分钟</span></div>'";
const newDialogRow = "'<div class=\"loopSetupRow\"><label>间隔</label><input type=\"number\" class=\"loopSetupInput\" id=\"loopSetupInterval\" min=\"1\" value=\"' + _esc(_defaultInterval) + '\" /><span style=\"font-size:12px;opacity:0.6\">分钟</span></div>'\n      + '<div class=\"loopSetupRow\"><label>终止</label><input type=\"number\" class=\"loopSetupInput\" id=\"loopSetupTTL\" min=\"0\" placeholder=\"∞ 无限\" value=\"\" /><span style=\"font-size:12px;opacity:0.6\">分钟</span></div>'";
if (s.indexOf(oldDialogRow) >= 0) { s = s.split(oldDialogRow).join(newDialogRow); console.log("5. dialog: TTL input row"); }
else { console.log("5. SKIP - dialog row not found"); }

// ====== 6. Update dialog confirm handler to read TTL ======
// Find: var _intervalVal = parseInt(...); ... _div.remove();
// Add TTL reading
const oldConfirm = "var _intervalVal = parseInt(_div.querySelector('#loopSetupInterval').value, 10);\n      _div.remove();";
const newConfirm = "var _intervalVal = parseInt(_div.querySelector('#loopSetupInterval').value, 10);\n      var _ttlVal = _div.querySelector('#loopSetupTTL').value.trim();\n      _div.remove();";
if (s.indexOf(oldConfirm) >= 0) { s = s.split(oldConfirm).join(newConfirm); console.log("6. confirm: read TTL"); }
else { console.log("6. SKIP - confirm handler not found"); }

// ====== 7. Update dialog confirm to set ttlMinutes on loop ======
// After: _st.loop.intervalMinutes = _intervalMinutes;
// Add ttl setting
const oldSetInterval = "_st.loop.intervalMinutes = _intervalMinutes;";
const newSetInterval = "_st.loop.intervalMinutes = _intervalMinutes;\n      _st.loop.ttlMinutes = _ttlVal === '' ? null : (parseInt(_ttlVal, 10) || null);";
if (s.indexOf(oldSetInterval) >= 0) { s = s.split(oldSetInterval).join(newSetInterval); console.log("7. confirm: save ttlMinutes"); }
else { console.log("7. SKIP - setInterval not found"); }

// ====== 8. Update _createPreview countdown to show TTL ======
// Currently shows: _psLoopState.nextLoopAt → time until next send
// Also show TTL: _psLoopState.ttlStartedAt + _psLoopState.ttlMinutes - Date.now()
// Add TTL countdown next to the existing countdown span
// The old countdown starts with: ' <span class=\"loopCountdown\"
// Add TTL after it

// First, let's add a TTL countdown in header label when loop is active and ttlMinutes is set
// Find: var _cdHtml = ''; and the loopCountdown span generation
// We need to add TTL display separately

// The label construction area: find '⏱' in the _createPreview header
var cdIdx = s.indexOf("loopCountdown");
if (cdIdx >= 0) {
  // Find the _labelHtml line that concatenates everything
  var labelIdx = s.lastIndexOf("var _labelHtml = _loopIcon", cdIdx);
  if (labelIdx >= 0) {
    var lineEnd = s.indexOf(";", labelIdx);
    var oldLabel = s.substring(labelIdx, lineEnd + 1);
    // The countdown currently shows nextLoopAt countdown (⏱ time until next send)
    // We want to keep that AND add a TTL countdown
    // Modify: after _cdHtml, add _ttlCdHtml

    // Insert TTL countdown calculation BEFORE the _labelHtml line
    var ttlCdCode = "\n      var _ttlCdHtml = '';\n      if (_psLoopState.ttlStartedAt && _psLoopState.ttlMinutes !== null) {\n        var _ttlRemain = Math.max(0, _psLoopState.ttlStartedAt + _psLoopState.ttlMinutes * 60000 - Date.now());\n        var _ttlMin = Math.floor(_ttlRemain / 60000), _ttlSec = Math.floor((_ttlRemain % 60000) / 1000);\n        var _ttlCdText = _ttlMin > 0 ? _ttlMin + ':' + (_ttlSec < 10 ? '0' : '') + _ttlSec : _ttlSec + 's';\n        _ttlCdHtml = ' <span class=\"ttlCountdown\" style=\"font-variant-numeric:tabular-nums;opacity:0.5;font-size:10px;color:#f48771\">⏳ ' + _ttlCdText + '</span>';\n      }\n      ";

    s = s.substring(0, labelIdx) + ttlCdCode + s.substring(labelIdx);
    console.log("8a. Added TTL countdown calc before label");

    // Now append _ttlCdHtml to the label
    // The label currently: _loopIcon + ' 循环中 ' + _countDisp + _cdHtml + (count > 1...)
    // We want: ... + _cdHtml + _ttlCdHtml + (count > 1...)

    // Re-find the label line (it shifted)
    var newLabelIdx = s.indexOf("var _labelHtml = _loopIcon +", labelIdx);
    if (newLabelIdx >= 0) {
      var newLineEnd = s.indexOf(";", newLabelIdx);
      var currentLabel = s.substring(newLabelIdx, newLineEnd);
      // _cdHtml + (count > 1 → _cdHtml + _ttlCdHtml + (count > 1
      var oldPart = "_cdHtml + (count > 1";
      var newPart = "_cdHtml + _ttlCdHtml + (count > 1";
      if (currentLabel.indexOf(oldPart) >= 0) {
        s = s.substring(0, newLabelIdx) + currentLabel.split(oldPart).join(newPart) + s.substring(newLineEnd);
        console.log("8b. Appended TTL countdown to label");
      } else {
        console.log("8b. SKIP - _cdHtml + (count > 1 not in label");
        console.log("   label extract: " + currentLabel.substring(0, 100));
      }
    }
  }
} else {
  console.log("8. SKIP - loopCountdown not found");
}

// ====== Final: verify key changes ======
var checks = [
  ["ttlMinutes", "ttlMinutes field"],
  ["_loop.completed > 0", "send-index guard"],
  ["ttlMinutes !== null && _loop.ttlStartedAt", "TTL termination check"],
  ["ttlStartedAt = Date.now", "ttlStartedAt set"],
  ["loopSetupTTL", "TTL dialog input"],
  ["_ttlCdHtml", "TTL countdown code"],
];
var allOk = true;
for (var i = 0; i < checks.length; i++) {
  if (s.indexOf(checks[i][0]) < 0) { console.log("MISSING: " + checks[i][1] + " (" + checks[i][0] + ")"); allOk = false; }
  else console.log("OK: " + checks[i][1]);
}

if (!allOk) {
  console.log("\nSome checks failed. Not writing file.");
  process.exit(1);
}

fs.writeFileSync(p, s, "utf8");
console.log("\nAll changes applied. File written.");
