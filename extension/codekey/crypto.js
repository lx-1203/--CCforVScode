// ═══ CodeKey E2E Cryptography ═══
// AES-256-GCM encryption + ECDH key exchange (P-256)
// Zero external dependencies — only Node.js built-in 'crypto'

var crypto = require('crypto');

// ── Constants ──
var KEY_LENGTH = 32;       // AES-256 = 32 bytes
var IV_LENGTH = 12;        // 96-bit IV for GCM
var TAG_LENGTH = 16;       // 128-bit auth tag
var PBKDF2_SALT = 'codekey-v2';
var PBKDF2_ITERATIONS = 100000;
var PBKDF2_KEYLEN = 32;

// ── ECDH Key Exchange ──

/** Generate ECDH P-256 key pair */
function generateKeyPair() {
    var keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}

/** Derive shared secret from our private key + peer's public key */
function deriveSharedSecret(privateKeyPem, peerPublicKeyPem) {
    var ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privateKeyPem);
    var secret = ecdh.computeSecret(peerPublicKeyPem, 'base64', 'buffer');
    // Hash the shared secret to get a fixed-length AES key
    return crypto.createHash('sha256').update(secret).digest();
}

// ── AES-256-GCM Encrypt/Decrypt ──

/**
 * Encrypt plaintext with AES-256-GCM
 * @param {string} plaintext - UTF-8 plaintext
 * @param {Buffer} key - 32-byte AES key
 * @returns {string} base64(iv[12] + ciphertext + tag[16])
 */
function encrypt(plaintext, key) {
    if (!Buffer.isBuffer(key)) key = Buffer.from(key);
    var iv = crypto.randomBytes(IV_LENGTH);
    var cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
    var encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    var tag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Decrypt base64 ciphertext with AES-256-GCM
 * @param {string} sealedData - base64(iv[12] + ciphertext + tag[16])
 * @param {Buffer} key - 32-byte AES key
 * @returns {string} UTF-8 plaintext
 */
function decrypt(sealedData, key) {
    if (!Buffer.isBuffer(key)) key = Buffer.from(key);
    var buf = Buffer.from(sealedData, 'base64');
    var iv = buf.slice(0, IV_LENGTH);
    var tag = buf.slice(buf.length - TAG_LENGTH);
    var encrypted = buf.slice(IV_LENGTH, buf.length - TAG_LENGTH);
    var decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Key Derivation ──

/**
 * Derive AES key from deviceToken using PBKDF2
 * @param {string} deviceToken - device authentication token
 * @returns {Buffer} 32-byte AES key
 */
function deriveContentKey(deviceToken) {
    return crypto.pbkdf2Sync(deviceToken, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha256');
}

/** Generate a random device token */
function generateDeviceToken() {
    return crypto.randomBytes(32).toString('base64url');
}

/** Generate a random message UUID */
function generateMessageId() {
    return crypto.randomUUID();
}

// ── Exports ──
module.exports = {
    generateKeyPair: generateKeyPair,
    deriveSharedSecret: deriveSharedSecret,
    encrypt: encrypt,
    decrypt: decrypt,
    deriveContentKey: deriveContentKey,
    generateDeviceToken: generateDeviceToken,
    generateMessageId: generateMessageId,
    KEY_LENGTH: KEY_LENGTH,
    IV_LENGTH: IV_LENGTH,
    TAG_LENGTH: TAG_LENGTH
};
