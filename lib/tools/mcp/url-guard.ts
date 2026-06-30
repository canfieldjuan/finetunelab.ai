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
import {
  assertSafeHttpUrl as assertSharedSafeHttpUrl,
  isPrivateIpAddress,
  resolvePublicHost,
} from '../url-safety';

export { isPrivateIpAddress };

/** Validate a server URL is http(s) and not an internal/private target. Returns the parsed URL. */
export function assertSafeHttpUrl(rawUrl: string): URL {
  return assertSharedSafeHttpUrl(rawUrl, { prefix: '[MCP]', subject: 'server url' });
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
  await resolvePublicHost(hostname, lookup, { prefix: '[MCP]' });
}
