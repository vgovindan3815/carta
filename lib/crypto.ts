import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

const ALGO = 'aes-256-gcm';
const NEW_PREFIX = 'v2:';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
  return Buffer.from(hex, 'hex');
}

/** Encrypt plaintext with AES-256-GCM. Returns a base64 string prefixed with "v2:". */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return NEW_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by encrypt().
 * Falls back to legacy base64 decode for values stored before encryption was implemented
 * (those lack the "v2:" prefix).
 */
export function decrypt(encoded: string): string {
  if (!encoded.startsWith(NEW_PREFIX)) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  const key = getKey();
  const buf = Buffer.from(encoded.slice(NEW_PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Constant-time string comparison — prevents timing side-channel attacks. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
