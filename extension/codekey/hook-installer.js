// ═══ CodeKey Hook Installer ═══
// Reads and merges hook configuration into .claude/settings.local.json
// Handles conflict detection and grace ful merging with existing hooks

var fs = require('fs');
var path = require('path');

var CK = require('./types.js');

/**
 * Get hooks directory path relative to extension
 * @param {string} codekeyRoot - path to codekey/ directory
 */
function getHooksDir(codekeyRoot) {
    return path.join(codekeyRoot, 'hooks');
}

/**
 * Build hook command for a given script name
 */
function hookCmd(codekeyRoot, scriptName) {
    var scriptPath = path.join(getHooksDir(codekeyRoot), scriptName).replace(/\\/g, '\\\\');
    return 'node "' + scriptPath + '"';
}

/**
 * Generate the complete CodeKey hooks configuration
 * @param {string} codekeyRoot - absolute path to codekey/ directory
 */
function generateHooksConfig(codekeyRoot) {
    return {
        PostToolUse: [
            {
                matcher: 'Bash',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_bash.js') }]
            },
            {
                matcher: 'Write',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_file.js') }]
            },
            {
                matcher: 'Edit',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_file.js') }]
            }
        ],
        PreToolUse: [
            {
                matcher: '',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_permission.js') }]
            }
        ],
        Notification: [
            {
                matcher: '',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_notification.js') }]
            }
        ],
        Stop: [
            {
                matcher: '',
                hooks: [{ type: 'command', command: hookCmd(codekeyRoot, 'codekey_hook_stop.js') }]
            }
        ]
    };
}

/**
 * Detect conflicts with existing hooks
 * @param {object} existing - existing hooks configuration
 * @param {object} incoming - CodeKey hooks to install
 * @returns {Array<{event: string, message: string}>}
 */
function detectConflicts(existing, incoming) {
    var conflicts = [];
    var existingEvents = Object.keys(existing || {});
    var incomingEvents = Object.keys(incoming || {});

    incomingEvents.forEach(function(eventType) {
        if (existingEvents.indexOf(eventType) >= 0) {
            conflicts.push({
                event: eventType,
                message: '事件 "' + eventType + '" 已有自定义 Hook 配置，CodeKey hook 将被合并'
            });
        }
    });

    return conflicts;
}

/**
 * Install CodeKey hooks into the workspace settings
 * @param {string} workspacePath - VS Code workspace path or process.cwd()
 * @param {string} codekeyRoot - absolute path to codekey/ directory
 * @param {boolean} autoInstall - if false, only detect conflicts without installing
 * @returns {{ installed: boolean, conflicts: Array, settingsPath: string }}
 */
function installHooks(workspacePath, codekeyRoot, autoInstall) {
    var settingsPath = path.join(workspacePath, '.claude', 'settings.local.json');
    var result = { installed: false, conflicts: [], settingsPath: settingsPath };

    var incomingHooks = generateHooksConfig(codekeyRoot);

    // Read existing settings
    var existingSettings = {};
    try {
        if (fs.existsSync(settingsPath)) {
            existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch(e) {
        console.log('[CodeKey Hook Installer] Could not read existing settings:', e.message);
        // Create .claude dir if needed
        var claudeDir = path.dirname(settingsPath);
        if (!fs.existsSync(claudeDir)) {
            try { fs.mkdirSync(claudeDir, { recursive: true }); } catch(e2) {}
        }
    }

    // Detect conflicts
    result.conflicts = detectConflicts(existingSettings.hooks, incomingHooks);

    if (!autoInstall) {
        return result;
    }

    // Merge hooks
    if (!existingSettings.hooks) existingSettings.hooks = {};

    Object.keys(incomingHooks).forEach(function(eventType) {
        if (existingSettings.hooks[eventType]) {
            // Merge: append new hooks to existing ones
            existingSettings.hooks[eventType] = existingSettings.hooks[eventType].concat(incomingHooks[eventType]);
        } else {
            existingSettings.hooks[eventType] = incomingHooks[eventType];
        }
    });

    // Write back
    try {
        var dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
        result.installed = true;
        console.log('[CodeKey Hook Installer] Hooks installed to', settingsPath);
    } catch(e) {
        console.error('[CodeKey Hook Installer] Write failed:', e.message);
    }

    return result;
}

/**
 * Uninstall CodeKey hooks (remove only ours, keep user's)
 * @param {string} workspacePath
 */
function uninstallHooks(workspacePath) {
    var settingsPath = path.join(workspacePath, '.claude', 'settings.local.json');
    try {
        if (!fs.existsSync(settingsPath)) return { removed: false, reason: 'No settings file' };
        var settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!settings.hooks) return { removed: false, reason: 'No hooks configured' };

        var removed = 0;
        Object.keys(settings.hooks).forEach(function(eventType) {
            var before = settings.hooks[eventType].length;
            // Remove hooks whose command contains "codekey_hook_"
            settings.hooks[eventType] = settings.hooks[eventType].filter(function(entry) {
                if (entry.hooks) {
                    entry.hooks = entry.hooks.filter(function(h) {
                        return !h.command || h.command.indexOf('codekey_hook_') < 0;
                    });
                }
                return entry.hooks && entry.hooks.length > 0;
            });
            if (settings.hooks[eventType].length === 0) {
                delete settings.hooks[eventType];
            }
            removed += before - (settings.hooks[eventType] ? settings.hooks[eventType].length : 0);
        });

        if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        return { removed: removed > 0, count: removed };
    } catch(e) {
        return { removed: false, reason: e.message };
    }
}

module.exports = {
    generateHooksConfig: generateHooksConfig,
    detectConflicts: detectConflicts,
    installHooks: installHooks,
    uninstallHooks: uninstallHooks,
    getHooksDir: getHooksDir
};
