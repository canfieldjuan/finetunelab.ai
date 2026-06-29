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
      'http://localhost./mcp', // trailing-dot loopback spelling
      'http://127.0.0.1/mcp',
      'http://127.1/mcp', // WHATWG normalizes to 127.0.0.1
      'http://10.0.0.5/mcp',
      'http://192.168.1.10/mcp',
      'http://169.254.169.254/latest/meta-data',
      'http://172.16.0.1/mcp',
      'http://172.31.255.255/mcp',
      'http://service.local/mcp',
      'http://[::1]/mcp',
      'http://[::ffff:127.0.0.1]/mcp', // IPv4-mapped IPv6 loopback
      'http://[::ffff:192.168.1.1]/mcp', // IPv4-mapped IPv6 private
    ]) {
      expect(() => assertSafeHttpUrl(host), host).toThrow(/not allowed/);
    }
  });

  it('allows public IPs, public domains, and public IPv6 (no false positives)', () => {
    expect(assertSafeHttpUrl('http://172.32.0.1/mcp').hostname).toBe('172.32.0.1');
    expect(assertSafeHttpUrl('https://8.8.8.8/mcp').hostname).toBe('8.8.8.8');
    // Public DNS names that happen to start with fc/fd must NOT be flagged as IPv6 ULA.
    expect(assertSafeHttpUrl('https://fda.gov/mcp').hostname).toBe('fda.gov');
    expect(assertSafeHttpUrl('https://fc-barcelona.com/mcp').hostname).toBe('fc-barcelona.com');
    expect(assertSafeHttpUrl('http://[2606:4700::1]/mcp').hostname).toBe('[2606:4700::1]');
  });
});
