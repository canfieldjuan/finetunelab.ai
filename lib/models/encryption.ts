// Encryption Utilities for API Key Storage
// AES-256-GCM encryption for sensitive credentials
// Date: 2025-10-14

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;  // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16;  // 16 bytes authentication tag
const SALT_LENGTH = 32;  // 32 bytes salt for key derivation

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable not set. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }
  if (key.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be at least 32 characters. ' +
      'Current length: ' + key.length
    );
  }
  return key;
}

// ============================================================================
// KEY DERIVATION
// ============================================================================

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    100000,  // iterations
    32,      // key length (256 bits)
    'sha256'
  );
}

// ============================================================================
// ENCRYPTION
// ============================================================================

export function encrypt(plaintext: string): string {
  try {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty string');
    }

    console.log('[Encryption] Encrypting value (length:', plaintext.length, ')');

    const password = getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]);

    const result = combined.toString('base64');
    console.log('[Encryption] Encryption successful');

    return result;
  } catch (error) {
    console.error('[Encryption] Encryption failed:', error);
    throw new Error(
      'Encryption failed: ' +
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

// ============================================================================
// DECRYPTION
// ============================================================================

export function decrypt(encrypted: string): string {
  try {
    if (!encrypted) {
      throw new Error('Cannot decrypt empty string');
    }

    console.log('[Encryption] Decrypting value');

    const password = getEncryptionKey();
    const combined = Buffer.from(encrypted, 'base64');

    if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data: too short');
    }

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );

    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext.toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    console.log('[Encryption] Decryption successful');

    return decrypted;
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    throw new Error(
      'Decryption failed: ' +
      (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isEncrypted(value: string): boolean {
  if (!value) return false;

  try {
    const combined = Buffer.from(value, 'base64');
    return combined.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// ============================================================================
// API KEY PREVIEW (for UI display)
// ============================================================================

export function createApiKeyPreview(apiKey: string): string {
  if (!apiKey) return '';

  if (apiKey.length <= 10) {
    return apiKey.slice(0, 3) + '***';
  }

  const start = apiKey.slice(0, 7);
  const end = apiKey.slice(-4);

  return `${start}...${end}`;
}

// ============================================================================
// TESTING
// ============================================================================

export function testEncryption(): void {
  const testData = [
    'sk-proj-test123',
    'hf_1234567890',
    'very-long-api-key-with-special-chars-!@#$%^&*()',
  ];

  console.log('[Encryption] Running encryption tests...');

  for (const data of testData) {
    console.log('[Encryption] Testing:', createApiKeyPreview(data));

    const encrypted = encrypt(data);
    console.log('[Encryption] Encrypted length:', encrypted.length);

    const decrypted = decrypt(encrypted);
    console.log('[Encryption] Decrypted:', createApiKeyPreview(decrypted));

    if (data !== decrypted) {
      throw new Error('Encryption test failed: mismatch');
    }

    console.log('[Encryption] Test passed');
  }

  console.log('[Encryption] All tests passed!');
}
