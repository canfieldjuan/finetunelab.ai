import { describe, expect, it, vi } from 'vitest';
import { resolveChatUser } from '../resolve-chat-user';

describe('resolveChatUser', () => {
  it('SECURITY: a verified session id overrides a body-supplied userId (no impersonation)', async () => {
    const verifySession = vi.fn().mockResolvedValue({ id: 'user-A' });
    const result = await resolveChatUser({
      authHeader: 'Bearer tokenA',
      requestUserId: 'victim-B', // attacker-claimed body id
      verifySession,
    });
    expect(result).toEqual({ userId: 'user-A', isAuthenticated: true });
    expect(verifySession).toHaveBeenCalledWith('Bearer tokenA');
  });

  it('falls back to the body userId (unauthenticated) when the token is invalid', async () => {
    const result = await resolveChatUser({
      authHeader: 'Bearer bad',
      requestUserId: 'body-user',
      verifySession: vi.fn().mockResolvedValue(null),
    });
    expect(result).toEqual({ userId: 'body-user', isAuthenticated: false });
  });

  it('uses the body userId (unauthenticated) when no auth header is present', async () => {
    const verifySession = vi.fn();
    const result = await resolveChatUser({
      authHeader: null,
      requestUserId: 'body-user',
      verifySession,
    });
    expect(result).toEqual({ userId: 'body-user', isAuthenticated: false });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it('ignores a non-Bearer auth header (no verification attempted)', async () => {
    const verifySession = vi.fn();
    const result = await resolveChatUser({
      authHeader: 'Basic abc',
      requestUserId: 'body-user',
      verifySession,
    });
    expect(result).toEqual({ userId: 'body-user', isAuthenticated: false });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it('falls back safely (unauthenticated) when verification throws', async () => {
    const result = await resolveChatUser({
      authHeader: 'Bearer tokenA',
      requestUserId: 'body-user',
      verifySession: vi.fn().mockRejectedValue(new Error('network')),
    });
    expect(result).toEqual({ userId: 'body-user', isAuthenticated: false });
  });

  it('uses memory userId as a last resort, then null', async () => {
    const noToken = { authHeader: null, verifySession: vi.fn() };
    expect(await resolveChatUser({ ...noToken, requestUserId: null, memoryUserId: 'mem' })).toEqual({
      userId: 'mem',
      isAuthenticated: false,
    });
    expect(await resolveChatUser({ ...noToken, requestUserId: null })).toEqual({
      userId: null,
      isAuthenticated: false,
    });
  });
});
