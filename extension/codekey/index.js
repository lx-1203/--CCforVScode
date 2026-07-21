// ═══ CodeKey Module Entry ═══
// Public API for extension.js integration

var path = require('path');

var CK = require('./types.js');
var cryptoLib = require('./crypto.js');
var pairingManager = require('./pairing.js');
var privacyPipeline = require('./privacy-pipeline.js');
var RelayClient = require('./relay-client.js');
var ApprovalBridge = require('./handler.js');

module.exports = {
    // Constants
    CK: CK,

    // Crypto
    crypto: cryptoLib,

    // Pairing & Device Management
    pairing: pairingManager,

    // Privacy Pipeline
    privacy: privacyPipeline,

    // Relay Client class
    RelayClient: RelayClient,

    // Approval Bridge class
    ApprovalBridge: ApprovalBridge,

    // Bridge entry path (for child_process.fork)
    getBridgeEntryPath: function() {
        return path.join(__dirname, 'bridge-entry.js');
    }
};
