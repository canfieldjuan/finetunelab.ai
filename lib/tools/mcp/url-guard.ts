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

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;

  // IPv4 loopback / private / link-local ranges.
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  // IPv6 loopback / link-local (fe80::/10) / unique-local (fc00::/7).
  if (host === '::1') return true;
  if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;

  return false;
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
