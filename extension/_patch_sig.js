// Add send button to loop items + allow send for loop items in onclick
var fs = require("fs"), cp = require("child_process");
var p = "d:/桌面/ClaudecodeYOLO/extension/webview/index.js";
var s = fs.readFileSync(p, "utf8");

// 1. Add send button to loop item HTML template
// Old: just delete button
var oldDelOnly = '_loopCountStr + \'</div>\' +\n          \'<div class="preSendPreviewItemActions">\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete"';
// New: send + delete
var newSendDel = '_loopCountStr + \'</div>\' +\n          \'<div class="preSendPreviewItemActions">\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnSend" data-action="send" data-index="\' + i + \'" title="提前发送">\' + _sendIcon + \'</button>\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete"';
if (s.indexOf(oldDelOnly) >= 0) {
  s = s.replace(oldDelOnly, newSendDel);
  console.log("1. Send button added to loop items");
} else {
  console.log("1. SKIP - loop delete-only pattern not found");
  // Try alternative pattern
  var alt = '_loopCountStr + "</div>" +\n          \'<div class="preSendPreviewItemActions">\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete"';
  if (s.indexOf(alt) >= 0) {
    s = s.replace(alt, '_loopCountStr + "</div>" +\n          \'<div class="preSendPreviewItemActions">\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnSend" data-action="send" data-index="\' + i + \'" title="提前发送">\' + _sendIcon + \'</button>\' +\n            \'<button class="preSendPreviewBtn preSendPreviewBtnDelete" data-action="delete"');
    console.log("1b. Send button added (alt pattern)");
  }
}

// 2. Allow loop items to be sent via onclick (remove _isLoopMark guard)
var oldGuard = "_isOptMark(_psState.texts[idx]) || _isLoopMark(_psState.texts[idx])";
if (s.indexOf(oldGuard) >= 0) {
  s = s.replace(oldGuard, "_isOptMark(_psState.texts[idx])");
  console.log("2. onclick: loop items can send");
} else {
  console.log("2. SKIP - guard not found");
}

fs.writeFileSync(p, s, "utf8");
var r = cp.spawnSync("D:/Program Files/node-v22.17.1-win-x64/node.exe", ["--check", p], {encoding:"utf8"});
if (r.status === 0) console.log("SYNTAX OK");
else { console.log("ERR: " + r.stderr.substring(0, 300)); process.exit(1); }
