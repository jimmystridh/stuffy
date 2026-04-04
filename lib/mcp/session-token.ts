import { adminAuth } from '@/lib/firebase/admin'

function parseCookieHeader(cookieHeader: string) {
  const pairs = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const cookies = new Map<string, string>()

  for (const pair of pairs) {
    const [name, ...rest] = pair.split('=')
    if (!name || rest.length === 0) continue
    cookies.set(name, rest.join('='))
  }

  return cookies
}

export async function resolveSessionBearerToken(options: {
  request: Request
}): Promise<string | undefined> {
  const cookieHeader = options.request.headers.get('cookie')
  if (!cookieHeader) return undefined

  const cookies = parseCookieHeader(cookieHeader)
  const sessionCookie = cookies.get('session')
  if (!sessionCookie) return undefined

  try {
    await adminAuth.verifySessionCookie(sessionCookie, true)
    return sessionCookie
  } catch {
    return undefined
  }
}
