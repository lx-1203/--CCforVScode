import json

with open("extension/extension.js", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "  async optimizePrompt(K, V, B, j, signal) {"
end_marker = "  async loadUserSettings() {"

start_idx = content.index(start_marker)
end_idx = content.index(end_marker)

print(f"Found method at {start_idx} to {end_idx}")

nl = "
"
lines = []