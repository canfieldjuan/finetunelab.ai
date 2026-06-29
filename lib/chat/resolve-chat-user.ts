// Resolve the chat request's user in "normal mode".
//
// Security-critical: only a VERIFIED session resolves to a user id.
// Body- or memory-supplied ids are caller claims, not authentication, and must not
// unlock per-user data such as MCP servers, model rows, context, documents, or
// conversation history.
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
  const { authHeader, verifySession } = params;

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

  // Unverified normal-mode callers are anonymous for all per-user data paths.
  return { userId: null, isAuthenticated: false };
}
