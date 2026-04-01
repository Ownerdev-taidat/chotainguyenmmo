/**
 * Secure Action Utilities — Server & Client
 * ==========================================
 * HMAC-SHA256 signature cho API requests
 * Chống replay attack (timestamp + nonce)
 * 
 * Client: generateRequestSignature() → tạo signature gửi kèm request
 * Server: verifyRequestSignature() → verify signature từ client
 */

// ============================================================
// SHARED CONSTANTS
// ============================================================
export const SIGNATURE_HEADER = 'x-ctn-signature';
export const TIMESTAMP_HEADER = 'x-ctn-timestamp';
export const NONCE_HEADER = 'x-ctn-nonce';
export const REQUEST_ID_HEADER = 'x-ctn-request-id';

// Signature hết hạn sau 30 giây
const SIGNATURE_MAX_AGE_MS = 30_000;

// ============================================================
// CLIENT-SIDE: Generate Signature (chạy trong browser)
// ============================================================

/**
 * Tạo HMAC-SHA256 signature cho API request
 * key = session token (JWT)
 * message = method|path|timestamp|bodyHash
 */
export async function generateRequestSignature(
    method: string,
    path: string,
    body: string | null,
    sessionToken: string
): Promise<{
    signature: string;
    timestamp: string;
    nonce: string;
    requestId: string;
}> {
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const requestId = generateRequestId();

    // Hash body
    const bodyHash = body
        ? await sha256Hex(body)
        : 'e3b0c44298fc1c149afbf4c8996fb924';  // SHA256 of empty string (truncated)

    // Message to sign
    const message = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`;

    // HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(sessionToken);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const signature = bufferToHex(signatureBuffer);

    return { signature, timestamp, nonce, requestId };
}

// ============================================================
// SERVER-SIDE: Verify Signature (chạy trong Node.js/Edge)
// ============================================================

/**
 * Verify HMAC signature từ request headers
 * Kiểm tra: timestamp freshness + HMAC validity + nonce uniqueness
 */
export async function verifyRequestSignature(
    headers: Headers,
    method: string,
    path: string,
    body: string | null,
    secretOrToken: string
): Promise<{ valid: boolean; error?: string }> {
    const signature = headers.get(SIGNATURE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    const nonce = headers.get(NONCE_HEADER);

    if (!signature || !timestamp || !nonce) {
        return { valid: false, error: 'Missing signature headers' };
    }

    // Check timestamp freshness (±30s)
    const now = Date.now();
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > SIGNATURE_MAX_AGE_MS) {
        return { valid: false, error: 'Signature expired' };
    }

    // Check nonce uniqueness (chống replay)
    if (usedNonces.has(nonce)) {
        return { valid: false, error: 'Nonce already used (replay attack)' };
    }
    usedNonces.add(nonce);

    // Auto cleanup old nonces (keep last 5 minutes)
    if (usedNonces.size > 10000) {
        const arr = Array.from(usedNonces);
        usedNonces.clear();
        arr.slice(-5000).forEach(n => usedNonces.add(n));
    }

    // Recreate message and verify HMAC
    const bodyHash = body
        ? await serverSha256Hex(body)
        : 'e3b0c44298fc1c149afbf4c8996fb924';

    const message = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`;

    // Server-side HMAC (crypto module in Node.js or Edge runtime)
    const expectedSig = await serverHmacSha256(secretOrToken, message);

    if (signature !== expectedSig) {
        return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
}

// ============================================================
// NONCE STORE (in-memory, server-side)
// ============================================================
const usedNonces = new Set<string>();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateNonce(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function generateRequestId(): string {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function sha256Hex(data: string): Promise<string> {
    const encoded = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return bufferToHex(hash);
}

// Server-side SHA256 (works in both Node.js and Edge runtime)
async function serverSha256Hex(data: string): Promise<string> {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
        return sha256Hex(data);
    }
    // Node.js fallback
    const { createHash } = await import('crypto');
    return createHash('sha256').update(data).digest('hex');
}

// Server-side HMAC-SHA256
async function serverHmacSha256(key: string, message: string): Promise<string> {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
        const encoder = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(key),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
        return bufferToHex(sig);
    }
    // Node.js fallback
    const { createHmac } = await import('crypto');
    return createHmac('sha256', key).update(message).digest('hex');
}
