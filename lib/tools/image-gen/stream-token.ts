/**
 * Short-lived, job-scoped token for the image SSE stream.
 *
 * EventSource can't set an Authorization header, so the token rides the URL.
 * Forwarding the full Supabase *session* token that way leaks full account
 * access into logs / history / Referer (review MINOR on #72). Instead we mint a
 * signed token bound to a single (jobId, userId) with a minutes-TTL: a leaked
 * URL then exposes one image stream until it expires, not the account.
 *
 * Same HMAC-SHA256 scheme as the chat route's export-link signer.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  return (
    process.env.IMAGE_STREAM_SIGNING_SECRET ||
    process.env.EXPORT_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(value: string): Buffer {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export interface ImageStreamTokenClaims {
  jobId: string;
  userId: string;
}

/** Mint a token bound to a job + user. Returns null if no signing secret is set. */
export function signImageStreamToken(
  claims: ImageStreamTokenClaims,
  ttlMs: number = DEFAULT_TTL_MS,
): string | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const payload = { jobId: claims.jobId, userId: claims.userId, exp: Date.now() + ttlMs };
    const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload), 'utf-8'));
    const sig = createHmac('sha256', secret).update(payloadB64).digest('hex');
    return `${payloadB64}.${sig}`;
  } catch {
    return null;
  }
}

/** Verify a token; returns its claims, or null for a bad signature / expiry / malformed input. */
export function verifyImageStreamToken(token: string | null | undefined): ImageStreamTokenClaims | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const expected = createHmac('sha256', secret).update(payloadB64).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf-8')) as {
      jobId?: unknown;
      userId?: unknown;
      exp?: unknown;
    };
    if (
      typeof payload.jobId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return { jobId: payload.jobId, userId: payload.userId };
  } catch {
    return null;
  }
}
