import { describe, it, expect } from 'vitest';
import { signImageStreamToken, verifyImageStreamToken } from '../stream-token';

describe('image stream token', () => {
  it('round-trips claims for a valid token', () => {
    const token = signImageStreamToken({ jobId: 'j1', userId: 'u1' });
    expect(token).toBeTruthy();
    expect(verifyImageStreamToken(token)).toEqual({ jobId: 'j1', userId: 'u1' });
  });

  it('rejects a token whose payload was tampered with', () => {
    const token = signImageStreamToken({ jobId: 'j1', userId: 'u1' })!;
    const [payload, sig] = token.split('.');
    expect(verifyImageStreamToken(`${payload}x.${sig}`)).toBeNull();
  });

  it('rejects a token with a wrong signature', () => {
    const token = signImageStreamToken({ jobId: 'j1', userId: 'u1' })!;
    const payload = token.split('.')[0];
    expect(verifyImageStreamToken(`${payload}.deadbeef`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signImageStreamToken({ jobId: 'j1', userId: 'u1' }, -1)!; // already past exp
    expect(verifyImageStreamToken(token)).toBeNull();
  });

  it('rejects null / empty / malformed input', () => {
    expect(verifyImageStreamToken(null)).toBeNull();
    expect(verifyImageStreamToken(undefined)).toBeNull();
    expect(verifyImageStreamToken('')).toBeNull();
    expect(verifyImageStreamToken('garbage')).toBeNull();
    expect(verifyImageStreamToken('.onlyparts')).toBeNull();
  });
});
