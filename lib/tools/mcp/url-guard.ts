// MCP Client - URL guard
//
// Validates HTTP MCP server URLs. Once non-operators can configure server URLs,
// the app makes outbound requests (with auth headers) to user-chosen hosts, so we
// reject non-http(s) protocols and internal/private/link-local targets to limit
// SSRF / secret egress.
//
// `assertSafeHttpUrl` is a sync string/hostname best-effort check. The authoritative
// defense against DNS rebinding (public hostname -> private IP) and against rows that
// bypassed write-time validation is the async `assertResolvedHostIsPublic`, which
// resolves the host and checks the real IPs — call it at connect time.
// See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md.

import { lookup } from 'dns/promises';

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

function isPrivateIpv6Literal(addr: string): boolean {
  // `addr` is an IPv6 address with brackets already stripped, lowercased.
  if (addr === '::1' || addr === '::') return true;
  if (/^fe[89ab]/.test(addr)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(addr)) return true; // unique-local fc00::/7
  if (addr.startsWith('2001:db8')) return true; // documentation 2001:db8::/32
  if (addr.includes('::ffff:')) return true; // IPv4-mapped (e.g. ::ffff:7f00:1) — reject
  return false;
}

// Any IPv4 range that is not globally routable (loopback, private, CGNAT, link-local,
// test-nets, benchmarking, multicast, reserved, "this network", broadcast).
function isNonGlobalIpv4(host: string): boolean {
  return (
    /^0\./.test(host) || // 0.0.0.0/8 "this network"
    /^10\./.test(host) || // private
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || // 100.64.0.0/10 CGNAT
    /^127\./.test(host) || // loopback
    /^169\.254\./.test(host) || // link-local
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || // 172.16.0.0/12 private
    /^192\.0\.0\./.test(host) || // 192.0.0.0/24 IETF protocol assignments
    /^192\.0\.2\./.test(host) || // TEST-NET-1
    /^192\.168\./.test(host) || // private
    /^198\.1[89]\./.test(host) || // 198.18.0.0/15 benchmarking
    /^198\.51\.100\./.test(host) || // TEST-NET-2
    /^203\.0\.113\./.test(host) || // TEST-NET-3
    /^(22[4-9]|23\d)\./.test(host) || // 224.0.0.0/4 multicast
    /^(24\d|25[0-5])\./.test(host) // 240.0.0.0/4 reserved + 255.255.255.255 broadcast
  );
}

function isPrivateIpv4OrLocalName(host: string): boolean {
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  // WHATWG URL normalizes shorthand/hex IPv4 (127.1, 0x7f...) to dotted decimal.
  return isNonGlobalIpv4(host);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  // IPv6 literals arrive bracketed (e.g. "[::1]"); only then apply IPv6 rules, so
  // public DNS names like "fda.gov" / "fc-barcelona.com" aren't false-flagged.
  const isIpv6Literal = hostname.startsWith('[');
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, ''); // strip brackets + trailing dot

  return isIpv6Literal ? isPrivateIpv6Literal(host) : isPrivateIpv4OrLocalName(host);
}

/** Validate a server URL is http(s) and not an internal/private target. Returns the parsed URL. */
export function assertSafeHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`[MCP] Invalid server url: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`[MCP] Server url must use http(s), got: ${url.protocol}`);
  }
  if (isPrivateOrLocalHost(url.hostname)) {
    throw new Error(`[MCP] Server url host is not allowed (internal/private target): ${url.hostname}`);
  }
  return url;
}

/** True if a *resolved* IP literal (v4 or v6) is loopback/private/link-local. */
export function isPrivateIpAddress(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (addr.includes(':')) {
    // IPv4-mapped IPv6 with a dotted tail (::ffff:127.0.0.1): check the embedded IPv4.
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4OrLocalName(mapped[1]);
    return isPrivateIpv6Literal(addr);
  }
  return isPrivateIpv4OrLocalName(addr);
}

/**
 * Authoritative SSRF guard: resolve `hostname` and reject if ANY resolved address is
 * loopback/private/link-local. Catches DNS rebinding and rows that bypassed the
 * write-time `assertSafeHttpUrl` (e.g. a direct DB insert). Call at connect time.
 *
 * Residual: there is a TOCTOU window between this lookup and the transport's own
 * connect-time DNS resolution; pinning the resolved IP into the request is a deeper
 * follow-up.
 */
export async function assertResolvedHostIsPublic(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch (error) {
    throw new Error(
      `[MCP] Could not resolve host "${hostname}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const { address } of addresses) {
    if (isPrivateIpAddress(address)) {
      throw new Error(`[MCP] Host "${hostname}" resolves to a non-public address (${address}); refusing to connect`);
    }
  }
}
