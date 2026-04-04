import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Allow auth-related routes and static assets
  const publicPaths = ['/login', '/api/auth', '/_next', '/favicon.ico']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Check for session cookie
  const session = request.cookies.get('session')
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
