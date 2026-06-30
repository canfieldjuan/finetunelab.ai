const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

export interface ResolvedAddress {
  address: string;
  family?: number;
}

export type DnsLookup = (
  hostname: string,
  options: { all: true },
) => Promise<ResolvedAddress[]>;

export type RequestLookup = (
  hostname: string,
  options: object,
) => Promise<ResolvedAddress[]>;

interface GuardMessageOptions {
  prefix?: string;
  subject?: string;
}

function guardMessage(message: string, options: GuardMessageOptions = {}): string {
  return options.prefix ? `${options.prefix} ${message}` : message;
}

function lookupHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isPrivateIpv6Literal(addr: string): boolean {
  // `addr` is an IPv6 address with brackets already stripped, lowercased.
  if (addr === '::1' || addr === '::') return true;
  if (/^fe[89ab]/.test(addr)) return true; // link-local fe80::/10
  if (/^fe[cdef]/.test(addr)) return true; // deprecated site-local fec0::/10
  if (/^f[cd]/.test(addr)) return true; // unique-local fc00::/7
  if (/^ff/.test(addr)) return true; // multicast ff00::/8
  if (addr.startsWith('2001:db8')) return true; // documentation 2001:db8::/32
  if (addr.includes('::ffff:')) return true; // IPv4-mapped (e.g. ::ffff:7f00:1) - reject
  return false;
}

// Any IPv4 range that is not globally routable (loopback, private, CGNAT,
// link-local, test-nets, benchmarking, multicast, reserved, "this network",
// broadcast).
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
  // IPv6 literals arrive bracketed (e.g. "[::1]"); only then apply IPv6 rules,
  // so public DNS names like "fda.gov" / "fc-barcelona.com" are not false-flagged.
  const isIpv6Literal = hostname.startsWith('[');
  const host = lookupHostname(hostname);

  return isIpv6Literal ? isPrivateIpv6Literal(host) : isPrivateIpv4OrLocalName(host);
}

/** Validate a URL is http(s) and not an internal/private target. */
export function assertSafeHttpUrl(rawUrl: string, options: GuardMessageOptions = {}): URL {
  const subject = options.subject ?? 'URL';
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(guardMessage(`Invalid ${subject}: ${rawUrl}`, options));
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(guardMessage(`${subject} must use http(s), got: ${url.protocol}`, options));
  }
  if (isPrivateOrLocalHost(url.hostname)) {
    throw new Error(
      guardMessage(`${subject} host is not allowed (internal/private target): ${url.hostname}`, options),
    );
  }
  return url;
}

/** True if a resolved IP literal (v4 or v6) is loopback/private/link-local. */
export function isPrivateIpAddress(ip: string): boolean {
  const addr = lookupHostname(ip);
  if (addr.includes(':')) {
    // IPv4-mapped IPv6 with a dotted tail (::ffff:127.0.0.1): check the embedded IPv4.
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4OrLocalName(mapped[1]);
    return isPrivateIpv6Literal(addr);
  }
  return isPrivateIpv4OrLocalName(addr);
}

function withFamily(address: ResolvedAddress): ResolvedAddress {
  return {
    address: address.address,
    family: address.family ?? (address.address.includes(':') ? 6 : 4),
  };
}

export async function resolvePublicHost(
  hostname: string,
  lookup: DnsLookup,
  options: GuardMessageOptions = {},
): Promise<ResolvedAddress[]> {
  const host = lookupHostname(hostname);
  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(host, { all: true });
  } catch (error) {
    throw new Error(
      guardMessage(
        `Could not resolve host "${hostname}": ${error instanceof Error ? error.message : String(error)}`,
        options,
      ),
    );
  }

  if (addresses.length === 0) {
    throw new Error(guardMessage(`Could not resolve host "${hostname}": no addresses returned`, options));
  }

  for (const { address } of addresses) {
    if (isPrivateIpAddress(address)) {
      throw new Error(
        guardMessage(`Host "${hostname}" resolves to a non-public address (${address}); refusing to connect`, options),
      );
    }
  }

  return addresses.map(withFamily);
}

export function createPinnedPublicLookup(
  expectedHostname: string,
  addresses: ResolvedAddress[],
  options: GuardMessageOptions = {},
): RequestLookup {
  const expected = lookupHostname(expectedHostname);
  const pinned = addresses.map(withFamily);

  return async (hostname: string): Promise<ResolvedAddress[]> => {
    if (lookupHostname(hostname) !== expected) {
      throw new Error(guardMessage(`Refusing to resolve unexpected host "${hostname}"`, options));
    }

    for (const { address } of pinned) {
      if (isPrivateIpAddress(address)) {
        throw new Error(
          guardMessage(`Pinned host "${hostname}" has a non-public address (${address}); refusing to connect`, options),
        );
      }
    }

    return pinned;
  };
}
