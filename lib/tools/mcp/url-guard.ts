// MCP Client - URL guard
//
// Validates HTTP MCP server URLs. Once non-operators can configure server URLs,
// the app makes outbound requests (with auth headers) to user-chosen hosts, so we
// reject non-http(s) protocols and internal/private/link-local targets to limit
// SSRF / secret egress.
//
// NOTE: this is string/hostname-based. It does NOT defend against DNS rebinding
// (a public hostname resolving to a private IP); resolve-time checks belong in the
// connect path (Slice 3). See PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md.

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

function isPrivateIpv6Literal(addr: string): boolean {
  // `addr` is an IPv6 address with brackets already stripped, lowercased.
  if (addr === '::1' || addr === '::') return true;
  if (/^fe[89ab]/.test(addr)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(addr)) return true; // unique-local fc00::/7
  if (addr.includes('::ffff:')) return true; // IPv4-mapped (e.g. ::ffff:7f00:1) — reject
  return false;
}

function isPrivateIpv4OrLocalName(host: string): boolean {
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  // WHATWG URL normalizes shorthand/hex IPv4 (127.1, 0x7f...) to dotted decimal.
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
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
