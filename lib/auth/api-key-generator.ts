// API Key Generator for Widget Authentication
// Generates secure API keys with scrypt hashing (Node.js built-in)
// Date: 2025-10-17

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY_PREFIX = 'wak_';
const API_KEY_LENGTH = 32; // Total length: wak_ + 28 random chars
const SCRYPT_SALT_LENGTH = 16; // 16 bytes for scrypt salt
const SCRYPT_KEY_LENGTH = 32; // 32 bytes output
const SCRYPT_OPTIONS = {
  N: 16384, // CPU/memory cost (2^14)
  r: 8,     // Block size
  p: 1,     // Parallelization
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GeneratedApiKey {
  key: string;        // Full API key (wak_...)
  keyHash: string;    // Hash to store in DB
  keyPrefix: string;  // Prefix for display (wak_abc123...)
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  userId?: string;
  keyName?: string;
  isActive?: boolean;
}

// ============================================================================
// KEY GENERATION - Block 1: Generate Random Key
// ============================================================================

/**
 * Generates a random API key with prefix
 * @returns Full API key string (e.g., wak_1a2b3c4d5e6f...)
 */
function generateRandomKey(): string {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  
  // Convert to base62 (alphanumeric only)
  const base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  for (let i = 0; i < API_KEY_LENGTH; i++) {
    const index = randomBytes[i] % base62Chars.length;
    result += base62Chars[index];
  }
  
  return API_KEY_PREFIX + result;
}

// ============================================================================
// KEY GENERATION - Block 2: Hash API Key with Scrypt
// ============================================================================

/**
 * Hashes an API key using scrypt (secure one-way hash)
 * @param key - The API key to hash
 * @returns Hash in format: scrypt$salt$hash (base64)
 */
function hashApiKey(key: string): string {
  // Generate random salt
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  
  // Hash the key using scrypt
  const hash = crypto.scryptSync(
    key,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_OPTIONS
  );
  
  // Format: scrypt$salt$hash (both base64 encoded)
  const result = `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
  
  return result;
}

/**
 * Verifies an API key against its hash (constant-time comparison)
 * @param key - The API key to verify
 * @param storedHash - The hash from database
 * @returns true if key matches hash
 */
function verifyApiKey(key: string, storedHash: string): boolean {
  try {
    // Parse stored hash format: scrypt$salt$hash
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      console.error('[API Key] Invalid hash format');
      return false;
    }
    
    const salt = Buffer.from(parts[1], 'base64');
    const storedHashBuffer = Buffer.from(parts[2], 'base64');
    
    // Hash the provided key with same salt
    const computedHash = crypto.scryptSync(
      key,
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS
    );
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(storedHashBuffer, computedHash);
  } catch (error) {
    console.error('[API Key] Error verifying key:', error);
    return false;
  }
}

// ============================================================================
// KEY GENERATION - Block 3: Main Generation Function
// ============================================================================

/**
 * Generates a new API key with hash and prefix
 * This is the main function to call when creating new API keys
 * 
 * @returns Object with full key, hash (for DB), and prefix (for display)
 * 
 * @example
 * const { key, keyHash, keyPrefix } = generateApiKey();
 * // key: "wak_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
 * // keyHash: "scrypt$abc123...$def456..."
 * // keyPrefix: "wak_1a2b3c4d..."
 */
export function generateApiKey(): GeneratedApiKey {
  console.log('[API Key] Generating new API key');
  
  // Generate random key
  const key = generateRandomKey();
  
  // Hash the key for secure storage
  const keyHash = hashApiKey(key);
  
  // Create display prefix (first 12 characters)
  const keyPrefix = key.substring(0, 12) + '...';
  
  console.log('[API Key] Generated key with prefix:', keyPrefix);
  
  return {
    key,
    keyHash,
    keyPrefix: key.substring(0, 12) // Store just prefix, not with ...
  };
}

// ============================================================================
// KEY VALIDATION - Block 4: Validate API Key Format
// ============================================================================

/**
 * Validates API key format (doesn't check against database)
 * @param key - The API key to validate
 * @returns true if format is valid
 */
export function validateApiKeyFormat(key: string): boolean {
  if (!key) {
    return false;
  }
  
  // Must start with correct prefix
  if (!key.startsWith(API_KEY_PREFIX)) {
    console.error('[API Key] Invalid prefix. Expected:', API_KEY_PREFIX);
    return false;
  }
  
  // Must be correct total length
  const expectedLength = API_KEY_PREFIX.length + API_KEY_LENGTH;
  if (key.length !== expectedLength) {
    console.error('[API Key] Invalid length. Expected:', expectedLength, 'Got:', key.length);
    return false;
  }
  
  // Must be alphanumeric only (base62)
  const keyPart = key.substring(API_KEY_PREFIX.length);
  const base62Regex = /^[0-9A-Za-z]+$/;
  if (!base62Regex.test(keyPart)) {
    console.error('[API Key] Invalid characters. Must be alphanumeric.');
    return false;
  }
  
  return true;
}

/**
 * Verifies an API key against stored hash (exported for API routes)
 * @param key - The API key to verify
 * @param storedHash - The hash from database
 * @returns true if key matches hash
 */
export function verifyApiKeyHash(key: string, storedHash: string): boolean {
  return verifyApiKey(key, storedHash);
}

// ============================================================================
// TESTING UTILITIES - Block 5: Debug and Testing Functions
// ============================================================================

/**
 * Generates a test API key for development/testing
 * DO NOT use in production - this is for testing only
 */
export function generateTestApiKey(): GeneratedApiKey {
  console.warn('[API Key] WARNING: Generating TEST API key. Do not use in production!');
  return generateApiKey();
}

/**
 * Logs API key information for debugging (masks sensitive data)
 * @param key - The API key to log (will be masked)
 */
export function logApiKeyDebug(key: string): void {
  if (!key) {
    console.log('[API Key Debug] No key provided');
    return;
  }
  
  const prefix = key.substring(0, 12);
  const suffix = key.substring(key.length - 4);
  const masked = `${prefix}...${suffix}`;
  
  console.log('[API Key Debug]', {
    masked,
    length: key.length,
    hasPrefix: key.startsWith(API_KEY_PREFIX),
    isValidFormat: validateApiKeyFormat(key)
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

// All functions and types are exported inline above
// No need for re-exports since this is the source file

