// Resolve the chat request's user in "normal mode".
//
// Security-critical: a VERIFIED session always wins over a body-supplied userId.
// A valid token can't be paired with a victim's body `userId` to act as them (esp.
// to load their MCP servers). Only a verified session is treated as authenticated.
// Extracted from the chat route so the invariant is unit-testable.

export interface ResolvedChatUser {
  userId: string | null;
  /** True only when a session token was verified server-side. */
  isAuthenticated: boolean;
}

export interface ResolveChatUserParams {
  authHeader: string | null;
  requestUserId: string | null;
  memoryUserId?: string | null;
  /**
   * Verify a Bearer auth header server-side (e.g. supabase.auth.getUser) and return
   * the authenticated user, or null if invalid. Injected so it can be stubbed.
   */
  verifySession: (authHeader: string) => Promise<{ id: string } | null>;
}

export async function resolveChatUser(params: ResolveChatUserParams): Promise<ResolvedChatUser> {
  const { authHeader, requestUserId, memoryUserId, verifySession } = params;

  if (authHeader && /^Bearer\s+.+/i.test(authHeader)) {
    try {
      const user = await verifySession(authHeader);
      if (user) {
        // Verified session id overrides any body-supplied id (no impersonation).
        return { userId: user.id, isAuthenticated: true };
      }
    } catch (error) {
      console.warn('[chat] session verification failed:', error);
    }
  }

  // Unverified fallback (NOT authenticated, not MCP-eligible): body-supplied id.
  return { userId: requestUserId || memoryUserId || null, isAuthenticated: false };
}
