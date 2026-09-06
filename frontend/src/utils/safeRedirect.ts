/**
 * Guards against open redirects.
 *
 * A destination can reach us from a query param (`?returnTo=`) or from router
 * location state. Anything that isn't a plain in-app path — absolute URLs,
 * protocol-relative `//evil.com`, backslash tricks — is rejected so we never
 * navigate a user off-site.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/')) return null;
  // `//host` and `/\host` are protocol-relative — the browser treats them as external.
  if (path.startsWith('//') || path.startsWith('/\\')) return null;
  return path;
}

/** Build an internal path from a router location-like object. */
export function locationToPath(loc: unknown): string | null {
  if (!loc || typeof loc !== 'object') return null;
  const { pathname, search } = loc as { pathname?: unknown; search?: unknown };
  if (typeof pathname !== 'string') return null;
  const suffix = typeof search === 'string' ? search : '';
  return safeInternalPath(pathname + suffix);
}
