// API Key Validator Middleware
// Validates API keys and retrieves user context
// Date: 2025-10-17

import { createClient } from '@supabase/supabase-js';
import { validateApiKeyFormat, verifyApiKeyHash } from './api-key-generator';
import { apiConfig } from '@/lib/config/api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApiKeyValidationResult {
  isValid: boolean;
  userId?: string;
  keyName?: string;
  keyHash?: string;
  isActive?: boolean;
  errorMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  errorMessage?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// In-memory rate limit tracking (simple implementation)
// For production, use Redis or similar
const rateLimitMap = new Map<string, {
  count: number;
  resetAt: Date;
}>();

// ============================================================================
// VALIDATION - Block 1: Validate API Key Against Database
// ============================================================================

/**
 * Validates an API key by checking format and database
 * @param apiKey - The API key to validate
 * @returns Validation result with user context
 */
export async function validateApiKey(
  apiKey: string
): Promise<ApiKeyValidationResult> {
  try {
    // Step 1: Validate format
    console.log('[API Key Validator] Validating key format');
    if (!validateApiKeyFormat(apiKey)) {
      console.error('[API Key Validator] Invalid key format');
      return {
        isValid: false,
        errorMessage: 'Invalid API key format'
      };
    }

    // Step 2: Get Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API Key Validator] Missing Supabase environment variables');
      return {
        isValid: false,
        errorMessage: 'Server configuration error'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 3: Query database for active API keys
    console.log('[API Key Validator] Querying database for API keys');
    const { data: apiKeys, error } = await supabase
      .from('user_api_keys')
      .select('id, user_id, name, key_hash, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('[API Key Validator] Database error:', error);
      return {
        isValid: false,
        errorMessage: 'Database error'
      };
    }

    if (!apiKeys || apiKeys.length === 0) {
      console.log('[API Key Validator] No active API keys found');
      return {
        isValid: false,
        errorMessage: 'Invalid API key'
      };
    }

    // Step 4: Find matching key by verifying hash
    console.log('[API Key Validator] Checking', apiKeys.length, 'active keys');
    for (const keyRecord of apiKeys) {
      const isMatch = verifyApiKeyHash(apiKey, keyRecord.key_hash);
      if (isMatch) {
        console.log('[API Key Validator] Key validated successfully');
        console.log('[API Key Validator] User ID:', keyRecord.user_id);
        console.log('[API Key Validator] Key Name:', keyRecord.name);
        
        return {
          isValid: true,
          userId: keyRecord.user_id,
          keyName: keyRecord.name,
          keyHash: keyRecord.key_hash,
          isActive: true
        };
      }
    }

    // No matching key found
    console.log('[API Key Validator] No matching key found');
    return {
      isValid: false,
      errorMessage: 'Invalid API key'
    };

  } catch (error) {
    console.error('[API Key Validator] Unexpected error:', error);
    return {
      isValid: false,
      errorMessage: 'Internal server error'
    };
  }
}

// ============================================================================
// RATE LIMITING - Block 2: Check Request Rate Limits
// ============================================================================

/**
 * Checks if API key has exceeded rate limit
 * @param apiKeyHash - The hashed API key (for tracking)
 * @returns Rate limit result
 */
export function checkRateLimit(apiKeyHash: string): RateLimitResult {
  const now = new Date();
  
  // Get or create rate limit entry
  let limitEntry = rateLimitMap.get(apiKeyHash);
  
  if (!limitEntry || limitEntry.resetAt < now) {
    // Create new entry or reset expired entry
    limitEntry = {
      count: 0,
      resetAt: new Date(now.getTime() + apiConfig.rateLimit.windowMs)
    };
    rateLimitMap.set(apiKeyHash, limitEntry);
  }

  // Increment count
  limitEntry.count++;

  // Check if exceeded
  const allowed = limitEntry.count <= apiConfig.rateLimit.perKey;
  const remaining = Math.max(0, apiConfig.rateLimit.perKey - limitEntry.count);

  if (!allowed) {
    console.warn('[Rate Limit] Exceeded for key:', apiKeyHash.substring(0, 20) + '...');
    console.warn('[Rate Limit] Count:', limitEntry.count, 'Limit:', apiConfig.rateLimit.perKey);
  }
  
  return {
    allowed,
    remaining,
    resetAt: limitEntry.resetAt,
    errorMessage: allowed ? undefined : 'Rate limit exceeded. Try again later.'
  };
}

/**
 * Cleans up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log('[Rate Limit] Cleaned up', cleaned, 'expired entries');
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ============================================================================
// REQUEST HELPERS - Block 3: Extract API Key from Request
// ============================================================================

/**
 * Extracts API key from request headers
 * Supports multiple header formats:
 * - X-API-Key: wak_...
 * - X-Workspace-API-Key: wak_...
 * - Authorization: Bearer wak_...
 * 
 * @param headers - Request headers (NextRequest.headers or Headers)
 * @returns API key or null if not found
 */
export function extractApiKeyFromHeaders(
  headers: Headers
): string | null {
  // Try X-API-Key header
  let apiKey = headers.get('X-API-Key');
  if (apiKey) {
    console.log('[API Key Extractor] Found key in X-API-Key header');
    return apiKey.trim();
  }
  
  // Try X-Workspace-API-Key header
  apiKey = headers.get('X-Workspace-API-Key');
  if (apiKey) {
    console.log('[API Key Extractor] Found key in X-Workspace-API-Key header');
    return apiKey.trim();
  }
  
  // Try Authorization header (Bearer token)
  const authHeader = headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      console.log('[API Key Extractor] Found key in Authorization header');
      return match[1].trim();
    }
  }
  
  console.log('[API Key Extractor] No API key found in headers');
  return null;
}

/**
 * Validates API key from request and checks rate limit
 * Complete validation pipeline for API endpoints
 * 
 * @param headers - Request headers
 * @returns Validation result with user context
 */
export async function validateRequest(
  headers: Headers
): Promise<ApiKeyValidationResult & { rateLimitExceeded?: boolean }> {
  // Extract API key
  const apiKey = extractApiKeyFromHeaders(headers);
  
  if (!apiKey) {
    return {
      isValid: false,
      errorMessage: 'Missing API key. Provide in X-API-Key header or Authorization: Bearer header.'
    };
  }
  
  // Validate API key
  const validation = await validateApiKey(apiKey);
  
  if (!validation.isValid) {
    return validation;
  }
  
  // Check rate limit (use first 20 chars of key as identifier)
  const keyIdentifier = apiKey.substring(0, 20);
  const rateLimit = checkRateLimit(keyIdentifier);
  
  if (!rateLimit.allowed) {
    return {
      isValid: false,
      rateLimitExceeded: true,
      errorMessage: rateLimit.errorMessage
    };
  }
  
  // All checks passed
  return validation;
}
