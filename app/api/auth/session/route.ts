import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken)

    // Check allowlist
    const allowedEmails = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim())
    if (!decodedToken.email || !allowedEmails.includes(decodedToken.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create session cookie (5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return NextResponse.json({ status: 'success' })
}
