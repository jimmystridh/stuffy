function parseUri(uri: string) {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

export function redirectUrisMatch(expected: string, actual: string) {
  if (expected === actual) return true

  const a = parseUri(expected)
  const b = parseUri(actual)
  if (!a || !b) return false

  return (
    a.protocol === b.protocol &&
    (a.hostname === b.hostname ||
      (isLoopbackHost(a.hostname) && isLoopbackHost(b.hostname))) &&
    a.port === b.port &&
    normalizePathname(a.pathname) === normalizePathname(b.pathname) &&
    a.search === b.search
  )
}
