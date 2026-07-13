const fs = require('fs');
let content = fs.readFileSync('extension/extension.js', 'utf8');

let startMarker = '  async optimizePrompt(K, V, B, j, signal) {';
let endMarker = '  async loadUserSettings() {';

let startIdx = content.indexOf(startMarker);
let endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found');
  process.exit(1);
}

console.log('Found method at:', startIdx, 'to:', endIdx);

// Use RegExp to replace the method
// Find the method end by looking for the next '}' that is at the same indentation level
let newMethod = `async optimizePrompt(K, V, B, j, signal, channelId) {}';

// Just do a simple signature replace first
content = content.replace(
  ' async optimizePrompt(K, V, B, j, signal) K',
  ' async optimizePrompt(K, V, B, j, signal, channelId) K'
);

fs.writeFileSync('extension/extension.js', content, 'utf8');
console.log('Signature updated');
