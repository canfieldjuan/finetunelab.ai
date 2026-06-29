import { describe, expect, it } from 'vitest';
import { assertSafeHttpUrl } from '../url-guard';

describe('assertSafeHttpUrl', () => {
  it('accepts public http(s) urls', () => {
    expect(assertSafeHttpUrl('https://api.example.com/mcp').hostname).toBe('api.example.com');
    expect(assertSafeHttpUrl('http://example.org:8080/mcp').protocol).toBe('http:');
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => assertSafeHttpUrl('file:///etc/passwd')).toThrow(/http\(s\)/);
    expect(() => assertSafeHttpUrl('ftp://example.com')).toThrow(/http\(s\)/);
  });

  it('rejects invalid urls', () => {
    expect(() => assertSafeHttpUrl('not a url')).toThrow(/Invalid server url/);
  });

  it('rejects internal/private/link-local targets (SSRF)', () => {
    for (const host of [
      'http://localhost/mcp',
      'http://127.0.0.1/mcp',
      'http://10.0.0.5/mcp',
      'http://192.168.1.10/mcp',
      'http://169.254.169.254/latest/meta-data',
      'http://172.16.0.1/mcp',
      'http://172.31.255.255/mcp',
      'http://service.local/mcp',
      'http://[::1]/mcp',
    ]) {
      expect(() => assertSafeHttpUrl(host), host).toThrow(/not allowed/);
    }
  });

  it('allows public IPs and 172 ranges outside the private block', () => {
    expect(assertSafeHttpUrl('http://172.32.0.1/mcp').hostname).toBe('172.32.0.1');
    expect(assertSafeHttpUrl('https://8.8.8.8/mcp').hostname).toBe('8.8.8.8');
  });
});
