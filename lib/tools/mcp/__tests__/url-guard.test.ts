import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertResolvedHostIsPublic, assertSafeHttpUrl, isPrivateIpAddress } from '../url-guard';

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('dns/promises', () => ({ lookup: dns.lookup }));

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

describe('isPrivateIpAddress', () => {
  it('flags loopback/private/link-local IPv4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.1.1', '172.16.0.1', '0.0.0.0']) {
      expect(isPrivateIpAddress(ip), ip).toBe(true);
    }
  });

  it('flags non-globally-routable IPv4 (CGNAT, test-nets, reserved, multicast)', () => {
    for (const ip of [
      '0.1.2.3', // 0.0.0.0/8
      '100.64.0.1', '100.127.255.255', // CGNAT 100.64.0.0/10
      '192.0.0.1', // IETF 192.0.0.0/24
      '192.0.2.5', // TEST-NET-1
      '198.18.0.1', '198.19.255.1', // benchmarking 198.18.0.0/15
      '198.51.100.7', // TEST-NET-2
      '203.0.113.9', // TEST-NET-3
      '224.0.0.1', '239.1.1.1', // multicast 224.0.0.0/4
      '240.0.0.1', '255.255.255.255', // reserved + broadcast
    ]) {
      expect(isPrivateIpAddress(ip), ip).toBe(true);
    }
  });

  it('flags loopback/ULA/link-local + IPv4-mapped + doc IPv6', () => {
    for (const ip of ['::1', 'fe80::1', 'fc00::1', 'fd12::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:192.168.1.1']) {
      expect(isPrivateIpAddress(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4 and IPv6 (incl. CGNAT range boundaries)', () => {
    expect(isPrivateIpAddress('8.8.8.8')).toBe(false);
    expect(isPrivateIpAddress('172.32.0.1')).toBe(false);
    expect(isPrivateIpAddress('100.63.0.1')).toBe(false); // just below CGNAT (100.64/10)
    expect(isPrivateIpAddress('100.128.0.1')).toBe(false); // just above CGNAT
    expect(isPrivateIpAddress('2606:4700::1')).toBe(false);
    expect(isPrivateIpAddress('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('assertResolvedHostIsPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves and passes for a public address', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(assertResolvedHostIsPublic('example.com')).resolves.toBeUndefined();
    expect(dns.lookup).toHaveBeenCalledWith('example.com', { all: true });
  });

  it('rejects when ANY resolved address is private (DNS rebinding defense)', async () => {
    dns.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);
    await expect(assertResolvedHostIsPublic('rebind.evil')).rejects.toThrow(/non-public address/);
  });

  it('rejects when resolution fails', async () => {
    dns.lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertResolvedHostIsPublic('nope.invalid')).rejects.toThrow(/Could not resolve/);
  });
});
