/**
 * Demo API Key Encryption Utility
 * Uses AES-256-GCM for secure encryption of user-provided API keys
 *
 * Keys are encrypted at rest and decrypted only when needed for API calls.
 * All encrypted data is automatically deleted after demo completion or 1 hour TTL.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * Falls back to a derived key from SUPABASE_SERVICE_ROLE_KEY for development
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.DEMO_ENCRYPTION_KEY;

  if (envKey) {
    // If hex string provided, convert to buffer
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    // Otherwise derive a key from the string
    return crypto.scryptSync(envKey, 'demo-salt', KEY_LENGTH);
  }

  // In production, DEMO_ENCRYPTION_KEY is required
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEMO_ENCRYPTION_KEY is not set in a production environment. Please set it to a 32-byte hex string.');
  }

  // Fallback: derive from service role key (development only)
  const fallbackKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallbackKey) {
    throw new Error('No encryption key available. Set DEMO_ENCRYPTION_KEY environment variable.');
  }

  console.warn('[Demo Encryption] Using derived key from SUPABASE_SERVICE_ROLE_KEY. Set DEMO_ENCRYPTION_KEY for production.');
  return crypto.scryptSync(fallbackKey, 'demo-encryption-salt', KEY_LENGTH);
}

/**
 * Encrypt an API key for storage
 *
 * @param plaintext - The API key to encrypt
 * @returns Base64-encoded string containing IV + ciphertext + auth tag
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: must be a non-empty string');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine: IV (16 bytes) + encrypted data + auth tag (16 bytes)
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString('base64');
}

/**
 * Decrypt an API key from storage
 *
 * @param ciphertext - Base64-encoded encrypted data from encryptApiKey
 * @returns The original API key
 */
export function decryptApiKey(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Invalid ciphertext: must be a non-empty string');
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid ciphertext: too short');
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Verify that encryption is working correctly
 * Used for health checks and testing
 */
export function verifyEncryption(): { success: boolean; error?: string } {
  try {
    const testValue = 'test-api-key-' + crypto.randomBytes(8).toString('hex');
    const encrypted = encryptApiKey(testValue);
    const decrypted = decryptApiKey(encrypted);

    if (decrypted !== testValue) {
      return { success: false, error: 'Decrypted value does not match original' };
    }

    // Verify encrypted value is different from original
    if (encrypted === testValue) {
      return { success: false, error: 'Encrypted value is same as original' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate a new encryption key (for setup)
 * Outputs a 32-byte hex string suitable for DEMO_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
